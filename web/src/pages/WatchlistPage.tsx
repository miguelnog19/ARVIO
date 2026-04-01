import { Link } from 'react-router-dom'
import { BookmarkX, BookmarkCheck } from 'lucide-react'
import { useWatchlist } from '../hooks/useWatchlist'

export default function WatchlistPage() {
  const { watchlist, loading, error, remove } = useWatchlist()

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <BookmarkCheck className="w-8 h-8 text-accent" />
        <h1 className="text-3xl font-bold">My Watchlist</h1>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-300 rounded-lg p-4 mb-6 text-sm">
          {error}
        </div>
      )}

      {loading && (
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
          <Link
            to="/"
            className="bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Browse Content
          </Link>
        </div>
      )}

      {!loading && watchlist.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {watchlist.map((item) => (
            <div key={`${item.media_type}-${item.tmdb_id}`} className="group relative">
              <Link to={`/${item.media_type}/${item.tmdb_id}`} className="block">
                <div className="relative aspect-[2/3] bg-surface-2 rounded-lg overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center text-muted">
                    <span className="text-xs">{item.tmdb_id}</span>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-2">
                  <p className="text-xs text-muted capitalize">{item.media_type}</p>
                  <p className="text-xs font-medium">ID: {item.tmdb_id}</p>
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
          ))}
        </div>
      )}
    </div>
  )
}
