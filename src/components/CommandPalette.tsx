import { useEffect, useMemo, useRef, useState } from 'react'
import type { ActionSet } from '../actions/useActions'
import { fuzzyScore } from '../lib/fuzzy'
import { displayChord } from '../lib/keys'
import { useUi } from '../state/ui'

/** JetBrains-style "find action": every command in the app, searchable. */
export function CommandPalette({ actions }: { actions: ActionSet }) {
  const ui = useUi()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const enabled = actions.list.filter((action) => action.enabled)
    if (query.trim() === '') return enabled
    return enabled
      .map((action) => ({
        action,
        score: Math.max(
          fuzzyScore(query, action.title),
          fuzzyScore(query, `${action.group} ${action.title}`) - 2,
          action.detail ? fuzzyScore(query, action.detail) - 4 : -1,
        ),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.action)
  }, [actions, query])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const runActive = () => {
    const action = results[active]
    if (!action) return
    ui.setOverlay(null)
    action.run()
  }

  return (
    <div className="overlay" onPointerDown={(event) => event.target === event.currentTarget && ui.setOverlay(null)}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Find action">
        <input
          className="palette-input"
          autoFocus
          placeholder="Search actions…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((index) => Math.min(index + 1, results.length - 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(index - 1, 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              runActive()
            }
          }}
        />
        <div className="palette-list scroll-thin" ref={listRef} role="listbox">
          {results.length === 0 ? (
            <div className="palette-empty">No matching actions</div>
          ) : (
            results.map((action, index) => (
              <button
                type="button"
                key={action.id}
                className="palette-item"
                role="option"
                aria-selected={index === active}
                data-active={index === active}
                data-index={index}
                onPointerEnter={() => setActive(index)}
                onClick={() => {
                  ui.setOverlay(null)
                  action.run()
                }}
              >
                <span className="palette-group">{action.group}</span>
                <span className="palette-title">{action.title}</span>
                {action.keys?.[0] && (
                  <span className="menu-item-key">{displayChord(action.keys[0])}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
