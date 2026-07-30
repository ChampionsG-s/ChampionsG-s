-- "Equipo": mini-juego de fichajes fantasy dentro de cada quiniela.
-- Cada pool tiene su propio presupuesto, mercado y plantilla (maximo 5
-- jugadores reales de LaLiga, datos vía Biwenger). A diferencia de
-- predictions/results (que el cliente escribe directamente, solo protegidas
-- por RLS), aqui se mueve dinero: TODAS las tablas de Equipo solo tienen
-- politicas RLS de select. Toda mutacion pasa por funciones RPC
-- security definer que validan saldo, puja mas alta y tope de plantilla.

-- ─── Tablas ─────────────────────────────────────────────────────────────────

-- Cache global (no por pool) de los jugadores de LaLiga sincronizados desde
-- la API de Biwenger. id = el id que usa Biwenger (no es un uuid local).
create table if not exists public.biwenger_players (
  id bigint primary key,
  name text not null,
  slug text,
  team_name text not null,
  biwenger_team_id bigint not null,
  position smallint not null check (position between 1 and 4),
  status text not null default 'ok',
  biwenger_price bigint not null,
  coin_price integer not null,
  season_points integer not null default 0,
  photo_url text not null,
  hero_photo_url text,
  synced_at timestamptz not null default now()
);

create table if not exists public.equipo_wallets (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  balance integer not null default 10000 check (balance >= 0),
  updated_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

create table if not exists public.equipo_transactions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('initial_grant', 'bid_hold', 'bid_refund', 'auction_win', 'direct_buy', 'sell', 'jornada_reward')),
  amount integer not null,
  related_player_id bigint references public.biwenger_players(id),
  related_listing_id uuid,
  related_jornada integer,
  dedupe_key text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  unique (pool_id, dedupe_key)
);

create table if not exists public.equipo_market_cycles (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  cycle_number integer not null,
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (pool_id, cycle_number)
);

create unique index if not exists equipo_market_cycles_one_open_per_pool
  on public.equipo_market_cycles (pool_id) where resolved_at is null;

create table if not exists public.equipo_market_listings (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  cycle_id uuid not null references public.equipo_market_cycles(id) on delete cascade,
  player_id bigint not null references public.biwenger_players(id),
  starting_price integer not null,
  direct_buy_price integer not null,
  status text not null default 'open' check (status in ('open', 'sold_auction', 'sold_direct', 'expired')),
  winning_bid_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (pool_id, cycle_id, player_id)
);

create table if not exists public.equipo_bids (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  listing_id uuid not null references public.equipo_market_listings(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pool_id, listing_id, user_id)
);

alter table public.equipo_transactions
  drop constraint if exists equipo_transactions_related_listing_id_fkey;
alter table public.equipo_transactions
  add constraint equipo_transactions_related_listing_id_fkey
  foreign key (related_listing_id) references public.equipo_market_listings(id) on delete set null;

alter table public.equipo_market_listings
  drop constraint if exists equipo_market_listings_winning_bid_fkey;
alter table public.equipo_market_listings
  add constraint equipo_market_listings_winning_bid_fkey
  foreign key (winning_bid_id) references public.equipo_bids(id) on delete set null;

create table if not exists public.equipo_roster (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  player_id bigint not null references public.biwenger_players(id),
  acquired_via text not null check (acquired_via in ('auction', 'direct_buy')),
  purchase_price integer not null,
  points_at_acquisition integer not null default 0,
  banked_points integer not null default 0,
  acquired_at timestamptz not null default now(),
  status text not null default 'owned' check (status in ('owned', 'sold')),
  sold_at timestamptz,
  sold_price integer
);

create unique index if not exists equipo_roster_one_owned_per_player
  on public.equipo_roster (pool_id, user_id, player_id) where status = 'owned';

-- ─── RLS: solo lectura. Toda escritura pasa por RPCs security definer ──────

alter table public.biwenger_players enable row level security;
alter table public.equipo_wallets enable row level security;
alter table public.equipo_transactions enable row level security;
alter table public.equipo_market_cycles enable row level security;
alter table public.equipo_market_listings enable row level security;
alter table public.equipo_bids enable row level security;
alter table public.equipo_roster enable row level security;

drop policy if exists "Anyone can read biwenger_players" on public.biwenger_players;
create policy "Anyone can read biwenger_players"
  on public.biwenger_players for select to authenticated using (true);

drop policy if exists "Members read equipo_wallets" on public.equipo_wallets;
create policy "Members read equipo_wallets"
  on public.equipo_wallets for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members read equipo_transactions" on public.equipo_transactions;
create policy "Members read equipo_transactions"
  on public.equipo_transactions for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members read equipo_market_cycles" on public.equipo_market_cycles;
create policy "Members read equipo_market_cycles"
  on public.equipo_market_cycles for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members read equipo_market_listings" on public.equipo_market_listings;
create policy "Members read equipo_market_listings"
  on public.equipo_market_listings for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members read equipo_bids" on public.equipo_bids;
create policy "Members read equipo_bids"
  on public.equipo_bids for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members read equipo_roster" on public.equipo_roster;
create policy "Members read equipo_roster"
  on public.equipo_roster for select to authenticated
  using (public.is_pool_member(pool_id));

-- ─── RPCs ───────────────────────────────────────────────────────────────────

-- Crea la wallet (10.000 iniciales) y su transaccion de alta la primera vez
-- que un miembro entra a Equipo. Idempotente via dedupe_key.
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

  insert into public.equipo_wallets (pool_id, user_id, balance)
  values (target_pool, auth.uid(), 10000)
  on conflict (pool_id, user_id) do nothing;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, dedupe_key)
  values (target_pool, auth.uid(), 'initial_grant', 10000, 'initial_grant:' || auth.uid())
  on conflict (pool_id, dedupe_key) do nothing;

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;

-- Puja por un jugador en el mercado. Modelo de escrow: retiene la diferencia
-- entre la nueva puja y la anterior del mismo usuario sobre ese listado.
create or replace function public.equipo_place_bid(target_listing uuid, target_amount integer)
returns public.equipo_bids
language plpgsql
security definer
set search_path = public
as $$
declare
  listing public.equipo_market_listings%rowtype;
  existing_bid public.equipo_bids%rowtype;
  highest_amount integer;
  delta integer;
  wallet_balance integer;
  result_bid public.equipo_bids%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if target_amount <= 0 then
    raise exception 'La puja debe ser positiva';
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

  select coalesce(max(amount), listing.starting_price - 1) into highest_amount
  from public.equipo_bids where listing_id = target_listing;

  if target_amount <= highest_amount then
    raise exception 'Debes pujar mas que la puja actual (%)', highest_amount;
  end if;

  insert into public.equipo_wallets (pool_id, user_id, balance)
  values (listing.pool_id, auth.uid(), 10000)
  on conflict (pool_id, user_id) do nothing;

  select * into existing_bid from public.equipo_bids
  where listing_id = target_listing and user_id = auth.uid()
  for update;

  delta := target_amount - coalesce(existing_bid.amount, 0);

  select balance into wallet_balance from public.equipo_wallets
  where pool_id = listing.pool_id and user_id = auth.uid()
  for update;

  if wallet_balance < delta then
    raise exception 'Saldo insuficiente';
  end if;

  update public.equipo_wallets set balance = balance - delta, updated_at = now()
  where pool_id = listing.pool_id and user_id = auth.uid();

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
  values (listing.pool_id, auth.uid(), 'bid_hold', -delta, listing.player_id, target_listing, gen_random_uuid()::text);

  insert into public.equipo_bids (pool_id, listing_id, user_id, amount)
  values (listing.pool_id, target_listing, auth.uid(), target_amount)
  on conflict (pool_id, listing_id, user_id)
  do update set amount = excluded.amount, updated_at = now()
  returning * into result_bid;

  return result_bid;
end;
$$;
grant execute on function public.equipo_place_bid(uuid, integer) to authenticated;

-- Compra directa: precio fijo mas alto, se lleva al jugador al instante y
-- devuelve el dinero retenido a quienes hubieran pujado por el.
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
  if squad_count >= 5 then
    raise exception 'Tu plantilla ya tiene 5 jugadores';
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

-- Vende un jugador de tu plantilla: 65% del precio de compra, banca los
-- puntos ganados mientras fue tuyo para que no se pierdan.
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

  sell_price := round(roster.purchase_price * 0.65);

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

  return roster;
end;
$$;
grant execute on function public.equipo_sell_player(uuid) to authenticated;

-- Rota el mercado: si el ciclo actual ya lleva 3+ dias abierto, resuelve
-- todas las subastas pendientes (gana la puja mas alta cuyo postor aun tenga
-- hueco en la plantilla; si no, se salta al siguiente y se le devuelve el
-- dinero) y genera el lote siguiente. Perezoso: se llama al cargar /equipo.
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

      if squad_count < 5 then
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

    -- Devuelve el dinero retenido a todo el que no haya ganado (incluye a
    -- los que se saltaron por tener la plantilla completa).
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

-- Recalcula el ranking de una jornada (puerto de scoreMatch en
-- src/lib/scoring/index.ts) para no confiar en un ranking calculado en el
-- cliente a la hora de repartir dinero.
create or replace function public.equipo_jornada_ranking(target_pool uuid, target_jornada integer)
returns table(user_id uuid, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id,
    sum(case
      when r.home_score is null then 0
      when sign(p.home_score - p.away_score) <> sign(r.home_score - r.away_score) then 0
      when m.is_bonus is false then coalesce(m.pts_winner, 1)
      when p.home_score = r.home_score and p.away_score = r.away_score then coalesce(m.pts_exact, 3)
      else coalesce(m.pts_winner, 1)
    end)::integer as total
  from public.predictions p
  join public.matches m on m.id = p.match_id and m.jornada = target_jornada
  left join public.results r on r.match_id = m.id and r.pool_id = p.pool_id
  join public.pool_members pm on pm.pool_id = p.pool_id and pm.user_id = p.user_id and pm.status = 'approved'
  where p.pool_id = target_pool
  group by p.user_id;
$$;
grant execute on function public.equipo_jornada_ranking(uuid, integer) to authenticated;

-- Reparte los premios de una jornada ya cerrada segun el ranking de esa
-- jornada: top 3 = 2000, puestos 4-10 = 1000, resto que participo = 300.
-- Idempotente via dedupe_key (uno por pool+jornada+usuario).
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
    end if;
  end loop;
end;
$$;
grant execute on function public.equipo_grant_jornada_rewards(uuid, integer) to authenticated;
