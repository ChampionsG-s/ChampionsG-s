// Quiz de futbol: cada bloque de QUIZ_BLOCK_SIZE jornadas desbloquea una
// pestana extra (al lado de la PRIMERA jornada del bloque, a diferencia de
// la ruleta regalo que va en la ultima) donde todos los miembros del pool
// responden la misma pregunta. 4s para leerla sin poder responder, luego
// QUIZ_ANSWER_SECONDS para elegir una opcion.

export const QUIZ_BLOCK_SIZE = 3
export const QUIZ_READ_SECONDS = 4
export const QUIZ_ANSWER_SECONDS = 3

// Cada QUIZ_CORRECT_ANSWERS_PER_BONUS aciertos acumulados (en distintos
// bloques) otorgan QUIZ_BONUS_POINTS puntos de ranking de una sola vez.
export const QUIZ_CORRECT_ANSWERS_PER_BONUS = 2
export const QUIZ_BONUS_POINTS = 2

export type QuizOption = 'A' | 'B' | 'C' | 'D'

// Dado el numero de una jornada (1-indexado), a que bloque de quiz
// pertenece (bloque 1 = jornadas 1-3, bloque 2 = 4-6, ...).
export function quizBlockForJornadaNumber(jornadaNumber: number): number {
  return Math.floor((jornadaNumber - 1) / QUIZ_BLOCK_SIZE) + 1
}

// True si esta es la primera jornada de su bloque (donde debe aparecer la
// pestana de quiz justo despues).
export function isFirstJornadaOfQuizBlock(jornadaNumber: number): boolean {
  return (jornadaNumber - 1) % QUIZ_BLOCK_SIZE === 0
}

// Puntos de ranking ganados por aciertos de quiz: se otorgan de a
// QUIZ_BONUS_POINTS cada vez que se completan QUIZ_CORRECT_ANSWERS_PER_BONUS
// aciertos (los aciertos "sueltos" que no completan el siguiente bloque de
// 2 quedan pendientes hasta el proximo acierto).
export function quizRankingBonus(correctCount: number): number {
  return Math.floor(correctCount / QUIZ_CORRECT_ANSWERS_PER_BONUS) * QUIZ_BONUS_POINTS
}
