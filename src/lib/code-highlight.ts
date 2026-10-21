import type { HighlighterCore } from 'shiki/core'

import { translate } from '@/i18n/messages'
import { getActiveLocale } from '@/lib/locale'

interface LanguageModule {
  default: unknown
}

type LanguageLoader = () => Promise<LanguageModule>

const LANGUAGE_LOADERS: Record<string, LanguageLoader> = {
  typescript: () => import('shiki/langs/typescript.mjs'),
  javascript: () => import('shiki/langs/javascript.mjs'),
  tsx: () => import('shiki/langs/tsx.mjs'),
  jsx: () => import('shiki/langs/jsx.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  go: () => import('shiki/langs/go.mjs'),
  rust: () => import('shiki/langs/rust.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  c: () => import('shiki/langs/c.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  toml: () => import('shiki/langs/toml.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
}

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  typescript: 'typescript',
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  tsx: 'tsx',
  html: 'html',
  htm: 'html',
  xml: 'html',
  css: 'css',
  scss: 'css',
  json: 'json',
  jsonc: 'json',
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  go: 'go',
  golang: 'go',
  rust: 'rust',
  rs: 'rust',
  python: 'python',
  py: 'python',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  cc: 'cpp',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  markdown: 'markdown',
  md: 'markdown',
  diff: 'diff',
  patch: 'diff',
}

const DISPLAY_NAMES: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  tsx: 'TSX',
  jsx: 'JSX',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  bash: 'Bash',
  go: 'Go',
  rust: 'Rust',
  python: 'Python',
  java: 'Java',
  c: 'C',
  cpp: 'C++',
  sql: 'SQL',
  yaml: 'YAML',
  toml: 'TOML',
  markdown: 'Markdown',
  diff: 'Diff',
  mermaid: 'Mermaid',
}

interface HighlighterState {
  core: HighlighterCore
  loaded: Set<string>
  loading: Map<string, Promise<void>>
}

let highlighterPromise: Promise<HighlighterState> | null = null

async function createHighlighter(): Promise<HighlighterState> {
  const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, lightTheme, darkTheme] =
    await Promise.all([
      import('shiki/core'),
      import('shiki/engine/javascript'),
      import('shiki/themes/github-light.mjs'),
      import('shiki/themes/github-dark.mjs'),
    ])

  const core = await createHighlighterCore({
    themes: [lightTheme.default, darkTheme.default],
    langs: [],
    engine: createJavaScriptRegexEngine(),
  })

  return { core, loaded: new Set(), loading: new Map() }
}

async function getHighlighter(): Promise<HighlighterState> {
  if (!highlighterPromise) highlighterPromise = createHighlighter()
  return highlighterPromise
}

async function ensureLanguage(state: HighlighterState, language: string): Promise<boolean> {
  if (language === 'text') return true
  if (state.loaded.has(language)) return true
  const loader = LANGUAGE_LOADERS[language]
  if (!loader) return false

  let pending = state.loading.get(language)
  if (!pending) {
    pending = loader().then(async (module) => {
      await state.core.loadLanguage(module.default as never)
      state.loaded.add(language)
    })
    state.loading.set(language, pending)
  }
  try {
    await pending
    return true
  } catch {
    return false
  } finally {
    state.loading.delete(language)
  }
}

export function normalizeLanguage(language: string | undefined | null): string {
  const value = (language ?? '').trim().toLocaleLowerCase()
  if (!value) return 'text'
  return LANGUAGE_ALIASES[value] ?? value
}

export function languageDisplayName(language: string | undefined | null): string {
  const normalized = normalizeLanguage(language)
  if (normalized === 'text') return translate(getActiveLocale(), 'editor.code.plainText')
  if (!LANGUAGE_LOADERS[normalized] && language) {
    return language.trim() || translate(getActiveLocale(), 'editor.code.plainText')
  }
  return DISPLAY_NAMES[normalized] ?? normalized
}

export async function highlightCode(code: string, language: string | undefined): Promise<string> {
  if (code.length > 160_000) {
    return `<pre class="shiki plain"><code>${escapeHtml(code)}</code></pre>`
  }
  let state: HighlighterState
  try {
    state = await getHighlighter()
  } catch (error) {
    console.warn('Unable to initialize the code highlighter', error)
    return `<pre class="shiki plain"><code>${escapeHtml(code)}</code></pre>`
  }

  let lang = normalizeLanguage(language)
  const supported = await ensureLanguage(state, lang)
  if (!supported) lang = 'text'

  try {
    return state.core.codeToHtml(code, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    })
  } catch (error) {
    console.warn(`Unable to highlight language "${lang}"`, error)
    return `<pre class="shiki plain"><code>${escapeHtml(code)}</code></pre>`
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
