import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Play, X } from 'lucide-react'
import { getInProgressItems, formatDuration } from '../api/progress'
import { supabase } from '../api/supabase'
import type { WatchHistoryRecord } from '../types/supabase'

export default function ContinueWatching() {
  const [items, setItems] = useState<WatchHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getInProgressItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const removeItem = async (item: WatchHistoryRecord) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let q = supabase
      .from('watch_history')
      .delete()
      .eq('user_id', user.id)
      .eq('media_type', item.media_type)
      .eq('show_tmdb_id', item.show_tmdb_id)
    // Use .is() for null values so Supabase generates IS NULL rather than = null
    if (item.season != null) q = q.eq('season', item.season)
    else q = (q as typeof q).is('season', null)
    if (item.episode != null) q = q.eq('episode', item.episode)
    else q = (q as typeof q).is('episode', null)
    await q
    setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  if (loading || items.length === 0) return null

  return (
    <section className="mb-2 px-4 md:px-6">
      <h2 className="text-lg font-semibold mb-3 text-white">Continue Watching</h2>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
        {items.map((item) => {
          const pct = Math.min(Math.max((item.progress ?? 0) * 100, 0), 100)
          const remaining = item.duration_seconds && item.position_seconds
            ? item.duration_seconds - item.position_seconds
            : 0
          const resumeAt = item.position_seconds ? formatDuration(item.position_seconds) : null
          const mediaType = item.media_type
          const tmdbId = item.show_tmdb_id
          const detailPath = `/${mediaType}/${tmdbId}`
          const epLabel = item.season && item.episode ? `S${item.season}E${item.episode}` : null
          const continueLabel = epLabel
            ? `Continue ${epLabel}${resumeAt ? ` from ${resumeAt}` : ''}`
            : resumeAt ? `Resume from ${resumeAt}` : 'Continue watching'
          const posterUrl = item.poster_path
            ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
            : null

          return (
            <div
              key={item.id}
              className="relative flex-shrink-0 w-36 group"
            >
              <Link to={detailPath} className="block">
                {/* Poster */}
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-surface-2 border border-border/40">
                  {posterUrl ? (
                    <img
                      src={posterUrl}
                      alt={item.title ?? ''}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-surface-3">
                      <Play className="w-8 h-8 text-muted opacity-30" />
                    </div>
                  )}
                  {/* Dark overlay + play icon on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all duration-300">
                    <div className="opacity-0 group-hover:opacity-100 w-11 h-11 rounded-full bg-white/90 flex items-center justify-center transition-opacity">
                      <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Info */}
                <div className="mt-2 px-0.5">
                  <p className="text-xs font-semibold text-white line-clamp-1 leading-tight">
                    {item.title ?? (tmdbId ? `ID ${tmdbId}` : 'Unknown')}
                  </p>
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">{continueLabel}</p>
                  {remaining > 60 && (
                    <p className="text-xs text-white/40 mt-0.5">{formatDuration(remaining)} left</p>
                  )}
                </div>
              </Link>

              {/* Remove button */}
              <button
                onClick={(e) => { e.preventDefault(); removeItem(item) }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 hover:bg-accent flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                aria-label="Remove from continue watching"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
