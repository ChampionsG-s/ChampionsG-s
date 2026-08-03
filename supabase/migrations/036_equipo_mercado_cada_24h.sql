-- Vuelve a rotar el mercado de Equipo por tiempo fijo: cada 24 horas,
-- en vez de esperar a que cierre una jornada nueva (migracion 020/023).
-- Se mantiene todo lo demas (lote de 8 jugadores, sin suelo de precio en
-- compra ya, guardas de concurrencia con equipo_direct_buy), solo cambia
-- la condicion que decide si toca generar lote nuevo.

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

  if now() - cycle.started_at < interval '24 hours' then
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
