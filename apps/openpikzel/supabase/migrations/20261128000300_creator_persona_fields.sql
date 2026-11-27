-- KLZ-05: Evolve studio_personas into full Creator Personas (tone of voice + visual style rules).
alter table public.studio_personas
  add column if not exists tone_of_voice text not null default '' check(length(tone_of_voice) <= 1200),
  add column if not exists visual_style_rules text not null default '' check(length(visual_style_rules) <= 1200),
  add column if not exists default_style_id uuid references public.studio_styles(id) on delete set null;
