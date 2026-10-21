import { Cloud, FileText, Loader2, LockKeyhole, Network } from 'lucide-react'
import * as React from 'react'

import { LogoMark, Wordmark } from '@/components/common/logo'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MessageKey } from '@/i18n/messages'
import { useI18n } from '@/i18n/use-i18n'
import { LOCALES } from '@/lib/locale'
import { cn } from '@/lib/utils'
import { useAuth } from '@/providers/auth-provider'
import { ApiError } from '@/sync/api'

const ERROR_KEYS: Record<string, MessageKey> = {
  invalid_email: 'auth.errorInvalidEmail',
  invalid_password: 'auth.errorPasswordLength',
  invalid_credentials: 'auth.errorInvalidCredentials',
  email_exists: 'auth.errorEmailExists',
  network_error: 'auth.errorNetwork',
  request_failed: 'auth.errorGeneric',
}

function errorKey(error: unknown): MessageKey {
  if (error instanceof ApiError) return ERROR_KEYS[error.code] ?? 'auth.errorGeneric'
  return 'auth.errorNetwork'
}

export function AuthScreen() {
  const { login, register } = useAuth()
  const { t, locale, setLocale } = useI18n()
  const [mode, setMode] = React.useState<'login' | 'register'>('login')
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    document.title = t('auth.pageTitle')
  }, [t])

  const switchMode = (next: 'login' | 'register') => {
    setMode(next)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim())) {
      setError(t('auth.errorInvalidEmail'))
      return
    }
    if (password.length < 8 || password.length > 128) {
      setError(t('auth.errorPasswordLength'))
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'))
      return
    }
    setPending(true)
    try {
      if (mode === 'register') await register(email.trim(), password)
      else await login(email.trim(), password)
    } catch (cause) {
      setError(t(errorKey(cause)))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1.08fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-sidebar p-10 lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10 rounded-xl" />
            <div>
              <div className="text-[17px] font-semibold tracking-[-0.035em]">
                <Wordmark />
              </div>
              <p className="mt-0.5 text-[9.5px] uppercase tracking-[0.15em] text-muted-foreground">
                {t('auth.cloudBadge')}
              </p>
            </div>
          </div>

          <h1 className="mt-20 max-w-md text-[38px] font-semibold leading-[1.1] tracking-[-0.045em]">
            {t('auth.heroTitle')}
          </h1>
          <p className="mt-4 max-w-md text-[13px] leading-6 text-muted-foreground">
            {t('auth.heroDescription')}
          </p>

          <div className="mt-11 max-w-md space-y-4">
            {[
              { icon: Cloud, title: t('auth.featureCloud'), description: t('auth.featureCloudDesc') },
              {
                icon: FileText,
                title: t('auth.featureMarkdown'),
                description: t('auth.featureMarkdownDesc'),
              },
              {
                icon: LockKeyhole,
                title: t('auth.featurePrivate'),
                description: t('auth.featurePrivateDesc'),
              },
            ].map((feature) => {
              const Icon = feature.icon
              return (
                <div key={feature.title} className="flex gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-primary">
                    <Icon className="size-3.5" />
                  </div>
                  <div>
                    <p className="text-[11.5px] font-medium">{feature.title}</p>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-[9.5px] text-muted-foreground">
          <Network className="size-3" />
          Cloudflare Workers · D1 · Static Assets
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between lg:justify-end">
          <div className="flex items-center gap-2 lg:hidden">
            <LogoMark className="size-7 rounded-lg" />
            <Wordmark className="text-[14px]" />
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="auth-language">
              {t('language.menu')}
            </label>
            <select
              id="auth-language"
              value={locale}
              onChange={(event) => setLocale(event.target.value as typeof locale)}
              className="h-7 rounded-md border border-border bg-card px-1.5 text-[10px] text-muted-foreground outline-none focus:border-ring"
            >
              {LOCALES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <ThemeToggle />
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <div className="mb-7">
            <div className="mb-3 inline-flex rounded-md border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={cn(
                  'rounded-[5px] px-3 py-1.5 text-[11px] font-medium transition-colors',
                  mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                aria-pressed={mode === 'login'}
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={cn(
                  'rounded-[5px] px-3 py-1.5 text-[11px] font-medium transition-colors',
                  mode === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground',
                )}
                aria-pressed={mode === 'register'}
              >
                {t('auth.createAccount')}
              </button>
            </div>
            <h2 className="text-[25px] font-semibold tracking-[-0.035em]">
              {mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </h2>
            <p className="mt-1.5 text-[12px] leading-5 text-muted-foreground">
              {mode === 'login' ? t('auth.signInDesc') : t('auth.registerDesc')}
            </p>
          </div>

          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium">{t('auth.email')}</span>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                required
                autoFocus
                disabled={pending}
                className="h-10"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11.5px] font-medium">{t('auth.password')}</span>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder={t('auth.passwordPlaceholder')}
                required
                minLength={8}
                maxLength={128}
                disabled={pending}
                className="h-10"
              />
            </label>
            {mode === 'register' && (
              <label className="block space-y-1.5">
                <span className="text-[11.5px] font-medium">{t('auth.confirmPassword')}</span>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={128}
                  disabled={pending}
                  className="h-10"
                />
              </label>
            )}
            {mode === 'register' && (
              <p className="text-[10px] leading-4 text-muted-foreground">{t('auth.passwordHint')}</p>
            )}
            {error && (
              <p role="alert" aria-live="polite" className="rounded-md bg-destructive/8 px-3 py-2 text-[11px] text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="h-10 w-full" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? t('auth.submitting')
                : mode === 'login'
                  ? t('auth.submitSignIn')
                  : t('auth.submitRegister')}
            </Button>
          </form>

          <p className="mt-5 text-center text-[11px] text-muted-foreground">
            {mode === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
            <button
              type="button"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
              className="font-medium text-primary hover:underline"
            >
              {mode === 'login' ? t('auth.switchRegister') : t('auth.switchLogin')}
            </button>
          </p>

          <p className="mt-10 flex items-center justify-center gap-1.5 text-[9px] text-muted-foreground/70">
            <LockKeyhole className="size-2.5" />
            {t('auth.cloudBadge')} · {locale}
          </p>
        </div>
      </main>
    </div>
  )
}
