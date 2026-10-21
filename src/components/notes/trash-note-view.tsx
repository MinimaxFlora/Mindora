import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { MarkdownPreview } from '@/components/editor/markdown-preview'
import { Button } from '@/components/ui/button'
import type { Folder, Note } from '@/db/types'
import { createNote, deleteNotesPermanently, restoreNotes } from '@/db/repository'
import { useI18n } from '@/i18n/use-i18n'
import { formatDateTime } from '@/lib/utils'
import { folderDisplayPath } from '@/lib/tree'
import { useSettings } from '@/providers/settings-provider'

interface TrashNoteViewProps {
  note: Note
  notes: Note[]
  folders: Folder[]
  onBack: () => void
}

export function TrashNoteView({ note, notes, folders, onBack }: TrashNoteViewProps) {
  const navigate = useNavigate()
  const { settings, resolvedTheme } = useSettings()
  const { t } = useI18n()
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  if (note.trashedAt === null) {
    return (
      <div className="flex h-full flex-col">
        <header className="flex h-[52px] items-center gap-2 border-b border-border px-4">
          <Button variant="ghost" size="iconSm" onClick={onBack} aria-label={t('trash.back')}>
            <ArrowLeft className="size-4" />
          </Button>
          <span className="text-[12px] text-muted-foreground">{t('trash.restoredState')}</span>
          <Button size="sm" className="ml-auto" onClick={() => navigate(`/notes/${note.id}`)}>
            {t('trash.openRestored')}
          </Button>
        </header>
      </div>
    )
  }

  const handleRestore = async () => {
    await restoreNotes([note.id])
    toast.success(t('trash.toast.restored'))
    navigate(`/notes/${note.id}`)
  }

  const handleDelete = async () => {
    await deleteNotesPermanently([note.id])
    toast.success(t('trash.toast.deleted'))
    onBack()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-card/70 px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="iconSm" onClick={onBack} aria-label={t('trash.back')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
              <Trash2 className="size-2.5" />
              {t('trash.title')}
            </p>
            <h1 className="truncate text-[16px] font-semibold tracking-[-0.02em]">{note.title}</h1>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => void handleRestore()}>
              <RotateCcw />
              {t('trash.restore')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 />
              <span className="hidden sm:inline">{t('trash.delete')}</span>
            </Button>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-2 pl-8 text-[10px] text-muted-foreground">
          <span>{folderDisplayPath(folders, note.folderId)}</span>
          <span className="text-border">·</span>
          <span>{t('trash.deletedAt', { time: formatDateTime(note.trashedAt) })}</span>
          <span className="text-border">·</span>
          <span>{t('trash.readOnly')}</span>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <MarkdownPreview
          content={note.content}
          notes={notes}
          theme={resolvedTheme}
          fontSize={settings.preview.fontSize}
          maxWidth={settings.preview.maxWidth}
          onOpenNote={(id) => navigate(`/notes/${id}`)}
          onCreateLinkedNote={(title) => {
            void createNote({ title, content: '', folderId: note.folderId }).then((created) => {
              toast.success(t('common.create'))
              navigate(`/notes/${created.id}`)
            })
          }}
        />
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t('trash.confirm.title')}
        description={t('trash.confirm.description')}
        confirmLabel={t('trash.confirm.confirm')}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
