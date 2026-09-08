import { useEffect, useRef } from 'react'
import { model } from '../editor/documents'
import { setCursor } from '../editor/cursor'
import { BASE_EDITOR_OPTIONS, monaco } from '../editor/monaco'
import { clearFlash, recallView, rememberView, registry } from '../editor/registry'
import { useAnalysisState } from '../state/analysis'
import { useAppState } from '../state/store'
import { PaneHeader } from './PaneHeader'

/** Single-document editing mode. */
export function EditorPane() {
  const { names, settings } = useAppState()
  const { left } = useAnalysisState()
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const editor = monaco.editor.create(host, {
      ...BASE_EDITOR_OPTIONS,
      model: model('left'),
    })
    editorRef.current = editor
    registry.code = editor

    const saved = recallView<monaco.editor.ICodeEditorViewState>('code')
    if (saved) editor.restoreViewState(saved)

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
    report()
    const subscriptions = [
      editor.onDidChangeCursorPosition(report),
      editor.onDidChangeCursorSelection(report),
    ]
    editor.focus()

    return () => {
      rememberView('code', editor.saveViewState())
      subscriptions.forEach((subscription) => subscription.dispose())
      registry.code = null
      editorRef.current = null
      clearFlash()
      editor.dispose()
    }
  }, [])

  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: settings.wordWrap ? 'on' : 'off' })
  }, [settings.wordWrap])

  return (
    <div className="pane-stack">
      <div className="pane-headers">
        <PaneHeader side="left" name={names.left} report={left} focused style={{ flex: 1 }} />
      </div>
      <div className="editor-host">
        <div ref={hostRef} className="monaco-editor-container" />
      </div>
    </div>
  )
}
