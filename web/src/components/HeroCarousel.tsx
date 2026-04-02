import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Play, Info, Plus, Check, Star } from 'lucide-react'
import { getBackdropUrl, isMovie, getMediaTitle, getMediaReleaseDate } from '../api/tmdb'
import { useWatchlist } from '../hooks/useWatchlist'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

interface HeroCarouselProps {
  items: (TMDBMovie | TMDBTVShow)[]
}

const AUTO_ADVANCE_MS = 6000

export default function HeroCarousel({ items }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const { isInList, add, remove } = useWatchlist()

  const featured = items[current]
  const featuredTitle = featured ? getMediaTitle(featured) : ''
  const featuredYear = featured ? (getMediaReleaseDate(featured) || '').split('-')[0] : ''
  const featuredRating = featured ? featured.vote_average.toFixed(1) : ''
  const featuredType = featured ? (isMovie(featured) ? 'movie' : 'tv') : 'movie'
  const inWatchlist = featured ? isInList(featured.id) : false

  const advance = useCallback(() => {
    setCurrent((c) => (c + 1) % Math.min(items.length, 8))
  }, [items.length])

  useEffect(() => {
    if (paused || items.length <= 1) return
    const timer = setInterval(advance, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, advance, items.length])

  const handleWatchlist = async () => {
    if (!featured) return
    if (inWatchlist) await remove(featured.id)
    else await add(featured.id, featuredType as 'movie' | 'tv')
  }

  if (items.length === 0) {
    return <div className="h-[70vh] min-h-[500px] bg-surface-2 animate-pulse" />
  }

  const dots = items.slice(0, 8)

  return (
    <div
      className="relative h-[70vh] min-h-[500px] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slides */}
      {dots.map((item, idx) => {
        const backdrop = getBackdropUrl(item.backdrop_path)
        const active = idx === current
        return (
          <div
            key={item.id}
            className={`absolute inset-0 transition-opacity duration-700 ${active ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            {backdrop && (
              <img
                src={backdrop}
                alt={getMediaTitle(item)}
                className="w-full h-full object-cover"
              />
            )}
          </div>
        )
      })}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent z-20" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent z-20" />

      {/* Content */}
      {featured && (
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-16 max-w-2xl z-30">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 drop-shadow-lg line-clamp-2">{featuredTitle}</h1>
          <div className="flex items-center gap-3 text-sm text-gray-300 mb-4">
            {featuredYear && <span>{featuredYear}</span>}
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="text-yellow-400 font-medium">{featuredRating}</span>
            </div>
            <span className="bg-surface/80 px-2 py-0.5 rounded text-xs uppercase font-bold">
              {featuredType === 'movie' ? 'Movie' : 'TV Series'}
            </span>
          </div>
          {featured.overview && (
            <p className="text-gray-300 text-sm line-clamp-3 mb-6">{featured.overview}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              to={`/${featuredType}/${featured.id}`}
              className="flex items-center gap-2 bg-white text-black font-semibold px-6 py-3 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Play className="w-5 h-5 fill-black" />
              More Info
            </Link>
            <button
              onClick={handleWatchlist}
              className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border text-white font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
            >
              {inWatchlist ? <Check className="w-5 h-5 text-green-400" /> : <Plus className="w-5 h-5" />}
              {inWatchlist ? 'In Watchlist' : 'Watchlist'}
            </button>
            <Link
              to={`/${featuredType}/${featured.id}`}
              className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm border border-border text-white font-semibold px-6 py-3 rounded-lg hover:bg-surface transition-colors"
            >
              <Info className="w-5 h-5" />
              Details
            </Link>
          </div>
        </div>
      )}

      {/* Dot indicators */}
      {dots.length > 1 && (
        <div className="absolute bottom-5 right-6 flex items-center gap-2 z-30">
          {dots.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`rounded-full transition-all duration-300 ${
                idx === current
                  ? 'bg-accent w-6 h-2'
                  : 'bg-white/40 hover:bg-white/70 w-2 h-2'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {!paused && dots.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 z-30">
          <div
            key={current}
            className="h-full bg-accent origin-left"
            style={{
              animation: `progress-bar ${AUTO_ADVANCE_MS}ms linear`,
            }}
          />
        </div>
      )}
    </div>
  )
}
