import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from '@codemirror/commands'
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkup,
  markdown,
} from '@codemirror/lang-markdown'
import {
  HighlightStyle,
  bracketMatching,
  indentOnInput,
  indentUnit,
  syntaxHighlighting,
} from '@codemirror/language'
import { openSearchPanel, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, Prec, type Extension } from '@codemirror/state'
import {
  crosshairCursor,
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  placeholder,
  rectangularSelection,
  type Command,
  type ViewUpdate,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import * as React from 'react'

import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/utils'

export interface MarkdownEditorHandle {
  focus: () => void
  insertText: (text: string) => void
  wrapSelection: (before: string, after: string, placeholder: string) => void
  insertBlock: (block: string) => void
  setHeading: (level: number) => void
  insertLink: (label: string, url: string) => void
  insertCodeBlock: (language: string) => void
  prefixLines: (prefix: string) => void
  openSearch: () => void
  undo: () => void
  redo: () => void
  getScrollElement: () => HTMLElement | null
}

interface MarkdownEditorProps {
  initialValue: string
  onChange: (value: string) => void
  onSave: () => void
  onRequestLink: () => void
  onFiles: (files: File[]) => void
  onScroll?: (ratio: number) => void
  lineNumbersEnabled: boolean
  spellcheck: boolean
  className?: string
  ariaLabel?: string
}

const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: 'var(--foreground)', fontWeight: '700', fontSize: '1.18em' },
  { tag: tags.heading2, color: 'var(--foreground)', fontWeight: '680', fontSize: '1.1em' },
  { tag: tags.heading3, color: 'var(--foreground)', fontWeight: '650' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], color: 'var(--muted-foreground)', fontWeight: '650' },
  { tag: tags.strong, color: 'var(--foreground)', fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--muted-foreground)' },
  { tag: tags.link, color: 'var(--primary)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted-foreground)', textDecoration: 'underline' },
  { tag: tags.monospace, color: 'var(--primary)' },
  { tag: tags.quote, color: 'var(--muted-foreground)', fontStyle: 'italic' },
  { tag: [tags.comment, tags.meta], color: 'var(--muted-foreground)' },
  { tag: tags.processingInstruction, color: 'color-mix(in srgb, var(--muted-foreground) 62%, transparent)' },
  { tag: tags.contentSeparator, color: 'var(--muted-foreground)' },
])

function wrapSelection(
  view: EditorView,
  before: string,
  after: string,
  placeholderText: string,
): boolean {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  if (selected.startsWith(before) && selected.endsWith(after) && selected.length >= before.length + after.length) {
    view.dispatch({
      changes: { from, to, insert: selected.slice(before.length, selected.length - after.length) },
      selection: { anchor: from, head: to - before.length - after.length },
    })
    return true
  }
  const text = selected || placeholderText
  view.dispatch({
    changes: { from, to, insert: `${before}${text}${after}` },
    selection:
      selected.length > 0
        ? { anchor: from + before.length, head: from + before.length + selected.length }
        : { anchor: from + before.length, head: from + before.length + placeholderText.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}

const boldCommand: Command = (view) => wrapSelection(view, '**', '**', '')
const italicCommand: Command = (view) => wrapSelection(view, '*', '*', '')
const strikeCommand: Command = (view) => wrapSelection(view, '~~', '~~', '')
const codeCommand: Command = (view) => wrapSelection(view, '`', '`', '')

function setHeadingLevel(view: EditorView, level: number): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.from)
  const nextText = level === 0 ? line.text.replace(/^#{1,6}\s+/, '') : line.text.replace(/^#{1,6}\s+/, '').replace(/^/, `${'#'.repeat(level)} `)
  if (nextText === line.text) return true
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: nextText },
    selection: { anchor: line.from + nextText.length },
    scrollIntoView: true,
  })
  view.focus()
  return true
}

export const MarkdownEditor = React.forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor(
    {
      initialValue,
      onChange,
      onSave,
      onRequestLink,
      onFiles,
      onScroll,
      lineNumbersEnabled,
      spellcheck,
      className,
      ariaLabel,
    },
    ref,
  ) {
    const { t, locale } = useI18n()
    const containerRef = React.useRef<HTMLDivElement>(null)
    const viewRef = React.useRef<EditorView | null>(null)
    const onChangeRef = React.useRef(onChange)
    const onSaveRef = React.useRef(onSave)
    const onLinkRef = React.useRef(onRequestLink)
    const onFilesRef = React.useRef(onFiles)
    const scrollCallbackRef = React.useRef<((ratio: number) => void) | null>(null)
    const lineNumbersCompartment = React.useRef(new Compartment())
    const spellcheckCompartment = React.useRef(new Compartment())
    const phrasesCompartment = React.useRef(new Compartment())
    const placeholderCompartment = React.useRef(new Compartment())

    const searchPhrases = React.useMemo(
      () => ({
        Find: t('editor.search.find'),
        Replace: t('editor.search.replace'),
        next: t('editor.search.next'),
        previous: t('editor.search.previous'),
        all: t('editor.search.all'),
        'match case': t('editor.search.matchCase'),
        regexp: t('editor.search.regexp'),
        'by word': t('editor.search.byWord'),
        replace: t('editor.search.replaceOne'),
        'replace all': t('editor.search.replaceAll'),
        close: t('editor.search.close'),
        'Go to line': t('editor.search.goToLine'),
        go: t('editor.search.go'),
        'current match': t('editor.search.currentMatch'),
        'on line': t('editor.search.onLine'),
        'replaced match on line $': t('editor.search.replacedLine'),
        'replaced $ matches': t('editor.search.replacedMatches'),
      }),
      [t],
    )

    onChangeRef.current = onChange
    onSaveRef.current = onSave
    onLinkRef.current = onRequestLink
    onFilesRef.current = onFiles
    scrollCallbackRef.current = onScroll ?? null

    React.useImperativeHandle(
      ref,
      () => ({
        focus: () => viewRef.current?.focus(),
        insertText: (text: string) => {
          const view = viewRef.current
          if (!view) return
          const { from, to } = view.state.selection.main
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
            scrollIntoView: true,
          })
          view.focus()
        },
        wrapSelection: (before, after, placeholderText) => {
          const view = viewRef.current
          if (view) wrapSelection(view, before, after, placeholderText)
        },
        insertBlock: (block: string) => {
          const view = viewRef.current
          if (!view) return
          const { from, to } = view.state.selection.main
          const prefix = from > 0 && view.state.sliceDoc(from - 1, from) !== '\n' ? '\n' : ''
          const suffix = view.state.sliceDoc(to, to + 1) === '\n' ? '' : '\n'
          const insert = `${prefix}${block}${suffix}`
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
            scrollIntoView: true,
          })
          view.focus()
        },
        setHeading: (level: number) => {
          const view = viewRef.current
          if (view) setHeadingLevel(view, level)
        },
        insertLink: (label: string, url: string) => {
          const view = viewRef.current
          if (!view) return
          const { from, to } = view.state.selection.main
          const selected = view.state.sliceDoc(from, to) || label || t('editor.link.defaultText')
          const insert = `[${selected}](${url})`
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + insert.length },
            scrollIntoView: true,
          })
          view.focus()
        },
        insertCodeBlock: (language: string) => {
          const view = viewRef.current
          if (!view) return
          const { from, to } = view.state.selection.main
          const selected = view.state.sliceDoc(from, to)
          const fence = `\`\`\`${language}\n`
          if (selected) {
            const insert = `${fence}${selected}\n\`\`\``
            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: from + insert.length },
              scrollIntoView: true,
            })
          } else {
            const prefix = from > 0 && view.state.sliceDoc(from - 1, from) !== '\n' ? '\n' : ''
            const insert = `${prefix}${fence}\n\`\`\``
            const cursor = from + prefix.length + fence.length
            view.dispatch({
              changes: { from, to, insert },
              selection: { anchor: cursor },
              scrollIntoView: true,
            })
          }
          view.focus()
        },
        prefixLines: (prefix: string) => {
          const view = viewRef.current
          if (!view) return
          const selection = view.state.selection.main
          const startLine = view.state.doc.lineAt(selection.from)
          const endLine = view.state.doc.lineAt(selection.to)
          const changes: { from: number; to: number; insert: string }[] = []
          for (let number = startLine.number; number <= endLine.number; number += 1) {
            const line = view.state.doc.line(number)
            if (line.text.startsWith(prefix)) {
              changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
            } else if (line.text.trim() || number === startLine.number) {
              changes.push({ from: line.from, to: line.from, insert: prefix })
            }
          }
          view.dispatch({ changes, scrollIntoView: true })
          view.focus()
        },
        openSearch: () => {
          const view = viewRef.current
          if (view) {
            openSearchPanel(view)
            view.focus()
          }
        },
        undo: () => {
          const view = viewRef.current
          if (view) undo(view)
        },
        redo: () => {
          const view = viewRef.current
          if (view) redo(view)
        },
        getScrollElement: () => viewRef.current?.scrollDOM ?? null,
      }),
      [t],
    )

    React.useEffect(() => {
      const parent = containerRef.current
      if (!parent) return

      const extensions: Extension[] = [
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        indentUnit.of('  '),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        EditorState.tabSize.of(2),
        markdown(),
        syntaxHighlighting(markdownHighlightStyle),
        lineNumbersCompartment.current.of(lineNumbersEnabled ? lineNumbers() : []),
        spellcheckCompartment.current.of(
          EditorView.contentAttributes.of({
            spellcheck: String(spellcheck),
            autocapitalize: 'off',
            autocorrect: 'off',
            'aria-label': ariaLabel ?? t('editor.ariaLabel'),
          }),
        ),
        phrasesCompartment.current.of(EditorState.phrases.of(searchPhrases)),
        placeholderCompartment.current.of(placeholder(t('editor.placeholder'))),
        EditorView.lineWrapping,
        EditorView.theme(
          {
            '&': { height: '100%', backgroundColor: 'transparent' },
            '.cm-scroller': { overflow: 'auto' },
            '.cm-placeholder': { color: 'var(--muted-foreground)', opacity: '0.62' },
          },
          { dark: false },
        ),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString())
        }),
        EditorView.domEventHandlers({
          paste: (event) => {
            const files = Array.from(event.clipboardData?.files ?? []).filter((file) =>
              file.type.startsWith('image/'),
            )
            if (files.length > 0) {
              event.preventDefault()
              onFilesRef.current(files)
              return true
            }
            return false
          },
          drop: (event) => {
            const files = Array.from(event.dataTransfer?.files ?? [])
            if (files.length > 0) {
              event.preventDefault()
              onFilesRef.current(files)
              return true
            }
            return false
          },
        }),
        Prec.highest(
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                onSaveRef.current()
                return true
              },
            },
          ]),
        ),
        keymap.of([
          { key: 'Enter', run: insertNewlineContinueMarkup },
          { key: 'Backspace', run: deleteMarkupBackward },
          { key: 'Mod-b', preventDefault: true, run: boldCommand },
          { key: 'Mod-i', preventDefault: true, run: italicCommand },
          { key: 'Mod-Shift-x', preventDefault: true, run: strikeCommand },
          { key: 'Mod-`', preventDefault: true, run: codeCommand },
          {
            key: 'Mod-k',
            preventDefault: true,
            run: () => {
              onLinkRef.current()
              return true
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          indentWithTab,
        ]),
      ]

      const state = EditorState.create({ doc: initialValue, extensions })
      const view = new EditorView({ state, parent })
      viewRef.current = view

      const handleScroll = () => {
        const max = view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight
        if (max > 0) scrollCallbackRef.current?.(view.scrollDOM.scrollTop / max)
      }
      view.scrollDOM.addEventListener('scroll', handleScroll, { passive: true })

      return () => {
        view.scrollDOM.removeEventListener('scroll', handleScroll)
        view.destroy()
        viewRef.current = null
      }
      // The editor owns its document state after mount. Parent remounts it when
      // switching notes, so initialValue intentionally only applies once.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    React.useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: lineNumbersCompartment.current.reconfigure(
          lineNumbersEnabled ? lineNumbers() : [],
        ),
      })
    }, [lineNumbersEnabled])

    React.useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: spellcheckCompartment.current.reconfigure(
          EditorView.contentAttributes.of({
            spellcheck: String(spellcheck),
            autocapitalize: 'off',
            autocorrect: 'off',
            'aria-label': ariaLabel ?? t('editor.ariaLabel'),
          }),
        ),
      })
    }, [spellcheck, ariaLabel, t])

    React.useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: [
          phrasesCompartment.current.reconfigure(EditorState.phrases.of(searchPhrases)),
          placeholderCompartment.current.reconfigure(placeholder(t('editor.placeholder'))),
        ],
      })
    }, [locale, searchPhrases, t])

    return <div ref={containerRef} className={cn('h-full min-h-0', className)} data-testid="markdown-editor" />
  },
)
