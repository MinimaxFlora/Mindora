import {
  ArrowDownWideNarrow,
  Check,
  FilePlus2,
  FolderInput,
  MoreHorizontal,
  RotateCcw,
  Rows3,
  Rows4,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/empty-state'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import type { Folder, Note, NoteScope } from '@/db/types'
import {
  deleteNotesPermanently,
  emptyTrash,
  moveNotes,
  restoreNotes,
  toggleFavorite,
  trashNotes,
} from '@/db/repository'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useI18n } from '@/i18n/use-i18n'
import { buildFolderTree, flattenFolderTree } from '@/lib/tree'
import {
  displayTitle,
  excerpt,
  formatRelativeTime,
  cn,
} from '@/lib/utils'
import { useSettings } from '@/providers/settings-provider'

type SortMode = 'updated' | 'created' | 'title'
type PendingAction =
  | { type: 'trash'; ids: string[] }
  | { type: 'delete'; ids: string[] }
  | { type: 'empty' }
  | null

interface NoteListProps {
  scope: NoteScope
  title: string
  notes: Note[]
  folders: Folder[]
  activeId?: string
  loading: boolean
  onOpen: (id: string) => void
  onCreate: () => void
  onNoteRemoved: (id: string) => void
  onNoteRestored?: (id: string) => void
}

function ScopeEmpty({ scope, onCreate }: { scope: NoteScope; onCreate: () => void }) {
  const { t } = useI18n()
  if (scope.kind === 'trash') {
    return (
      <EmptyState
        icon={Trash2}
        title={t('list.empty.trash.title')}
        description={t('list.empty.trash.description')}
      />
    )
  }
  if (scope.kind === 'favorites') {
    return (
      <EmptyState
        icon={Star}
        title={t('list.empty.favorites.title')}
        description={t('list.empty.favorites.description')}
      />
    )
  }
  if (scope.kind === 'recent') {
    return (
      <EmptyState
        icon={Search}
        title={t('list.empty.recent.title')}
        description={t('list.empty.recent.description')}
      />
    )
  }
  if (scope.kind === 'folder') {
    return (
      <EmptyState
        icon={FilePlus2}
        title={t('list.empty.folder.title')}
        description={t('list.empty.folder.description')}
        action={
          <Button size="sm" onClick={onCreate}>
            <FilePlus2 />
            {t('list.empty.folder.action')}
          </Button>
        }
      />
    )
  }
  if (scope.kind === 'tag') {
    return (
      <EmptyState
        icon={Search}
        title={t('list.empty.tag.title')}
        description={t('list.empty.tag.description')}
        action={
          <Button size="sm" onClick={onCreate}>
            <FilePlus2 />
            {t('list.empty.tag.action')}
          </Button>
        }
      />
    )
  }
  return (
    <EmptyState
      icon={FilePlus2}
      title={t('list.empty.all.title')}
      description={t('list.empty.all.description')}
      action={
        <Button size="sm" onClick={onCreate}>
          <FilePlus2 />
          {t('list.empty.all.action')}
        </Button>
      }
    />
  )
}

export function NoteList({
  scope,
  title,
  notes,
  folders,
  activeId,
  loading,
  onOpen,
  onCreate,
  onNoteRemoved,
  onNoteRestored,
}: NoteListProps) {
  const { settings, updateSettings } = useSettings()
  const { t } = useI18n()
  const [filter, setFilter] = React.useState('')
  const deferredFilter = useDebouncedValue(filter, 100)
  const [sort, setSort] = React.useState<SortMode>('updated')
  const [selectionMode, setSelectionMode] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null)
  const [moveOpen, setMoveOpen] = React.useState(false)
  const [moveTarget, setMoveTarget] = React.useState('none')

  const folderOptions = React.useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders])
  const isTrash = scope.kind === 'trash'

  const filtered = React.useMemo(() => {
    const query = deferredFilter.trim().toLocaleLowerCase('zh-CN')
    const matching = query
      ? notes.filter((note) => {
          const haystack = `${note.title}\n${note.content}\n${note.tags.join(' ')}`.toLocaleLowerCase('zh-CN')
          return query.split(/\s+/).every((term) => haystack.includes(term))
        })
      : notes
    return matching.slice().sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh-CN')
      if (sort === 'created') return b.createdAt - a.createdAt
      return b.updatedAt - a.updatedAt
    })
  }, [notes, deferredFilter, sort])

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRowClick = (id: string) => {
    if (selectionMode) toggleSelected(id)
    else onOpen(id)
  }

  const confirmPending = async () => {
    if (!pendingAction) return
    if (pendingAction.type === 'trash') {
      await trashNotes(pendingAction.ids)
      for (const id of pendingAction.ids) onNoteRemoved(id)
      toast.success(t('list.toast.trashed', { count: pendingAction.ids.length }))
    } else if (pendingAction.type === 'delete') {
      await deleteNotesPermanently(pendingAction.ids)
      for (const id of pendingAction.ids) onNoteRemoved(id)
      toast.success(t('list.toast.deleted', { count: pendingAction.ids.length }))
    } else if (pendingAction.type === 'empty') {
      const ids = notes.map((note) => note.id)
      const count = await emptyTrash()
      toast.success(
        count > 0 ? t('list.toast.empty', { count }) : t('list.toast.emptyAlready'),
      )
      for (const id of ids) onNoteRemoved(id)
    }
    setSelected(new Set())
    setSelectionMode(false)
  }

  const handleRestore = async (ids: string[]) => {
    await restoreNotes(ids)
    toast.success(t('list.toast.restored', { count: ids.length }))
    for (const id of ids) onNoteRestored?.(id)
    setSelected(new Set())
    setSelectionMode(false)
  }

  const handleMove = async () => {
    await moveNotes(Array.from(selected), moveTarget === 'none' ? null : moveTarget)
    toast.success(t('list.toast.moved', { count: selected.size }))
    setMoveOpen(false)
    setSelected(new Set())
    setSelectionMode(false)
  }

  const allSelected = filtered.length > 0 && filtered.every((note) => selected.has(note.id))
  const selectedCount = selected.size
  const summary = deferredFilter.trim()
    ? t('list.countResults', { count: filtered.length })
    : isTrash
      ? t('list.deletedCount', { count: notes.length })
      : t('list.count', { count: notes.length })

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border bg-surface/45 lg:w-[336px]">
      <div className="shrink-0 px-3.5 pb-2.5 pt-3.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-[-0.02em]">{title}</h1>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{summary}</p>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            {isTrash && notes.length > 0 && (
              <Tooltip content={t('list.emptyTrash')}>
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setPendingAction({ type: 'empty' })}
                  aria-label={t('list.emptyTrash')}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Tooltip>
            )}
            <Tooltip content={t('common.newNote')}>
              <Button size="iconSm" onClick={onCreate} aria-label={t('common.newNote')}>
                <FilePlus2 className="size-3.5" />
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder={t('list.filterPlaceholder')}
            aria-label={t('list.filterAria')}
            className="h-8 w-full rounded-md border border-border bg-card/55 pl-8 pr-8 text-[11.5px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-ring/60 focus:bg-card"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
              aria-label={t('list.clearFilter')}
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Tooltip content={selectionMode ? t('list.exitSelect') : t('list.select')}>
              <Button
                variant="ghost"
                size="iconXs"
                className={selectionMode ? 'bg-accent text-foreground' : ''}
                onClick={() => {
                  setSelectionMode((value) => !value)
                  setSelected(new Set())
                }}
                aria-label={selectionMode ? t('list.exitSelect') : t('list.select')}
                aria-pressed={selectionMode}
              >
                <Check className="size-3.5" />
              </Button>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="gap-1 px-1.5 text-muted-foreground">
                  <ArrowDownWideNarrow className="size-3.5" />
                  <span className="text-[10px]">
                    {sort === 'updated'
                      ? t('list.sort.updated')
                      : sort === 'created'
                        ? t('list.sort.created')
                        : t('list.sort.title')}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36">
                <DropdownMenuItem onSelect={() => setSort('updated')}>
                  {t('list.sort.updated')}
                  {sort === 'updated' && <Check className="ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSort('created')}>
                  {t('list.sort.created')}
                  {sort === 'created' && <Check className="ml-auto" />}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSort('title')}>
                  {t('list.sort.title')}
                  {sort === 'title' && <Check className="ml-auto" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Tooltip content={settings.listDensity === 'compact' ? t('list.comfortable') : t('list.compact')}>
            <Button
              variant="ghost"
              size="iconXs"
              className="text-muted-foreground"
              onClick={() =>
                updateSettings({
                  listDensity: settings.listDensity === 'compact' ? 'comfortable' : 'compact',
                })
              }
              aria-label={settings.listDensity === 'compact' ? t('list.comfortable') : t('list.compact')}
            >
              {settings.listDensity === 'compact' ? <Rows3 className="size-3.5" /> : <Rows4 className="size-3.5" />}
            </Button>
          </Tooltip>
        </div>
      </div>

      {selectionMode && (
        <div className="mx-3 mb-2 flex shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5 shadow-sm">
          <button
            type="button"
            onClick={() =>
              setSelected(
                allSelected ? new Set() : new Set(filtered.map((note) => note.id)),
              )
            }
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <span className={`flex size-3.5 items-center justify-center rounded border ${allSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input'}`}>
              {allSelected && <Check className="size-2.5" />}
            </span>
            {t('list.selectAll')}
          </button>
          <span className="text-[10px] text-muted-foreground">{t('list.selected', { count: selectedCount })}</span>
          <div className="ml-auto flex items-center gap-0.5">
            {isTrash ? (
              <>
                <Tooltip content={t('common.restore')}>
                  <Button
                    variant="ghost"
                    size="iconXs"
                    disabled={selectedCount === 0}
                    onClick={() => void handleRestore(Array.from(selected))}
                    aria-label={t('list.restoreAria')}
                  >
                    <RotateCcw className="size-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content={t('common.deleteForever')}>
                  <Button
                    variant="ghost"
                    size="iconXs"
                    className="text-destructive"
                    disabled={selectedCount === 0}
                    onClick={() => setPendingAction({ type: 'delete', ids: Array.from(selected) })}
                    aria-label={t('list.deleteSelectedAria')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Tooltip>
              </>
            ) : (
              <>
                <Tooltip content={t('common.move')}>
                  <Button
                    variant="ghost"
                    size="iconXs"
                    disabled={selectedCount === 0}
                    onClick={() => setMoveOpen(true)}
                    aria-label={t('list.moveAria')}
                  >
                    <FolderInput className="size-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content={t('editor.moveToTrash')}>
                  <Button
                    variant="ghost"
                    size="iconXs"
                    className="text-destructive"
                    disabled={selectedCount === 0}
                    onClick={() => setPendingAction({ type: 'trash', ids: Array.from(selected) })}
                    aria-label={t('list.trashSelectedAria')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      )}

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
        {loading ? (
          <div className="space-y-2 pt-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-transparent px-3 py-3">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-2 h-2.5 w-full" />
                <Skeleton className="mt-1.5 h-2.5 w-2/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          deferredFilter.trim() ? (
            <EmptyState
              icon={Search}
              title={t('list.empty.search.title')}
              description={t('list.empty.search.description')}
              action={
                <Button size="sm" variant="secondary" onClick={() => setFilter('')}>
                  {t('list.empty.search.action')}
                </Button>
              }
            />
          ) : (
            <ScopeEmpty scope={scope} onCreate={onCreate} />
          )
        ) : (
          <div className={cn('space-y-1', settings.listDensity === 'compact' && 'space-y-0.5')}>
            {filtered.map((note) => {
              const active = note.id === activeId
              const checked = selected.has(note.id)
              return (
                <div
                  key={note.id}
                  className={cn(
                    'note-row group',
                    active && 'data-[active=true]',
                    settings.listDensity === 'compact' ? '!px-2.5 !py-2' : '',
                  )}
                  data-active={active}
                  data-selected={checked}
                  data-testid="note-row"
                >
                  <div className="flex items-start gap-2">
                    {selectionMode && (
                      <button
                        type="button"
                        onClick={() => toggleSelected(note.id)}
                        className={`mt-0.5 flex size-3.5 shrink-0 items-center justify-center rounded border ${
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input bg-card'
                        }`}
                        aria-label={
                          checked
                            ? t('list.deselectAria', { title: note.title })
                            : t('list.selectAria', { title: note.title })
                        }
                        aria-pressed={checked}
                      >
                        {checked && <Check className="size-2.5" />}
                      </button>
                    )}
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleRowClick(note.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <div className="flex items-start gap-1.5">
                        <h2 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold leading-[1.45] text-foreground">
                          {displayTitle(note.title)}
                        </h2>
                      </div>
                      {settings.listDensity !== 'compact' && (
                        <p className="mt-1 line-clamp-2 text-[10.5px] leading-[1.55] text-muted-foreground">
                          {(() => {
                            const text = excerpt(note.content, 120)
                            const normalizedTitle = note.title.trim()
                            if (normalizedTitle && text.startsWith(normalizedTitle)) {
                              return text.slice(normalizedTitle.length).replace(/^[\s:：·-]+/, '')
                            }
                            return text
                          })()}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[9.5px] tabular-nums text-muted-foreground/70">
                          {isTrash && note.trashedAt
                            ? t('common.deletedAt', { time: formatRelativeTime(note.trashedAt) })
                            : formatRelativeTime(note.updatedAt)}
                        </span>
                        {note.tags.slice(0, settings.listDensity === 'compact' ? 1 : 2).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="h-[17px] max-w-[6.5rem] truncate px-1.5 text-[8.5px]"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {note.tags.length > (settings.listDensity === 'compact' ? 1 : 2) && (
                          <span className="text-[8.5px] text-muted-foreground/60">
                            +{note.tags.length - (settings.listDensity === 'compact' ? 1 : 2)}
                          </span>
                        )}
                      </div>
                    </button>
                    {!selectionMode && (
                      <div className="flex shrink-0 flex-col items-center gap-0.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/8 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                              aria-label={t('list.moreAria', { title: note.title })}
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {isTrash ? (
                              <>
                                <DropdownMenuItem onSelect={() => void handleRestore([note.id])}>
                                  <RotateCcw /> {t('common.restore')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => setPendingAction({ type: 'delete', ids: [note.id] })}
                                >
                                  <Trash2 /> {t('common.deleteForever')}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    void toggleFavorite(note.id).then((favorite) =>
                                      toast.success(
                                        favorite ? t('list.toast.favoriteAdded') : t('list.toast.favoriteRemoved'),
                                      ),
                                    )
                                  }}
                                >
                                  <Star /> {note.favorite ? t('common.unfavorite') : t('common.favorite')}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  destructive
                                  onSelect={() => setPendingAction({ type: 'trash', ids: [note.id] })}
                                >
                                  <Trash2 /> {t('editor.moveToTrash')}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {!isTrash && (
                          <button
                            type="button"
                            className={`flex size-6 items-center justify-center rounded transition-colors hover:bg-foreground/8 ${
                              note.favorite
                                ? 'text-warning'
                                : 'text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
                            }`}
                            onClick={() => {
                              void toggleFavorite(note.id)
                            }}
                            aria-label={
                              note.favorite
                                ? t('list.unfavoriteAria', { title: note.title })
                                : t('list.favoriteAria', { title: note.title })
                            }
                          >
                            <Star className="size-3" fill={note.favorite ? 'currentColor' : 'none'} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex h-7 shrink-0 items-center justify-between border-t border-border px-3 text-[9px] text-muted-foreground/70">
        <span>{t('list.footer.localAuto')}</span>
        <span>{notes.length > 0 ? t('common.indexedDb') : t('common.waitingFirstNote')}</span>
      </div>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('list.move.title', { count: selectedCount })}</DialogTitle>
            <DialogDescription>{t('list.move.description')}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="text-[11.5px] font-medium">{t('list.move.target')}</span>
            <Select value={moveTarget} onValueChange={setMoveTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('list.move.uncategorized')}</SelectItem>
                {folderOptions.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {'— '.repeat(Math.min(folder.depth, 4))}
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void handleMove()} disabled={selectedCount === 0}>
              {t('list.move.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
        title={
          pendingAction?.type === 'empty'
            ? t('list.confirm.empty.title')
            : pendingAction?.type === 'delete'
              ? t('list.confirm.delete.title')
              : t('list.confirm.trash.title')
        }
        description={
          pendingAction?.type === 'empty'
            ? t('list.confirm.empty.description')
            : pendingAction?.type === 'delete'
              ? t('list.confirm.delete.description', { count: pendingAction.ids.length })
              : t('list.confirm.trash.description', { count: pendingAction?.ids.length ?? 0 })
        }
        confirmLabel={
          pendingAction?.type === 'empty'
            ? t('list.confirm.empty.confirm')
            : pendingAction?.type === 'delete'
              ? t('list.confirm.delete.confirm')
              : t('list.confirm.trash.confirm')
        }
        destructive
        onConfirm={confirmPending}
      />
    </aside>
  )
}
