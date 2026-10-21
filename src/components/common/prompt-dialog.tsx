import { Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/i18n/use-i18n'
import { errorText } from '@/lib/errors'

interface PromptDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  label?: string
  placeholder?: string
  defaultValue?: string
  confirmLabel?: string
  onSubmit: (value: string) => void | Promise<void>
}

function PromptDialogBody({
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  defaultValue = '',
  confirmLabel,
  onSubmit,
}: Omit<PromptDialogProps, 'open'>) {
  const { t } = useI18n()
  const [value, setValue] = React.useState(defaultValue)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!value.trim()) {
      setError(t('error.nameRequired'))
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSubmit(value.trim())
      onOpenChange(false)
    } catch (cause) {
      setError(errorText(cause, t, 'error.saveFailed'))
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[11.5px] font-medium text-foreground">
            {label ?? t('confirm.nameLabel')}
          </span>
          <Input
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(null)
            }}
            placeholder={placeholder}
            autoFocus
            maxLength={120}
            aria-invalid={Boolean(error)}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={pending || !value.trim()}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel ?? t('confirm.save')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function PromptDialog(props: PromptDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="sm">
        {props.open && <PromptDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}
