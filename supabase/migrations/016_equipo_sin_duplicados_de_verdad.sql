-- Ahora que la sincronizacion real con Biwenger ya funciona (513 jugadores
-- reales, no los 34 sembrados a mano), hay margen de sobra para que el
-- regalo inicial gratis TAMBIEN respete exclusividad total: ningun
-- jugador puede pertenecer a mas de un usuario a la vez en el mismo pool,
-- ni siquiera en el regalo de bienvenida.
--
-- Estrategia: primero intenta elegir entre jugadores baratos (compra
-- directa <=5000) que nadie tenga; si para alguna posicion no quedan
-- suficientes baratos sin dueno (nunca deberia pasar salvo en porteros,
-- que son pocos por naturaleza), completa con cualquier jugador libre de
-- esa posicion aunque no sea barato, para no dejar a nadie sin plantilla.

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
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (1 - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      current_count := current_count + 1;
    end loop;

    if current_count < 1 then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 1
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (1 - current_count)
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;
    end if;
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
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (def_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      current_count := current_count + 1;
    end loop;

    if current_count < def_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 2
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (def_count - current_count)
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;
    end if;
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
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (med_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      current_count := current_count + 1;
    end loop;

    if current_count < med_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 3
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (med_count - current_count)
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;
    end if;
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
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (del_count - current_count)
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      current_count := current_count + 1;
    end loop;

    if current_count < del_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 4
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (del_count - current_count)
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;
    end if;
  end if;
end;
$$;
grant execute on function public.equipo_topup_squad(uuid, uuid) to authenticated;

-- ─── Limpieza de los duplicados que ya se crearon con la version anterior ──

delete from public.equipo_roster r
using (
  select id, row_number() over (
    partition by pool_id, player_id
    order by acquired_at asc
  ) as rn
  from public.equipo_roster
  where status = 'owned' and acquired_via = 'starter'
) dup
where r.id = dup.id and dup.rn > 1;

-- Rellena de nuevo (ya con exclusividad total) a quien se haya quedado
-- corto tras borrar los duplicados.
do $$
declare
  w record;
begin
  for w in select pool_id, user_id from public.equipo_wallets loop
    perform public.equipo_topup_squad(w.pool_id, w.user_id);
  end loop;
end $$;
