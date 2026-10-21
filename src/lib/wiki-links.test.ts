import { describe, expect, it } from 'vitest'

import type { Note } from '@/db/types'

import {
  collectNoteConnections,
  createNoteResolver,
  extractWikiLinks,
  getBacklinks,
  getOutgoingLinks,
} from './wiki-links'

function note(overrides: Partial<Note> & Pick<Note, 'id' | 'title'>): Note {
  return {
    content: '',
    folderId: null,
    tags: [],
    favorite: false,
    trashedAt: null,
    createdAt: 1,
    updatedAt: 1,
    accessedAt: 1,
    aliases: [],
    wordCount: 0,
    metadata: {},
    ...overrides,
  }
}

const target = note({ id: 'target', title: 'Project Atlas', aliases: ['Atlas'] })
const source = note({
  id: 'source',
  title: 'Meeting notes',
  content: 'Discussed [[Project Atlas|the project]] and [[Atlas]].\n\n`[[Ignored in code]]`',
})
const other = note({ id: 'other', title: 'Archive', content: 'See [[id:target]].' })

describe('wiki links', () => {
  it('extracts links from prose but ignores inline code', () => {
    const links = extractWikiLinks(source.content)
    expect(links).toEqual([
      { target: 'Project Atlas', label: 'the project' },
      { target: 'Atlas', label: 'Atlas' },
    ])
  })

  it('resolves titles, aliases, and stable IDs', () => {
    const resolver = createNoteResolver([target, source, other])
    expect(resolver.resolve('Project Atlas')?.id).toBe('target')
    expect(resolver.resolve('Atlas')?.id).toBe('target')
    expect(resolver.resolve('id:target')?.id).toBe('target')
    expect(resolver.resolve('Missing note')).toBeNull()
  })

  it('computes backlinks and outgoing links', () => {
    const backlinks = getBacklinks([target, source, other], target)
    expect(backlinks.map((link) => link.note.id).sort()).toEqual(['other', 'source'])
    expect(getOutgoingLinks(source, [target, source, other])).toHaveLength(2)
  })

  it('builds unique connections from real notes', () => {
    const connections = collectNoteConnections([target, source, other])
    expect(connections).toHaveLength(2)
    expect(new Set(connections.map((connection) => connection.target.id))).toEqual(new Set(['target']))
  })
})
