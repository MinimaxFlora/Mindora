import { AlertCircle, Check, Loader2 } from 'lucide-react'

import type { SaveState } from '@/hooks/use-note-autosave'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/utils'

interface SaveStatusProps {
  state: SaveState
  error: string | null
  onRetry: () => void
}

export function SaveStatus({ state, error, onRetry }: SaveStatusProps) {
  const { t } = useI18n()

  if (state === 'error') {
    return (
      <button
        type="button"
        onClick={onRetry}
        className="flex items-center gap-1.5 rounded-full bg-destructive/9 px-2 py-1 text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/14"
        title={error ?? t('editor.saveFailedTitle')}
      >
        <AlertCircle className="size-3" />
        {t('editor.saveFailedRetry')}
      </button>
    )
  }

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={t('editor.saveStatus')}
      className={cn(
        'flex items-center gap-1.5 text-[10px]',
        state === 'saving' && 'text-muted-foreground',
        state === 'dirty' && 'text-warning',
        state === 'saved' && 'text-muted-foreground/75',
      )}
    >
      {state === 'saving' ? (
        <Loader2 className="size-3 animate-spin" />
      ) : state === 'dirty' ? (
        <span className="size-1.5 rounded-full bg-current" />
      ) : (
        <Check className="size-3" />
      )}
      {state === 'saving' ? t('editor.saving') : state === 'dirty' ? t('editor.unsaved') : t('editor.saved')}
    </span>
  )
}
