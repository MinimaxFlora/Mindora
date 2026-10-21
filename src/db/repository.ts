import { cleanTags, countWords, createId, displayTitle, normalizeTag, uniqueTitle } from '@/lib/utils'

import { translate } from '@/i18n/messages'
import { LocalizedError } from '@/lib/errors'
import { getActiveLocale } from '@/lib/locale'
import { attachmentApi } from '@/sync/api'
import { withSyncSuppressed } from '@/sync/tracker'

import { db } from './database'
import { DEFAULT_SETTINGS, mergeSettings, type AppSettings, type Note, type NoteDraft } from './types'

export interface CreateNoteInput {
  title?: string
  content?: string
  folderId?: string | null
  tags?: string[]
}

export async function createNote(input: CreateNoteInput = {}): Promise<Note> {
  const now = Date.now()
  return db.transaction('rw', db.notes, db.folders, async () => {
    const notes = await db.notes.toArray()
    const title = uniqueTitle(
      displayTitle(input.title ?? ''),
      notes.map((note) => note.title),
    )
    const folderId = input.folderId ?? null
    const folder = folderId ? await db.folders.get(folderId) : undefined
    const note: Note = {
      id: createId(),
      title,
      content: input.content ?? '',
      folderId: folder ? folder.id : null,
      tags: cleanTags(input.tags ?? []),
      favorite: false,
      trashedAt: null,
      createdAt: now,
      updatedAt: now,
      accessedAt: now,
      aliases: [],
      wordCount: countWords(input.content ?? ''),
      metadata: {},
    }
    await db.notes.add(note)
    return note
  })
}

export async function saveNoteDraft(id: string, draft: NoteDraft): Promise<Note | null> {
  return db.transaction('rw', db.notes, async () => {
    const existing = await db.notes.get(id)
    if (!existing) return null

    const title = displayTitle(draft.title)
    const content = draft.content
    const tags = cleanTags(draft.tags)
    const folderId = draft.folderId
    const favorite = draft.favorite

    const unchanged =
      existing.title === title &&
      existing.content === content &&
      existing.folderId === folderId &&
      existing.favorite === favorite &&
      existing.tags.length === tags.length &&
      existing.tags.every((tag, index) => tag === tags[index])

    if (unchanged) return existing

    const aliases = [...existing.aliases]
    if (existing.title !== title && existing.title.trim()) {
      const oldTitle = existing.title.trim()
      if (oldTitle !== title && !aliases.some((alias) => alias.toLocaleLowerCase() === oldTitle.toLocaleLowerCase())) {
        aliases.push(oldTitle)
      }
    }
    const cleanedAliases = aliases
      .filter((alias) => alias.trim() && alias.trim().toLocaleLowerCase() !== title.toLocaleLowerCase())
      .slice(-20)

    const now = Date.now()
    const updated: Note = {
      ...existing,
      title,
      content,
      folderId,
      tags,
      favorite,
      aliases: cleanedAliases,
      updatedAt: now,
      accessedAt: now,
      wordCount: countWords(content),
    }
    await db.notes.put(updated)
    return updated
  })
}

export async function markNoteAccessed(id: string): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  const now = Date.now()
  if (now - note.accessedAt < 60_000) return
  await db.notes.update(id, { accessedAt: now })
}

export async function toggleFavorite(id: string): Promise<boolean> {
  return db.transaction('rw', db.notes, async () => {
    const note = await db.notes.get(id)
    if (!note) return false
    const favorite = !note.favorite
    await db.notes.update(id, { favorite, updatedAt: Date.now() })
    return favorite
  })
}

export async function trashNotes(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const now = Date.now()
  await db.notes.where('id').anyOf([...ids]).modify({ trashedAt: now })
}

export async function restoreNotes(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  const now = Date.now()
  await db.notes.where('id').anyOf([...ids]).modify({ trashedAt: null, accessedAt: now })
}

export async function deleteNotesPermanently(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.notes, db.attachments, async () => {
    await db.attachments.where('noteId').anyOf([...ids]).delete()
    await db.notes.bulkDelete([...ids])
  })
}

export async function emptyTrash(): Promise<number> {
  return db.transaction('rw', db.notes, db.attachments, async () => {
    const trashed = await db.notes.filter((note) => note.trashedAt !== null).toArray()
    const ids = trashed.map((note) => note.id)
    if (ids.length > 0) {
      await db.attachments.where('noteId').anyOf(ids).delete()
      await db.notes.bulkDelete(ids)
    }
    return ids.length
  })
}

export async function moveNotes(ids: readonly string[], folderId: string | null): Promise<void> {
  if (ids.length === 0) return
  if (folderId) {
    const folder = await db.folders.get(folderId)
    if (!folder) throw new LocalizedError('error.targetFolderMissing')
  }
  await db.notes
    .where('id')
    .anyOf([...ids])
    .modify({ folderId, updatedAt: Date.now() })
}

export async function renameTag(oldTag: string, nextTag: string): Promise<number> {
  const target = normalizeTag(nextTag)
  if (!target) throw new LocalizedError('error.tagNameRequired')
  return db.transaction('rw', db.notes, async () => {
    let changed = 0
    await db.notes.toCollection().modify((note) => {
      if (!note.tags.includes(oldTag) || oldTag === target) return
      note.tags = cleanTags(note.tags.map((tag) => (tag === oldTag ? target : tag)))
      note.updatedAt = Date.now()
      changed += 1
    })
    return changed
  })
}

export async function deleteTag(tag: string): Promise<number> {
  return db.transaction('rw', db.notes, async () => {
    let changed = 0
    await db.notes.toCollection().modify((note) => {
      if (!note.tags.includes(tag)) return
      note.tags = note.tags.filter((item) => item !== tag)
      note.updatedAt = Date.now()
      changed += 1
    })
    return changed
  })
}

export async function createFolder(name: string, parentId: string | null = null): Promise<string> {
  const cleanName = name.trim()
  if (!cleanName) throw new LocalizedError('error.folderNameRequired')
  return db.transaction('rw', db.folders, async () => {
    if (parentId) {
      const parent = await db.folders.get(parentId)
      if (!parent) throw new LocalizedError('error.parentFolderMissing')
    }
    const siblings = await db.folders.filter((folder) => folder.parentId === parentId).toArray()
    const finalName = uniqueTitle(cleanName, siblings.map((folder) => folder.name))
    const now = Date.now()
    const id = createId()
    await db.folders.add({ id, name: finalName, parentId, createdAt: now, updatedAt: now })
    return id
  })
}

export async function renameFolder(id: string, name: string): Promise<void> {
  const cleanName = name.trim()
  if (!cleanName) throw new LocalizedError('error.folderNameRequired')
  await db.transaction('rw', db.folders, async () => {
    const folder = await db.folders.get(id)
    if (!folder) throw new LocalizedError('error.folderMissing')
    const siblings = await db.folders
      .filter((candidate) => candidate.parentId === folder.parentId && candidate.id !== id)
      .toArray()
    const finalName = uniqueTitle(cleanName, siblings.map((candidate) => candidate.name))
    await db.folders.update(id, { name: finalName, updatedAt: Date.now() })
  })
}

export async function deleteFolder(id: string): Promise<{ movedNotes: number; movedFolders: number }> {
  return db.transaction('rw', db.folders, db.notes, async () => {
    const folder = await db.folders.get(id)
    if (!folder) return { movedNotes: 0, movedFolders: 0 }
    const children = await db.folders.where('parentId').equals(id).toArray()
    for (const child of children) {
      await db.folders.update(child.id, { parentId: folder.parentId, updatedAt: Date.now() })
    }
    const movedNotes = await db.notes.where('folderId').equals(id).modify({
      folderId: folder.parentId,
      updatedAt: Date.now(),
    })
    await db.folders.delete(id)
    return { movedNotes, movedFolders: children.length }
  })
}

export async function loadSettings(): Promise<AppSettings> {
  const record = await db.settings.get('app')
  return mergeSettings(record?.value)
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: 'app', value: settings })
}

export async function resetSettings(): Promise<AppSettings> {
  await db.settings.put({ key: 'app', value: DEFAULT_SETTINGS })
  return DEFAULT_SETTINGS
}

const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024

export async function addAttachment(file: File, noteId: string | null): Promise<{
  id: string
  name: string
  mimeType: string
  size: number
}> {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new LocalizedError('error.attachmentTooLarge', { name: file.name })
  }
  const name = file.name || translate(getActiveLocale(), 'editor.pastedImage')
  const remote = await attachmentApi.upload(new File([file], name, { type: file.type }), noteId)
  await withSyncSuppressed(async () => {
    await db.attachments.put({
      ...remote,
      blob: file,
    })
  })
  return {
    id: remote.id,
    name: remote.name,
    mimeType: remote.mimeType,
    size: remote.size,
  }
}

export async function getAttachment(id: string): Promise<Blob | undefined> {
  const local = await db.attachments.get(id)
  if (local?.blob && local.blob.size > 0) return local.blob
  const remote = await attachmentApi.download(id)
  if (!remote) return undefined
  if (local) {
    await withSyncSuppressed(async () => {
      await db.attachments.update(id, { blob: remote })
    })
  }
  return remote
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id)
}

export async function getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null
  const estimate = await navigator.storage.estimate()
  return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
}
