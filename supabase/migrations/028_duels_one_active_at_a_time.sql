-- Un usuario solo puede tener UN duelo pendiente a la vez, ya sea como
-- retador o como retado. No podes retar si ya tenes un duelo sin resolver,
-- ni retar a alguien que ya tiene uno sin resolver.
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
      and (challenger_id = auth.uid() or opponent_id = auth.uid())
  ) then
    raise exception 'Ya tenes un duelo pendiente, resolvelo antes de retar de nuevo';
  end if;

  if exists (
    select 1 from public.duels
    where pool_id = target_pool and status = 'pending'
      and (challenger_id = target_opponent or opponent_id = target_opponent)
  ) then
    raise exception 'Ese usuario ya tiene un duelo pendiente';
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
