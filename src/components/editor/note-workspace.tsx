import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Code2,
  Columns2,
  Copy,
  Download,
  FileText,
  FolderClosed,
  Loader2,
  Maximize2,
  MoreHorizontal,
  PanelRight,
  Star,
  Trash2,
} from 'lucide-react'
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { CodeBlockDialog } from '@/components/editor/code-block-dialog'
import { EditorToolbar } from '@/components/editor/editor-toolbar'
import { InspectorPanel } from '@/components/editor/inspector-panel'
import { LinkDialog } from '@/components/editor/link-dialog'
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/editor/markdown-editor'
import { MarkdownPreview, type MarkdownPreviewHandle } from '@/components/editor/markdown-preview'
import { SaveStatus } from '@/components/editor/save-status'
import { TagEditor } from '@/components/editor/tag-editor'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip } from '@/components/ui/tooltip'
import type { Folder, Note, NoteDraft, ViewMode } from '@/db/types'
import {
  addAttachment,
  createNote as createNoteRecord,
  markNoteAccessed,
  restoreNotes,
  saveNoteDraft,
  trashNotes,
} from '@/db/repository'
import { useCreateNote } from '@/hooks/use-create-note'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useI18n } from '@/i18n/use-i18n'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useNoteAutosave } from '@/hooks/use-note-autosave'
import { noteMarkdownBlob } from '@/lib/backup'
import { errorText } from '@/lib/errors'
import { extractHeadings } from '@/lib/markdown'
import { parseScopePath } from '@/lib/paths'
import { buildFolderTree, flattenFolderTree, folderDisplayPath } from '@/lib/tree'
import { safeMarkdownAlt } from '@/lib/url'
import {
  countWords,
  displayTitle,
  downloadBlob,
  sanitizeFilename,
} from '@/lib/utils'
import { getBacklinks, getOutgoingLinks } from '@/lib/wiki-links'
import { useSettings } from '@/providers/settings-provider'

interface NoteWorkspaceProps {
  note: Note
  notes: Note[]
  folders: Folder[]
}

const VIEW_MODES = [
  { value: 'source', labelKey: 'editor.mode.source', icon: Code2 },
  { value: 'split', labelKey: 'editor.mode.split', icon: Columns2 },
  { value: 'read', labelKey: 'editor.mode.read', icon: BookOpen },
] as const satisfies readonly {
  value: ViewMode
  labelKey: 'editor.mode.source' | 'editor.mode.split' | 'editor.mode.read'
  icon: React.ComponentType<{ className?: string }>
}[]

export function NoteWorkspace({ note, notes, folders }: NoteWorkspaceProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const createLinkedNote = useCreateNote()
  const { t } = useI18n()
  const { settings, resolvedTheme, updateEditor } = useSettings()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const basePath = parseScopePath(location.pathname).basePath
  const titleRef = React.useRef<HTMLInputElement>(null)
  const editorRef = React.useRef<MarkdownEditorHandle>(null)
  const previewRef = React.useRef<MarkdownPreviewHandle>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)
  const syncLockRef = React.useRef<'editor' | 'preview' | null>(null)
  const syncTimerRef = React.useRef<number | null>(null)

  const [draft, setDraft] = React.useState<NoteDraft>(() => ({
    title: note.title,
    content: note.content,
    folderId: note.folderId,
    tags: note.tags,
    favorite: note.favorite,
  }))
  const [viewMode, setViewMode] = React.useState<ViewMode>(settings.editor.defaultViewMode)
  const [focusMode, setFocusMode] = React.useState(false)
  const [inspectorOpen, setInspectorOpen] = React.useState(false)
  const [linkOpen, setLinkOpen] = React.useState(false)
  const [codeBlockOpen, setCodeBlockOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [uploading, setUploading] = React.useState(false)

  const effectiveMode: ViewMode = !isDesktop && viewMode === 'split' ? 'source' : viewMode
  const { state: saveState, error: saveError, saveNow, retry } = useNoteAutosave(
    note,
    draft,
    settings.autoSaveDelay,
  )

  const debouncedContent = useDebouncedValue(draft.content, 180)
  const previewContent = effectiveMode === 'read' ? draft.content : debouncedContent
  const headings = React.useMemo(() => extractHeadings(previewContent), [previewContent])
  const backlinks = React.useMemo(() => getBacklinks(notes, note), [notes, note])
  const outgoing = React.useMemo(
    () =>
      getOutgoingLinks(
        { ...note, title: draft.title, content: debouncedContent, tags: draft.tags },
        notes,
      ),
    [note, notes, draft.title, draft.tags, debouncedContent],
  )
  const wordCount = React.useMemo(() => countWords(previewContent), [previewContent])
  const tagSuggestions = React.useMemo(
    () => Array.from(new Set(notes.flatMap((item) => item.tags))).sort((a, b) => a.localeCompare(b, 'zh-CN')),
    [notes],
  )
  const folderOptions = React.useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders])
  const folderPath = folderDisplayPath(folders, draft.folderId)

  const updateDraft = (patch: Partial<NoteDraft>) => {
    setDraft((current) => ({ ...current, ...patch }))
  }

  React.useEffect(() => {
    void markNoteAccessed(note.id)
  }, [note.id])

  React.useEffect(() => {
    document.title = `${displayTitle(draft.title)} · Mindora`
    return () => {
      document.title = t('app.defaultTitle')
    }
  }, [draft.title, t])

  React.useEffect(() => {
    const state = location.state as { focusTitle?: boolean } | null
    if (!state?.focusTitle) return
    const frame = window.requestAnimationFrame(() => {
      titleRef.current?.focus()
      titleRef.current?.select()
    })
    navigate(location.pathname, { replace: true, state: null })
    return () => window.cancelAnimationFrame(frame)
    // Focus is only requested once when a note is newly created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (!focusMode) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [focusMode])

  React.useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 's') {
        event.preventDefault()
        void saveNow()
      }
    }
    window.addEventListener('keydown', handleSaveShortcut)
    return () => window.removeEventListener('keydown', handleSaveShortcut)
  }, [saveNow])

  const setSyncLock = (source: 'editor' | 'preview') => {
    syncLockRef.current = source
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      syncLockRef.current = null
    }, 140)
  }

  React.useEffect(
    () => () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current)
    },
    [],
  )

  const syncFromEditor = (ratio: number) => {
    if (effectiveMode !== 'split') return
    if (syncLockRef.current === 'preview') return
    setSyncLock('editor')
    const preview = previewRef.current?.getScrollElement()
    if (preview) preview.scrollTop = ratio * Math.max(0, preview.scrollHeight - preview.clientHeight)
  }

  const syncFromPreview = (ratio: number) => {
    if (effectiveMode !== 'split') return
    if (syncLockRef.current === 'editor') return
    setSyncLock('preview')
    const editor = editorRef.current?.getScrollElement()
    if (editor) editor.scrollTop = ratio * Math.max(0, editor.scrollHeight - editor.clientHeight)
  }

  const handleHeading = (slug: string) => {
    if (effectiveMode === 'source') {
      setViewMode('read')
      window.setTimeout(() => previewRef.current?.scrollToHeading(slug), 80)
    } else {
      previewRef.current?.scrollToHeading(slug)
    }
  }

  const uploadImages = async (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) {
      toast.error(t('editor.toast.imageOnly'), { description: t('editor.toast.imageOnlyDesc') })
      return
    }
    setUploading(true)
    try {
      for (const file of images) {
        const attachment = await addAttachment(file, note.id)
        editorRef.current?.insertText(
          `![${safeMarkdownAlt(attachment.name)}](mindora-asset://${attachment.id})\n`,
        )
      }
      toast.success(t('editor.toast.imagesAdded', { count: images.length }), {
        description: t('editor.toast.imagesAddedDesc'),
      })
    } catch (cause) {
      toast.error(t('editor.toast.imageFailed'), {
        description: errorText(cause, t, 'editor.toast.imageFailedDesc'),
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length > 0) void uploadImages(files)
  }

  const handleTrash = async () => {
    const id = note.id
    try {
      await saveNoteDraft(id, draft)
    } catch (cause) {
      toast.error(t('editor.toast.saveBeforeTrashFailed'), {
        description: errorText(cause, t, 'editor.toast.saveBeforeTrashFailedDesc'),
      })
      return
    }
    await trashNotes([id])
    setDeleteOpen(false)
    navigate(basePath)
    toast.success(t('editor.toast.trashed'), {
      action: {
        label: t('editor.toast.undo'),
        onClick: () => {
          void restoreNotes([id]).then(() => toast.success(t('editor.toast.restored')))
        },
      },
    })
  }

  const requestTrash = () => {
    if (settings.confirmBeforeTrash) setDeleteOpen(true)
    else void handleTrash()
  }

  const handleDuplicate = async () => {
    await saveNow()
    try {
      const copy = await createNoteRecord({
        title: `${displayTitle(draft.title)} ${t('editor.copySuffix')}`,
        content: draft.content,
        folderId: draft.folderId,
        tags: draft.tags,
      })
      toast.success(t('editor.toast.duplicated'))
      navigate(`${basePath}/${copy.id}`, { state: { focusTitle: true } })
    } catch (cause) {
      toast.error(t('editor.toast.duplicateFailed'), {
        description: errorText(cause, t, 'editor.toast.duplicateFailedDesc'),
      })
    }
  }

  const handleExport = () => {
    downloadBlob(noteMarkdownBlob({ content: draft.content }), `${sanitizeFilename(draft.title)}.md`)
    toast.success(t('editor.toast.exported'))
  }

  const handleToggleFavorite = () => {
    const favorite = !draft.favorite
    updateDraft({ favorite })
    toast.success(favorite ? t('editor.toast.favoriteAdded') : t('editor.toast.favoriteRemoved'))
  }

  const toggleLineNumbers = () => {
    updateEditor({ lineNumbers: !settings.editor.lineNumbers })
  }

  const handleOpenLinkedNote = (id: string) => {
    void saveNow()
    navigate(`/notes/${id}`)
  }

  return (
    <div
      className={
        focusMode
          ? 'fixed inset-0 z-40 flex min-h-0 flex-col bg-background'
          : 'flex h-full min-h-0 flex-col bg-background'
      }
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInput}
        aria-hidden="true"
        tabIndex={-1}
      />

      <header className="shrink-0 border-b border-border bg-card/65">
        <div className="flex min-h-[43px] items-center gap-1 px-2.5 lg:px-5">
          <Tooltip content={t('editor.back')} side="bottom">
            <Button
              variant="ghost"
              size="iconSm"
              className="lg:hidden"
              onClick={() => navigate(basePath)}
              aria-label={t('editor.back')}
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Tooltip>
          <div className="hidden min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground sm:flex">
            <FolderClosed className="size-3" />
            <span className="max-w-[15rem] truncate">{folderPath}</span>
            <span className="text-border">/</span>
            <span className="truncate">{displayTitle(draft.title)}</span>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <SaveStatus state={saveState} error={saveError} onRetry={retry} />
            <div className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden />
            <div className="flex items-center rounded-md border border-border bg-background/60 p-0.5">
              {VIEW_MODES.filter((mode) => mode.value !== 'split' || isDesktop).map((mode) => {
                const Icon = mode.icon
                return (
                  <Tooltip key={mode.value} content={t(mode.labelKey)}>
                    <button
                      type="button"
                      onClick={() => setViewMode(mode.value)}
                      className={`flex size-6 items-center justify-center rounded-[4px] transition-colors ${
                        effectiveMode === mode.value
                          ? 'bg-card text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                      aria-label={t(mode.labelKey)}
                      aria-pressed={effectiveMode === mode.value}
                      data-testid={`view-mode-${mode.value}`}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  </Tooltip>
                )
              })}
            </div>
            <Tooltip content={t('editor.inspector')}>
              <button
                type="button"
                onClick={() => setInspectorOpen((open) => !open)}
                className="icon-button relative size-7"
                aria-label={t('editor.inspector')}
                aria-pressed={inspectorOpen}
              >
                <PanelRight className="size-4" />
                {backlinks.length > 0 && (
                  <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-primary" />
                )}
              </button>
            </Tooltip>
            <Tooltip content={draft.favorite ? t('editor.favoriteRemove') : t('editor.favoriteAdd')}>
              <button
                type="button"
                onClick={handleToggleFavorite}
                className={`icon-button size-7 ${draft.favorite ? 'text-warning' : ''}`}
                aria-label={draft.favorite ? t('editor.favoriteRemove') : t('editor.favoriteAdd')}
                aria-pressed={draft.favorite}
              >
                <Star className="size-4" fill={draft.favorite ? 'currentColor' : 'none'} />
              </button>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="icon-button size-7" aria-label={t('editor.more')}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{displayTitle(draft.title)}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleExport}>
                  <Download /> {t('editor.exportMd')}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleDuplicate()}>
                  <Copy /> {t('editor.duplicate')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setFocusMode((value) => !value)
                  }}
                >
                  <Maximize2 /> {focusMode ? t('editor.exitFocus') : t('editor.focus')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={requestTrash}>
                  <Trash2 /> {t('editor.moveToTrash')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="px-4 pb-2 pt-2 lg:px-7">
          <input
            ref={titleRef}
            value={draft.title}
            onChange={(event) => updateDraft({ title: event.target.value })}
            onBlur={() => {
              if (!draft.title.trim()) updateDraft({ title: t('common.untitledNote') })
            }}
            placeholder={t('editor.untitledPlaceholder')}
            aria-label={t('editor.titleAria')}
            className="w-full bg-transparent text-[23px] font-semibold leading-[1.35] tracking-[-0.03em] text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-[26px]"
            maxLength={180}
            spellCheck={false}
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <label className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <span className="sr-only">{t('editor.folderAria')}</span>
              <FolderClosed className="size-3" />
              <Select
                value={draft.folderId ?? 'none'}
                onValueChange={(value) => updateDraft({ folderId: value === 'none' ? null : value })}
              >
                <SelectTrigger className="h-6 w-auto min-w-[5rem] max-w-[12rem] gap-1 border-transparent bg-transparent px-1 text-[10.5px] text-muted-foreground shadow-none hover:bg-accent/70 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('editor.uncategorized')}</SelectItem>
                  {folderOptions.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      {'— '.repeat(Math.min(folder.depth, 4))}
                      {folder.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <span className="hidden h-3.5 w-px bg-border sm:block" aria-hidden />
            <TagEditor
              tags={draft.tags}
              suggestions={tagSuggestions}
              onChange={(tags) => updateDraft({ tags })}
            />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          {effectiveMode !== 'read' && (
            <EditorToolbar
              editorRef={editorRef}
              onLink={() => setLinkOpen(true)}
              onImage={() => imageInputRef.current?.click()}
              onCodeBlock={() => setCodeBlockOpen(true)}
              onSearch={() => editorRef.current?.openSearch()}
              onToggleLineNumbers={toggleLineNumbers}
              lineNumbers={settings.editor.lineNumbers}
              uploading={uploading}
            />
          )}
          <div className="flex min-h-0 flex-1">
            <div
              className={`min-w-0 flex-1 flex-col overflow-hidden ${
                effectiveMode === 'read' ? 'hidden' : 'flex'
              }`}
            >
              <MarkdownEditor
                key={note.id}
                ref={editorRef}
                initialValue={note.content}
                onChange={(content) => updateDraft({ content })}
                onSave={() => void saveNow()}
                onRequestLink={() => setLinkOpen(true)}
                onFiles={(files) => void uploadImages(files)}
                onScroll={syncFromEditor}
                lineNumbersEnabled={settings.editor.lineNumbers}
                spellcheck={settings.editor.spellcheck}
              />
            </div>
            {effectiveMode !== 'source' && (
              <div
                className={`min-w-0 flex-1 bg-card/20 ${
                  effectiveMode === 'split' ? 'border-l border-border' : ''
                }`}
              >
                <MarkdownPreview
                  ref={previewRef}
                  content={previewContent}
                  notes={notes}
                  theme={resolvedTheme}
                  fontSize={settings.preview.fontSize}
                  maxWidth={settings.preview.maxWidth}
                  onOpenNote={handleOpenLinkedNote}
                  onCreateLinkedNote={(title) => {
                    void createLinkedNote({ title, folderId: draft.folderId })
                  }}
                  onScrollRatio={syncFromPreview}
                />
              </div>
            )}
          </div>
          <footer className="flex h-7 shrink-0 items-center gap-2 border-t border-border bg-card/45 px-3 text-[9.5px] text-muted-foreground">
            {settings.showWordCount && (
              <>
                <span>{t('editor.words', { count: wordCount })}</span>
                <span className="text-border">·</span>
                <span>{t('editor.readingTime', { count: Math.max(1, Math.ceil(wordCount / 320)) })}</span>
              </>
            )}
            <span className="ml-auto hidden items-center gap-1 sm:flex">
              {saveState === 'error' ? (
                <>
                  <AlertTriangle className="size-2.5 text-destructive" />
                  {t('editor.localSaveFailed')}
                </>
              ) : uploading ? (
                <>
                  <Loader2 className="size-2.5 animate-spin" />
                  {t('editor.savingImages')}
                </>
              ) : (
                <>
                  <FileText className="size-2.5" />
                  {t('editor.markdown')}
                </>
              )}
            </span>
          </footer>
        </div>

        {!isDesktop && inspectorOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-[1px] lg:hidden"
            aria-label={t('editor.relations.close')}
            onClick={() => setInspectorOpen(false)}
          />
        )}
        <InspectorPanel
          open={inspectorOpen}
          headings={headings}
          backlinks={backlinks}
          outgoing={outgoing}
          onClose={() => setInspectorOpen(false)}
          onNavigate={(id) => {
            setInspectorOpen(false)
            handleOpenLinkedNote(id)
          }}
          onHeading={handleHeading}
          onCreateLinkedNote={(title) => {
            setInspectorOpen(false)
            void createLinkedNote({ title, folderId: draft.folderId })
          }}
          className={!isDesktop ? 'fixed inset-y-0 right-0 z-40 w-[min(88vw,320px)] shadow-float' : ''}
        />
      </div>

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onSubmit={(label, url) => editorRef.current?.insertLink(label, url)}
      />
      <CodeBlockDialog
        open={codeBlockOpen}
        onOpenChange={setCodeBlockOpen}
        onInsert={(language) => editorRef.current?.insertCodeBlock(language)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('editor.trash.title')}
        description={t('editor.trash.description', { title: displayTitle(draft.title) })}
        confirmLabel={t('editor.trash.confirm')}
        destructive
        onConfirm={handleTrash}
      />
    </div>
  )
}
