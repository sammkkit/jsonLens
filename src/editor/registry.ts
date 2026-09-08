import type { CodeEditor, DiffEditor } from './monaco'
import { monaco } from './monaco'
import type { Side } from './documents'

/**
 * Live editor instances. These are imperative handles, not state — keeping them
 * out of React avoids re-rendering the editor tree whenever one mounts.
 */
export const registry: {
  code: CodeEditor | null
  diff: DiffEditor | null
} = { code: null, diff: null }

/**
 * Scroll position, folded regions and selection, kept across mode switches so
 * moving between the editor and the diff view doesn't lose your place.
 */
const viewStates = new Map<string, unknown>()

export function rememberView(key: string, state: unknown): void {
  if (state) viewStates.set(key, state)
}

export function recallView<T>(key: string): T | null {
  return (viewStates.get(key) as T) ?? null
}

export function editorFor(side: Side): CodeEditor | null {
  if (registry.diff) {
    return side === 'left' ? registry.diff.getOriginalEditor() : registry.diff.getModifiedEditor()
  }
  return registry.code
}

/** The editor the user is currently working in. */
function activeEditor(focus: Side): CodeEditor | null {
  return registry.diff ? editorFor(focus) : registry.code
}

export function runEditorCommand(focus: Side, commandId: string): void {
  const editor = activeEditor(focus)
  if (!editor) return
  editor.focus()
  editor.trigger('jsonlens', commandId, null)
}

interface Flash {
  editor: CodeEditor
  collection: monaco.editor.IEditorDecorationsCollection
}
const flashTimers = new Map<Side, number>()
const flashDecorations = new Map<Side, Flash>()

/**
 * Moves the caret to a line and briefly tints it, which is how IDEs confirm a
 * jump without stealing the user's sense of place.
 */
export function revealLine(
  side: Side,
  line: number,
  options: { focus?: boolean; scroll?: boolean } = {},
): void {
  const editor = editorFor(side)
  if (!editor) return
  const model = editor.getModel()
  if (!model) return
  const target = Math.min(Math.max(line, 1), model.getLineCount())
  if (options.scroll !== false) {
    editor.revealLineInCenterIfOutsideViewport(target, monaco.editor.ScrollType.Smooth)
    editor.setPosition({
      lineNumber: target,
      column: model.getLineFirstNonWhitespaceColumn(target) || 1,
    })
  }
  if (options.focus) editor.focus()

  // Decoration collections belong to an editor instance, so drop the cached one
  // whenever the view has been rebuilt (switching between edit and diff modes).
  let flash = flashDecorations.get(side)
  if (!flash || flash.editor !== editor) {
    flash = { editor, collection: editor.createDecorationsCollection([]) }
    flashDecorations.set(side, flash)
  }
  const { collection } = flash
  collection.set([
    {
      range: new monaco.Range(target, 1, target, 1),
      options: { isWholeLine: true, className: 'jl-flash-line' },
    },
  ])
  const previous = flashTimers.get(side)
  if (previous) window.clearTimeout(previous)
  flashTimers.set(
    side,
    window.setTimeout(() => {
      if (flashDecorations.get(side)?.collection === collection) collection.set([])
    }, 1100),
  )
}

export function clearFlash(): void {
  for (const timer of flashTimers.values()) window.clearTimeout(timer)
  flashTimers.clear()
  flashDecorations.clear()
}
