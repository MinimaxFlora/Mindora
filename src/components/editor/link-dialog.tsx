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
import { normalizeSafeLinkUrl } from '@/lib/url'

interface LinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (label: string, url: string) => void
}

function LinkDialogBody({ onOpenChange, onSubmit }: Omit<LinkDialogProps, 'open'>) {
  const { t } = useI18n()
  const [label, setLabel] = React.useState('')
  const [url, setUrl] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    try {
      const safeUrl = normalizeSafeLinkUrl(url)
      onSubmit(label.trim(), safeUrl)
      onOpenChange(false)
    } catch (cause) {
      setError(errorText(cause, t, 'editor.link.invalid'))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('editor.link.title')}</DialogTitle>
        <DialogDescription>{t('editor.link.description')}</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[11.5px] font-medium">{t('editor.link.url')}</span>
          <Input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t('editor.link.urlPlaceholder')}
            autoFocus
            inputMode="url"
            aria-invalid={Boolean(error)}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[11.5px] font-medium">
            {t('editor.link.label')}{' '}
            <span className="font-normal text-muted-foreground">
              ({t('editor.link.labelOptional')})
            </span>
          </span>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder={t('editor.link.labelPlaceholder')}
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!url.trim() || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {t('editor.link.insert')}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function LinkDialog(props: LinkDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="md">
        {props.open && <LinkDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}
