import {
  ArrowRight,
  FilePlus2,
  FolderX,
  Network,
  Search,
  Sparkles,
  Star,
} from 'lucide-react'
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/common/empty-state'
import { LogoMark } from '@/components/common/logo'
import { NoteList } from '@/components/notes/note-list'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { restoreNotes } from '@/db/repository'
import type { Note, NoteScope } from '@/db/types'
import { useCreateNote } from '@/hooks/use-create-note'
import { useI18n } from '@/i18n/use-i18n'
import { notePath, parseScopePath } from '@/lib/paths'
import { formatRelativeTime } from '@/lib/utils'
import { useData } from '@/providers/data-provider'
import { useUI } from '@/providers/ui-provider'

const NoteWorkspace = React.lazy(() =>
  import('@/components/editor/note-workspace').then((module) => ({
    default: module.NoteWorkspace,
  })),
)

const TrashNoteView = React.lazy(() =>
  import('@/components/notes/trash-note-view').then((module) => ({
    default: module.TrashNoteView,
  })),
)

function WorkspaceLoading() {
  return (
    <div className="flex w-full flex-col gap-3 p-8">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-3 w-full max-w-xl" />
      <Skeleton className="h-3 w-5/6 max-w-xl" />
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  )
}

function WorkspaceWelcome() {
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const { activeNotes, favoriteNotes } = useData()
  const { setSearchOpen } = useUI()
  const { t } = useI18n()
  const recent = activeNotes.slice(0, 4)

  return (
    <div className="relative flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background px-6 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.38] [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl animate-slide-up">
        <div className="mb-7 flex items-center gap-3">
          <LogoMark className="size-10 rounded-xl" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Mindora workspace
            </p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{t('welcome.subtitle')}</p>
          </div>
        </div>
        <h1 className="text-[30px] font-semibold leading-[1.14] tracking-[-0.045em] sm:text-[38px]">
          {t('welcome.titleLead')}
          <span className="text-primary">{t('welcome.titleAccent')}</span>
        </h1>
        <p className="mt-4 max-w-md text-[13px] leading-6 text-muted-foreground">
          {t('welcome.description')}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          <Button onClick={() => void createNote()}>
            <FilePlus2 />
            {t('welcome.newNote')}
          </Button>
          <Button variant="secondary" onClick={() => setSearchOpen(true)}>
            <Search />
            {t('welcome.search')}
            <kbd className="ml-1 rounded border border-border bg-muted/60 px-1 py-0.5 font-mono text-[9px]">
              ⌘K
            </kbd>
          </Button>
          <Button variant="ghost" onClick={() => navigate('/graph')}>
            <Network />
            {t('welcome.graph')}
          </Button>
        </div>

        {recent.length > 0 && (
          <section className="mt-10 border-t border-border pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t('welcome.recent')}
              </h2>
              <button
                type="button"
                onClick={() => navigate('/recent')}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              >
                {t('welcome.viewAll')} <ArrowRight className="size-3" />
              </button>
            </div>
            <div className="grid gap-1 sm:grid-cols-2">
              {recent.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="group rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border hover:bg-card"
                >
                  <span className="flex items-center gap-1.5">
                    {note.favorite ? (
                      <Star className="size-3 shrink-0 text-warning" fill="currentColor" />
                    ) : (
                      <Sparkles className="size-3 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className="truncate text-[11.5px] font-medium">{note.title}</span>
                    <ArrowRight className="ml-auto size-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </span>
                  <span className="mt-1 block pl-[1.1rem] text-[9.5px] text-muted-foreground">
                    {formatRelativeTime(note.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-8 flex items-center gap-4 border-t border-border pt-4 text-[9.5px] text-muted-foreground/75">
          <span>{t('welcome.notesStat', { count: activeNotes.length })}</span>
          <span>{t('welcome.favoritesStat', { count: favoriteNotes.length })}</span>
          <span className="ml-auto">{t('welcome.localStat')}</span>
        </div>
      </div>
    </div>
  )
}

function DeletedNotice({ noteId, onRestored }: { noteId: string; onRestored: () => void }) {
  const { getNote } = useData()
  const note = getNote(noteId)
  const navigate = useNavigate()
  const { t } = useI18n()
  if (!note) return null
  return (
    <div className="flex h-full items-center justify-center px-6">
      <EmptyState
        icon={FolderX}
        title={t('notes.inTrash.title')}
        description={t('notes.inTrash.description')}
        action={
          <Button
            onClick={() => {
              void restoreNotes([note.id]).then(() => {
                toast.success(t('notes.inTrash.restored'))
                onRestored()
              })
            }}
          >
            {t('notes.inTrash.restore')}
          </Button>
        }
        secondaryAction={
          <Button variant="secondary" onClick={() => navigate('/trash')}>
            {t('notes.inTrash.openTrash')}
          </Button>
        }
      />
    </div>
  )
}

function selectScopeNotes(scope: NoteScope, activeNotes: Note[], trashedNotes: Note[]): Note[] {
  switch (scope.kind) {
    case 'folder':
      return activeNotes.filter((note) => note.folderId === scope.folderId)
    case 'tag':
      return activeNotes.filter((note) => note.tags.includes(scope.tag))
    case 'favorites':
      return activeNotes.filter((note) => note.favorite)
    case 'recent':
      return activeNotes.slice().sort((a, b) => b.accessedAt - a.accessedAt)
    case 'trash':
      return trashedNotes
    default:
      return activeNotes
  }
}

function scopeKey(scope: NoteScope): string {
  if (scope.kind === 'folder') return `folder:${scope.folderId}`
  if (scope.kind === 'tag') return `tag:${scope.tag}`
  return scope.kind
}

export function NotesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const { t } = useI18n()
  const { activeNotes, trashedNotes, folders, notes, loading, getNote, getFolder } = useData()
  const route = parseScopePath(location.pathname)
  const scope = route.scope
  const noteId = route.noteId

  const folder = scope.kind === 'folder' ? getFolder(scope.folderId) : undefined
  const title = (() => {
    switch (scope.kind) {
      case 'folder':
        return folder?.name ?? t('notes.folderMissing.label')
      case 'tag':
        return `#${scope.tag}`
      case 'favorites':
        return t('nav.favorites')
      case 'recent':
        return t('nav.recent')
      case 'trash':
        return t('nav.trash')
      default:
        return t('nav.allNotes')
    }
  })()

  const listNotes = selectScopeNotes(scope, activeNotes, trashedNotes)

  const activeNote = getNote(noteId)
  const activeIsTrashed = activeNote?.trashedAt !== null
  const canEdit = Boolean(activeNote && !activeIsTrashed && scope.kind !== 'trash')
  const canPreviewTrash = Boolean(activeNote && activeIsTrashed && scope.kind === 'trash')

  const handleRemoved = (id: string) => {
    if (id && id === noteId) navigate(route.basePath)
  }

  const handleRestored = (id: string) => {
    if (id && id === noteId) navigate(`/notes/${id}`)
  }

  return (
    <div className="flex h-full min-h-0">
      <div
        className={`h-full min-h-0 w-full lg:flex lg:w-auto ${
          activeNote ? 'hidden' : 'flex'
        }`}
      >
        <NoteList
          key={scopeKey(scope)}
          scope={scope}
          title={title}
          notes={listNotes}
          folders={folders}
          activeId={noteId}
          loading={loading}
          onOpen={(id) => navigate(notePath(route.basePath, id))}
          onCreate={() => void createNote()}
          onNoteRemoved={handleRemoved}
          onNoteRestored={handleRestored}
        />
      </div>

      <section
        className={`min-h-0 min-w-0 flex-1 ${activeNote ? 'flex' : 'hidden lg:flex'}`}
      >
        <React.Suspense fallback={<WorkspaceLoading />}>
        {loading ? (
          <WorkspaceLoading />
        ) : activeNote && canEdit ? (
          <NoteWorkspace key={activeNote.id} note={activeNote} notes={notes} folders={folders} />
        ) : activeNote && canPreviewTrash ? (
          <TrashNoteView
            note={activeNote}
            notes={notes}
            folders={folders}
            onBack={() => navigate('/trash')}
          />
        ) : activeNote && activeIsTrashed ? (
          <DeletedNotice noteId={activeNote.id} onRestored={() => navigate(`/notes/${activeNote.id}`)} />
        ) : activeNote && scope.kind === 'trash' ? (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={FolderX}
              title={t('notes.notInTrash.title')}
              description={t('notes.notInTrash.description')}
              action={
                <Button onClick={() => navigate(`/notes/${activeNote.id}`)}>{t('common.open')}</Button>
              }
            />
          </div>
        ) : noteId ? (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={FolderX}
              title={t('notes.notFound.title')}
              description={t('notes.notFound.description')}
              action={<Button onClick={() => navigate(route.basePath)}>{t('notes.notFound.back')}</Button>}
            />
          </div>
        ) : scope.kind === 'folder' && !folder ? (
          <div className="flex h-full items-center justify-center px-6">
            <EmptyState
              icon={FolderX}
              title={t('notes.folderMissing.title')}
              description={t('notes.folderMissing.description')}
              action={<Button onClick={() => navigate('/notes')}>{t('notes.folderMissing.back')}</Button>}
            />
          </div>
        ) : (
          <WorkspaceWelcome />
        )}
        </React.Suspense>
      </section>
    </div>
  )
}
