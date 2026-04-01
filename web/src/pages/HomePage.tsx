import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play, Info, Star, Plus, Check } from 'lucide-react'
import { getTrending, getPopularMovies, getTopRatedMovies, getPopularTVShows, getBackdropUrl, isMovie, getMediaTitle, getMediaReleaseDate } from '../api/tmdb'
import MediaRow from '../components/MediaRow'
import { useWatchlist } from '../hooks/useWatchlist'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

export default function HomePage() {
  const [featured, setFeatured] = useState<TMDBMovie | TMDBTVShow | null>(null)
  const [trending, setTrending] = useState<(TMDBMovie | TMDBTVShow)[]>([])
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([])
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBMovie[]>([])
  const [popularTV, setPopularTV] = useState<TMDBTVShow[]>([])
  const [loading, setLoading] = useState(true)
  const { isInList, add, remove } = useWatchlist()

  useEffect(() => {
    const load = async () => {
      try {
        const [trendingData, moviesData, topMoviesData, tvData] = await Promise.all([
          getTrending('all', 'week'),
          getPopularMovies(),
          getTopRatedMovies(),
          getPopularTVShows(),
        ])
        setTrending(trendingData.results)
        setFeatured(trendingData.results[0] ?? null)
        setPopularMovies(moviesData.results)
        setTopRatedMovies(topMoviesData.results)
        setPopularTV(tvData.results)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const featuredBackdrop = featured ? getBackdropUrl(featured.backdrop_path) : null
  const featuredTitle = featured ? getMediaTitle(featured) : ''
  const featuredYear = featured ? (getMediaReleaseDate(featured) || '').split('-')[0] : ''
  const featuredRating = featured ? featured.vote_average.toFixed(1) : ''
  const featuredType = featured ? (isMovie(featured) ? 'movie' : 'tv') : 'movie'
  const inWatchlist = featured ? isInList(featured.id) : false

  const handleWatchlistToggle = async () => {
    if (!featured) return
    if (inWatchlist) {
      await remove(featured.id)
    } else {
      await add(featured.id, featuredType as 'movie' | 'tv')
    }
  }

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative h-[70vh] min-h-[500px] overflow-hidden">
        {featuredBackdrop ? (
          <img
            src={featuredBackdrop}
            alt={featuredTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-surface-2 animate-pulse" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        {featured && (
          <div className="absolute bottom-0 left-0 right-0 px-6 pb-12 max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-lg">{featuredTitle}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-300 mb-4">
              {featuredYear && <span>{featuredYear}</span>}
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 font-medium">{featuredRating}</span>
              </div>
              <span className="bg-surface/80 px-2 py-0.5 rounded text-xs uppercase font-bold">
                {featuredType === 'movie' ? 'Movie' : 'TV Series'}
              </span>
            </div>
            {featured.overview && (
              <p className="text-gray-300 text-sm line-clamp-3 mb-6">{featured.overview}</p>
            )}
            <div className="flex items-center gap-3">
              <Link
                to={`/${featuredType}/${featured.id}`}
                className="flex items-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Play className="w-5 h-5 fill-black" />
                More Info
              </Link>
              <button
                onClick={handleWatchlistToggle}
                className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border text-white font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
              >
                {inWatchlist ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
                {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
              </button>
              <Link
                to={`/${featuredType}/${featured.id}`}
                className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border text-white font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
              >
                <Info className="w-5 h-5" />
                Details
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Rows */}
      <div className="py-8">
        <MediaRow title="Trending This Week" items={trending} loading={loading} showType />
        <MediaRow title="Popular Movies" items={popularMovies} loading={loading} />
        <MediaRow title="Top Rated Movies" items={topRatedMovies} loading={loading} />
        <MediaRow title="Popular TV Shows" items={popularTV} loading={loading} />
      </div>
    </div>
  )
}
