import Dexie, { type EntityTable } from 'dexie'

import { createSeedData } from './seed'
import type { Attachment, Folder, Note, SettingsRecord } from './types'

export class MindoraDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>
  folders!: EntityTable<Folder, 'id'>
  attachments!: EntityTable<Attachment, 'id'>
  settings!: EntityTable<SettingsRecord, 'key'>

  constructor(name = 'mindora') {
    super(name)

    this.version(1).stores({
      notes:
        'id, title, updatedAt, createdAt, accessedAt, folderId, *tags, trashedAt, favorite',
      folders: 'id, parentId, name, createdAt',
      attachments: 'id, noteId, createdAt',
      settings: 'key',
    })

    this.on('populate', (transaction) => {
      const { folders, notes, settings } = createSeedData()
      transaction.table('folders').bulkAdd(folders)
      transaction.table('notes').bulkAdd(notes)
      transaction.table('settings').put(settings)
    })
  }
}

export const db = new MindoraDatabase()

export async function openDatabase(): Promise<void> {
  if (!db.isOpen()) await db.open()
}
