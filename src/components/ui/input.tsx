import * as React from 'react'

import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-[13px] text-foreground shadow-[0_1px_0_rgb(0_0_0/0.02)] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus:border-ring/70 focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-[13px] leading-6 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/75 focus:border-ring/70 focus:ring-2 focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
