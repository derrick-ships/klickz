-- KLZ-01: Invite-only allowlist gate + unlock multi-user jobs RLS while preserving tenant isolation.
create table if not exists public.studio_invites (
  email text primary key check(length(trim(email)) between 3 and 320 and email = lower(trim(email))),
  invited_by uuid references auth.users(id) on delete set null,
  note text not null default '' check(length(note) <= 240),
  created_at timestamptz not null default now()
);
alter table public.studio_invites enable row level security;
revoke all on public.studio_invites from anon, authenticated;

create or replace function public.app_invite_access() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  caller_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  is_owner boolean := false;
begin
  begin
    select public.app_web_access() into is_owner;
  exception when undefined_function then
    is_owner := false;
  end;
  if is_owner then
    return true;
  end if;
  if caller_email = '' then
    return false;
  end if;
  return exists (select 1 from public.studio_invites where email = caller_email);
end $$;
revoke all on function public.app_invite_access() from public, anon;
grant execute on function public.app_invite_access() to authenticated;

-- Drop legacy owner-only restrictive policy on studio_jobs while retaining studio_jobs_own tenant RLS.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'studio_jobs' and policyname = 'studio_jobs_app_owner') then
    execute 'drop policy studio_jobs_app_owner on public.studio_jobs';
  end if;
end $$;
