import type { Attachment, Note, Folder } from '@/db/types'

export interface AuthUser {
  id: string
  email: string
}

export type SyncAttachmentMeta = Omit<Attachment, 'blob'>

export interface SyncSnapshot {
  notes: Note[]
  folders: Folder[]
  settings: unknown | null
  attachments: SyncAttachmentMeta[]
  serverTime: number
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

let unauthorizedHandler: (() => void) | null = null

export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json')
  }
  headers.set('Accept', 'application/json')
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers,
    })
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach the Mindora server')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (response.status === 401) {
    unauthorizedHandler?.()
  }
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'request_failed',
      error?.message ?? `Request failed (${response.status})`,
    )
  }
  return payload as T
}

export const authApi = {
  me: () => request<{ user: AuthUser | null }>('/api/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string) =>
    request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),
  deleteAccount: () => request<{ ok: boolean }>('/api/account', { method: 'DELETE' }),
}

export const syncApi = {
  snapshot: () => request<SyncSnapshot>('/api/sync'),
  push: (payload: {
    notes: Note[]
    folders: Folder[]
    settings?: unknown
    deletedNoteIds: string[]
    deletedFolderIds: string[]
    deletedAttachmentIds: string[]
  }) =>
    request<SyncSnapshot>('/api/sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}

export const attachmentApi = {
  upload: async (file: File, noteId: string | null, id?: string): Promise<SyncAttachmentMeta> => {
    const params = new URLSearchParams()
    if (noteId) params.set('noteId', noteId)
    if (id) params.set('id', id)
    params.set('name', file.name || 'image')
    const response = await fetch(`/api/attachments?${params.toString()}`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { code?: string; message?: string }
      } | null
      throw new ApiError(
        response.status,
        payload?.error?.code ?? 'upload_failed',
        payload?.error?.message ?? 'Attachment upload failed',
      )
    }
    return (await response.json()) as SyncAttachmentMeta
  },
  download: async (id: string): Promise<Blob | null> => {
    const response = await fetch(`/api/attachments/${encodeURIComponent(id)}`, {
      credentials: 'same-origin',
    })
    if (response.status === 401) unauthorizedHandler?.()
    if (!response.ok) return null
    return response.blob()
  },
  remove: async (id: string): Promise<void> => {
    await request<{ ok: boolean }>(`/api/attachments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
  },
}
