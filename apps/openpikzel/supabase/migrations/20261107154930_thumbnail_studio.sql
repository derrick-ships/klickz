-- Isolated tables for Frame. This migration does not alter existing application tables.
create function public.studio_refs_owned(owner_id uuid, refs text[])
returns boolean language sql immutable security invoker set search_path = '' as $$
  select cardinality(refs) between 1 and 3 and not exists (
    select 1 from unnest(refs) p where p is null or left(p,length(owner_id::text)+1) <> owner_id::text || '/' or p like '%..%' or p like '%\\%'
  );
$$;
create table public.studio_personas (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80), notes text not null default '' check(length(notes)<=800), refs text[] not null,
 created_at timestamptz not null default now(), unique(id,user_id), check(public.studio_refs_owned(user_id,refs))
);
create table public.studio_styles (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(name) between 1 and 80), notes text not null default '' check(length(notes)<=800), refs text[] not null,
 created_at timestamptz not null default now(), unique(id,user_id), check(public.studio_refs_owned(user_id,refs))
);
create table public.studio_creations (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(length(title) between 1 and 100), prompt text not null check(length(prompt) between 8 and 2400),
 mode text not null check(mode in ('generate','recreate','edit')), style text not null check(length(style)<=120),
 persona_id uuid, style_id uuid, parent_id uuid, reference_path text,
 image_path text check(image_path is null or left(image_path,length(user_id::text)+1)=user_id::text || '/'),
 favorite boolean not null default false, status text not null default 'draft' check(status in ('draft','generating','ready','failed')),
 request_id uuid, titles jsonb not null default '[]', score jsonb,
 created_at timestamptz not null default now(), unique(id,user_id),unique(user_id,request_id),
 foreign key(persona_id,user_id) references public.studio_personas(id,user_id) on delete set null (persona_id),
 foreign key(style_id,user_id) references public.studio_styles(id,user_id) on delete set null (style_id),
 foreign key(parent_id,user_id) references public.studio_creations(id,user_id) on delete set null (parent_id),
 check(reference_path is null or left(reference_path,length(user_id::text)+1)=user_id::text || '/')
);
create index studio_personas_owner on public.studio_personas(user_id,created_at desc);
create index studio_styles_owner on public.studio_styles(user_id,created_at desc);
create index studio_creations_owner on public.studio_creations(user_id,created_at desc);
alter table public.studio_personas enable row level security;
alter table public.studio_styles enable row level security;
alter table public.studio_creations enable row level security;
revoke all on public.studio_personas,public.studio_styles,public.studio_creations from anon;
grant select,insert,update,delete on public.studio_personas,public.studio_styles,public.studio_creations to authenticated;
create policy studio_personas_owner on public.studio_personas for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy studio_styles_owner on public.studio_styles for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy studio_creations_owner on public.studio_creations for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('studio-assets','studio-assets',false,5242880,array['image/png','image/jpeg','image/webp']);
create policy studio_assets_read on storage.objects for select to authenticated using(bucket_id='studio-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy studio_assets_create on storage.objects for insert to authenticated with check(bucket_id='studio-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy studio_assets_update on storage.objects for update to authenticated using(bucket_id='studio-assets' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='studio-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy studio_assets_delete on storage.objects for delete to authenticated using(bucket_id='studio-assets' and (storage.foldername(name))[1]=(select auth.uid())::text);
