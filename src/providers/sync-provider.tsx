import { Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { db } from '@/db/database'
import type { Attachment, Folder, Note } from '@/db/types'
import { useI18n } from '@/i18n/use-i18n'
import { syncApi, type AuthUser, type SyncSnapshot } from '@/sync/api'
import {
  hasDirtyState,
  installSyncTracking,
  resetDirtyState,
  restoreDirtyState,
  setSyncNotifier,
  takeDirtyState,
  withSyncSuppressed,
  type DirtyState,
} from '@/sync/tracker'

export type SyncPhase = 'connecting' | 'synced' | 'syncing' | 'error'

interface SyncContextValue {
  phase: SyncPhase
  lastSyncedAt: number | null
  error: string | null
  syncNow: () => Promise<void>
  retry: () => void
}

const SyncContext = React.createContext<SyncContextValue | null>(null)

const SYNC_USER_KEY = 'mindora:sync-user'
const LAST_SYNC_KEY = 'mindora:last-sync'
const CHUNK_SIZE = 500

function markSyncedNow(offset = 0): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now() - offset))
}

async function applySnapshot(snapshot: SyncSnapshot): Promise<void> {
  const existing = await db.attachments.toArray()
  const blobs = new Map(existing.map((attachment) => [attachment.id, attachment.blob]))
  await withSyncSuppressed(async () => {
    await db.transaction('rw', db.notes, db.folders, db.attachments, db.settings, async () => {
      await db.notes.clear()
      if (snapshot.notes.length > 0) await db.notes.bulkAdd(snapshot.notes)
      await db.folders.clear()
      if (snapshot.folders.length > 0) await db.folders.bulkAdd(snapshot.folders)
      await db.attachments.clear()
      if (snapshot.attachments.length > 0) {
        const rows: Attachment[] = snapshot.attachments.map((attachment) => ({
          ...attachment,
          blob: blobs.get(attachment.id),
        }))
        await db.attachments.bulkAdd(rows)
      }
      // Appearance, locale, and editor preferences stay device-specific.
      // Only notes, folders, and attachments are account data.
    })
  })
}

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size))
  }
  return result
}

async function pushAllLocal(): Promise<SyncSnapshot> {
  const [notes, folders, settings] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.settings.get('app'),
  ])
  const noteChunks = notes.length > 0 ? chunk(notes, CHUNK_SIZE) : [[]]
  let snapshot: SyncSnapshot | null = null
  for (let index = 0; index < noteChunks.length; index += 1) {
    snapshot = await syncApi.push({
      notes: noteChunks[index] ?? [],
      folders: index === 0 ? folders : [],
      settings: index === 0 ? settings?.value : undefined,
      deletedNoteIds: [],
      deletedFolderIds: [],
      deletedAttachmentIds: [],
    })
  }
  if (!snapshot) throw new Error('Sync failed')
  return snapshot
}

/**
 * A quick reload can happen after IndexedDB changed but before the debounced
 * cloud push finished. On boot, push those local changes before adopting the
 * remote snapshot, otherwise the server copy would silently win.
 */
async function mergeUnsyncedLocal(server: SyncSnapshot): Promise<SyncSnapshot> {
  const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
  const serverNotes = new Map(server.notes.map((note) => [note.id, note]))
  const serverFolders = new Map(server.folders.map((folder) => [folder.id, folder]))
  const localNotes = await db.notes.toArray()
  const localFolders = await db.folders.toArray()
  const pendingNotes = localNotes.filter((note) => {
    const remote = serverNotes.get(note.id)
    if (remote) return note.updatedAt > remote.updatedAt
    return note.createdAt > lastSync
  })
  const pendingFolders = localFolders.filter((folder) => {
    const remote = serverFolders.get(folder.id)
    if (remote) return folder.updatedAt > remote.updatedAt
    return folder.createdAt > lastSync
  })
  if (pendingNotes.length === 0 && pendingFolders.length === 0) return server

  let snapshot = server
  const noteChunks = chunk(pendingNotes, CHUNK_SIZE)
  for (let index = 0; index < noteChunks.length; index += 1) {
    snapshot = await syncApi.push({
      notes: noteChunks[index] ?? [],
      folders: index === 0 ? pendingFolders : [],
      settings: undefined,
      deletedNoteIds: [],
      deletedFolderIds: [],
      deletedAttachmentIds: [],
    })
  }
  return snapshot
}

function SyncGate({
  phase,
  error,
  onRetry,
  onSignOut,
}: {
  phase: SyncPhase
  error: string | null
  onRetry: () => void
  onSignOut: () => void
}) {
  const { t } = useI18n()
  if (phase === 'error' && error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background px-6">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-7 shadow-soft">
          <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <CloudOff className="size-5" />
          </div>
          <h1 className="text-[18px] font-semibold tracking-[-0.02em]">{t('sync.errorTitle')}</h1>
          <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">{error}</p>
          <p className="mt-2 text-[10.5px] leading-4 text-muted-foreground">{t('sync.errorDesc')}</p>
          <div className="mt-5 flex gap-2">
            <Button onClick={onRetry}>
              <RefreshCw />
              {t('sync.retry')}
            </Button>
            <Button variant="ghost" onClick={onSignOut}>
              {t('auth.signOut')}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-background text-muted-foreground">
      <Loader2 className="size-5 animate-spin text-primary" />
      <p className="text-[12px]">{t('sync.connecting')}</p>
    </div>
  )
}

export function SyncProvider({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const { t } = useI18n()
  const [phase, setPhase] = React.useState<SyncPhase>('connecting')
  const [error, setError] = React.useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null)
  const [ready, setReady] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  const syncingRef = React.useRef(false)
  const pendingRef = React.useRef(false)
  const pushRef = React.useRef<() => Promise<void>>(async () => {})
  const errorToastRef = React.useRef<string | null>(null)

  const pushDirty = React.useCallback(async () => {
    if (syncingRef.current) {
      pendingRef.current = true
      return
    }
    if (!hasDirtyState()) return
    syncingRef.current = true
    setPhase('syncing')
    const dirty: DirtyState = takeDirtyState()
    try {
      const noteIds = Array.from(dirty.notes)
      const notes = (await db.notes.bulkGet(noteIds)).filter((note): note is Note => Boolean(note))
      const folderIds = Array.from(dirty.folders)
      const folders = (await db.folders.bulkGet(folderIds)).filter(
        (folder): folder is Folder => Boolean(folder),
      )
      const settings = dirty.settings ? (await db.settings.get('app'))?.value : undefined
      const noteChunks = notes.length > 0 ? chunk(notes, CHUNK_SIZE) : [[]]
      for (let index = 0; index < noteChunks.length; index += 1) {
        await syncApi.push({
          notes: noteChunks[index] ?? [],
          folders: index === 0 ? folders : [],
          settings: index === 0 ? settings : undefined,
          deletedNoteIds: index === 0 ? Array.from(dirty.deletedNotes) : [],
          deletedFolderIds: index === 0 ? Array.from(dirty.deletedFolders) : [],
          deletedAttachmentIds: index === 0 ? Array.from(dirty.deletedAttachments) : [],
        })
      }
      localStorage.setItem(SYNC_USER_KEY, user.id)
      markSyncedNow(5_000)
      errorToastRef.current = null
      setLastSyncedAt(Date.now())
      setError(null)
      setPhase('synced')
    } catch (cause) {
      restoreDirtyState(dirty)
      const message = cause instanceof Error ? cause.message : t('sync.errorDesc')
      setError(message)
      setPhase('error')
      if (errorToastRef.current !== message) {
        errorToastRef.current = message
        toast.error(t('sync.errorTitle'), { description: message })
      }
    } finally {
      syncingRef.current = false
      if (pendingRef.current || hasDirtyState()) {
        pendingRef.current = false
        window.setTimeout(() => void pushRef.current(), 400)
      }
    }
  }, [t, user.id])

  React.useEffect(() => {
    pushRef.current = pushDirty
  }, [pushDirty])

  const pullRemote = React.useCallback(async () => {
    if (!ready || syncingRef.current || hasDirtyState()) return
    try {
      const snapshot = await syncApi.snapshot()
      if (hasDirtyState()) return
      await applySnapshot(snapshot)
      markSyncedNow()
      setLastSyncedAt(Date.now())
      setPhase('synced')
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('sync.errorDesc'))
      setPhase('error')
    }
  }, [ready, t])

  React.useEffect(() => {
    let cancelled = false
    installSyncTracking()
    setSyncNotifier(() => {
      void pushRef.current()
    })

    const initialize = async () => {
      try {
        const snapshot = await syncApi.snapshot()
        if (cancelled) return
        const sameCachedAccount = localStorage.getItem(SYNC_USER_KEY) === user.id
        if (snapshot.notes.length === 0 && snapshot.folders.length === 0) {
          await pushAllLocal()
        } else if (sameCachedAccount) {
          const merged = await mergeUnsyncedLocal(snapshot)
          await applySnapshot(merged)
        } else {
          await applySnapshot(snapshot)
        }
        if (cancelled) return
        resetDirtyState()
        localStorage.setItem(SYNC_USER_KEY, user.id)
        markSyncedNow()
        setLastSyncedAt(Date.now())
        setPhase('synced')
        setReady(true)
      } catch (cause) {
        if (cancelled) return
        const message =
          cause instanceof Error ? cause.message : 'Could not connect to your Cloudflare notes'
        setError(message)
        setPhase('error')
      }
    }
    void initialize()

    return () => {
      cancelled = true
      setSyncNotifier(null)
    }
  }, [user.id, attempt])

  React.useEffect(() => {
    if (!ready) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void pullRemote()
    }, 30_000)
    const handleFocus = () => void pullRemote()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void pullRemote()
      else if (hasDirtyState()) void pushRef.current()
    }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [ready, pullRemote])

  const syncNow = React.useCallback(async () => {
    if (hasDirtyState()) await pushDirty()
    else await pullRemote()
  }, [pushDirty, pullRemote])

  const value = React.useMemo<SyncContextValue>(
    () => ({
      phase,
      lastSyncedAt,
      error,
      syncNow,
      retry: () => {
        setReady(false)
        setPhase('connecting')
        setError(null)
        setAttempt((current) => current + 1)
      },
    }),
    [phase, lastSyncedAt, error, syncNow],
  )

  if (!ready) {
    return (
      <SyncGate
        phase={phase}
        error={error}
        onRetry={() => {
          setReady(false)
          setPhase('connecting')
          setError(null)
          setAttempt((current) => current + 1)
        }}
        onSignOut={() => {
          void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).finally(
            async () => {
              await db.delete().catch(() => undefined)
              localStorage.removeItem(SYNC_USER_KEY)
              window.location.reload()
            },
          )
        }}
      />
    )
  }

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

export function useSyncStatus(): SyncContextValue {
  const value = React.useContext(SyncContext)
  if (!value) throw new Error('useSyncStatus must be used inside SyncProvider')
  return value
}

export function SyncIndicator() {
  const { phase, error, lastSyncedAt, syncNow } = useSyncStatus()
  const { t } = useI18n()
  const label =
    phase === 'syncing'
      ? t('sync.syncing')
      : phase === 'error'
        ? t('sync.offline')
        : lastSyncedAt
          ? t('sync.synced')
          : t('sync.connecting')
  const Icon = phase === 'error' ? CloudOff : phase === 'syncing' ? Loader2 : Cloud

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
      title={error ?? t('sync.syncedAt', { time: lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : '—' })}
      onClick={() => void syncNow()}
    >
      <Icon className={`size-3 ${phase === 'syncing' ? 'animate-spin' : ''}`} />
      {label}
    </button>
  )
}
