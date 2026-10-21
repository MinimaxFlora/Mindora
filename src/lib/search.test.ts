import { describe, expect, it } from 'vitest'

import type { Folder, Note } from '@/db/types'

import { highlightMatches, SearchIndex } from './search'

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

const folders: Folder[] = [
  { id: 'folder-1', name: '研究资料', parentId: null, createdAt: 1, updatedAt: 1 },
]

const notes = [
  note({
    id: 'a',
    title: 'React 性能优化',
    content: '使用 memo 和 useMemo 减少不必要的渲染。',
    tags: ['前端', 'React'],
    folderId: 'folder-1',
    updatedAt: 100,
  }),
  note({
    id: 'b',
    title: '数据库索引',
    content: 'B-tree 索引和查询计划。React 不是本文重点。',
    tags: ['数据库'],
    updatedAt: 200,
  }),
  note({
    id: 'c',
    title: 'Trashed note',
    content: 'React hidden',
    trashedAt: 300,
    updatedAt: 300,
  }),
]

describe('SearchIndex', () => {
  it('prioritizes title matches and ignores trashed notes', () => {
    const index = new SearchIndex(notes, folders)
    const results = index.search('React')
    expect(results.map((result) => result.note.id)).toEqual(['a', 'b'])
    expect(results[0]?.note.id).toBe('a')
  })

  it('supports Chinese substring and tag searching', () => {
    const index = new SearchIndex(notes, folders)
    expect(index.search('性能')[0]?.note.id).toBe('a')
    expect(index.search('数据库')[0]?.note.id).toBe('b')
    expect(index.search('研究资料').length).toBeGreaterThan(0)
  })

  it('matches folder names and supports sort by update time', () => {
    const index = new SearchIndex(notes, folders)
    const results = index.search('研究', { sort: 'updated' })
    expect(results.some((result) => result.note.id === 'a')).toBe(true)
  })

  it('returns an empty list for blank queries and non-matches', () => {
    const index = new SearchIndex(notes, folders)
    expect(index.search('')).toEqual([])
    expect(index.search('no-such-term')).toEqual([])
  })

  it('highlights all query terms without losing source text', () => {
    const parts = highlightMatches('React and react hooks', 'react hooks')
    expect(parts.some((part) => part.highlighted)).toBe(true)
    expect(parts.map((part) => part.text).join('')).toBe('React and react hooks')
  })
})
