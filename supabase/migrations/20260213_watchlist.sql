-- Watchlist: saves movies and TV shows a user wants to watch.

create table if not exists public.watchlist (
  user_id    uuid not null references auth.users(id) on delete cascade,
  tmdb_id    int  not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  added_at   timestamptz not null default now(),

  primary key (user_id, tmdb_id)
);

create index if not exists watchlist_user_added_idx
  on public.watchlist (user_id, added_at desc);

alter table public.watchlist enable row level security;
alter table public.watchlist force row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'watchlist'
      and policyname = 'users_manage_own_watchlist'
  ) then
    create policy users_manage_own_watchlist
      on public.watchlist
      for all
      to authenticated
      using  ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end $$;
