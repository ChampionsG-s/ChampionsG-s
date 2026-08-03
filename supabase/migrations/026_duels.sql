-- Duelos 1vs1 con baraja española: un miembro reta a otro, el retado debe
-- aceptar, y al aceptar se reparten 2 cartas a cada uno (40 cartas: 1-7,
-- sota(8), caballo(9), rey(10) x 4 palos). Gana quien saque la suma mas
-- alta (sota/caballo/rey valen 10); el ganador le quita 2 puntos al
-- perdedor en el Ranking. Empate = no pasa nada.
--
-- El resultado se decide siempre en el servidor (nunca en el cliente),
-- mismo patron que gift_spins/gift_spin: la tabla solo tiene RLS de
-- select, toda escritura pasa por RPCs security definer.

create table if not exists public.duels (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  challenger_id uuid not null references public.users(id) on delete cascade,
  opponent_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'declined', 'resolved')),
  challenger_card1_rank smallint,
  challenger_card1_suit text,
  challenger_card2_rank smallint,
  challenger_card2_suit text,
  opponent_card1_rank smallint,
  opponent_card1_suit text,
  opponent_card2_rank smallint,
  opponent_card2_suit text,
  winner_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (challenger_id <> opponent_id)
);

alter table public.duels enable row level security;

drop policy if exists "Members read duels" on public.duels;
create policy "Members read duels"
  on public.duels for select to authenticated
  using (public.is_pool_member(pool_id));

-- Reta a otro miembro. Un mismo usuario solo puede iniciar un reto nuevo
-- cada 14 dias (sin importar contra quien), para que esto no se vuelva
-- spam de puntos.
create or replace function public.create_duel(target_pool uuid, target_opponent uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  new_duel public.duels%rowtype;
  last_challenge timestamptz;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if target_opponent = auth.uid() then
    raise exception 'No podes retarte a vos mismo';
  end if;
  if not exists (
    select 1 from public.pool_members
    where pool_id = target_pool and user_id = target_opponent and status = 'approved'
  ) then
    raise exception 'Ese usuario no pertenece a esta quiniela';
  end if;

  select max(created_at) into last_challenge
  from public.duels
  where pool_id = target_pool and challenger_id = auth.uid();

  if last_challenge is not null and now() - last_challenge < interval '14 days' then
    raise exception 'Solo podes retar una vez cada 2 semanas';
  end if;

  if exists (
    select 1 from public.duels
    where pool_id = target_pool and status = 'pending'
      and ((challenger_id = auth.uid() and opponent_id = target_opponent)
        or (challenger_id = target_opponent and opponent_id = auth.uid()))
  ) then
    raise exception 'Ya hay un duelo pendiente con ese usuario';
  end if;

  insert into public.duels (pool_id, challenger_id, opponent_id)
  values (target_pool, auth.uid(), target_opponent)
  returning * into new_duel;

  insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
  values (
    target_pool, target_opponent, 'personal', 'duel_challenge',
    '⚔️ Nuevo duelo', 'Te retaron a un duelo de cartas. Entra a aceptarlo o rechazarlo.',
    auth.uid(), 'duel_challenge:' || new_duel.id
  );

  return new_duel;
end;
$$;
grant execute on function public.create_duel(uuid, uuid) to authenticated;

-- El retado acepta o rechaza. Si acepta, se reparten las cartas y se
-- resuelve al instante.
create or replace function public.respond_duel(target_duel uuid, accept boolean)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  duel public.duels%rowtype;
  drawn int[] := '{}';
  card_id int;
  c1 int; c2 int; c3 int; c4 int;
  challenger_total int;
  opponent_total int;
  winner uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into duel from public.duels where id = target_duel for update;
  if not found then
    raise exception 'Duelo no encontrado';
  end if;
  if duel.opponent_id <> auth.uid() then
    raise exception 'No podes responder a este duelo';
  end if;
  if duel.status <> 'pending' then
    raise exception 'Este duelo ya fue respondido';
  end if;

  if not accept then
    update public.duels set status = 'declined', resolved_at = now()
    where id = target_duel
    returning * into duel;

    insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
    values (
      duel.pool_id, duel.challenger_id, 'personal', 'duel_declined',
      'Duelo rechazado', 'Tu reto fue rechazado.', duel.opponent_id, 'duel_declined:' || duel.id
    );

    return duel;
  end if;

  -- Reparte 4 cartas unicas de una baraja de 40 (id 0-39: palo = id/10,
  -- rango = id%10 + 1). 2 para el retador, 2 para el retado.
  while array_length(drawn, 1) is null or array_length(drawn, 1) < 4 loop
    card_id := floor(random() * 40)::int;
    if not (card_id = any(drawn)) then
      drawn := drawn || card_id;
    end if;
  end loop;

  c1 := drawn[1]; c2 := drawn[2]; c3 := drawn[3]; c4 := drawn[4];

  challenger_total :=
    (case when (c1 % 10 + 1) <= 7 then (c1 % 10 + 1) else 10 end) +
    (case when (c2 % 10 + 1) <= 7 then (c2 % 10 + 1) else 10 end);
  opponent_total :=
    (case when (c3 % 10 + 1) <= 7 then (c3 % 10 + 1) else 10 end) +
    (case when (c4 % 10 + 1) <= 7 then (c4 % 10 + 1) else 10 end);

  winner := case
    when challenger_total > opponent_total then duel.challenger_id
    when opponent_total > challenger_total then duel.opponent_id
    else null
  end;

  update public.duels set
    status = 'resolved',
    resolved_at = now(),
    challenger_card1_rank = c1 % 10 + 1, challenger_card1_suit = (array['oros','copas','espadas','bastos'])[c1 / 10 + 1],
    challenger_card2_rank = c2 % 10 + 1, challenger_card2_suit = (array['oros','copas','espadas','bastos'])[c2 / 10 + 1],
    opponent_card1_rank = c3 % 10 + 1, opponent_card1_suit = (array['oros','copas','espadas','bastos'])[c3 / 10 + 1],
    opponent_card2_rank = c4 % 10 + 1, opponent_card2_suit = (array['oros','copas','espadas','bastos'])[c4 / 10 + 1],
    winner_id = winner
  where id = target_duel
  returning * into duel;

  insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
  values (
    duel.pool_id, duel.challenger_id, 'personal', 'duel_resolved',
    case when winner = duel.challenger_id then '⚔️ Ganaste tu duelo' when winner is null then '⚔️ Duelo empatado' else '⚔️ Perdiste tu duelo' end,
    case when winner = duel.challenger_id then 'Le quitaste 2 puntos a tu rival.' when winner is null then 'Empate, nadie gana ni pierde puntos.' else 'Tu rival te quito 2 puntos.' end,
    duel.opponent_id, 'duel_resolved_challenger:' || duel.id
  );

  return duel;
end;
$$;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;
