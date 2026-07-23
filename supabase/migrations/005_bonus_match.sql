-- Classic quiniela scoring: 15 partidos por jornada, 1 de ellos "bonus"
-- (equivalente al "Pleno al 15") que se acierta a resultado exacto.
-- El resto de partidos se aciertan solo por signo (1 / X / 2).

alter table public.matches add column if not exists is_bonus boolean not null default false;

-- Solo puede haber un partido bonus por jornada
create unique index if not exists matches_one_bonus_per_jornada
  on public.matches (jornada)
  where is_bonus = true;

-- RPC: marca/desmarca un partido como bonus, desmarcando cualquier otro de la
-- misma jornada de forma atomica. Solo admins de porra pueden usarla.
create or replace function public.toggle_bonus_match(target_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_jornada integer;
  currently_bonus boolean;
begin
  if not exists (
    select 1 from public.pool_members me
    where me.user_id = auth.uid()
      and me.role = 'admin'
      and me.status = 'approved'
  ) then
    raise exception 'No autorizado';
  end if;

  select jornada, is_bonus into target_jornada, currently_bonus
  from public.matches
  where id = target_match_id;

  if not found then
    raise exception 'Partido no encontrado';
  end if;

  if currently_bonus then
    update public.matches set is_bonus = false where id = target_match_id;
  else
    update public.matches set is_bonus = false
    where jornada = target_jornada and is_bonus = true;

    update public.matches set is_bonus = true where id = target_match_id;
  end if;
end;
$$;

grant execute on function public.toggle_bonus_match(uuid) to authenticated;
