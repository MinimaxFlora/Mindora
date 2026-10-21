import { ArrowUp, ChevronUp } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import type { Note } from '@/db/types'
import { getAttachment } from '@/db/repository'
import { useI18n } from '@/i18n/use-i18n'
import { highlightCode, languageDisplayName } from '@/lib/code-highlight'
import { renderMarkdown } from '@/lib/markdown'
import { renderMermaidDiagram } from '@/lib/mermaid'
import { cn } from '@/lib/utils'
import { createNoteResolver } from '@/lib/wiki-links'

export interface MarkdownPreviewHandle {
  scrollToTop: () => void
  scrollToHeading: (slug: string) => void
  getScrollElement: () => HTMLDivElement | null
}

interface MarkdownPreviewProps {
  content: string
  notes: readonly Note[]
  theme: 'light' | 'dark'
  fontSize: number
  maxWidth: number
  onOpenNote: (id: string) => void
  onCreateLinkedNote: (title: string) => void
  onScrollRatio?: (ratio: number) => void
  className?: string
  emptyHint?: string
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path below.
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    return copied
  } catch {
    return false
  }
}

export const MarkdownPreview = React.forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      content,
      notes,
      theme,
      fontSize,
      maxWidth,
      onOpenNote,
      onCreateLinkedNote,
      onScrollRatio,
      className,
      emptyHint,
    },
    ref,
  ) {
    const { t, locale } = useI18n()
    const scrollRef = React.useRef<HTMLDivElement>(null)
    const articleRef = React.useRef<HTMLElement>(null)
    const codeMapRef = React.useRef(new Map<string, string>())
    const [progress, setProgress] = React.useState(0)
    const [showBackToTop, setShowBackToTop] = React.useState(false)
    const html = React.useMemo(() => renderMarkdown(content, locale), [content, locale])
    const resolver = React.useMemo(() => createNoteResolver(notes), [notes])
    const callbackRef = React.useRef({ onOpenNote, onCreateLinkedNote })
    callbackRef.current = { onOpenNote, onCreateLinkedNote }

    const handleScroll = React.useCallback(() => {
      const element = scrollRef.current
      if (!element) return
      const max = element.scrollHeight - element.clientHeight
      const ratio = max > 0 ? element.scrollTop / max : 0
      setProgress(ratio)
      setShowBackToTop(element.scrollTop > 480)
      onScrollRatio?.(ratio)
    }, [onScrollRatio])

    React.useImperativeHandle(
      ref,
      () => ({
        scrollToTop: () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }),
        scrollToHeading: (slug: string) => {
          const article = articleRef.current
          if (!article) return
          const heading = article.querySelector<HTMLElement>(`[id="${CSS.escape(slug)}"]`)
          heading?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        },
        getScrollElement: () => scrollRef.current,
      }),
      [],
    )

    React.useEffect(() => {
      const article = articleRef.current
      if (!article) return
      let cancelled = false
      const objectUrls: string[] = []
      codeMapRef.current.clear()
      let codeIndex = 0

      const attachments = article.querySelectorAll<HTMLImageElement>('img[data-attachment-id]')
      for (const image of attachments) {
        const id = image.dataset.attachmentId
        if (!id) continue
        image.classList.add('attachment-loading')
        void getAttachment(id).then((blob) => {
          if (cancelled) return
          image.classList.remove('attachment-loading')
          if (!blob) {
            const missing = document.createElement('span')
            missing.className = 'attachment-missing'
            missing.textContent = t('editor.preview.attachmentMissing')
            image.replaceWith(missing)
            return
          }
          const url = URL.createObjectURL(blob)
          objectUrls.push(url)
          image.src = url
        })
      }

      const enhance = async () => {
        const blocks = Array.from(article.querySelectorAll<HTMLElement>('pre > code'))
        for (const codeElement of blocks) {
          if (cancelled) return
          const pre = codeElement.parentElement
          if (!pre) continue
          const existingWrapper = pre.closest<HTMLElement>('.code-block')
          if (existingWrapper?.dataset.highlighted === 'true') continue
          const language = Array.from(codeElement.classList)
            .find((name) => name.startsWith('language-'))
            ?.slice('language-'.length)
          const codeText = codeElement.textContent ?? ''

          if (existingWrapper) {
            const body = pre.parentElement
            const existingButton = existingWrapper.querySelector<HTMLButtonElement>('.copy-code-button')
            if (!body) continue
            const key = existingButton?.dataset.codeKey ?? `code-${codeIndex++}`
            if (existingButton) existingButton.dataset.codeKey = key
            codeMapRef.current.set(key, codeText)
            if (!language || codeText.length > 160_000) {
              existingWrapper.dataset.highlighted = 'true'
              continue
            }
            const highlighted = await highlightCode(codeText, language)
            if (cancelled) return
            body.innerHTML = highlighted
            existingWrapper.dataset.highlighted = 'true'
            continue
          }

          if (language?.toLocaleLowerCase() === 'mermaid') {
            const figure = document.createElement('figure')
            figure.className = 'mermaid-figure'
            try {
              const svg = await renderMermaidDiagram(codeText, theme)
              if (cancelled) return
              figure.innerHTML = svg
              pre.replaceWith(figure)
            } catch (error) {
              if (cancelled) return
              const errorBox = document.createElement('div')
              errorBox.className = 'mermaid-error'
              const title = document.createElement('strong')
              title.textContent = t('editor.preview.mermaidError')
              const detail = document.createElement('p')
              detail.className = 'mt-1 text-[11px] text-muted-foreground'
              detail.textContent =
                error instanceof Error ? error.message : t('editor.preview.mermaidUnknown')
              const raw = document.createElement('pre')
              const rawCode = document.createElement('code')
              rawCode.textContent = codeText
              raw.appendChild(rawCode)
              errorBox.append(title, detail, raw)
              figure.replaceChildren(errorBox)
              pre.replaceWith(figure)
            }
            continue
          }

          const wrapper = document.createElement('div')
          wrapper.className = 'code-block'
          const header = document.createElement('div')
          header.className = 'code-block-header'
          const label = document.createElement('span')
          label.textContent = languageDisplayName(language)
          const button = document.createElement('button')
          button.type = 'button'
          button.className = 'copy-code-button'
          button.setAttribute('aria-label', t('editor.preview.copyCodeAria'))
          const icon = document.createElement('span')
          icon.setAttribute('aria-hidden', 'true')
          icon.innerHTML =
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'
          button.append(icon, document.createTextNode(t('editor.preview.copy')))
          const textKey = `code-${codeIndex++}`
          button.dataset.codeKey = textKey
          codeMapRef.current.set(textKey, codeText)
          header.append(label, button)
          const body = document.createElement('div')
          body.className = 'code-block-body'
          const parent = pre.parentNode
          if (!parent) continue
          wrapper.append(header, body)
          parent.replaceChild(wrapper, pre)
          body.appendChild(pre)

          if (!language || codeText.length > 160_000) {
            body.classList.add('code-block-plain')
            wrapper.dataset.highlighted = 'true'
            continue
          }

          const highlighted = await highlightCode(codeText, language)
          if (cancelled) return
          body.innerHTML = highlighted
          wrapper.dataset.highlighted = 'true'
        }
      }

      void enhance()

      return () => {
        cancelled = true
        for (const url of objectUrls) URL.revokeObjectURL(url)
      }
    }, [html, theme, t])

    React.useEffect(() => {
      const article = articleRef.current
      if (!article) return
      const links = article.querySelectorAll<HTMLAnchorElement>('a[data-wiki-title]')
      for (const link of links) {
        const title = link.dataset.wikiTitle ?? ''
        const target = resolver.resolve(title)
        if (target) {
          link.dataset.missing = 'false'
          link.href = `/notes/${target.id}`
          link.setAttribute('aria-label', t('editor.relations.open', { title: target.title }))
        } else {
          link.dataset.missing = 'true'
          link.href = '#'
          link.setAttribute('aria-label', t('editor.relations.create', { title }))
        }
      }
    }, [html, resolver, t])

    const handleClick = async (event: React.MouseEvent<HTMLElement>) => {
      const target = event.target as HTMLElement
      const copyButton = target.closest<HTMLButtonElement>('.copy-code-button')
      if (copyButton) {
        const key = copyButton.dataset.codeKey
        const code = key ? codeMapRef.current.get(key) : undefined
        if (code === undefined) return
        const copied = await copyToClipboard(code)
        if (copied) {
          const original = copyButton.innerHTML
          copyButton.innerHTML = ''
          const check = document.createElement('span')
          check.setAttribute('aria-hidden', 'true')
          check.innerHTML =
            '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>'
          copyButton.append(check, document.createTextNode(t('editor.preview.copied')))
          window.setTimeout(() => {
            if (copyButton.isConnected) copyButton.innerHTML = original
          }, 1600)
          toast.success(t('editor.preview.codeCopied'))
        } else {
          toast.error(t('editor.preview.copyFailed'), {
            description: t('editor.preview.copyFailedDesc'),
          })
        }
        return
      }

      const link = target.closest<HTMLAnchorElement>('a[data-wiki-title]')
      if (!link) return
      event.preventDefault()
      const title = link.dataset.wikiTitle ?? ''
      const note = resolver.resolve(title)
      if (note) {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          window.open(`/notes/${note.id}`, '_blank', 'noopener,noreferrer')
        } else {
          callbackRef.current.onOpenNote(note.id)
        }
      } else {
        callbackRef.current.onCreateLinkedNote(title)
      }
    }

    const style = {
      '--preview-font-size': `${fontSize}px`,
      '--preview-max-width': `${maxWidth}px`,
    } as React.CSSProperties

    return (
      <div className={cn('relative flex h-full min-h-0 flex-col bg-card/35', className)}>
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] bg-transparent"
          aria-hidden="true"
        >
          <div
            className="h-full bg-primary/55 transition-[width] duration-150"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="scrollbar-thin min-h-0 flex-1 overflow-y-auto"
          data-testid="markdown-preview-scroll"
        >
          <div className="mx-auto w-full px-5 py-9 sm:px-9 lg:px-12" style={{ maxWidth: `${maxWidth + 96}px` }}>
            {content.trim() ? (
              <article
                ref={articleRef}
                className="md-preview mx-auto"
                style={style}
                onClick={(event) => void handleClick(event)}
                dangerouslySetInnerHTML={{ __html: html }}
                data-testid="markdown-preview"
              />
            ) : (
              <div
                className="md-preview mx-auto"
                style={style}
                data-testid="markdown-preview"
              >
                <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/45 px-6 py-16 text-center">
                  <ArrowUp className="mb-3 size-5 text-muted-foreground/50" strokeWidth={1.5} />
                  <p className="text-[13px] text-muted-foreground">
                    {emptyHint ?? t('editor.emptyHint')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {showBackToTop && (
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="absolute bottom-5 right-5 flex items-center gap-1 rounded-full border border-border bg-popover/95 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-soft backdrop-blur transition-colors hover:text-foreground"
            aria-label={t('editor.preview.backToTop')}
          >
            <ChevronUp className="size-3.5" />
            {t('editor.preview.backToTop')}
          </button>
        )}
      </div>
    )
  },
)
