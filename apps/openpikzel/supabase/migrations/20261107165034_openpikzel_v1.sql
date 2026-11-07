-- OpenPikzel v1 adds isolated product data and honors the existing private app owner gate.
alter table public.studio_creations drop constraint studio_creations_mode_check;
alter table public.studio_creations add constraint studio_creations_mode_check check(mode in ('generate','recreate','edit','title','fix','resize'));
alter table public.studio_creations add column settings jsonb not null default '{"model":"flare","quality":"medium","complexity":"medium","format":"long","batch":1}', add column reference_paths text[] not null default '{}', add column batch_id uuid, add column batch_index integer not null default 0 check(batch_index between 0 and 3);
create unique index studio_batch_items on public.studio_creations(user_id,batch_id,batch_index) where batch_id is not null;
alter table public.studio_personas add column profile_status text not null default 'draft' check(profile_status in ('draft','ready')), add column identity_brief text not null default '' check(length(identity_brief)<=2400);
alter table public.studio_styles add column profile_status text not null default 'draft' check(profile_status in ('draft','ready')), add column identity_brief text not null default '' check(length(identity_brief)<=2400);
create or replace function public.studio_refs_owned(owner_id uuid,refs text[]) returns boolean language sql immutable security invoker set search_path='' as $$
 select cardinality(refs) between 1 and 6 and not exists(select 1 from unnest(refs) p where p is null or left(p,length(owner_id::text)+1) <> owner_id::text || '/' or p like '%..%' or p like '%\\%');
$$;
-- Existing app_web_access() is intentionally retained, not redefined.
create policy studio_personas_app_owner on public.studio_personas as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
create policy studio_styles_app_owner on public.studio_styles as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
create policy studio_creations_app_owner on public.studio_creations as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()));
create policy studio_assets_app_owner on storage.objects as restrictive for all to authenticated using(bucket_id<>'studio-assets' or (select public.app_web_access())) with check(bucket_id<>'studio-assets' or (select public.app_web_access()));
