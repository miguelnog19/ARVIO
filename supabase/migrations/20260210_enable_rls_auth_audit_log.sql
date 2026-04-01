-- Security hardening for exposed public table.
-- Fixes Supabase warning: "RLS Disabled in Public" on public.auth_audit_log.

do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'auth_audit_log'
  ) then
    alter table public.auth_audit_log enable row level security;
    alter table public.auth_audit_log force row level security;
    revoke all on table public.auth_audit_log from anon;
    revoke all on table public.auth_audit_log from authenticated;
  end if;
end $$;
