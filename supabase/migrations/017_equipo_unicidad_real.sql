-- Que un jugador no se pueda repetir no puede depender solo de que la
-- logica de la aplicacion "vaya con cuidado" (dos llamadas casi
-- simultaneas podrian colarse antes de que ninguna vea la fila de la
-- otra). Esto lo convierte en una restriccion real de base de datos:
-- Postgres rechaza directamente cualquier intento de que el mismo
-- jugador quede "owned" para dos filas a la vez dentro del mismo pool,
-- pase lo que pase en el codigo de arriba.

create unique index if not exists equipo_roster_one_owner_per_player
  on public.equipo_roster (pool_id, player_id)
  where status = 'owned';

-- equipo_topup_squad: si una colision de carrera hace que el indice
-- rechace un intento (otro proceso se adelanto con ese mismo jugador en
-- el instante exacto), simplemente lo salta en vez de romper toda la
-- funcion; el siguiente jugador del bucle (o la proxima vez que se
-- llame) lo intenta con otro.
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
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;
end;
$$;
grant execute on function public.equipo_topup_squad(uuid, uuid) to authenticated;

-- Compra en el mercado: si por una carrera imposible-pero-por-si-acaso el
-- jugador ya quedo "owned" un instante antes, avisa con un mensaje claro
-- en vez de reventar con un error crudo de Postgres.
create or replace function public.equipo_direct_buy(target_listing uuid)
returns public.equipo_roster
language plpgsql
security definer
set search_path = public
as $$
declare
  listing public.equipo_market_listings%rowtype;
  wallet_balance integer;
  squad_count integer;
  player public.biwenger_players%rowtype;
  new_roster public.equipo_roster%rowtype;
  loser record;
  will_start boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into listing from public.equipo_market_listings where id = target_listing for update;
  if not found then
    raise exception 'Jugador no encontrado en el mercado';
  end if;
  if not public.is_pool_member(listing.pool_id) then
    raise exception 'No autorizado';
  end if;
  if listing.status <> 'open' then
    raise exception 'Este jugador ya no esta en el mercado';
  end if;

  insert into public.equipo_wallets (pool_id, user_id, balance)
  values (listing.pool_id, auth.uid(), 10000)
  on conflict (pool_id, user_id) do nothing;

  select count(*) into squad_count from public.equipo_roster
  where pool_id = listing.pool_id and user_id = auth.uid() and status = 'owned';
  if squad_count >= 9 then
    raise exception 'Tu plantilla ya tiene 9 jugadores (portero + 5 titulares + 3 banquillo)';
  end if;

  select balance into wallet_balance from public.equipo_wallets
  where pool_id = listing.pool_id and user_id = auth.uid() for update;

  if wallet_balance < listing.direct_buy_price then
    raise exception 'Saldo insuficiente';
  end if;

  select * into player from public.biwenger_players where id = listing.player_id;
  will_start := public.equipo_bucket_has_room(listing.pool_id, auth.uid(), player.position);

  update public.equipo_wallets set balance = balance - listing.direct_buy_price, updated_at = now()
  where pool_id = listing.pool_id and user_id = auth.uid();

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
  values (listing.pool_id, auth.uid(), 'direct_buy', -listing.direct_buy_price, listing.player_id, target_listing, gen_random_uuid()::text);

  begin
    insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
    values (listing.pool_id, auth.uid(), listing.player_id, 'direct_buy', listing.direct_buy_price, coalesce(player.season_points, 0), public.equipo_current_jornada(), will_start)
    returning * into new_roster;
  exception when unique_violation then
    raise exception 'Ese jugador ya tiene dueño, prueba de nuevo';
  end;

  for loser in select * from public.equipo_bids where listing_id = target_listing loop
    update public.equipo_wallets set balance = balance + loser.amount, updated_at = now()
    where pool_id = loser.pool_id and user_id = loser.user_id;

    insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
    values (loser.pool_id, loser.user_id, 'bid_refund', loser.amount, listing.player_id, target_listing, gen_random_uuid()::text);
  end loop;

  delete from public.equipo_bids where listing_id = target_listing;

  update public.equipo_market_listings
  set status = 'sold_direct', resolved_at = now()
  where id = target_listing;

  return new_roster;
end;
$$;
grant execute on function public.equipo_direct_buy(uuid) to authenticated;

create or replace function public.equipo_sync_market(target_pool uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cycle public.equipo_market_cycles%rowtype;
  listing record;
  bid_row record;
  winner_id uuid;
  winner_bid_id uuid;
  winner_amount integer;
  squad_count integer;
  new_cycle_id uuid;
  new_cycle_number integer;
  picked_player record;
  will_start boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_pool::text));

  select * into cycle from public.equipo_market_cycles
  where pool_id = target_pool and resolved_at is null;

  if not found then
    insert into public.equipo_market_cycles (pool_id, cycle_number)
    values (target_pool, 1)
    returning id into new_cycle_id;

    for picked_player in
      select bp.* from public.biwenger_players bp
      where not exists (
        select 1 from public.equipo_roster r
        where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned'
      )
      order by random() limit 24
    loop
      insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
      values (
        target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
        greatest(700, round(picked_player.coin_price * 1.5 / 10) * 10)
      );
    end loop;

    return;
  end if;

  if now() - cycle.started_at < interval '3 days' then
    return;
  end if;

  for listing in
    select * from public.equipo_market_listings
    where cycle_id = cycle.id and status = 'open'
  loop
    winner_id := null;
    winner_bid_id := null;
    winner_amount := null;

    for bid_row in
      select * from public.equipo_bids
      where listing_id = listing.id
      order by amount desc, created_at asc
    loop
      select count(*) into squad_count from public.equipo_roster
      where pool_id = target_pool and user_id = bid_row.user_id and status = 'owned';

      if squad_count < 9 then
        winner_id := bid_row.user_id;
        winner_bid_id := bid_row.id;
        winner_amount := bid_row.amount;
        exit;
      end if;
    end loop;

    if winner_id is not null then
      select public.equipo_bucket_has_room(target_pool, winner_id, bp.position) into will_start
      from public.biwenger_players bp where bp.id = listing.player_id;

      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        select target_pool, winner_id, listing.player_id, 'auction', winner_amount, coalesce(bp.season_points, 0), public.equipo_current_jornada(), coalesce(will_start, false)
        from public.biwenger_players bp where bp.id = listing.player_id;

        insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
        values (target_pool, winner_id, 'auction_win', 0, listing.player_id, listing.id, gen_random_uuid()::text);

        update public.equipo_market_listings
        set status = 'sold_auction', winning_bid_id = winner_bid_id, resolved_at = now()
        where id = listing.id;
      exception when unique_violation then
        -- El jugador ya tiene dueno por otra via justo en este instante:
        -- se trata como si nadie hubiera ganado la subasta.
        update public.equipo_market_listings
        set status = 'expired', resolved_at = now()
        where id = listing.id;
        winner_bid_id := null;
      end;
    else
      update public.equipo_market_listings
      set status = 'expired', resolved_at = now()
      where id = listing.id;
    end if;

    for bid_row in
      select * from public.equipo_bids
      where listing_id = listing.id and id is distinct from winner_bid_id
    loop
      update public.equipo_wallets set balance = balance + bid_row.amount, updated_at = now()
      where pool_id = target_pool and user_id = bid_row.user_id;

      insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
      values (target_pool, bid_row.user_id, 'bid_refund', bid_row.amount, listing.player_id, listing.id, gen_random_uuid()::text);
    end loop;

    delete from public.equipo_bids where listing_id = listing.id;
  end loop;

  update public.equipo_market_cycles set resolved_at = now() where id = cycle.id;

  new_cycle_number := cycle.cycle_number + 1;
  insert into public.equipo_market_cycles (pool_id, cycle_number)
  values (target_pool, new_cycle_number)
  returning id into new_cycle_id;

  for picked_player in
    select bp.* from public.biwenger_players bp
    where not exists (
      select 1 from public.equipo_roster r
      where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned'
    )
    order by random() limit 24
  loop
    insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
    values (
      target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
      greatest(700, round(picked_player.coin_price * 1.5 / 10) * 10)
    );
  end loop;
end;
$$;
grant execute on function public.equipo_sync_market(uuid) to authenticated;

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

  return new_roster;
end;
$$;
grant execute on function public.equipo_poach_player(uuid) to authenticated;

-- Confirma que, con la restriccion ya puesta, no queda ningun duplicado.
do $$
declare
  w record;
begin
  for w in select pool_id, user_id from public.equipo_wallets loop
    perform public.equipo_topup_squad(w.pool_id, w.user_id);
  end loop;
end $$;
