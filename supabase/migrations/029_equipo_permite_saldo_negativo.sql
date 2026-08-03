-- Nueva regla de juego: fichar a un jugador de otro usuario (compra ya
-- entre usuarios) ya no se bloquea por falta de saldo -- se permite que
-- el saldo quede en 0 o negativo. Mientras el saldo siga en 0 o negativo,
-- el usuario no puntua en el ranking de Equipo ni cobra el premio semanal
-- (equipo_grant_jornada_rewards), hasta que venda algun jugador y vuelva
-- a saldo positivo.

alter table public.equipo_wallets drop constraint if exists equipo_wallets_balance_check;

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

  perform public.equipo_expire_listings_for_player(seller_roster.pool_id, seller_roster.player_id);

  return new_roster;
end;
$$;
grant execute on function public.equipo_poach_player(uuid) to authenticated;

-- Un usuario con saldo <= 0 queda fuera del ranking de Equipo por completo:
-- no suma puntos y no ocupa puesto (para que los demas no se vean
-- perjudicados por su ausencia), asi que tampoco entra en el reparto de
-- premios de equipo_grant_jornada_rewards (que se apoya en esta funcion).
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
  join public.equipo_wallets w on w.pool_id = r.pool_id and w.user_id = r.user_id and w.balance > 0
  left join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool
  group by r.user_id;
$$;
grant execute on function public.equipo_jornada_ranking(uuid, integer) to authenticated;
