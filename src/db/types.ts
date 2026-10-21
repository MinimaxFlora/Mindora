import { detectLocale, isLocale, type Locale } from '@/lib/locale'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ViewMode = 'source' | 'read' | 'split'
export type ListDensity = 'comfortable' | 'compact'

export interface Note {
  id: string
  title: string
  content: string
  folderId: string | null
  tags: string[]
  favorite: boolean
  trashedAt: number | null
  createdAt: number
  updatedAt: number
  accessedAt: number
  /** Previous titles are retained so [[old title]] links keep resolving after a rename. */
  aliases: string[]
  wordCount: number
  metadata: Record<string, unknown>
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: number
  updatedAt: number
}

export interface Attachment {
  id: string
  noteId: string | null
  name: string
  mimeType: string
  size: number
  /** The binary is cached locally; remote-only metadata has no blob until downloaded. */
  blob?: Blob
  createdAt: number
}

export interface EditorSettings {
  fontSize: number
  lineHeight: number
  lineNumbers: boolean
  defaultViewMode: ViewMode
  spellcheck: boolean
}

export interface PreviewSettings {
  fontSize: number
  maxWidth: number
}

export interface AppSettings {
  locale: Locale
  theme: ThemePreference
  editor: EditorSettings
  preview: PreviewSettings
  autoSaveDelay: number
  listDensity: ListDensity
  sidebarCollapsed: boolean
  showWordCount: boolean
  confirmBeforeTrash: boolean
}

export interface SettingsRecord {
  key: string
  value: AppSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: detectLocale(),
  theme: 'system',
  editor: {
    fontSize: 15,
    lineHeight: 1.75,
    lineNumbers: false,
    defaultViewMode: 'split',
    spellcheck: true,
  },
  preview: {
    fontSize: 16,
    maxWidth: 760,
  },
  autoSaveDelay: 700,
  listDensity: 'comfortable',
  sidebarCollapsed: false,
  showWordCount: true,
  confirmBeforeTrash: true,
}

export function mergeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS
  const partial = value as Partial<AppSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    locale: isLocale(partial.locale) ? partial.locale : DEFAULT_SETTINGS.locale,
    editor: { ...DEFAULT_SETTINGS.editor, ...(partial.editor ?? {}) },
    preview: { ...DEFAULT_SETTINGS.preview, ...(partial.preview ?? {}) },
  }
}

export interface NoteDraft {
  title: string
  content: string
  folderId: string | null
  tags: string[]
  favorite: boolean
}

export type NoteScope =
  | { kind: 'all' }
  | { kind: 'folder'; folderId: string }
  | { kind: 'tag'; tag: string }
  | { kind: 'favorites' }
  | { kind: 'recent' }
  | { kind: 'trash' }
