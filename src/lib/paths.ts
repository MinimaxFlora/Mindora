import type { NoteScope } from '@/db/types'

export interface ScopeRoute {
  scope: NoteScope
  basePath: string
  noteId?: string
}

export function notePath(basePath: string, noteId: string): string {
  return `${basePath}/${noteId}`
}

export function folderPath(folderId: string): string {
  return `/folders/${encodeURIComponent(folderId)}`
}

export function tagPath(tag: string): string {
  return `/tags/${encodeURIComponent(tag)}`
}

export function scopeBasePath(scope: NoteScope): string {
  switch (scope.kind) {
    case 'folder':
      return folderPath(scope.folderId)
    case 'tag':
      return tagPath(scope.tag)
    case 'favorites':
      return '/favorites'
    case 'recent':
      return '/recent'
    case 'trash':
      return '/trash'
    default:
      return '/notes'
  }
}

export function parseScopePath(pathname: string): ScopeRoute {
  const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (segments[0] === 'folders' && segments[1]) {
    return {
      scope: { kind: 'folder', folderId: segments[1] },
      basePath: `/folders/${encodeURIComponent(segments[1])}`,
      noteId: segments[2],
    }
  }
  if (segments[0] === 'tags' && segments[1]) {
    return {
      scope: { kind: 'tag', tag: segments[1] },
      basePath: `/tags/${encodeURIComponent(segments[1])}`,
      noteId: segments[2],
    }
  }
  if (segments[0] === 'favorites') {
    return { scope: { kind: 'favorites' }, basePath: '/favorites', noteId: segments[1] }
  }
  if (segments[0] === 'recent') {
    return { scope: { kind: 'recent' }, basePath: '/recent', noteId: segments[1] }
  }
  if (segments[0] === 'trash') {
    return { scope: { kind: 'trash' }, basePath: '/trash', noteId: segments[1] }
  }
  return { scope: { kind: 'all' }, basePath: '/notes', noteId: segments[0] === 'notes' ? segments[1] : undefined }
}


