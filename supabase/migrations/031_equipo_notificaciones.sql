-- Notificaciones para los eventos economicos de Equipo, que hasta ahora no
-- generaban nada en Actividad (las RPCs de Equipo corren como security
-- definer y algunas se disparan en la carga de pagina de CUALQUIER
-- miembro, no solo del implicado, asi que la unica forma fiable de avisar
-- es insertar la notificacion dentro de la propia funcion, no desde el
-- cliente): ganar una subasta del mercado libre y fichar a un jugador de
-- otro usuario avisan a todo el pool (scope global); vender un jugador y
-- cobrar el premio semanal avisan solo al propio usuario (scope personal).

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

        insert into public.notifications (pool_id, scope, type, title, body, related_user_id, dedupe_key)
        select target_pool, 'global', 'equipo_auction_win', 'Fichaje en el mercado',
          u.username || ' fichó a ' || bp.name || ' por ' || winner_amount || ' monedas en el mercado.',
          winner_id, 'equipo_auction_win:' || listing.id
        from public.users u, public.biwenger_players bp
        where u.id = winner_id and bp.id = listing.player_id
        on conflict (pool_id, dedupe_key) do nothing;

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

  insert into public.notifications (pool_id, scope, type, title, body, related_user_id, dedupe_key)
  select seller_roster.pool_id, 'global', 'equipo_poach', 'Fichaje entre jugadores',
    buyer.username || ' le ha fichado ' || player.name || ' a ' || seller.username || ' por ' || poach_price || ' monedas.',
    auth.uid(), 'equipo_poach:' || new_roster.id
  from public.users buyer, public.users seller
  where buyer.id = auth.uid() and seller.id = seller_roster.user_id
  on conflict (pool_id, dedupe_key) do nothing;

  perform public.equipo_expire_listings_for_player(seller_roster.pool_id, seller_roster.player_id);

  return new_roster;
end;
$$;
grant execute on function public.equipo_poach_player(uuid) to authenticated;

create or replace function public.equipo_sell_player(target_roster_id uuid)
returns public.equipo_roster
language plpgsql
security definer
set search_path = public
as $$
declare
  roster public.equipo_roster%rowtype;
  player public.biwenger_players%rowtype;
  sell_price integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into roster from public.equipo_roster where id = target_roster_id for update;
  if not found or roster.user_id <> auth.uid() or roster.status <> 'owned' then
    raise exception 'No puedes vender este jugador';
  end if;

  select * into player from public.biwenger_players where id = roster.player_id;

  sell_price := round(coalesce(player.coin_price, 0) * 0.65);

  insert into public.equipo_wallets (pool_id, user_id, balance)
  values (roster.pool_id, roster.user_id, 10000)
  on conflict (pool_id, user_id) do nothing;

  update public.equipo_wallets set balance = balance + sell_price, updated_at = now()
  where pool_id = roster.pool_id and user_id = roster.user_id;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, dedupe_key)
  values (roster.pool_id, roster.user_id, 'sell', sell_price, roster.player_id, gen_random_uuid()::text);

  update public.equipo_roster
  set status = 'sold', sold_at = now(), sold_price = sell_price,
      banked_points = coalesce(player.season_points, 0) - points_at_acquisition
  where id = target_roster_id
  returning * into roster;

  insert into public.notifications (pool_id, user_id, scope, type, title, body, dedupe_key)
  values (
    roster.pool_id, roster.user_id, 'personal', 'equipo_sell', 'Venta rápida',
    'Has vendido a ' || player.name || ' por ' || sell_price || ' monedas.',
    'equipo_sell:' || target_roster_id
  )
  on conflict (pool_id, dedupe_key) do nothing;

  return roster;
end;
$$;
grant execute on function public.equipo_sell_player(uuid) to authenticated;

create or replace function public.equipo_grant_jornada_rewards(target_pool uuid, target_jornada integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  reward integer;
  dedupe text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if now() < public.jornada_deadline(target_jornada) then
    raise exception 'La jornada aun no ha cerrado';
  end if;

  for r in
    select user_id, total, rank() over (order by total desc) as rnk
    from public.equipo_jornada_ranking(target_pool, target_jornada)
  loop
    reward := case
      when r.rnk <= 3 then 2000
      when r.rnk <= 10 then 1000
      else 300
    end;

    dedupe := 'jornada_reward:' || target_jornada || ':' || r.user_id;

    insert into public.equipo_wallets (pool_id, user_id, balance)
    values (target_pool, r.user_id, 10000)
    on conflict (pool_id, user_id) do nothing;

    insert into public.equipo_transactions (pool_id, user_id, type, amount, related_jornada, dedupe_key)
    values (target_pool, r.user_id, 'jornada_reward', reward, target_jornada, dedupe)
    on conflict (pool_id, dedupe_key) do nothing;

    if found then
      update public.equipo_wallets set balance = balance + reward, updated_at = now()
      where pool_id = target_pool and user_id = r.user_id;

      insert into public.notifications (pool_id, user_id, scope, type, title, body, dedupe_key)
      values (
        target_pool, r.user_id, 'personal', 'equipo_jornada_reward', 'Premio de Equipo',
        'Has cobrado ' || reward || ' monedas del premio de la jornada ' || target_jornada || '.',
        'equipo_jornada_reward_notif:' || dedupe
      )
      on conflict (pool_id, dedupe_key) do nothing;
    end if;
  end loop;
end;
$$;
grant execute on function public.equipo_grant_jornada_rewards(uuid, integer) to authenticated;
