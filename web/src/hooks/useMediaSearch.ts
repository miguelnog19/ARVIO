import { useState, useEffect, useRef } from 'react'
import { searchMovies, searchTVShows, searchMulti } from '../api/tmdb'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

export type SearchFilter = 'all' | 'movie' | 'tv'

export function useMediaSearch(query: string, filter: SearchFilter = 'all') {
  const [results, setResults] = useState<(TMDBMovie | TMDBTVShow)[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        let data: { results: (TMDBMovie | TMDBTVShow)[]; total_pages?: number }
        if (filter === 'movie') {
          data = await searchMovies(query)
        } else if (filter === 'tv') {
          data = await searchTVShows(query)
        } else {
          data = await searchMulti(query)
        }
        const filtered = data.results.filter((r) => {
          const mt = (r as TMDBMovie | TMDBTVShow).media_type
          return mt === 'movie' || mt === 'tv' || filter !== 'all'
        })
        setResults(filtered)
        setTotalPages(data.total_pages ?? 0)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Search failed')
      } finally {
        setLoading(false)
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filter])

  return { results, loading, error, totalPages }
}
