-- Saved reference elements. Existing creation lineage JSON records elementIds.
create table public.studio_elements (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80),
 kind text not null check(kind in ('prop','logo','place','clothing')),
 notes text not null default '' check(length(notes)<=800),
 refs text[] not null check(cardinality(refs) between 1 and 3 and public.studio_refs_owned(user_id,refs)),
 identity_brief text check(identity_brief is null or length(identity_brief)<=2400),
 profile_status text not null default 'draft' check(profile_status in ('draft','ready')),
 created_at timestamptz not null default now(),
 unique(id,user_id)
);
create unique index studio_elements_user_name on public.studio_elements(user_id, public.profile_name_key(name) collate "C");
create index studio_elements_owner on public.studio_elements(user_id,created_at desc);
alter table public.studio_elements enable row level security;
revoke all on public.studio_elements from anon;
grant select,insert,update,delete on public.studio_elements to authenticated;
-- Match the current personas owner policy; OAuth access is mediated by the server.
create policy studio_elements_owner on public.studio_elements for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
