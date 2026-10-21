import { ArrowUpRight, Clock3, FilePlus2, FileText, Search, Star, X } from 'lucide-react'
import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateNote } from '@/hooks/use-create-note'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useI18n } from '@/i18n/use-i18n'
import { highlightMatches, SearchIndex } from '@/lib/search'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useData } from '@/providers/data-provider'

type SearchSort = 'relevance' | 'updated'

function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightMatches(text, query).map((part, index) =>
        part.highlighted ? (
          <mark key={index} className="search-highlight">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

export function SearchPage() {
  const { activeNotes, folders, recentNotes, loading } = useData()
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const paramQuery = params.get('q') ?? ''
  const [query, setQuery] = React.useState(paramQuery)
  const [sort, setSort] = React.useState<SearchSort>('relevance')
  const deferredQuery = useDebouncedValue(query, 140)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const index = React.useMemo(() => new SearchIndex(activeNotes, folders), [activeNotes, folders])
  const results = React.useMemo(
    () => index.search(deferredQuery, { sort, limit: 100 }),
    [index, deferredQuery, sort],
  )

  React.useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    setParams(query.trim() ? { q: query.trim() } : {}, { replace: true })
  }

  const updateQuery = (value: string) => {
    setParams(value.trim() ? { q: value } : {}, { replace: true })
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
        <div className="mb-7">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Search
          </p>
          <h1 className="mt-1.5 text-[25px] font-semibold tracking-[-0.035em]">{t('search.title')}</h1>
          <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
            {t('search.description')}
          </p>
        </div>

        <form onSubmit={commitSearch} className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder={t('search.placeholder')}
            className="h-12 w-full rounded-xl border border-border bg-card pl-11 pr-24 text-[14px] text-foreground shadow-soft outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus:border-ring/65 focus:ring-2 focus:ring-ring/12"
            aria-label={t('search.aria')}
            spellCheck={false}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setParams({})
                inputRef.current?.focus()
              }}
              className="absolute right-16 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label={t('search.clear')}
            >
              <X className="size-3.5" />
            </button>
          )}
          <Button type="submit" size="sm" className="absolute right-2.5 top-1/2 h-7 -translate-y-1/2">
            {t('search.submit')}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10.5px] text-muted-foreground">
            {deferredQuery.trim()
              ? loading
                ? t('search.indexing')
                : t('search.indexed', { count: results.length, notes: index.size })
              : t('search.summary', { notes: index.size, folders: folders.length })}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="xs" className="text-muted-foreground">
                {sort === 'relevance' ? t('search.sort.relevance') : t('search.sort.updated')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSort('relevance')}>{t('search.sort.relevance')}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSort('updated')}>{t('search.sort.updated')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-xl border border-border bg-card p-4">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-2/3" />
                </div>
              ))}
            </div>
          ) : !deferredQuery.trim() ? (
            <div>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('search.recent')}
              </h2>
              <div className="space-y-1">
                {recentNotes.slice(0, 6).map((note) => (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => navigate(`/notes/${note.id}`)}
                    className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-card"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">{note.title}</span>
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        {formatRelativeTime(note.updatedAt)}
                      </span>
                    </span>
                    <ArrowUpRight className="size-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </button>
                ))}
              </div>
              {recentNotes.length === 0 && (
                <EmptyState
                  icon={Search}
                  title={t('search.emptyStart.title')}
                  description={t('search.emptyStart.description')}
                  action={<Button onClick={() => void createNote()}>{t('search.emptyStart.action')}</Button>}
                />
              )}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={Search}
              title={t('search.noResults', { query: deferredQuery.trim() })}
              description={t('search.noResultsDesc')}
              action={
                <Button onClick={() => void createNote({ title: deferredQuery.trim() })}>
                  <FilePlus2 />
                  {t('search.createFromQuery', { query: deferredQuery.trim().slice(0, 20) })}
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {results.map((result) => (
                <li key={result.note.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/notes/${result.note.id}`)}
                    className="group w-full rounded-xl border border-border/80 bg-card p-4 text-left shadow-[0_1px_0_rgb(0_0_0/0.015)] transition-[border-color,box-shadow] hover:border-input hover:shadow-soft"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">
                          <HighlightedText text={result.note.title} query={deferredQuery} />
                        </h2>
                        <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-[1.65] text-muted-foreground">
                          <HighlightedText text={result.snippet} query={deferredQuery} />
                        </p>
                      </div>
                      {result.note.favorite ? (
                        <Star className="size-3.5 shrink-0 text-warning" fill="currentColor" />
                      ) : (
                        <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {result.note.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[9px]">
                          #{tag}
                        </Badge>
                      ))}
                      <span className="ml-auto flex items-center gap-1 text-[9.5px] text-muted-foreground/75">
                        <Clock3 className="size-2.5" />
                        {formatRelativeTime(result.note.updatedAt)}
                      </span>
                      {result.matchedIn.includes('content') && (
                        <span className="text-[9px] text-muted-foreground/55">{t('search.contentMatch')}</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={cn('mt-8 text-center text-[9.5px] text-muted-foreground/60', !results.length && 'hidden')}>
          {t('search.footer')}
        </p>
      </div>
    </div>
  )
}
