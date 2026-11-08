create table public.studio_codex_connections (
 user_id uuid primary key references auth.users(id) on delete cascade,
 credential_ciphertext text check(length(credential_ciphertext)<=32000),
 credential_version uuid not null default gen_random_uuid(),
 credential_lease uuid, credential_lease_until timestamptz, needs_reauth boolean not null default false,
 attempt_id uuid, phase text not null default 'idle' check(phase in ('idle','starting','waiting_device','polling','exchanging','connected','cancelled','failed')),
 pending_ciphertext text check(length(pending_ciphertext)<=32000),
 expires_at timestamptz, next_poll_at timestamptz, poll_interval integer not null default 5 check(poll_interval between 5 and 300),
 poll_lease uuid, poll_lease_until timestamptz,
 last_started_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.studio_codex_connections enable row level security;
revoke all on public.studio_codex_connections from anon;
grant select,insert,update,delete on public.studio_codex_connections to authenticated;
create policy studio_codex_own on public.studio_codex_connections for all to authenticated
 using(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null)
 with check(user_id=(select auth.uid()) and (select auth.jwt()->>'client_id') is null);

-- Every transition locks the authenticated owner's row. Cancellation and replacement
-- invalidate the attempt; token rotation has a separate lease and version.
create function public.studio_codex_transition(p_action text,p_id uuid default null,p_lease uuid default null,p_ciphertext text default null,p_wait integer default 5)
returns setof public.studio_codex_connections language plpgsql security invoker set search_path=public,pg_temp as $$
declare r public.studio_codex_connections; uid uuid:=auth.uid();
begin
 if uid is null or auth.jwt()->>'client_id' is not null then raise exception 'App sign-in required';end if;
 if p_ciphertext is not null and length(p_ciphertext)>32000 then raise exception 'Invalid ciphertext';end if;
 if p_action='begin' then insert into public.studio_codex_connections(user_id) values(uid) on conflict do nothing;end if;
 select * into r from public.studio_codex_connections where user_id=uid for update;
 if not found then return;end if;
 if p_action='begin' then
  if p_id is null or r.last_started_at>now()-interval '30 seconds' then return;end if;
  update public.studio_codex_connections set attempt_id=p_id,phase='starting',pending_ciphertext=null,
   expires_at=now()+interval '15 minutes',next_poll_at=null,poll_lease=null,poll_lease_until=null,last_started_at=now()
   where user_id=uid;
 elsif p_action='ready' then
  if r.attempt_id is distinct from p_id or r.phase<>'starting' or r.expires_at<=now() or p_ciphertext is null then return;end if;
  update public.studio_codex_connections set pending_ciphertext=p_ciphertext,phase='waiting_device',poll_interval=greatest(5,least(300,p_wait)),next_poll_at=now()+make_interval(secs=>greatest(5,least(300,p_wait))) where user_id=uid;
 elsif p_action='claim' then
  if r.attempt_id is distinct from p_id or p_lease is null or r.phase not in ('waiting_device','polling') or r.expires_at<=now() or r.next_poll_at>now() or r.poll_lease_until>now() then return;end if;
  update public.studio_codex_connections set phase='polling',poll_lease=p_lease,poll_lease_until=now()+interval '60 seconds',next_poll_at=now()+make_interval(secs=>poll_interval) where user_id=uid;
 elsif p_action in ('pending','exchange','finish') then
  if r.attempt_id is distinct from p_id or r.poll_lease is distinct from p_lease or p_lease is null or r.expires_at<=now() or r.poll_lease_until<=now() then return;end if;
  if p_action='pending' and r.phase='polling' then
   update public.studio_codex_connections set phase='waiting_device',poll_interval=greatest(5,least(300,p_wait)),next_poll_at=now()+make_interval(secs=>greatest(5,least(300,p_wait))),poll_lease=null,poll_lease_until=null where user_id=uid;
  elsif p_action='exchange' and r.phase='polling' then
   update public.studio_codex_connections set phase='exchanging' where user_id=uid;
  elsif p_action='finish' and r.phase='exchanging' and p_ciphertext is not null then
   update public.studio_codex_connections set phase='connected',credential_ciphertext=p_ciphertext,credential_version=gen_random_uuid(),credential_lease=null,credential_lease_until=null,needs_reauth=false,
    pending_ciphertext=null,attempt_id=null,expires_at=null,next_poll_at=null,poll_lease=null,poll_lease_until=null,updated_at=now() where user_id=uid;
  else return;end if;
 elsif p_action in ('cancel','fail') then
  if r.attempt_id is distinct from p_id or p_id is null then return;end if;
  update public.studio_codex_connections set phase=case when p_action='cancel' then 'cancelled' else 'failed' end,
   pending_ciphertext=null,attempt_id=null,expires_at=null,next_poll_at=null,poll_lease=null,poll_lease_until=null where user_id=uid;
 elsif p_action='disconnect' then
  update public.studio_codex_connections set credential_ciphertext=null,credential_version=gen_random_uuid(),credential_lease=null,credential_lease_until=null,needs_reauth=false,
   phase='idle',pending_ciphertext=null,attempt_id=null,expires_at=null,next_poll_at=null,poll_lease=null,poll_lease_until=null,updated_at=now() where user_id=uid;
 elsif p_action='refresh_claim' then
  if r.credential_ciphertext is null or r.needs_reauth or p_lease is null then return;end if;
  if r.credential_lease is not null then
   if r.credential_lease_until<=now() then update public.studio_codex_connections set needs_reauth=true where user_id=uid;end if;
   return;
  end if;
  update public.studio_codex_connections set credential_lease=p_lease,credential_lease_until=now()+interval '60 seconds' where user_id=uid;
 elsif p_action in ('refresh_finish','refresh_fail') then
  if r.credential_version is distinct from p_id or r.credential_lease is distinct from p_lease or p_lease is null then return;end if;
  if p_action='refresh_finish' and p_ciphertext is not null and r.credential_lease_until>now() then
   update public.studio_codex_connections set credential_ciphertext=p_ciphertext,credential_lease=null,credential_lease_until=null,updated_at=now() where user_id=uid;
  else
   update public.studio_codex_connections set needs_reauth=true,credential_lease=null,credential_lease_until=null where user_id=uid;
  end if;
 else raise exception 'Unknown connection transition';
 end if;
 return query select * from public.studio_codex_connections where user_id=uid;
end $$;
revoke all on function public.studio_codex_transition(text,uuid,uuid,text,integer) from public,anon;
grant execute on function public.studio_codex_transition(text,uuid,uuid,text,integer) to authenticated;
