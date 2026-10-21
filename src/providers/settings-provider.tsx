import { useLiveQuery } from 'dexie-react-hooks'
import * as React from 'react'

import { db } from '@/db/database'
import { saveSettings } from '@/db/repository'
import { translate } from '@/i18n/messages'
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  type AppSettings,
  type EditorSettings,
  type PreviewSettings,
} from '@/db/types'
import { htmlLang, setActiveLocale } from '@/lib/locale'

type SettingsUpdater =
  | Partial<AppSettings>
  | ((current: AppSettings) => AppSettings)

interface SettingsContextValue {
  settings: AppSettings
  resolvedTheme: 'light' | 'dark'
  loaded: boolean
  updateSettings: (update: SettingsUpdater) => void
  updateEditor: (patch: Partial<EditorSettings>) => void
  updatePreview: (patch: Partial<PreviewSettings>) => void
  resetSettings: () => void
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null)

const THEME_KEY = 'mindora:theme'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const record = useLiveQuery(() => db.settings.get('app'), [])
  const persisted = React.useMemo(() => mergeSettings(record?.value), [record])
  const [optimistic, setOptimistic] = React.useState<AppSettings | null>(null)
  const [systemDark, setSystemDark] = React.useState(systemPrefersDark)
  const settings = optimistic ?? persisted
  const lastPersistedLocale = React.useRef(settings.locale)
  // Keep locale-aware lib helpers (dates, numbers) in sync before children render.
  setActiveLocale(settings.locale)

  React.useEffect(() => {
    if (lastPersistedLocale.current === settings.locale) return
    lastPersistedLocale.current = settings.locale
    void saveSettings(settings).catch(() => {
      // The regular debounced settings write remains as a fallback.
    })
  }, [settings])

  React.useEffect(() => {
    document.documentElement.lang = htmlLang(settings.locale)
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', translate(settings.locale, 'app.metaDescription'))
  }, [settings.locale])

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme

  React.useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedTheme === 'dark')
    root.style.colorScheme = resolvedTheme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', resolvedTheme === 'dark' ? '#141613' : '#f5f3ee')
  }, [resolvedTheme])

  React.useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, settings.theme)
    } catch {
      // Private browsing can disable storage; the in-memory preference still applies.
    }
  }, [settings.theme])

  React.useEffect(() => {
    if (!optimistic) return
    let active = true
    const pending = optimistic
    const timer = window.setTimeout(() => {
      void saveSettings(pending)
        .then(() => {
          if (active) {
            setOptimistic((current) => (current === pending ? null : current))
          }
        })
        .catch(() => {
          // Settings are non-critical; the in-memory value remains usable.
        })
    }, 180)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [optimistic])

  const updateSettings = React.useCallback(
    (update: SettingsUpdater) => {
      setOptimistic((current) => {
        const base = current ?? persisted
        return typeof update === 'function' ? update(base) : { ...base, ...update }
      })
    },
    [persisted],
  )

  const updateEditor = React.useCallback(
    (patch: Partial<EditorSettings>) => {
      updateSettings((current) => ({ ...current, editor: { ...current.editor, ...patch } }))
    },
    [updateSettings],
  )

  const updatePreview = React.useCallback(
    (patch: Partial<PreviewSettings>) => {
      updateSettings((current) => ({ ...current, preview: { ...current.preview, ...patch } }))
    },
    [updateSettings],
  )

  const resetSettings = React.useCallback(() => {
    setOptimistic(DEFAULT_SETTINGS)
  }, [])

  const value = React.useMemo<SettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      loaded: record !== undefined,
      updateSettings,
      updateEditor,
      updatePreview,
      resetSettings,
    }),
    [settings, resolvedTheme, record, updateSettings, updateEditor, updatePreview, resetSettings],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = React.useContext(SettingsContext)
  if (!value) throw new Error('useSettings must be used inside SettingsProvider')
  return value
}
