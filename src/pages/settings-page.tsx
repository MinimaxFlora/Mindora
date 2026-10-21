import {
  Archive,
  Check,
  Database,
  Download,
  Globe2,
  HardDrive,
  Keyboard,
  Loader2,
  LogOut,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  ShieldCheck,
  Sun,
  Trash2,
  Type,
  Upload,
  UserRound,
} from 'lucide-react'
import * as React from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ImportDialog } from '@/components/settings/import-dialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import { db } from '@/db/database'
import { getStorageEstimate } from '@/db/repository'
import { createBackupArchive } from '@/lib/backup'
import type { ThemePreference, ViewMode } from '@/db/types'
import { useI18n } from '@/i18n/use-i18n'
import { errorText } from '@/lib/errors'
import { LOCALES, localeLabel } from '@/lib/locale'
import { downloadBlob, formatBytes, shortcutLabel } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import { useData } from '@/providers/data-provider'
import { useSettings } from '@/providers/settings-provider'
import { useUI } from '@/providers/ui-provider'

function SettingsSection({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-border bg-card shadow-[0_1px_0_rgb(0_0_0/0.015)]">
      <div className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="text-[13px] font-semibold tracking-[-0.01em]">{title}</h2>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="divide-y divide-border/75">{children}</div>
    </section>
  )
}

function SettingRow({
  label,
  description,
  control,
}: {
  label: string
  description?: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-5 px-4 py-3.5 sm:px-5">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function RangeSetting({
  label,
  description,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium">{label}</p>
          <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{description}</p>
        </div>
        <span className="min-w-[3.5rem] rounded-md border border-border bg-muted/50 px-2 py-1 text-center font-mono text-[10px] text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-[var(--primary)]"
        aria-label={label}
      />
    </div>
  )
}

const THEMES = [
  { value: 'light', labelKey: 'settings.theme.light', descriptionKey: 'settings.theme.lightDesc', icon: Sun },
  { value: 'dark', labelKey: 'settings.theme.dark', descriptionKey: 'settings.theme.darkDesc', icon: Moon },
  { value: 'system', labelKey: 'settings.theme.system', descriptionKey: 'settings.theme.systemDesc', icon: Monitor },
] as const satisfies readonly {
  value: ThemePreference
  labelKey: 'settings.theme.light' | 'settings.theme.dark' | 'settings.theme.system'
  descriptionKey:
    | 'settings.theme.lightDesc'
    | 'settings.theme.darkDesc'
    | 'settings.theme.systemDesc'
  icon: React.ComponentType<{ className?: string }>
}[]

export function SettingsPage() {
  const { settings, updateSettings, updateEditor, updatePreview, resetSettings } = useSettings()
  const { user, logout, deleteAccount } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const { notes, folders } = useData()
  const { setShortcutsOpen } = useUI()
  const attachmentStats = useLiveQuery(async () => {
    const attachments = await db.attachments.toArray()
    return {
      count: attachments.length,
      bytes: attachments.reduce((sum, attachment) => sum + attachment.size, 0),
    }
  }, [])
  const [storage, setStorage] = React.useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = React.useState<boolean | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [importOpen, setImportOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [clearOpen, setClearOpen] = React.useState(false)
  const [signOutOpen, setSignOutOpen] = React.useState(false)
  const [deleteAccountOpen, setDeleteAccountOpen] = React.useState(false)
  const [clearPhrase, setClearPhrase] = React.useState('')
  const [clearing, setClearing] = React.useState(false)
  const [clearError, setClearError] = React.useState<string | null>(null)

  const refreshStorage = React.useCallback(async () => {
    const estimate = await getStorageEstimate()
    setStorage(estimate)
    if (navigator.storage?.persisted) {
      try {
        setPersisted(await navigator.storage.persisted())
      } catch {
        setPersisted(null)
      }
    }
  }, [])

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshStorage()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshStorage, notes.length, attachmentStats?.count])

  const handleExport = async () => {
    setExporting(true)
    try {
      const result = await createBackupArchive()
      downloadBlob(result.blob, result.filename)
      toast.success(t('settings.toast.exported'), {
        description: t('settings.toast.exportedDesc', {
          notes: result.noteCount,
          attachments: result.attachmentCount,
        }),
      })
      await refreshStorage()
    } catch (cause) {
      toast.error(t('settings.toast.exportFailed'), {
        description: errorText(cause, t, 'settings.toast.exportFailedDesc'),
      })
    } finally {
      setExporting(false)
    }
  }

  const requestPersistence = async () => {
    try {
      const granted = await navigator.storage.persist()
      setPersisted(granted)
      toast[granted ? 'success' : 'warning'](
        granted ? t('settings.toast.persistGranted') : t('settings.toast.persistDenied'),
        {
          description: granted
            ? t('settings.toast.persistGrantedDesc')
            : t('settings.toast.persistDeniedDesc'),
        },
      )
    } catch {
      toast.error(t('settings.toast.persistError'))
    }
  }

  const handleClearAll = async () => {
    if (clearPhrase.trim() !== t('settings.dialog.clear.phrase')) return
    setClearing(true)
    setClearError(null)
    try {
      await logout()
      setClearOpen(false)
    } catch (cause) {
      setClearError(errorText(cause, t, 'settings.dialog.clear.error'))
      setClearing(false)
    }
  }

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 py-7 sm:px-7 lg:py-10">
        <header className="mb-8 flex flex-wrap items-start gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {t('settings.eyebrow')}
            </p>
            <h1 className="mt-1 text-[25px] font-semibold tracking-[-0.035em]">{t('settings.title')}</h1>
            <p className="mt-1.5 text-[11.5px] leading-5 text-muted-foreground">
              {t('settings.description')}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setShortcutsOpen(true)}>
              <Keyboard />
              {t('settings.shortcuts')}
            </Button>
            <Tooltip content={t('settings.resetAria')}>
              <Button variant="ghost" size="iconSm" onClick={() => setResetOpen(true)} aria-label={t('settings.resetAria')}>
                <RotateCcw className="size-4" />
              </Button>
            </Tooltip>
          </div>
        </header>

        <div className="space-y-5">
          <SettingsSection
            id="appearance"
            title={t('settings.section.appearance')}
            description={t('settings.section.appearanceDesc')}
            icon={Palette}
          >
            <div className="grid gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
              {THEMES.map((theme) => {
                const Icon = theme.icon
                const active = settings.theme === theme.value
                return (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => updateSettings({ theme: theme.value })}
                    className={`relative rounded-lg border p-2.5 text-left transition-[border-color,box-shadow] ${
                      active
                        ? 'border-primary/60 bg-accent/35 shadow-[0_0_0_1px_var(--primary)]'
                        : 'border-border hover:border-input hover:bg-muted/20'
                    }`}
                    aria-pressed={active}
                  >
                    <div
                      className={`mb-2.5 overflow-hidden rounded-md border p-2 ${
                        theme.value === 'dark'
                          ? 'border-[#343b33] bg-[#171a16]'
                          : theme.value === 'light'
                            ? 'border-[#e1ddd3] bg-[#fbfaf6]'
                            : 'border-[#d7d2c8] bg-[linear-gradient(90deg,#fbfaf6_50%,#171a16_50%)]'
                      }`}
                    >
                      <div className={`h-1.5 w-1/2 rounded-full ${theme.value === 'dark' ? 'bg-[#a7c9ba]' : 'bg-[#3d7563]'}`} />
                      <div className={`mt-1.5 h-1 w-3/4 rounded-full ${theme.value === 'dark' ? 'bg-[#3a4137]' : 'bg-[#ded9cf]'}`} />
                      <div className={`mt-1 h-1 w-2/3 rounded-full ${theme.value === 'dark' ? 'bg-[#31382f]' : 'bg-[#e7e2d9]'}`} />
                    </div>
                    <span className="flex items-center gap-1.5 text-[11.5px] font-medium">
                      <Icon className="size-3.5" />
                      {t(theme.labelKey)}
                      {active && <Check className="ml-auto size-3.5 text-primary" />}
                    </span>
                    <span className="mt-0.5 block text-[9.5px] text-muted-foreground">
                      {t(theme.descriptionKey)}
                    </span>
                  </button>
                )
              })}
            </div>
          </SettingsSection>

          <SettingsSection
            id="language"
            title={t('settings.section.language')}
            description={t('settings.section.languageDesc')}
            icon={Globe2}
          >
            <div className="grid gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
              {LOCALES.map((item) => {
                const active = item.value === locale
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setLocale(item.value)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left transition-[border-color,background-color] ${
                      active
                        ? 'border-primary/60 bg-accent/35 shadow-[0_0_0_1px_var(--primary)]'
                        : 'border-border hover:border-input hover:bg-muted/20'
                    }`}
                    aria-pressed={active}
                    data-testid={`locale-${item.value}`}
                  >
                    <span className="text-[12px] font-medium">
                      {item.value === 'zh-CN'
                        ? t('settings.language.zhCN')
                        : item.value === 'zh-TW'
                          ? t('settings.language.zhTW')
                          : t('settings.language.en')}
                    </span>
                    {active && <Check className="size-3.5 text-primary" />}
                  </button>
                )
              })}
            </div>
            <p className="px-4 pb-3 text-[10px] text-muted-foreground sm:px-5">
              {localeLabel(locale)}
            </p>
          </SettingsSection>

          <SettingsSection
            id="editor"
            title={t('settings.section.editor')}
            description={t('settings.section.editorDesc')}
            icon={Type}
          >
            <RangeSetting
              label={t('settings.editor.fontSize')}
              description={t('settings.editor.fontSizeDesc')}
              value={settings.editor.fontSize}
              min={12}
              max={22}
              step={1}
              suffix="px"
              onChange={(fontSize) => updateEditor({ fontSize })}
            />
            <RangeSetting
              label={t('settings.editor.lineHeight')}
              description={t('settings.editor.lineHeightDesc')}
              value={settings.editor.lineHeight}
              min={1.4}
              max={2.1}
              step={0.05}
              suffix=""
              onChange={(lineHeight) => updateEditor({ lineHeight })}
            />
            <SettingRow
              label={t('settings.editor.lineNumbers')}
              description={t('settings.editor.lineNumbersDesc')}
              control={
                <Switch
                  checked={settings.editor.lineNumbers}
                  onCheckedChange={(lineNumbers) => updateEditor({ lineNumbers })}
                  aria-label={t('settings.editor.lineNumbers')}
                />
              }
            />
            <SettingRow
              label={t('settings.editor.defaultView')}
              description={t('settings.editor.defaultViewDesc')}
              control={
                <Select
                  value={settings.editor.defaultViewMode}
                  onValueChange={(value) => updateEditor({ defaultViewMode: value as ViewMode })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="source">{t('editor.mode.sourceShort')}</SelectItem>
                    <SelectItem value="split">{t('editor.mode.splitShort')}</SelectItem>
                    <SelectItem value="read">{t('editor.mode.readShort')}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <SettingRow
              label={t('settings.editor.spellcheck')}
              description={t('settings.editor.spellcheckDesc')}
              control={
                <Switch
                  checked={settings.editor.spellcheck}
                  onCheckedChange={(spellcheck) => updateEditor({ spellcheck })}
                  aria-label={t('settings.editor.spellcheck')}
                />
              }
            />
            <SettingRow
              label={t('settings.editor.autoSave')}
              description={t('settings.editor.autoSaveDesc')}
              control={
                <Select
                  value={String(settings.autoSaveDelay)}
                  onValueChange={(value) => updateSettings({ autoSaveDelay: Number(value) })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="400">{t('settings.seconds', { value: '0.4' })}</SelectItem>
                    <SelectItem value="700">{t('settings.seconds', { value: '0.7' })}</SelectItem>
                    <SelectItem value="1200">{t('settings.seconds', { value: '1.2' })}</SelectItem>
                    <SelectItem value="2000">{t('settings.seconds', { value: '2' })}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          </SettingsSection>

          <SettingsSection
            id="reading"
            title={t('settings.section.reading')}
            description={t('settings.section.readingDesc')}
            icon={Monitor}
          >
            <RangeSetting
              label={t('settings.reading.fontSize')}
              description={t('settings.reading.fontSizeDesc')}
              value={settings.preview.fontSize}
              min={13}
              max={21}
              step={1}
              suffix="px"
              onChange={(fontSize) => updatePreview({ fontSize })}
            />
            <RangeSetting
              label={t('settings.reading.width')}
              description={t('settings.reading.widthDesc')}
              value={settings.preview.maxWidth}
              min={560}
              max={1000}
              step={20}
              suffix="px"
              onChange={(maxWidth) => updatePreview({ maxWidth })}
            />
            <SettingRow
              label={t('settings.reading.density')}
              description={t('settings.reading.densityDesc')}
              control={
                <Select
                  value={settings.listDensity}
                  onValueChange={(value) => updateSettings({ listDensity: value as 'compact' | 'comfortable' })}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comfortable">{t('settings.density.comfortable')}</SelectItem>
                    <SelectItem value="compact">{t('settings.density.compact')}</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
            <SettingRow
              label={t('settings.reading.showStats')}
              description={t('settings.reading.showStatsDesc')}
              control={
                <Switch
                  checked={settings.showWordCount}
                  onCheckedChange={(showWordCount) => updateSettings({ showWordCount })}
                  aria-label={t('settings.reading.showStats')}
                />
              }
            />
            <SettingRow
              label={t('settings.reading.confirmTrash')}
              description={t('settings.reading.confirmTrashDesc')}
              control={
                <Switch
                  checked={settings.confirmBeforeTrash}
                  onCheckedChange={(confirmBeforeTrash) => updateSettings({ confirmBeforeTrash })}
                  aria-label={t('settings.reading.confirmTrash')}
                />
              }
            />
          </SettingsSection>

          <SettingsSection
            id="account"
            title={t('auth.account')}
            description={t('auth.accountDesc')}
            icon={UserRound}
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {t('auth.signedInAs')}
                  </p>
                  <p className="mt-0.5 truncate text-[12px] font-medium">{user?.email}</p>
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setSignOutOpen(true)}>
                <LogOut />
                {t('auth.signOut')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/8 hover:text-destructive"
                onClick={() => setDeleteAccountOpen(true)}
              >
                <Trash2 />
                {t('auth.deleteAccount')}
              </Button>
            </div>
          </SettingsSection>

          <SettingsSection
            id="data"
            title={t('settings.section.data')}
            description={t('settings.section.dataDesc')}
            icon={Database}
          >
            <div className="grid grid-cols-2 gap-px bg-border/70 sm:grid-cols-4">
              {[
                [t('settings.data.notes'), String(notes.length)],
                [t('settings.data.folders'), String(folders.length)],
                [t('settings.data.attachments'), String(attachmentStats?.count ?? 0)],
                [t('settings.data.attachmentSize'), formatBytes(attachmentStats?.bytes ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="bg-card px-4 py-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-1 font-mono text-[13px] text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-b border-border/75 px-4 py-3.5 sm:px-5">
              <Button variant="secondary" size="sm" onClick={() => void handleExport()} disabled={exporting}>
                {exporting ? <Loader2 className="animate-spin" /> : <Archive />}
                {exporting ? t('settings.data.exporting') : t('settings.data.export')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                <Upload />
                {t('settings.data.import')}
              </Button>
              <span className="ml-auto text-[9.5px] text-muted-foreground">
                {t('settings.data.zipInfo')}
              </span>
            </div>
            <div className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
              <HardDrive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium">
                  {storage
                    ? t('settings.data.usage', {
                        used: formatBytes(storage.usage),
                        quota: storage.quota ? ` / ${formatBytes(storage.quota)}` : '',
                      })
                    : t('settings.data.usageNoQuota')}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                  {t('settings.data.clearWarning')}
                </p>
                {persisted === false && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto p-0 text-[10px]"
                    onClick={() => void requestPersistence()}
                  >
                    {t('settings.data.requestPersist')}
                  </Button>
                )}
                {persisted === true && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-success">
                    <ShieldCheck className="size-3" />
                    {t('settings.data.persisted')}
                  </p>
                )}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            id="shortcuts"
            title={t('settings.section.shortcuts')}
            description={t('settings.section.shortcutsDesc')}
            icon={Keyboard}
          >
            <div className="flex flex-wrap items-center gap-4 px-4 py-3.5 text-[10.5px] text-muted-foreground sm:px-5">
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[9px]">
                  {shortcutLabel('Ctrl+K')}
                </kbd>
                {t('settings.shortcuts.globalSearch')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[9px]">
                  Alt+N
                </kbd>
                {t('settings.shortcuts.newNote')}
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[9px]">
                  {shortcutLabel('Ctrl+S')}
                </kbd>
                {t('settings.shortcuts.saveNow')}
              </span>
              <Button
                variant="link"
                size="sm"
                className="ml-auto h-auto p-0 text-[10px]"
                onClick={() => setShortcutsOpen(true)}
              >
                {t('settings.shortcuts.viewAll')}
              </Button>
            </div>
            <div className="px-4 py-3.5 sm:px-5">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-success" />
                <p className="text-[10px] leading-4 text-muted-foreground">
                  {t('settings.security')}
                </p>
              </div>
            </div>
            <div className="border-t border-border/75 px-4 py-3.5 sm:px-5">
              <p className="text-[11px] font-medium">{t('settings.access')}</p>
              <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
                {t('settings.accessDesc')}
              </p>
              <a
                href="https://github.com/MinimaxFlora/Mindora/blob/main/docs/DEPLOYMENT.md#access-and-login"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex text-[10px] text-primary hover:underline"
              >
                {t('settings.accessLink')}
              </a>
            </div>
          </SettingsSection>

          <SettingsSection
            id="danger"
            title={t('settings.section.danger')}
            description={t('settings.section.dangerDesc')}
            icon={Trash2}
          >
            <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] font-medium">{t('settings.danger.clear')}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                  {t('settings.danger.clearDesc')}
                </p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setClearOpen(true)}>
                <Trash2 />
                {t('settings.danger.clearButton')}
              </Button>
            </div>
          </SettingsSection>

          <footer className="flex flex-wrap items-center gap-2 pb-8 pt-2 text-[9.5px] text-muted-foreground/70">
            <span>Mindora 0.1.0 · MIT License</span>
            <span className="text-border">·</span>
            <a
              href="https://github.com/MinimaxFlora/Mindora"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              GitHub
            </a>
            <span className="ml-auto flex items-center gap-1">
              <Download className="size-2.5" />
              {t('settings.footer.local')}
            </span>
          </footer>
        </div>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        folders={folders}
        onImported={() => {
          void refreshStorage()
        }}
      />

      <ConfirmDialog
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        title={t('auth.signOutConfirm')}
        description={t('auth.signOutDesc')}
        confirmLabel={t('auth.signOut')}
        destructive
        onConfirm={async () => {
          await logout()
        }}
      />

      <ConfirmDialog
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
        title={t('auth.deleteAccountConfirm')}
        description={t('auth.deleteAccountWarning')}
        confirmLabel={t('auth.deleteAccount')}
        destructive
        onConfirm={deleteAccount}
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('settings.dialog.reset.title')}
        description={t('settings.dialog.reset.description')}
        confirmLabel={t('settings.dialog.reset.confirm')}
        onConfirm={() => {
          resetSettings()
          toast.success(t('settings.toast.reset'))
        }}
      />

      <Dialog open={clearOpen} onOpenChange={(open) => !clearing && setClearOpen(open)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t('settings.dialog.clear.title')}</DialogTitle>
            <DialogDescription>{t('settings.dialog.clear.description')}</DialogDescription>
          </DialogHeader>
          <label className="block space-y-1.5">
            <span className="text-[11.5px] font-medium">
              {t('settings.dialog.clear.phraseLabel', { phrase: t('settings.dialog.clear.phrase') })}
            </span>
            <Input
              value={clearPhrase}
              onChange={(event) => setClearPhrase(event.target.value)}
              placeholder={t('settings.dialog.clear.placeholder')}
              autoComplete="off"
              disabled={clearing}
            />
          </label>
          {clearError && (
            <p role="alert" className="mt-2 text-[11px] text-destructive">
              {clearError}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClearOpen(false)} disabled={clearing}>
              {t('settings.dialog.clear.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleClearAll()}
              disabled={clearPhrase.trim() !== t('settings.dialog.clear.phrase') || clearing}
            >
              {clearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
              {t('settings.dialog.clear.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
