-- Watch history: stores per-user playback progress for movies and TV episodes.
-- Schema derived from WatchHistoryRecord in the Android TV app.

create table if not exists public.watch_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  media_type        text not null check (media_type in ('movie', 'tv')),
  show_tmdb_id      int,
  show_trakt_id     int,
  season            int,
  episode           int,
  trakt_episode_id  int,
  tmdb_episode_id   int,
  progress          real not null default 0,
  position_seconds  bigint not null default 0,
  duration_seconds  bigint not null default 0,
  paused_at         timestamptz,
  source            text,
  title             text,
  episode_title     text,
  backdrop_path     text,
  poster_path       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Unique playback-progress row per user + content + source
  unique (user_id, media_type, show_tmdb_id, season, episode)
);

create index if not exists watch_history_user_updated_idx
  on public.watch_history (user_id, updated_at desc);

create or replace trigger watch_history_set_updated_at
before update on public.watch_history
for each row execute function public.set_updated_at();

alter table public.watch_history enable row level security;
alter table public.watch_history force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'watch_history'
      and policyname = 'users_manage_own_watch_history'
  ) then
    create policy users_manage_own_watch_history
      on public.watch_history
      for all
      to authenticated
      using  ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;
