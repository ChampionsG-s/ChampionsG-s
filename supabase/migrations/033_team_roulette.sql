-- Ruleta de equipos: comparte jornada con la ruleta regalo (cada 3
-- jornadas). Al girar, el servidor asigna al azar uno de los equipos que
-- juegan esa jornada (RNG protegido igual que gift_spin -- el cliente no
-- debe poder elegir el equipo favorito). Si ese equipo termina ganando su
-- partido, +1 punto de ranking. El resultado del acierto NO se guarda en
-- el momento del giro (el partido todavia no se jugo): se calcula en
-- computeMemberTotals comparando match_id + team_side contra la tabla de
-- resultados, igual que ya se hace con las predicciones normales.

create table if not exists public.team_roulette_spins (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  jornada_number integer not null check (jornada_number > 0),
  match_id uuid not null references public.matches(id) on delete cascade,
  team_side text not null check (team_side in ('home', 'away')),
  team_name text not null,
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, jornada_number)
);

alter table public.team_roulette_spins enable row level security;

drop policy if exists "Members read team_roulette_spins" on public.team_roulette_spins;
create policy "Members read team_roulette_spins"
  on public.team_roulette_spins for select to authenticated
  using (public.is_pool_member(pool_id));

-- Gira la ruleta de equipos para la jornada indicada. El admin puede
-- girar sin limite para probar la mecanica: sus giros no se guardan (igual
-- que gift_spin, ver migracion 020).
create or replace function public.team_roulette_spin(target_pool uuid, target_jornada integer)
returns table(match_id uuid, team_side text, team_name text)
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  picked record;
  picked_side text;
  picked_name text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if target_jornada <= 0 then
    raise exception 'Jornada invalida';
  end if;

  select role into caller_role from public.pool_members
  where pool_id = target_pool and user_id = auth.uid();

  if caller_role is distinct from 'admin' and exists (
    select 1 from public.team_roulette_spins
    where pool_id = target_pool and user_id = auth.uid() and jornada_number = target_jornada
  ) then
    raise exception 'Ya has girado la ruleta de equipos de esta jornada';
  end if;

  select m.id, m.home_team, m.away_team into picked
  from public.matches m
  where m.jornada = target_jornada
  order by random()
  limit 1;

  if not found then
    raise exception 'No hay partidos para esta jornada';
  end if;

  picked_side := case when random() < 0.5 then 'home' else 'away' end;

  picked_name := case
    when picked_side = 'home' then picked.home_team
    else picked.away_team
  end;

  if caller_role = 'admin' then
    return query select picked.id, picked_side, picked_name;
    return;
  end if;

  insert into public.team_roulette_spins (pool_id, user_id, jornada_number, match_id, team_side, team_name)
  values (target_pool, auth.uid(), target_jornada, picked.id, picked_side, picked_name);

  return query select picked.id, picked_side, picked_name;
end;
$$;
grant execute on function public.team_roulette_spin(uuid, integer) to authenticated;
