'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Brain } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { QUIZ_READ_SECONDS, QUIZ_ANSWER_SECONDS, QUIZ_CORRECT_ANSWERS_PER_BONUS, QUIZ_BONUS_POINTS } from '@/lib/quiz'
import { cn } from '@/lib/utils'
import type { QuizQuestion, QuizOptionLetter, QuizResponse } from '@/types'

const OPTION_LETTERS: QuizOptionLetter[] = ['A', 'B', 'C', 'D']

type Phase = 'reading' | 'answering' | 'result'

interface QuizModalProps {
  poolId: string
  currentUserId: string
  block: number
  question: QuizQuestion | null
  existingResponse: QuizResponse | null
  unlocked: boolean
  isAdmin?: boolean
  quizPoints: number
  onClose: () => void
  onAnswered: (response: QuizResponse) => void
}

// Progreso dentro del ciclo de QUIZ_CORRECT_ANSWERS_PER_BONUS aciertos: 0,
// 1, 2, 1, 2... (al llegar al tope se "reinicia" visualmente en el
// siguiente acierto, igual que quizRankingBonus calcula el bonus real).
function cycleProgress(totalCorrect: number): number {
  const mod = totalCorrect % QUIZ_CORRECT_ANSWERS_PER_BONUS
  return mod === 0 && totalCorrect > 0 ? QUIZ_CORRECT_ANSWERS_PER_BONUS : mod
}

// Quiz de futbol: 4s solo para leer la pregunta (los botones de respuesta
// estan deshabilitados), despues QUIZ_ANSWER_SECONDS para elegir una
// opcion. Si el tiempo se acaba sin elegir, cuenta como fallo. El acierto
// es una comparacion determinista (no hay RNG que proteger, a diferencia
// de la ruleta regalo o los duelos), asi que se inserta directo en
// quiz_responses -- RLS valida que sea el propio usuario y que no haya
// respondido antes. El admin puede jugar sin restricciones (jornada
// bloqueada, pregunta ya respondida) para probar la mecanica: sus intentos
// nunca se guardan ni afectan el ranking, igual que los giros ilimitados
// de la ruleta regalo (ver migracion 020).
export function QuizModal({ poolId, currentUserId, block, question, existingResponse, unlocked, isAdmin, quizPoints, onClose, onAnswered }: QuizModalProps) {
  const supabase = createClient()
  const router = useRouter()
  const effectivelyUnlocked = unlocked || !!isAdmin
  const startsAnswered = !!existingResponse && !isAdmin
  const [phase, setPhase] = useState<Phase>(startsAnswered ? 'result' : 'reading')
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_READ_SECONDS)
  const [selected, setSelected] = useState<QuizOptionLetter | null>(startsAnswered ? existingResponse!.selected_option : null)
  const [displayTotal, setDisplayTotal] = useState(quizPoints)
  const [justEarnedBonus, setJustEarnedBonus] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submittedRef = useRef(false)

  useEffect(() => {
    if (phase === 'result' || !effectivelyUnlocked || !question) return

    if (phase === 'reading') {
      if (secondsLeft <= 0) {
        setPhase('answering')
        setSecondsLeft(QUIZ_ANSWER_SECONDS)
        return
      }
      const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
      return () => clearTimeout(t)
    }

    if (phase === 'answering') {
      if (secondsLeft <= 0) {
        handleSubmit(null)
        return
      }
      const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft, effectivelyUnlocked, question])

  const handleSubmit = async (chosen: QuizOptionLetter | null) => {
    if (submittedRef.current || !question) return
    submittedRef.current = true
    setSubmitting(true)
    setError(null)

    // Sin eleccion (se acabo el tiempo) cuenta como fallo: guardamos la
    // primera opcion incorrecta disponible para respetar el check de la
    // columna sin afectar el resultado mostrado al usuario.
    const isTimeout = chosen === null
    const effectiveChoice = chosen ?? OPTION_LETTERS.find(l => l !== question.correct_option)!
    const isCorrect = !isTimeout && chosen === question.correct_option

    setSelected(isTimeout ? null : chosen)
    setTimedOut(isTimeout)

    const newTotal = displayTotal + (isCorrect ? 1 : 0)
    setDisplayTotal(newTotal)
    setJustEarnedBonus(isCorrect && newTotal > 0 && newTotal % QUIZ_CORRECT_ANSWERS_PER_BONUS === 0)

    if (isAdmin) {
      setSubmitting(false)
      setPhase('result')
      return
    }

    const { data, error: insertError } = await supabase
      .from('quiz_responses')
      .insert({
        pool_id: poolId,
        user_id: currentUserId,
        block_number: block,
        selected_option: effectiveChoice,
        is_correct: isCorrect,
      })
      .select('*')
      .single()

    setSubmitting(false)

    if (insertError || !data) {
      setError(insertError?.message ?? 'Error al guardar tu respuesta.')
      setPhase('result')
      return
    }

    setPhase('result')
    onAnswered(data as QuizResponse)
    router.refresh()
  }

  const handleReplayAsAdmin = () => {
    submittedRef.current = false
    setSelected(null)
    setError(null)
    setJustEarnedBonus(false)
    setTimedOut(false)
    setSecondsLeft(QUIZ_READ_SECONDS)
    setPhase('reading')
  }

  const correctLetter = question?.correct_option ?? null
  const optionText = (letter: QuizOptionLetter) =>
    question ? question[`option_${letter.toLowerCase()}` as 'option_a'] : ''
  const headerProgress = phase === 'result' ? displayTotal : quizPoints

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5">
          <h3 className="font-display text-lg tracking-wide text-cream flex items-center gap-2">
            <Brain size={20} className="text-gold" /> Quiz
          </h3>
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-gold border border-gold/40 bg-gold/10 rounded-full px-2.5 py-1">
              🧠 {cycleProgress(headerProgress)}/{QUIZ_CORRECT_ANSWERS_PER_BONUS} aciertos
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {!effectivelyUnlocked ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🔒</p>
              <p className="font-display text-lg text-cream">Aún no puedes jugar</p>
              <p className="text-xs text-muted px-4">
                El quiz se desbloquea cuando esta jornada esté abierta para apostar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : !question ? (
          <div className="p-4 space-y-4">
            <div className="rounded-xl border border-border bg-black/25 py-8 text-center space-y-2">
              <p className="text-3xl">🚧</p>
              <p className="font-display text-lg text-cream">Sin pregunta todavía</p>
              <p className="text-xs text-muted px-4">Vuelve más tarde, esta pregunta aún no está lista.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {isAdmin && (
              <p className="text-[10px] font-bold uppercase tracking-wide text-red-300 bg-red-900/20 border border-red-900/50 rounded-lg px-2.5 py-1.5 text-center">
                Modo admin: no se guarda ni afecta al ranking
              </p>
            )}

            {phase !== 'result' && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {phase === 'reading' ? 'Lee la pregunta' : '¡Elige tu respuesta!'}
                </span>
                <span
                  className={cn(
                    'font-display text-2xl tabular-nums px-3 rounded-lg',
                    phase === 'answering' ? 'text-red-400 animate-pulse' : 'text-gold'
                  )}
                >
                  {secondsLeft}s
                </span>
              </div>
            )}

            <p className="text-sm font-semibold text-cream leading-snug">{question.question}</p>

            <div className="space-y-2">
              {OPTION_LETTERS.map(letter => {
                const isCorrectOption = phase === 'result' && letter === correctLetter
                const isWrongPick = phase === 'result' && selected === letter && letter !== correctLetter
                const isMyPick = phase === 'result' && selected === letter
                return (
                  <div key={letter}>
                    <button
                      type="button"
                      disabled={phase !== 'answering' || submitting}
                      onClick={() => handleSubmit(letter)}
                      className={cn(
                        'w-full text-left px-3.5 py-2.5 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2.5',
                        phase === 'answering' && 'border-border text-cream hover:border-gold active:scale-[0.98]',
                        phase === 'reading' && 'border-border/50 text-muted cursor-not-allowed',
                        isCorrectOption && 'border-green-500 bg-green-900/30 text-green-300',
                        isWrongPick && 'border-red-500 bg-red-900/25 text-red-300',
                        phase === 'result' && !isCorrectOption && !isWrongPick && 'border-border/50 text-muted'
                      )}
                    >
                      <span className="flex-shrink-0 w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-black">
                        {letter}
                      </span>
                      <span className="flex-1">{optionText(letter)}</span>
                      {isMyPick && phase === 'result' && (
                        <span className="text-[10px] text-muted flex-shrink-0">(Tu respuesta)</span>
                      )}
                    </button>
                    {isCorrectOption && (
                      <div className="mt-1.5 ml-1 space-y-1">
                        <p className="text-[11px] font-bold text-green-400">Correctas</p>
                        <p className="text-xs text-muted leading-snug">{question.explanation}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {error && <p className="text-xs text-red-400 text-center">{error}</p>}

            {phase === 'result' && (
              <div
                className={cn(
                  'rounded-xl py-2.5 text-center font-display text-base tracking-wide',
                  selected === correctLetter ? 'bg-green-900/30 text-green-300' : 'bg-red-900/25 text-red-300'
                )}
              >
                {selected === correctLetter
                  ? '¡Acertaste! +1 acierto'
                  : timedOut
                    ? '⏱️ ¡Se acabó el tiempo! No respondiste a tiempo'
                    : 'Fallaste'}
              </div>
            )}

            {phase === 'result' && justEarnedBonus && (
              <div className="rounded-xl py-3 text-center font-display text-lg tracking-wide bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20">
                🎉 ¡Has obtenido {QUIZ_BONUS_POINTS} puntos!
              </div>
            )}

            {phase === 'result' && (
              <div className="flex gap-2">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleReplayAsAdmin}
                    className="flex-1 py-3 rounded-xl font-display text-base tracking-wide bg-gradient-to-b from-gold-2 to-gold text-background shadow-md shadow-gold/20"
                  >
                    Jugar de nuevo (admin)
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    'py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors',
                    isAdmin ? 'px-5' : 'w-full'
                  )}
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
