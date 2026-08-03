-- Cuatro arreglos encontrados en la auditoria de Equipo:
--
-- 1. equipo_set_formation no corregia los titulares al cambiar de formacion:
--    si tenias 2 defensas titulares en 2-1-2 y pasabas a 1-2-2 (solo permite
--    1), la carta de mas se quedaba marcada is_starter=true para siempre en
--    la base de datos (el frontend solo lo disimulaba recortando la lista a
--    mostrar). Ahora se reconcilia de verdad: se banquillea el sobrante por
--    posicion, quedandose de titular el que se ficho antes (acquired_at).
--
-- 2. equipo_jornada_ranking (usada para repartir el premio semanal de
--    Equipo) calculaba en realidad el acierto en la QUINIELA (predictions/
--    results), no el rendimiento de la plantilla de Equipo. Ahora usa la
--    misma formula que ya se muestra en la pestana Ranking de Equipo:
--    puntos aportados por cada jugador mientras estuvo en tu plantilla, mas
--    los puntos ya bancados de ventas.
--
-- 3. equipo_direct_buy no expiraba otras cartas del mismo jugador que
--    pudieran seguir abiertas (a diferencia de "fichar de otro usuario",
--    que si lo hacia desde la 018). Se anade la misma llamada.
--
-- 4. equipo_sync_market podia pisar el estado de una carta que un
--    equipo_direct_buy concurrente ya hubiera resuelto (sin comprobar que
--    siguiera 'open' antes de marcarla como subastada/expirada). Se anade
--    la guarda "and status = 'open'".
--
-- (El ajuste del suelo de precios del mercado, que rompia la proporcion
-- 1.5x para jugadores baratos, va en el codigo de la app: COIN_MIN en
-- src/lib/biwenger/pricing.ts y poachPrice() en src/lib/equipo/formation.ts,
-- efectivo en el proximo sync de Biwenger.)

create or replace function public.equipo_set_formation(target_pool uuid, target_formation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  def_quota integer;
  med_quota integer;
  del_quota integer;
  excess record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if target_formation not in ('1-2-2', '2-1-2') then
    raise exception 'Formacion no valida';
  end if;

  update public.equipo_wallets
  set formation = target_formation, updated_at = now()
  where pool_id = target_pool and user_id = auth.uid();

  if target_formation = '1-2-2' then
    def_quota := 1; med_quota := 2; del_quota := 2;
  else
    def_quota := 2; med_quota := 1; del_quota := 2;
  end if;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 2
    order by r.acquired_at asc
    offset def_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 3
    order by r.acquired_at asc
    offset med_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 4
    order by r.acquired_at asc
    offset del_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;
end;
$$;
grant execute on function public.equipo_set_formation(uuid, text) to authenticated;

create or replace function public.equipo_jornada_ranking(target_pool uuid, target_jornada integer)
returns table(user_id uuid, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id,
    sum(
      case when r.status = 'sold' then r.banked_points
      else greatest(0, coalesce(bp.season_points, 0) - r.points_at_acquisition)
      end
    )::integer as total
  from public.equipo_roster r
  join public.pool_members pm on pm.pool_id = r.pool_id and pm.user_id = r.user_id and pm.status = 'approved'
  left join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool
  group by r.user_id;
$$;
grant execute on function public.equipo_jornada_ranking(uuid, integer) to authenticated;

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
    raise exception 'Ese jugador ya tiene dueno, prueba de nuevo';
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

  perform public.equipo_expire_listings_for_player(listing.pool_id, listing.player_id);

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
  jornada_now integer;
  rows_updated integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;

  perform pg_advisory_xact_lock(hashtext(target_pool::text));

  jornada_now := public.equipo_current_jornada();

  select * into cycle from public.equipo_market_cycles
  where pool_id = target_pool and resolved_at is null;

  if not found then
    insert into public.equipo_market_cycles (pool_id, cycle_number, jornada_at_open)
    values (target_pool, 1, jornada_now)
    returning id into new_cycle_id;

    for picked_player in
      select bp.* from public.biwenger_players bp
      where not exists (
        select 1 from public.equipo_roster r
        where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned'
      )
      order by random() limit 8
    loop
      insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
      values (
        target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
        round(picked_player.coin_price * 1.5 / 10) * 10
      );
    end loop;

    return;
  end if;

  if jornada_now <= cycle.jornada_at_open then
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
        select target_pool, winner_id, listing.player_id, 'auction', winner_amount, coalesce(bp.season_points, 0), jornada_now, coalesce(will_start, false)
        from public.biwenger_players bp where bp.id = listing.player_id;

        insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
        values (target_pool, winner_id, 'auction_win', 0, listing.player_id, listing.id, gen_random_uuid()::text);

        update public.equipo_market_listings
        set status = 'sold_auction', winning_bid_id = winner_bid_id, resolved_at = now()
        where id = listing.id and status = 'open';
      exception when unique_violation then
        -- El jugador ya tiene dueno por otra via justo en este instante:
        -- se trata como si nadie hubiera ganado la subasta.
        update public.equipo_market_listings
        set status = 'expired', resolved_at = now()
        where id = listing.id and status = 'open';
        winner_bid_id := null;
      end;
    else
      update public.equipo_market_listings
      set status = 'expired', resolved_at = now()
      where id = listing.id and status = 'open';
    end if;

    get diagnostics rows_updated = row_count;
    if rows_updated = 0 then
      -- La carta ya no seguia 'open' (un direct_buy concurrente la resolvio
      -- antes): no tocar bids/estado, ya se limpiaron por esa otra via.
      continue;
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
  insert into public.equipo_market_cycles (pool_id, cycle_number, jornada_at_open)
  values (target_pool, new_cycle_number, jornada_now)
  returning id into new_cycle_id;

  for picked_player in
    select bp.* from public.biwenger_players bp
    where not exists (
      select 1 from public.equipo_roster r
      where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned'
    )
    order by random() limit 8
  loop
    insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
    values (
      target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
      round(picked_player.coin_price * 1.5 / 10) * 10
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
  poach_price := round(player.coin_price * 1.5 / 10) * 10;

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
