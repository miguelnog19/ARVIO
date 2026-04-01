import { useState, useEffect, useCallback } from 'react'
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../api/watchlist'
import type { WatchlistRecord } from '../types/supabase'

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await getWatchlist()
      setWatchlist(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const add = useCallback(async (tmdbId: number, mediaType: 'movie' | 'tv') => {
    await addToWatchlist(tmdbId, mediaType)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (tmdbId: number) => {
    await removeFromWatchlist(tmdbId)
    await refresh()
  }, [refresh])

  const isInList = useCallback((tmdbId: number) =>
    watchlist.some((item) => item.tmdb_id === tmdbId), [watchlist])

  return { watchlist, loading, error, add, remove, isInList, refresh }
}
