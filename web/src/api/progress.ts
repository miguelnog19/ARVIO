/**
 * Watch progress API — persists playback position to Supabase `watch_history`.
 * Used by the video player to enable "Continue Watching" on the home page.
 */
import { supabase } from './supabase'
import type { WatchHistoryRecord } from '../types/supabase'

export interface ProgressSavePayload {
  mediaType: 'movie' | 'tv'
  tmdbId: number
  season?: number
  episode?: number
  positionSeconds: number
  durationSeconds: number
  title?: string
  episodeTitle?: string
  posterPath?: string
  backdropPath?: string
  source?: string
}

/** Save or update playback progress. Call every ~10 s from the player. */
export async function saveProgress(p: ProgressSavePayload): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  if (p.durationSeconds < 30) return

  const progress = p.durationSeconds > 0 ? Math.min(p.positionSeconds / p.durationSeconds, 1) : 0

  await supabase.from('watch_history').upsert(
    {
      user_id: user.id,
      media_type: p.mediaType,
      show_tmdb_id: p.tmdbId,
      season: p.season ?? null,
      episode: p.episode ?? null,
      progress,
      position_seconds: Math.round(p.positionSeconds),
      duration_seconds: Math.round(p.durationSeconds),
      title: p.title ?? null,
      episode_title: p.episodeTitle ?? null,
      poster_path: p.posterPath ?? null,
      backdrop_path: p.backdropPath ?? null,
      source: p.source ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,media_type,show_tmdb_id,season,episode' }
  )
}

/** Load recent in-progress items (progress > 2% and < 95%) for Continue Watching. */
export async function getInProgressItems(): Promise<WatchHistoryRecord[]> {
  const { data, error } = await supabase
    .from('watch_history')
    .select('*')
    .gt('progress', 0.02)
    .lt('progress', 0.95)
    .order('updated_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as WatchHistoryRecord[]
}

/** Format seconds as h:mm:ss or m:ss */
export function formatDuration(seconds: number): string {
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}
