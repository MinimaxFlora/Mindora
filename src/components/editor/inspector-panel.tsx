import { ArrowUpRight, FilePlus2, FileText, ListTree, Link2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useI18n } from '@/i18n/use-i18n'
import type { HeadingItem } from '@/lib/markdown'
import type { Backlink, ResolvedWikiLink } from '@/lib/wiki-links'
import { cn } from '@/lib/utils'

interface InspectorPanelProps {
  open: boolean
  headings: HeadingItem[]
  backlinks: Backlink[]
  outgoing: ResolvedWikiLink[]
  onClose: () => void
  onNavigate: (id: string) => void
  onHeading: (slug: string) => void
  onCreateLinkedNote: (title: string) => void
  className?: string
}

export function InspectorPanel({
  open,
  headings,
  backlinks,
  outgoing,
  onClose,
  onNavigate,
  onHeading,
  onCreateLinkedNote,
  className,
}: InspectorPanelProps) {
  const { t } = useI18n()
  if (!open) return null

  return (
    <aside
      className={cn(
        'z-30 flex w-[292px] shrink-0 flex-col border-l border-border bg-sidebar/95 shadow-[-8px_0_24px_rgb(0_0_0/0.035)] backdrop-blur lg:shadow-none',
        className,
      )}
      aria-label={t('editor.relations.title')}
    >
      <div className="flex h-[39px] shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {t('editor.relations.title')}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="icon-button size-6"
          aria-label={t('editor.relations.close')}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Tabs defaultValue="outline" className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border px-3 py-2">
          <TabsList className="w-full">
            <TabsTrigger value="outline" className="flex-1 gap-1.5">
              <ListTree className="size-3" />
              {t('editor.relations.outline')}
            </TabsTrigger>
            <TabsTrigger value="links" className="flex-1 gap-1.5">
              <Link2 className="size-3" />
              {t('editor.relations.links')}
              {(backlinks.length > 0 || outgoing.length > 0) && (
                <span className="text-[9px] opacity-60">{backlinks.length + outgoing.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="outline" className="scrollbar-thin m-0 min-h-0 flex-1 overflow-y-auto p-2">
          {headings.length === 0 ? (
            <p className="px-2 py-6 text-center text-[11px] leading-5 text-muted-foreground">
              {t('editor.relations.noHeadings')}
            </p>
          ) : (
            <nav aria-label={t('editor.relations.tocAria')}>
              <ul className="space-y-0.5">
                {headings.map((heading, index) => (
                  <li key={`${heading.slug}-${index}`}>
                    <button
                      type="button"
                      onClick={() => onHeading(heading.slug)}
                      className={cn(
                        'block w-full truncate rounded px-2 py-1 text-left text-[11.5px] text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground',
                        heading.depth === 1 && 'font-semibold text-foreground',
                        heading.depth === 2 && 'font-medium',
                      )}
                      style={{ paddingLeft: `${Math.max(0, heading.depth - 1) * 10 + 8}px` }}
                      title={heading.text}
                    >
                      {heading.text}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </TabsContent>
        <TabsContent value="links" className="scrollbar-thin m-0 min-h-0 flex-1 overflow-y-auto p-3">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('editor.relations.backlinks')}
              </h3>
              <Badge variant="outline">{backlinks.length}</Badge>
            </div>
            {backlinks.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-2.5 py-3 text-[10.5px] leading-4 text-muted-foreground/80">
                {t('editor.relations.noBacklinks')}
              </p>
            ) : (
              <ul className="space-y-1">
                {backlinks.map((backlink) => (
                  <li key={backlink.note.id}>
                    <button
                      type="button"
                      onClick={() => onNavigate(backlink.note.id)}
                      className="group w-full rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-card"
                    >
                      <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-foreground">
                        <FileText className="size-3 text-muted-foreground" />
                        <span className="truncate">{backlink.note.title}</span>
                        <ArrowUpRight className="ml-auto size-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                      </span>
                      <span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-muted-foreground">
                        {backlink.context}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t('editor.relations.outgoing')}
              </h3>
              <Badge variant="outline">{outgoing.length}</Badge>
            </div>
            {outgoing.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-2.5 py-3 text-[10.5px] leading-4 text-muted-foreground/80">
                {t('editor.relations.noOutgoing')}
              </p>
            ) : (
              <ul className="space-y-0.5">
                {outgoing.map((link, index) => (
                  <li key={`${link.target}-${index}`}>
                    {link.note ? (
                      <button
                        type="button"
                        onClick={() => onNavigate(link.note?.id ?? '')}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11.5px] text-foreground transition-colors hover:bg-foreground/5"
                      >
                        <Link2 className="size-3 shrink-0 text-primary" />
                        <span className="truncate">{link.label}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onCreateLinkedNote(link.target)}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[11.5px] text-warning transition-colors hover:bg-warning/8"
                      >
                        <FilePlus2 className="size-3 shrink-0" />
                        <span className="truncate">{link.target}</span>
                        <span className="ml-auto text-[9px] opacity-65">{t('editor.relations.new')}</span>
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </TabsContent>
      </Tabs>
    </aside>
  )
}
