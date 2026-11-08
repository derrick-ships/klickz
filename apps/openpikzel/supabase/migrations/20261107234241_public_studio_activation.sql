-- Explicitly authorized production activation for new OpenPikzels users.
-- Remove only the studio preview-owner restrictions. Own-row/folder RLS,
-- private buckets, immutable variants/jobs and other applications stay intact.
drop policy if exists studio_personas_app_owner on public.studio_personas;
drop policy if exists studio_styles_app_owner on public.studio_styles;
drop policy if exists studio_creations_app_owner on public.studio_creations;
drop policy if exists studio_assets_app_owner on storage.objects;
drop policy if exists studio_keys_app_owner on public.studio_provider_keys;
drop policy if exists studio_grants_app_owner on public.studio_oauth_grants;
drop policy if exists studio_uses_app_owner on public.studio_oauth_uses;
drop policy if exists studio_jobs_app_owner on public.studio_jobs;
