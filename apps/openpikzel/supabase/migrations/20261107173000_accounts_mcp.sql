-- OpenPikzels uses user-owned rows; unrelated app/notes policies remain unchanged.
create table public.studio_provider_keys (
 user_id uuid not null references auth.users(id) on delete cascade,
 provider text not null check(provider in ('openai','jev','google')),
 ciphertext text not null check(length(ciphertext)<24000),
 suffix text not null check(length(suffix)=4),
 updated_at timestamptz not null default now(),
 primary key(user_id,provider)
);
alter table public.studio_provider_keys enable row level security;
create policy studio_keys_own on public.studio_provider_keys for all to authenticated using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null) with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
grant select,insert,update,delete on public.studio_provider_keys to authenticated;
create table public.studio_oauth_grants (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null check(length(client_id)=64),
 client_name text not null check(length(client_name)<=120),
 redirect_uri text not null check(length(redirect_uri)<=1500),
 scope text[] not null check(scope <@ array['studio:read','studio:write','studio:ai']::text[]),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 revoked_at timestamptz,
 unique(id,user_id)
);
create index studio_oauth_grants_user on public.studio_oauth_grants(user_id);
alter table public.studio_oauth_grants enable row level security;
create policy studio_grants_own on public.studio_oauth_grants for all to authenticated using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null) with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);
grant select,insert,update,delete on public.studio_oauth_grants to authenticated;
create table public.studio_oauth_uses (
 nonce_hash text primary key check(length(nonce_hash)=64),
 user_id uuid not null,
 grant_id uuid not null,
 kind text not null check(kind in ('code','refresh')),
 created_at timestamptz not null default now(),
 foreign key(grant_id,user_id) references public.studio_oauth_grants(id,user_id) on delete cascade
);
create index studio_oauth_uses_user on public.studio_oauth_uses(user_id);
alter table public.studio_oauth_uses enable row level security;
create policy studio_uses_own on public.studio_oauth_uses for select to authenticated using(user_id=(select auth.uid()));
create policy studio_uses_insert on public.studio_oauth_uses for insert to authenticated with check(user_id=(select auth.uid()));
grant select,insert on public.studio_oauth_uses to authenticated;
-- Keep hosted previews owner-restricted until the explicit public-release migration.
create policy studio_keys_app_owner on public.studio_provider_keys as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
create policy studio_grants_app_owner on public.studio_oauth_grants as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
create policy studio_uses_app_owner on public.studio_oauth_uses as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
