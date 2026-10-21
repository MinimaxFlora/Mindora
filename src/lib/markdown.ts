import GithubSlugger from 'github-slugger'

import { translate } from '@/i18n/messages'
import { getActiveLocale, type Locale } from '@/lib/locale'
import type { Element, Root as HastRoot } from 'hast'
import type { Heading, Link, Parent, Root, Text } from 'mdast'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

export const WIKI_HREF_PREFIX = '#mindora-wiki:'

export interface HeadingItem {
  depth: number
  text: string
  slug: string
}

function textFromNode(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const record = node as { value?: unknown; children?: unknown[] }
  if (typeof record.value === 'string') return record.value
  if (Array.isArray(record.children)) return record.children.map(textFromNode).join('')
  return ''
}

export function extractHeadings(markdown: string): HeadingItem[] {
  const slugger = new GithubSlugger()
  const headings: HeadingItem[] = []
  try {
    const tree = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkFrontmatter, ['yaml'])
      .parse(markdown) as Root
    visit(tree, 'heading', (node: Heading) => {
      const text = textFromNode(node).trim()
      if (!text) return
      headings.push({
        depth: node.depth,
        text,
        slug: slugger.slug(text),
      })
    })
  } catch {
    return []
  }
  return headings
}

function remarkWikiLinks() {
  return (tree: Root) => {
    visit(tree, 'text', (node: Text, index, parent: Parent | undefined) => {
      if (!parent || typeof index !== 'number' || parent.type === 'link') return
      const pattern = /\[\[([^[\]\n]+?)\]\]/g
      if (!pattern.test(node.value)) return
      pattern.lastIndex = 0

      const children: Parent['children'] = []
      let cursor = 0
      for (const match of node.value.matchAll(pattern)) {
        const start = match.index ?? 0
        if (start > cursor) {
          children.push({ type: 'text', value: node.value.slice(cursor, start) })
        }
        const [rawTarget = '', ...labelParts] = (match[1] ?? '').split('|')
        const target = rawTarget.trim()
        const label = labelParts.join('|').trim() || target
        const link: Link = {
          type: 'link',
          url: `${WIKI_HREF_PREFIX}${encodeURIComponent(target)}`,
          children: [{ type: 'text', value: label }],
          data: {
            hProperties: {
              className: ['wiki-link'],
            },
          },
        }
        children.push(link)
        cursor = start + match[0].length
      }
      if (cursor < node.value.length) {
        children.push({ type: 'text', value: node.value.slice(cursor) })
      }
      if (children.length === 0) return
      parent.children.splice(index, 1, ...children)
      return [SKIP, index + children.length]
    })
  }
}

function rehypeWikiMarkers() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'a') return
      const href = node.properties?.href
      if (typeof href !== 'string' || !href.startsWith(WIKI_HREF_PREFIX)) return
      const encoded = href.slice(WIKI_HREF_PREFIX.length)
      let target: string
      try {
        target = decodeURIComponent(encoded)
      } catch {
        return
      }
      if (!target) return
      node.properties = {
        ...node.properties,
        href: '#',
        className: ['wiki-link'],
        'data-wiki-title': target,
      }
    })
  }
}

function rehypeLinkAndImagePolicy() {
  return (tree: HastRoot) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'a') {
        const href = node.properties?.href
        if (typeof href === 'string' && /^https?:\/\//i.test(href)) {
          node.properties = {
            ...node.properties,
            target: '_blank',
            rel: ['nofollow', 'noopener', 'noreferrer'],
          }
        }
      }
      if (node.tagName === 'img') {
        const src = node.properties?.src
        if (typeof src === 'string' && src.startsWith('mindora-asset://')) {
          const id = src.slice('mindora-asset://'.length)
          node.properties = {
            ...node.properties,
            src: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
            'data-attachment-id': id,
            loading: 'lazy',
            decoding: 'async',
          }
        } else if (typeof src === 'string' && /^https?:\/\//i.test(src)) {
          node.properties = {
            ...node.properties,
            loading: 'lazy',
            decoding: 'async',
            referrerPolicy: 'no-referrer',
          }
        }
      }
    })
  }
}

const sanitizeSchema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    'details',
    'summary',
    'kbd',
    'mark',
    'sub',
    'sup',
    'dl',
    'dt',
    'dd',
    'figure',
    'figcaption',
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      'target',
      'rel',
      'aria-label',
      'data-footnote-ref',
      'data-footnote-backref',
    ],
    input: ['type', 'checked', 'disabled'],
    details: ['open'],
    li: [...(defaultSchema.attributes?.li ?? []), ['className', 'task-list-item']],
    code: [...(defaultSchema.attributes?.code ?? []), ['className', /^language-./, 'math-inline', 'math-display']],
    span: [...(defaultSchema.attributes?.span ?? []), ['className', 'katex', 'katex-display']],
    div: [...(defaultSchema.attributes?.div ?? []), ['className', 'math', 'math-display']],
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      'data-footnote-ref',
      'data-footnote-backref',
      'data-footnotes',
      'aria-describedby',
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'mindora-asset'],
  },
}

const processors = new Map<Locale, ReturnType<typeof buildProcessor>>()

function buildProcessor(locale: Locale) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkMath)
    .use(remarkWikiLinks)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      footnoteLabel: translate(locale, 'editor.footnoteLabel'),
      footnoteBackLabel: translate(locale, 'editor.footnoteBack'),
    })
    .use(rehypeRaw)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeSlug)
    .use(rehypeKatex, {
      throwOnError: false,
      strict: false,
      errorColor: '#b42318',
    })
    .use(rehypeLinkAndImagePolicy)
    .use(rehypeWikiMarkers)
    .use(rehypeStringify)
}

function getProcessor(locale: Locale) {
  let processor = processors.get(locale)
  if (!processor) {
    processor = buildProcessor(locale)
    processors.set(locale, processor)
  }
  return processor
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(markdown: string, requestedLocale?: Locale): string {
  const locale = requestedLocale ?? getActiveLocale()
  try {
    return String(getProcessor(locale).processSync(markdown))
  } catch (error) {
    const message =
      error instanceof Error ? error.message : translate(locale, 'markdown.unknownError')
    return `<div class="markdown-render-error" role="alert"><strong>${escapeHtml(translate(locale, 'markdown.renderError'))}</strong><p>${escapeHtml(message)}</p><pre>${escapeHtml(markdown.slice(0, 4000))}</pre></div>`
  }
}

export function looksLikeLargeDocument(markdown: string): boolean {
  return markdown.length > 100_000
}
