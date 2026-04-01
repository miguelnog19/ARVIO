import { supabase } from './supabase'
import type { TMDBMovie, TMDBTVShow, TMDBSearchResult, TMDBMovieDetails, TMDBTVDetails, TMDBCredits, TMDBVideosResponse, TMDBEpisode } from '../types/tmdb'

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export const getPosterUrl = (path: string | null | undefined, size = 'w342') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null

export const getBackdropUrl = (path: string | null | undefined, size = 'w1280') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null

async function tmdbFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const session = await supabase.auth.getSession()
  const token = session.data.session?.access_token

  const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tmdb-proxy`)
  url.searchParams.set('path', path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const headers: Record<string, string> = {
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  }

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error(`TMDB proxy error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

export async function getTrending(mediaType: 'movie' | 'tv' | 'all' = 'all', timeWindow: 'day' | 'week' = 'week') {
  return tmdbFetch<{ results: (TMDBMovie | TMDBTVShow)[] }>(`/trending/${mediaType}/${timeWindow}`)
}

export async function getPopularMovies(page = 1) {
  return tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>('/movie/popular', { page: String(page) })
}

export async function getPopularTVShows(page = 1) {
  return tmdbFetch<{ results: TMDBTVShow[]; total_pages: number }>('/tv/popular', { page: String(page) })
}

export async function getTopRatedMovies(page = 1) {
  return tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>('/movie/top_rated', { page: String(page) })
}

export async function getTopRatedTVShows(page = 1) {
  return tmdbFetch<{ results: TMDBTVShow[]; total_pages: number }>('/tv/top_rated', { page: String(page) })
}

export async function getMovieDetails(id: number) {
  return tmdbFetch<TMDBMovieDetails>(`/movie/${id}`)
}

export async function getTVDetails(id: number) {
  return tmdbFetch<TMDBTVDetails>(`/tv/${id}`)
}

export async function getMovieCredits(id: number) {
  return tmdbFetch<TMDBCredits>(`/movie/${id}/credits`)
}

export async function getTVCredits(id: number) {
  return tmdbFetch<TMDBCredits>(`/tv/${id}/credits`)
}

export async function getMovieVideos(id: number) {
  return tmdbFetch<TMDBVideosResponse>(`/movie/${id}/videos`)
}

export async function getTVVideos(id: number) {
  return tmdbFetch<TMDBVideosResponse>(`/tv/${id}/videos`)
}

export async function getSimilarMovies(id: number) {
  return tmdbFetch<{ results: TMDBMovie[] }>(`/movie/${id}/similar`)
}

export async function getSimilarTVShows(id: number) {
  return tmdbFetch<{ results: TMDBTVShow[] }>(`/tv/${id}/similar`)
}

export async function getMovieRecommendations(id: number) {
  return tmdbFetch<{ results: TMDBMovie[] }>(`/movie/${id}/recommendations`)
}

export async function getTVRecommendations(id: number) {
  return tmdbFetch<{ results: TMDBTVShow[] }>(`/tv/${id}/recommendations`)
}

export async function searchMulti(query: string, page = 1) {
  return tmdbFetch<TMDBSearchResult>('/search/multi', { query, page: String(page) })
}

export async function searchMovies(query: string, page = 1) {
  return tmdbFetch<{ results: TMDBMovie[]; total_pages: number }>('/search/movie', { query, page: String(page) })
}

export async function searchTVShows(query: string, page = 1) {
  return tmdbFetch<{ results: TMDBTVShow[]; total_pages: number }>('/search/tv', { query, page: String(page) })
}

export async function getTVSeason(tvId: number, seasonNumber: number) {
  return tmdbFetch<{ episodes: TMDBEpisode[] }>(`/tv/${tvId}/season/${seasonNumber}`)
}

export { isMovie, isTVShow, getMediaTitle, getMediaReleaseDate } from '../types/tmdb'
