import { describe, expect, it } from 'vitest'

import { getSeedContent } from '@/db/seed-content'
import { dictionaries, translate } from './messages'

describe('i18n messages', () => {
  it('has the same keys in every locale', () => {
    const enKeys = Object.keys(dictionaries.en).sort()
    expect(Object.keys(dictionaries['zh-CN']).sort()).toEqual(enKeys)
    expect(Object.keys(dictionaries['zh-TW']).sort()).toEqual(enKeys)
  })

  it('contains interpolated values and plural forms', () => {
    expect(translate('en', 'common.noteCount', { count: 1 })).toBe('1 note')
    expect(translate('en', 'common.noteCount', { count: 3 })).toBe('3 notes')
    expect(translate('zh-CN', 'common.noteCount', { count: 3 })).toBe('3 篇笔记')
    expect(translate('zh-TW', 'common.noteCount', { count: 3 })).toBe('3 篇筆記')
    expect(translate('en', 'list.moreAria', { title: 'Alpha' })).toContain('Alpha')
  })

  it('does not leave untranslated Chinese in the English UI dictionary', () => {
    const han = /[\u3400-\u9fff]/
    const suspicious = Object.entries(dictionaries.en).filter(
      ([key, value]) => han.test(value) && !key.startsWith('lang.'),
    )
    expect(suspicious).toEqual([])
  })

  it('ships localized onboarding content for each language', () => {
    expect(getSeedContent('en').welcomeTitle).toBe('Welcome to Mindora')
    expect(getSeedContent('zh-CN').welcomeTitle).toBe('欢迎来到 Mindora')
    expect(getSeedContent('zh-TW').welcomeTitle).toContain('歡迎')
  })
})
