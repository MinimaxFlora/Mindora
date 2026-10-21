import { describe, expect, it } from 'vitest'

import { setActiveLocale } from '@/lib/locale'

import { extractHeadings, renderMarkdown } from './markdown'

describe('markdown rendering', () => {
  it('renders GFM, math, code, footnotes, tables, and wiki links', () => {
    setActiveLocale('en')
    const html = renderMarkdown(`# Heading

**bold** and ~~gone~~.

| A | B |
| --- | --- |
| 1 | 2 |

- [x] Done
- [ ] Not done

\`\`\`ts
const answer: number = 42
\`\`\`

Inline math $a^2 + b^2 = c^2$.

$$
\\int_0^1 x^2 dx
$$

A wiki link to [[Another note]].

Footnote reference.[^1]

[^1]: The footnote body.
`)

    expect(html).toContain('<h1')
    expect(html).toContain('Heading')
    expect(html).toContain('<table>')
    expect(html).toContain('language-ts')
    expect(html).toContain('class="katex"')
    expect(html).toContain('katex-display')
    expect(html).toContain('data-wiki-title="Another note"')
    expect(html).toContain('footnotes')
    expect(html).toContain('The footnote body.')
    expect(html).toContain('type="checkbox"')
  })

  it('strips scripts, event handlers, iframes, and dangerous URLs', () => {
    const html = renderMarkdown(`<script>window.__xss = true</script>

<img src="x" onerror="alert(1)" alt="bad">

<iframe src="https://example.com"></iframe>

[bad](javascript:alert(1))

<a href="javascript:alert(2)">raw bad</a>
`)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('javascript:')
  })

  it('allows safe raw HTML and secures external links', () => {
    const html = renderMarkdown(`<details open><summary>More</summary><kbd>Ctrl</kbd></details>

[OpenAI](https://openai.com)`)
    expect(html).toContain('<details')
    expect(html).toContain('<kbd>Ctrl</kbd>')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="nofollow noopener noreferrer"')
  })

  it('extracts headings with stable unique slugs', () => {
    setActiveLocale('en')
    const headings = extractHeadings(`# Duplicate

## Duplicate

## 中文标题

\`\`\`md
# Not a heading
\`\`\`
`)
    expect(headings).toHaveLength(3)
    expect(headings[0]?.slug).toBe('duplicate')
    expect(headings[1]?.slug).toBe('duplicate-1')
    expect(headings[2]?.text).toBe('中文标题')
  })

  it('hides frontmatter from the rendered body', () => {
    const html = renderMarkdown(`---
title: Secret frontmatter
tags: [one, two]
---

# Visible body
`)
    expect(html).toContain('Visible body')
    expect(html).not.toContain('Secret frontmatter')
  })
})
