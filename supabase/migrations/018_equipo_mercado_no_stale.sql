-- Un jugador podia quedar listado en el mercado y, mientras tanto, ser
-- asignado a alguien por otra via (el regalo inicial gratis, o un
-- fichaje entre jugadores) sin que esa carta del mercado desapareciera:
-- el mercado solo evita listar a alguien que YA es propiedad de otro en
-- el momento de generar el lote, pero no revisaba lo contrario (que un
-- jugador ya listado pase a tener dueno despues por otro camino). Eso es
-- justo lo que le paso a Firpo. A partir de ahora, cada vez que un
-- jugador pasa a estar "owned", se expira automaticamente cualquier
-- carta suya que siguiera abierta en el mercado (devolviendo el dinero a
-- quien hubiera pujado).

create or replace function public.equipo_expire_listings_for_player(target_pool uuid, target_player bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  affected record;
  bid_row record;
begin
  for affected in
    select * from public.equipo_market_listings
    where pool_id = target_pool and player_id = target_player and status = 'open'
  loop
    for bid_row in select * from public.equipo_bids where listing_id = affected.id loop
      update public.equipo_wallets set balance = balance + bid_row.amount, updated_at = now()
      where pool_id = target_pool and user_id = bid_row.user_id;

      insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
      values (target_pool, bid_row.user_id, 'bid_refund', bid_row.amount, target_player, affected.id, gen_random_uuid()::text);
    end loop;

    delete from public.equipo_bids where listing_id = affected.id;

    update public.equipo_market_listings
    set status = 'expired', resolved_at = now()
    where id = affected.id;
  end loop;
end;
$$;
grant execute on function public.equipo_expire_listings_for_player(uuid, bigint) to authenticated;

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
      order by random() limit (5 * (1 - current_count))
    loop
      exit when current_count >= 1;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < 1 then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 1
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (1 - current_count))
      loop
        exit when current_count >= 1;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
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
      order by random() limit (5 * (def_count - current_count))
    loop
      exit when current_count >= def_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < def_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 2
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (def_count - current_count))
      loop
        exit when current_count >= def_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
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
      order by random() limit (5 * (med_count - current_count))
    loop
      exit when current_count >= med_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < med_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 3
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (med_count - current_count))
      loop
        exit when current_count >= med_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
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
      order by random() limit (5 * (del_count - current_count))
    loop
      exit when current_count >= del_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < del_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 4
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (del_count - current_count))
      loop
        exit when current_count >= del_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;
end;
$$;
grant execute on function public.equipo_topup_squad(uuid, uuid) to authenticated;

create or replace function public.equipo_poach_player(target_roster_id uuid)
returns public.equipo_roster
language plpgsql
security definer
set search_path = public
as $$
declare
  seller_roster public.equipo_roster%rowtype;
  player public.biwenger_players%rowtype;
  buyer_squad_count integer;
  buyer_balance integer;
  poach_price integer;
  cur_jornada integer;
  will_start boolean;
  new_roster public.equipo_roster%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into seller_roster from public.equipo_roster where id = target_roster_id for update;
  if not found or seller_roster.status <> 'owned' then
    raise exception 'Jugador no disponible';
  end if;
  if seller_roster.user_id = auth.uid() then
    raise exception 'Ya es tuyo';
  end if;
  if not public.is_pool_member(seller_roster.pool_id) then
    raise exception 'No autorizado';
  end if;

  cur_jornada := public.equipo_current_jornada();
  if cur_jornada - seller_roster.acquired_jornada < 2 then
    raise exception 'Este jugador todavia no se puede fichar (necesita 2 jornadas con su dueno actual)';
  end if;

  select count(*) into buyer_squad_count from public.equipo_roster
  where pool_id = seller_roster.pool_id and user_id = auth.uid() and status = 'owned';
  if buyer_squad_count >= 9 then
    raise exception 'Tu plantilla ya tiene 9 jugadores (portero + 5 titulares + 3 banquillo)';
  end if;

  select * into player from public.biwenger_players where id = seller_roster.player_id;
  poach_price := greatest(700, round(player.coin_price * 1.5 / 10) * 10);

  insert into public.equipo_wallets (pool_id, user_id, balance)
  values (seller_roster.pool_id, auth.uid(), 10000)
  on conflict (pool_id, user_id) do nothing;

  select balance into buyer_balance from public.equipo_wallets
  where pool_id = seller_roster.pool_id and user_id = auth.uid() for update;

  if buyer_balance < poach_price then
    raise exception 'Saldo insuficiente';
  end if;

  will_start := public.equipo_bucket_has_room(seller_roster.pool_id, auth.uid(), player.position);

  update public.equipo_wallets set balance = balance - poach_price, updated_at = now()
  where pool_id = seller_roster.pool_id and user_id = auth.uid();

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, dedupe_key)
  values (seller_roster.pool_id, auth.uid(), 'direct_buy', -poach_price, seller_roster.player_id, gen_random_uuid()::text);

  update public.equipo_wallets set balance = balance + poach_price, updated_at = now()
  where pool_id = seller_roster.pool_id and user_id = seller_roster.user_id;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, dedupe_key)
  values (seller_roster.pool_id, seller_roster.user_id, 'sell', poach_price, seller_roster.player_id, gen_random_uuid()::text);

  update public.equipo_roster
  set status = 'sold', sold_at = now(), sold_price = poach_price,
      banked_points = coalesce(player.season_points, 0) - seller_roster.points_at_acquisition
  where id = target_roster_id;

  begin
    insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
    values (seller_roster.pool_id, auth.uid(), seller_roster.player_id, 'direct_buy', poach_price, coalesce(player.season_points, 0), cur_jornada, will_start)
    returning * into new_roster;
  exception when unique_violation then
    raise exception 'Ese jugador ya tiene dueño, prueba de nuevo';
  end;

  perform public.equipo_expire_listings_for_player(seller_roster.pool_id, seller_roster.player_id);

  return new_roster;
end;
$$;
grant execute on function public.equipo_poach_player(uuid) to authenticated;

-- ─── Limpieza en vivo: expira ya mismo cualquier carta del mercado cuyo
-- jugador ya tenga dueno (como el caso de Firpo), devolviendo el dinero a
-- quien hubiera pujado por ella.

do $$
declare
  stale record;
begin
  for stale in
    select distinct l.pool_id, l.player_id
    from public.equipo_market_listings l
    where l.status = 'open'
      and exists (
        select 1 from public.equipo_roster r
        where r.pool_id = l.pool_id and r.player_id = l.player_id and r.status = 'owned'
      )
  loop
    perform public.equipo_expire_listings_for_player(stale.pool_id, stale.player_id);
  end loop;
end $$;
