-- Permite al admin del pool girar la ruleta regalo tantas veces como
-- quiera (para probar la app sin cambiar de usuario). Sus giros NO se
-- guardan en gift_spins ni afectan al ranking: solo devuelven un
-- resultado aleatorio de prueba. Los miembros normales mantienen el
-- limite de un giro por bloque de 3 jornadas.
create or replace function public.gift_spin(target_pool uuid, target_block integer)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  result_delta smallint;
  roll numeric;
  caller_role text;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if target_block <= 0 then
    raise exception 'Bloque invalido';
  end if;

  select role into caller_role from public.pool_members
  where pool_id = target_pool and user_id = auth.uid();

  if caller_role is distinct from 'admin' and exists (
    select 1 from public.gift_spins
    where pool_id = target_pool and user_id = auth.uid() and block_number = target_block
  ) then
    raise exception 'Ya has girado la ruleta de este bloque';
  end if;

  roll := random();
  result_delta := case
    when roll < 0.2 then 2
    when roll < 0.4 then 1
    when roll < 0.6 then 0
    when roll < 0.8 then -1
    else -2
  end;

  if caller_role = 'admin' then
    return result_delta;
  end if;

  insert into public.gift_spins (pool_id, user_id, block_number, delta)
  values (target_pool, auth.uid(), target_block, result_delta);

  return result_delta;
end;
$$;
grant execute on function public.gift_spin(uuid, integer) to authenticated;
