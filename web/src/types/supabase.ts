export interface WatchlistRecord {
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  added_at: string | null
}

export interface WatchHistoryRecord {
  id?: string
  user_id: string
  media_type: 'movie' | 'tv'
  show_tmdb_id?: number | null
  show_trakt_id?: number | null
  season?: number | null
  episode?: number | null
  trakt_episode_id?: number | null
  tmdb_episode_id?: number | null
  progress: number
  position_seconds: number
  duration_seconds: number
  paused_at?: string | null
  updated_at?: string | null
  source?: string | null
  title?: string | null
  episode_title?: string | null
  backdrop_path?: string | null
  poster_path?: string | null
  stream_key?: string | null
  stream_addon_id?: string | null
  stream_title?: string | null
  created_at?: string | null
}

export interface UserProfile {
  id: string
  email?: string | null
  trakt_token?: Record<string, unknown> | null
  default_subtitle?: string | null
  auto_play_next?: boolean | null
  addons?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export interface UserSettings {
  user_id: string
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface WatchedMovieRecord {
  user_id: string
  tmdb_id: number
  trakt_id?: number | null
  watched_at?: string | null
}

export interface WatchedEpisodeRecord {
  user_id: string
  tmdb_id: number
  season: number
  episode: number
  trakt_episode_id?: number | null
  tmdb_episode_id?: number | null
  show_trakt_id?: number | null
  watched?: boolean | null
  watched_at?: string | null
  source?: string | null
  updated_at?: string | null
}

export interface EpisodeProgressRecord {
  user_id: string
  tmdb_id: number
  media_type: 'movie' | 'tv'
  season?: number | null
  episode?: number | null
  trakt_id?: number | null
  show_trakt_id?: number | null
  progress: number
  position_seconds: number
  duration_seconds: number
  paused_at?: string | null
  last_updated_at?: string | null
  source?: string | null
  title?: string | null
  episode_title?: string | null
  backdrop_path?: string | null
  poster_path?: string | null
}

export interface SyncStateRecord {
  user_id: string
  last_sync_at?: string | null
  last_full_sync_at?: string | null
  last_trakt_activities?: string | null
  last_trakt_activities_json?: string | null
  movies_synced: number
  episodes_synced: number
  sync_in_progress: boolean
  last_error?: string | null
  updated_at?: string | null
}
