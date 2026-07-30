'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface PlayerPhotoProps {
  name: string
  photoUrl?: string | null
  heroPhotoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { px: 32, cls: 'w-8 h-8' },
  md: { px: 48, cls: 'w-12 h-12' },
  lg: { px: 72, cls: 'w-[72px] h-[72px]' },
}

function Initials({ name, cls, className }: { name: string; cls: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full bg-surface-2 border border-border text-[11px] font-black text-muted flex-shrink-0', cls, className)}
      title={name || undefined}
    >
      {name
        ? name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('').slice(0, 2)
        : '-'}
    </span>
  )
}

// Mismo patron de fallback que <Flag>: intenta la foto "hero" primero, luego
// la foto base, y si ambas fallan cae a un avatar con iniciales.
export function PlayerPhoto({ name, photoUrl, heroPhotoUrl, size = 'md', className }: PlayerPhotoProps) {
  const candidates = [heroPhotoUrl, photoUrl].filter((u): u is string => !!u)
  const [idx, setIdx] = useState(0)
  const { px, cls } = sizes[size]
  const src = candidates[idx]

  if (!src) {
    return <Initials name={name} cls={cls} className={className} />
  }

  return (
    <Image
      src={src}
      alt={name}
      width={px}
      height={px}
      onError={() => setIdx(i => i + 1)}
      className={cn('object-cover rounded-full bg-surface-2 flex-shrink-0', cls, className)}
      unoptimized
    />
  )
}
