import {
  ChevronRight,
  Clock3,
  FilePlus2,
  Files,
  FolderClosed,
  FolderPlus,
  Globe2,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Search,
  Settings,
  Star,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { LogoMark, Wordmark } from '@/components/common/logo'
import { PromptDialog } from '@/components/common/prompt-dialog'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import type { Folder } from '@/db/types'
import {
  createFolder,
  deleteFolder,
  deleteTag,
  renameFolder,
  renameTag,
} from '@/db/repository'
import { useCreateNote } from '@/hooks/use-create-note'
import { useI18n } from '@/i18n/use-i18n'
import { LOCALES, localeLabel } from '@/lib/locale'
import { folderDisplayPath, buildFolderTree, getDescendantFolderIds, type FolderNode } from '@/lib/tree'
import { folderPath, parseScopePath, tagPath } from '@/lib/paths'
import { cn } from '@/lib/utils'
import { useData } from '@/providers/data-provider'
import { useSettings } from '@/providers/settings-provider'
import { SyncIndicator } from '@/providers/sync-provider'
import { useUI } from '@/providers/ui-provider'

type DialogState =
  | { type: 'create-folder'; parentId: string | null }
  | { type: 'rename-folder'; folder: Folder }
  | { type: 'delete-folder'; folder: Folder }
  | { type: 'rename-tag'; tag: string }
  | { type: 'delete-tag'; tag: string }
  | null

interface SidebarProps {
  mobile?: boolean
}

interface NavItemProps {
  to: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  active: boolean
  count?: number
  collapsed: boolean
  onNavigate?: () => void
}

function NavItem({ to, icon: Icon, label, active, count, collapsed, onNavigate }: NavItemProps) {
  const link = (
    <Link
      to={to}
      className={cn(
        'nav-item',
        collapsed && 'justify-center px-0',
      )}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      onClick={onNavigate}
    >
      <Icon className="size-[17px] shrink-0" strokeWidth={1.8} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-[12.5px]">{label}</span>
          {typeof count === 'number' && count > 0 && (
            <span className="text-[10.5px] tabular-nums text-muted-foreground">{count}</span>
          )}
        </>
      )}
    </Link>
  )
  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        {link}
      </Tooltip>
    )
  }
  return link
}

interface FolderRowProps {
  node: FolderNode
  counts: Map<string, number>
  activeFolderId: string | null
  collapsed: boolean
  onNavigate?: () => void
  onAction: (action: DialogState) => void
}

function FolderRow({ node, counts, activeFolderId, collapsed, onNavigate, onAction }: FolderRowProps) {
  const { t } = useI18n()
  const active = activeFolderId === node.id
  const count = counts.get(node.id) ?? 0
  return (
    <div>
      <div
        className={cn(
          'group relative flex items-center rounded-md transition-colors',
          active
            ? 'bg-primary/10 text-primary'
            : 'text-sidebar-foreground/78 hover:bg-foreground/[0.045] hover:text-sidebar-foreground',
        )}
        style={{ paddingLeft: `${Math.min(node.depth, 5) * 12}px` }}
      >
        <Link
          to={folderPath(node.id)}
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-[5px] pl-1.5 pr-1 text-[12px]"
          aria-current={active ? 'page' : undefined}
        >
          {node.depth > 0 && (
            <ChevronRight className="size-3 shrink-0 text-muted-foreground/40" />
          )}
          <FolderClosed className="size-[14px] shrink-0 opacity-70" strokeWidth={1.7} />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {count > 0 && <span className="text-[10px] tabular-nums opacity-55">{count}</span>}
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/8 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
              aria-label={t('nav.manageFolder', { name: node.name })}
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right" className="w-48">
            <DropdownMenuItem onSelect={() => onAction({ type: 'create-folder', parentId: node.id })}>
              <FolderPlus /> {t('nav.newSubfolder')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction({ type: 'rename-folder', folder: node })}>
              <Pencil /> {t('common.rename')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onSelect={() => onAction({ type: 'delete-folder', folder: node })}>
              <Trash2 /> {t('nav.deleteFolder')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {node.children.length > 0 && !collapsed && (
        <div>
          {node.children.map((child) => (
            <FolderRow
              key={child.id}
              node={child}
              counts={counts}
              activeFolderId={activeFolderId}
              collapsed={collapsed}
              onNavigate={onNavigate}
              onAction={onAction}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LanguageMenu({ collapsed }: { collapsed: boolean }) {
  const { t, locale, setLocale } = useI18n()
  const current = LOCALES.find((item) => item.value === locale)
  const button = (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size={collapsed ? 'icon' : 'sm'}
        className={collapsed ? 'text-muted-foreground' : 'justify-start gap-1.5 text-muted-foreground'}
        aria-label={t('lang.switchAria', { language: localeLabel(locale) })}
        data-testid="language-menu"
      >
        <Globe2 className="size-4" />
        {!collapsed && <span className="text-[10px]">{current?.shortLabel ?? 'EN'}</span>}
      </Button>
    </DropdownMenuTrigger>
  )
  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip content={t('language.menu')} side="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
      <DropdownMenuContent align="start" side={collapsed ? 'right' : 'top'} className="w-44">
        {LOCALES.map((item) => (
          <DropdownMenuItem key={item.value} onSelect={() => setLocale(item.value)}>
            <span className="flex-1">{item.label}</span>
            {item.value === locale && <span aria-hidden>✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function Sidebar({ mobile = false }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { settings, updateSettings } = useSettings()
  const { folders, activeNotes, favoriteNotes, recentNotes, trashedNotes } = useData()
  const { setSearchOpen, setMobileNavOpen } = useUI()
  const createNote = useCreateNote()
  const [dialog, setDialog] = React.useState<DialogState>(null)

  const collapsed = !mobile && settings.sidebarCollapsed
  const route = parseScopePath(location.pathname)
  const activeFolderId = route.scope.kind === 'folder' ? route.scope.folderId : null
  const activeTag = route.scope.kind === 'tag' ? route.scope.tag : null

  const folderCounts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const note of activeNotes) {
      if (!note.folderId) continue
      map.set(note.folderId, (map.get(note.folderId) ?? 0) + 1)
    }
    return map
  }, [activeNotes])

  const tagCounts = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const note of activeNotes) {
      for (const tag of note.tags) map.set(tag, (map.get(tag) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
  }, [activeNotes])

  const tree = React.useMemo(() => buildFolderTree(folders), [folders])
  const closeMobile = mobile ? () => setMobileNavOpen(false) : undefined

  const handleNewNote = async () => {
    closeMobile?.()
    await createNote()
  }

  const handleFolderDialog = async (value: string) => {
    if (!dialog) return
    if (dialog.type === 'create-folder') {
      await createFolder(value, dialog.parentId)
      toast.success(t('confirm.folderCreated'))
    } else if (dialog.type === 'rename-folder') {
      await renameFolder(dialog.folder.id, value)
      toast.success(t('confirm.folderRenamed'))
    }
  }

  const handleDeleteFolder = async () => {
    if (!dialog || dialog.type !== 'delete-folder') return
    const result = await deleteFolder(dialog.folder.id)
    const descendants = getDescendantFolderIds(folders, dialog.folder.id)
    if (route.scope.kind === 'folder' && descendants.has(route.scope.folderId)) {
      navigate('/notes')
    }
    const destination = dialog.folder.parentId ? t('confirm.upperFolder') : t('confirm.uncategorized')
    toast.success(t('confirm.folderDeleted'), {
      description:
        result.movedNotes > 0
          ? t('confirm.folderDeletedDesc', { count: result.movedNotes, destination })
          : undefined,
    })
  }

  const handleRenameTag = async (value: string) => {
    if (!dialog || dialog.type !== 'rename-tag') return
    const next = value.trim().replace(/^#+/, '')
    if (!next) throw new Error(t('error.tagNameRequired'))
    const changed = await renameTag(dialog.tag, next)
    if (activeTag === dialog.tag) navigate(tagPath(next))
    toast.success(t('confirm.tagRenamed', { count: changed }))
  }

  const handleDeleteTag = async () => {
    if (!dialog || dialog.type !== 'delete-tag') return
    const changed = await deleteTag(dialog.tag)
    if (activeTag === dialog.tag) navigate('/notes')
    toast.success(t('confirm.tagRemoved', { count: changed }))
  }

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
        collapsed ? 'w-[66px]' : 'w-[264px]',
        mobile && 'w-full',
      )}
      aria-label={t('nav.main')}
    >
      <div
        className={cn(
          'flex h-[58px] shrink-0 items-center gap-2.5 px-3',
          collapsed && 'justify-center px-0',
        )}
      >
        <Link
          to="/notes"
          onClick={closeMobile}
          className={cn('flex min-w-0 items-center gap-2.5 rounded-md', collapsed && 'justify-center')}
          aria-label={t('nav.home')}
        >
          <LogoMark />
          {!collapsed && <Wordmark />}
        </Link>
        {!collapsed && (
          <div className="ml-auto flex items-center gap-0.5">
            {!mobile && (
              <Tooltip content={t('nav.collapse')} side="bottom">
                <Button
                  variant="ghost"
                  size="iconSm"
                  className="text-muted-foreground"
                  onClick={() => updateSettings({ sidebarCollapsed: true })}
                  aria-label={t('nav.collapse')}
                >
                  <PanelLeftClose className="size-[15px]" />
                </Button>
              </Tooltip>
            )}
            {mobile && (
              <Button
                variant="ghost"
                size="iconSm"
                className="text-muted-foreground"
                onClick={closeMobile}
                aria-label={t('nav.close')}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={cn('shrink-0 space-y-1.5 px-2.5 pb-2', collapsed && 'px-2')}>
        {collapsed ? (
          <>
            <Tooltip content={`${t('common.search')} (⌘K)`} side="right">
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={() => setSearchOpen(true)}
                aria-label={t('common.search')}
              >
                <Search className="size-[17px]" />
              </Button>
            </Tooltip>
            <Tooltip content={`${t('nav.newNote')} (Alt+N)`} side="right">
              <Button
                variant="default"
                size="icon"
                className="w-full"
                onClick={() => void handleNewNote()}
                aria-label={t('nav.newNote')}
                data-testid="sidebar-new-note"
              >
                <FilePlus2 className="size-[17px]" />
              </Button>
            </Tooltip>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-full items-center gap-2 rounded-md border border-border/80 bg-card/55 px-2.5 text-[12px] text-muted-foreground transition-colors hover:border-input hover:bg-card"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">{t('nav.searchPlaceholder')}</span>
              <kbd className="rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[9px] leading-3">
                ⌘K
              </kbd>
            </button>
            <Button
              size="sm"
              className="h-8 w-full justify-start gap-2 px-2.5"
              onClick={() => void handleNewNote()}
              data-testid="sidebar-new-note"
            >
              <FilePlus2 className="size-4" />
              {t('nav.newNote')}
              <span className="ml-auto font-mono text-[9px] opacity-55">Alt+N</span>
            </Button>
          </>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-2.5 pb-5">
        <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
          <NavItem
            to="/notes"
            icon={Files}
            label={t('nav.allNotes')}
            active={route.scope.kind === 'all'}
            count={activeNotes.length}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
          <NavItem
            to="/favorites"
            icon={Star}
            label={t('nav.favorites')}
            active={route.scope.kind === 'favorites'}
            count={favoriteNotes.length}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
          <NavItem
            to="/recent"
            icon={Clock3}
            label={t('nav.recent')}
            active={route.scope.kind === 'recent'}
            count={recentNotes.length}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
          <NavItem
            to="/graph"
            icon={Network}
            label={t('nav.graph')}
            active={location.pathname === '/graph'}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
        </div>

        {!collapsed && (
          <>
            <div className="mb-1.5 mt-5 flex items-center justify-between px-1.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/75">
                {t('nav.folders')}
              </span>
              <Tooltip content={t('nav.newFolder')} side="top">
                <button
                  type="button"
                  onClick={() => setDialog({ type: 'create-folder', parentId: null })}
                  className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
                  aria-label={t('nav.newFolder')}
                >
                  <FolderPlus className="size-3.5" />
                </button>
              </Tooltip>
            </div>
            <div className="space-y-px">
              {tree.length === 0 ? (
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-2 text-left text-[11px] text-muted-foreground/75 hover:bg-foreground/4"
                  onClick={() => setDialog({ type: 'create-folder', parentId: null })}
                >
                  {t('nav.createFirstFolder')}
                </button>
              ) : (
                tree.map((node) => (
                  <FolderRow
                    key={node.id}
                    node={node}
                    counts={folderCounts}
                    activeFolderId={activeFolderId}
                    collapsed={collapsed}
                    onNavigate={closeMobile}
                    onAction={setDialog}
                  />
                ))
              )}
            </div>

            <div className="mb-1.5 mt-5 flex items-center justify-between px-1.5">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/75">
                {t('nav.tags')}
              </span>
              <Tag className="size-3.5 text-muted-foreground/50" aria-hidden />
            </div>
            <div className="space-y-px">
              {tagCounts.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] leading-4 text-muted-foreground/70">
                  {t('nav.noTags')}
                </p>
              ) : (
                tagCounts.slice(0, 24).map(([tag, count]) => (
                  <div
                    key={tag}
                    className={cn(
                      'group flex items-center rounded-md transition-colors',
                      activeTag === tag
                        ? 'bg-primary/10 text-primary'
                        : 'text-sidebar-foreground/72 hover:bg-foreground/[0.045] hover:text-sidebar-foreground',
                    )}
                  >
                    <Link
                      to={tagPath(tag)}
                      onClick={closeMobile}
                      className="flex min-w-0 flex-1 items-center gap-1.5 py-[5px] pl-2 pr-1 text-[12px]"
                    >
                      <span className="text-muted-foreground/60">#</span>
                      <span className="truncate">{tag}</span>
                      <span className="ml-auto text-[10px] tabular-nums opacity-50">{count}</span>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="mr-1 flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-foreground/8 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label={t('nav.manageTag', { tag })}
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right" className="w-44">
                        <DropdownMenuItem onSelect={() => setDialog({ type: 'rename-tag', tag })}>
                          <Pencil /> {t('nav.renameTag')}
                        </DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDialog({ type: 'delete-tag', tag })}>
                          <Trash2 /> {t('nav.removeTag')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </nav>

      <div className={cn('shrink-0 border-t border-border/80 px-2.5 py-2', collapsed && 'px-2')}>
        <div className={cn('space-y-0.5', collapsed && 'space-y-1')}>
          <NavItem
            to="/trash"
            icon={Trash2}
            label={t('nav.trash')}
            active={route.scope.kind === 'trash'}
            count={trashedNotes.length}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
          <NavItem
            to="/settings"
            icon={Settings}
            label={t('nav.settings')}
            active={location.pathname === '/settings'}
            collapsed={collapsed}
            onNavigate={closeMobile}
          />
          <div className={cn('flex items-center', collapsed ? 'flex-col justify-center gap-1' : 'justify-between px-1 pt-0.5')}>
            <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'gap-0.5')}>
              <ThemeToggle collapsed={collapsed} />
              <LanguageMenu collapsed={collapsed} />
            </div>
            {!collapsed && <SyncIndicator />}
          </div>
          {collapsed && (
            <Tooltip content={t('nav.expand')} side="right">
              <Button
                variant="ghost"
                size="icon"
                className="w-full"
                onClick={() => updateSettings({ sidebarCollapsed: false })}
                aria-label={t('nav.expand')}
              >
                <PanelLeftOpen className="size-[17px]" />
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      <PromptDialog
        open={
          dialog?.type === 'create-folder' ||
          dialog?.type === 'rename-folder'
        }
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.type === 'rename-folder' ? t('confirm.renameFolder') : t('confirm.newFolder')}
        description={
          dialog?.type === 'create-folder' && dialog.parentId
            ? t('confirm.childFolderHint', { path: folderDisplayPath(folders, dialog.parentId) })
            : undefined
        }
        label={t('confirm.folderName')}
        defaultValue={dialog?.type === 'rename-folder' ? dialog.folder.name : ''}
        confirmLabel={dialog?.type === 'rename-folder' ? t('confirm.save') : t('confirm.create')}
        placeholder={t('confirm.folderPlaceholder')}
        onSubmit={handleFolderDialog}
      />

      <ConfirmDialog
        open={dialog?.type === 'delete-folder'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('confirm.deleteFolderTitle')}
        description={
          dialog?.type === 'delete-folder'
            ? t('confirm.deleteFolderDesc', {
                name: dialog.folder.name,
                destination: dialog.folder.parentId
                  ? t('confirm.upperFolder')
                  : t('confirm.uncategorized'),
              })
            : ''
        }
        confirmLabel={t('confirm.deleteFolderConfirm')}
        destructive
        onConfirm={handleDeleteFolder}
      />

      <PromptDialog
        open={dialog?.type === 'rename-tag'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('confirm.renameTag')}
        description={
          dialog?.type === 'rename-tag'
            ? t('confirm.renameTagDesc', { tag: dialog.tag })
            : undefined
        }
        label={t('confirm.tagName')}
        defaultValue={dialog?.type === 'rename-tag' ? dialog.tag : ''}
        confirmLabel={t('common.rename')}
        onSubmit={handleRenameTag}
      />

      <ConfirmDialog
        open={dialog?.type === 'delete-tag'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t('confirm.removeTagTitle')}
        description={
          dialog?.type === 'delete-tag'
            ? t('confirm.removeTagDesc', { tag: dialog.tag })
            : ''
        }
        confirmLabel={t('confirm.removeTagConfirm')}
        destructive
        onConfirm={handleDeleteTag}
      />
    </aside>
  )
}
