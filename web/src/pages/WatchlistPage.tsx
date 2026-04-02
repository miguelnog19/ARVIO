import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkX, BookmarkCheck, Star } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'
import { getMovieDetails, getTVDetails, getPosterUrl } from '../api/tmdb'
import type { WatchlistRecord } from '../types/supabase'

interface WatchlistItemWithPoster extends WatchlistRecord {
  poster_path?: string | null
  title?: string
  vote_average?: number
}

export default function WatchlistPage() {
  const { watchlist, loading, error, remove } = useWatchlist()
  const [enriched, setEnriched] = useState<WatchlistItemWithPoster[]>([])
  const [enriching, setEnriching] = useState(false)

  // Fetch poster/title for each watchlist item
  useEffect(() => {
    if (watchlist.length === 0) {
      setEnriched([])
      return
    }
    setEnriching(true)
    const enrich = async () => {
      const results = await Promise.all(
        watchlist.map(async (item) => {
          try {
            if (item.media_type === 'movie') {
              const data = await getMovieDetails(item.tmdb_id)
              return { ...item, poster_path: data.poster_path, title: data.title, vote_average: data.vote_average }
            } else {
              const data = await getTVDetails(item.tmdb_id)
              return { ...item, poster_path: data.poster_path, title: data.name, vote_average: data.vote_average }
            }
          } catch {
            return { ...item }
          }
        })
      )
      setEnriched(results)
      setEnriching(false)
    }
    enrich()
  }, [watchlist])

  const displayItems = enriched.length > 0 ? enriched : watchlist.map((w) => w as WatchlistItemWithPoster)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <BookmarkCheck className="w-8 h-8 text-accent" />
        <h1 className="text-3xl font-bold">My Watchlist</h1>
        {watchlist.length > 0 && (
          <span className="bg-surface-2 text-muted text-sm px-2.5 py-0.5 rounded-full">{watchlist.length}</span>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg p-4 mb-6 text-sm">{error}</div>
      )}

      {(loading || enriching) && displayItems.length === 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[2/3] bg-surface-2 rounded-lg" />
              <div className="mt-2 h-3 bg-surface-2 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {!loading && watchlist.length === 0 && (
        <div className="text-center py-20 text-muted">
          <BookmarkCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-xl mb-2">Your watchlist is empty</p>
          <p className="text-sm mb-6">Browse movies and TV shows and add them to your list</p>
          <Link to="/" className="bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors">
            Browse Content
          </Link>
        </div>
      )}

      {!loading && displayItems.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {displayItems.map((item) => {
            const posterUrl = item.poster_path ? getPosterUrl(item.poster_path) : null
            return (
              <div key={`${item.media_type}-${item.tmdb_id}`} className="group relative">
                <Link to={`/${item.media_type}/${item.tmdb_id}`} className="block">
                  <div className="relative aspect-[2/3] bg-surface-2 rounded-lg overflow-hidden">
                    {posterUrl ? (
                      <img
                        src={posterUrl}
                        alt={item.title ?? String(item.tmdb_id)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted bg-surface-2">
                        <BookmarkCheck className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    {item.vote_average && item.vote_average > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          <span className="text-yellow-400 font-medium">{item.vote_average.toFixed(1)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="mt-2">
                    <p className="text-xs text-muted capitalize">{item.media_type === 'tv' ? 'TV Series' : 'Movie'}</p>
                    {item.title ? (
                      <p className="text-xs font-medium text-white line-clamp-2 leading-tight">{item.title}</p>
                    ) : (
                      <div className="h-3 bg-surface-2 rounded mt-1 animate-pulse" />
                    )}
                  </div>
                </Link>
                <button
                  onClick={() => remove(item.tmdb_id)}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-accent p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from watchlist"
                >
                  <BookmarkX className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
