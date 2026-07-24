-- Permite ver las predicciones de otros miembros de la porra una vez que la
-- jornada de ese partido ya ha cerrado (fecha del primer partido de la
-- jornada ya pasada), sustituyendo el mecanismo antiguo basado en
-- locked_matches (columna que ya no se usa / no existe en produccion).

create or replace function public.jornada_deadline(target_jornada integer)
returns timestamptz
language sql
stable
as $$
  select min(match_date) from public.matches where jornada = target_jornada;
$$;

drop policy if exists "Members can read revealed predictions" on public.predictions;
create policy "Members can read revealed predictions"
  on public.predictions for select
  to authenticated
  using (
    exists (
      select 1 from public.pool_members me
      where me.pool_id = predictions.pool_id
        and me.user_id = auth.uid()
        and me.status = 'approved'
    )
    and exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and m.jornada is not null
        and now() >= public.jornada_deadline(m.jornada)
    )
  );
