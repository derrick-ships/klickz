alter table public.studio_creations drop constraint studio_creations_status_check;
alter table public.studio_creations add constraint studio_creations_status_check check(status in ('draft','generating','ready','failed','reconciling'));
alter table public.studio_creations add column lineage jsonb,add column review jsonb;
create function public.studio_variant_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status='ready' and (new.image_path is distinct from old.image_path or (new.parent_id is distinct from old.parent_id and not(new.parent_id is null and pg_trigger_depth()>1)) or new.lineage is distinct from old.lineage or new.mode is distinct from old.mode or new.settings is distinct from old.settings or new.prompt is distinct from old.prompt or new.status is distinct from old.status) then raise exception 'A ready variant is immutable; create a new variant'; end if;
 return new;
end $$;
create trigger studio_variant_immutable before update on public.studio_creations for each row execute function public.studio_variant_immutable();
create table public.studio_jobs (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 operation text not null check(operation in ('generate','analyze')),
 payload_digest text not null check(length(payload_digest)=64),
 state text not null check(state in ('queued','running','succeeded','failed','reconciling')),
 max_provider_calls integer not null check(max_provider_calls between 1 and 4),
 deadline_at timestamptz not null default now()+interval '330 seconds',
 result jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index studio_jobs_owner on public.studio_jobs(user_id,created_at desc);
alter table public.studio_jobs enable row level security;
revoke all on public.studio_jobs from anon;
grant select,insert,update on public.studio_jobs to authenticated;
revoke delete on public.studio_jobs from authenticated;
create policy studio_jobs_own on public.studio_jobs for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
-- Match the current deployment posture without opening other applications.
do $$ begin if exists(select 1 from pg_policies where policyname='studio_creations_app_owner') then execute 'create policy studio_jobs_app_owner on public.studio_jobs as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()))'; end if;end $$;

create function public.studio_job_identity_immutable() returns trigger language plpgsql set search_path='' as $$ begin
 if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.operation is distinct from old.operation or new.payload_digest is distinct from old.payload_digest or new.max_provider_calls is distinct from old.max_provider_calls or new.deadline_at is distinct from old.deadline_at then raise exception 'Job identity and dispatch cap are immutable'; end if;
 return new;
end $$;
create trigger studio_job_identity_immutable before update on public.studio_jobs for each row execute function public.studio_job_identity_immutable();

create function public.studio_reconcile_jobs() returns integer language plpgsql security invoker set search_path='' as $$ declare n integer;begin
 with expired as (
  update public.studio_jobs set state='reconciling',updated_at=now() where user_id=(select auth.uid()) and state in ('queued','running') and deadline_at<now() returning id
 ), variants as (
  update public.studio_creations set status='reconciling' where user_id=(select auth.uid()) and status='generating' and batch_id in (select id from expired) returning id
 ) select count(*) into n from expired;
 return n;
end $$;
revoke all on function public.studio_reconcile_jobs() from public,anon;
grant execute on function public.studio_reconcile_jobs() to authenticated;
