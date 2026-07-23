import Image from 'next/image'
import { TEAM_FLAGS } from '@/lib/data/matches'
import { cn } from '@/lib/utils'

interface FlagProps {
  team: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { w: 20, h: 14, cls: 'w-5 h-3.5' },
  md: { w: 26, h: 17, cls: 'w-6.5 h-4.5' },
  lg: { w: 36, h: 24, cls: 'w-9 h-6' },
}

export function Flag({ team, size = 'md', className }: FlagProps) {
  const code = TEAM_FLAGS[team]
  const { w, h, cls } = sizes[size]

  if (!code) {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-sm bg-border text-[9px] font-black text-background flex-shrink-0', cls, className)}
        title={team}
      >
        {team
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(part => part[0]?.toUpperCase())
          .join('')
          .slice(0, 2)}
      </span>
    )
  }

  return (
    <Image
      src={`https://flagcdn.com/w40/${code}.png`}
      alt={team}
      width={w}
      height={h}
      className={cn('rounded-sm object-cover flex-shrink-0 border border-white/10', cls, className)}
      unoptimized
    />
  )
}
