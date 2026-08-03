'use client'

import { X, CalendarDays, ListOrdered, Trophy, Shirt, Bell, Settings, Gift } from 'lucide-react'

interface HelpModalProps {
  isAdmin: boolean
  onClose: () => void
}

interface HelpSection {
  icon: typeof CalendarDays
  title: string
  items: string[]
}

const SECTIONS: HelpSection[] = [
  {
    icon: CalendarDays,
    title: 'Jornadas',
    items: [
      'Cada jornada tiene sus partidos: elegís 1 (gana local), X (empate) o 2 (gana visitante) en los normales.',
      'Los partidos ⭐ BONUS piden el marcador exacto en vez del signo.',
      'Una jornada se cierra sola en cuanto llega la fecha de su primer partido: hasta entonces podés cambiar tus pronósticos las veces que quieras.',
      'Al pulsar BET quedan guardados y bloqueados para esa jornada.',
      'Cuando la jornada termina, la pestaña muestra el resultado oficial de cada partido y los puntos que sumaste, con el total al final.',
    ],
  },
  {
    icon: Gift,
    title: 'Ruleta regalo 🎁',
    items: [
      'Cada 3 jornadas aparece una pestaña 🎁 al lado de la última jornada del bloque.',
      'Se desbloquea cuando esa jornada está abierta para apostar; si aún está cerrada, te avisa que todavía no podés jugar.',
      'Podés girarla una sola vez por bloque: te suma o resta puntos (+2, +1, 0, -1 o -2) al azar, con la misma probabilidad para cada resultado.',
      'Esos puntos se suman directo a tu Ranking.',
    ],
  },
  {
    icon: ListOrdered,
    title: 'Clasificación',
    items: [
      'Es la tabla real de LaLiga (o de la competición configurada): resultados oficiales de los equipos, no tiene que ver con tus puntos.',
    ],
  },
  {
    icon: Trophy,
    title: 'Ranking',
    items: [
      'Tu posición dentro de esta quiniela según los puntos acumulados por tus pronósticos (más el bonus/malus de la ruleta regalo).',
      'El podio muestra el top 3; el resto aparece en tarjetas ordenadas por puesto.',
    ],
  },
  {
    icon: Shirt,
    title: 'Equipo',
    items: [
      'Un mini-juego aparte con jugadores reales de LaLiga: fichás una plantilla con un presupuesto inicial de monedas.',
      'El mercado rota cada 3 días: podés pujar en subasta o comprar directo.',
      'Un jugador ya fichado por otro miembro también se puede robar ("fichaje") una vez que lleva 2 jornadas con su dueño.',
      'Tus jugadores suman puntos según su rendimiento real; hay un ranking propio de Equipo, separado del Ranking de la quiniela.',
    ],
  },
  {
    icon: Bell,
    title: 'Actividad',
    items: [
      'Aquí llegan tus notificaciones: apuestas guardadas, resultados cargados, movimientos de Equipo, etc.',
      'El número rojo en la barra inferior indica cuántas no leíste todavía.',
    ],
  },
]

const ADMIN_SECTION: HelpSection = {
  icon: Settings,
  title: 'Admin',
  items: [
    'Carga los resultados oficiales de cada partido.',
    'Puede abrir o cerrar manualmente una jornada, adelantando o retrasando el cierre automático por fecha.',
  ],
}

const SCORING_ITEMS = [
  ['1pt', 'Signo acertado (1 / X / 2) en partido normal'],
  ['⭐ 3 / 1pts', 'Partido bonus: marcador exacto / solo el signo'],
  ['0pts', 'Fallo'],
]

export function HelpModal({ isAdmin, onClose }: HelpModalProps) {
  const sections = isAdmin ? [...SECTIONS, ADMIN_SECTION] : SECTIONS

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gold/30 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.98)_45%,rgba(7,11,22,0.99)_100%)] shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3.5 flex-shrink-0">
          <h3 className="font-display text-lg tracking-wide text-cream">Cómo funciona la app</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {sections.map(({ icon: Icon, title, items }) => (
            <div key={title} className="rounded-xl border border-white/10 bg-black/25 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className="text-gold flex-shrink-0" />
                <h4 className="font-bold text-sm text-cream">{title}</h4>
              </div>
              <ul className="space-y-1.5">
                {items.map((item, i) => (
                  <li key={i} className="text-xs text-muted leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-gold/70">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="rounded-xl border border-white/10 bg-black/25 p-3.5">
            <h4 className="font-bold text-sm text-cream mb-2">Sistema de puntos</h4>
            <div className="space-y-1.5">
              {SCORING_ITEMS.map(([pts, label]) => (
                <div key={label} className="flex gap-2.5 items-start text-xs">
                  <span className="font-bold text-gold min-w-[64px] flex-shrink-0">{pts}</span>
                  <span className="text-muted">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 pt-0 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm border border-border text-cream hover:border-gold transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  )
}
