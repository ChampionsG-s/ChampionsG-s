-- Anade una tercera formacion (2-2-1: 2 defensas, 2 centrocampistas,
-- 1 delantero) a Equipo, junto a las ya existentes 1-2-2 y 2-1-2.
-- Hay que tocar cada sitio que antes asumia solo dos formaciones posibles
-- con un simple if/else binario.

alter table public.equipo_wallets drop constraint if exists equipo_wallets_formation_check;
alter table public.equipo_wallets
  add constraint equipo_wallets_formation_check check (formation in ('1-2-2', '2-1-2', '2-2-1'));

-- Reparte aleatoriamente entre las 3 formaciones al crear la wallet.
create or replace function public.equipo_ensure_wallet(target_pool uuid)
returns public.equipo_wallets
language plpgsql
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
  formations text[] := array['1-2-2', '2-1-2', '2-2-1'];
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;

  insert into public.equipo_wallets (pool_id, user_id, balance, formation)
  values (target_pool, auth.uid(), 10000, formations[1 + floor(random() * 3)::int])
  on conflict (pool_id, user_id) do nothing;

  insert into public.equipo_transactions (pool_id, user_id, type, amount, dedupe_key)
  values (target_pool, auth.uid(), 'initial_grant', 10000, 'initial_grant:' || auth.uid())
  on conflict (pool_id, dedupe_key) do nothing;

  perform public.equipo_topup_squad(target_pool, auth.uid());

  select * into wallet from public.equipo_wallets
  where pool_id = target_pool and user_id = auth.uid();

  return wallet;
end;
$$;
grant execute on function public.equipo_ensure_wallet(uuid) to authenticated;

-- Cupos por posicion segun la formacion (portero siempre 1).
create or replace function public.equipo_bucket_has_room(target_pool uuid, target_user uuid, want_position smallint)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wallet public.equipo_wallets%rowtype;
  bucket_limit integer;
  bucket_count integer;
begin
  select * into wallet from public.equipo_wallets where pool_id = target_pool and user_id = target_user;

  bucket_limit := case want_position
    when 1 then 1
    when 2 then case wallet.formation when '2-1-2' then 2 when '2-2-1' then 2 else 1 end
    when 3 then case wallet.formation when '2-1-2' then 1 when '2-2-1' then 2 else 2 end
    when 4 then case wallet.formation when '2-2-1' then 1 else 2 end
    else 0
  end;

  select count(*) into bucket_count
  from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned'
    and r.is_starter = true and bp.position = want_position;

  return bucket_count < bucket_limit;
end;
$$;
grant execute on function public.equipo_bucket_has_room(uuid, uuid, smallint) to authenticated;

-- Regalo inicial / relleno de plantilla: cupos por posicion segun formacion.
create or replace function public.equipo_topup_squad(target_pool uuid, target_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_formation text;
  def_count integer;
  med_count integer;
  del_count integer;
  cur_jornada integer;
  current_count integer;
  pick record;
begin
  select formation into chosen_formation from public.equipo_wallets
  where pool_id = target_pool and user_id = target_user;

  if chosen_formation is null then
    return;
  end if;

  if chosen_formation = '2-1-2' then
    def_count := 2; med_count := 1; del_count := 2;
  elsif chosen_formation = '2-2-1' then
    def_count := 2; med_count := 2; del_count := 1;
  else
    def_count := 1; med_count := 2; del_count := 2;
  end if;

  cur_jornada := public.equipo_current_jornada();

  -- Portero
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 1;

  if current_count < 1 then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 1
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (5 * (1 - current_count))
    loop
      exit when current_count >= 1;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < 1 then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 1
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (1 - current_count))
      loop
        exit when current_count >= 1;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;

  -- Defensas
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 2;

  if current_count < def_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 2
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (5 * (def_count - current_count))
    loop
      exit when current_count >= def_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < def_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 2
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (def_count - current_count))
      loop
        exit when current_count >= def_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;

  -- Centrocampistas
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 3;

  if current_count < med_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 3
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (5 * (med_count - current_count))
    loop
      exit when current_count >= med_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < med_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 3
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (med_count - current_count))
      loop
        exit when current_count >= med_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;

  -- Delanteros
  select count(*) into current_count from public.equipo_roster r
  join public.biwenger_players bp on bp.id = r.player_id
  where r.pool_id = target_pool and r.user_id = target_user and r.status = 'owned' and bp.position = 4;

  if current_count < del_count then
    for pick in
      select bp.* from public.biwenger_players bp
      where bp.position = 4
        and greatest(700, round(bp.coin_price * 1.5 / 10) * 10) <= 5000
        and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
      order by random() limit (5 * (del_count - current_count))
    loop
      exit when current_count >= del_count;
      begin
        insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
        values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
        current_count := current_count + 1;
        perform public.equipo_expire_listings_for_player(target_pool, pick.id);
      exception when unique_violation then
        null;
      end;
    end loop;

    if current_count < del_count then
      for pick in
        select bp.* from public.biwenger_players bp
        where bp.position = 4
          and not exists (select 1 from public.equipo_roster r2 where r2.pool_id = target_pool and r2.player_id = bp.id and r2.status = 'owned')
        order by random() limit (5 * (del_count - current_count))
      loop
        exit when current_count >= del_count;
        begin
          insert into public.equipo_roster (pool_id, user_id, player_id, acquired_via, purchase_price, points_at_acquisition, acquired_jornada, is_starter)
          values (target_pool, target_user, pick.id, 'starter', 0, coalesce(pick.season_points, 0), cur_jornada, true);
          current_count := current_count + 1;
          perform public.equipo_expire_listings_for_player(target_pool, pick.id);
        exception when unique_violation then
          null;
        end;
      end loop;
    end if;
  end if;
end;
$$;
grant execute on function public.equipo_topup_squad(uuid, uuid) to authenticated;

-- equipo_set_formation: valida y reconcilia titulares para las 3 formaciones.
create or replace function public.equipo_set_formation(target_pool uuid, target_formation text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  def_quota integer;
  med_quota integer;
  del_quota integer;
  excess record;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not public.is_pool_member(target_pool) then
    raise exception 'No autorizado';
  end if;
  if target_formation not in ('1-2-2', '2-1-2', '2-2-1') then
    raise exception 'Formacion no valida';
  end if;

  update public.equipo_wallets
  set formation = target_formation, updated_at = now()
  where pool_id = target_pool and user_id = auth.uid();

  if target_formation = '2-1-2' then
    def_quota := 2; med_quota := 1; del_quota := 2;
  elsif target_formation = '2-2-1' then
    def_quota := 2; med_quota := 2; del_quota := 1;
  else
    def_quota := 1; med_quota := 2; del_quota := 2;
  end if;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 2
    order by r.acquired_at asc
    offset def_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 3
    order by r.acquired_at asc
    offset med_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;

  for excess in
    select r.id
    from public.equipo_roster r
    join public.biwenger_players bp on bp.id = r.player_id
    where r.pool_id = target_pool and r.user_id = auth.uid()
      and r.status = 'owned' and r.is_starter and bp.position = 4
    order by r.acquired_at asc
    offset del_quota
  loop
    update public.equipo_roster set is_starter = false where id = excess.id;
  end loop;
end;
$$;
grant execute on function public.equipo_set_formation(uuid, text) to authenticated;
