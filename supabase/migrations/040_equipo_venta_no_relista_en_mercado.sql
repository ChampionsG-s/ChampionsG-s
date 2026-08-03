-- La equipo_sell_player que estaba viva en produccion no coincidia con
-- ninguna de nuestras migraciones (010/021/035): ademas de calcular el
-- precio de venta con un suelo de 700 y redondeo a la decena (en vez de
-- round(coin_price * 0.65) sin suelo, que es lo que muestra el cliente),
-- justo despues de vender insertaba/reactivaba un listado del jugador en
-- el ciclo de mercado YA abierto -- reapareciendo al instante en el
-- mercado en curso en vez de quedar simplemente disponible para que le
-- toque en un futuro sorteo (que es lo que ya hace equipo_sync_market al
-- elegir jugadores sin dueno). Se quita ese bloque por completo y se deja
-- el precio de venta como en la migracion 035.

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
