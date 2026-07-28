-- Actividad / Notificaciones: dos flujos independientes por pool.
--   scope = 'personal' -> solo lo ve el propio user_id (avisos de jornada cerrada, apuesta guardada)
--   scope = 'global'    -> lo ve cualquier miembro aprobado del pool (alguien se unio, alguien sumo puntos)
--
-- dedupe_key evita duplicados cuando la misma accion se repite (p.ej. el admin corrige un resultado):
-- siempre tiene un valor (nunca null) para poder usar un unique constraint normal, sin indices parciales
-- (las restricciones unicas con NULL no deduplican en Postgres, y los indices parciales no son
-- compatibles con el upsert `on_conflict` de PostgREST/supabase-js).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  scope text not null check (scope in ('personal', 'global')),
  type text not null,
  title text not null,
  body text not null,
  related_match_id uuid references public.matches(id) on delete set null,
  related_user_id uuid references public.users(id) on delete set null,
  dedupe_key text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (pool_id, dedupe_key)
);

create index if not exists notifications_global_feed_idx
  on public.notifications (pool_id, created_at desc)
  where scope = 'global';

create index if not exists notifications_personal_feed_idx
  on public.notifications (pool_id, user_id, created_at desc)
  where scope = 'personal';

alter table public.notifications enable row level security;

drop policy if exists "Members can read global notifications" on public.notifications;
create policy "Members can read global notifications"
  on public.notifications for select to authenticated
  using (
    scope = 'global' and exists (
      select 1 from public.pool_members pm
      where pm.pool_id = notifications.pool_id
        and pm.user_id = auth.uid()
        and pm.status = 'approved'
    )
  );

drop policy if exists "Users can read own personal notifications" on public.notifications;
create policy "Users can read own personal notifications"
  on public.notifications for select to authenticated
  using (scope = 'personal' and user_id = auth.uid());

drop policy if exists "Users can insert own personal notifications" on public.notifications;
create policy "Users can insert own personal notifications"
  on public.notifications for insert to authenticated
  with check (scope = 'personal' and user_id = auth.uid());

drop policy if exists "Users can update own personal notifications" on public.notifications;
create policy "Users can update own personal notifications"
  on public.notifications for update to authenticated
  using (scope = 'personal' and user_id = auth.uid())
  with check (scope = 'personal' and user_id = auth.uid());

drop policy if exists "Admins can insert global notifications" on public.notifications;
create policy "Admins can insert global notifications"
  on public.notifications for insert to authenticated
  with check (
    scope = 'global' and exists (
      select 1 from public.pool_members pm
      where pm.pool_id = notifications.pool_id
        and pm.user_id = auth.uid()
        and pm.role = 'admin'
        and pm.status = 'approved'
    )
  );

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
