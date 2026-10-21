import {
  Bold,
  ChevronDown,
  Code2,
  Heading1,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Loader2,
  Quote,
  Redo2,
  Search,
  SquareCode,
  Strikethrough,
  Table2,
  Undo2,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import type { MarkdownEditorHandle } from '@/components/editor/markdown-editor'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editorRef: React.RefObject<MarkdownEditorHandle | null>
  onLink: () => void
  onImage: () => void
  onCodeBlock: () => void
  onSearch: () => void
  onToggleLineNumbers: () => void
  lineNumbers: boolean
  uploading: boolean
  disabled?: boolean
}

function ToolButton({
  label,
  shortcut,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string
  shortcut?: string
  onClick: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip content={shortcut ? `${label} · ${shortcut}` : label}>
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        className={cn('shrink-0 text-muted-foreground', active && 'bg-accent text-foreground')}
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={active}
      >
        {children}
      </Button>
    </Tooltip>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
}

export function EditorToolbar({
  editorRef,
  onLink,
  onImage,
  onCodeBlock,
  onSearch,
  onToggleLineNumbers,
  lineNumbers,
  uploading,
  disabled = false,
}: EditorToolbarProps) {
  const { t } = useI18n()
  const apply = (action: (handle: MarkdownEditorHandle) => void) => {
    const handle = editorRef.current
    if (handle) action(handle)
  }

  return (
    <div
      className="flex h-[39px] shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card/55 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="toolbar"
      aria-label={t('editor.toolbarAria')}
    >
      <ToolButton label={t('editor.toolbar.undo')} shortcut="Ctrl+Z" onClick={() => apply((handle) => handle.undo())} disabled={disabled}>
        <Undo2 />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.redo')} shortcut="Ctrl+Shift+Z" onClick={() => apply((handle) => handle.redo())} disabled={disabled}>
        <Redo2 />
      </ToolButton>
      <Divider />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1 px-1.5 text-muted-foreground"
            disabled={disabled}
            aria-label={t('editor.toolbar.heading')}
          >
            <Heading1 className="size-3.5" />
            <ChevronDown className="size-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-40">
          <DropdownMenuLabel>{t('editor.toolbar.heading')}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => apply((handle) => handle.setHeading(0))}>
            {t('editor.heading.body')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {([1, 2, 3, 4, 5, 6] as const).map((level) => (
            <DropdownMenuItem key={level} onSelect={() => apply((handle) => handle.setHeading(level))}>
              {t(`editor.heading.h${level}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolButton label={t('editor.toolbar.bold')} shortcut="Ctrl+B" onClick={() => apply((handle) => handle.wrapSelection('**', '**', t('editor.toolbar.bold')))} disabled={disabled}>
        <Bold />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.italic')} shortcut="Ctrl+I" onClick={() => apply((handle) => handle.wrapSelection('*', '*', t('editor.toolbar.italic')))} disabled={disabled}>
        <Italic />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.strike')} shortcut="Ctrl+Shift+X" onClick={() => apply((handle) => handle.wrapSelection('~~', '~~', t('editor.toolbar.strike')))} disabled={disabled}>
        <Strikethrough />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.inlineCode')} shortcut="Ctrl+`" onClick={() => apply((handle) => handle.wrapSelection('`', '`', t('editor.toolbar.inlineCode')))} disabled={disabled}>
        <Code2 />
      </ToolButton>
      <Divider />
      <ToolButton label={t('editor.toolbar.bullet')} onClick={() => apply((handle) => handle.prefixLines('- '))} disabled={disabled}>
        <List />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.ordered')} onClick={() => apply((handle) => handle.prefixLines('1. '))} disabled={disabled}>
        <ListOrdered />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.task')} onClick={() => apply((handle) => handle.prefixLines('- [ ] '))} disabled={disabled}>
        <ListTodo />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.quote')} onClick={() => apply((handle) => handle.prefixLines('> '))} disabled={disabled}>
        <Quote />
      </ToolButton>
      <Divider />
      <ToolButton label={t('editor.toolbar.link')} shortcut="Ctrl+K" onClick={onLink} disabled={disabled}>
        <Link2 />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.image')} onClick={onImage} disabled={disabled || uploading}>
        {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </ToolButton>
      <ToolButton label={t('editor.toolbar.table')} onClick={() => apply((handle) => handle.insertBlock('\n| Header 1 | Header 2 |\n| --- | --- |\n| Cell | Cell |\n'))} disabled={disabled}>
        <Table2 />
      </ToolButton>
      <ToolButton label={t('editor.toolbar.code')} onClick={onCodeBlock} disabled={disabled}>
        <SquareCode />
      </ToolButton>
      <Divider />
      <ToolButton label={t('editor.toolbar.lineNumbers')} onClick={onToggleLineNumbers} active={lineNumbers}>
        <span className="font-mono text-[10px] font-semibold">#</span>
      </ToolButton>
      <div className="ml-auto flex shrink-0 items-center pl-1">
        <ToolButton label={t('editor.toolbar.find')} shortcut="Ctrl+F" onClick={onSearch} disabled={disabled}>
          <Search />
        </ToolButton>
      </div>
    </div>
  )
}
