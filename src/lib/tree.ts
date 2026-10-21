import type { Folder } from '@/db/types'
import { translate } from '@/i18n/messages'
import { getActiveLocale } from '@/lib/locale'

export interface FolderNode extends Folder {
  children: FolderNode[]
  depth: number
}

export function buildFolderTree(folders: readonly Folder[]): FolderNode[] {
  const byParent = new Map<string | null, Folder[]>()
  for (const folder of folders) {
    const siblings = byParent.get(folder.parentId) ?? []
    siblings.push(folder)
    byParent.set(folder.parentId, siblings)
  }
  for (const siblings of byParent.values()) {
    siblings.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  const build = (parentId: string | null, depth: number, path: Set<string>): FolderNode[] => {
    const siblings = byParent.get(parentId) ?? []
    return siblings
      .filter((folder) => !path.has(folder.id))
      .map((folder) => {
        const nextPath = new Set(path)
        nextPath.add(folder.id)
        return {
          ...folder,
          depth,
          children: build(folder.id, depth + 1, nextPath),
        }
      })
  }

  return build(null, 0, new Set())
}

export function flattenFolderTree(nodes: readonly FolderNode[]): FolderNode[] {
  return nodes.flatMap((node) => [node, ...flattenFolderTree(node.children)])
}

export function getFolderPath(folders: readonly Folder[], folderId: string | null): Folder[] {
  if (!folderId) return []
  const byId = new Map(folders.map((folder) => [folder.id, folder]))
  const path: Folder[] = []
  const visited = new Set<string>()
  let current = byId.get(folderId)
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    path.unshift(current)
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return path
}

export function getDescendantFolderIds(folders: readonly Folder[], folderId: string): Set<string> {
  const result = new Set<string>([folderId])
  let changed = true
  while (changed) {
    changed = false
    for (const folder of folders) {
      if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) {
        result.add(folder.id)
        changed = true
      }
    }
  }
  return result
}

export function folderDisplayPath(folders: readonly Folder[], folderId: string | null): string {
  const path = getFolderPath(folders, folderId)
  return path.length > 0
    ? path.map((folder) => folder.name).join(' / ')
    : translate(getActiveLocale(), 'editor.uncategorized')
}
