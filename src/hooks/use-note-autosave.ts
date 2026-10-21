import * as React from 'react'
import { toast } from 'sonner'

import { saveNoteDraft } from '@/db/repository'
import type { Note, NoteDraft } from '@/db/types'
import { useI18n } from '@/i18n/use-i18n'
import { errorText, LocalizedError } from '@/lib/errors'

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

function draftSnapshot(draft: NoteDraft): string {
  return JSON.stringify({
    title: draft.title,
    content: draft.content,
    folderId: draft.folderId,
    tags: draft.tags,
    favorite: draft.favorite,
  })
}

export function noteToDraft(note: Note): NoteDraft {
  return {
    title: note.title,
    content: note.content,
    folderId: note.folderId,
    tags: note.tags,
    favorite: note.favorite,
  }
}

export function useNoteAutosave(
  note: Note,
  draft: NoteDraft,
  delay: number,
  enabled = true,
): {
  state: SaveState
  error: string | null
  saveNow: () => Promise<void>
  retry: () => void
} {
  const { t } = useI18n()
  const [state, setState] = React.useState<SaveState>('saved')
  const [error, setError] = React.useState<string | null>(null)
  const draftRef = React.useRef(draft)
  const lastSavedRef = React.useRef(draftSnapshot(noteToDraft(note)))
  const timerRef = React.useRef<number | null>(null)
  const inFlightRef = React.useRef(false)
  const queuedRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  const noteIdRef = React.useRef(note.id)

  React.useEffect(() => {
    noteIdRef.current = note.id
  }, [note.id])

  React.useEffect(() => {
    draftRef.current = draft
  }, [draft])

  const clearTimer = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const saveNow = React.useCallback(async () => {
    if (!enabled) return
    if (inFlightRef.current) {
      queuedRef.current = true
      return
    }

    inFlightRef.current = true
    try {
      while (true) {
        queuedRef.current = false
        const snapshot = draftSnapshot(draftRef.current)
        if (snapshot === lastSavedRef.current) {
          if (mountedRef.current) setState('saved')
          break
        }

        if (mountedRef.current) {
          setState('saving')
          setError(null)
        }
        try {
          const saved = await saveNoteDraft(noteIdRef.current, draftRef.current)
          if (!saved) throw new LocalizedError('error.noteDeleted')
          lastSavedRef.current = snapshot
          if (mountedRef.current) {
            const current = draftSnapshot(draftRef.current)
            setState(current === snapshot ? 'saved' : 'dirty')
          }
        } catch (cause) {
          if (mountedRef.current) {
            const message = errorText(cause, t, 'editor.toast.autosaveFailedDesc')
            setError(message)
            setState('error')
            toast.error(t('editor.toast.autosaveFailed'), {
              description: t('editor.toast.autosaveFailedBody', { message }),
            })
          }
          break
        }

        if (!queuedRef.current && draftSnapshot(draftRef.current) === lastSavedRef.current) break
      }
    } finally {
      inFlightRef.current = false
    }
  }, [enabled, t])

  const serialized = draftSnapshot(draft)

  React.useEffect(() => {
    if (!enabled) return
    if (serialized === lastSavedRef.current) {
      setState('saved')
      return
    }
    setState('dirty')
    clearTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      void saveNow()
    }, Math.max(250, delay))
    return clearTimer
  }, [serialized, delay, enabled, saveNow, clearTimer])

  React.useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      clearTimer()
      if (enabled && draftSnapshot(draftRef.current) !== lastSavedRef.current) {
        void saveNow()
      }
    }
  }, [enabled, saveNow, clearTimer])

  React.useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (draftSnapshot(draftRef.current) !== lastSavedRef.current) {
        event.preventDefault()
        event.returnValue = ''
      }
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && draftSnapshot(draftRef.current) !== lastSavedRef.current) {
        void saveNow()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handleVisibility)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handleVisibility)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [saveNow])

  return {
    state,
    error,
    saveNow,
    retry: () => void saveNow(),
  }
}
