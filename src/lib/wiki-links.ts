import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import type { Note } from '@/db/types'
import { normalizeTitle, stripMarkdown } from '@/lib/utils'

export interface WikiLink {
  target: string
  label: string
}

export interface ResolvedWikiLink extends WikiLink {
  note: Note | null
}

const WIKI_LINK_PATTERN = /\[\[([^[\]\n]+?)\]\]/g

export function parseWikiLinkBody(body: string): WikiLink {
  const [rawTarget = '', ...labelParts] = body.split('|')
  const target = rawTarget.trim()
  const label = labelParts.join('|').trim() || target
  return { target, label }
}

export function findWikiLinks(raw: string): WikiLink[] {
  const links: WikiLink[] = []
  for (const match of raw.matchAll(WIKI_LINK_PATTERN)) {
    const body = match[1]
    if (!body) continue
    const link = parseWikiLinkBody(body)
    if (link.target) links.push(link)
  }
  return links
}

/**
 * Extract links from Markdown text nodes only. Code blocks and inline code are
 * deliberately skipped so examples do not create real relationships.
 */
export function extractWikiLinks(markdown: string): WikiLink[] {
  const links: WikiLink[] = []
  try {
    const tree = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter, ['yaml']).parse(markdown)
    visit(tree, 'text', (node: { value: string }) => {
      for (const match of node.value.matchAll(WIKI_LINK_PATTERN)) {
        const body = match[1]
        if (!body) continue
        const link = parseWikiLinkBody(body)
        if (link.target) links.push(link)
      }
    })
  } catch {
    return findWikiLinks(stripMarkdown(markdown))
  }
  return links
}

export interface NoteResolver {
  byId: (id: string) => Note | null
  byTitle: (title: string) => Note | null
  resolve: (target: string) => Note | null
}

export function createNoteResolver(notes: readonly Note[]): NoteResolver {
  const liveNotes = notes.filter((note) => note.trashedAt === null)
  const byId = new Map(liveNotes.map((note) => [note.id, note]))
  const titleMap = new Map<string, Note>()
  const aliasMap = new Map<string, Note>()

  for (const note of liveNotes) {
    const key = normalizeTitle(note.title)
    if (!titleMap.has(key)) titleMap.set(key, note)
    for (const alias of note.aliases) {
      const aliasKey = normalizeTitle(alias)
      if (aliasKey && !aliasMap.has(aliasKey)) aliasMap.set(aliasKey, note)
    }
  }

  const byTitle = (title: string): Note | null => {
    const key = normalizeTitle(title)
    return titleMap.get(key) ?? aliasMap.get(key) ?? null
  }

  const resolve = (target: string): Note | null => {
    const trimmed = target.trim()
    if (trimmed.startsWith('id:')) {
      return byId.get(trimmed.slice(3).trim()) ?? null
    }
    return byTitle(trimmed)
  }

  return {
    byId: (id) => byId.get(id) ?? null,
    byTitle,
    resolve,
  }
}

export function resolveWikiLink(target: string, notes: readonly Note[], resolver?: NoteResolver): Note | null {
  return (resolver ?? createNoteResolver(notes)).resolve(target)
}

export function getLinkContext(markdown: string, target: string, radius = 80): string {
  const plain = stripMarkdown(markdown)
  const needle = `[[${target}`
  const index = plain.indexOf(needle)
  if (index === -1) {
    const normalizedTarget = normalizeTitle(target)
    const lower = plain.toLocaleLowerCase('zh-CN')
    const fallback = lower.indexOf(normalizedTarget)
    if (fallback === -1) return plain.slice(0, radius * 2)
    return contextAround(plain, fallback, target.length, radius)
  }
  return contextAround(plain, index, needle.length, radius)
}

function contextAround(text: string, index: number, length: number, radius: number): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + length + radius)
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export interface Backlink {
  note: Note
  context: string
}

export function getBacklinks(notes: readonly Note[], targetNote: Note): Backlink[] {
  if (targetNote.trashedAt !== null) return []
  const resolver = createNoteResolver(notes)
  const backlinks: Backlink[] = []
  for (const note of notes) {
    if (note.id === targetNote.id || note.trashedAt !== null) continue
    const links = extractWikiLinks(note.content)
    const match = links.find((link) => resolver.resolve(link.target)?.id === targetNote.id)
    if (match) {
      backlinks.push({ note, context: getLinkContext(note.content, match.target) })
    }
  }
  return backlinks.sort((a, b) => b.note.updatedAt - a.note.updatedAt)
}

export function getOutgoingLinks(note: Note, notes: readonly Note[]): ResolvedWikiLink[] {
  const resolver = createNoteResolver(notes)
  const seen = new Set<string>()
  const links: ResolvedWikiLink[] = []
  for (const link of extractWikiLinks(note.content)) {
    const key = `${link.target}|${link.label}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ ...link, note: resolver.resolve(link.target) })
  }
  return links
}

export interface NoteConnection {
  source: Note
  target: Note
}

export function collectNoteConnections(notes: readonly Note[]): NoteConnection[] {
  const live = notes.filter((note) => note.trashedAt === null)
  const resolver = createNoteResolver(live)
  const seen = new Set<string>()
  const connections: NoteConnection[] = []
  for (const source of live) {
    for (const link of extractWikiLinks(source.content)) {
      const target = resolver.resolve(link.target)
      if (!target || target.id === source.id) continue
      const key = `${source.id}:${target.id}`
      if (seen.has(key)) continue
      seen.add(key)
      connections.push({ source, target })
    }
  }
  return connections
}
