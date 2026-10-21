import { handleApi, type Env } from './worker-api'

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https: http:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' data: blob: https:",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
}

/**
 * Mindora serves the SPA from Cloudflare Static Assets and stores signed-in
 * users' notes in D1 (with image attachments in KV). Browser IndexedDB is only
 * an offline cache and must never be treated as the source of truth.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, url, env)
      } catch (error) {
        console.error('API error', error)
        return Response.json(
          { error: { code: 'internal_error', message: 'The server could not complete this request.' } },
          { status: 500, headers: { 'Cache-Control': 'no-store' } },
        )
      }
    }

    const assetResponse = await env.ASSETS.fetch(request)
    const headers = new Headers(assetResponse.headers)
    const isLocalDev = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
    if (!isLocalDev) {
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(name, value)
      }
    }

    if (url.pathname.startsWith('/assets/')) {
      if (assetResponse.headers.get('content-type')?.includes('text/html')) {
        return new Response('Asset not found', {
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
      headers.set('Cache-Control', 'public, max-age=31536000, immutable')
    } else if (url.pathname === '/theme-init.js' || url.pathname === '/favicon.svg') {
      headers.set('Cache-Control', 'public, max-age=86400')
    } else {
      headers.set('Cache-Control', 'no-cache')
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    })
  },
}
