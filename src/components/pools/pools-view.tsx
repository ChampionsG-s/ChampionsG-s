'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Plus, Users, LogOut, Globe } from 'lucide-react'

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
}

export function PoolsView({ memberships: initial, userId, isPlatformAdmin }: PoolsViewProps) {
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
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-2">
        {isPlatformAdmin ? (
          <button
            onClick={() => router.push('/admin-global')}
            className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-900/20 border border-red-900/50"
          >
            <Globe size={14} /> Resultados Globales
          </button>
        ) : <div />}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-cream transition-colors px-3 py-1.5 rounded-lg hover:bg-surface"
        >
          <LogOut size={14} /> Cerrar sesión
        </button>
      </div>

      <div className="text-center mb-8">
        <p className="text-xs tracking-widest text-gold font-bold uppercase mb-2">
          Champions G's
        </p>
        <h1 className="text-5xl font-black tracking-wider text-cream">
          TIP<span className="text-gold">STR</span>
        </h1>
        <p className="text-muted text-sm mt-2">Tus quinielas</p>
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
            <div className="space-y-2">
              {approved.map(m => (
                <button
                  key={m.id}
                  onClick={() => router.push(`/p/${m.pools.id}/jornadas`)}
                  className="card w-full text-left hover:border-gold transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-bold">{m.pools.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {m.role === 'admin' && <span className="badge badge-admin mr-1.5">ADMIN</span>}
                      Código: {m.pools.invite_code}
                    </p>
                  </div>
                  <span className="text-gold">→</span>
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
    </div>
  )
}
