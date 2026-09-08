import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Side } from '../editor/documents'
import type { DocReport } from '../lib/analysis'
import { useDispatch } from '../state/store'

interface Props {
  side: Side
  name: string
  report?: DocReport
  focused: boolean
  role?: string
  style?: CSSProperties
}

/** Filename tab for a document: rename in place, plus a validity indicator. */
export function PaneHeader({ side, name, report, focused, role, style }: Props) {
  const dispatch = useDispatch()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  const commit = () => {
    const next = draft.trim()
    if (next && next !== name) dispatch({ type: 'name', side, name: next })
    else setDraft(name)
    setEditing(false)
  }

  const state = !report ? 'empty' : report.valid ? 'valid' : 'invalid'
  const title =
    state === 'valid'
      ? 'Valid JSON'
      : state === 'invalid'
        ? `Invalid JSON — line ${report?.error?.line}`
        : 'Empty document'

  return (
    <div className="pane-header" data-focused={focused} style={style}>
      <span className="dot" data-state={state} title={title} aria-label={title} />
      {editing ? (
        <input
          ref={inputRef}
          className="pane-name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit()
            if (event.key === 'Escape') {
              setDraft(name)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="pane-name"
          title={`${name} — click to rename`}
          onClick={() => {
            setDraft(name)
            setEditing(true)
          }}
        >
          {name}
        </button>
      )}
      {role && <span className="pane-role">{role}</span>}
      {state === 'invalid' && report?.error && (
        <span className="pane-meta status-error">line {report.error.line}</span>
      )}
    </div>
  )
}
