-- KLZ-02: Real-time async run progress audit events.
create table if not exists public.async_run_events (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check(run_type in ('channel_ingestion', 'study_triangulation')),
  run_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  phase text not null check(length(phase) between 1 and 80),
  progress_pct integer not null default 0 check(progress_pct between 0 and 100),
  message text not null check(length(message) between 1 and 400),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists async_run_events_run on public.async_run_events(run_type, run_id, created_at asc);
create index if not exists async_run_events_owner on public.async_run_events(user_id, created_at desc);

alter table public.async_run_events enable row level security;
revoke all on public.async_run_events from anon;
grant select on public.async_run_events to authenticated;
create policy async_run_events_owner_read on public.async_run_events
  for select to authenticated using (user_id = (select auth.uid()));

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.async_run_events';
  end if;
exception when duplicate_object then null;
end $$;
