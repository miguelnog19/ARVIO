import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import MediaCard from './MediaCard'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

interface MediaRowProps {
  title: string
  items: (TMDBMovie | TMDBTVShow)[]
  loading?: boolean
  showType?: boolean
}

export default function MediaRow({ title, items, loading, showType }: MediaRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!rowRef.current) return
    rowRef.current.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' })
  }

  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-4 px-6">{title}</h2>
      <div className="relative group/row">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background p-2 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity shadow-lg"
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-6 pb-2"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-36 aspect-[2/3] bg-surface-2 rounded-lg animate-pulse"
                />
              ))
            : items.map((item) => (
                <div key={item.id} className="flex-shrink-0 w-36">
                  <MediaCard item={item} showType={showType} />
                </div>
              ))}
        </div>
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-background/80 hover:bg-background p-2 rounded-full opacity-0 group-hover/row:opacity-100 transition-opacity shadow-lg"
          aria-label="Scroll right"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </section>
  )
}
