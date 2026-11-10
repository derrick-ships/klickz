create table public.studio_upload_urls (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null unique,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_request_id uuid,
  check (path = user_id::text || '/references/' || id::text || '.png')
);
create index studio_upload_urls_user on public.studio_upload_urls(user_id, issued_at desc);
alter table public.studio_upload_urls enable row level security;
revoke all on public.studio_upload_urls from anon;
grant select,insert,update on public.studio_upload_urls to authenticated;
create policy studio_upload_urls_own on public.studio_upload_urls for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
do $$ begin if exists(select 1 from pg_policies where policyname='studio_creations_app_owner') then execute 'create policy studio_upload_urls_app_owner on public.studio_upload_urls as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()))'; end if;end $$;
