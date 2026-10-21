import { db } from '@/db/database'

export interface DirtyState {
  notes: Set<string>
  folders: Set<string>
  deletedNotes: Set<string>
  deletedFolders: Set<string>
  deletedAttachments: Set<string>
  settings: boolean
}

const dirty: DirtyState = {
  notes: new Set(),
  folders: new Set(),
  deletedNotes: new Set(),
  deletedFolders: new Set(),
  deletedAttachments: new Set(),
  settings: false,
}

let installed = false
let suppressionDepth = 0
let notifier: (() => void) | null = null
let notifyTimer: number | null = null

function schedule(): void {
  if (!notifier || typeof window === 'undefined') return
  if (notifyTimer !== null) window.clearTimeout(notifyTimer)
  notifyTimer = window.setTimeout(() => {
    notifyTimer = null
    notifier?.()
  }, 550)
}

export function installSyncTracking(): void {
  if (installed) return
  installed = true

  db.notes.hook('creating', (key, note) => {
    if (suppressionDepth > 0) return
    const id = String(note.id ?? key)
    dirty.deletedNotes.delete(id)
    dirty.notes.add(id)
    schedule()
  })
  db.notes.hook('updating', (_changes, key) => {
    if (suppressionDepth > 0) return
    const id = String(key)
    dirty.deletedNotes.delete(id)
    dirty.notes.add(id)
    schedule()
  })
  db.notes.hook('deleting', (key) => {
    if (suppressionDepth > 0) return
    const id = String(key)
    dirty.notes.delete(id)
    dirty.deletedNotes.add(id)
    schedule()
  })

  db.folders.hook('creating', (key, folder) => {
    if (suppressionDepth > 0) return
    const id = String(folder.id ?? key)
    dirty.deletedFolders.delete(id)
    dirty.folders.add(id)
    schedule()
  })
  db.folders.hook('updating', (_changes, key) => {
    if (suppressionDepth > 0) return
    const id = String(key)
    dirty.deletedFolders.delete(id)
    dirty.folders.add(id)
    schedule()
  })
  db.folders.hook('deleting', (key) => {
    if (suppressionDepth > 0) return
    const id = String(key)
    dirty.folders.delete(id)
    dirty.deletedFolders.add(id)
    schedule()
  })

  db.attachments.hook('deleting', (key) => {
    if (suppressionDepth > 0) return
    dirty.deletedAttachments.add(String(key))
    schedule()
  })

  db.settings.hook('creating', () => {
    if (suppressionDepth > 0) return
    dirty.settings = true
    schedule()
  })
  db.settings.hook('updating', () => {
    if (suppressionDepth > 0) return
    dirty.settings = true
    schedule()
  })
}

export function setSyncNotifier(handler: (() => void) | null): void {
  notifier = handler
  if (!handler && notifyTimer !== null) {
    window.clearTimeout(notifyTimer)
    notifyTimer = null
  }
}

export async function withSyncSuppressed<T>(operation: () => Promise<T>): Promise<T> {
  suppressionDepth += 1
  try {
    return await operation()
  } finally {
    suppressionDepth -= 1
  }
}

export function hasDirtyState(): boolean {
  return (
    dirty.notes.size > 0 ||
    dirty.folders.size > 0 ||
    dirty.deletedNotes.size > 0 ||
    dirty.deletedFolders.size > 0 ||
    dirty.deletedAttachments.size > 0 ||
    dirty.settings
  )
}

export function takeDirtyState(): DirtyState {
  const snapshot: DirtyState = {
    notes: new Set(dirty.notes),
    folders: new Set(dirty.folders),
    deletedNotes: new Set(dirty.deletedNotes),
    deletedFolders: new Set(dirty.deletedFolders),
    deletedAttachments: new Set(dirty.deletedAttachments),
    settings: dirty.settings,
  }
  dirty.notes.clear()
  dirty.folders.clear()
  dirty.deletedNotes.clear()
  dirty.deletedFolders.clear()
  dirty.deletedAttachments.clear()
  dirty.settings = false
  return snapshot
}

export function restoreDirtyState(snapshot: DirtyState): void {
  for (const id of snapshot.notes) dirty.notes.add(id)
  for (const id of snapshot.folders) dirty.folders.add(id)
  for (const id of snapshot.deletedNotes) dirty.deletedNotes.add(id)
  for (const id of snapshot.deletedFolders) dirty.deletedFolders.add(id)
  for (const id of snapshot.deletedAttachments) dirty.deletedAttachments.add(id)
  if (snapshot.settings) dirty.settings = true
}

export function resetDirtyState(): void {
  dirty.notes.clear()
  dirty.folders.clear()
  dirty.deletedNotes.clear()
  dirty.deletedFolders.clear()
  dirty.deletedAttachments.clear()
  dirty.settings = false
}
