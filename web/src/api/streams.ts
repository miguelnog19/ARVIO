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
const ADDONS_SEEDED_KEY = 'arvio_addons_seeded_v1'

const OPENSUBTITLES_ADDON: AddonConfig = {
  id: 'opensubtitles-v3.strem.io',
  name: 'OpenSubtitles v3',
  url: 'https://opensubtitles-v3.strem.io',
  enabled: true,
  logo: 'https://opensubtitles-v3.strem.io/logo.png',
  version: '3.0.0',
  description: 'Search and display subtitles from OpenSubtitles',
  types: ['movie', 'series'],
}

export function loadAddons(): AddonConfig[] {
  try {
    // Seed OpenSubtitles on first use
    if (!localStorage.getItem(ADDONS_SEEDED_KEY)) {
      const existing = JSON.parse(localStorage.getItem(ADDONS_KEY) ?? '[]') as AddonConfig[]
      const hasOs = existing.some((a) => a.id === OPENSUBTITLES_ADDON.id)
      if (!hasOs) {
        localStorage.setItem(ADDONS_KEY, JSON.stringify([...existing, OPENSUBTITLES_ADDON]))
      }
      localStorage.setItem(ADDONS_SEEDED_KEY, '1')
    }
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

// ── OpenSubtitles Subtitle Fetching ────────────────────────────────────────

export interface SubtitleTrack {
  id: string
  url: string
  lang: string
  label: string
  format: string // 'vtt' | 'srt' | 'ass' etc.
}

interface StremioSubtitleResponse {
  subtitles?: { id: string; url: string; lang: string; [k: string]: unknown }[]
}

/**
 * Fetch subtitles for a movie from the OpenSubtitles Stremio addon.
 * @param imdbId  e.g. "tt1234567"
 * @param lang    optional BCP-47 language code to filter (e.g. "eng")
 */
export async function fetchMovieSubtitles(imdbId: string, lang?: string): Promise<SubtitleTrack[]> {
  return fetchSubtitles(`movie/${encodeURIComponent(imdbId)}`, lang)
}

/**
 * Fetch subtitles for a TV episode.
 * @param imdbId  show IMDB id (e.g. "tt0944947")
 * @param season / episode numbers
 */
export async function fetchEpisodeSubtitles(imdbId: string, season: number, episode: number, lang?: string): Promise<SubtitleTrack[]> {
  return fetchSubtitles(`series/${encodeURIComponent(`${imdbId}:${season}:${episode}`)}`, lang)
}

async function fetchSubtitles(idPath: string, lang?: string): Promise<SubtitleTrack[]> {
  const os = loadAddons().find((a) => a.id === OPENSUBTITLES_ADDON.id && a.enabled)
  if (!os) return []
  try {
    const url = `${os.url}/subtitles/${idPath}.json`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data: StremioSubtitleResponse = await res.json()
    const subs = data.subtitles ?? []
    const filtered = lang ? subs.filter((s) => s.lang?.toLowerCase().startsWith(lang.toLowerCase())) : subs
    return filtered.map((s) => ({
      id: s.id,
      url: s.url,
      lang: s.lang,
      label: langToLabel(s.lang),
      format: (s.url?.split('.').pop() ?? 'vtt') as string,
    }))
  } catch {
    return []
  }
}

function langToLabel(lang: string): string {
  const MAP: Record<string, string> = {
    eng: 'English', spa: 'Spanish', por: 'Portuguese', fra: 'French',
    deu: 'German', ita: 'Italian', jpn: 'Japanese', kor: 'Korean',
    zho: 'Chinese', ara: 'Arabic', rus: 'Russian', nld: 'Dutch',
    pol: 'Polish', swe: 'Swedish', nor: 'Norwegian', fin: 'Finnish',
    dan: 'Danish', tur: 'Turkish', ron: 'Romanian', hun: 'Hungarian',
    ces: 'Czech', slk: 'Slovak', hrv: 'Croatian', srp: 'Serbian',
    bul: 'Bulgarian', ukr: 'Ukrainian', ell: 'Greek', heb: 'Hebrew',
    hin: 'Hindi', tha: 'Thai', vie: 'Vietnamese', ind: 'Indonesian',
  }
  return MAP[lang?.toLowerCase()] ?? lang?.toUpperCase() ?? 'Unknown'
}
