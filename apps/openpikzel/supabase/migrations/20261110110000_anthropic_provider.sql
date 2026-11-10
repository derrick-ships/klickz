alter table public.studio_provider_keys drop constraint studio_provider_keys_provider_check;
alter table public.studio_provider_keys add constraint studio_provider_keys_provider_check check(provider in ('openai','jev','google','youtube','anthropic'));
