import { useState, useEffect } from 'react'
import { getTrending, getPopularMovies, getTopRatedMovies, getPopularTVShows, getTopRatedTVShows } from '../api/tmdb'
import HeroCarousel from '../components/HeroCarousel'
import MediaRow from '../components/MediaRow'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

export default function HomePage() {
  const [featured, setFeatured] = useState<(TMDBMovie | TMDBTVShow)[]>([])
  const [trending, setTrending] = useState<(TMDBMovie | TMDBTVShow)[]>([])
  const [popularMovies, setPopularMovies] = useState<TMDBMovie[]>([])
  const [topRatedMovies, setTopRatedMovies] = useState<TMDBMovie[]>([])
  const [popularTV, setPopularTV] = useState<TMDBTVShow[]>([])
  const [topRatedTV, setTopRatedTV] = useState<TMDBTVShow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [trendingData, moviesData, topMoviesData, tvData, topTvData] = await Promise.all([
          getTrending('all', 'week'),
          getPopularMovies(),
          getTopRatedMovies(),
          getPopularTVShows(),
          getTopRatedTVShows(),
        ])
        setTrending(trendingData.results)
        setFeatured(trendingData.results.filter((item) => item.backdrop_path))
        setPopularMovies(moviesData.results)
        setTopRatedMovies(topMoviesData.results)
        setPopularTV(tvData.results)
        setTopRatedTV(topTvData.results)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div>
      {loading ? (
        <div className="h-[70vh] min-h-[500px] bg-surface-2 animate-pulse" />
      ) : (
        <HeroCarousel items={featured} />
      )}
      <div className="py-8">
        <MediaRow title="Trending This Week" items={trending} loading={loading} showType />
        <MediaRow title="Popular Movies" items={popularMovies} loading={loading} />
        <MediaRow title="Top Rated Movies" items={topRatedMovies} loading={loading} />
        <MediaRow title="Popular TV Shows" items={popularTV} loading={loading} />
        <MediaRow title="Top Rated TV Shows" items={topRatedTV} loading={loading} />
      </div>
    </div>
  )
}
