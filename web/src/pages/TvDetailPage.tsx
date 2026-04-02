import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Star, Calendar, Plus, Check, ChevronLeft, Play, Film,
  ChevronDown, Clock, Tv
} from 'lucide-react'
import {
  getTVDetails, getTVCredits, getSimilarTVShows, getTVVideos,
  getTVExternalIds, getTVSeason, getBackdropUrl, getPosterUrl,
} from '../api/tmdb'
import { useWatchlist } from '../hooks/useWatchlist'
import { fetchEpisodeStreamsAll, loadAddons, type StreamSource, type StreamFetchResult } from '../api/streams'
import { isRdConnected, checkRdCache } from '../api/realDebrid'
import MediaCard from '../components/MediaCard'
import TrailerModal from '../components/TrailerModal'
import StreamSelector from '../components/StreamSelector'
import type { TMDBTVDetails, TMDBCredits, TMDBTVShow, TMDBSeason, TMDBEpisode, TMDBVideo, TMDBSeasonDetails } from '../types/tmdb'

interface AddonGroup {
  addonId: string
  addonName: string
  streams: StreamSource[]
  loading: boolean
  error?: string
}

export default function TvDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const tvId = Number(id)
  const [show, setShow] = useState<TMDBTVDetails | null>(null)
  const [credits, setCredits] = useState<TMDBCredits | null>(null)
  const [similar, setSimilar] = useState<TMDBTVShow[]>([])
  const [trailers, setTrailers] = useState<TMDBVideo[]>([])
  const [imdbId, setImdbId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<TMDBSeason | null>(null)
  const [seasonDetails, setSeasonDetails] = useState<TMDBSeasonDetails | null>(null)
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [showSeasons, setShowSeasons] = useState(false)
  const [showTrailer, setShowTrailer] = useState(false)
  const [showStreams, setShowStreams] = useState(false)
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([])
  const [pendingEpisode, setPendingEpisode] = useState<{ season: number; episode: number; title: string } | null>(null)
  const { isInList, add, remove } = useWatchlist()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [tvData, creditsData, similarData, videosData, externalData] = await Promise.all([
          getTVDetails(tvId),
          getTVCredits(tvId),
          getSimilarTVShows(tvId),
          getTVVideos(tvId),
          getTVExternalIds(tvId),
        ])
        setShow(tvData)
        setCredits(creditsData)
        setSimilar(similarData.results.slice(0, 12))
        setImdbId(externalData.imdb_id ?? null)
        const officialTrailers = videosData.results.filter(
          (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
        )
        setTrailers(officialTrailers)
        const firstRegularSeason = tvData.seasons?.find((s) => s.season_number > 0) ?? tvData.seasons?.[0] ?? null
        setSelectedSeason(firstRegularSeason)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load TV show')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tvId])

  // Load episodes when season changes
  useEffect(() => {
    if (!selectedSeason) return
    setLoadingEpisodes(true)
    getTVSeason(tvId, selectedSeason.season_number)
      .then(setSeasonDetails)
      .catch(() => setSeasonDetails(null))
      .finally(() => setLoadingEpisodes(false))
  }, [tvId, selectedSeason])

  const openStreamPickerForEpisode = useCallback(async (season: number, episodeNum: number, epTitle: string) => {
    if (!imdbId) {
      setShowStreams(true)
      setPendingEpisode(null)
      setAddonGroups([{ addonId: 'error', addonName: 'Error', streams: [], loading: false, error: 'IMDB ID not available.' }])
      return
    }
    setPendingEpisode({ season, episode: episodeNum, title: epTitle })
    setShowStreams(true)
    const addons = loadAddons()
    setAddonGroups(
      addons.length === 0
        ? [{ addonId: '', addonName: '', streams: [], loading: false, error: 'No addons configured. Add a streaming addon in Settings → Addons.' }]
        : addons.map((a) => ({ addonId: a.id, addonName: a.name, streams: [], loading: true }))
    )

    const hashes: string[] = []
    await fetchEpisodeStreamsAll(imdbId, season, episodeNum, (result: StreamFetchResult) => {
      setAddonGroups((prev) => {
        const exists = prev.some((g) => g.addonId === result.addonId)
        if (!exists) return prev
        return prev.map((g) =>
          g.addonId === result.addonId
            ? { ...g, streams: result.streams, loading: false, error: result.error }
            : g
        )
      })
      if (isRdConnected()) {
        for (const s of result.streams) {
          if (s.infoHash && !s.url) hashes.push(s.infoHash)
        }
      }
    })

    if (isRdConnected() && hashes.length > 0) {
      const cacheMap = await checkRdCache(hashes).catch(() => ({} as Record<string, { rd: { filesize: number }[][] }>))
      setAddonGroups((prev) =>
        prev.map((g) => ({
          ...g,
          streams: g.streams.map((s) =>
            s.infoHash && (cacheMap as Record<string, { rd: { filesize: number }[][] }>)[s.infoHash.toLowerCase()]?.rd?.length > 0
              ? { ...s, isRdCached: true }
              : s
          ),
        }))
      )
    }
  }, [imdbId])

  const handleStreamSelect = useCallback(async (stream: StreamSource) => {
    setShowStreams(false)
    if (!show || !pendingEpisode) return
    const params = new URLSearchParams({
      title: `${show.name} · S${pendingEpisode.season}E${pendingEpisode.episode} — ${pendingEpisode.title}`,
      type: 'tv',
      tmdbId: String(tvId),
      season: String(pendingEpisode.season),
      episode: String(pendingEpisode.episode),
    })
    if (stream.url) {
      params.set('url', stream.url)
    } else if (stream.infoHash) {
      if (isRdConnected()) {
        params.set('infoHash', stream.infoHash)
        if (stream.fileIdx !== undefined) params.set('fileIdx', String(stream.fileIdx))
      } else {
        alert('This is a torrent stream. Connect Real-Debrid in Settings to play it.')
        return
      }
    } else {
      return
    }
    navigate(`/player?${params.toString()}`)
  }, [show, pendingEpisode, tvId, navigate])

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[50vh] bg-surface-2 animate-pulse" />
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-4">
          <div className="h-8 bg-surface-2 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-surface-2 rounded w-2/3 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !show) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <p className="text-red-400 text-lg mb-4">{error || 'Show not found'}</p>
          <Link to="/" className="text-accent hover:underline">← Go Home</Link>
        </div>
      </div>
    )
  }

  const backdrop = getBackdropUrl(show.backdrop_path)
  const poster = getPosterUrl(show.poster_path, 'w342')
  const inWatchlist = isInList(show.id)
  const year = show.first_air_date?.split('-')[0] ?? ''
  const regularSeasons = show.seasons?.filter((s) => s.season_number > 0) ?? []
  const mainTrailer = trailers[0]

  return (
    <div className="min-h-screen">
      <div className="relative h-[55vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={show.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        <Link to="/" className="absolute top-6 left-6 flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors z-10">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 -mt-32 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {poster && (
            <div className="flex-shrink-0">
              <img src={poster} alt={show.name} className="w-48 rounded-xl shadow-2xl border border-border" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-bold mb-2">{show.name}</h1>
            {show.tagline && <p className="text-muted italic mb-4">{show.tagline}</p>}
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-4">
              {year && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted" />
                  <span>{year}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 font-medium">{show.vote_average.toFixed(1)}</span>
              </div>
              {show.number_of_seasons > 0 && (
                <div className="flex items-center gap-1">
                  <Tv className="w-4 h-4 text-muted" />
                  <span>{show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>
                </div>
              )}
              {show.status && (
                <span className={`px-2 py-0.5 rounded text-xs ${show.in_production ? 'bg-green-500/20 text-green-400' : 'bg-surface-2'}`}>
                  {show.status}
                </span>
              )}
            </div>
            {show.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {show.genres.map((g) => (
                  <span key={g.id} className="bg-surface-2 border border-border px-3 py-1 rounded-full text-xs">{g.name}</span>
                ))}
              </div>
            )}
            {show.overview && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6">{show.overview}</p>
            )}
            <div className="flex flex-wrap gap-3">
              {/* Play first episode of selected season */}
              <button
                onClick={() => {
                  const eps = seasonDetails?.episodes
                  if (eps && eps.length > 0) {
                    openStreamPickerForEpisode(eps[0].season_number, eps[0].episode_number, eps[0].name)
                  } else if (selectedSeason) {
                    openStreamPickerForEpisode(selectedSeason.season_number, 1, 'Episode 1')
                  }
                }}
                className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                <Play className="w-4 h-4 fill-white" />
                Play
              </button>
              {mainTrailer && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 border border-border text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Film className="w-4 h-4 text-red-500" />
                  Trailer
                </button>
              )}
              <button
                onClick={async () => {
                  if (inWatchlist) await remove(show.id)
                  else await add(show.id, 'tv')
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                  inWatchlist
                    ? 'bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600/30'
                    : 'bg-surface-2 border border-border text-white hover:bg-surface-3'
                }`}
              >
                {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {inWatchlist ? 'In Watchlist' : 'Watchlist'}
              </button>
            </div>
          </div>
        </div>

        {/* Season selector + episode list */}
        {regularSeasons.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Episodes</h2>
              <div className="relative">
                <button
                  onClick={() => setShowSeasons(!showSeasons)}
                  className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
                >
                  {selectedSeason ? selectedSeason.name : 'Select Season'}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSeasons && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg overflow-hidden z-20 min-w-[180px] shadow-xl max-h-64 overflow-y-auto">
                    {regularSeasons.map((season) => (
                      <button
                        key={season.id}
                        onClick={() => { setSelectedSeason(season); setShowSeasons(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-3 transition-colors ${
                          selectedSeason?.id === season.id ? 'text-accent' : 'text-white'
                        }`}
                      >
                        {season.name}
                        <span className="text-muted ml-2 text-xs">({season.episode_count} eps)</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Episode list */}
            {loadingEpisodes ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 bg-surface rounded-xl border border-border p-3 animate-pulse">
                    <div className="w-36 aspect-video bg-surface-2 rounded-lg flex-shrink-0" />
                    <div className="flex-1 space-y-2 pt-1">
                      <div className="h-4 bg-surface-2 rounded w-1/2" />
                      <div className="h-3 bg-surface-2 rounded w-3/4" />
                      <div className="h-3 bg-surface-2 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : seasonDetails?.episodes && seasonDetails.episodes.length > 0 ? (
              <div className="space-y-2">
                {seasonDetails.episodes.map((ep) => (
                  <EpisodeRow
                    key={ep.id}
                    episode={ep}
                    showName={show.name}
                    onPlay={() => openStreamPickerForEpisode(ep.season_number, ep.episode_number, ep.name)}
                  />
                ))}
              </div>
            ) : selectedSeason ? (
              <div className="bg-surface rounded-xl border border-border p-4">
                <div className="flex gap-4 items-start">
                  {selectedSeason.poster_path && (
                    <img
                      src={`https://image.tmdb.org/t/p/w154${selectedSeason.poster_path}`}
                      alt={selectedSeason.name}
                      className="w-20 rounded-lg flex-shrink-0"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedSeason.name}</h3>
                    <p className="text-sm text-muted mt-1">{selectedSeason.episode_count} episodes · {selectedSeason.air_date?.split('-')[0]}</p>
                    {selectedSeason.overview && <p className="text-sm text-gray-300 mt-2 line-clamp-3">{selectedSeason.overview}</p>}
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* Cast */}
        {credits?.cast && credits.cast.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Cast</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {credits.cast.slice(0, 20).map((person) => (
                <div key={person.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-2 mb-2">
                    {person.profile_path ? (
                      <img src={`https://image.tmdb.org/t/p/w185${person.profile_path}`} alt={person.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-muted">{person.name[0]}</div>
                    )}
                  </div>
                  <p className="text-xs font-medium line-clamp-2 text-white">{person.name}</p>
                  <p className="text-xs text-muted line-clamp-2 mt-0.5">{person.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-12 pb-12">
            <h2 className="text-xl font-semibold mb-4">Similar Shows</h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {similar.map((item) => (
                <MediaCard key={item.id} item={item} />
              ))}
            </div>
          </section>
        )}
      </div>

      {showTrailer && mainTrailer && (
        <TrailerModal
          youtubeKey={mainTrailer.key}
          title={`${show.name} — ${mainTrailer.name}`}
          onClose={() => setShowTrailer(false)}
        />
      )}

      {showStreams && (
        <StreamSelector
          title={pendingEpisode ? `${show.name} · S${pendingEpisode.season}E${pendingEpisode.episode}` : show.name}
          addonGroups={addonGroups}
          onSelect={handleStreamSelect}
          onClose={() => setShowStreams(false)}
        />
      )}
    </div>
  )
}

// ── Episode row component ──────────────────────────────────────────────────

interface EpisodeRowProps {
  episode: TMDBEpisode
  showName: string
  onPlay: () => void
}

function EpisodeRow({ episode, onPlay }: EpisodeRowProps) {
  const stillUrl = episode.still_path ? `https://image.tmdb.org/t/p/w300${episode.still_path}` : null
  const runtime = episode.runtime ? `${episode.runtime}m` : null
  const airDate = episode.air_date ?? null

  return (
    <div className="flex gap-4 bg-surface hover:bg-surface-2 rounded-xl border border-border p-3 transition-colors group">
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-36 aspect-video bg-surface-2 rounded-lg overflow-hidden">
        {stillUrl ? (
          <img src={stillUrl} alt={episode.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted">
            <Tv className="w-6 h-6 opacity-30" />
          </div>
        )}
        <button
          onClick={onPlay}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors"
          aria-label={`Play ${episode.name}`}
        >
          <div className="bg-accent/0 group-hover:bg-accent rounded-full p-2 transition-all scale-75 group-hover:scale-100">
            <Play className="w-5 h-5 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs text-muted font-medium">
              S{episode.season_number} · E{episode.episode_number}
            </span>
            <h3 className="text-sm font-semibold text-white mt-0.5 line-clamp-1">{episode.name}</h3>
          </div>
          <button
            onClick={onPlay}
            className="flex-shrink-0 flex items-center gap-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            <Play className="w-3 h-3 fill-white" />
            Play
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted mt-1.5 flex-wrap">
          {episode.vote_average > 0 && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400">{episode.vote_average.toFixed(1)}</span>
            </span>
          )}
          {runtime && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {runtime}
            </span>
          )}
          {airDate && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {airDate}
            </span>
          )}
        </div>
        {episode.overview && (
          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 leading-relaxed">{episode.overview}</p>
        )}
      </div>
    </div>
  )
}
