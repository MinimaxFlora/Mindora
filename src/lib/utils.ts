import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

import { translate } from '@/i18n/messages'
import { getActiveLocale, type Locale } from '@/lib/locale'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  const webCrypto = globalThis.crypto
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes)
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256)
    }
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const relativeFormatters = new Map<Locale, Intl.RelativeTimeFormat>()

function relativeFormatter(locale: Locale): Intl.RelativeTimeFormat {
  let formatter = relativeFormatters.get(locale)
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    relativeFormatters.set(locale, formatter)
  }
  return formatter
}

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const locale = getActiveLocale()
  const deltaSeconds = Math.round((timestamp - now) / 1000)
  const absolute = Math.abs(deltaSeconds)
  const formatter = relativeFormatter(locale)

  if (absolute < 45) return translate(locale, 'time.justNow')
  if (absolute < 60 * 60) return formatter.format(Math.round(deltaSeconds / 60), 'minute')
  if (absolute < 60 * 60 * 24) return formatter.format(Math.round(deltaSeconds / 3600), 'hour')
  if (absolute < 60 * 60 * 24 * 7) return formatter.format(Math.round(deltaSeconds / 86400), 'day')
  if (absolute < 60 * 60 * 24 * 30) return formatter.format(Math.round(deltaSeconds / (86400 * 7)), 'week')
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(timestamp)
}

export function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat(getActiveLocale(), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function formatShortDate(timestamp: number): string {
  const locale = getActiveLocale()
  const date = new Date(timestamp)
  const now = new Date()
  if (date.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
  }
  return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short' }).format(date)
}

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase('zh-CN')
}

export function displayTitle(title: string): string {
  return title.trim() || translate(getActiveLocale(), 'common.untitledNote')
}

export function normalizeTag(tag: string): string {
  return tag
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, '-')
    .replace(/[，。！？、,.!?;；:：]/g, '')
    .slice(0, 32)
}

export function cleanTags(tags: readonly string[]): string[] {
  return Array.from(new Set(tags.map(normalizeTag).filter(Boolean))).slice(0, 30)
}

export function uniqueTitle(baseTitle: string, existingTitles: Iterable<string>): string {
  const base = displayTitle(baseTitle)
  const titles = new Set(Array.from(existingTitles, normalizeTitle))
  if (!titles.has(normalizeTitle(base))) return base
  let counter = 2
  while (titles.has(normalizeTitle(`${base} ${counter}`))) counter += 1
  return `${base} ${counter}`
}

export function countWords(markdown: string): number {
  const plain = stripMarkdown(markdown)
  const chinese = plain.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g)?.length ?? 0
  const latin = plain
    .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length
  return chinese + latin
}

export function readingTime(words: number): string {
  const minutes = Math.max(1, Math.ceil(words / 320))
  return translate(getActiveLocale(), 'common.readingTime', { count: minutes })
}

export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target: string, label?: string) => label ?? target)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~`|]/g, ' ')
    .replace(/\$\$?[\s\S]*?\$\$?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function excerpt(markdown: string, maxLength = 150): string {
  const plain = stripMarkdown(markdown)
  if (!plain) return translate(getActiveLocale(), 'common.noContent')
  return plain.length > maxLength ? `${plain.slice(0, maxLength).trimEnd()}…` : plain
}

export function sanitizeFilename(name: string): string {
  const withoutControlCharacters = Array.from(name)
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  const cleaned = withoutControlCharacters
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\.+$/g, '')
    .trim()
  return cleaned.slice(0, 120) || translate(getActiveLocale(), 'common.untitledNote')
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent === 0 ? 0 : value >= 10 ? 0 : 1)} ${units[exponent]}`
}

export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

export function shortcutLabel(keys: string): string {
  return isMacPlatform() ? keys.replace(/Ctrl/g, '⌘').replace(/Alt/g, '⌥') : keys
}
