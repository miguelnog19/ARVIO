import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Clock, Calendar, Plus, Check, ChevronLeft } from 'lucide-react'
import { getMovieDetails, getMovieCredits, getSimilarMovies, getBackdropUrl, getPosterUrl } from '../api/tmdb'
import { useWatchlist } from '../hooks/useWatchlist'
import MediaCard from '../components/MediaCard'
import type { TMDBMovieDetails, TMDBCredits, TMDBMovie } from '../types/tmdb'

export default function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const movieId = Number(id)
  const [movie, setMovie] = useState<TMDBMovieDetails | null>(null)
  const [credits, setCredits] = useState<TMDBCredits | null>(null)
  const [similar, setSimilar] = useState<TMDBMovie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { isInList, add, remove } = useWatchlist()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [movieData, creditsData, similarData] = await Promise.all([
          getMovieDetails(movieId),
          getMovieCredits(movieId),
          getSimilarMovies(movieId),
        ])
        setMovie(movieData)
        setCredits(creditsData)
        setSimilar(similarData.results.slice(0, 12))
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load movie')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [movieId])

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-[50vh] bg-surface-2 animate-pulse" />
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-4">
          <div className="h-8 bg-surface-2 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-surface-2 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-surface-2 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !movie) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <p className="text-red-400 text-lg mb-4">{error || 'Movie not found'}</p>
          <Link to="/" className="text-accent hover:underline">← Go Home</Link>
        </div>
      </div>
    )
  }

  const backdrop = getBackdropUrl(movie.backdrop_path)
  const poster = getPosterUrl(movie.poster_path, 'w342')
  const inWatchlist = isInList(movie.id)
  const year = movie.release_date?.split('-')[0] ?? ''
  const runtime = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : null

  const handleWatchlist = async () => {
    if (inWatchlist) await remove(movie.id)
    else await add(movie.id, 'movie')
  }

  return (
    <div className="min-h-screen">
      {/* Backdrop */}
      <div className="relative h-[55vh] overflow-hidden">
        {backdrop && <img src={backdrop} alt={movie.title} className="w-full h-full object-cover" />}
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
          {/* Poster */}
          {poster && (
            <div className="flex-shrink-0">
              <img
                src={poster}
                alt={movie.title}
                className="w-48 rounded-xl shadow-2xl border border-border"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-4xl font-bold mb-2">{movie.title}</h1>
            {movie.tagline && <p className="text-muted italic mb-4">{movie.tagline}</p>}

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300 mb-4">
              {year && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-muted" />
                  <span>{year}</span>
                </div>
              )}
              {runtime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-muted" />
                  <span>{runtime}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 font-medium">{movie.vote_average.toFixed(1)}</span>
                <span className="text-muted">/ 10</span>
              </div>
              {movie.status && (
                <span className="bg-surface-2 px-2 py-0.5 rounded text-xs">{movie.status}</span>
              )}
            </div>

            {movie.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {movie.genres.map((g) => (
                  <span key={g.id} className="bg-surface-2 border border-border px-3 py-1 rounded-full text-xs">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {movie.overview && (
              <p className="text-gray-300 text-sm leading-relaxed mb-6">{movie.overview}</p>
            )}

            <div className="flex flex-wrap gap-3">
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
        </div>

        {/* Cast */}
        {credits?.cast && credits.cast.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold mb-4">Cast</h2>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
              {credits.cast.slice(0, 20).map((person) => (
                <div key={person.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden bg-surface-2 mb-2">
                    {person.profile_path ? (
                      <img
                        src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                        alt={person.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl text-muted">
                        {person.name[0]}
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-medium line-clamp-2 text-white">{person.name}</p>
                  <p className="text-xs text-muted line-clamp-2 mt-0.5">{person.character}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Similar Movies */}
        {similar.length > 0 && (
          <section className="mt-12 pb-12">
            <h2 className="text-xl font-semibold mb-4">Similar Movies</h2>
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
