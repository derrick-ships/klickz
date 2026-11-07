-- Apply only at the approved public release, together with OWNER_GATE=false.
-- Each remaining policy still requires auth.uid() = user_id; all buckets stay private.
drop policy studio_personas_app_owner on public.studio_personas;
drop policy studio_styles_app_owner on public.studio_styles;
drop policy studio_creations_app_owner on public.studio_creations;
drop policy studio_assets_app_owner on storage.objects;
drop policy studio_keys_app_owner on public.studio_provider_keys;
drop policy studio_grants_app_owner on public.studio_oauth_grants;
drop policy studio_uses_app_owner on public.studio_oauth_uses;
