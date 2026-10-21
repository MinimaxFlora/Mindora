import { useLiveQuery } from 'dexie-react-hooks'
import * as React from 'react'

import { db } from '@/db/database'
import type { Folder, Note } from '@/db/types'

interface DataContextValue {
  notes: Note[]
  folders: Folder[]
  activeNotes: Note[]
  trashedNotes: Note[]
  favoriteNotes: Note[]
  recentNotes: Note[]
  loading: boolean
  getNote: (id: string | undefined) => Note | undefined
  getFolder: (id: string | null | undefined) => Folder | undefined
}

const DataContext = React.createContext<DataContextValue | null>(null)

const byUpdated = (a: Note, b: Note) => b.updatedAt - a.updatedAt

export function DataProvider({ children }: { children: React.ReactNode }) {
  const notesResult = useLiveQuery(() => db.notes.toArray(), [])
  const foldersResult = useLiveQuery(() => db.folders.toArray(), [])

  const notes = React.useMemo(() => notesResult ?? [], [notesResult])
  const folders = React.useMemo(
    () => (foldersResult ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
    [foldersResult],
  )

  const activeNotes = React.useMemo(
    () => notes.filter((note) => note.trashedAt === null).sort(byUpdated),
    [notes],
  )
  const trashedNotes = React.useMemo(
    () =>
      notes
        .filter((note) => note.trashedAt !== null)
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [notes],
  )
  const favoriteNotes = React.useMemo(
    () => activeNotes.filter((note) => note.favorite),
    [activeNotes],
  )
  const recentNotes = React.useMemo(
    () => activeNotes.slice().sort((a, b) => b.accessedAt - a.accessedAt),
    [activeNotes],
  )

  const noteMap = React.useMemo(() => new Map(notes.map((note) => [note.id, note])), [notes])
  const folderMap = React.useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders])

  const value = React.useMemo<DataContextValue>(
    () => ({
      notes,
      folders,
      activeNotes,
      trashedNotes,
      favoriteNotes,
      recentNotes,
      loading: notesResult === undefined || foldersResult === undefined,
      getNote: (id) => (id ? noteMap.get(id) : undefined),
      getFolder: (id) => (id ? folderMap.get(id) : undefined),
    }),
    [
      notes,
      folders,
      activeNotes,
      trashedNotes,
      favoriteNotes,
      recentNotes,
      notesResult,
      foldersResult,
      noteMap,
      folderMap,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const value = React.useContext(DataContext)
  if (!value) throw new Error('useData must be used inside DataProvider')
  return value
}
