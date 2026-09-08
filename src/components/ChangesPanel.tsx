import { useEffect, useRef } from 'react'
import type { ActionSet } from '../actions/useActions'
import { revealChange } from '../actions/navigation'
import { revealLine } from '../editor/registry'
import type { Change } from '../lib/diff/types'
import { useAnalysisState } from '../state/analysis'
import { useAppState } from '../state/store'
import { useUi } from '../state/ui'

const MARKS: Record<Change['kind'], string> = {
  added: '+',
  removed: '−',
  modified: '●',
  type: '●',
}

export function ChangesPanel({ actions }: { actions: ActionSet }) {
  const { changes, summary, comparable, pending, truncated, left, right } = useAnalysisState()
  const { settings, texts, names } = useAppState()
  const ui = useUi()
  const listRef = useRef<HTMLDivElement>(null)

  const select = (index: number) => {
    if (index < 0 || index >= changes.length) return
    ui.setChangeIndex(index)
    revealChange(changes[index], settings.layout)
  }

  // Keep the selected row visible when navigating with the keyboard.
  useEffect(() => {
    if (ui.changeIndex < 0) return
    listRef.current
      ?.querySelector(`[data-index="${ui.changeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [ui.changeIndex])

  return (
    <aside className="changes" aria-label="Changes">
      <div className="changes-head">
        <span className="changes-title">Changes</span>
        {comparable && <span className="changes-count">{summary.total}</span>}
        <div className="changes-nav">
          <button
            type="button"
            className="icon-button"
            title="Previous difference"
            aria-label="Previous difference"
            disabled={changes.length === 0}
            onClick={() => actions.run('compare.prev')}
          >
            ↑
          </button>
          <button
            type="button"
            className="icon-button"
            title="Next difference"
            aria-label="Next difference"
            disabled={changes.length === 0}
            onClick={() => actions.run('compare.next')}
          >
            ↓
          </button>
        </div>
      </div>

      <div
        className="changes-list scroll-thin"
        ref={listRef}
        role="listbox"
        aria-label="Structural changes"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            select(Math.min(ui.changeIndex + 1, changes.length - 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            select(Math.max(ui.changeIndex - 1, 0))
          } else if (event.key === 'Home') {
            event.preventDefault()
            select(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            select(changes.length - 1)
          }
        }}
      >
        {!comparable ? (
          <InvalidState
            leftError={left && !left.valid ? left.error?.line : undefined}
            rightError={right && !right.valid ? right.error?.line : undefined}
            leftName={names.left}
            rightName={names.right}
            emptyRight={texts.right.trim() === ''}
          />
        ) : changes.length === 0 ? (
          <div className="changes-empty">
            <strong>No structural changes</strong>
            {texts.left === texts.right
              ? 'The documents are identical.'
              : 'Both documents describe the same value — only key order or formatting differs.'}
          </div>
        ) : (
          changes.map((change, index) => (
            <button
              type="button"
              key={`${change.leftKey ?? ''}>${change.rightKey ?? ''}:${index}`}
              className="change-row"
              role="option"
              aria-selected={index === ui.changeIndex}
              data-index={index}
              data-selected={index === ui.changeIndex}
              onClick={() => select(index)}
            >
              <span className="change-mark" data-kind={change.kind} aria-hidden="true">
                {MARKS[change.kind]}
              </span>
              <span className="change-path" title={change.label}>
                {change.label}
              </span>
              <span className="change-values">
                {change.left !== undefined && (
                  <span className="change-value" data-role="from" title={change.left}>
                    {change.left}
                  </span>
                )}
                {change.left !== undefined && change.right !== undefined && (
                  <span className="change-arrow" aria-hidden="true">
                    →
                  </span>
                )}
                {change.right !== undefined && (
                  <span className="change-value" data-role="to" title={change.right}>
                    {change.right}
                  </span>
                )}
                {change.kind === 'type' && (
                  <span className="change-arrow">
                    ({change.leftType} → {change.rightType})
                  </span>
                )}
              </span>
            </button>
          ))
        )}
        {truncated && (
          <div className="changes-empty">
            Showing the first {summary.total.toLocaleString()} changes. These documents differ too
            widely to list in full.
          </div>
        )}
        {pending && comparable && changes.length === 0 && (
          <div className="changes-empty">Comparing…</div>
        )}
      </div>
    </aside>
  )
}

function InvalidState({
  leftError,
  rightError,
  leftName,
  rightName,
  emptyRight,
}: {
  leftError?: number
  rightError?: number
  leftName: string
  rightName: string
  emptyRight: boolean
}) {
  if (emptyRight && rightError) {
    return (
      <div className="changes-empty">
        <strong>Nothing to compare yet</strong>
        Drop a file on the right pane, or paste JSON into it.
      </div>
    )
  }
  return (
    <div className="changes-empty">
      <strong>Can’t compare</strong>
      {leftError !== undefined && (
        <button type="button" className="status-item" onClick={() => revealLine('left', leftError, { focus: true })}>
          {leftName} — syntax error on line {leftError}
        </button>
      )}
      {rightError !== undefined && (
        <button type="button" className="status-item" onClick={() => revealLine('right', rightError, { focus: true })}>
          {rightName} — syntax error on line {rightError}
        </button>
      )}
    </div>
  )
}
