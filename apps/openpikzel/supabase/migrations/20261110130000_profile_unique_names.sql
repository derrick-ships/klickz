update public.studio_personas
  set name = case when btrim(name) = '' then 'Unnamed' else btrim(name) end
  where name is distinct from case when btrim(name) = '' then 'Unnamed' else btrim(name) end;

update public.studio_styles
  set name = case when btrim(name) = '' then 'Unnamed' else btrim(name) end
  where name is distinct from case when btrim(name) = '' then 'Unnamed' else btrim(name) end;

do $$
declare
  rec record;
  n integer;
  suffix text;
  candidate text;
begin
  for rec in
    select id, user_id, name,
      row_number() over (
        partition by user_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as rn
    from public.studio_personas
    order by user_id, lower(btrim(name)), created_at, id
  loop
    if rec.rn = 1 then
      continue;
    end if;
    n := 2;
    loop
      suffix := ' (' || n::text || ')';
      if length(rec.name) + length(suffix) <= 80 then
        candidate := rec.name || suffix;
      else
        candidate := left(rec.name, 80 - length(suffix)) || suffix;
      end if;
      exit when not exists (
        select 1 from public.studio_personas p
        where p.user_id = rec.user_id
          and lower(btrim(p.name)) = lower(btrim(candidate))
      );
      n := n + 1;
    end loop;
    update public.studio_personas set name = candidate where id = rec.id;
  end loop;

  for rec in
    select id, user_id, name,
      row_number() over (
        partition by user_id, lower(btrim(name))
        order by created_at asc, id asc
      ) as rn
    from public.studio_styles
    order by user_id, lower(btrim(name)), created_at, id
  loop
    if rec.rn = 1 then
      continue;
    end if;
    n := 2;
    loop
      suffix := ' (' || n::text || ')';
      if length(rec.name) + length(suffix) <= 80 then
        candidate := rec.name || suffix;
      else
        candidate := left(rec.name, 80 - length(suffix)) || suffix;
      end if;
      exit when not exists (
        select 1 from public.studio_styles p
        where p.user_id = rec.user_id
          and lower(btrim(p.name)) = lower(btrim(candidate))
      );
      n := n + 1;
    end loop;
    update public.studio_styles set name = candidate where id = rec.id;
  end loop;
end $$;

create unique index studio_personas_user_name on public.studio_personas (user_id, lower(btrim(name)));
create unique index studio_styles_user_name on public.studio_styles (user_id, lower(btrim(name)));
