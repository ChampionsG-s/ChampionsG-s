-- El partido bonus ya no arranca "sin elegir": cada jornada que todavia
-- no tenga uno marcado recibe uno aleatorio automaticamente. El admin
-- sigue pudiendo cambiarlo a mano despues (boton "Marcar como bonus" en
-- el panel de admin, que usa toggle_bonus_match).
do $$
declare
  j record;
  picked uuid;
begin
  for j in select distinct jornada from public.matches where jornada is not null loop
    if not exists (
      select 1 from public.matches where jornada = j.jornada and is_bonus = true
    ) then
      select id into picked from public.matches
      where jornada = j.jornada
      order by random()
      limit 1;

      if picked is not null then
        update public.matches set is_bonus = true where id = picked;
      end if;
    end if;
  end loop;
end $$;
