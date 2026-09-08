import { monaco } from './monaco'

export type Side = 'left' | 'right'

/**
 * The two Monaco models are the single source of truth for document text and
 * they outlive every editor instance, so switching between the single-file
 * editor and the diff view keeps content, undo history and folding intact.
 */
const models: Record<Side, monaco.editor.ITextModel> = {
  left: monaco.editor.createModel('', 'json', monaco.Uri.parse('inmemory://jsonlens/left.json')),
  right: monaco.editor.createModel('', 'json', monaco.Uri.parse('inmemory://jsonlens/right.json')),
}

export function model(side: Side): monaco.editor.ITextModel {
  return models[side]
}

export function docText(side: Side): string {
  return models[side].getValue()
}

/**
 * Replaces a document's contents as a single undoable edit, so Format, Minify
 * and file loads can all be reverted with one Undo.
 */
export function setDocText(side: Side, text: string): void {
  const target = models[side]
  if (target.getValue() === text) return
  target.pushStackElement()
  target.pushEditOperations(
    [],
    [{ range: target.getFullModelRange(), text, forceMoveMarkers: true }],
    () => null,
  )
  target.pushStackElement()
}

export function onDocChange(side: Side, listener: (text: string) => void): () => void {
  const subscription = models[side].onDidChangeContent(() => listener(models[side].getValue()))
  return () => subscription.dispose()
}

export function setIndentation(indent: 2 | 4 | 'tab'): void {
  for (const side of ['left', 'right'] as Side[]) {
    models[side].updateOptions({
      tabSize: indent === 'tab' ? 4 : indent,
      insertSpaces: indent !== 'tab',
    })
  }
}
