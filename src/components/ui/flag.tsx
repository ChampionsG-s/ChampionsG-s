import Image from 'next/image'
import { TEAM_CRESTS } from '@/lib/data/team-crests'
import { cn } from '@/lib/utils'

interface FlagProps {
  team: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { px: 20, cls: 'w-5 h-5' },
  md: { px: 26, cls: 'w-[26px] h-[26px]' },
  lg: { px: 36, cls: 'w-9 h-9' },
}

function Initials({ team, cls, className }: { team: string; cls: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-full bg-surface-2 border border-border text-[9px] font-black text-muted flex-shrink-0', cls, className)}
      title={team || undefined}
    >
      {team
        ? team
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map(part => part[0]?.toUpperCase())
          .join('')
          .slice(0, 2)
        : '-'}
    </span>
  )
}

export function Flag({ team, size = 'md', className }: FlagProps) {
  const crest = team ? TEAM_CRESTS[team] : undefined
  const { px, cls } = sizes[size]

  if (!crest) {
    return <Initials team={team} cls={cls} className={className} />
  }

  return (
    <Image
      src={crest}
      alt={team}
      width={px}
      height={px}
      className={cn('object-contain flex-shrink-0', cls, className)}
      unoptimized
    />
  )
}
