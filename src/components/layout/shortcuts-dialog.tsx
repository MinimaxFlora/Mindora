import { Command } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useI18n } from '@/i18n/use-i18n'
import { shortcutLabel } from '@/lib/utils'
import { useUI } from '@/providers/ui-provider'

const groups = [
  {
    titleKey: 'shortcuts.group.global',
    items: [
      ['shortcuts.openSearch', 'Ctrl+K'],
      ['shortcuts.newNote', 'Alt+N'],
      ['shortcuts.help', '?'],
      ['shortcuts.closeDialog', 'Escape'],
    ],
  },
  {
    titleKey: 'shortcuts.group.editor',
    items: [
      ['shortcuts.save', 'Ctrl+S'],
      ['shortcuts.bold', 'Ctrl+B'],
      ['shortcuts.italic', 'Ctrl+I'],
      ['shortcuts.link', 'Ctrl+K'],
      ['shortcuts.inlineCode', 'Ctrl+`'],
      ['shortcuts.findReplace', 'Ctrl+F'],
      ['shortcuts.indent', 'Tab / Shift+Tab'],
    ],
  },
] as const

export function ShortcutsDialog() {
  const { shortcutsOpen, setShortcutsOpen } = useUI()
  const { t } = useI18n()
  return (
    <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Command className="size-4" />
          </div>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map((group) => (
            <section key={group.titleKey}>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t(group.titleKey)}
              </h3>
              <dl className="space-y-1.5">
                {group.items.map(([labelKey, shortcut]) => (
                  <div key={labelKey} className="flex items-center justify-between gap-3 py-0.5">
                    <dt className="text-[12px] text-foreground/85">{t(labelKey)}</dt>
                    <dd className="flex gap-1">
                      {shortcutLabel(shortcut)
                        .split('+')
                        .map((part) => (
                          <kbd
                            key={part}
                            className="min-w-[1.35rem] rounded border border-border bg-muted/60 px-1 py-0.5 text-center font-mono text-[9.5px] leading-3.5 text-muted-foreground"
                          >
                            {part}
                          </kbd>
                        ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <p className="mt-6 text-[11px] leading-5 text-muted-foreground">{t('shortcuts.footer')}</p>
      </DialogContent>
    </Dialog>
  )
}
