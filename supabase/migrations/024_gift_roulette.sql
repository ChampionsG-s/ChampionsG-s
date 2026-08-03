-- Ruleta "regalo" cada 3 jornadas: cada miembro del pool puede girar una vez
-- por cada bloque de 3 jornadas (bloque 1 = jornadas 1-3, bloque 2 = 4-6...).
-- El resultado (+2/+1/0/-1/-2, 20% de probabilidad cada uno) se decide en el
-- servidor para que nadie pueda forzarlo desde el cliente, siguiendo el mismo
-- patron que Equipo: la tabla solo tiene RLS de select, toda escritura pasa
-- por una funcion RPC security definer.

create table if not exists public.gift_spins (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  block_number integer not null check (block_number > 0),
  delta smallint not null check (delta between -2 and 2),
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, block_number)
);

alter table public.gift_spins enable row level security;

drop policy if exists "Members read gift_spins" on public.gift_spins;
create policy "Members read gift_spins"
  on public.gift_spins for select to authenticated
  using (public.is_pool_member(pool_id));

-- Gira la ruleta para el bloque indicado. Falla si el usuario ya giro ese
-- bloque (constraint unique) o si no es miembro del pool. Devuelve el delta.
create or replace function public.gift_spin(target_pool uuid, target_block integer)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  result_delta smallint;
  roll numeric;
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
  if exists (
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

  insert into public.gift_spins (pool_id, user_id, block_number, delta)
  values (target_pool, auth.uid(), target_block, result_delta);

  return result_delta;
end;
$$;
grant execute on function public.gift_spin(uuid, integer) to authenticated;
