/**
 * Stremio Addon Protocol — stream resolution
 * Fetches streams from any Stremio-compatible addon using IMDB IDs.
 * Real Debrid resolution is applied post-fetch for cached torrent streams.
 */

export interface StreamBehaviorHints {
  notWebReady?: boolean
  cached?: boolean
  bingeGroup?: string
  videoHash?: string
  videoSize?: number
  filename?: string
}

export interface StreamSource {
  name?: string
  title?: string
  url?: string
  infoHash?: string
  fileIdx?: number
  sources?: string[]
  behaviorHints?: StreamBehaviorHints
  // enriched fields
  addonName: string
  addonId: string
  quality: string
  size: string
  isRdCached?: boolean
  resolvedUrl?: string
}

export interface AddonConfig {
  id: string
  name: string
  url: string
  enabled: boolean
  logo?: string
  version?: string
  description?: string
  types?: string[]
}

const ADDONS_KEY = 'arvio_addons_v1'

export function loadAddons(): AddonConfig[] {
  try {
    const raw = localStorage.getItem(ADDONS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAddons(addons: AddonConfig[]): void {
  localStorage.setItem(ADDONS_KEY, JSON.stringify(addons))
}

export function addAddon(addon: AddonConfig): void {
  const addons = loadAddons()
  const idx = addons.findIndex((a) => a.id === addon.id)
  if (idx >= 0) addons[idx] = addon
  else addons.push(addon)
  saveAddons(addons)
}

export function removeAddon(addonId: string): void {
  saveAddons(loadAddons().filter((a) => a.id !== addonId))
}

export function toggleAddon(addonId: string, enabled: boolean): void {
  const addons = loadAddons().map((a) => (a.id === addonId ? { ...a, enabled } : a))
  saveAddons(addons)
}

/** Fetch manifest from a Stremio addon URL */
export async function fetchAddonManifest(manifestUrl: string): Promise<AddonConfig> {
  // Convert stremio:// deep-links to https://
  const normalized = manifestUrl.trim().startsWith('stremio://')
    ? 'https://' + manifestUrl.trim().slice('stremio://'.length)
    : manifestUrl.trim()
  const url = normalized.endsWith('/manifest.json') ? normalized : `${normalized.replace(/\/$/, '')}/manifest.json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.status}`)
  const manifest = await res.json()
  const baseUrl = url.replace('/manifest.json', '')
  return {
    id: manifest.id,
    name: manifest.name,
    url: baseUrl,
    enabled: true,
    logo: manifest.logo ?? undefined,
    version: manifest.version,
    description: manifest.description ?? undefined,
    types: manifest.types ?? [],
  }
}

interface StremioStreamResponse {
  streams?: StremioStream[]
}

interface StremioStream {
  name?: string
  title?: string
  url?: string
  infoHash?: string
  fileIdx?: number
  sources?: string[]
  behaviorHints?: {
    notWebReady?: boolean
    cached?: boolean
    bingeGroup?: string
    videoHash?: string
    videoSize?: number
    filename?: string
  }
}

function parseQuality(str: string): string {
  const s = str.toUpperCase()
  if (s.includes('4K') || s.includes('2160')) return '4K'
  if (s.includes('1080')) return '1080p'
  if (s.includes('720')) return '720p'
  if (s.includes('480')) return '480p'
  if (s.includes('CAM') || s.includes('HDCAM')) return 'CAM'
  return 'SD'
}

function parseSize(str: string): string {
  const match = str.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i)
  return match ? `${match[1]} ${match[2].toUpperCase()}` : ''
}

function normalizeStream(raw: StremioStream, addonName: string, addonId: string): StreamSource {
  const combined = `${raw.name ?? ''} ${raw.title ?? ''}`
  return {
    name: raw.name,
    title: raw.title,
    url: raw.url,
    infoHash: raw.infoHash,
    fileIdx: raw.fileIdx,
    sources: raw.sources,
    behaviorHints: raw.behaviorHints,
    addonName,
    addonId,
    quality: parseQuality(combined),
    size: parseSize(combined),
    isRdCached: raw.behaviorHints?.cached ?? false,
  }
}

/** Fetch streams for a movie from a single addon */
async function fetchMovieStreams(addon: AddonConfig, imdbId: string): Promise<StreamSource[]> {
  try {
    const url = `${addon.url}/stream/movie/${encodeURIComponent(imdbId)}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data: StremioStreamResponse = await res.json()
    return (data.streams ?? []).map((s) => normalizeStream(s, addon.name, addon.id))
  } catch {
    return []
  }
}

/** Fetch streams for a TV episode from a single addon */
async function fetchEpisodeStreams(
  addon: AddonConfig,
  imdbId: string,
  season: number,
  episode: number
): Promise<StreamSource[]> {
  try {
    const id = `${imdbId}:${season}:${episode}`
    const url = `${addon.url}/stream/series/${encodeURIComponent(id)}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data: StremioStreamResponse = await res.json()
    return (data.streams ?? []).map((s) => normalizeStream(s, addon.name, addon.id))
  } catch {
    return []
  }
}

export interface StreamFetchResult {
  streams: StreamSource[]
  addonId: string
  addonName: string
  error?: string
}

/** Fetch streams from all enabled addons for a movie, returning results per-addon as they arrive */
export async function fetchMovieStreamsAll(
  imdbId: string,
  onResult: (result: StreamFetchResult) => void
): Promise<void> {
  const addons = loadAddons().filter((a) => a.enabled)
  if (addons.length === 0) {
    onResult({ streams: [], addonId: '', addonName: '', error: 'No addons configured. Add a streaming addon in Settings → Addons.' })
    return
  }
  await Promise.all(
    addons.map(async (addon) => {
      try {
        const streams = await fetchMovieStreams(addon, imdbId)
        onResult({ streams, addonId: addon.id, addonName: addon.name })
      } catch (e) {
        onResult({ streams: [], addonId: addon.id, addonName: addon.name, error: String(e) })
      }
    })
  )
}

/** Fetch streams from all enabled addons for a TV episode */
export async function fetchEpisodeStreamsAll(
  imdbId: string,
  season: number,
  episode: number,
  onResult: (result: StreamFetchResult) => void
): Promise<void> {
  const addons = loadAddons().filter((a) => a.enabled)
  if (addons.length === 0) {
    onResult({ streams: [], addonId: '', addonName: '', error: 'No addons configured. Add a streaming addon in Settings → Addons.' })
    return
  }
  await Promise.all(
    addons.map(async (addon) => {
      try {
        const streams = await fetchEpisodeStreams(addon, imdbId, season, episode)
        onResult({ streams, addonId: addon.id, addonName: addon.name })
      } catch (e) {
        onResult({ streams: [], addonId: addon.id, addonName: addon.name, error: String(e) })
      }
    })
  )
}
