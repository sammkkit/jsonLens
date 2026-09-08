import { useEffect, useRef, useState } from 'react'
import { model, type Side } from '../editor/documents'
import { setCursor } from '../editor/cursor'
import { BASE_EDITOR_OPTIONS, monaco } from '../editor/monaco'
import { clearFlash, recallView, rememberView, registry } from '../editor/registry'
import { useAnalysisState } from '../state/analysis'
import { useAppState, useDispatch } from '../state/store'
import { PaneHeader } from './PaneHeader'

/**
 * Below this width two columns stop being readable, so the comparison folds
 * into a single inline stream regardless of the chosen layout.
 */
const INLINE_BREAKPOINT = 720

/** Side-by-side (or unified) comparison of the two documents. */
export function DiffPane() {
  const { names, settings, focus, texts } = useAppState()
  const dispatch = useDispatch()
  const { left, right } = useAnalysisState()
  const hostRef = useRef<HTMLDivElement>(null)
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null)
  const [ratio, setRatio] = useState(0.5)
  const [hostWidth, setHostWidth] = useState(Infinity)

  // One source of truth for the layout: the requested mode, narrowed to a
  // single column when there isn't room for two. Monaco is told what to render
  // rather than deciding for itself, so the filename tabs can never disagree
  // with what's on screen.
  const sideBySide = settings.layout === 'split' && hostWidth > INLINE_BREAKPOINT

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const diff = monaco.editor.createDiffEditor(host, {
      ...BASE_EDITOR_OPTIONS,
      // Both sides stay editable: comparing is part of editing, not a preview.
      originalEditable: true,
      enableSplitViewResizing: true,
      renderSideBySide: true,
      renderIndicators: true,
      renderMarginRevertIcon: true,
      renderOverviewRuler: true,
      ignoreTrimWhitespace: false,
      diffAlgorithm: 'advanced',
    })
    diff.setModel({ original: model('left'), modified: model('right') })
    diffRef.current = diff
    registry.diff = diff

    const saved = recallView<monaco.editor.IDiffEditorViewState>('diff')
    if (saved) diff.restoreViewState(saved)

    const original = diff.getOriginalEditor()
    const modified = diff.getModifiedEditor()

    const track = (editor: monaco.editor.ICodeEditor, side: Side) => {
      const report = () => {
        const position = editor.getPosition()
        const selection = editor.getSelection()
        const doc = editor.getModel()
        setCursor({
          line: position?.lineNumber ?? 1,
          column: position?.column ?? 1,
          selected: selection && doc ? doc.getValueLengthInRange(selection) : 0,
        })
      }
      return [
        editor.onDidFocusEditorText(() => {
          dispatch({ type: 'focus', side })
          report()
        }),
        editor.onDidChangeCursorPosition(() => {
          if (editor.hasTextFocus()) report()
        }),
        editor.onDidChangeCursorSelection(() => {
          if (editor.hasTextFocus()) report()
        }),
      ]
    }

    // Keep the filename tabs aligned with the sash the user can drag.
    const syncLayout = () => {
      const width = host.clientWidth
      if (!width) return
      setHostWidth(width)
      // Only meaningful in the two-column layout; inline leaves the original
      // editor as a narrow gutter whose width says nothing about a split.
      if (width > INLINE_BREAKPOINT) {
        const originalWidth = original.getLayoutInfo().width
        if (originalWidth > 0) setRatio(Math.min(Math.max(originalWidth / width, 0.1), 0.9))
      }
    }

    // `automaticLayout` re-lays the editor out on container resizes; these
    // events are how we hear about it.
    const subscriptions = [
      ...track(original, 'left'),
      ...track(modified, 'right'),
      original.onDidLayoutChange(syncLayout),
      modified.onDidLayoutChange(syncLayout),
    ]

    syncLayout()
    modified.focus()

    return () => {
      rememberView('diff', diff.saveViewState())
      subscriptions.forEach((subscription) => subscription.dispose())
      registry.diff = null
      diffRef.current = null
      clearFlash()
      diff.dispose()
    }
  }, [dispatch])

  useEffect(() => {
    diffRef.current?.updateOptions({ renderSideBySide: sideBySide })
  }, [sideBySide])

  useEffect(() => {
    diffRef.current?.updateOptions({
      hideUnchangedRegions: { enabled: settings.collapseUnchanged },
    })
  }, [settings.collapseUnchanged])

  useEffect(() => {
    diffRef.current?.updateOptions({ wordWrap: settings.wordWrap ? 'on' : 'off' })
  }, [settings.wordWrap])

  const leftPercent = `${ratio * 100}%`

  return (
    <div className="pane-stack">
      <div className="pane-headers" data-layout={sideBySide ? 'split' : 'unified'}>
        <PaneHeader
          side="left"
          name={names.left}
          report={left}
          role="Original"
          focused={focus === 'left'}
          // Side by side, the tabs track the draggable sash; unified, the two
          // documents share one stream, so the names read as one line.
          style={sideBySide ? { width: leftPercent, flex: 'none' } : { flex: 'none' }}
        />
        {!sideBySide && (
          <span className="pane-arrow" aria-hidden="true">
            →
          </span>
        )}
        <PaneHeader
          side="right"
          name={names.right}
          report={right}
          role="Changed"
          focused={focus === 'right'}
          style={{ flex: 1 }}
        />
      </div>
      <div className="editor-host">
        <div ref={hostRef} className="monaco-editor-container" />
        {sideBySide && texts.left.trim() === '' && (
          <DropHint label={names.left} style={{ left: 0, width: leftPercent }} />
        )}
        {texts.right.trim() === '' && (
          <DropHint
            label={names.right}
            style={sideBySide ? { left: leftPercent, right: 0 } : { left: 0, right: 0 }}
          />
        )}
      </div>
    </div>
  )
}

function DropHint({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <div className="pane-placeholder" style={style}>
      <strong>Drop {label} here</strong>
      <span>or paste JSON directly</span>
    </div>
  )
}
