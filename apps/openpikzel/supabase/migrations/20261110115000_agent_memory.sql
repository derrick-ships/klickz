create table public.studio_agent_memory (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 agent text not null check(length(agent) between 1 and 60),
 fact text not null check(length(fact) between 1 and 1000),
 tags text[] not null default '{}',
 source text check(source is null or length(source)<=200),
 created_at timestamptz not null default now()
);
create index studio_agent_memory_user on public.studio_agent_memory(user_id,created_at desc);
alter table public.studio_agent_memory enable row level security;
revoke all on public.studio_agent_memory from anon;
grant select,insert,delete on public.studio_agent_memory to authenticated;
create policy studio_agent_memory_own on public.studio_agent_memory for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
do $$ begin if exists(select 1 from pg_policies where policyname='studio_creations_app_owner') then execute 'create policy studio_agent_memory_app_owner on public.studio_agent_memory as restrictive for all to authenticated using((select public.app_web_access())) with check((select public.app_web_access()))'; end if;end $$;
create function public.studio_agent_memory_cap() returns trigger language plpgsql set search_path='' as $$
begin
 if (select count(*) from public.studio_agent_memory where user_id=new.user_id)>=500 then
  raise exception 'Memory limit reached.';
 end if;
 return new;
end $$;
create trigger studio_agent_memory_cap before insert on public.studio_agent_memory for each row execute function public.studio_agent_memory_cap();
revoke all on function public.studio_agent_memory_cap() from public,anon;
