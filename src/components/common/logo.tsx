import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'brand-tile relative shrink-0 overflow-hidden rounded-[9px]',
        className ?? 'size-8',
      )}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" className="size-[72%]" fill="none">
        <path
          d="M8 9v14M8 9l8 9 8-9M24 9v14"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="16" cy="24" r="1.8" fill="currentColor" opacity="0.65" />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[15px] font-semibold tracking-[-0.03em]', className)}>
      Mindora
    </span>
  )
}
