'use client'

import { useState, useEffect } from 'react'
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
  return `${normalized}@championsg-s.app`
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)

  useEffect(() => {
    // Mostrar login inmediatamente sin espera
    setShowSplash(false)
  }, [])

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
    <div className="relative min-h-screen w-full bg-black overflow-hidden">
      {/* Video Background - Always Visible */}
      <div className="absolute inset-0 w-full h-full z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/videos/shield-celebration.mp4" type="video/mp4" />
          Tu navegador no soporta el elemento video
        </video>
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      {/* Login Form */}
      <div className={cn(
        'absolute inset-0 z-10 flex flex-col items-center justify-center px-4',
        'transition-all duration-1000',
        showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100 [&>*]:transition-all [&>*]:duration-[2000ms]'
      )}>
        <div className="text-center mb-8">
          <img 
            src="/logos/champions-logo.png" 
            alt="Champions G's" 
            className="h-32 drop-shadow-lg mx-auto mb-4"
          />
          <p className="text-cream text-sm drop-shadow-lg">Crea o únete a tu quiniela de Liga</p>
        </div>

      <div className="w-full max-w-sm backdrop-blur-md bg-black/30 rounded-xl p-8 border border-gold/20 transition-all duration-[2000ms]">
        <div className="flex gap-1 bg-surface-2/50 rounded-lg p-1 mb-4 backdrop-blur-sm">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError('') }}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-bold transition-all duration-150',
                mode === m ? 'bg-gold text-background' : 'text-cream/70 hover:text-cream'
              )}
            >
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gold/80 mb-1.5">
              Nombre de usuario
            </label>
            <input
              className="w-full px-3 py-2 bg-black/40 border border-gold/30 rounded-lg text-cream placeholder-cream/50 focus:border-gold focus:outline-none transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Ej: Manolillo"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gold/80 mb-1.5">
              Contraseña
            </label>
            <input
              className="w-full px-3 py-2 bg-black/40 border border-gold/30 rounded-lg text-cream placeholder-cream/50 focus:border-gold focus:outline-none transition-colors"
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
            className="w-full mt-4 py-2 bg-gold hover:bg-gold/90 text-background font-bold rounded-lg transition-all disabled:opacity-50 drop-shadow-lg"
          >
            {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
      </div>
    </div>
  )
}