import Image from 'next/image'
import { cn } from '@/lib/utils'

interface AvatarProps {
  username: string
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizes = {
  sm: { px: 28, cls: 'w-7 h-7 text-xs' },
  md: { px: 36, cls: 'w-9 h-9 text-base' },
  lg: { px: 56, cls: 'w-14 h-14 text-xl' },
  xl: { px: 96, cls: 'w-24 h-24 text-4xl' },
}

export function Avatar({ username, avatarUrl, size = 'md', className }: AvatarProps) {
  const { px, cls } = sizes[size]

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={username}
        width={px}
        height={px}
        className={cn('rounded-full object-cover flex-shrink-0 border border-border', cls, className)}
        unoptimized
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-surface-2 border border-border flex-shrink-0 font-display text-gold leading-none',
        cls,
        className
      )}
    >
      {username.charAt(0).toUpperCase() || '?'}
    </span>
  )
}
