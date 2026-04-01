import { useState } from 'react'
import { Search, Filter } from 'lucide-react'
import { useMediaSearch, type SearchFilter } from '../hooks/useMediaSearch'
import MediaCard from '../components/MediaCard'
import SkeletonCard from '../components/SkeletonCard'

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<SearchFilter>('all')
  const { results, loading, error } = useMediaSearch(query, filter)

  return (
    <div className="max-w-screen-2xl mx-auto px-6 py-8">
      <h1 className="text-3xl font-bold mb-8">Search</h1>

      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies and TV shows..."
            className="w-full bg-surface border border-border rounded-xl pl-12 pr-4 py-3.5 text-sm text-white placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-colors"
            autoFocus
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted flex-shrink-0" />
          <div className="flex gap-1 bg-surface rounded-xl border border-border p-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-accent text-white'
                    : 'text-muted hover:text-white hover:bg-surface-2'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="text-red-400 text-center py-8">{error}</div>
      )}

      {!query && !loading && (
        <div className="text-center py-20 text-muted">
          <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg">Search for movies and TV shows</p>
        </div>
      )}

      {query && !loading && results.length === 0 && !error && (
        <div className="text-center py-20 text-muted">
          <p className="text-lg">No results found for &quot;{query}&quot;</p>
          <p className="text-sm mt-2">Try different keywords or filters</p>
        </div>
      )}

      {(loading || results.length > 0) && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {loading
            ? Array.from({ length: 16 }).map((_, i) => <SkeletonCard key={i} />)
            : results.map((item) => (
                <MediaCard key={`${item.media_type ?? 'item'}-${item.id}`} item={item} showType />
              ))}
        </div>
      )}
    </div>
  )
}
