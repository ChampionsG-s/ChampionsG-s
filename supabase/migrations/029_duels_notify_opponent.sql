-- Ademas de notificar al retador cuando se resuelve un duelo, notifica
-- tambien al retado (antes solo el que acepto lo veia en pantalla al
-- instante; si navegaba antes de verlo, se perdia el resultado). Con esto
-- ambos pueden recuperar el resultado despues desde sus notificaciones.
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

  insert into public.notifications (pool_id, user_id, scope, type, title, body, related_user_id, dedupe_key)
  values (
    duel.pool_id, duel.opponent_id, 'personal', 'duel_resolved',
    case when winner = duel.opponent_id then '⚔️ Ganaste tu duelo' when winner is null then '⚔️ Duelo empatado' else '⚔️ Perdiste tu duelo' end,
    case when winner = duel.opponent_id then 'Le quitaste 2 puntos a tu rival.' when winner is null then 'Empate, nadie gana ni pierde puntos.' else 'Tu rival te quito 2 puntos.' end,
    duel.challenger_id, 'duel_resolved_opponent:' || duel.id
  );

  return duel;
end;
$$;
grant execute on function public.respond_duel(uuid, boolean) to authenticated;
