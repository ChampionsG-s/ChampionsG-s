-- Quiz de futbol cada 3 jornadas, empezando en la jornada 1 (bloque 1 =
-- jornadas 1-3, bloque 2 = 4-6, ...), completando el patron ya usado por
-- duelos (jornada 2, 5, 8...) y la ruleta regalo (jornada 3, 6, 9...).
-- Misma pregunta para todos los miembros del pool: 4s para leerla, 3s para
-- responder (ambos tiempos se controlan en el cliente). A diferencia de la
-- ruleta (RNG server-side) y los duelos (cartas server-side), aca no hay
-- nada que el servidor deba decidir en secreto: el acierto es una
-- comparacion determinista contra la respuesta correcta, que ya es visible
-- para cualquier miembro autenticado (mismo criterio que las cartas de
-- duelos, visibles apenas se sacan). Por eso no hace falta RPC: el insert
-- lo valida RLS directamente.

create table if not exists public.quiz_questions (
  block_number integer primary key check (block_number > 0),
  question text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_option text not null check (correct_option in ('A', 'B', 'C', 'D')),
  explanation text not null,
  created_at timestamptz not null default now()
);

alter table public.quiz_questions enable row level security;

drop policy if exists "Authenticated read quiz_questions" on public.quiz_questions;
create policy "Authenticated read quiz_questions"
  on public.quiz_questions for select to authenticated
  using (true);

-- Cada acierto suma 1 al contador de aciertos del usuario; cada 2 aciertos
-- acumulados (ver QUIZ_CORRECT_ANSWERS_PER_BONUS en src/lib/quiz.ts) se
-- traducen en +2 puntos de ranking, calculado en computeMemberTotals a
-- partir de is_correct (sin estado adicional que mantener aca).
create table if not exists public.quiz_responses (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  block_number integer not null check (block_number > 0),
  selected_option text not null check (selected_option in ('A', 'B', 'C', 'D')),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (pool_id, user_id, block_number)
);

alter table public.quiz_responses enable row level security;

drop policy if exists "Members read quiz_responses" on public.quiz_responses;
create policy "Members read quiz_responses"
  on public.quiz_responses for select to authenticated
  using (public.is_pool_member(pool_id));

drop policy if exists "Members answer quiz_responses" on public.quiz_responses;
create policy "Members answer quiz_responses"
  on public.quiz_responses for insert to authenticated
  with check (user_id = auth.uid() and public.is_pool_member(pool_id));

-- Pregunta de la jornada 1 (bloque 1).
insert into public.quiz_questions (block_number, question, option_a, option_b, option_c, option_d, correct_option, explanation)
values (
  1,
  '¿Quién fue el primer jugador de nacionalidad no europea en ganar el Balón de Oro (Ballon d''Or)?',
  'Romário',
  'George Weah',
  'Ronaldo Nazário',
  'Ronaldinho',
  'B',
  'En 1995, el liberiano se convirtió en el primer no europeo en recibir el premio tras el cambio en las reglas de elegibilidad.'
)
on conflict (block_number) do nothing;
