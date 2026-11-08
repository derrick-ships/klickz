create table public.studio_external_connections (
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider='higgsfield'),
 ciphertext text not null check(length(ciphertext)<=64000),
 updated_at timestamptz not null default now(),
 lease_id uuid, lease_until timestamptz,
 primary key(user_id,provider)
);
alter table public.studio_external_connections enable row level security;
revoke all on public.studio_external_connections from anon;
grant select,insert,update,delete on public.studio_external_connections to authenticated;
create policy studio_external_own on public.studio_external_connections for all to authenticated
using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null)
with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
create table public.studio_connection_sessions (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider='higgsfield'),
 ciphertext text not null check(length(ciphertext)<=64000),
 expires_at timestamptz not null
);
create index studio_connection_sessions_user on public.studio_connection_sessions(user_id);
alter table public.studio_connection_sessions enable row level security;
revoke all on public.studio_connection_sessions from anon;
grant select,insert,delete on public.studio_connection_sessions to authenticated;
create policy studio_connection_sessions_own on public.studio_connection_sessions for all to authenticated
using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null)
with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
