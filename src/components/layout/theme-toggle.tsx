import { Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n/use-i18n'
import { useSettings } from '@/providers/settings-provider'

export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { settings, updateSettings } = useSettings()
  const { t } = useI18n()
  const Icon = settings.theme === 'system' ? Monitor : settings.theme === 'light' ? Sun : Moon
  const nextTheme = settings.theme === 'system' ? 'light' : settings.theme === 'light' ? 'dark' : 'system'
  const labels = {
    system: t('nav.appearance.system'),
    light: t('nav.appearance.light'),
    dark: t('nav.appearance.dark'),
  } as const

  return (
    <Tooltip content={t('nav.themeTooltip', { theme: labels[settings.theme] })} side={collapsed ? 'right' : 'top'}>
      <Button
        variant="ghost"
        size={collapsed ? 'icon' : 'sm'}
        className={collapsed ? 'text-muted-foreground' : 'justify-start text-muted-foreground'}
        onClick={() => updateSettings({ theme: nextTheme })}
        aria-label={t('nav.themeAria', { theme: labels[settings.theme], next: labels[nextTheme] })}
      >
        <Icon className="size-4" />
        {!collapsed && <span className="text-[12px]">{labels[settings.theme]}</span>}
      </Button>
    </Tooltip>
  )
}
