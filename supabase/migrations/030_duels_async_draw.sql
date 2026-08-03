-- Cambia el ritmo del duelo: aceptar YA NO reparte las cartas al instante.
-- Ahora aceptar solo desbloquea el duelo (status 'accepted'); cada jugador
-- entra por su cuenta, cuando quiera, y saca sus propias 2 cartas
-- (draw_duel_cards). El duelo se resuelve solo cuando AMBOS ya sacaron,
-- sin importar el orden.

alter table public.duels drop constraint if exists duels_status_check;
alter table public.duels add constraint duels_status_check
  check (status in ('pending', 'accepted', 'declined', 'resolved'));

-- Aceptar ya no dibuja cartas: solo pasa el duelo a 'accepted' y avisa al
-- retador (en Actividad) que ya puede entrar a sacar las suyas.
create or replace function public.respond_duel(target_duel uuid, accept boolean)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  duel public.duels%rowtype;
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

  update public.duels set status = 'accepted'
  where id = target_duel
  returning * into duel;

  insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
  values (
    duel.pool_id, duel.challenger_id, 'personal', 'duel_accepted',
    '⚔️ Aceptaron tu duelo', 'Ya podés entrar a sacar tus cartas.',
    duel.opponent_id, 'duel_accepted:' || duel.id
  );

  return duel;
end;
$$;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;

-- Saca las 2 cartas del que llama (retador o retado, quien sea que entre
-- primero). Si con esto ya sacaron los dos, resuelve el duelo y notifica
-- a ambos; si no, avisa al rival que ya le toca a el/ella.
create or replace function public.draw_duel_cards(target_duel uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  duel public.duels%rowtype;
  is_challenger boolean;
  used int[] := '{}';
  card_id int;
  a int;
  b int;
  challenger_total int;
  opponent_total int;
  winner uuid;
  both_drawn boolean;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into duel from public.duels where id = target_duel for update;
  if not found then
    raise exception 'Duelo no encontrado';
  end if;
  if duel.status <> 'accepted' then
    raise exception 'Este duelo no esta listo para sacar cartas';
  end if;

  if duel.challenger_id = auth.uid() then
    is_challenger := true;
  elsif duel.opponent_id = auth.uid() then
    is_challenger := false;
  else
    raise exception 'No participas en este duelo';
  end if;

  if is_challenger and duel.challenger_card1_rank is not null then
    raise exception 'Ya sacaste tus cartas';
  end if;
  if not is_challenger and duel.opponent_card1_rank is not null then
    raise exception 'Ya sacaste tus cartas';
  end if;

  -- No repetir cartas ya sacadas por el rival en este mismo duelo.
  if duel.challenger_card1_rank is not null then
    used := used || (case duel.challenger_card1_suit when 'oros' then 0 when 'copas' then 10 when 'espadas' then 20 else 30 end + duel.challenger_card1_rank - 1);
    used := used || (case duel.challenger_card2_suit when 'oros' then 0 when 'copas' then 10 when 'espadas' then 20 else 30 end + duel.challenger_card2_rank - 1);
  end if;
  if duel.opponent_card1_rank is not null then
    used := used || (case duel.opponent_card1_suit when 'oros' then 0 when 'copas' then 10 when 'espadas' then 20 else 30 end + duel.opponent_card1_rank - 1);
    used := used || (case duel.opponent_card2_suit when 'oros' then 0 when 'copas' then 10 when 'espadas' then 20 else 30 end + duel.opponent_card2_rank - 1);
  end if;

  loop
    card_id := floor(random() * 40)::int;
    if not (card_id = any(used)) then
      used := used || card_id;
      a := card_id;
      exit;
    end if;
  end loop;
  loop
    card_id := floor(random() * 40)::int;
    if not (card_id = any(used)) then
      used := used || card_id;
      b := card_id;
      exit;
    end if;
  end loop;

  if is_challenger then
    update public.duels set
      challenger_card1_rank = a % 10 + 1, challenger_card1_suit = (array['oros','copas','espadas','bastos'])[a / 10 + 1],
      challenger_card2_rank = b % 10 + 1, challenger_card2_suit = (array['oros','copas','espadas','bastos'])[b / 10 + 1]
    where id = target_duel
    returning * into duel;
  else
    update public.duels set
      opponent_card1_rank = a % 10 + 1, opponent_card1_suit = (array['oros','copas','espadas','bastos'])[a / 10 + 1],
      opponent_card2_rank = b % 10 + 1, opponent_card2_suit = (array['oros','copas','espadas','bastos'])[b / 10 + 1]
    where id = target_duel
    returning * into duel;
  end if;

  both_drawn := duel.challenger_card1_rank is not null and duel.opponent_card1_rank is not null;

  if both_drawn then
    challenger_total :=
      (case when duel.challenger_card1_rank <= 7 then duel.challenger_card1_rank else 10 end) +
      (case when duel.challenger_card2_rank <= 7 then duel.challenger_card2_rank else 10 end);
    opponent_total :=
      (case when duel.opponent_card1_rank <= 7 then duel.opponent_card1_rank else 10 end) +
      (case when duel.opponent_card2_rank <= 7 then duel.opponent_card2_rank else 10 end);
    winner := case
      when challenger_total > opponent_total then duel.challenger_id
      when opponent_total > challenger_total then duel.opponent_id
      else null
    end;

    update public.duels set status = 'resolved', resolved_at = now(), winner_id = winner
    where id = target_duel
    returning * into duel;

    insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
    values (
      duel.pool_id, duel.challenger_id, 'personal', 'duel_resolved',
      case when winner = duel.challenger_id then '⚔️ Ganaste tu duelo' when winner is null then '⚔️ Duelo empatado' else '⚔️ Perdiste tu duelo' end,
      case when winner = duel.challenger_id then 'Le quitaste 2 puntos a tu rival.' when winner is null then 'Empate, nadie gana ni pierde puntos.' else 'Tu rival te quito 2 puntos.' end,
      duel.opponent_id, 'duel_resolved_challenger:' || duel.id
    );
    insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
    values (
      duel.pool_id, duel.opponent_id, 'personal', 'duel_resolved',
      case when winner = duel.opponent_id then '⚔️ Ganaste tu duelo' when winner is null then '⚔️ Duelo empatado' else '⚔️ Perdiste tu duelo' end,
      case when winner = duel.opponent_id then 'Le quitaste 2 puntos a tu rival.' when winner is null then 'Empate, nadie gana ni pierde puntos.' else 'Tu rival te quito 2 puntos.' end,
      duel.challenger_id, 'duel_resolved_opponent:' || duel.id
    );
  else
    insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
    values (
      duel.pool_id,
      case when is_challenger then duel.opponent_id else duel.challenger_id end,
      'personal', 'duel_your_turn', '⚔️ Es tu turno', 'Tu rival ya sacó sus cartas. Entrá a sacar las tuyas.',
      auth.uid(), 'duel_your_turn:' || duel.id
    );
  end if;

  return duel;
end;
$$;
grant execute on function public.draw_duel_cards(uuid) to authenticated;

-- "Un duelo activo a la vez" ahora tambien cuenta los aceptados (no solo
-- pendientes), porque un duelo 'accepted' sigue sin resolver.
create or replace function public.create_duel(target_pool uuid, target_opponent uuid)
returns public.duels
language plpgsql
security definer
set search_path = public
as $$
declare
  new_duel public.duels%rowtype;
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

  if exists (
    select 1 from public.duels
    where pool_id = target_pool and status in ('pending', 'accepted')
      and (challenger_id = auth.uid() or opponent_id = auth.uid())
  ) then
    raise exception 'Ya tenes un duelo sin terminar, resolvelo antes de retar de nuevo';
  end if;

  if exists (
    select 1 from public.duels
    where pool_id = target_pool and status in ('pending', 'accepted')
      and (challenger_id = target_opponent or opponent_id = target_opponent)
  ) then
    raise exception 'Ese usuario ya tiene un duelo sin terminar';
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
