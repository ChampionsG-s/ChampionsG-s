'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Trophy, CalendarDays, Table2, Settings, LogOut, ArrowLeft, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { Pool, PoolMember } from '@/types'

interface PoolShellProps {
  pool: Pool
  membership: PoolMember
  username: string
  avatarUrl?: string | null
  children: React.ReactNode
}

const navItems = (poolId: string, isAdmin: boolean) => [
  { href: `/p/${poolId}/jornadas`, label: 'Jornadas', icon: CalendarDays },
  { href: `/p/${poolId}/clasificacion`, label: 'Clasificación', icon: Table2 },
  { href: `/p/${poolId}/ranking`, label: 'Ranking', icon: Trophy },
  ...(isAdmin ? [{ href: `/p/${poolId}/admin`, label: 'Admin', icon: Settings }] : []),
]

export function PoolShell({ pool, membership, username, avatarUrl, children }: PoolShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const isAdmin = membership.role === 'admin'

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(pool.invite_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col max-w-3xl mx-auto">
      {/* Topbar */}
      <header className="safe-top sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/pools"
              className="text-muted hover:text-cream transition-colors flex-shrink-0 -ml-1.5 p-1.5 rounded-lg hover:bg-surface"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-lg tracking-wide truncate leading-tight">{pool.name}</h1>
              <button
                onClick={copyInviteCode}
                className="text-[10px] text-muted hover:text-gold transition-colors flex items-center gap-1"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {pool.invite_code}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
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
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-40 bg-surface-2/95 backdrop-blur-md border-t border-border">
        <div className="max-w-3xl mx-auto flex">
          {navItems(pool.id, isAdmin).map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'relative flex-1 flex flex-col items-center gap-1 py-2.5 min-h-[56px] justify-center text-[11px] font-semibold transition-colors',
                  active ? 'text-gold' : 'text-muted hover:text-cream'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0 h-0.5 w-8 rounded-full bg-gold transition-opacity',
                    active ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
