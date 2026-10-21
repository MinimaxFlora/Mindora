import type { LucideIcon } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-sm flex-col items-center px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-soft">
        <Icon className="size-5" strokeWidth={1.6} />
      </div>
      <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">{title}</h2>
      <p className="mt-1.5 text-[12.5px] leading-5 text-muted-foreground">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
