import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type * as React from 'react'

import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  delay?: number
  disabled?: boolean
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  delay = 350,
  disabled = false,
}: TooltipProps) {
  if (disabled || !content) return <>{children}</>
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={7}
          className="z-[80] max-w-xs animate-fade-in rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] leading-4 text-popover-foreground shadow-float"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-popover" width={9} height={5} />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-[1.35rem] items-center justify-center rounded border border-border bg-muted/70 px-1 py-px font-mono text-[10px] leading-4 text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
