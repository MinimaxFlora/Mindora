import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AuthScreen } from '@/components/auth/auth-screen'
import { LogoMark } from '@/components/common/logo'
import { AppShell } from '@/components/layout/app-shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { translate } from '@/i18n/messages'
import { getActiveLocale } from '@/lib/locale'
import { useAuth, AuthProvider } from '@/providers/auth-provider'
import { DataProvider } from '@/providers/data-provider'
import { SettingsProvider, useSettings } from '@/providers/settings-provider'
import { SyncProvider } from '@/providers/sync-provider'
import { UIProvider } from '@/providers/ui-provider'

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Mindora UI error', error)
  }

  render() {
    if (this.state.error) {
      const locale = getActiveLocale()
      return (
        <div className="flex h-full items-center justify-center bg-background px-6">
          <div className="max-w-md rounded-xl border border-border bg-card p-7 shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-destructive">
              Mindora
            </p>
            <h1 className="mt-2 text-lg font-semibold">{translate(locale, 'app.errorTitle')}</h1>
            <p className="mt-2 text-[12.5px] leading-5 text-muted-foreground">
              {translate(locale, 'app.errorDescription')}
            </p>
            <pre className="mt-4 max-h-28 overflow-auto rounded-md bg-muted/60 p-3 text-[10px] leading-4 text-muted-foreground">
              {this.state.error.message}
            </pre>
            <button
              type="button"
              className="mt-5 rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground"
              onClick={() => window.location.reload()}
            >
              {translate(locale, 'app.reload')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function MindoraToaster() {
  const { resolvedTheme } = useSettings()
  return (
    <Toaster
      theme={resolvedTheme}
      position="bottom-right"
      closeButton
      richColors
      toastOptions={{ style: { borderRadius: '10px', fontSize: '12.5px' } }}
    />
  )
}

function AuthLoading() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background">
      <LogoMark className="size-10 rounded-xl" />
      <Loader2 className="size-5 animate-spin text-primary" />
    </div>
  )
}

function AuthenticatedRoot() {
  const { user, loading } = useAuth()
  if (loading) return <AuthLoading />
  if (!user) return <AuthScreen />

  return (
    <SyncProvider key={user.id} user={user}>
      <DataProvider>
        <UIProvider>
          <AppShell />
        </UIProvider>
      </DataProvider>
    </SyncProvider>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <SettingsProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={400} skipDelayDuration={80}>
              <AuthenticatedRoot />
              <MindoraToaster />
            </TooltipProvider>
          </AuthProvider>
        </SettingsProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  )
}
