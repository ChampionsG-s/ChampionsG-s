'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'register'

// Internal fake-email domain — users never see or type an email.
// Normalizes accents/ñ so any username produces a valid email.
function emailFromUsername(username: string) {
  const normalized = username
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/ñ/gi, 'n')
    .toLowerCase().trim().replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '') // strip anything else invalid
  return `${normalized}@users.tipstr.app`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const email = emailFromUsername(username)

    try {
      if (mode === 'register') {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('username', username.trim())
          .maybeSingle()

        if (existing) {
          setError('Ese nombre ya está en uso.')
          return
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { username: username.trim() },
          },
        })

        if (signUpError) {
          setError(signUpError.message)
          return
        }

        if (data.user) {
          router.push('/pools')
          router.refresh()
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError('Usuario o contraseña incorrectos.')
          return
        }

        if (data.user) {
          router.push('/pools')
          router.refresh()
        }
      }
    } catch (err) {
      setError('Error inesperado. Inténtalo de nuevo.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <p className="text-xs tracking-widest text-gold font-bold uppercase mb-2">
          Champions G's
        </p>
        <h1 className="text-6xl font-black tracking-wider text-cream">
          TIP<span className="text-gold">STR</span>
        </h1>
        <p className="text-muted text-sm mt-2">Crea o únete a tu quiniela de Liga</p>
      </div>

      <div className="w-full max-w-sm">
        <div className="flex gap-1 bg-surface-2 rounded-lg p-1 mb-4">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-bold transition-all duration-150',
                mode === m ? 'bg-gold text-background' : 'text-muted hover:text-cream'
              )}
            >
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="card space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
              Nombre de usuario
            </label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: Manolillo"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-muted mb-1.5">
              Contraseña
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 disabled:opacity-50"
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}