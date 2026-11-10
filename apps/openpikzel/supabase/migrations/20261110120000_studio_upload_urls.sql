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
revoke all on public.studio_upload_urls from anon, authenticated;
grant select on public.studio_upload_urls to authenticated;
grant insert (id, user_id, path, issued_at, expires_at) on public.studio_upload_urls to authenticated;
create policy studio_upload_urls_select on public.studio_upload_urls for select to authenticated using(user_id=(select auth.uid()));
create policy studio_upload_urls_insert on public.studio_upload_urls for insert to authenticated with check(user_id=(select auth.uid()));
do $$ begin if exists(select 1 from pg_policies where policyname='studio_creations_app_owner') then
  execute 'create policy studio_upload_urls_app_owner on public.studio_upload_urls as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()))';
end if;end $$;

create function public.studio_claim_upload_url(upload_id uuid, request_id uuid)
returns setof public.studio_upload_urls
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.';
  end if;
  return query
  update public.studio_upload_urls
    set used_at = pg_catalog.now(),
        used_request_id = request_id
    where id = upload_id
      and user_id = auth.uid()
      and (used_at is null or used_request_id = request_id)
      and pg_catalog.now() <= expires_at
    returning *;
end;
$$;
revoke all on function public.studio_claim_upload_url(uuid, uuid) from public, anon;
grant execute on function public.studio_claim_upload_url(uuid, uuid) to authenticated;
