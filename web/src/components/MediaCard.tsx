import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import { getPosterUrl, isMovie, getMediaTitle, getMediaReleaseDate } from '../api/tmdb'
import type { TMDBMovie, TMDBTVShow } from '../types/tmdb'

interface MediaCardProps {
  item: TMDBMovie | TMDBTVShow
  showType?: boolean
}

export default function MediaCard({ item, showType = false }: MediaCardProps) {
  const movie = isMovie(item)
  const title = getMediaTitle(item)
  const releaseDate = getMediaReleaseDate(item)
  const year = releaseDate ? releaseDate.split('-')[0] : ''
  const rating = item.vote_average.toFixed(1)
  const posterUrl = getPosterUrl(item.poster_path)
  const type = movie ? 'movie' : 'tv'
  const mediaType = item.media_type ?? type

  return (
    <Link
      to={`/${mediaType === 'movie' ? 'movie' : 'tv'}/${item.id}`}
      className="group block"
    >
      <div className="relative overflow-hidden rounded-lg bg-surface aspect-[2/3]">
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-2">
            <span className="text-muted text-xs text-center px-2">{title}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 font-medium">{rating}</span>
            {showType && (
              <span className="ml-auto bg-accent/80 text-white px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                {mediaType === 'movie' ? 'Movie' : 'TV'}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-white line-clamp-2 leading-tight">{title}</p>
        {year && <p className="text-xs text-muted mt-0.5">{year}</p>}
      </div>
    </Link>
  )
}
