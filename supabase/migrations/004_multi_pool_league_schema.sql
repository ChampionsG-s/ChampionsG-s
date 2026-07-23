create extension if not exists pgcrypto;

-- Pools
create table if not exists public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.users(id) on delete cascade,
  require_approval boolean not null default false,
  created_at timestamptz not null default now()
);

-- Pool members
create table if not exists public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  locked_matches boolean not null default false,
  locked_spain boolean not null default false,
  locked_awards boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (pool_id, user_id)
);

-- Matches (global fixture list)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  match_number integer not null unique,
  group_name text,
  home text not null,
  away text not null,
  date text not null,
  phase text not null default 'grupos',
  pts_exact integer not null default 3,
  pts_winner integer not null default 1,
  created_at timestamptz not null default now()
);

-- Per-pool real team assignments for bracket style views
create table if not exists public.pool_match_teams (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  real_home text,
  real_away text,
  unique (pool_id, match_id)
);

-- Per-pool final scores
create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0 and home_score <= 30),
  away_score integer not null check (away_score >= 0 and away_score <= 30),
  source text not null default 'manual' check (source in ('manual', 'api')),
  updated_at timestamptz not null default now(),
  unique (pool_id, match_id)
);

-- Per-user match predictions by pool
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  home_score integer not null check (home_score >= 0 and home_score <= 30),
  away_score integer not null check (away_score >= 0 and away_score <= 30),
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, match_id)
);

-- Per-pool open/closed jornadas (stored in phase for compatibility)
create table if not exists public.pool_open_phases (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  phase text not null,
  is_open boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (pool_id, phase)
);

-- Legacy-compatible tables still referenced in parts of the app
create table if not exists public.pool_spain_squad (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  name text not null,
  unique (pool_id, name)
);

create table if not exists public.award_predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  award_id text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, award_id)
);

create table if not exists public.spain_predictions (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  field_id text not null,
  value text not null,
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, field_id)
);

create table if not exists public.platform_admins (
  id uuid primary key references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.global_award_results (
  id uuid primary key default gen_random_uuid(),
  award_id text unique not null,
  value text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.global_spain_results (
  id uuid primary key default gen_random_uuid(),
  field_id text unique not null,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Reconcile legacy tables when they already exist with old structure.
alter table public.results add column if not exists pool_id uuid;
alter table public.predictions add column if not exists pool_id uuid;
alter table public.award_predictions add column if not exists pool_id uuid;
alter table public.spain_predictions add column if not exists pool_id uuid;

alter table public.results drop constraint if exists results_match_id_key;
alter table public.predictions drop constraint if exists predictions_user_id_match_id_key;
alter table public.award_predictions drop constraint if exists award_predictions_user_id_award_id_key;
alter table public.spain_predictions drop constraint if exists spain_predictions_user_id_field_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'results_pool_id_fkey'
  ) then
    alter table public.results
      add constraint results_pool_id_fkey
      foreign key (pool_id) references public.pools(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'predictions_pool_id_fkey'
  ) then
    alter table public.predictions
      add constraint predictions_pool_id_fkey
      foreign key (pool_id) references public.pools(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'award_predictions_pool_id_fkey'
  ) then
    alter table public.award_predictions
      add constraint award_predictions_pool_id_fkey
      foreign key (pool_id) references public.pools(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'spain_predictions_pool_id_fkey'
  ) then
    alter table public.spain_predictions
      add constraint spain_predictions_pool_id_fkey
      foreign key (pool_id) references public.pools(id) on delete cascade;
  end if;
end $$;

create unique index if not exists results_pool_id_match_id_key
  on public.results(pool_id, match_id);

create unique index if not exists predictions_pool_id_user_id_match_id_key
  on public.predictions(pool_id, user_id, match_id);

create unique index if not exists award_predictions_pool_id_user_id_award_id_key
  on public.award_predictions(pool_id, user_id, award_id);

create unique index if not exists spain_predictions_pool_id_user_id_field_id_key
  on public.spain_predictions(pool_id, user_id, field_id);

-- Helper to check if current user belongs to a pool
create or replace function public.is_pool_member(target_pool uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = target_pool
      and pm.user_id = auth.uid()
      and pm.status = 'approved'
  );
$$;

-- Generate short invite codes
create or replace function public.generate_invite_code(code_length int default 6)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  output text := '';
  i int;
begin
  for i in 1..code_length loop
    output := output || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  end loop;
  return output;
end;
$$;

-- RPC: create a pool and auto-join creator as admin
create or replace function public.create_pool(pool_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  new_pool_id uuid;
  code text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  loop
    code := public.generate_invite_code(6);
    begin
      insert into public.pools (name, invite_code, created_by)
      values (trim(pool_name), code, auth.uid())
      returning id into new_pool_id;
      exit;
    exception when unique_violation then
      -- retry code generation
    end;
  end loop;

  insert into public.pool_members (pool_id, user_id, role, status)
  values (new_pool_id, auth.uid(), 'admin', 'approved')
  on conflict (pool_id, user_id) do update
  set role = 'admin', status = 'approved';

  return json_build_object('id', new_pool_id, 'invite_code', code);
end;
$$;

-- RPC: join pool by invite code
create or replace function public.join_pool(code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  target_pool public.pools%rowtype;
  existing public.pool_members%rowtype;
  final_status text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into target_pool
  from public.pools
  where upper(invite_code) = upper(trim(code));

  if target_pool.id is null then
    raise exception 'Codigo no valido';
  end if;

  select * into existing
  from public.pool_members
  where pool_id = target_pool.id
    and user_id = auth.uid();

  if existing.id is not null then
    return json_build_object('pool_id', target_pool.id, 'status', existing.status);
  end if;

  final_status := case when target_pool.require_approval then 'pending' else 'approved' end;

  insert into public.pool_members (pool_id, user_id, role, status)
  values (target_pool.id, auth.uid(), 'member', final_status);

  return json_build_object('pool_id', target_pool.id, 'status', final_status);
end;
$$;

-- RLS setup
alter table public.pools enable row level security;
alter table public.pool_members enable row level security;
alter table public.matches enable row level security;
alter table public.pool_match_teams enable row level security;
alter table public.results enable row level security;
alter table public.predictions enable row level security;
alter table public.pool_open_phases enable row level security;
alter table public.pool_spain_squad enable row level security;
alter table public.award_predictions enable row level security;
alter table public.spain_predictions enable row level security;
alter table public.platform_admins enable row level security;
alter table public.global_award_results enable row level security;
alter table public.global_spain_results enable row level security;

-- Pools policies
 drop policy if exists "Members can read pools" on public.pools;
create policy "Members can read pools"
  on public.pools for select to authenticated
  using (public.is_pool_member(id));

 drop policy if exists "Authenticated can create pools" on public.pools;
create policy "Authenticated can create pools"
  on public.pools for insert to authenticated
  with check (created_by = auth.uid());

-- Pool members policies
 drop policy if exists "Members can read pool_members" on public.pool_members;
create policy "Members can read pool_members"
  on public.pool_members for select to authenticated
  using (user_id = auth.uid() or public.is_pool_member(pool_id));

 drop policy if exists "Users can insert own membership" on public.pool_members;
create policy "Users can insert own membership"
  on public.pool_members for insert to authenticated
  with check (user_id = auth.uid());

 drop policy if exists "Users update own membership" on public.pool_members;
create policy "Users update own membership"
  on public.pool_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

 drop policy if exists "Pool admins update memberships" on public.pool_members;
create policy "Pool admins update memberships"
  on public.pool_members for update to authenticated
  using (
    exists (
      select 1
      from public.pool_members me
      where me.pool_id = pool_members.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  );

-- Matches and related read access
 drop policy if exists "Authenticated can read matches" on public.matches;
create policy "Authenticated can read matches"
  on public.matches for select to authenticated
  using (true);

 drop policy if exists "Members can read pool_match_teams" on public.pool_match_teams;
create policy "Members can read pool_match_teams"
  on public.pool_match_teams for select to authenticated
  using (public.is_pool_member(pool_id));

 drop policy if exists "Pool admins manage pool_match_teams" on public.pool_match_teams;
create policy "Pool admins manage pool_match_teams"
  on public.pool_match_teams for all to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_match_teams.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_match_teams.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  );

-- Results policies
 drop policy if exists "Members can read results" on public.results;
create policy "Members can read results"
  on public.results for select to authenticated
  using (public.is_pool_member(pool_id));

 drop policy if exists "Pool admins manage results" on public.results;
create policy "Pool admins manage results"
  on public.results for all to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = results.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = results.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  );

-- Predictions policies
 drop policy if exists "Users can read own predictions" on public.predictions;
create policy "Users can read own predictions"
  on public.predictions for select to authenticated
  using (user_id = auth.uid());

 drop policy if exists "Locked users can compare predictions" on public.predictions;
create policy "Locked users can compare predictions"
  on public.predictions for select to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = predictions.pool_id
        and me.user_id = auth.uid()
        and me.status = 'approved'
        and me.locked_matches = true
    )
    and exists (
      select 1 from public.pool_members other
      where other.pool_id = predictions.pool_id
        and other.user_id = predictions.user_id
        and other.status = 'approved'
        and other.locked_matches = true
    )
  );

 drop policy if exists "Users can insert own predictions when unlocked" on public.predictions;
create policy "Users can insert own predictions when unlocked"
  on public.predictions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members me
      where me.pool_id = predictions.pool_id
        and me.user_id = auth.uid()
        and me.status = 'approved'
        and me.locked_matches = false
    )
  );

 drop policy if exists "Users can update own predictions when unlocked" on public.predictions;
create policy "Users can update own predictions when unlocked"
  on public.predictions for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.pool_members me
      where me.pool_id = predictions.pool_id
        and me.user_id = auth.uid()
        and me.status = 'approved'
        and me.locked_matches = false
    )
  )
  with check (
    user_id = auth.uid()
  );

-- Pool open phases policies
 drop policy if exists "Members can read pool_open_phases" on public.pool_open_phases;
create policy "Members can read pool_open_phases"
  on public.pool_open_phases for select to authenticated
  using (public.is_pool_member(pool_id));

 drop policy if exists "Pool admins manage pool_open_phases" on public.pool_open_phases;
create policy "Pool admins manage pool_open_phases"
  on public.pool_open_phases for all to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_open_phases.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_open_phases.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  );

-- Legacy tables: basic compatible policies
 drop policy if exists "Members read pool_spain_squad" on public.pool_spain_squad;
create policy "Members read pool_spain_squad"
  on public.pool_spain_squad for select to authenticated
  using (public.is_pool_member(pool_id));

 drop policy if exists "Pool admins manage pool_spain_squad" on public.pool_spain_squad;
create policy "Pool admins manage pool_spain_squad"
  on public.pool_spain_squad for all to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_spain_squad.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  )
  with check (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = pool_spain_squad.pool_id
        and me.user_id = auth.uid()
        and me.role = 'admin'
        and me.status = 'approved'
    )
  );

 drop policy if exists "Users manage own award_predictions" on public.award_predictions;
create policy "Users manage own award_predictions"
  on public.award_predictions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

 drop policy if exists "Users manage own spain_predictions" on public.spain_predictions;
create policy "Users manage own spain_predictions"
  on public.spain_predictions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

 drop policy if exists "Anyone can read platform_admins" on public.platform_admins;
create policy "Anyone can read platform_admins"
  on public.platform_admins for select
  to authenticated
  using (true);

 drop policy if exists "Anyone can read global_award_results" on public.global_award_results;
create policy "Anyone can read global_award_results"
  on public.global_award_results for select to authenticated
  using (true);

 drop policy if exists "Anyone can read global_spain_results" on public.global_spain_results;
create policy "Anyone can read global_spain_results"
  on public.global_spain_results for select to authenticated
  using (true);

-- Keep award/spain global writes to platform admins only
 drop policy if exists "Platform admins manage global_award_results" on public.global_award_results;
create policy "Platform admins manage global_award_results"
  on public.global_award_results for all to authenticated
  using (exists (select 1 from public.platform_admins pa where pa.id = auth.uid()))
  with check (exists (select 1 from public.platform_admins pa where pa.id = auth.uid()));

 drop policy if exists "Platform admins manage global_spain_results" on public.global_spain_results;
create policy "Platform admins manage global_spain_results"
  on public.global_spain_results for all to authenticated
  using (exists (select 1 from public.platform_admins pa where pa.id = auth.uid()))
  with check (exists (select 1 from public.platform_admins pa where pa.id = auth.uid()));

-- Realtime publication (idempotent style)
do $$
begin
  begin alter publication supabase_realtime add table public.pool_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pool_open_phases; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.results; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.pool_match_teams; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.predictions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.global_award_results; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.global_spain_results; exception when duplicate_object then null; end;
end $$;

-- Minimal seed for quick testing when table is empty
insert into public.matches (match_number, group_name, home, away, date, phase, pts_exact, pts_winner)
select * from (
  values
    (1, 'Jornada 1', 'Real Madrid', 'FC Barcelona', '2026-08-15T20:00:00Z', 'grupos', 3, 1),
    (2, 'Jornada 1', 'Atletico de Madrid', 'Sevilla', '2026-08-16T18:00:00Z', 'grupos', 3, 1),
    (3, 'Jornada 1', 'Valencia', 'Real Betis', '2026-08-16T20:30:00Z', 'grupos', 3, 1),
    (4, 'Jornada 1', 'Athletic Club', 'Real Sociedad', '2026-08-17T17:00:00Z', 'grupos', 3, 1),
    (5, 'Jornada 1', 'Villarreal', 'Getafe', '2026-08-17T19:15:00Z', 'grupos', 3, 1),
    (6, 'Jornada 1', 'Girona', 'Rayo Vallecano', '2026-08-17T21:30:00Z', 'grupos', 3, 1),
    (7, 'Jornada 1', 'Osasuna', 'Celta de Vigo', '2026-08-18T17:00:00Z', 'grupos', 3, 1),
    (8, 'Jornada 1', 'Mallorca', 'Las Palmas', '2026-08-18T19:15:00Z', 'grupos', 3, 1),
    (9, 'Jornada 1', 'Alaves', 'Leganes', '2026-08-18T21:30:00Z', 'grupos', 3, 1),
    (10, 'Jornada 1', 'Espanyol', 'Real Valladolid', '2026-08-19T20:00:00Z', 'grupos', 3, 1)
) as seed(match_number, group_name, home, away, date, phase, pts_exact, pts_winner)
where not exists (select 1 from public.matches);
