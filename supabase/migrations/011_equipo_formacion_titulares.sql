-- Formacion (1-2-2 / 2-1-2), plantilla inicial gratis de 5 jugadores baratos
-- por usuario, banquillo (se llena fichando, hasta completar 8 en total) y
-- una tanda de jugadores reales (estrellas + baratos) para poder ver el
-- mercado funcionando antes de que corra la sincronizacion completa con
-- Biwenger.

-- ─── Formacion por wallet ───────────────────────────────────────────────────

alter table public.equipo_wallets add column if not exists formation text not null default '1-2-2';

alter table public.equipo_wallets drop constraint if exists equipo_wallets_formation_check;
alter table public.equipo_wallets
  add constraint equipo_wallets_formation_check check (formation in ('1-2-2', '2-1-2'));

-- Los jugadores asignados gratis al crear la wallet se marcan 'starter'
-- (distinto de 'auction'/'direct_buy', que si cuestan dinero).
alter table public.equipo_roster drop constraint if exists equipo_roster_acquired_via_check;
alter table public.equipo_roster
  add constraint equipo_roster_acquired_via_check check (acquired_via in ('auction', 'direct_buy', 'starter'));

-- ─── Semilla de jugadores reales (estrellas + baratos) ─────────────────────
-- Mismos ids/datos que devuelve la API de Biwenger (verificados en vivo), asi
-- que un sync real posterior los actualiza sin conflicto (upsert por id).

insert into public.biwenger_players
  (id, name, slug, team_name, biwenger_team_id, position, status, biwenger_price, coin_price, season_points, photo_url, hero_photo_url, synced_at)
values
  (19577, 'Mbappé', 'mbappe', 'Real Madrid', 15, 4, 'ok', 24690000, 8000, 0, 'https://cdn.biwenger.com/i/p/19577.png', 'https://cdn.biwenger.com/i/p/hero/19577.png', now()),
  (15568, 'Vinícius Jr', 'vinicius-junior', 'Real Madrid', 15, 4, 'ok', 18220000, 7170, 0, 'https://cdn.biwenger.com/i/p/15568.png', 'https://cdn.biwenger.com/i/p/hero/15568.png', now()),
  (30477, 'Bellingham', 'jude-bellingham', 'Real Madrid', 15, 3, 'ok', 16920000, 6980, 0, 'https://cdn.biwenger.com/i/p/30477.png', 'https://cdn.biwenger.com/i/p/hero/30477.png', now()),
  (26271, 'Yamal', 'lamine-yamal', 'FC Barcelona', 3, 4, 'ok', 20350000, 7470, 0, 'https://cdn.biwenger.com/i/p/26271.png', 'https://cdn.biwenger.com/i/p/hero/26271.png', now()),
  (19441, 'Pedri', 'pedri', 'FC Barcelona', 3, 3, 'ok', 17000000, 6990, 0, 'https://cdn.biwenger.com/i/p/19441.png', 'https://cdn.biwenger.com/i/p/hero/19441.png', now()),
  (26930, 'Raphinha', 'raphinha', 'FC Barcelona', 3, 4, 'ok', 15170000, 6690, 0, 'https://cdn.biwenger.com/i/p/26930.png', 'https://cdn.biwenger.com/i/p/hero/26930.png', now()),
  (34557, 'Julián Alvarez', 'j-alvarez', 'Atlético de Madrid', 2, 4, 'ok', 9040000, 5420, 0, 'https://cdn.biwenger.com/i/p/34557.png', 'https://cdn.biwenger.com/i/p/hero/34557.png', now()),
  (18173, 'Militão', 'eder-militao', 'Real Madrid', 15, 2, 'injured', 1610000, 2090, 0, 'https://cdn.biwenger.com/i/p/18173.png', 'https://cdn.biwenger.com/i/p/hero/18173.png', now()),
  (15719, 'Le Normand', 'le-normand', 'Atlético de Madrid', 2, 2, 'ok', 1980000, 2410, 0, 'https://cdn.biwenger.com/i/p/15719.png', 'https://cdn.biwenger.com/i/p/hero/15719.png', now()),
  (1613, 'Laporte', 'laporte', 'Athletic Club', 1, 2, 'ok', 4840000, 4050, 0, 'https://cdn.biwenger.com/i/p/1613.png', null, now()),
  (21008, 'Nico Williams', 'nico-williams', 'Athletic Club', 1, 4, 'ok', 7690000, 5050, 0, 'https://cdn.biwenger.com/i/p/21008.png', 'https://cdn.biwenger.com/i/p/hero/21008.png', now()),
  (2603, 'Oyarzabal', 'oyarzabal', 'Real Sociedad', 13, 4, 'ok', 13350000, 6370, 0, 'https://cdn.biwenger.com/i/p/2603.png', 'https://cdn.biwenger.com/i/p/hero/2603.png', now()),
  (290, 'Manu Fernández', 'manu-fernandez', 'RC Celta', 5, 2, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/290.png', null, now()),
  (3446, 'Carlos Dominguez', 'carlos-dominguez', 'RC Celta', 5, 2, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/3446.png', null, now()),
  (10292, 'Arguibide', 'inigo-arguibide', 'CA Osasuna', 93, 2, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/10292.png', null, now()),
  (12596, 'Firpo', 'junior-firpo', 'Real Betis', 87, 2, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/12596.png', null, now()),
  (23988, 'Miguel Rubio', 'miguel-rubio', 'RCD Espanyol', 7, 2, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/23988.png', null, now()),
  (3310, 'Tomás Mendes', 'tomas-mendes', 'Deportivo Alavés', 91, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/3310.png', null, now()),
  (16321, 'Javi Muñoz', 'javi-munoz', 'Getafe CF', 8, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/16321.png', null, now()),
  (19693, 'Osambela', 'osambela', 'CA Osasuna', 93, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/19693.png', null, now()),
  (25778, 'Iker Benito', 'iker-benito', 'CA Osasuna', 93, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/25778.png', null, now()),
  (26299, 'Manu Bueno', 'manu-bueno', 'Sevilla FC', 17, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/26299.png', null, now()),
  (31475, 'Zakharyan', 'arsen-zakharyan', 'Real Sociedad', 13, 3, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/31475.png', null, now()),
  (5697, 'Mariano', 'mariano-diaz', 'Deportivo Alavés', 91, 4, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/5697.png', null, now()),
  (25688, 'Rafa Núñez', 'rafa-nunez', 'Elche CF', 75, 4, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/25688.png', null, now()),
  (27625, 'Jon Karrikaburu', 'jon-karrikaburu', 'Real Sociedad', 13, 4, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/27625.png', null, now()),
  (33938, 'Sannadi', 'maroan-sannadi', 'Athletic Club', 1, 4, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/33938.png', null, now()),
  (37709, 'Boayar', 'adam-boayar', 'Elche CF', 75, 4, 'ok', 150000, 100, 0, 'https://cdn.biwenger.com/i/p/37709.png', null, now())
on conflict (id) do nothing;

-- ─── RPC: cambiar formacion ─────────────────────────────────────────────────

create or replace function public.equipo_set_formation(target_pool uuid, target_formation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;
grant execute on function public.equipo_set_formation(uuid, text) to authenticated;

-- ─── RPC: equipo_ensure_wallet, ahora tambien asigna 5 jugadores gratis ────
-- (baratos, ajustados a la formacion elegida al azar) la primera vez que el
-- usuario entra a Equipo en ese pool.

create or replace function public.equipo_ensure_wallet(target_pool uuid)
returns public.equipo_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
  chosen_formation text;
  existing_players integer;
  def_count integer;
  med_count integer;
  del_count integer;
  pick record;
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

  select count(*) into existing_players from public.equipo_roster
  where pool_id = target_pool and user_id = auth.uid();

  if existing_players = 0 then
    select formation into chosen_formation from public.equipo_wallets
    where pool_id = target_pool and user_id = auth.uid();

    if chosen_formation = '2-1-2' then
      def_count := 2; med_count := 1; del_count := 2;
    else
      def_count := 1; med_count := 2; del_count := 2;
    end if;

    for pick in
      select * from (
        select * from public.biwenger_players where position = 2 order by coin_price asc limit 20
      ) sub order by random() limit def_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0));
    end loop;

    for pick in
      select * from (
        select * from public.biwenger_players where position = 3 order by coin_price asc limit 20
      ) sub order by random() limit med_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0));
    end loop;

    for pick in
      select * from (
        select * from public.biwenger_players where position = 4 order by coin_price asc limit 20
      ) sub order by random() limit del_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0));
    end loop;
  end if;

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;

-- ─── Tope de plantilla: 5 titulares + 3 banquillo = 8 ──────────────────────

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
  if squad_count >= 8 then
    raise exception 'Tu plantilla ya tiene 8 jugadores (5 titulares + 3 banquillo)';
  end if;

  select balance into wallet_balance from public.equipo_wallets
  where pool_id = listing.pool_id and user_id = auth.uid() for update;

  if wallet_balance < listing.direct_buy_price then
    raise exception 'Saldo insuficiente';
  end if;

  select * into player from public.biwenger_players where id = listing.player_id;

  update public.equipo_wallets set balance = balance - listing.direct_buy_price, updated_at = now()
  where pool_id = listing.pool_id and user_id = auth.uid();

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
  values (listing.pool_id, auth.uid(), 'direct_buy', -listing.direct_buy_price, listing.player_id, target_listing, gen_random_uuid()::text);

  insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition)
  values (listing.pool_id, auth.uid(), listing.player_id, 'direct_buy', listing.direct_buy_price, coalesce(player.season_points, 0))
  returning * into new_roster;

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
      select * from public.biwenger_players order by random() limit 24
    loop
      insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
      values (
        target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
        greatest(picked_player.coin_price + 10, round(picked_player.coin_price * 1.5 / 10) * 10)
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

      if squad_count < 8 then
        winner_id := bid_row.user_id;
        winner_bid_id := bid_row.id;
        winner_amount := bid_row.amount;
        exit;
      end if;
    end loop;

    if winner_id is not null then
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition)
      select target_pool, winner_id, listing.player_id, 'auction', winner_amount, coalesce(bp.season_points, 0)
      from public.biwenger_players bp where bp.id = listing.player_id;

      insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
      values (target_pool, winner_id, 'auction_win', 0, listing.player_id, listing.id, gen_random_uuid()::text);

      update public.equipo_market_listings
      set status = 'sold_auction', winning_bid_id = winner_bid_id, resolved_at = now()
      where id = listing.id;
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
    select * from public.biwenger_players order by random() limit 24
  loop
    insert into public.equipo_market_listings (pool_id, cycle_id, player_id, starting_price, direct_buy_price)
    values (
      target_pool, new_cycle_id, picked_player.id, picked_player.coin_price,
      greatest(picked_player.coin_price + 10, round(picked_player.coin_price * 1.5 / 10) * 10)
    );
  end loop;
end;
$$;
grant execute on function public.equipo_sync_market(uuid) to authenticated;
