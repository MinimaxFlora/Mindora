export const LOCALES = [
  { value: 'zh-CN', label: '简体中文', shortLabel: '简中', htmlLang: 'zh-CN' },
  { value: 'zh-TW', label: '繁體中文', shortLabel: '繁中', htmlLang: 'zh-Hant' },
  { value: 'en', label: 'English', shortLabel: 'EN', htmlLang: 'en' },
] as const

export type Locale = (typeof LOCALES)[number]['value']

const SUPPORTED = new Set<Locale>(LOCALES.map((locale) => locale.value))
let activeLocale: Locale = detectLocale()

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'zh-CN'
  const languages = navigator.languages?.length ? navigator.languages : [navigator.language]
  for (const language of languages) {
    const normalized = language.replace('_', '-').toLowerCase()
    if (normalized.startsWith('zh-tw') || normalized.startsWith('zh-hk') || normalized.startsWith('zh-mo') || normalized.startsWith('zh-hant')) {
      return 'zh-TW'
    }
    if (normalized.startsWith('zh')) return 'zh-CN'
    if (normalized.startsWith('en')) return 'en'
  }
  return 'en'
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && SUPPORTED.has(value as Locale)
}

export function setActiveLocale(locale: Locale): void {
  activeLocale = locale
}

export function getActiveLocale(): Locale {
  return activeLocale
}

export function htmlLang(locale: Locale): string {
  return LOCALES.find((item) => item.value === locale)?.htmlLang ?? 'en'
}

export function localeLabel(locale: Locale): string {
  return LOCALES.find((item) => item.value === locale)?.label ?? 'English'
}

export function formatNumber(value: number, locale = activeLocale): string {
  return new Intl.NumberFormat(locale).format(value)
}
