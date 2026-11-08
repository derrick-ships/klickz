-- Additive OpenPikzels workflows. No unrelated application data is changed.
create table public.studio_conversations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'New chat' check(length(title) between 1 and 100),
 draft jsonb not null default '{}'::jsonb check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=32000),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,user_id)
);
create table public.studio_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 skip_persona_tutorial boolean not null default false,
 updated_at timestamptz not null default now()
);
create table public.studio_feedback (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 creation_id uuid, body text not null check(length(trim(body)) between 3 and 2000),
 created_at timestamptz not null default now(),
 foreign key(creation_id,user_id) references public.studio_creations(id,user_id) on delete set null (creation_id)
);
alter table public.studio_creations add column conversation_id uuid;
alter table public.studio_creations add constraint studio_creation_conversation_owner foreign key(conversation_id,user_id) references public.studio_conversations(id,user_id) on delete set null (conversation_id);
create index studio_conversations_owner_recent on public.studio_conversations(user_id,updated_at desc);
create index studio_creations_conversation on public.studio_creations(conversation_id,user_id);
create index studio_feedback_owner_created on public.studio_feedback(user_id,created_at desc);
create index studio_feedback_creation_owner on public.studio_feedback(creation_id,user_id);
alter table public.studio_conversations enable row level security;
alter table public.studio_preferences enable row level security;
alter table public.studio_feedback enable row level security;
revoke all on public.studio_conversations,public.studio_preferences,public.studio_feedback from anon;
grant select,insert,update,delete on public.studio_conversations,public.studio_preferences,public.studio_feedback to authenticated;
create policy studio_conversations_own on public.studio_conversations for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy studio_preferences_own on public.studio_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy studio_feedback_own on public.studio_feedback for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
alter table public.studio_provider_keys drop constraint studio_provider_keys_provider_check;
alter table public.studio_provider_keys add constraint studio_provider_keys_provider_check check(provider in ('openai','jev','google','youtube'));
alter table public.studio_styles add column source jsonb not null default '{}'::jsonb check(octet_length(source::text)<=4000);
alter table public.studio_personas add column consent_at timestamptz;
