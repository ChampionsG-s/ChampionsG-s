'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Trophy, CalendarDays, ListOrdered, Settings, LogOut, Bell, Shirt } from 'lucide-react'
import type { Notification, Pool, PoolMember } from '@/types'

interface PoolShellProps {
  pool: Pool
  membership: PoolMember
  username: string
  avatarUrl?: string | null
  unreadPersonalCount: number
  children: React.ReactNode
}

const navItems = (poolId: string, isAdmin: boolean) => [
  { href: `/p/${poolId}/jornadas`, label: 'Jornadas', icon: CalendarDays },
  { href: `/p/${poolId}/clasificacion`, label: 'Clasificación', icon: ListOrdered },
  { href: `/p/${poolId}/ranking`, label: 'Ranking', icon: Trophy },
  { href: `/p/${poolId}/equipo`, label: 'Equipo', icon: Shirt },
  { href: `/p/${poolId}/actividad`, label: 'Actividad', icon: Bell },
  ...(isAdmin ? [{ href: `/p/${poolId}/admin`, label: 'Admin', icon: Settings }] : []),
]

export function PoolShell({ pool, membership, username, avatarUrl, unreadPersonalCount, children }: PoolShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [unreadCount, setUnreadCount] = useState(unreadPersonalCount)

  const isAdmin = membership.role === 'admin'

  useEffect(() => {
    setUnreadCount(unreadPersonalCount)
  }, [unreadPersonalCount])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`nav-notifications-${membership.user_id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${membership.user_id}` },
        (payload) => {
          const oldRow = payload.old as Partial<Notification> | undefined
          const newRow = payload.new as Notification | undefined
          if (payload.eventType === 'INSERT' && newRow?.scope === 'personal' && !newRow.read_at) {
            setUnreadCount(count => count + 1)
          } else if (payload.eventType === 'UPDATE' && newRow?.scope === 'personal' && !oldRow?.read_at && newRow.read_at) {
            setUnreadCount(count => Math.max(0, count - 1))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [membership.user_id])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto">
      {/* Topbar */}
      <header className="safe-top sticky top-0 z-40 overflow-hidden border-b border-gold/25 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.97)_45%,rgba(7,11,22,0.98)_100%)] backdrop-blur-md px-4 py-3">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(212,160,23,0.16),transparent_45%)]" />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Image
              src="/logo.png"
              alt="Champions G's"
              width={48}
              height={48}
              className="w-11 h-11 sm:w-12 sm:h-12 object-contain flex-shrink-0 drop-shadow-[0_2px_10px_rgba(212,160,23,0.45)]"
            />
            <div className="min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-black tracking-tight text-cream truncate leading-none"
                style={{ fontFamily: 'var(--font-playfair)' }}
              >
                {pool.name}
              </h1>
            </div>
          </div>
          <div className="relative flex items-center gap-1.5 flex-shrink-0">
            <Link
              href="/perfil"
              className="flex items-center gap-1.5 mr-0.5 p-1 rounded-lg hover:bg-surface transition-colors"
            >
              <span className="text-right hidden sm:flex items-center gap-1.5">
                <span className="font-bold text-xs">{username}</span>
                {isAdmin && <span className="badge badge-admin">ADMIN</span>}
              </span>
              <Avatar username={username} avatarUrl={avatarUrl} size="sm" />
            </Link>
            {isAdmin && (
              <Link
                href={`/p/${pool.id}/admin`}
                className={cn(
                  'p-2.5 rounded-lg transition-colors',
                  pathname.includes('/admin')
                    ? 'bg-gold text-background'
                    : 'text-muted hover:text-cream hover:bg-surface'
                )}
              >
                <Settings size={18} />
              </Link>
            )}
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-28">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 overflow-hidden border-t border-gold/25 bg-[linear-gradient(155deg,rgba(29,47,83,0.55),rgba(10,15,30,0.97)_45%,rgba(7,11,22,0.98)_100%)] backdrop-blur-md">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div className="relative max-w-3xl mx-auto flex gap-1 px-1.5 py-1.5">
          {navItems(pool.id, isAdmin).map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex-1 flex flex-col items-center gap-0.5 py-2 min-h-[52px] justify-center rounded-xl text-[10.5px] font-bold transition-all',
                  active
                    ? 'bg-gold/10 text-gold'
                    : 'text-muted hover:text-cream hover:bg-white/5'
                )}
              >
                <span className="relative">
                  <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                  {label === 'Actividad' && unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-[3px] rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-background">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
