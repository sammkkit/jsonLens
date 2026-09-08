import { useSyncExternalStore } from 'react'
import { getCursor, subscribeCursor } from '../editor/cursor'
import { revealLine } from '../editor/registry'
import { useAnalysisState } from '../state/analysis'
import { useAppState } from '../state/store'
import { useUi } from '../state/ui'

export function StatusBar() {
  const { mode, focus, texts } = useAppState()
  const { left, right, summary, comparable, pending } = useAnalysisState()
  const ui = useUi()
  const cursor = useSyncExternalStore(subscribeCursor, getCursor)

  if (mode === 'landing') {
    return (
      <footer className="statusbar">
        <span className="status-item">JSON</span>
        <span className="status-spacer" />
        <span className="status-privacy">Runs entirely in your browser. Your JSON stays on your device.</span>
      </footer>
    )
  }

  const side = mode === 'diff' ? focus : 'left'
  const report = side === 'left' ? left : right
  const text = texts[side]

  return (
    <footer className="statusbar">
      <span className="status-item">JSON</span>
      <span className="status-item">UTF-8</span>
      <span className="status-item">{text.includes('\r\n') ? 'CRLF' : 'LF'}</span>
      <span className="status-item">{report?.lines ?? 1} lines</span>
      <span className="status-item">{formatBytes(report?.bytes ?? 0)}</span>

      {mode === 'diff' && (
        <>
          <span className="status-item" aria-hidden="true">
            ·
          </span>
          {!comparable ? (
            <span className="status-item">Comparison unavailable</span>
          ) : (
            <>
              <span className="status-item">
                {summary.total} {summary.total === 1 ? 'change' : 'changes'}
              </span>
              <span className="status-item status-count" data-kind="modified">
                {summary.modified} modified
              </span>
              <span className="status-item status-count" data-kind="added">
                {summary.added} added
              </span>
              <span className="status-item status-count" data-kind="removed">
                {summary.removed} removed
              </span>
            </>
          )}
          {pending && <span className="status-item">…</span>}
        </>
      )}

      <span className="status-spacer" />

      {ui.notice && (
        <button
          type="button"
          className="status-item status-notice"
          data-kind={ui.notice.kind}
          onClick={() => {
            if (ui.notice?.goTo) revealLine(ui.notice.goTo.side, ui.notice.goTo.line, { focus: true })
          }}
        >
          {ui.notice.text}
        </button>
      )}

      <span className="status-item">
        Ln {cursor.line}, Col {cursor.column}
        {cursor.selected > 0 ? ` (${cursor.selected} selected)` : ''}
      </span>

      {report && !report.valid && report.error ? (
        <button
          type="button"
          className="status-item status-error"
          title="Go to the error"
          onClick={() => revealLine(side, report.error!.line, { focus: true })}
        >
          ✕ {report.error.message} (line {report.error.line}, column {report.error.column})
        </button>
      ) : (
        <span className="status-item status-ok">✓ Valid JSON</span>
      )}

      <span className="status-privacy">Stays on your device</span>
    </footer>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
