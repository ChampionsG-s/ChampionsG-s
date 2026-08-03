-- Bug: no existia forma de retirar una puja del mercado. Una vez pujabas,
-- el dinero quedaba retenido (bid_hold) sin posibilidad de recuperarlo
-- salvo ganando la subasta, siendo superado por otro, o que la carta
-- expirase. equipo_place_bid solo permite AUMENTAR una puja propia (tiene
-- que ser mayor que la actual), nunca cancelarla. Se anade la funcion que
-- faltaba: reembolsa el dinero retenido y borra la puja, siempre que la
-- carta siga abierta en el mercado.

create or replace function public.equipo_cancel_bid(target_listing uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  bid public.equipo_bids%rowtype;
  listing public.equipo_market_listings%rowtype;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  select * into listing from public.equipo_market_listings where id = target_listing for update;
  if not found then
    raise exception 'Jugador no encontrado en el mercado';
  end if;
  if listing.status <> 'open' then
    raise exception 'Este jugador ya no esta en el mercado';
  end if;

  select * into bid from public.equipo_bids
  where listing_id = target_listing and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'No tienes ninguna puja sobre este jugador';
  end if;

  update public.equipo_wallets set balance = balance + bid.amount, updated_at = now()
  where pool_id = listing.pool_id and user_id = auth.uid();

  insert into public.equipo_transactions (pool_id, user_id, type, amount, related_player_id, related_listing_id, dedupe_key)
  values (listing.pool_id, auth.uid(), 'bid_refund', bid.amount, listing.player_id, target_listing, gen_random_uuid()::text);

  delete from public.equipo_bids where id = bid.id;
end;
$$;
grant execute on function public.equipo_cancel_bid(uuid) to authenticated;
