'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Plus, Users, LogOut, Globe, ChevronRight } from 'lucide-react'

interface MembershipWithPool {
  id: string
  role: 'admin' | 'member'
  status: 'pending' | 'approved' | 'rejected'
  pools: {
    id: string
    name: string
    invite_code: string
  }
}

interface PoolsViewProps {
  memberships: MembershipWithPool[]
  userId: string
  isPlatformAdmin: boolean
  username: string
  avatarUrl?: string | null
}

export function PoolsView({ memberships: initial, userId, isPlatformAdmin, username, avatarUrl }: PoolsViewProps) {
  const router = useRouter()
  const supabase = createClient()

  const [memberships, setMemberships] = useState(initial)
  const [mode, setMode] = useState<'list' | 'create' | 'join'>('list')
  const [poolName, setPoolName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const approved = memberships.filter(m => m.status === 'approved')
  const pending = memberships.filter(m => m.status === 'pending')

  const handleCreate = async () => {
    if (!poolName.trim()) return
    setError('')
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('create_pool', {
        pool_name: poolName.trim(),
      })
      if (rpcError) throw rpcError

      router.push(`/p/${data.id}/jornadas`)
    } catch (err) {
      setError('No se pudo crear la porra. Inténtalo de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!inviteCode.trim()) return
    setError('')
    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('join_pool', {
        code: inviteCode.trim().toUpperCase(),
      })
      if (rpcError) throw rpcError

      if (data.status === 'pending') {
        setMode('list')
        router.refresh()
      } else {
        router.push(`/p/${data.pool_id}/jornadas`)
      }
    } catch (err: any) {
      setError(err.message?.includes('no válido') ? 'Código no válido.' : 'Error al unirse a la porra.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto safe-top safe-bottom">
      {/* Header: logo + todo lo relacionado con el usuario */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white p-1 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="Champions G's"
                width={36}
                height={36}
                className="w-full h-full object-contain rounded-md"
              />
            </div>
            <span className="font-display text-lg tracking-wide truncate">Champions G's</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isPlatformAdmin && (
              <button
                onClick={() => router.push('/admin-global')}
                className="p-2.5 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-900/20 transition-colors"
                title="Resultados Globales"
              >
                <Globe size={18} />
              </button>
            )}
            <Link
              href="/perfil"
              className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-surface transition-colors"
            >
              <Avatar username={username} avatarUrl={avatarUrl} size="sm" />
            </Link>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg text-muted hover:text-cream hover:bg-surface transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
      <div className="text-center mb-8 mt-2">
        <div className="mx-auto mb-4 w-28 h-28 rounded-2xl bg-white p-2 shadow-lg shadow-black/30 ring-1 ring-gold/30">
          <Image
            src="/logo.png"
            alt="Champions G's"
            width={112}
            height={112}
            className="w-full h-full object-contain rounded-xl"
            priority
          />
        </div>
        <h1 className="font-display text-2xl tracking-wide text-cream mt-3">Champions G's</h1>
        <p className="text-muted text-sm mt-1">Tus quinielas</p>
      </div>

      {mode === 'list' && (
        <>
          <div className="flex gap-2 mb-6">
            <button onClick={() => setMode('create')} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Plus size={16} /> Crear porra
            </button>
            <button onClick={() => setMode('join')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <Users size={16} /> Unirme con código
            </button>
          </div>

          {pending.length > 0 && (
            <div className="card border-amber-700 mb-4">
              <h3 className="font-bold text-sm text-amber-300 mb-2">⏳ Pendientes de aprobación</h3>
              {pending.map(m => (
                <p key={m.id} className="text-sm text-muted">{m.pools.name}</p>
              ))}
            </div>
          )}

          {approved.length === 0 ? (
            <div className="card text-center py-10">
              <p className="text-muted text-sm">Aún no estás en ninguna porra.</p>
              <p className="text-muted text-sm mt-1">Crea una o únete con un código de invitación.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {approved.map(m => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/p/${m.pools.id}/jornadas`)}
                  className="card w-full text-left hover:border-gold active:scale-[0.99] transition-all flex items-center gap-3"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-2/20 to-gold/5 border border-gold/20 flex items-center justify-center flex-shrink-0">
                    <span className="font-display text-xl text-gold">{m.pools.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{m.pools.name}</p>
                    <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                      {m.role === 'admin' && <span className="badge badge-admin">ADMIN</span>}
                      Código: {m.pools.invite_code}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-muted flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'create' && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Crear nueva porra</h2>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
            Nombre de la porra
          </label>
          <input
            className="input mb-3"
            value={poolName}
            onChange={(e) => setPoolName(e.target.value)}
            placeholder="Ej: Porra de la oficina"
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setMode('list'); setError('') }} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={handleCreate} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </div>
      )}

      {mode === 'join' && (
        <div className="card">
          <h2 className="font-bold text-lg mb-4">Unirme a una porra</h2>
          <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
            Código de invitación
          </label>
          <input
            className="input mb-3 uppercase tracking-widest text-center font-bold"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="X7K2P9"
            maxLength={6}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setMode('list'); setError('') }} className="btn-secondary flex-1">
              Cancelar
            </button>
            <button onClick={handleJoin} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Uniéndome...' : 'Unirme'}
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}
