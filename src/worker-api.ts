export interface D1Result<T> {
  results: T[]
  success: boolean
  meta?: Record<string, unknown>
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  run(): Promise<unknown>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>
}

export interface KVNamespace {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>
  put(
    key: string,
    value: ArrayBuffer,
    options?: { metadata?: Record<string, unknown>; expirationTtl?: number },
  ): Promise<void>
  delete(key: string): Promise<void>
}

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  MINDORA_DB: D1Database
  MINDORA_ASSETS: KVNamespace
}

interface UserRow {
  id: string
  email: string
  password_hash: string
  created_at: number
}

interface SessionUser {
  id: string
  email: string
}

interface NoteRow {
  id: string
  title: string
  content: string
  folder_id: string | null
  tags: string
  favorite: number
  trashed_at: number | null
  created_at: number
  updated_at: number
  accessed_at: number
  aliases: string
  word_count: number
  metadata: string
}

interface FolderRow {
  id: string
  name: string
  parent_id: string | null
  created_at: number
  updated_at: number
}

interface SettingsRow {
  value: string
  updated_at: number
}

interface AttachmentRow {
  id: string
  note_id: string | null
  name: string
  mime_type: string
  size: number
  created_at: number
}

interface AuthAttemptRow {
  count: number
  reset_at: number
}

const SESSION_COOKIE = 'mindora_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const MAX_JSON_BODY = 16 * 1024 * 1024
const MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024
const MAX_NOTES_PER_SYNC = 500

function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(JSON.stringify(data), { status, headers })
}

function apiError(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status)
}

function randomHex(bytes = 32): string {
  const array = new Uint8Array(bytes)
  crypto.getRandomValues(array)
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let index = 0; index < result.length; index += 1) {
    result[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
  }
  return result
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(16)
  crypto.getRandomValues(salt)
  // Cloudflare Workers WebCrypto rejects PBKDF2 iteration counts above 100k.
  const iterations = 100_000
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  )
  return `pbkdf2$${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iterationText, saltHex, expected] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iterationText || !saltHex || !expected) return false
  const iterations = Number.parseInt(iterationText, 10)
  if (!Number.isFinite(iterations) || iterations < 10_000) return false
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  try {
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: hexToBytes(saltHex), iterations, hash: 'SHA-256' },
      keyMaterial,
      256,
    )
    return timingSafeEqual(bytesToHex(new Uint8Array(derived)), expected)
  } catch {
    return false
  }
}

function parseCookies(request: Request): Map<string, string> {
  const map = new Map<string, string>()
  const header = request.headers.get('Cookie')
  if (!header) return map
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName) continue
    map.set(rawName, decodeURIComponent(rawValue.join('=')))
  }
  return map
}

function sessionCookie(token: string, secure: boolean, maxAge = SESSION_MAX_AGE): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    secure ? '; Secure' : ''
  }`
}

function requestIsSecure(url: URL): boolean {
  return url.protocol === 'https:'
}

async function getSessionUser(request: Request, env: Env): Promise<SessionUser | null> {
  const token = parseCookies(request).get(SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  const row = await env.MINDORA_DB.prepare(
    `SELECT users.id, users.email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > ?`,
  )
    .bind(tokenHash, Date.now())
    .first<SessionUser>()
  return row ?? null
}

async function createSession(env: Env, userId: string): Promise<string> {
  const token = randomHex(32)
  const tokenHash = await sha256(token)
  const now = Date.now()
  await env.MINDORA_DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)',
  )
    .bind(randomHex(16), userId, tokenHash, now, now + SESSION_MAX_AGE * 1000)
    .run()
  return token
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) && email.length <= 254
}

function isLocalHost(url: URL): boolean {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
}

function clientIp(request: Request): string | null {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    null
  )
}

async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Date.now()
  const row = await env.MINDORA_DB.prepare(
    'SELECT count, reset_at FROM auth_attempts WHERE key = ?',
  )
    .bind(key)
    .first<AuthAttemptRow>()
  if (!row || row.reset_at <= now) return { allowed: true, retryAfter: 0 }
  if (row.count >= limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.reset_at - now) / 1000)) }
  }
  return { allowed: true, retryAfter: 0 }
}

async function recordRateLimitAttempt(
  env: Env,
  key: string,
  windowMs: number,
): Promise<void> {
  const now = Date.now()
  const resetAt = now + windowMs
  await env.MINDORA_DB.prepare(
    `INSERT INTO auth_attempts (key, count, reset_at) VALUES (?, 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN auth_attempts.reset_at <= ? THEN 1 ELSE auth_attempts.count + 1 END,
       reset_at = CASE WHEN auth_attempts.reset_at <= ? THEN ? ELSE auth_attempts.reset_at END`,
  )
    .bind(key, resetAt, now, now, resetAt)
    .run()
}

async function clearRateLimit(env: Env, key: string): Promise<void> {
  await env.MINDORA_DB.prepare('DELETE FROM auth_attempts WHERE key = ?').bind(key).run()
}

function rateLimitError(retryAfter: number): Response {
  return json(
    {
      error: {
        code: 'rate_limited',
        message: 'Too many attempts. Please wait and try again.',
      },
    },
    429,
    { 'Retry-After': String(retryAfter) },
  )
}

async function readJsonBody<T>(request: Request): Promise<T | null> {
  const length = Number(request.headers.get('Content-Length') ?? 0)
  if (length > MAX_JSON_BODY) return null
  const text = await request.text()
  if (text.length > MAX_JSON_BODY) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

function sameOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) return true
  try {
    return new URL(origin).host === url.host
  } catch {
    return false
  }
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function asNote(row: NoteRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    folderId: row.folder_id,
    tags: safeJsonParse<string[]>(row.tags, []),
    favorite: Boolean(row.favorite),
    trashedAt: row.trashed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessedAt: row.accessed_at,
    aliases: safeJsonParse<string[]>(row.aliases, []),
    wordCount: row.word_count,
    metadata: safeJsonParse<Record<string, unknown>>(row.metadata, {}),
  }
}

function asFolder(row: FolderRow) {
  return {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function asAttachment(row: AttachmentRow) {
  return {
    id: row.id,
    noteId: row.note_id,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size,
    createdAt: row.created_at,
  }
}

async function loadSnapshot(env: Env, userId: string) {
  const [notes, folders, settings, attachments] = await Promise.all([
    env.MINDORA_DB.prepare(
      'SELECT id,title,content,folder_id,tags,favorite,trashed_at,created_at,updated_at,accessed_at,aliases,word_count,metadata FROM notes WHERE user_id = ? ORDER BY updated_at DESC',
    )
      .bind(userId)
      .all<NoteRow>(),
    env.MINDORA_DB.prepare(
      'SELECT id,name,parent_id,created_at,updated_at FROM folders WHERE user_id = ? ORDER BY created_at ASC',
    )
      .bind(userId)
      .all<FolderRow>(),
    env.MINDORA_DB.prepare('SELECT value, updated_at FROM settings WHERE user_id = ?')
      .bind(userId)
      .first<SettingsRow>(),
    env.MINDORA_DB.prepare(
      'SELECT id,note_id,name,mime_type,size,created_at FROM attachments WHERE user_id = ? ORDER BY created_at ASC',
    )
      .bind(userId)
      .all<AttachmentRow>(),
  ])

  return {
    notes: notes.results.map(asNote),
    folders: folders.results.map(asFolder),
    settings: settings ? safeJsonParse<Record<string, unknown> | null>(settings.value, null) : null,
    attachments: attachments.results.map(asAttachment),
    serverTime: Date.now(),
  }
}

function normalizeNote(value: unknown, userId: string) {
  if (!value || typeof value !== 'object') return null
  const note = value as Record<string, unknown>
  if (typeof note.id !== 'string' || !note.id || note.id.length > 100) return null
  if (typeof note.content !== 'string' || note.content.length > 4 * 1024 * 1024) return null
  const title = typeof note.title === 'string' ? note.title.slice(0, 500) : ''
  const folderId = typeof note.folderId === 'string' && note.folderId ? note.folderId : null
  const tags = Array.isArray(note.tags)
    ? note.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 100)
    : []
  const aliases = Array.isArray(note.aliases)
    ? note.aliases.filter((alias): alias is string => typeof alias === 'string').slice(0, 50)
    : []
  const metadata =
    note.metadata && typeof note.metadata === 'object' && !Array.isArray(note.metadata)
      ? (note.metadata as Record<string, unknown>)
      : {}
  const now = Date.now()
  return {
    userId,
    id: note.id,
    title,
    content: note.content,
    folderId,
    tags: JSON.stringify(tags),
    favorite: note.favorite ? 1 : 0,
    trashedAt: typeof note.trashedAt === 'number' ? note.trashedAt : null,
    createdAt: typeof note.createdAt === 'number' ? note.createdAt : now,
    updatedAt: typeof note.updatedAt === 'number' ? note.updatedAt : now,
    accessedAt: typeof note.accessedAt === 'number' ? note.accessedAt : now,
    aliases: JSON.stringify(aliases),
    wordCount: typeof note.wordCount === 'number' ? Math.max(0, Math.floor(note.wordCount)) : 0,
    metadata: JSON.stringify(metadata),
  }
}

function normalizeFolder(value: unknown, userId: string) {
  if (!value || typeof value !== 'object') return null
  const folder = value as Record<string, unknown>
  if (typeof folder.id !== 'string' || !folder.id || folder.id.length > 100) return null
  const name = typeof folder.name === 'string' ? folder.name.trim().slice(0, 200) : ''
  if (!name) return null
  const now = Date.now()
  return {
    userId,
    id: folder.id,
    name,
    parentId: typeof folder.parentId === 'string' && folder.parentId ? folder.parentId : null,
    createdAt: typeof folder.createdAt === 'number' ? folder.createdAt : now,
    updatedAt: typeof folder.updatedAt === 'number' ? folder.updatedAt : now,
  }
}

async function handleSync(request: Request, env: Env, user: SessionUser): Promise<Response> {
  if (request.method === 'GET') {
    return json(await loadSnapshot(env, user.id))
  }

  const body = await readJsonBody<{
    notes?: unknown[]
    folders?: unknown[]
    settings?: unknown
    deletedNoteIds?: unknown[]
    deletedFolderIds?: unknown[]
    deletedAttachmentIds?: unknown[]
  }>(request)
  if (!body) return apiError(400, 'invalid_body', 'Invalid sync payload')

  const noteRows = (Array.isArray(body.notes) ? body.notes : [])
    .slice(0, MAX_NOTES_PER_SYNC)
    .map((note) => normalizeNote(note, user.id))
    .filter((note): note is NonNullable<ReturnType<typeof normalizeNote>> => note !== null)
  const folderRows = (Array.isArray(body.folders) ? body.folders : [])
    .slice(0, 500)
    .map((folder) => normalizeFolder(folder, user.id))
    .filter((folder): folder is NonNullable<ReturnType<typeof normalizeFolder>> => folder !== null)
  const deletedNoteIds = (Array.isArray(body.deletedNoteIds) ? body.deletedNoteIds : [])
    .filter((id): id is string => typeof id === 'string')
    .slice(0, MAX_NOTES_PER_SYNC)
  const deletedFolderIds = (Array.isArray(body.deletedFolderIds) ? body.deletedFolderIds : [])
    .filter((id): id is string => typeof id === 'string')
    .slice(0, 500)
  const deletedAttachmentIds = (
    Array.isArray(body.deletedAttachmentIds) ? body.deletedAttachmentIds : []
  )
    .filter((id): id is string => typeof id === 'string')
    .slice(0, 500)

  const statements: D1PreparedStatement[] = []

  for (const note of noteRows) {
    statements.push(
      env.MINDORA_DB.prepare(
        `INSERT INTO notes (user_id,id,title,content,folder_id,tags,favorite,trashed_at,created_at,updated_at,accessed_at,aliases,word_count,metadata)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(user_id,id) DO UPDATE SET
           title=excluded.title, content=excluded.content, folder_id=excluded.folder_id,
           tags=excluded.tags, favorite=excluded.favorite, trashed_at=excluded.trashed_at,
           created_at=excluded.created_at, updated_at=excluded.updated_at,
           accessed_at=excluded.accessed_at, aliases=excluded.aliases,
           word_count=excluded.word_count, metadata=excluded.metadata
         WHERE excluded.updated_at >= notes.updated_at`,
      ).bind(
        note.userId,
        note.id,
        note.title,
        note.content,
        note.folderId,
        note.tags,
        note.favorite,
        note.trashedAt,
        note.createdAt,
        note.updatedAt,
        note.accessedAt,
        note.aliases,
        note.wordCount,
        note.metadata,
      ),
    )
  }

  for (const folder of folderRows) {
    statements.push(
      env.MINDORA_DB.prepare(
        `INSERT INTO folders (user_id,id,name,parent_id,created_at,updated_at)
         VALUES (?,?,?,?,?,?)
         ON CONFLICT(user_id,id) DO UPDATE SET
           name=excluded.name, parent_id=excluded.parent_id, updated_at=excluded.updated_at
         WHERE excluded.updated_at >= folders.updated_at`,
      ).bind(
        folder.userId,
        folder.id,
        folder.name,
        folder.parentId,
        folder.createdAt,
        folder.updatedAt,
      ),
    )
  }

  for (const id of deletedNoteIds) {
    statements.push(
      env.MINDORA_DB.prepare('DELETE FROM notes WHERE user_id = ? AND id = ?').bind(user.id, id),
    )
  }
  for (const id of deletedFolderIds) {
    statements.push(
      env.MINDORA_DB.prepare('DELETE FROM folders WHERE user_id = ? AND id = ?').bind(user.id, id),
    )
  }
  for (const id of deletedAttachmentIds) {
    statements.push(
      env.MINDORA_DB.prepare('DELETE FROM attachments WHERE user_id = ? AND id = ?').bind(user.id, id),
    )
  }

  if (body.settings && typeof body.settings === 'object') {
    statements.push(
      env.MINDORA_DB.prepare(
        `INSERT INTO settings (user_id,value,updated_at) VALUES (?,?,?)
         ON CONFLICT(user_id) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
         WHERE excluded.updated_at >= settings.updated_at`,
      ).bind(user.id, JSON.stringify(body.settings), Date.now()),
    )
  }

  if (statements.length > 0) {
    if (statements.length > 900) return apiError(413, 'sync_too_large', 'Too many changes in one sync')
    await env.MINDORA_DB.batch(statements)
  }

  for (const id of deletedAttachmentIds) {
    await env.MINDORA_ASSETS.delete(`${user.id}:${id}`).catch(() => undefined)
  }

  return json(await loadSnapshot(env, user.id))
}

async function handleAttachments(
  request: Request,
  env: Env,
  user: SessionUser,
  url: URL,
): Promise<Response> {
  if (request.method === 'POST') {
    const noteId = url.searchParams.get('noteId')
    const requestedId = url.searchParams.get('id')
    const rawName = url.searchParams.get('name') ?? 'image'
    const name = rawName.slice(0, 200)
    const length = Number(request.headers.get('Content-Length') ?? 0)
    if (length > MAX_ATTACHMENT_SIZE) {
      return apiError(413, 'attachment_too_large', 'Attachment exceeds 20 MB')
    }
    const mimeType = request.headers.get('Content-Type') ?? 'application/octet-stream'
    if (!mimeType.startsWith('image/') || mimeType === 'image/svg+xml') {
      return apiError(415, 'unsupported_attachment', 'Only raster images are supported')
    }
    const body = await request.arrayBuffer()
    if (body.byteLength === 0) return apiError(400, 'empty_attachment', 'Empty attachment')
    if (body.byteLength > MAX_ATTACHMENT_SIZE) {
      return apiError(413, 'attachment_too_large', 'Attachment exceeds 20 MB')
    }
    if (noteId) {
      const note = await env.MINDORA_DB.prepare(
        'SELECT id FROM notes WHERE user_id = ? AND id = ?',
      )
        .bind(user.id, noteId)
        .first<{ id: string }>()
      if (!note) return apiError(404, 'note_not_found', 'Note not found')
    }
    const id =
      requestedId && /^[A-Za-z0-9-]{8,80}$/.test(requestedId) ? requestedId : randomHex(16)
    const alreadyExists = await env.MINDORA_DB.prepare(
      'SELECT id FROM attachments WHERE user_id = ? AND id = ?',
    )
      .bind(user.id, id)
      .first<{ id: string }>()
    if (alreadyExists) return apiError(409, 'attachment_exists', 'Attachment already exists')
    await env.MINDORA_ASSETS.put(`${user.id}:${id}`, body, {
      metadata: { name, mimeType, size: body.byteLength, userId: user.id },
    })
    const createdAt = Date.now()
    await env.MINDORA_DB.prepare(
      'INSERT INTO attachments (user_id,id,note_id,name,mime_type,size,created_at) VALUES (?,?,?,?,?,?,?)',
    )
      .bind(user.id, id, noteId, name, mimeType, body.byteLength, createdAt)
      .run()
    return json({ id, noteId, name, mimeType, size: body.byteLength, createdAt }, 201)
  }

  if (request.method === 'GET') {
    const prefix = '/api/attachments/'
    const id = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!id) return apiError(400, 'invalid_attachment', 'Missing attachment id')
    const row = await env.MINDORA_DB.prepare(
      'SELECT id,note_id,name,mime_type,size,created_at FROM attachments WHERE user_id = ? AND id = ?',
    )
      .bind(user.id, id)
      .first<AttachmentRow>()
    if (!row) return apiError(404, 'attachment_not_found', 'Attachment not found')
    const data = await env.MINDORA_ASSETS.get(`${user.id}:${id}`, 'arrayBuffer')
    if (!data) return apiError(404, 'attachment_not_found', 'Attachment not found')
    const headers = new Headers({
      'Content-Type': row.mime_type,
      'Content-Length': String(row.size),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
    })
    return new Response(data, { headers })
  }

  if (request.method === 'DELETE') {
    const prefix = '/api/attachments/'
    const id = decodeURIComponent(url.pathname.slice(prefix.length))
    if (!id) return apiError(400, 'invalid_attachment', 'Missing attachment id')
    await env.MINDORA_DB.prepare('DELETE FROM attachments WHERE user_id = ? AND id = ?')
      .bind(user.id, id)
      .run()
    await env.MINDORA_ASSETS.delete(`${user.id}:${id}`)
    return json({ ok: true })
  }

  return apiError(405, 'method_not_allowed', 'Method not allowed')
}

export async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/health') {
    return json({ ok: true, service: 'mindora', storage: 'cloudflare-d1' })
  }

  const method = request.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(request, url)) {
    return apiError(403, 'csrf_rejected', 'Cross-origin request rejected')
  }

  if (url.pathname === '/api/auth/register' && method === 'POST') {
    const body = await readJsonBody<{ email?: string; password?: string }>(request)
    if (!body) return apiError(400, 'invalid_body', 'Invalid request body')
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    const rateKey = isLocalHost(url)
      ? null
      : clientIp(request)
        ? `register:${clientIp(request)}`
        : null
    if (rateKey) {
      const rate = await checkRateLimit(env, rateKey, 20)
      if (!rate.allowed) return rateLimitError(rate.retryAfter)
      await recordRateLimitAttempt(env, rateKey, 60 * 60 * 1000)
    }
    if (!validEmail(email)) return apiError(400, 'invalid_email', 'Enter a valid email')
    if (password.length < 8 || password.length > 128) {
      return apiError(400, 'invalid_password', 'Password must be 8–128 characters')
    }
    const existing = await env.MINDORA_DB.prepare('SELECT id FROM users WHERE email = ?')
      .bind(email)
      .first<{ id: string }>()
    if (existing) return apiError(409, 'email_exists', 'An account with this email already exists')
    const id = randomHex(16)
    const passwordHash = await hashPassword(password)
    try {
      await env.MINDORA_DB.prepare(
        'INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)',
      )
        .bind(id, email, passwordHash, Date.now())
        .run()
    } catch {
      return apiError(409, 'email_exists', 'An account with this email already exists')
    }
    const token = await createSession(env, id)
    return json(
      { user: { id, email } },
      201,
      { 'Set-Cookie': sessionCookie(token, requestIsSecure(url)) },
    )
  }

  if (url.pathname === '/api/auth/login' && method === 'POST') {
    const body = await readJsonBody<{ email?: string; password?: string }>(request)
    if (!body) return apiError(400, 'invalid_body', 'Invalid request body')
    const email = (body.email ?? '').trim().toLowerCase()
    const password = body.password ?? ''
    if (!validEmail(email) || !password) return apiError(401, 'invalid_credentials', 'Invalid email or password')
    const ip = isLocalHost(url) ? null : clientIp(request)
    const rateKey = ip ? `login:${ip}:${email}` : null
    if (rateKey) {
      const rate = await checkRateLimit(env, rateKey, 10)
      if (!rate.allowed) return rateLimitError(rate.retryAfter)
    }
    const user = await env.MINDORA_DB.prepare(
      'SELECT id,email,password_hash,created_at FROM users WHERE email = ?',
    )
      .bind(email)
      .first<UserRow>()
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      if (rateKey) await recordRateLimitAttempt(env, rateKey, 15 * 60 * 1000)
      return apiError(401, 'invalid_credentials', 'Invalid email or password')
    }
    if (rateKey) await clearRateLimit(env, rateKey)
    const token = await createSession(env, user.id)
    return json(
      { user: { id: user.id, email: user.email } },
      200,
      { 'Set-Cookie': sessionCookie(token, requestIsSecure(url)) },
    )
  }

  if (url.pathname === '/api/auth/logout' && method === 'POST') {
    const token = parseCookies(request).get(SESSION_COOKIE)
    if (token) {
      const tokenHash = await sha256(token)
      await env.MINDORA_DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run()
    }
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': sessionCookie('', requestIsSecure(url), 0) },
    )
  }

  const user = await getSessionUser(request, env)
  if (url.pathname === '/api/auth/me') {
    return json({ user })
  }

  if (!user) return apiError(401, 'unauthorized', 'Not signed in')

  if (url.pathname === '/api/account' && method === 'DELETE') {
    const attachments = await env.MINDORA_DB.prepare(
      'SELECT id FROM attachments WHERE user_id = ?',
    )
      .bind(user.id)
      .all<{ id: string }>()
    for (let index = 0; index < attachments.results.length; index += 50) {
      const chunk = attachments.results.slice(index, index + 50)
      await Promise.all(
        chunk.map((attachment) =>
          env.MINDORA_ASSETS.delete(`${user.id}:${attachment.id}`).catch(() => undefined),
        ),
      )
    }
    await env.MINDORA_DB.batch([
      env.MINDORA_DB.prepare('DELETE FROM attachments WHERE user_id = ?').bind(user.id),
      env.MINDORA_DB.prepare('DELETE FROM notes WHERE user_id = ?').bind(user.id),
      env.MINDORA_DB.prepare('DELETE FROM folders WHERE user_id = ?').bind(user.id),
      env.MINDORA_DB.prepare('DELETE FROM settings WHERE user_id = ?').bind(user.id),
      env.MINDORA_DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(user.id),
      env.MINDORA_DB.prepare('DELETE FROM users WHERE id = ?').bind(user.id),
    ])
    return json(
      { ok: true },
      200,
      { 'Set-Cookie': sessionCookie('', requestIsSecure(url), 0) },
    )
  }

  if (url.pathname === '/api/sync') {
    return handleSync(request, env, user)
  }

  if (url.pathname.startsWith('/api/attachments')) {
    return handleAttachments(request, env, user, url)
  }

  return apiError(404, 'not_found', 'Not found')
}
