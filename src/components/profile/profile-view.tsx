'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Avatar } from '@/components/ui/avatar'
import { ArrowLeft, Camera } from 'lucide-react'
import type { AppUser } from '@/types'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB, igual que el limite del bucket
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

interface ProfileViewProps {
  user: AppUser
}

export function ProfileView({ user: initialUser }: ProfileViewProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [user, setUser] = useState(initialUser)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError('')

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Solo se admiten imágenes PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('La imagen no puede pesar más de 2MB.')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' })

      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path)
      // Evita que el navegador siga mostrando la imagen antigua en cache
      const avatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (updateError) throw updateError

      setUser(prev => ({ ...prev, avatar_url: avatarUrl }))
    } catch (err) {
      console.error('Error uploading avatar:', err)
      setError('No se pudo subir la foto. Inténtalo de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  const memberSince = new Date(user.created_at).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen max-w-md mx-auto px-4 py-6 safe-top safe-bottom">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-muted hover:text-cream transition-colors mb-6 -ml-1.5 p-1.5 rounded-lg hover:bg-surface"
      >
        <ArrowLeft size={18} /> Volver
      </button>

      <h1 className="font-display text-3xl tracking-wide text-gold mb-6">Mi perfil</h1>

      <div className="card flex flex-col items-center text-center py-8">
        <div className="relative mb-4">
          <Avatar username={user.username} avatarUrl={user.avatar_url} size="xl" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-gold text-background flex items-center justify-center border-2 border-surface shadow-md disabled:opacity-50 active:scale-95 transition-transform"
            title="Cambiar foto de perfil"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <p className="font-bold text-xl">{user.username}</p>
        <p className="text-xs text-muted mt-1 capitalize">Miembro desde {memberSince}</p>

        {uploading && <p className="text-xs text-gold mt-3">Subiendo foto...</p>}
        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}

        <p className="text-[11px] text-muted mt-5">PNG, JPG o WEBP · máx. 2MB</p>
      </div>
    </div>
  )
}
