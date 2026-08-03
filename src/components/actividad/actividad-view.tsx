'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckCircle2, Lock, UserPlus, Star, Bell } from 'lucide-react'
import type { Notification } from '@/types'

type Tab = 'personal' | 'global'

interface ActividadViewProps {
  personal: Notification[]
  global: Notification[]
}

const ICONS: Record<string, typeof Bell> = {
  prediction_saved: CheckCircle2,
  jornada_closed: Lock,
  member_joined: UserPlus,
  points_earned: Star,
}

function iconFor(type: string) {
  return ICONS[type] ?? Bell
}

export function ActividadView({ personal, global: globalNotifs }: ActividadViewProps) {
  const [tab, setTab] = useState<Tab>('personal')
  const [personalItems, setPersonalItems] = useState(personal)
  const supabase = createClient()
  const router = useRouter()

  const unreadCount = useMemo(() => personalItems.filter(n => !n.read_at).length, [personalItems])

  useEffect(() => {
    if (tab !== 'personal') return
    const unreadIds = personalItems.filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length === 0) return

    setPersonalItems(prev => prev.map(n => unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
    // router.refresh() en vez de fiarnos solo del realtime del badge del nav:
    // si esta pagina se acaba de montar, la suscripcion de PoolShell puede no
    // estar lista todavia cuando se dispara este update, y el evento se pierde.
    supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unreadIds)
      .then(() => router.refresh())
  }, [tab, personalItems, supabase, router])

  const items = tab === 'personal' ? personalItems : globalNotifs

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {([
          ['personal', `Personales${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
          ['global', 'Globales'],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-3.5 py-2 rounded-full text-xs font-bold transition-all',
              tab === key ? 'bg-gold text-background' : 'border border-border text-muted hover:border-gold hover:text-gold'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-muted text-sm">
            {tab === 'personal' ? 'Aún no tienes avisos personales.' : 'Aún no hay actividad en la porra.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const Icon = iconFor(n.type)
            const isUnread = tab === 'personal' && !n.read_at
            return (
              <div
                key={n.id}
                className={cn(
                  'card !p-3 flex items-start gap-3',
                  isUnread && 'border-gold/50 bg-gold/[0.04]'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  isUnread ? 'bg-gold/15 text-gold' : 'bg-surface-2 text-muted'
                )}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm">{n.title}</p>
                  <p className="text-sm text-muted leading-snug">{n.body}</p>
                  <p className="text-[10px] text-muted/70 mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                  </p>
                </div>
                {isUnread && <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 mt-1" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
