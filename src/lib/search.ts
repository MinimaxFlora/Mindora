import type { Folder, Note } from '@/db/types'
import { translate } from '@/i18n/messages'
import { getActiveLocale } from '@/lib/locale'
import { normalizeTitle, stripMarkdown } from '@/lib/utils'

export interface SearchResult {
  note: Note
  score: number
  snippet: string
  matchedIn: ('title' | 'tag' | 'folder' | 'content')[]
}

export interface SearchOptions {
  limit?: number
  sort?: 'relevance' | 'updated'
}

interface SearchRecord {
  note: Note
  title: string
  titleLower: string
  aliases: string
  tags: string
  folder: string
  content: string
  contentLower: string
  plain: string
  terms: Set<string>
}

function normalize(value: string): string {
  return value.toLocaleLowerCase('zh-CN').normalize('NFKC')
}

function tokenize(value: string): string[] {
  const lower = normalize(value)
  const tokens = new Set<string>()
  for (const word of lower.match(/[a-z0-9][a-z0-9_+#.-]*/g) ?? []) {
    if (word.length > 0) tokens.add(word)
  }
  const cjkChunks = lower.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g) ?? []
  for (const chunk of cjkChunks) {
    if (chunk.length <= 8) tokens.add(chunk)
    for (let size = 2; size <= 3; size += 1) {
      for (let index = 0; index <= chunk.length - size; index += 1) {
        tokens.add(chunk.slice(index, index + size))
      }
    }
  }
  return Array.from(tokens)
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let index = 0
  while ((index = haystack.indexOf(needle, index)) !== -1) {
    count += 1
    index += needle.length
    if (count >= 20) break
  }
  return count
}

function makeSnippet(plain: string, query: string, limit = 150): string {
  if (!plain) return translate(getActiveLocale(), 'common.noContent')
  const lower = normalize(plain)
  const needles = [
    normalize(query),
    ...query.split(/\s+/).filter(Boolean).map(normalize),
  ].filter(Boolean)
  let index = -1
  for (const needle of needles) {
    const found = lower.indexOf(needle)
    if (found !== -1 && (index === -1 || found < index)) index = found
  }
  if (index === -1) {
    return plain.length > limit ? `${plain.slice(0, limit).trimEnd()}…` : plain
  }
  const start = Math.max(0, index - 48)
  const end = Math.min(plain.length, start + limit)
  return `${start > 0 ? '…' : ''}${plain.slice(start, end).trim()}${end < plain.length ? '…' : ''}`
}

export class SearchIndex {
  private records: SearchRecord[]
  private tokenMap = new Map<string, Set<string>>()
  private recordMap = new Map<string, SearchRecord>()

  constructor(notes: readonly Note[], folders: readonly Folder[] = []) {
    const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]))
    this.records = notes
      .filter((note) => note.trashedAt === null)
      .map((note) => {
        const plain = stripMarkdown(note.content)
        const folder = note.folderId ? (folderMap.get(note.folderId) ?? '') : ''
        const title = note.title
        const tags = note.tags.join(' ')
        const record: SearchRecord = {
          note,
          title,
          titleLower: normalize(title),
          aliases: normalize(note.aliases.join(' ')),
          tags: normalize(tags),
          folder: normalize(folder),
          content: note.content,
          contentLower: normalize(note.content),
          plain,
          terms: new Set([
            ...tokenize(title),
            ...tokenize(tags),
            ...tokenize(folder),
            ...tokenize(plain),
          ]),
        }
        this.recordMap.set(note.id, record)
        return record
      })

    for (const record of this.records) {
      for (const token of record.terms) {
        const ids = this.tokenMap.get(token) ?? new Set<string>()
        ids.add(record.note.id)
        this.tokenMap.set(token, ids)
      }
    }
  }

  get size(): number {
    return this.records.length
  }

  search(rawQuery: string, options: SearchOptions = {}): SearchResult[] {
    const query = rawQuery.trim()
    if (!query) return []
    const limit = options.limit ?? 50
    const queryLower = normalize(query)
    const terms = query.split(/\s+/).filter(Boolean)
    const tokenTerms = tokenize(query)

    let candidateIds: Set<string> | null = null
    for (const token of tokenTerms) {
      const ids = this.tokenMap.get(token)
      if (!ids) continue
      if (candidateIds === null) {
        candidateIds = new Set(ids)
      } else {
        const current: Set<string> = candidateIds
        candidateIds = new Set(Array.from(current).filter((id) => ids.has(id)))
      }
    }

    if (candidateIds === null) {
      candidateIds = new Set(this.records.map((record) => record.note.id))
    }

    const results: SearchResult[] = []
    for (const id of candidateIds) {
      const record = this.recordMap.get(id)
      if (!record) continue
      const haystack = `${record.titleLower} ${record.aliases} ${record.tags} ${record.folder} ${record.contentLower}`
      if (!terms.every((term) => normalize(haystack).includes(normalize(term)))) continue

      const matchedIn: SearchResult['matchedIn'] = []
      let score = 0
      if (record.titleLower === queryLower) {
        score += 1000
        matchedIn.push('title')
      } else if (record.titleLower.startsWith(queryLower)) {
        score += 600
        matchedIn.push('title')
      } else if (record.titleLower.includes(queryLower)) {
        score += 420
        matchedIn.push('title')
      }
      if (record.aliases.includes(queryLower)) {
        score += 260
        matchedIn.push('title')
      }
      if (record.tags.includes(queryLower)) {
        score += 220
        matchedIn.push('tag')
      }
      if (record.folder.includes(queryLower)) {
        score += 120
        matchedIn.push('folder')
      }
      const occurrences = countOccurrences(record.contentLower, queryLower)
      if (occurrences > 0) {
        score += 80 + Math.min(occurrences * 8, 80)
        matchedIn.push('content')
      }
      if (score === 0) {
        score = 10
      }
      const ageDays = Math.max(0, (Date.now() - record.note.updatedAt) / 86_400_000)
      score += Math.max(0, 24 - ageDays) / 10

      results.push({
        note: record.note,
        score,
        snippet: makeSnippet(record.plain, query),
        matchedIn: Array.from(new Set(matchedIn)),
      })
    }

    results.sort((a, b) => {
      if (options.sort === 'updated') return b.note.updatedAt - a.note.updatedAt
      return b.score - a.score || b.note.updatedAt - a.note.updatedAt
    })
    return results.slice(0, limit)
  }
}

export interface HighlightPart {
  text: string
  highlighted: boolean
}

export function highlightMatches(text: string, query: string): HighlightPart[] {
  const terms = Array.from(
    new Set(
      query
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((term) => normalize(term)),
    ),
  ).sort((a, b) => b.length - a.length)
  if (terms.length === 0) return [{ text, highlighted: false }]

  const lower = normalize(text)
  const ranges: { start: number; end: number }[] = []
  for (const term of terms) {
    let cursor = 0
    while (cursor < lower.length) {
      const found = lower.indexOf(term, cursor)
      if (found === -1) break
      ranges.push({ start: found, end: found + term.length })
      cursor = found + Math.max(1, term.length)
    }
  }
  if (ranges.length === 0) return [{ text, highlighted: false }]
  ranges.sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end)
    else merged.push({ ...range })
  }

  const parts: HighlightPart[] = []
  let cursor = 0
  for (const range of merged) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start), highlighted: false })
    parts.push({ text: text.slice(range.start, range.end), highlighted: true })
    cursor = range.end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), highlighted: false })
  return parts
}

export function titleMatchKey(title: string): string {
  return normalizeTitle(title)
}
