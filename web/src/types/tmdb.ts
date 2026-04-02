export interface TMDBMovie {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  adult: boolean
  original_language: string
  video: boolean
  media_type?: 'movie'
}

export interface TMDBTVShow {
  id: number
  name: string
  original_name: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  first_air_date: string
  vote_average: number
  vote_count: number
  popularity: number
  genre_ids: number[]
  origin_country: string[]
  original_language: string
  media_type?: 'tv'
}

export interface TMDBGenre {
  id: number
  name: string
}

export interface TMDBProductionCompany {
  id: number
  name: string
  logo_path: string | null
  origin_country: string
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: TMDBGenre[]
  runtime: number | null
  status: string
  tagline: string
  homepage: string
  imdb_id: string | null
  revenue: number
  budget: number
  production_companies: TMDBProductionCompany[]
}

export interface TMDBSeason {
  id: number
  name: string
  overview: string
  poster_path: string | null
  season_number: number
  episode_count: number
  air_date: string
}

export interface TMDBTVDetails extends TMDBTVShow {
  genres: TMDBGenre[]
  number_of_seasons: number
  number_of_episodes: number
  status: string
  tagline: string
  homepage: string
  in_production: boolean
  seasons: TMDBSeason[]
  episode_run_time: number[]
  production_companies: TMDBProductionCompany[]
  networks: { id: number; name: string; logo_path: string | null }[]
  created_by: { id: number; name: string; profile_path: string | null }[]
}

export interface TMDBCastMember {
  id: number
  name: string
  character: string
  profile_path: string | null
  order: number
  known_for_department: string
}

export interface TMDBCrewMember {
  id: number
  name: string
  job: string
  department: string
  profile_path: string | null
}

export interface TMDBCredits {
  id: number
  cast: TMDBCastMember[]
  crew: TMDBCrewMember[]
}

export interface TMDBVideo {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
  published_at: string
}

export interface TMDBVideosResponse {
  id: number
  results: TMDBVideo[]
}

export interface TMDBSearchResult {
  results: (TMDBMovie | TMDBTVShow)[]
  total_results: number
  total_pages: number
  page: number
}

export interface TMDBEpisode {
  id: number
  name: string
  overview: string
  episode_number: number
  season_number: number
  air_date: string
  still_path: string | null
  vote_average: number
  runtime: number | null
}

export interface TMDBExternalIds {
  id: number
  imdb_id: string | null
  tvdb_id: number | null
  wikidata_id: string | null
  facebook_id: string | null
  instagram_id: string | null
  twitter_id: string | null
}

export interface TMDBSeasonDetails extends TMDBSeason {
  episodes: TMDBEpisode[]
}

export function isMovie(item: TMDBMovie | TMDBTVShow): item is TMDBMovie {
  return (item as TMDBMovie).title !== undefined || item.media_type === 'movie'
}

export function isTVShow(item: TMDBMovie | TMDBTVShow): item is TMDBTVShow {
  return (item as TMDBTVShow).name !== undefined && item.media_type !== 'movie'
}

export function getMediaTitle(item: TMDBMovie | TMDBTVShow): string {
  return isMovie(item) ? item.title : (item as TMDBTVShow).name
}

export function getMediaReleaseDate(item: TMDBMovie | TMDBTVShow): string {
  return isMovie(item) ? item.release_date : (item as TMDBTVShow).first_air_date
}
