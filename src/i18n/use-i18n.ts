import * as React from 'react'

import { LOCALES, type Locale } from '@/lib/locale'
import { useSettings } from '@/providers/settings-provider'

import { translate, type MessageKey } from './messages'

export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

export function useI18n(): {
  locale: Locale
  t: Translate
  setLocale: (locale: Locale) => void
} {
  const { settings, updateSettings } = useSettings()
  const locale = settings.locale

  const t = React.useCallback<Translate>(
    (key, params) => translate(locale, key, params),
    [locale],
  )

  const setLocale = React.useCallback(
    (next: Locale) => {
      if (LOCALES.some((item) => item.value === next)) updateSettings({ locale: next })
    },
    [updateSettings],
  )

  return { locale, t, setLocale }
}
