import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createBackupArchive, importBackupZip, importMarkdownFiles } from '@/lib/backup'
import { setActiveLocale } from '@/lib/locale'

import { db } from './database'
import {
  createFolder,
  createNote,
  deleteFolder,
  renameTag,
  restoreNotes,
  saveNoteDraft,
  toggleFavorite,
  trashNotes,
} from './repository'

beforeEach(async () => {
  setActiveLocale('en')
  await db.delete()
  await db.open()
})

afterEach(async () => {
  await db.delete()
})

describe('repository', () => {
  it('creates unique titles and persists the note', async () => {
    const first = await createNote({ title: 'New idea' })
    const second = await createNote({ title: 'New idea' })
    expect(first.title).toBe('New idea')
    expect(second.title).toBe('New idea 2')
    expect(await db.notes.get(first.id)).toMatchObject({ title: 'New idea', trashedAt: null })
  })

  it('adds the previous title as an alias when renaming', async () => {
    const created = await createNote({ title: 'Old title' })
    await saveNoteDraft(created.id, {
      title: 'New title',
      content: 'updated body',
      folderId: null,
      tags: ['test'],
      favorite: false,
    })
    const saved = await db.notes.get(created.id)
    expect(saved?.title).toBe('New title')
    expect(saved?.aliases).toContain('Old title')
  })

  it('moves notes and children safely when deleting a folder', async () => {
    const parent = await createFolder('Parent')
    const child = await createFolder('Child', parent)
    const inside = await createNote({ title: 'Inside', folderId: child })
    const result = await deleteFolder(child)
    expect(result.movedNotes).toBe(1)
    expect((await db.notes.get(inside.id))?.folderId).toBe(parent)
    expect(await db.folders.get(child)).toBeUndefined()
  })

  it('trashes, restores, and favorites notes', async () => {
    const created = await createNote({ title: 'Disposable' })
    await trashNotes([created.id])
    expect((await db.notes.get(created.id))?.trashedAt).not.toBeNull()
    await restoreNotes([created.id])
    expect((await db.notes.get(created.id))?.trashedAt).toBeNull()
    await toggleFavorite(created.id)
    expect((await db.notes.get(created.id))?.favorite).toBe(true)
  })

  it('renames tags across notes', async () => {
    const first = await createNote({ title: 'One', tags: ['old'] })
    const second = await createNote({ title: 'Two', tags: ['old', 'keep'] })
    const changed = await renameTag('old', 'new')
    expect(changed).toBe(2)
    expect((await db.notes.get(first.id))?.tags).toContain('new')
    expect((await db.notes.get(second.id))?.tags).toEqual(['new', 'keep'])
  })

  it('imports Markdown and creates a restorable ZIP backup', async () => {
    const file = new File(
      [
        '---\ntitle: Imported note\ntags: [alpha, beta]\nfolder: Imported folder\n---\n\n# Imported note\n\nHello archive.',
      ],
      'imported.md',
      { type: 'text/markdown' },
    )
    const result = await importMarkdownFiles([file], {})
    expect(result.imported).toBe(1)
    const imported = await db.notes.where('title').equals('Imported note').first()
    expect(imported?.tags).toEqual(['alpha', 'beta'])
    const importedFolder = await db.folders.where('name').equals('Imported folder').first()
    expect(imported?.folderId).toBe(importedFolder?.id)

    const backup = await createBackupArchive()
    expect(backup.noteCount).toBeGreaterThanOrEqual(3)
    expect(backup.filename).toMatch(/^mindora-backup-\d{4}-\d{2}-\d{2}\.zip$/)
    const bytes = new Uint8Array(await backup.blob.arrayBuffer())
    expect(bytes.byteLength).toBeGreaterThan(100)

    const before = await db.notes.count()
    const zipFile = new File([bytes], backup.filename, { type: 'application/zip' })
    const restored = await importBackupZip(zipFile)
    expect(restored.importedNotes).toBe(backup.noteCount)
    expect(await db.notes.count()).toBe(before + restored.importedNotes)
  })
})
