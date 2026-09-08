import { useEffect } from 'react'
import type { ActionSet } from '../actions/useActions'
import { matchesEvent } from '../lib/keys'
import { useUi } from '../state/ui'

/**
 * A single capture-phase listener owns every shortcut. Capturing on `window`
 * means it runs before Monaco's own keybinding service, so app-level chords win
 * over editor defaults (Alt+↑/↓ becomes diff navigation while comparing) without
 * having to re-register anything inside the editor.
 */
export function useHotkeys(actions: ActionSet): void {
  const ui = useUi()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (ui.overlay) {
          event.preventDefault()
          event.stopPropagation()
          ui.setOverlay(null)
        } else if (ui.openMenu) {
          event.preventDefault()
          event.stopPropagation()
          ui.setOpenMenu(null)
        }
        return
      }

      // Let text inputs outside the editor (palette search, filename fields)
      // keep their native editing keys.
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, [contenteditable="true"]') &&
        !target.closest('.monaco-editor')
      ) {
        return
      }

      for (const action of actions.list) {
        if (!action.enabled || !action.keys) continue
        if (action.keys.some((chord) => matchesEvent(chord, event))) {
          event.preventDefault()
          event.stopPropagation()
          action.run()
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [actions, ui])
}
