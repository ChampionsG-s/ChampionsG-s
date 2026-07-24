import type { Match } from '@/types'

export interface OpenPhase {
  phase: string
  is_open: boolean
}

function getMatchRange(matchList: Match[]): number {
  if (matchList.length === 0) return 10
  const maxMatch = Math.max(...matchList.map(m => m.match_number))
  const totalMatches = matchList.length

  if (maxMatch <= 8 && totalMatches <= 8) return 8
  else if (maxMatch <= 16 && totalMatches <= 16) return 8
  else if (maxMatch <= 24 && totalMatches <= 24) return 12
  else if (maxMatch <= 32 && totalMatches <= 32) return 16
  else return 10
}

export function jornadaLabelForMatch(match: Match, matches: Match[]): string {
  if (match.jornada) return `Jornada ${match.jornada}`
  if (match.group_name?.trim()) return match.group_name.trim()
  const range = getMatchRange(matches)
  return `Jornada ${Math.max(1, Math.ceil(match.match_number / range))}`
}

export function allJornadaLabels(matches: Match[]): string[] {
  const byJornada = Array.from(new Set(
    matches.filter(m => m.jornada !== null && m.jornada !== undefined).map(m => m.jornada!)
  )).sort((a, b) => a - b)

  if (byJornada.length > 0) return byJornada.map(j => `Jornada ${j}`)

  const byGroupName = Array.from(new Set(
    matches.filter(m => m.group_name?.trim()).map(m => m.group_name!.trim())
  ))
  if (byGroupName.length > 0) return byGroupName

  if (matches.length === 0) return ['Jornada 1']

  const range = getMatchRange(matches)
  const calculated = Array.from(new Set(
    matches.map(m => `Jornada ${Math.max(1, Math.ceil(m.match_number / range))}`)
  )).sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]))

  return calculated.length > 0 ? calculated : ['Jornada 1']
}

export function jornadaDeadline(matches: Match[], label: string): number {
  const items = matches.filter(match => jornadaLabelForMatch(match, matches) === label)
  return items.reduce((earliest, match) => {
    const time = new Date(match.match_date || match.date || '').getTime()
    return Number.isFinite(time) && time < earliest ? time : earliest
  }, Number.POSITIVE_INFINITY)
}

// Unica fuente de verdad para saber si una jornada admite predicciones:
// un override manual (si existe) o, si no, si ya paso la fecha de su primer partido.
export function isJornadaOpen(matches: Match[], label: string, openPhases: OpenPhase[] = []): boolean {
  const manual = openPhases.find(op => op.phase === label)?.is_open
  if (manual !== undefined) return manual
  const deadline = jornadaDeadline(matches, label)
  return Number.isFinite(deadline) ? Date.now() < deadline : true
}
