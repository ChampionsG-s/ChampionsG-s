-- Evita que el mismo partido de una jornada pueda insertarse dos veces
-- (ocurrio en el seed inicial: 30 partidos duplicados, limpiados a mano).

create unique index if not exists matches_unique_jornada_match_number
  on public.matches (jornada, match_number)
  where jornada is not null;
