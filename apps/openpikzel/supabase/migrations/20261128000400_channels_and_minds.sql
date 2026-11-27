-- KLZ-06: Multi-channel YouTube ingestion, audience distributions, and persistent 12-16 Minds.
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  youtube_channel_id text not null check(length(youtube_channel_id) between 6 and 64),
  handle text,
  title text not null check(length(title) between 1 and 200),
  description text not null default '',
  primary_language text not null default 'en' check(length(primary_language) between 2 and 12),
  avatar_url text not null default '',
  subscriber_count bigint,
  video_count bigint,
  uploads_playlist_id text,
  median_views bigint not null default 0,
  last_ingested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, youtube_channel_id)
);
create index if not exists channels_owner on public.channels(user_id, created_at desc);

create table if not exists public.channel_videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  youtube_video_id text not null check(youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  description text not null default '',
  view_count bigint not null default 0,
  like_count bigint,
  comment_count bigint,
  duration_sec integer,
  published_at timestamptz,
  outlier_ratio numeric(8,2) not null default 1.00,
  thumbnail_url text not null default '',
  transcript_excerpt text,
  transcript_source text check(transcript_source is null or transcript_source in ('gemini','transcript_api','unavailable')),
  top_comments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(channel_id, youtube_video_id)
);
create index if not exists channel_videos_channel on public.channel_videos(channel_id, outlier_ratio desc);

create table if not exists public.channel_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  input_identifier text not null,
  status text not null default 'queued' check(status in ('queued','extracting_signals','building_distributions','preparing_minds','completed','failed')),
  progress_pct integer not null default 0 check(progress_pct between 0 and 100),
  current_message text not null default 'Queued channel ingestion…',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists channel_ingestion_runs_owner on public.channel_ingestion_runs(user_id, created_at desc);

create table if not exists public.audiences (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null default 1,
  language text not null default 'en',
  status text not null default 'building' check(status in ('building','ready','failed')),
  demographics jsonb not null default '{}'::jsonb,
  psychographics jsonb not null default '{}'::jsonb,
  comment_themes jsonb not null default '[]'::jsonb,
  outlier_patterns jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audiences_channel on public.audiences(channel_id, created_at desc);

create table if not exists public.audience_minds (
  id uuid primary key default gen_random_uuid(),
  audience_id uuid not null references public.audiences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null check(length(name) between 1 and 120),
  avatar_seed text not null,
  role text not null check(length(role) between 1 and 200),
  archetype text not null check(archetype in ('loyalist','casual_scroller','skeptic','new_viewer')),
  age_bracket text not null default '25-34',
  click_bar integer not null default 6 check(click_bar between 1 and 10),
  knowledge_items jsonb not null default '[]'::jsonb,
  thinking_patterns jsonb not null default '[]'::jsonb,
  skepticism_triggers jsonb not null default '[]'::jsonb,
  sample_voice_quote text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists audience_minds_audience on public.audience_minds(audience_id, sort_order asc);

alter table public.channels enable row level security;
alter table public.channel_videos enable row level security;
alter table public.channel_ingestion_runs enable row level security;
alter table public.audiences enable row level security;
alter table public.audience_minds enable row level security;

revoke all on public.channels, public.channel_videos, public.channel_ingestion_runs, public.audiences, public.audience_minds from anon;
grant select, insert, update, delete on public.channels, public.channel_videos, public.channel_ingestion_runs, public.audiences, public.audience_minds to authenticated;

create policy channels_owner on public.channels for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy channel_videos_owner on public.channel_videos for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy channel_ingestion_runs_owner on public.channel_ingestion_runs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audiences_owner on public.audiences for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy audience_minds_owner on public.audience_minds for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.channel_ingestion_runs';
  end if;
exception when duplicate_object then null;
end $$;
