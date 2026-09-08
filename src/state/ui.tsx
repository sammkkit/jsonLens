import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type Overlay = 'palette' | 'shortcuts' | null

export interface Notice {
  kind: 'info' | 'error'
  text: string
  /** Optional jump target used for "click the error to go to the line". */
  goTo?: { side: 'left' | 'right'; line: number }
}

export interface UiState {
  overlay: Overlay
  setOverlay: (overlay: Overlay) => void
  openMenu: string | null
  setOpenMenu: (menu: string | null) => void
  changeIndex: number
  setChangeIndex: (index: number) => void
  notice: Notice | null
  notify: (notice: Notice | null) => void
}

const UiContext = createContext<UiState | null>(null)

// Errors linger longer than confirmations — they are the ones worth reading.
const NOTICE_MS = { info: 4000, error: 8000 }

export function UiProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [changeIndex, setChangeIndex] = useState(-1)
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<number | undefined>(undefined)

  // Status-bar notices instead of dialogs: they report without interrupting.
  const notify = useCallback((next: Notice | null) => {
    window.clearTimeout(timer.current)
    setNotice(next)
    if (next) timer.current = window.setTimeout(() => setNotice(null), NOTICE_MS[next.kind])
  }, [])

  const value = useMemo(
    () => ({
      overlay,
      setOverlay,
      openMenu,
      setOpenMenu,
      changeIndex,
      setChangeIndex,
      notice,
      notify,
    }),
    [overlay, openMenu, changeIndex, notice, notify],
  )

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>
}

export function useUi(): UiState {
  const ui = useContext(UiContext)
  if (!ui) throw new Error('useUi must be used inside UiProvider')
  return ui
}
