import type { MessageKey } from '@/i18n/messages'
import type { Translate } from '@/i18n/use-i18n'

export class LocalizedError extends Error {
  readonly code: MessageKey
  readonly params?: Record<string, string | number>

  constructor(code: MessageKey, params?: Record<string, string | number>) {
    super(code)
    this.name = 'LocalizedError'
    this.code = code
    this.params = params
  }
}

export function errorText(error: unknown, t: Translate, fallbackKey: MessageKey = 'error.actionFailed'): string {
  if (error instanceof LocalizedError) return t(error.code, error.params)
  if (error instanceof Error && error.message) return error.message
  return t(fallbackKey)
}
