import * as React from 'react'

interface UIContextValue {
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
}

const UIContext = React.createContext<UIContextValue | null>(null)

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false)

  const value = React.useMemo(
    () => ({
      searchOpen,
      setSearchOpen,
      mobileNavOpen,
      setMobileNavOpen,
      shortcutsOpen,
      setShortcutsOpen,
    }),
    [searchOpen, mobileNavOpen, shortcutsOpen],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI(): UIContextValue {
  const value = React.useContext(UIContext)
  if (!value) throw new Error('useUI must be used inside UIProvider')
  return value
}
