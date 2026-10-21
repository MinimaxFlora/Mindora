import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { parse as parseYaml } from 'yaml'

import { db } from '@/db/database'
import type { AppSettings, Attachment, Folder, Note } from '@/db/types'
import { getAttachment } from '@/db/repository'
import { translate } from '@/i18n/messages'
import { LocalizedError } from '@/lib/errors'
import { getActiveLocale } from '@/lib/locale'
import { attachmentApi } from '@/sync/api'
import { cleanTags, countWords, createId, displayTitle, normalizeTag, sanitizeFilename, uniqueTitle } from '@/lib/utils'

export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024
const MAX_BACKUP_SIZE = 200 * 1024 * 1024
const MAX_BACKUP_ENTRIES = 5000

export interface BackupNoteMeta extends Omit<Note, 'content'> {
  contentPath: string
}

export interface BackupAttachmentMeta {
  id: string
  noteId: string | null
  name: string
  mimeType: string
  size: number
  path: string
  createdAt: number
}

export interface BackupManifest {
  format: 'mindora-backup'
  version: 1
  appVersion: string
  exportedAt: string
  notes: BackupNoteMeta[]
  folders: Folder[]
  attachments: BackupAttachmentMeta[]
  settings: AppSettings
}

export interface ExportResult {
  blob: Blob
  filename: string
  noteCount: number
  attachmentCount: number
}

function backupFilename(date = new Date()): string {
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
  return `mindora-backup-${datePart}.zip`
}

function notePath(note: Note): string {
  return `notes/${sanitizeFilename(note.title)}-${note.id.slice(0, 8)}.md`
}

function attachmentPath(attachment: Attachment): string {
  return `attachments/${attachment.id}-${sanitizeFilename(attachment.name)}`
}

export async function createBackupArchive(): Promise<ExportResult> {
  const [notes, folders, attachments, settingsRecord] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.attachments.toArray(),
    db.settings.get('app'),
  ])

  const files: Record<string, Uint8Array> = {}
  const manifest: BackupManifest = {
    format: 'mindora-backup',
    version: 1,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    notes: [],
    folders,
    attachments: [],
    settings: settingsRecord?.value ?? ({} as AppSettings),
  }

  for (const note of notes) {
    const path = notePath(note)
    files[path] = strToU8(note.content)
    const { content: _content, ...meta } = note
    manifest.notes.push({ ...meta, contentPath: path })
  }

  for (const attachment of attachments) {
    const path = attachmentPath(attachment)
    const blob = attachment.blob ?? (await getAttachment(attachment.id))
    if (!blob) throw new LocalizedError('error.attachmentUnavailable', { name: attachment.name })
    const buffer = await blob.arrayBuffer()
    files[path] = new Uint8Array(buffer)
    manifest.attachments.push({
      id: attachment.id,
      noteId: attachment.noteId,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      path,
      createdAt: attachment.createdAt,
    })
  }

  const locale = getActiveLocale()
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2))
  files['README.txt'] = strToU8(
    [
      translate(locale, 'backup.readmeTitle'),
      '',
      translate(locale, 'backup.exportedAt', { time: manifest.exportedAt }),
      translate(locale, 'backup.noteCount', { count: notes.length }),
      translate(locale, 'backup.attachmentCount', { count: attachments.length }),
      '',
      translate(locale, 'backup.structure'),
      translate(locale, 'backup.keep'),
      translate(locale, 'backup.protocol'),
      '',
    ].join('\n'),
  )

  const zipped = zipSync(files, { level: 6, mtime: new Date() })
  const blob = new Blob([zipped as BlobPart], { type: 'application/zip' })
  return {
    blob,
    filename: backupFilename(),
    noteCount: notes.length,
    attachmentCount: attachments.length,
  }
}

export function noteMarkdownBlob(note: Pick<Note, 'content'>): Blob {
  return new Blob([note.content], { type: 'text/markdown;charset=utf-8' })
}

export interface ParsedMarkdown {
  title: string
  content: string
  tags: string[]
  aliases: string[]
  folderName: string | null
  warnings: string[]
}

export function parseMarkdownDocument(filename: string, text: string): ParsedMarkdown {
  const warnings: string[] = []
  const content = text.replace(/^\uFEFF/, '')
  let title = ''
  let tags: string[] = []
  let aliases: string[] = []
  let folderName: string | null = null

  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (frontmatter?.[1]) {
    try {
      const parsed = parseYaml(frontmatter[1]) as unknown
      if (parsed && typeof parsed === 'object') {
        const record = parsed as Record<string, unknown>
        if (typeof record.title === 'string' && record.title.trim()) title = record.title.trim()
        if (typeof record.folder === 'string' && record.folder.trim()) folderName = record.folder.trim()
        if (Array.isArray(record.tags)) {
          tags = record.tags.filter((tag): tag is string => typeof tag === 'string').map(normalizeTag)
        } else if (typeof record.tags === 'string') {
          tags = record.tags.split(',').map(normalizeTag)
        }
        if (Array.isArray(record.aliases)) {
          aliases = record.aliases.filter((alias): alias is string => typeof alias === 'string')
        } else if (typeof record.aliases === 'string') {
          aliases = [record.aliases]
        }
      }
    } catch {
      warnings.push(translate(getActiveLocale(), 'error.frontmatterInvalid'))
    }
  }

  if (!title) {
    const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '')
    const heading = withoutFrontmatter.match(/^#\s+(.+?)\s*#*\s*$/m)
    title = heading?.[1]?.trim() ?? ''
  }
  if (!title) {
    title = filename.replace(/\.(md|markdown|txt)$/i, '').trim()
  }

  return {
    title: displayTitle(title),
    content,
    tags: cleanTags(tags),
    aliases: aliases.map((alias) => alias.trim()).filter(Boolean).slice(0, 20),
    folderName,
    warnings,
  }
}

export interface ImportResult {
  imported: number
  titles: string[]
  warnings: string[]
}

export interface ImportMarkdownOptions {
  folderId?: string | null
}

export async function importMarkdownFiles(
  files: readonly File[],
  options: ImportMarkdownOptions = {},
): Promise<ImportResult> {
  if (files.length > 200) throw new LocalizedError('error.importTooManyFiles')
  const documents: { file: File; parsed: ParsedMarkdown }[] = []
  const warnings: string[] = []
  const locale = getActiveLocale()

  for (const file of files) {
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      warnings.push(translate(locale, 'error.importUnsupported', { name: file.name }))
      continue
    }
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      warnings.push(translate(locale, 'error.importFileTooLarge', { name: file.name }))
      continue
    }
    const text = await file.text()
    if (!text.trim()) {
      warnings.push(translate(locale, 'error.importEmptyFile', { name: file.name }))
      continue
    }
    const parsed = parseMarkdownDocument(file.name, text)
    warnings.push(...parsed.warnings.map((warning) => `${file.name}：${warning}`))
    documents.push({ file, parsed })
  }

  if (documents.length === 0) {
    return { imported: 0, titles: [], warnings }
  }

  const importedTitles = await db.transaction('rw', db.notes, db.folders, async () => {
    const existing = await db.notes.toArray()
    const reserved = existing.map((note) => note.title)
    let targetFolder = options.folderId ?? null
    if (targetFolder) {
      const folder = await db.folders.get(targetFolder)
      if (!folder) targetFolder = null
    }
    const folderCache = new Map<string, string>()

    async function resolveFrontmatterFolder(name: string): Promise<string> {
      const cached = folderCache.get(name)
      if (cached) return cached
      const existingFolder = await db.folders
        .filter((folder) => folder.parentId === null && folder.name === name)
        .first()
      if (existingFolder) {
        folderCache.set(name, existingFolder.id)
        return existingFolder.id
      }
      const id = createId()
      const now = Date.now()
      await db.folders.add({ id, name, parentId: null, createdAt: now, updatedAt: now })
      folderCache.set(name, id)
      return id
    }

    const titles: string[] = []
    for (const { file, parsed } of documents) {
      const title = uniqueTitle(parsed.title, reserved)
      reserved.push(title)
      const now = Date.now()
      const folderId =
        targetFolder ??
        (parsed.folderName ? await resolveFrontmatterFolder(parsed.folderName) : null)
      const note: Note = {
        id: createId(),
        title,
        content: parsed.content,
        folderId,
        tags: parsed.tags,
        favorite: false,
        trashedAt: null,
        createdAt: now,
        updatedAt: now,
        accessedAt: now,
        aliases: parsed.aliases,
        wordCount: countWords(parsed.content),
        metadata: { importedFrom: file.name, importedAt: now },
      }
      await db.notes.add(note)
      titles.push(title)
    }
    return titles
  })

  return { imported: importedTitles.length, titles: importedTitles, warnings }
}

interface ZipImportOptions {
  restoreSettings?: boolean
}

export interface ZipImportResult {
  importedNotes: number
  importedFolders: number
  importedAttachments: number
  titles: string[]
}

function isManifest(value: unknown): value is BackupManifest {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return record.format === 'mindora-backup' && record.version === 1 && Array.isArray(record.notes)
}

export async function importBackupZip(file: File, options: ZipImportOptions = {}): Promise<ZipImportResult> {
  if (!file.name.toLowerCase().endsWith('.zip')) throw new LocalizedError('error.backupChooseZip')
  if (file.size > MAX_BACKUP_SIZE) throw new LocalizedError('error.backupTooLarge')

  const bytes = new Uint8Array(await file.arrayBuffer())
  let entries: Record<string, Uint8Array>
  try {
    entries = unzipSync(bytes)
  } catch {
    throw new LocalizedError('error.backupUnzip')
  }

  const paths = Object.keys(entries)
  if (paths.length > MAX_BACKUP_ENTRIES) throw new LocalizedError('error.backupTooManyEntries')
  const totalSize = Object.values(entries).reduce((sum, entry) => sum + entry.byteLength, 0)
  if (totalSize > MAX_BACKUP_SIZE) throw new LocalizedError('error.backupTooLarge')

  const manifestBytes = entries['manifest.json']
  if (!manifestBytes) throw new LocalizedError('error.backupManifestMissing')
  let parsedManifest: unknown
  try {
    parsedManifest = JSON.parse(strFromU8(manifestBytes))
  } catch {
    throw new LocalizedError('error.backupManifestInvalid')
  }
  if (!isManifest(parsedManifest)) throw new LocalizedError('error.backupUnsupported')
  const manifest = parsedManifest

  for (const note of manifest.notes) {
    if (typeof note.contentPath !== 'string' || !entries[note.contentPath]) {
      throw new LocalizedError('error.backupContentMissing', { title: note.title })
    }
    if (note.contentPath.includes('..') || note.contentPath.startsWith('/')) {
      throw new LocalizedError('error.backupUnsafePath')
    }
  }

  const folderIdMap = new Map<string, string>()
  for (const folder of manifest.folders) folderIdMap.set(folder.id, createId())
  const noteIdMap = new Map<string, string>()
  for (const note of manifest.notes) noteIdMap.set(note.id, createId())
  const attachmentIdMap = new Map<string, string>()
  for (const attachment of manifest.attachments) attachmentIdMap.set(attachment.id, createId())

  const newFolders: Folder[] = manifest.folders.map((folder) => ({
    id: folderIdMap.get(folder.id) ?? createId(),
    name: displayTitle(folder.name),
    parentId: folder.parentId ? (folderIdMap.get(folder.parentId) ?? null) : null,
    createdAt: folder.createdAt || Date.now(),
    updatedAt: folder.updatedAt || Date.now(),
  }))

  const newNotes: Note[] = []
  for (const meta of manifest.notes) {
    let content = strFromU8(entries[meta.contentPath] ?? new Uint8Array())
    for (const [oldId, newId] of attachmentIdMap) {
      content = content.split(`mindora-asset://${oldId}`).join(`mindora-asset://${newId}`)
    }
    newNotes.push({
      id: noteIdMap.get(meta.id) ?? createId(),
      title: displayTitle(meta.title),
      content,
      folderId: meta.folderId ? (folderIdMap.get(meta.folderId) ?? null) : null,
      tags: cleanTags(Array.isArray(meta.tags) ? meta.tags : []),
      favorite: Boolean(meta.favorite),
      trashedAt: typeof meta.trashedAt === 'number' ? meta.trashedAt : null,
      createdAt: meta.createdAt || Date.now(),
      updatedAt: meta.updatedAt || Date.now(),
      accessedAt: Date.now(),
      aliases: Array.isArray(meta.aliases) ? meta.aliases.filter((alias) => typeof alias === 'string') : [],
      wordCount: countWords(content),
      metadata: meta.metadata && typeof meta.metadata === 'object' ? meta.metadata : {},
    })
  }

  const newAttachments: Attachment[] = []
  for (const meta of manifest.attachments) {
    const data = entries[meta.path]
    if (!data) throw new LocalizedError('error.backupAttachmentMissing', { name: meta.name })
    const blob = new Blob([data as BlobPart], { type: meta.mimeType || 'application/octet-stream' })
    newAttachments.push({
      id: attachmentIdMap.get(meta.id) ?? createId(),
      noteId: meta.noteId ? (noteIdMap.get(meta.noteId) ?? null) : null,
      name: meta.name,
      mimeType: meta.mimeType,
      size: blob.size,
      blob,
      createdAt: meta.createdAt || Date.now(),
    })
  }

  for (const attachment of newAttachments) {
    if (!attachment.blob) continue
    await attachmentApi.upload(
      new File([attachment.blob], attachment.name, { type: attachment.mimeType }),
      attachment.noteId,
      attachment.id,
    )
  }

  const titles = await db.transaction('rw', db.notes, db.folders, db.attachments, db.settings, async () => {
    await db.folders.bulkAdd(newFolders)
    const existing = await db.notes.toArray()
    const reserved = existing.map((note) => note.title)
    const importedTitles: string[] = []
    for (const note of newNotes) {
      const title = uniqueTitle(note.title, reserved)
      reserved.push(title)
      await db.notes.add({ ...note, title })
      importedTitles.push(title)
    }
    if (newAttachments.length > 0) await db.attachments.bulkAdd(newAttachments)
    if (options.restoreSettings && manifest.settings && typeof manifest.settings === 'object') {
      await db.settings.put({ key: 'app', value: manifest.settings })
    }
    return importedTitles
  })

  return {
    importedNotes: newNotes.length,
    importedFolders: newFolders.length,
    importedAttachments: newAttachments.length,
    titles,
  }
}


