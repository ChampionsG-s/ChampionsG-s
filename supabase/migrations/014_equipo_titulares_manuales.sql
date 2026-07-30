-- 1) Titular/banquillo pasa a ser una eleccion explicita del usuario
--    (arrastrar y soltar), no un calculo automatico por precio.
-- 2) El precio minimo de "compra ya" sube de ~150 a 700 (los jugadores
--    baratos son justamente los que puntuan poco por jugar poco, pero
--    fichar cualquiera al instante costaba demasiado poco).
-- 3) Un jugador nunca puede estar en dos sitios a la vez: si ya es
--    propiedad de alguien en el pool (titular o banquillo), no puede
--    volver a salir en el mercado.
-- 4) RPC para que el admin rellene de un tiron la plantilla inicial de
--    todos los miembros del pool (para poder probar el fichaje entre
--    jugadores sin que cada uno tenga que entrar a Equipo primero).

alter table public.equipo_roster add column if not exists is_starter boolean not null default false;

-- Backfill: para las plantillas que ya existian antes de esta migracion,
-- marca como titulares exactamente los mismos jugadores que el calculo
-- automatico por precio ya mostraba, para no vaciar el campo de nadie.
with ranked as (
  select r.id, bp.position,
    row_number() over (
      partition by r.pool_id, r.user_id, bp.position
      order by bp.coin_price desc
    ) as rn,
    w.formation
  from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  join public.equipo_wallets w on w.pool_id = r.pool_id and w.user_id = r.user_id
  where r.status = 'owned'
)
update public.equipo_roster r
set is_starter = true
from ranked
where ranked.id = r.id
  and (
    (ranked.position = 1 and ranked.rn = 1) or
    (ranked.position = 2 and ranked.rn <= (case when ranked.formation = '2-1-2' then 2 else 1 end)) or
    (ranked.position = 3 and ranked.rn <= (case when ranked.formation = '2-1-2' then 1 else 2 end)) or
    (ranked.position = 4 and ranked.rn <= 2)
  );

-- Hueco libre en la linea (portero/defensa/centrocampista/delantero) de un
-- usuario segun su formacion elegida.
create or replace function public.equipo_bucket_has_room(target_pool uuid, target_user uuid, want_position smallint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
  bucket_limit integer;
  bucket_count integer;
begin
  select * into wallet from public.equipo_wallets where pool_id = target_pool and user_id = target_user;

  bucket_limit := case want_position
    when 1 then 1
    when 2 then (case when wallet.formation = '2-1-2' then 2 else 1 end)
    when 3 then (case when wallet.formation = '2-1-2' then 1 else 2 end)
    when 4 then 2
    else 0
  end;

  select count(*) into bucket_count
  from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned'
    and r.is_starter = true and bp.position = want_position;

  return bucket_count < bucket_limit;
end;
$$;
grant execute on function public.equipo_bucket_has_room(uuid, uuid, smallint) to authenticated;

-- RPC para el drag & drop: mueve un jugador entre titular y banquillo.
-- Solo puede ser titular si hay hueco libre en SU propia posicion (un
-- defensa nunca compite por un hueco de centrocampista).
create or replace function public.equipo_set_starter(target_roster_id uuid, make_starter boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  roster public.equipo_roster%rowtype;
  player public.biwenger_players%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into roster from public.equipo_roster where id = target_roster_id for update;
  if not found or roster.user_id <> auth.uid() or roster.status <> 'owned' then
    raise exception 'Jugador no valido';
  end if;

  if make_starter = roster.is_starter then
    return;
  end if;

  if make_starter then
    select * into player from public.biwenger_players where id = roster.player_id;
    if not public.equipo_bucket_has_room(roster.pool_id, auth.uid(), player.position) then
      raise exception 'No hay hueco libre en esa posicion';
    end if;
  end if;

  update public.equipo_roster set is_starter = make_starter where id = target_roster_id;
end;
$$;
grant execute on function public.equipo_set_starter(uuid, boolean) to authenticated;

-- ─── Precio minimo de compra directa: 700 ──────────────────────────────────

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
  cur_jornada integer;
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

    cur_jornada := public.equipo_current_jornada();

    for pick in
      select * from (
        select bp.* from public.biwenger_players bp
        where bp.position = 1
          and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
        order by bp.coin_price asc limit 20
      ) sub order by random() limit 1
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;

    for pick in
      select * from (
        select bp.* from public.biwenger_players bp
        where bp.position = 2
          and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
        order by bp.coin_price asc limit 20
      ) sub order by random() limit def_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;

    for pick in
      select * from (
        select bp.* from public.biwenger_players bp
        where bp.position = 3
          and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
        order by bp.coin_price asc limit 20
      ) sub order by random() limit med_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;

    for pick in
      select * from (
        select bp.* from public.biwenger_players bp
        where bp.position = 4
          and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
        order by bp.coin_price asc limit 20
      ) sub order by random() limit del_count
    loop
      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      values (target_pool, auth.uid(), pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
    end loop;
  end if;

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;

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

  insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
  values (listing.pool_id, auth.uid(), listing.player_id, 'direct_buy', listing.direct_buy_price, coalesce(player.season_points, 0), public.equipo_current_jornada(), will_start)
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

-- Rota el mercado: excluye jugadores ya en propiedad de cualquiera en el
-- pool (titular o banquillo) y sube el precio minimo de compra directa a
-- 700 (antes bajaba hasta ~150 para los jugadores mas baratos).
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

      insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
      select target_pool, winner_id, listing.player_id, 'auction', winner_amount, coalesce(bp.season_points, 0), public.equipo_current_jornada(), coalesce(will_start, false)
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

-- Fichaje entre jugadores: precio minimo tambien sube a 700, y el nuevo
-- dueno entra de titular solo si hay hueco libre en su posicion.
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

  insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
  values (seller_roster.pool_id, auth.uid(), seller_roster.player_id, 'direct_buy', poach_price, coalesce(player.season_points, 0), cur_jornada, will_start)
  returning * into new_roster;

  return new_roster;
end;
$$;
grant execute on function public.equipo_poach_player(uuid) to authenticated;

-- Rellena de un tiron la wallet + plantilla inicial de TODOS los miembros
-- aprobados del pool que aun no la tengan. Solo el admin del pool puede
-- llamarla (pensada para poder probar el fichaje entre jugadores sin que
-- cada miembro tenga que entrar antes a Equipo).
create or replace function public.equipo_seed_all_members(target_pool uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean;
  member record;
  chosen_formation text;
  def_count integer;
  med_count integer;
  del_count integer;
  cur_jornada integer;
  existing_players integer;
  pick record;
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

  cur_jornada := public.equipo_current_jornada();

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

    select count(*) into existing_players from public.equipo_roster
    where pool_id = target_pool and user_id = member.user_id;

    if existing_players = 0 then
      select formation into chosen_formation from public.equipo_wallets
      where pool_id = target_pool and user_id = member.user_id;

      if chosen_formation = '2-1-2' then
        def_count := 2; med_count := 1; del_count := 2;
      else
        def_count := 1; med_count := 2; del_count := 2;
      end if;

      for pick in
        select * from (
          select bp.* from public.biwenger_players bp
          where bp.position = 1
            and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
          order by bp.coin_price asc limit 20
        ) sub order by random() limit 1
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, member.user_id, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;

      for pick in
        select * from (
          select bp.* from public.biwenger_players bp
          where bp.position = 2
            and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
          order by bp.coin_price asc limit 20
        ) sub order by random() limit def_count
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, member.user_id, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;

      for pick in
        select * from (
          select bp.* from public.biwenger_players bp
          where bp.position = 3
            and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
          order by bp.coin_price asc limit 20
        ) sub order by random() limit med_count
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, member.user_id, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;

      for pick in
        select * from (
          select bp.* from public.biwenger_players bp
          where bp.position = 4
            and not exists (select 1 from public.equipo_roster r where r.pool_id = target_pool and r.player_id = bp.id and r.status = 'owned')
          order by bp.coin_price asc limit 20
        ) sub order by random() limit del_count
      loop
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, member.user_id, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
      end loop;
    end if;
  end loop;
end;
$$;
grant execute on function public.equipo_seed_all_members(uuid) to authenticated;
