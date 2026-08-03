-- El limite de "una vez cada 14 dias" para retar se reemplaza: ahora el
-- reto solo se puede hacer mientras la jornada de su bloque (2, 5, 8...)
-- esta abierta (eso ya lo controla el cliente, igual que la ruleta
-- regalo). Se quita la restriccion de tiempo del lado del servidor.
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
    where pool_id = target_pool and status = 'pending'
      and ((challenger_id = auth.uid() and opponent_id = target_opponent)
        or (challenger_id = target_opponent and opponent_id = auth.uid()))
  ) then
    raise exception 'Ya hay un duelo pendiente con ese usuario';
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
