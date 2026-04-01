import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Calendar, Plus, Check, ChevronLeft, ChevronDown } from 'lucide-react'
import { getTVDetails, getTVCredits, getSimilarTVShows, getBackdropUrl, getPosterUrl } from '../api/tmdb'
import { useWatchlist } from '../hooks/useWatchlist'
import MediaCard from '../components/MediaCard'
import type { TMDBTVDetails, TMDBCredits, TMDBTVShow, TMDBSeason } from '../types/tmdb'

export default function TvDetailPage() {
  const { id } = useParams<{ id: string }>()
  const tvId = Number(id)
  const [show, setShow] = useState<TMDBTVDetails | null>(null)
  const [credits, setCredits] = useState<TMDBCredits | null>(null)
  const [similar, setSimilar] = useState<TMDBTVShow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<TMDBSeason | null>(null)
  const [showSeasons, setShowSeasons] = useState(false)
  const { isInList, add, remove } = useWatchlist()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [tvData, creditsData, similarData] = await Promise.all([
          getTVDetails(tvId),
          getTVCredits(tvId),
          getSimilarTVShows(tvId),
        ])
        setShow(tvData)
        setCredits(creditsData)
        setSimilar(similarData.results.slice(0, 12))
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

  const handleWatchlist = async () => {
    if (inWatchlist) await remove(show.id)
    else await add(show.id, 'tv')
  }

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[55vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={show.name} className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 to-transparent" />
        <Link to="/" className="absolute top-6 left-6 flex items-center gap-1 text-sm text-white/80 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Link>
      </div>

      {/* Content */}
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
                <span className="text-muted">{show.number_of_seasons} Season{show.number_of_seasons > 1 ? 's' : ''}</span>
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

            <button
              onClick={handleWatchlist}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                inWatchlist
                  ? 'bg-green-600/20 border border-green-500/50 text-green-400 hover:bg-green-600/30'
                  : 'bg-accent hover:bg-accent-hover text-white'
              }`}
            >
              {inWatchlist ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
            </button>
          </div>
        </div>

        {/* Seasons */}
        {regularSeasons.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Seasons</h2>
              <div className="relative">
                <button
                  onClick={() => setShowSeasons(!showSeasons)}
                  className="flex items-center gap-2 bg-surface border border-border px-4 py-2 rounded-lg text-sm hover:bg-surface-2 transition-colors"
                >
                  {selectedSeason ? selectedSeason.name : 'Select Season'}
                  <ChevronDown className="w-4 h-4" />
                </button>
                {showSeasons && (
                  <div className="absolute right-0 top-full mt-1 bg-surface-2 border border-border rounded-lg overflow-hidden z-20 min-w-[180px] shadow-xl">
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
            {selectedSeason && (
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
            )}
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

        {/* Similar Shows */}
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
    </div>
  )
}
