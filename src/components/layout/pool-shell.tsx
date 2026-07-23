'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Trophy, CalendarDays, Table2, Settings, LogOut, ArrowLeft, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import type { Pool, PoolMember } from '@/types'

interface PoolShellProps {
  pool: Pool
  membership: PoolMember
  username: string
  children: React.ReactNode
}

const navItems = (poolId: string, isAdmin: boolean) => [
  { href: `/p/${poolId}/jornadas`, label: 'Jornadas', icon: CalendarDays },
  { href: `/p/${poolId}/clasificacion`, label: 'Clasificación', icon: Table2 },
  { href: `/p/${poolId}/ranking`, label: 'Ranking', icon: Trophy },
  ...(isAdmin ? [{ href: `/p/${poolId}/admin`, label: 'Admin', icon: Settings }] : []),
]

export function PoolShell({ pool, membership, username, children }: PoolShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const isLocked = membership.locked_matches && membership.locked_spain && membership.locked_awards
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
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/pools" className="text-muted hover:text-cream transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <h1 className="font-black text-base truncate leading-tight">{pool.name}</h1>
              <button
                onClick={copyInviteCode}
                className="text-[10px] text-muted hover:text-gold transition-colors flex items-center gap-1"
              >
                {copied ? <Check size={10} /> : <Copy size={10} />}
                {pool.invite_code}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-1.5 justify-end">
                <span className="font-bold text-xs">{username}</span>
                {isAdmin && <span className="badge badge-admin">ADMIN</span>}
                {isLocked && <span className="text-xs">🔒</span>}
              </div>
            </div>
            {isAdmin && (
              <Link
                href={`/p/${pool.id}/admin`}
                className={cn(
                  'p-2 rounded-lg transition-colors',
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
              className="p-2 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-24">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-2 border-t border-border">
        <div className="max-w-3xl mx-auto flex">
          {navItems(pool.id, isAdmin).map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold transition-colors',
                  active ? 'text-gold' : 'text-muted hover:text-cream'
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
