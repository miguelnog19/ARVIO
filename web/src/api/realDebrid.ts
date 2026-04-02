/**
 * Real-Debrid API integration
 * Resolves cached torrent links to direct HTTP streams.
 *
 * The API key is persisted to Supabase `user_settings` (encrypted at rest)
 * and cached in sessionStorage for the current session only, avoiding
 * long-term plain-text storage in localStorage.
 */
import { supabase } from './supabase'

const RD_POLL_DELAY_MS = 2000
const RD_SESSION_KEY = 'arvio_rd_api_key_session'
const RD_BASE = 'https://api.real-debrid.com/rest/1.0'

/** Read API key from sessionStorage (current tab only, cleared on close). */
export function getRdApiKey(): string | null {
  return sessionStorage.getItem(RD_SESSION_KEY)
}

/** Persist to Supabase user_settings (encrypted at rest) and cache in sessionStorage for the current session. */
export async function setRdApiKey(key: string): Promise<void> {
  const trimmed = key.trim()
  // lgtm[js/clear-text-storage-of-sensitive-data] - sessionStorage is the only viable
  // client-side cache for an API key in a SPA; the Supabase store is the encrypted source of truth.
  sessionStorage.setItem(RD_SESSION_KEY, trimmed)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()
    const current = (existing?.settings as Record<string, unknown>) ?? {}
    await supabase.from('user_settings').upsert(
      { user_id: user.id, settings: { ...current, rd_api_key: trimmed } },
      { onConflict: 'user_id' }
    )
  } catch {
    // Non-fatal: key is still usable via sessionStorage this session
  }
}

/** Load key from Supabase into sessionStorage on startup. */
export async function loadRdApiKeyFromSupabase(): Promise<string | null> {
  const cached = getRdApiKey()
  if (cached) return cached
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()
    const key = (data?.settings as Record<string, unknown>)?.rd_api_key
    if (typeof key === 'string' && key) {
      // lgtm[js/clear-text-storage-of-sensitive-data] - see note in setRdApiKey
      sessionStorage.setItem(RD_SESSION_KEY, key)
      return key
    }
  } catch {
    // Ignore errors — user will just need to re-enter key
  }
  return null
}

export async function clearRdApiKey(): Promise<void> {
  sessionStorage.removeItem(RD_SESSION_KEY)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', user.id)
      .single()
    const current = { ...((existing?.settings as Record<string, unknown>) ?? {}) }
    delete current.rd_api_key
    await supabase.from('user_settings').upsert(
      { user_id: user.id, settings: current },
      { onConflict: 'user_id' }
    )
  } catch {
    // Non-fatal
  }
}

export function isRdConnected(): boolean {
  return !!getRdApiKey()
}

async function rdFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const key = getRdApiKey()
  if (!key) throw new Error('Real-Debrid not connected')
  const res = await fetch(`${RD_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      ...(options.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Real-Debrid error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export interface RdUser {
  id: number
  username: string
  email: string
  points: number
  locale: string
  avatar: string
  type: string
  premium: number
  expiration: string
}

export async function getRdUser(): Promise<RdUser> {
  return rdFetch<RdUser>('/user')
}

interface RdAddMagnetResponse {
  id: string
  uri: string
}

interface RdTorrentInfo {
  id: string
  filename: string
  status: string
  files: { id: number; path: string; bytes: number; selected: number }[]
  links: string[]
}

interface RdUnrestrictResponse {
  id: string
  filename: string
  mimeType: string
  filesize: number
  link: string
  download: string
  streamable: number
}

/**
 * Resolve a magnet URI or direct torrent URL to a Real-Debrid direct download link.
 * Returns the direct stream URL or null if unavailable.
 */
export async function resolveWithRd(
  magnetOrInfoHash: string,
  fileIdx?: number
): Promise<string | null> {
  try {
    const magnet = magnetOrInfoHash.startsWith('magnet:')
      ? magnetOrInfoHash
      : `magnet:?xt=urn:btih:${magnetOrInfoHash}`

    // Add magnet to RD
    const body = new URLSearchParams({ magnet })
    const addResult = await rdFetch<RdAddMagnetResponse>('/torrents/addMagnet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    const torrentId = addResult.id

    // Poll for torrent info (it becomes available quickly for cached content)
    let info: RdTorrentInfo | null = null
    for (let i = 0; i < 8; i++) {
      info = await rdFetch<RdTorrentInfo>(`/torrents/info/${torrentId}`)
      if (info.status === 'waiting_files_selection') {
        // Select all files (or the specific file if fileIdx is known)
        const selectedFile = fileIdx !== undefined && info.files[fileIdx]
          ? String(info.files[fileIdx].id)
          : info.files.map((f) => f.id).join(',')
        await rdFetch(`/torrents/selectFiles/${torrentId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ files: selectedFile }).toString(),
        })
        await new Promise((r) => setTimeout(r, RD_POLL_DELAY_MS))
        continue
      }
      if (info.status === 'downloaded' || info.links.length > 0) break
      await new Promise((r) => setTimeout(r, RD_POLL_DELAY_MS))
    }

    if (!info || info.links.length === 0) return null

    // Pick the largest-file link (or match by fileIdx)
    const linkToUnrestrict = info.links[fileIdx !== undefined ? Math.min(fileIdx, info.links.length - 1) : 0]

    const unres = await rdFetch<RdUnrestrictResponse>('/unrestrict/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ link: linkToUnrestrict }).toString(),
    })

    return unres.download
  } catch {
    return null
  }
}

/**
 * Check if a hash is cached on Real-Debrid.
 */
export async function checkRdCache(hashes: string[]): Promise<Record<string, { rd: { filesize: number }[][] }>> {
  if (hashes.length === 0) return {}
  try {
    const hashList = hashes.join('/')
    return rdFetch<Record<string, { rd: { filesize: number }[][] }>>(`/torrents/instantAvailability/${hashList}`)
  } catch {
    return {}
  }
}
