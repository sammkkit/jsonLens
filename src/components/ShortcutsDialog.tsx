import { useMemo } from 'react'
import type { ActionGroup, ActionSet } from '../actions/useActions'
import { displayChord, IS_MAC } from '../lib/keys'
import { useUi } from '../state/ui'

const ORDER: ActionGroup[] = ['File', 'Edit', 'JSON', 'Compare', 'View', 'Help']

/**
 * Editor built-ins worth knowing. These are Monaco's own bindings — listed
 * because they genuinely work, not re-implemented here.
 */
const EDITOR_BUILTINS: { label: string; mac: string; other: string }[] = [
  { label: 'Copy / Cut / Paste', mac: '⌘C ⌘X ⌘V', other: 'Ctrl+C / X / V' },
  { label: 'Add selection to next match', mac: '⌘D', other: 'Ctrl+D' },
  { label: 'Duplicate line', mac: '⇧⌥↓', other: 'Shift+Alt+↓' },
  { label: 'Move line up / down (editor mode)', mac: '⌥↑ ⌥↓', other: 'Alt+↑ / Alt+↓' },
  { label: 'Indent / outdent', mac: '⌘] ⌘[', other: 'Ctrl+] / Ctrl+[' },
]

export function ShortcutsDialog({ actions }: { actions: ActionSet }) {
  const ui = useUi()

  const groups = useMemo(() => {
    return ORDER.map((group) => ({
      group,
      rows: actions.list.filter((action) => action.group === group && action.keys?.length),
    })).filter((entry) => entry.rows.length > 0)
  }, [actions])

  return (
    <div
      className="overlay"
      onPointerDown={(event) => event.target === event.currentTarget && ui.setOverlay(null)}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="dialog-head">
          <span>Keyboard Shortcuts</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => ui.setOverlay(null)}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="dialog-body scroll-thin">
          {groups.map(({ group, rows }) => (
            <section className="shortcut-group" key={group}>
              <h3>{group}</h3>
              {rows.map((action) => (
                <div className="shortcut-row" key={action.id}>
                  <span title={action.title}>{action.title}</span>
                  <kbd>{action.keys!.map((chord) => displayChord(chord)).join('  or  ')}</kbd>
                </div>
              ))}
            </section>
          ))}
          <section className="shortcut-group">
            <h3>Editor built-ins</h3>
            {EDITOR_BUILTINS.map((entry) => (
              <div className="shortcut-row" key={entry.label}>
                <span>{entry.label}</span>
                <kbd>{IS_MAC ? entry.mac : entry.other}</kbd>
              </div>
            ))}
          </section>
        </div>
        <div className="dialog-foot">
          Folding also responds to the editor’s own chords, and every command here is searchable
          with Find Action.
        </div>
      </div>
    </div>
  )
}
