-- El "minimo 6 garantizado" (migracion 015) se disparaba en equipo_ensure_wallet,
-- que se llama en CADA carga de la pagina de Equipo. Eso significaba que si
-- vendias tu unico jugador de una posicion, en la siguiente carga de pagina
-- se te asignaba automaticamente un reemplazo gratis sin pedir permiso.
-- A partir de ahora equipo_topup_squad solo se ejecuta la primera vez que se
-- crea la wallet (regalo inicial de plantilla), nunca despues: si vendes y te
-- quedas sin nadie en una posicion, te quedas sin nadie — el aviso en el
-- cliente (my-squad-player-modal.tsx) es lo que ahora protege de un error.

create or replace function public.equipo_ensure_wallet(target_pool uuid)
returns public.equipo_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
  inserted_count integer;
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

  get diagnostics inserted_count = row_count;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, dedupe_key)
  values (target_pool, auth.uid(), 'initial_grant', 10000, 'initial_grant:' || auth.uid())
  on conflict (pool_id, dedupe_key) do nothing;

  if inserted_count > 0 then
    perform public.equipo_topup_squad(target_pool, auth.uid());
  end if;

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;
