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
    const timer = setTimeout(() => {
      setSplashExiting(true)
      setTimeout(() => setShowSplash(false), 800)
    }, 2500)
    return () => clearTimeout(timer)
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
    <>
      {/* Splash Screen */}
      {showSplash && (
        <div
          className={cn(
            'fixed inset-0 flex flex-col items-center justify-center z-50',
            'bg-gradient-to-b from-slate-900 via-blue-900 to-slate-900',
            'transition-all duration-700',
            splashExiting ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          )}
        >
          <style>{`
            @keyframes shield-pop {
              0% {
                opacity: 0;
                transform: scale(0.3) rotateY(180deg);
              }
              50% {
                transform: scale(1.1) rotateY(0deg);
              }
              100% {
                opacity: 1;
                transform: scale(1) rotateY(0deg);
              }
            }
            @keyframes crown-float {
              0%, 100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-10px);
              }
            }
            .shield-animate {
              animation: shield-pop 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .crown-animate {
              animation: crown-float 2s ease-in-out infinite;
              animation-delay: 0.3s;
            }
          `}</style>
          
          <div className="shield-animate">
            {/* Escudo Champions G's */}
            <div className="relative w-40 h-48">
              {/* Fondo del escudo */}
              <div className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-900 rounded-b-3xl border-4 border-gold shadow-2xl"></div>
              
              {/* Corona */}
              <div className="crown-animate absolute -top-12 left-1/2 transform -translate-x-1/2">
                <svg viewBox="0 0 100 60" className="w-32 h-20 drop-shadow-lg">
                  {/* Corona dorada */}
                  <circle cx="50" cy="45" r="35" fill="none" stroke="#D4AF37" strokeWidth="3"/>
                  {/* Puntas de la corona */}
                  <circle cx="15" cy="30" r="8" fill="#D4AF37"/>
                  <circle cx="50" cy="8" r="12" fill="#D4AF37"/>
                  <circle cx="85" cy="30" r="8" fill="#D4AF37"/>
                  {/* Puntos decorativos */}
                  <circle cx="32" cy="20" r="4" fill="#FFC700"/>
                  <circle cx="68" cy="20" r="4" fill="#FFC700"/>
                </svg>
              </div>
              
              {/* Contenido del escudo - Letra G */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-6xl font-black text-gold mb-2">G</div>
                <div className="text-xs font-bold text-gold tracking-wider">CHAMPIONS</div>
              </div>
              
              {/* Decoraciones laterales */}
              <div className="absolute -left-6 top-12 w-4 h-16 bg-gold rounded-l-full opacity-70"></div>
              <div className="absolute -right-6 top-12 w-4 h-16 bg-gold rounded-r-full opacity-70"></div>
            </div>
          </div>

          <div className="mt-16 text-center">
            <h2 className="text-3xl font-black text-gold tracking-widest">Champions G's</h2>
            <p className="text-gold text-xs uppercase tracking-wider mt-2">La Liga 26/27</p>
          </div>
        </div>
      )}

      {/* Login Form */}
      <div className={cn(
        'min-h-screen flex flex-col items-center justify-center px-4',
        'transition-all duration-700',
        showSplash ? 'opacity-0 pointer-events-none' : 'opacity-100'
      )}>
        <div className="text-center mb-8">
          <p className="text-xs tracking-widest text-gold font-bold uppercase mb-2">
            Champions G's
          </p>
          <h1 className="text-6xl font-black tracking-wider text-cream">
            CHAMPIONS <span className="text-gold">G'S</span>
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
    </>
  )
}