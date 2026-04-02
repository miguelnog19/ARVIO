/**
 * Trakt.tv API — proxied through the Supabase trakt-proxy edge function.
 * Token is stored in Supabase user_settings for cross-device sync.
 */
import { supabase } from './supabase'

const TRAKT_TOKENS_KEY = 'arvio_trakt_tokens'

export interface TraktTokens {
  access_token: string
  refresh_token: string
  expires_at: number // epoch seconds
}

// ——— Token storage (localStorage + Supabase user_settings) ———

export function getTraktTokens(): TraktTokens | null {
  try {
    const raw = localStorage.getItem(TRAKT_TOKENS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveTraktTokensLocally(tokens: TraktTokens): void {
  localStorage.setItem(TRAKT_TOKENS_KEY, JSON.stringify(tokens))
}

export function clearTraktTokens(): void {
  localStorage.removeItem(TRAKT_TOKENS_KEY)
}

export function isTraktConnected(): boolean {
  const t = getTraktTokens()
  return !!t && t.access_token !== ''
}

/** Persist tokens to Supabase so they survive on all devices (mirrors Android behavior) */
async function persistTokensToSupabase(tokens: TraktTokens): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  // The Supabase `profiles.trakt_token` column is jsonb; we serialize TraktTokens as-is
  const traktTokenJson = tokens as unknown as Record<string, unknown>
  await supabase.from('profiles').upsert(
    { id: user.id, trakt_token: traktTokenJson, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )
}

/** Load tokens from Supabase on startup if not in localStorage */
export async function loadTraktTokensFromSupabase(): Promise<TraktTokens | null> {
  const local = getTraktTokens()
  if (local) return local
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase.from('profiles').select('trakt_token').eq('id', user.id).single()
    if (!data?.trakt_token) return null
    const tokens = data.trakt_token as unknown as TraktTokens
    if (!tokens.access_token) return null
    saveTraktTokensLocally(tokens)
    return tokens
  } catch {
    return null
  }
}

// ——— Proxy fetch helper ———

async function traktProxyFetch<T>(
  path: string,
  options: RequestInit & { body?: string } = {},
  requiresAuth = true
): Promise<T> {
  const session = await supabase.auth.getSession()
  const supabaseToken = session.data.session?.access_token

  const tokens = getTraktTokens()
  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${supabaseToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
  }
  if (requiresAuth && tokens) {
    headers['X-Trakt-Token'] = tokens.access_token
  }

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trakt-proxy`
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers ?? {}),
    },
    body: JSON.stringify({ path, ...(options.body ? JSON.parse(options.body) : {}) }),
    method: options.method ?? (options.body ? 'POST' : 'GET'),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Trakt proxy error ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

// ——— Device code OAuth flow ———

export interface TraktDeviceCode {
  device_code: string
  user_code: string
  verification_url: string
  expires_in: number
  interval: number
}

export async function requestTraktDeviceCode(): Promise<TraktDeviceCode> {
  return traktProxyFetch<TraktDeviceCode>('/oauth/device/code', { method: 'POST' }, false)
}

export interface TraktDeviceTokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  error?: string
}

export async function pollTraktDeviceToken(deviceCode: string): Promise<TraktDeviceTokenResponse> {
  return traktProxyFetch<TraktDeviceTokenResponse>(
    '/oauth/device/token',
    { method: 'POST', body: JSON.stringify({ device_code: deviceCode }) },
    false
  )
}

export async function completeTraktAuth(response: TraktDeviceTokenResponse): Promise<void> {
  if (!response.access_token) return
  const tokens: TraktTokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? '',
    expires_at: Date.now() / 1000 + (response.expires_in ?? 7776000),
  }
  saveTraktTokensLocally(tokens)
  await persistTokensToSupabase(tokens)
}

// ——— User profile ———

export interface TraktUser {
  username: string
  name?: string
  ids: { slug: string }
  images?: { avatar?: { full?: string } }
}

export async function getTraktUser(): Promise<TraktUser> {
  return traktProxyFetch<TraktUser>('/users/me')
}

// ——— Scrobbling ———

export async function scrobbleTraktMovie(tmdbId: number, progress: number): Promise<void> {
  await traktProxyFetch('/scrobble/stop', {
    method: 'POST',
    body: JSON.stringify({
      movie: { ids: { tmdb: tmdbId } },
      progress: Math.round(progress * 100),
    }),
  })
}

export async function scrobbleTraktEpisode(
  showTmdbId: number,
  season: number,
  episode: number,
  progress: number
): Promise<void> {
  await traktProxyFetch('/scrobble/stop', {
    method: 'POST',
    body: JSON.stringify({
      show: { ids: { tmdb: showTmdbId } },
      episode: { season, number: episode },
      progress: Math.round(progress * 100),
    }),
  })
}

// ——— Watched history ———

export interface TraktHistoryItem {
  id: number
  watched_at: string
  type: 'movie' | 'episode'
  movie?: { title: string; year: number; ids: { tmdb: number } }
  episode?: { season: number; number: number; title: string; ids: { tmdb: number } }
  show?: { title: string; ids: { tmdb: number } }
}

export async function getTraktHistory(page = 1): Promise<TraktHistoryItem[]> {
  return traktProxyFetch<TraktHistoryItem[]>(`/sync/history?page=${page}&limit=50`)
}
