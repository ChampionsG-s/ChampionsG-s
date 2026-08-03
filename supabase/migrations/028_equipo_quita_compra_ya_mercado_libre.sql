-- "Compra ya" en el mercado libre (jugadores sin dueno, listados por
-- equipo_sync_market) se elimina como opcion: ahi solo se puede pujar.
-- El "compra ya" sigue existiendo, pero unicamente para quitarle un
-- jugador a otro usuario (equipo_poach_player, ya con su propio precio
-- 1.5x y bloqueo de 2 jornadas). Se bloquea equipo_direct_buy en el
-- servidor -- no basta con quitar el boton del cliente, cualquiera
-- podria seguir llamando a la RPC directamente.

create or replace function public.equipo_direct_buy(target_listing uuid)
returns public.equipo_roster
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'La compra directa ya no esta disponible en el mercado libre. Puja por el jugador, o fichalo directamente si ya tiene dueno (otro usuario).';
end;
$$;
grant execute on function public.equipo_direct_buy(uuid) to authenticated;
