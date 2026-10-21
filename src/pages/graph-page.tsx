import { FilePlus2, FilterX, Network, Search } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/common/empty-state'
import { GraphCanvas } from '@/components/graph/graph-canvas'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import { useCreateNote } from '@/hooks/use-create-note'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useI18n } from '@/i18n/use-i18n'
import { buildKnowledgeGraph, filterGraph } from '@/lib/graph'
import { buildFolderTree, flattenFolderTree } from '@/lib/tree'
import { useData } from '@/providers/data-provider'

const MAX_DISPLAY_NODES = 320

export function GraphPage() {
  const { notes, activeNotes, folders } = useData()
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const { t } = useI18n()
  const [query, setQuery] = React.useState('')
  const debouncedQuery = useDebouncedValue(query, 220)
  const [tag, setTag] = React.useState('all')
  const [folderId, setFolderId] = React.useState('all')
  const [isolatedOnly, setIsolatedOnly] = React.useState(false)

  const graph = React.useMemo(() => buildKnowledgeGraph(notes, folders), [notes, folders])
  const filtered = React.useMemo(
    () =>
      filterGraph(graph, {
        query: debouncedQuery,
        tag: tag === 'all' ? null : tag,
        folderId: folderId === 'all' ? null : folderId,
        isolatedOnly,
      }),
    [graph, debouncedQuery, tag, folderId, isolatedOnly],
  )

  const caps = React.useMemo(() => {
    if (filtered.nodes.length <= MAX_DISPLAY_NODES) return { graph: filtered, truncated: 0 }
    const nodes = filtered.nodes
      .slice()
      .sort((a, b) => b.degree - a.degree)
      .slice(0, MAX_DISPLAY_NODES)
    const ids = new Set(nodes.map((node) => node.id))
    return {
      graph: {
        nodes,
        edges: filtered.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
        unresolvedCount: filtered.unresolvedCount,
      },
      truncated: filtered.nodes.length - nodes.length,
    }
  }, [filtered])

  const tags = React.useMemo(
    () => Array.from(new Set(activeNotes.flatMap((note) => note.tags))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [activeNotes],
  )
  const folderOptions = React.useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders])
  const isolatedCount = graph.nodes.filter((node) => node.degree === 0).length
  const filtersActive = Boolean(debouncedQuery.trim()) || tag !== 'all' || folderId !== 'all' || isolatedOnly

  const resetFilters = () => {
    setQuery('')
    setTag('all')
    setFolderId('all')
    setIsolatedOnly(false)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-card/45 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Network className="size-4 text-primary" />
              <h1 className="text-[18px] font-semibold tracking-[-0.025em]">{t('graph.title')}</h1>
              <Badge variant="outline">{t('graph.countNodes', { count: graph.nodes.length })}</Badge>
              <Badge variant="outline">{t('graph.countEdges', { count: graph.edges.length })}</Badge>
            </div>
            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
              {t('graph.description', { count: isolatedCount })}
              {graph.unresolvedCount > 0 &&
                t('graph.descriptionUnresolved', { count: graph.unresolvedCount })}
            </p>
          </div>
          <Button
            size="sm"
            className="ml-auto hidden sm:inline-flex"
            onClick={() => void createNote()}
          >
            <FilePlus2 />
            {t('graph.newNote')}
          </Button>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('graph.search')}
              className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-3 text-[11.5px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring/60"
              aria-label={t('graph.searchAria')}
            />
          </div>
          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="h-8 w-auto min-w-[7.5rem] text-[11px]">
              <SelectValue placeholder={t('graph.allTags')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('graph.allTags')}</SelectItem>
              {tags.map((value) => (
                <SelectItem key={value} value={value}>
                  #{value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={folderId} onValueChange={setFolderId}>
            <SelectTrigger className="h-8 w-auto min-w-[7.5rem] text-[11px]">
              <SelectValue placeholder={t('graph.allFolders')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('graph.allFolders')}</SelectItem>
              {folderOptions.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {'— '.repeat(Math.min(folder.depth, 3))}
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Tooltip content={t('graph.isolatedTooltip')}>
            <Button
              variant={isolatedOnly ? 'secondary' : 'ghost'}
              size="sm"
              className="h-8 gap-1.5 text-[11px]"
              onClick={() => setIsolatedOnly((value) => !value)}
              aria-pressed={isolatedOnly}
            >
              <span
                className={`size-1.5 rounded-full border ${
                  isolatedOnly ? 'border-primary bg-primary' : 'border-muted-foreground'
                }`}
              />
              {t('graph.isolatedFilter')}
            </Button>
          </Tooltip>
          {filtersActive && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-[11px]" onClick={resetFilters}>
              <FilterX />
              {t('graph.reset')}
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 sm:hidden"
            onClick={() => void createNote()}
            aria-label={t('graph.newNote')}
          >
            <FilePlus2 />
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        {graph.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={Network}
              title={t('graph.empty.title')}
              description={t('graph.empty.description')}
              action={<Button onClick={() => void createNote()}>{t('graph.newNote')}</Button>}
            />
          </div>
        ) : filtered.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={Network}
              title={t('graph.noMatch.title')}
              description={t('graph.noMatch.description')}
              action={<Button variant="secondary" onClick={resetFilters}>{t('graph.resetFilters')}</Button>}
            />
          </div>
        ) : (
          <GraphCanvas
            graph={caps.graph}
            folders={folders}
            query={debouncedQuery}
            onOpen={(id) => navigate(`/notes/${id}`)}
          />
        )}
        {caps.truncated > 0 && (
          <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border border-border bg-popover/95 px-3 py-1 text-[9.5px] text-muted-foreground shadow-sm">
            {t('graph.truncated', { shown: MAX_DISPLAY_NODES, hidden: caps.truncated })}
          </div>
        )}
      </div>
    </div>
  )
}
