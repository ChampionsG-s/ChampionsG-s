-- Con solo un puñado de jugadores sembrados (34), exigir que el regalo
-- inicial nunca repita jugador entre USUARIOS distintos deja a la mayoria
-- sin plantilla completa. A partir de ahora: el regalo inicial gratis NO
-- respeta exclusividad entre usuarios (varios pueden empezar con el mismo
-- jugador barato), pero el MERCADO si sigue excluyendo a quien ya tenga
-- dueno (eso no cambia). Ademas: el regalo solo elige entre jugadores cuyo
-- precio de compra directa sea como mucho 5000 (nunca estrellas caras), y
-- se garantiza un minimo de 6 jugadores (portero + 5 de campo) para
-- cualquier usuario al que le falten, no solo la primera vez.

create or replace function public.equipo_topup_squad(target_pool uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_formation text;
  def_count integer;
  med_count integer;
  del_count integer;
  cur_jornada integer;
  current_count integer;
  pick record;
begin
  select formation into chosen_formation from public.equipo_wallets
  where pool_id = target_pool and user_id = target_user;

  if chosen_formation is null then
    return;
  end if;

  if chosen_formation = '2-1-2' then
    def_count := 2; med_count := 1; del_count := 2;
  else
    def_count := 1; med_count := 2; del_count := 2;
  end if;

  cur_jornada := public.equipo_current_jornada();

  -- Portero
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 1;

  if current_count < 1 then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 1
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (
          select 1 from public.equipo_roster r2
          where r2.pool_id = target_pool and r2.user_id = target_user and r2.player_id = bp.id and r2.status = 'owned'
        )
      order by random() limit (1 - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;
  end if;

  -- Defensas
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 2;

  if current_count < def_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 2
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (
          select 1 from public.equipo_roster r2
          where r2.pool_id = target_pool and r2.user_id = target_user and r2.player_id = bp.id and r2.status = 'owned'
        )
      order by random() limit (def_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;
  end if;

  -- Centrocampistas
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 3;

  if current_count < med_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 3
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (
          select 1 from public.equipo_roster r2
          where r2.pool_id = target_pool and r2.user_id = target_user and r2.player_id = bp.id and r2.status = 'owned'
        )
      order by random() limit (med_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;
  end if;

  -- Delanteros
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 4;

  if current_count < del_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 4
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (
          select 1 from public.equipo_roster r2
          where r2.pool_id = target_pool and r2.user_id = target_user and r2.player_id = bp.id and r2.status = 'owned'
        )
      order by random() limit (del_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;
  end if;
end;
$$;
grant execute on function public.equipo_topup_squad(uuid, uuid) to authenticated;

create or replace function public.equipo_ensure_wallet(target_pool uuid)
returns public.equipo_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;

  insert into public.equipo_wallets (pool_id, user_id, balance, formation)
  values (target_pool, auth.uid(), 10000, case when random() < 0.5 then '1-2-2' else '2-1-2' end)
  on conflict (pool_id, user_id) do nothing;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, dedupe_key)
  values (target_pool, auth.uid(), 'initial_grant', 10000, 'initial_grant:' || auth.uid())
  on conflict (pool_id, dedupe_key) do nothing;

  perform public.equipo_topup_squad(target_pool, auth.uid());

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;

create or replace function public.equipo_seed_all_members(target_pool uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  member record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select exists (
    select 1 from public.pool_members me
    where me.pool_id = target_pool and me.user_id = auth.uid()
      and me.role = 'admin' and me.status = 'approved'
  ) into is_admin;
  if not is_admin then
    raise exception 'Solo el admin del pool puede hacer esto';
  end if;

  for member in
    select pm.user_id from public.pool_members pm
    where pm.pool_id = target_pool and pm.status = 'approved'
  loop
    insert into public.equipo_wallets (pool_id, user_id, balance, formation)
    values (target_pool, member.user_id, 10000, case when random() < 0.5 then '1-2-2' else '2-1-2' end)
    on conflict (pool_id, user_id) do nothing;

    insert into public.equipo_transactions (pool_id, user_id, type, amount, dedupe_key)
    values (target_pool, member.user_id, 'initial_grant', 10000, 'initial_grant:' || member.user_id)
    on conflict (pool_id, dedupe_key) do nothing;

    perform public.equipo_topup_squad(target_pool, member.user_id);
  end loop;
end;
$$;
grant execute on function public.equipo_seed_all_members(uuid) to authenticated;
