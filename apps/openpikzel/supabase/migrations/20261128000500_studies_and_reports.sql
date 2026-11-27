-- KLZ-09: Pre-Flight Studies, Triangulation Runs, Packaging Options, Mind Responses, and Immutable Reports.
create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience_id uuid not null references public.audiences(id) on delete restrict,
  persona_id uuid references public.studio_personas(id) on delete set null,
  style_id uuid references public.studio_styles(id) on delete set null,
  language text not null default 'en' check(length(language) between 2 and 12),
  title_draft text not null check(length(trim(title_draft)) between 1 and 160),
  script_text text not null check(length(trim(script_text)) between 40 and 80000),
  opening_60s_text text not null check(length(trim(opening_60s_text)) between 20 and 4000),
  thumbnail_prompt text not null default '' check(length(thumbnail_prompt) <= 2400),
  draft_thumbnail_path text check(draft_thumbnail_path is null or left(draft_thumbnail_path, length(user_id::text) + 1) = user_id::text || '/'),
  production_mode text not null check(production_mode in ('pre_shoot', 'footage_locked')),
  diagnostic_questions jsonb not null check(jsonb_typeof(diagnostic_questions) = 'array' and jsonb_array_length(diagnostic_questions) between 6 and 8),
  active_mind_ids uuid[] not null check(cardinality(active_mind_ids) between 12 and 16),
  notify_emails text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists studies_owner on public.studies(user_id, created_at desc);

create table if not exists public.study_runs (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check(status in ('queued','leg_a_packaging','leg_b_pass1','leg_b_pass2','leg_c_strategist','compiling_deliverables','completed','failed')),
  progress_pct integer not null default 0 check(progress_pct between 0 and 100),
  current_message text not null default 'Queued Pre-Flight Study…',
  phase_details jsonb not null default '{}'::jsonb,
  estimated_usd_min numeric(6,2) not null default 0,
  estimated_usd_max numeric(6,2) not null default 0,
  email_sent_at timestamptz,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_runs_owner on public.study_runs(user_id, created_at desc);
create index if not exists study_runs_study on public.study_runs(study_id, created_at desc);

create table if not exists public.packaging_options (
  id uuid primary key default gen_random_uuid(),
  study_run_id uuid not null references public.study_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_key text not null check(option_key in ('A','B','C')),
  is_user_draft boolean not null default false,
  angle_label text not null,
  title text not null,
  visual_rationale text not null default '',
  emotional_lever text not null default 'INTRIGA',
  footage_grounding text,
  image_path text,
  jpg_path text,
  mediator_record jsonb,
  klickz_score jsonb,
  feed_check jsonb,
  designer_redline jsonb,
  created_at timestamptz not null default now(),
  unique(study_run_id, option_key)
);
create index if not exists packaging_options_run on public.packaging_options(study_run_id, option_key asc);

create table if not exists public.mind_responses (
  id uuid primary key default gen_random_uuid(),
  study_run_id uuid not null references public.study_runs(id) on delete cascade,
  mind_id uuid not null references public.audience_minds(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pass_number integer not null check(pass_number in (1, 2)),
  blind_option_order text[] not null default '{A,B,C}',
  chosen_option text not null check(chosen_option in ('A','B','C','none_keep_scrolling')),
  click_confidence integer not null default 5 check(click_confidence between 1 and 10),
  verbatim_click_reason text not null default '',
  top_hesitation_killer text not null default '',
  question_answers jsonb not null default '[]'::jsonb,
  comment_skepticism_quote text,
  shareability_score integer check(shareability_score is null or shareability_score between 1 and 10),
  retention_cliff_flag boolean not null default false,
  retention_cliff_note text,
  created_at timestamptz not null default now(),
  unique(study_run_id, mind_id, pass_number)
);
create index if not exists mind_responses_run on public.mind_responses(study_run_id, pass_number, mind_id);

create table if not exists public.study_reports (
  id uuid primary key default gen_random_uuid(),
  study_run_id uuid not null unique references public.study_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check(length(slug) between 8 and 32),
  is_public boolean not null default true,
  language text not null default 'en',
  production_mode text not null check(production_mode in ('pre_shoot', 'footage_locked')),
  pdf_path text,
  markdown_path text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists study_reports_owner on public.study_reports(user_id, created_at desc);

-- Allow PDF & Markdown uploads in studio-assets bucket alongside PNG/JPEG/WebP.
update storage.buckets
set allowed_mime_types = array['image/png','image/jpeg','image/webp','application/pdf','text/markdown','text/plain'],
    file_size_limit = 20971520
where id = 'studio-assets';

alter table public.studies enable row level security;
alter table public.study_runs enable row level security;
alter table public.packaging_options enable row level security;
alter table public.mind_responses enable row level security;
alter table public.study_reports enable row level security;

revoke all on public.studies, public.study_runs, public.packaging_options, public.mind_responses, public.study_reports from anon;
grant select, insert, update, delete on public.studies, public.study_runs, public.packaging_options, public.mind_responses, public.study_reports to authenticated;

create policy studies_owner on public.studies for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy study_runs_owner on public.study_runs for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy packaging_options_owner on public.packaging_options for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy mind_responses_owner on public.mind_responses for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy study_reports_owner on public.study_reports for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.study_runs';
  end if;
exception when duplicate_object then null;
end $$;
