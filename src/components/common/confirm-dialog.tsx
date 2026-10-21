import { AlertTriangle, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n/use-i18n'
import { errorText } from '@/lib/errors'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

type ConfirmBodyProps = Omit<ConfirmDialogProps, 'open'>

function ConfirmDialogBody({
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
}: ConfirmBodyProps) {
  const { t } = useI18n()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleConfirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (cause) {
      setError(errorText(cause, t, 'error.actionFailed'))
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="leading-6">{description}</DialogDescription>
      </DialogHeader>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
          {cancelLabel ?? t('common.cancel')}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          onClick={() => void handleConfirm()}
          disabled={pending}
        >
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel ?? t('common.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function ConfirmDialog(props: ConfirmDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="sm" hideClose>
        {props.open && <ConfirmDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}
