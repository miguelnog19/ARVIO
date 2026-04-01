import { supabase } from './supabase'
import type { WatchlistRecord } from '../types/supabase'

export async function getWatchlist(): Promise<WatchlistRecord[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('*')
    .order('added_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function addToWatchlist(tmdbId: number, mediaType: 'movie' | 'tv'): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase.from('watchlist').upsert({
    user_id: user.id,
    tmdb_id: tmdbId,
    media_type: mediaType,
  }, { onConflict: 'user_id,tmdb_id' })
  if (error) throw error
}

export async function removeFromWatchlist(tmdbId: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', user.id)
    .eq('tmdb_id', tmdbId)
  if (error) throw error
}

export async function isInWatchlist(tmdbId: number): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase
    .from('watchlist')
    .select('tmdb_id')
    .eq('user_id', user.id)
    .eq('tmdb_id', tmdbId)
    .single()
  return !!data
}
