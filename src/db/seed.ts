import { detectLocale, type Locale } from '@/lib/locale'
import { countWords } from '@/lib/utils'

import { getSeedContent } from './seed-content'
import type { Folder, Note, SettingsRecord } from './types'
import { DEFAULT_SETTINGS } from './types'

const WELCOME_ID = 'note-welcome'
const MARKDOWN_GUIDE_ID = 'note-markdown-guide'
const GUIDE_FOLDER_ID = 'folder-getting-started'

export function createSeedData(
  now = Date.now(),
  locale: Locale = detectLocale(),
): {
  folders: Folder[]
  notes: Note[]
  settings: SettingsRecord
} {
  const content = getSeedContent(locale)

  const folders: Folder[] = [
    {
      id: GUIDE_FOLDER_ID,
      name: content.folderName,
      parentId: null,
      createdAt: now - 1000 * 60 * 60 * 24,
      updatedAt: now - 1000 * 60 * 60 * 24,
    },
  ]

  const notes: Note[] = [
    {
      id: WELCOME_ID,
      title: content.welcomeTitle,
      content: content.welcomeContent,
      folderId: GUIDE_FOLDER_ID,
      tags: content.welcomeTags,
      favorite: true,
      trashedAt: null,
      createdAt: now - 1000 * 60 * 60 * 24 * 2,
      updatedAt: now - 1000 * 60 * 60 * 4,
      accessedAt: now - 1000 * 60 * 60 * 4,
      aliases: [],
      wordCount: countWords(content.welcomeContent),
      metadata: { seeded: true },
    },
    {
      id: MARKDOWN_GUIDE_ID,
      title: content.guideTitle,
      content: content.guideContent,
      folderId: GUIDE_FOLDER_ID,
      tags: content.guideTags,
      favorite: false,
      trashedAt: null,
      createdAt: now - 1000 * 60 * 60 * 24,
      updatedAt: now - 1000 * 60 * 60 * 2,
      accessedAt: now - 1000 * 60 * 60 * 2,
      aliases: content.guideAliases,
      wordCount: countWords(content.guideContent),
      metadata: { seeded: true },
    },
  ]

  return {
    folders,
    notes,
    settings: {
      key: 'app',
      value: { ...DEFAULT_SETTINGS, locale },
    },
  }
}

export const SEED_NOTE_IDS = [WELCOME_ID, MARKDOWN_GUIDE_ID] as const
