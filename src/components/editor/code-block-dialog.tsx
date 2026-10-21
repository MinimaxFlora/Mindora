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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/i18n/use-i18n'

const LANGUAGES = [
  ['text', 'Plain text'],
  ['ts', 'TypeScript'],
  ['js', 'JavaScript'],
  ['tsx', 'TSX'],
  ['jsx', 'JSX'],
  ['html', 'HTML'],
  ['css', 'CSS'],
  ['json', 'JSON'],
  ['bash', 'Bash'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['python', 'Python'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['sql', 'SQL'],
  ['yaml', 'YAML'],
  ['toml', 'TOML'],
  ['markdown', 'Markdown'],
  ['diff', 'Diff'],
  ['mermaid', 'Mermaid'],
] as const

interface CodeBlockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInsert: (language: string) => void
}

function CodeBlockDialogBody({ onOpenChange, onInsert }: Omit<CodeBlockDialogProps, 'open'>) {
  const { t } = useI18n()
  const [language, setLanguage] = React.useState('ts')
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('editor.code.title')}</DialogTitle>
        <DialogDescription>{t('editor.code.description')}</DialogDescription>
      </DialogHeader>
      <label className="block space-y-1.5">
        <span className="text-[11.5px] font-medium">{t('editor.code.language')}</span>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {value === 'text' ? t('editor.code.plainText') : label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          onClick={() => {
            onInsert(language)
            onOpenChange(false)
          }}
        >
          {t('editor.code.insert')}
        </Button>
      </DialogFooter>
    </>
  )
}

export function CodeBlockDialog(props: CodeBlockDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="sm">
        {props.open && <CodeBlockDialogBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}
