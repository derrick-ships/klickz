alter table public.studio_oauth_grants drop constraint studio_oauth_grants_scope_check;
alter table public.studio_oauth_grants add constraint studio_oauth_grants_scope_check check(scope <@ array['studio:read','studio:write','studio:ai','studio:agent']::text[]);
