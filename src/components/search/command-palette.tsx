import {
  ArrowRight,
  Clock3,
  CornerDownLeft,
  FilePlus2,
  FileText,
  Network,
  Search,
  Settings,
  Star,
} from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { highlightMatches, SearchIndex } from '@/lib/search'
import { formatRelativeTime } from '@/lib/utils'
import { useCreateNote } from '@/hooks/use-create-note'
import { useI18n } from '@/i18n/use-i18n'
import { useData } from '@/providers/data-provider'
import { useUI } from '@/providers/ui-provider'

interface PaletteItem {
  id: string
  title: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  kind: 'note' | 'action' | 'search'
  action: () => void
}

export function CommandPalette() {
  const { searchOpen, setSearchOpen } = useUI()
  const { activeNotes, folders, recentNotes } = useData()
  const { t } = useI18n()
  const createNote = useCreateNote()
  const navigate = useNavigate()
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const deferredQuery = React.useDeferredValue(query)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const searchIndex = React.useMemo(
    () => new SearchIndex(activeNotes, folders),
    [activeNotes, folders],
  )

  const close = React.useCallback(() => {
    setSearchOpen(false)
    setQuery('')
    setActiveIndex(0)
  }, [setSearchOpen])

  const openNote = React.useCallback(
    (id: string) => {
      close()
      navigate(`/notes/${id}`)
    },
    [close, navigate],
  )

  const openPage = React.useCallback(
    (path: string) => {
      close()
      navigate(path)
    },
    [close, navigate],
  )

  const items = React.useMemo<PaletteItem[]>(() => {
    const trimmed = deferredQuery.trim()
    if (!trimmed) {
      const quickActions: PaletteItem[] = [
        {
          id: 'action-new',
          title: t('search.quickNew'),
          subtitle: t('search.quickNewDesc'),
          icon: FilePlus2,
          kind: 'action',
          action: () => {
            close()
            void createNote()
          },
        },
        {
          id: 'action-graph',
          title: t('search.quickGraph'),
          subtitle: t('search.quickGraphDesc'),
          icon: Network,
          kind: 'action',
          action: () => openPage('/graph'),
        },
        {
          id: 'action-settings',
          title: t('search.quickSettings'),
          subtitle: t('search.quickSettingsDesc'),
          icon: Settings,
          kind: 'action',
          action: () => openPage('/settings'),
        },
      ]
      const recent = recentNotes.slice(0, 5).map<PaletteItem>((note) => ({
        id: `recent-${note.id}`,
        title: note.title,
        subtitle: t('search.recentSubtitle', { time: formatRelativeTime(note.accessedAt) }),
        icon: note.favorite ? Star : Clock3,
        kind: 'note',
        action: () => openNote(note.id),
      }))
      return [...quickActions, ...recent]
    }

    const results = searchIndex.search(trimmed, { limit: 8 })
    const notes: PaletteItem[] = results.map((result) => ({
      id: result.note.id,
      title: result.note.title,
      subtitle: result.snippet,
      icon: result.note.favorite ? Star : FileText,
      kind: 'note',
      action: () => openNote(result.note.id),
    }))
    notes.push({
      id: 'search-all',
      title: t('search.allResults', { query: trimmed }),
      subtitle: t('search.openFullSearch'),
      icon: Search,
      kind: 'search',
      action: () => openPage(`/search?q=${encodeURIComponent(trimmed)}`),
    })
    notes.push({
      id: 'create-from-query',
      title: t('search.createWithTitle', { title: trimmed }),
      subtitle: t('search.createWithTitleDesc'),
      icon: FilePlus2,
      kind: 'action',
      action: () => {
        close()
        void createNote({ title: trimmed })
      },
    })
    return notes
  }, [deferredQuery, searchIndex, recentNotes, openNote, openPage, close, createNote, t])

  const handleOpenChange = (open: boolean) => {
    setSearchOpen(open)
    if (!open) {
      setQuery('')
      setActiveIndex(0)
    }
  }

  React.useEffect(() => {
    if (!searchOpen) return
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(timer)
  }, [searchOpen])

  React.useEffect(() => {
    if (!searchOpen) return
    const element = document.getElementById(`palette-item-${activeIndex}`)
    element?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, searchOpen])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % Math.max(1, items.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + items.length) % Math.max(1, items.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      items[activeIndex]?.action()
    }
  }

  return (
    <Dialog open={searchOpen} onOpenChange={handleOpenChange}>
      <DialogContent hideClose className="max-w-2xl overflow-hidden p-0">
        <DialogTitle className="sr-only">{t('search.aria')}</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-[17px] shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('search.palettePlaceholder')}
            className="h-[54px] min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground/75"
            aria-label={t('search.aria')}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground hover:bg-accent"
            aria-label={t('palette.closeAria')}
          >
            {t('palette.esc')}
          </button>
        </div>
        <div className="scrollbar-thin max-h-[min(58vh,480px)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-10 text-center text-[12.5px] text-muted-foreground">
              {t('search.paletteEmpty')}
            </p>
          ) : (
            <ul role="listbox" aria-label={t('palette.resultsAria')} className="space-y-0.5">
              {items.map((item, index) => {
                const Icon = item.icon
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      id={`palette-item-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      onClick={item.action}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        index === activeIndex ? 'bg-accent' : 'hover:bg-accent/55'
                      }`}
                    >
                      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground">
                          {highlightMatches(item.title, deferredQuery).map((part, partIndex) =>
                            part.highlighted ? (
                              <mark
                                key={partIndex}
                                className="rounded bg-mark/60 px-0.5 text-mark-foreground"
                              >
                                {part.text}
                              </mark>
                            ) : (
                              <span key={partIndex}>{part.text}</span>
                            ),
                          )}
                        </span>
                        {item.subtitle && (
                          <span className="mt-0.5 line-clamp-1 block text-[11px] leading-4 text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </span>
                      {index === activeIndex && (
                        <CornerDownLeft className="mt-1.5 size-3.5 shrink-0 text-muted-foreground/60" />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border bg-muted/35 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">↑</kbd>
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">↓</kbd>
            {t('palette.up')}
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="rounded border border-border bg-card px-1 font-mono text-[9px]">↵</kbd>
            {t('palette.enter')}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <ArrowRight className="size-3" />
            {t('palette.index')}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
