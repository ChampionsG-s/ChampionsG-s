-- Bug: equipo_sell_player calculaba la venta rapida como el 65% de lo que
-- el usuario PAGO por el jugador (purchase_price). Eso deja invendibles de
-- verdad a los jugadores del regalo inicial gratis (purchase_price = 0,
-- 65% de 0 = 0) y no refleja el valor real del jugador si su coin_price ha
-- cambiado desde que se fichó. Ahora la venta rapida se calcula sobre el
-- valor de mercado ACTUAL del jugador (coin_price, el mismo que fija su
-- precio en el mercado), igual que ya hacen el fichaje directo y el
-- "poach" entre usuarios.

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

  return roster;
end;
$$;
grant execute on function public.equipo_sell_player(uuid) to authenticated;
