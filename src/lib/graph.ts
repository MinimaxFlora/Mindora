import type { Folder, Note } from '@/db/types'
import { createNoteResolver, extractWikiLinks } from '@/lib/wiki-links'

export interface GraphNode {
  id: string
  title: string
  folderId: string | null
  tags: string[]
  degree: number
  note: Note
}

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  unresolvedCount: number
}

export function buildKnowledgeGraph(notes: readonly Note[], _folders: readonly Folder[] = []): KnowledgeGraph {
  const live = notes.filter((note) => note.trashedAt === null)
  const resolver = createNoteResolver(live)
  const degree = new Map<string, number>()
  const edgeMap = new Map<string, GraphEdge>()
  let unresolvedCount = 0

  for (const source of live) {
    for (const link of extractWikiLinks(source.content)) {
      const target = resolver.resolve(link.target)
      if (!target) {
        unresolvedCount += 1
        continue
      }
      if (target.id === source.id) continue
      const key = [source.id, target.id].sort().join(':')
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { id: key, source: source.id, target: target.id })
        degree.set(source.id, (degree.get(source.id) ?? 0) + 1)
        degree.set(target.id, (degree.get(target.id) ?? 0) + 1)
      }
    }
  }

  const nodes: GraphNode[] = live.map((note) => ({
    id: note.id,
    title: note.title,
    folderId: note.folderId,
    tags: note.tags,
    degree: degree.get(note.id) ?? 0,
    note,
  }))

  return { nodes, edges: Array.from(edgeMap.values()), unresolvedCount }
}

export function filterGraph(
  graph: KnowledgeGraph,
  options: { query?: string; tag?: string | null; folderId?: string | null; isolatedOnly?: boolean },
): KnowledgeGraph {
  const query = options.query?.trim().toLocaleLowerCase('zh-CN') ?? ''
  const nodes = graph.nodes.filter((node) => {
    if (query && !node.title.toLocaleLowerCase('zh-CN').includes(query)) return false
    if (options.tag && !node.tags.includes(options.tag)) return false
    if (options.folderId && node.folderId !== options.folderId) return false
    if (options.isolatedOnly && node.degree > 0) return false
    return true
  })
  const ids = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  const degree = new Map<string, number>()
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }
  return {
    nodes: nodes.map((node) => ({ ...node, degree: degree.get(node.id) ?? 0 })),
    edges,
    unresolvedCount: graph.unresolvedCount,
  }
}
