import { FilePlus2, Menu, Search } from 'lucide-react'
import * as React from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'

import { CommandPalette } from '@/components/search/command-palette'
import { ShortcutsDialog } from '@/components/layout/shortcuts-dialog'
import { Sidebar } from '@/components/layout/sidebar'
import { LogoMark, Wordmark } from '@/components/common/logo'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { useCreateNote } from '@/hooks/use-create-note'
import { useI18n } from '@/i18n/use-i18n'
import { NotesPage } from '@/pages/notes-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { isTypingTarget } from '@/lib/utils'
import { useUI } from '@/providers/ui-provider'

const SearchPage = React.lazy(() =>
  import('@/pages/search-page').then((module) => ({ default: module.SearchPage })),
)
const GraphPage = React.lazy(() =>
  import('@/pages/graph-page').then((module) => ({ default: module.GraphPage })),
)
const SettingsPage = React.lazy(() =>
  import('@/pages/settings-page').then((module) => ({ default: module.SettingsPage })),
)

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const createNote = useCreateNote()
  const { t } = useI18n()
  const {
    mobileNavOpen,
    setMobileNavOpen,
    searchOpen,
    setSearchOpen,
    setShortcutsOpen,
  } = useUI()

  React.useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname, setMobileNavOpen])

  React.useEffect(() => {
    // Note pages set their own title after this parent effect runs.
    const isNoteWorkspace =
      /^\/notes\/[^/]+$/.test(location.pathname) ||
      /^\/(folders|tags)\/[^/]+\/[^/]+$/.test(location.pathname) ||
      /^\/(favorites|recent|trash)\/[^/]+$/.test(location.pathname)
    if (!isNoteWorkspace) document.title = t('app.defaultTitle')
  }, [location.pathname, t])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.altKey && event.key.toLocaleLowerCase() === 'n' && !event.repeat) {
        event.preventDefault()
        if (!searchOpen) void createNote()
        return
      }
      if (event.key === '?' && !mod && !isTypingTarget(event.target)) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [createNote, searchOpen, setSearchOpen, setShortcutsOpen])

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <div className="hidden h-full lg:flex">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-sidebar/90 px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="icon-button size-8"
            aria-label={t('nav.open')}
          >
            <Menu className="size-[18px]" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/notes')}
            className="flex items-center gap-2"
            aria-label={t('nav.home')}
          >
            <LogoMark className="size-6 rounded-[7px]" />
            <Wordmark className="text-[14px]" />
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            <Tooltip content={t('common.search')} side="bottom">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="icon-button size-8"
                aria-label={t('common.search')}
              >
                <Search className="size-[17px]" />
              </button>
            </Tooltip>
            <Tooltip content={t('nav.newNote')} side="bottom">
              <button
                type="button"
                onClick={() => void createNote()}
                className="icon-button size-8"
                aria-label={t('nav.newNote')}
              >
                <FilePlus2 className="size-[17px]" />
              </button>
            </Tooltip>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1">
          <React.Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <span className="text-[12px] text-muted-foreground">{t('common.loading')}</span>
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<Navigate to="/notes" replace />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/notes/:noteId" element={<NotesPage />} />
              <Route path="/folders/:folderId" element={<NotesPage />} />
              <Route path="/folders/:folderId/:noteId" element={<NotesPage />} />
              <Route path="/tags/:tag" element={<NotesPage />} />
              <Route path="/tags/:tag/:noteId" element={<NotesPage />} />
              <Route path="/favorites" element={<NotesPage />} />
              <Route path="/favorites/:noteId" element={<NotesPage />} />
              <Route path="/recent" element={<NotesPage />} />
              <Route path="/recent/:noteId" element={<NotesPage />} />
              <Route path="/trash" element={<NotesPage />} />
              <Route path="/trash/:noteId" element={<NotesPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </React.Suspense>
        </main>
      </div>

      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent
          hideClose
          aria-describedby={undefined}
          className="left-0 top-0 h-dvh max-h-dvh w-[min(88vw,320px)] max-w-[320px] translate-x-0 translate-y-0 overflow-hidden rounded-none border-y-0 border-l-0 p-0 animate-sheet-in"
        >
          <DialogTitle className="sr-only">{t('nav.open')}</DialogTitle>
          <Sidebar mobile />
        </DialogContent>
      </Dialog>

      <CommandPalette />
      <ShortcutsDialog />
    </div>
  )
}
