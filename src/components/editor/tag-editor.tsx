import { Plus, X } from 'lucide-react'
import * as React from 'react'

import { useI18n } from '@/i18n/use-i18n'
import { cleanTags, normalizeTag } from '@/lib/utils'

interface TagEditorProps {
  tags: string[]
  suggestions: string[]
  onChange: (tags: string[]) => void
}

export function TagEditor({ tags, suggestions, onChange }: TagEditorProps) {
  const { t } = useI18n()
  const [value, setValue] = React.useState('')
  const listId = React.useId()

  const commit = () => {
    const tag = normalizeTag(value)
    if (!tag) {
      setValue('')
      return
    }
    if (!tags.includes(tag)) {
      onChange(cleanTags([...tags, tag]))
    }
    setValue('')
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card/70 pl-2 pr-1 text-[10.5px] text-muted-foreground"
        >
          <span className="text-muted-foreground/55">#</span>
          {tag}
          <button
            type="button"
            className="flex size-4 items-center justify-center rounded-full hover:bg-foreground/8 hover:text-foreground"
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            aria-label={t('editor.tags.remove', { tag })}
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      <label className="inline-flex h-6 min-w-[6.2rem] items-center gap-1 rounded-full px-1.5 text-[10.5px] text-muted-foreground/80 focus-within:bg-accent/60">
        <Plus className="size-3 shrink-0" />
        <span className="sr-only">{t('editor.tags.add')}</span>
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ',') {
              event.preventDefault()
              commit()
            } else if (event.key === 'Backspace' && !value && tags.length > 0) {
              onChange(tags.slice(0, -1))
            } else if (event.key === 'Escape') {
              setValue('')
              event.currentTarget.blur()
            }
          }}
          onBlur={commit}
          list={listId}
          placeholder={t('editor.tags.add')}
          className="w-full min-w-0 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground/55"
          maxLength={32}
          aria-label={t('editor.tags.add')}
        />
        <datalist id={listId}>
          {suggestions
            .filter((suggestion) => !tags.includes(suggestion))
            .slice(0, 30)
            .map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
        </datalist>
      </label>
    </div>
  )
}
