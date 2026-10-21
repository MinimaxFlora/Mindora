import { LocalizedError } from '@/lib/errors'

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const DANGEROUS_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:'])

export function normalizeSafeLinkUrl(input: string): string {
  const raw = input.trim()
  if (!raw) throw new LocalizedError('error.linkEmpty')

  let parsed: URL | null
  try {
    parsed = new URL(raw)
  } catch {
    parsed = null
  }

  if (parsed) {
    if (DANGEROUS_SCHEMES.has(parsed.protocol) || !ALLOWED_SCHEMES.has(parsed.protocol)) {
      throw new LocalizedError('error.linkProtocol')
    }
    return parsed.href
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
    throw new LocalizedError('error.linkUnsafe')
  }

  if (raw.startsWith('#') || raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) {
    return raw
  }

  if (raw.startsWith('//')) return `https:${raw}`
  return `https://${raw}`
}

export function safeMarkdownAlt(filename: string): string {
  return filename.replace(/[[\]]/g, '').replace(/\r?\n/g, ' ').trim() || 'Image'
}
