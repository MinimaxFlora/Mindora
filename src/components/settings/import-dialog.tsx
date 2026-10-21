import { CheckCircle2, FileArchive, FileText, Loader2, Upload, X } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { Folder } from '@/db/types'
import { useI18n } from '@/i18n/use-i18n'
import { errorText } from '@/lib/errors'
import { importBackupZip, importMarkdownFiles, type ZipImportResult } from '@/lib/backup'
import { buildFolderTree, flattenFolderTree } from '@/lib/tree'
import { formatBytes } from '@/lib/utils'

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: Folder[]
  onImported: () => void
}

type ImportSummary =
  | { kind: 'markdown'; imported: number; warnings: string[] }
  | { kind: 'backup'; result: ZipImportResult }

const ACCEPT = '.md,.markdown,.txt,.zip'

function ImportDialogBody({
  onOpenChange,
  folders,
  onImported,
}: Omit<ImportDialogProps, 'open'>) {
  const { t } = useI18n()
  const [files, setFiles] = React.useState<File[]>([])
  const [folderId, setFolderId] = React.useState('none')
  const [restoreSettings, setRestoreSettings] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [summary, setSummary] = React.useState<ImportSummary | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const folderOptions = React.useMemo(() => flattenFolderTree(buildFolderTree(folders)), [folders])

  const zipFile = files.find((file) => file.name.toLowerCase().endsWith('.zip'))
  const isBackup = Boolean(zipFile)
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  const acceptFiles = (selected: File[]) => {
    setError(null)
    setSummary(null)
    if (selected.length === 0) return
    const hasZip = selected.some((file) => file.name.toLowerCase().endsWith('.zip'))
    if (hasZip && selected.length > 1) {
      setError(t('import.error.zipSingle'))
      return
    }
    const unsupported = selected.filter((file) => !/\.(md|markdown|txt|zip)$/i.test(file.name))
    if (unsupported.length > 0) {
      setError(
        t('import.error.unsupported', { files: unsupported.map((file) => file.name).join(', ') }),
      )
      return
    }
    if (selected.length > 200) {
      setError(t('import.error.tooMany'))
      return
    }
    setFiles(selected)
  }

  const handleImport = async () => {
    if (files.length === 0) {
      setError(t('import.error.pick'))
      return
    }
    setPending(true)
    setError(null)
    try {
      if (zipFile) {
        const result = await importBackupZip(zipFile, { restoreSettings })
        setSummary({ kind: 'backup', result })
        onImported()
        toast.success(t('import.toast.restored', { count: result.importedNotes }), {
          description: t('import.toast.restoredDesc', {
            folders: result.importedFolders,
            attachments: result.importedAttachments,
          }),
        })
      } else {
        const result = await importMarkdownFiles(files, {
          folderId: folderId === 'none' ? null : folderId,
        })
        setSummary({ kind: 'markdown', imported: result.imported, warnings: result.warnings })
        onImported()
        if (result.imported > 0) {
          toast.success(t('import.toast.imported', { count: result.imported }))
        } else {
          toast.warning(t('import.toast.none'), {
            description: result.warnings[0] ?? t('import.toast.check'),
          })
        }
      }
    } catch (cause) {
      setError(errorText(cause, t, 'import.error.generic'))
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('import.title')}</DialogTitle>
        <DialogDescription>{t('import.description')}</DialogDescription>
      </DialogHeader>

      {summary ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/8 p-4">
              <CheckCircle2 className="mt-0.5 size-5 text-success" />
              <div>
                <p className="text-[13px] font-semibold">
                  {summary.kind === 'markdown'
                    ? t('import.success.md', { count: summary.imported })
                    : t('import.success.zip', { count: summary.result.importedNotes })}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                  {summary.kind === 'markdown'
                    ? t('import.success.mdDesc')
                    : t('import.success.zipDesc', {
                        folders: summary.result.importedFolders,
                        attachments: summary.result.importedAttachments,
                      })}
                </p>
              </div>
            </div>
            {summary.kind === 'markdown' && summary.warnings.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/35 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {t('import.warnings')}
                </p>
                <ul className="mt-2 space-y-1">
                  {summary.warnings.slice(0, 8).map((warning, index) => (
                    <li key={index} className="text-[10.5px] leading-4 text-muted-foreground">
                      · {warning}
                    </li>
                  ))}
                </ul>
                {summary.warnings.length > 8 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {t('import.moreWarnings', { count: summary.warnings.length - 8 })}
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>{t('import.done')}</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              multiple
              className="hidden"
              onChange={(event) => {
                acceptFiles(Array.from(event.target.files ?? []))
                event.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
              }}
              onDrop={(event) => {
                event.preventDefault()
                acceptFiles(Array.from(event.dataTransfer.files))
              }}
              className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-input bg-muted/20 px-5 py-8 text-center transition-colors hover:border-ring/55 hover:bg-accent/25"
            >
              {isBackup ? (
                <FileArchive className="mb-3 size-6 text-primary" />
              ) : (
                <Upload className="mb-3 size-6 text-muted-foreground" />
              )}
              <span className="text-[12.5px] font-medium">
                {files.length > 0 ? t('import.chooseAgain') : t('import.dropTitle')}
              </span>
              <span className="mt-1 text-[10.5px] text-muted-foreground">
                {t('import.dropHint')}
              </span>
              <span className="mt-1 text-[9.5px] text-muted-foreground/65">
                {t('import.dropLimit')}
              </span>
            </button>

            {files.length > 0 && (
              <div className="mt-3 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-[11px] font-medium">
                    {t('common.filesCount', { count: files.length })} · {formatBytes(totalSize)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                    aria-label={t('import.removeFiles')}
                  >
                    <X className="size-3" />
                  </button>
                </div>
                <ul className="max-h-32 overflow-y-auto p-2">
                  {files.map((file) => (
                    <li
                      key={`${file.name}-${file.lastModified}`}
                      className="flex items-center gap-2 rounded px-1.5 py-1 text-[10.5px] text-muted-foreground"
                    >
                      {file.name.toLowerCase().endsWith('.zip') ? (
                        <FileArchive className="size-3.5 text-primary" />
                      ) : (
                        <FileText className="size-3.5" />
                      )}
                      <span className="truncate">{file.name}</span>
                      <span className="ml-auto shrink-0 text-[9px]">{formatBytes(file.size)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!isBackup && files.length > 0 && (
              <label className="mt-4 block space-y-1.5">
                <span className="text-[11.5px] font-medium">{t('import.destination')}</span>
                <Select value={folderId} onValueChange={setFolderId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('import.uncategorized')}</SelectItem>
                    {folderOptions.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {'— '.repeat(Math.min(folder.depth, 3))}
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}

            {isBackup && (
              <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <Switch
                  checked={restoreSettings}
                  onCheckedChange={setRestoreSettings}
                  aria-label={t('import.restoreSettings')}
                />
                <span>
                  <span className="block text-[11.5px] font-medium">{t('import.restoreSettings')}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                    {t('import.restoreSettingsDesc')}
                  </span>
                </span>
              </label>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-md bg-destructive/8 px-3 py-2 text-[11px] text-destructive">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
                {t('import.cancel')}
              </Button>
              <Button onClick={() => void handleImport()} disabled={files.length === 0 || pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Upload />}
                {pending
                  ? t('import.importing')
                  : isBackup
                    ? t('import.restoreButton')
                    : t('import.button')}
              </Button>
            </DialogFooter>
      </>
    )}
    </>
  )
}

export function ImportDialog(props: ImportDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent size="lg">
        {props.open && (
          <ImportDialogBody
            onOpenChange={props.onOpenChange}
            folders={props.folders}
            onImported={props.onImported}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
