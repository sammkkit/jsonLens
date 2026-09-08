// Local Monaco bootstrap. Everything — the editor, its workers, the JSON
// language service — is bundled and served from this origin, so the app never
// makes a network request and the user's JSON never leaves the browser.
import './monaco.core'
import { jsonDefaults } from 'monaco-editor/esm/vs/language/json/monaco.contribution'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import { MONACO_THEME, THEME_DATA, type ThemeName } from './theme'

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment
  }
}

window.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    return label === 'json' ? new JsonWorker() : new EditorWorker()
  },
}

jsonDefaults.setDiagnosticsOptions({
  validate: true,
  // Strict JSON: comments and trailing commas are errors, matching our parser.
  allowComments: false,
  comments: 'error',
  trailingCommas: 'error',
  schemas: [],
  // No schema fetching: the app must never talk to the network.
  enableSchemaRequest: false,
})

for (const name of ['dark', 'light'] as ThemeName[]) {
  monaco.editor.defineTheme(MONACO_THEME[name], THEME_DATA[name])
}

export const EDITOR_FONT =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace"

export const BASE_EDITOR_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
  fontFamily: EDITOR_FONT,
  fontSize: 13,
  lineHeight: 20,
  letterSpacing: 0.2,
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  scrollBeyondLastColumn: 4,
  renderLineHighlight: 'all',
  lineNumbersMinChars: 4,
  lineDecorationsWidth: 8,
  glyphMargin: false,
  folding: true,
  foldingHighlight: true,
  showFoldingControls: 'always',
  matchBrackets: 'always',
  // A single calm accent reads better on JSON than rainbow bracket pairs.
  bracketPairColorization: { enabled: false },
  guides: { indentation: true, highlightActiveIndentation: true, bracketPairs: false },
  stickyScroll: { enabled: true, maxLineCount: 4 },
  smoothScrolling: false,
  cursorBlinking: 'smooth',
  cursorSurroundingLines: 2,
  roundedSelection: false,
  wordWrap: 'off',
  tabSize: 2,
  insertSpaces: true,
  renderWhitespace: 'selection',
  // Without a schema there is nothing worth suggesting; popups would just fight
  // the user's typing.
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  overviewRulerBorder: false,
  fixedOverflowWidgets: true,
  padding: { top: 10, bottom: 24 },
  scrollbar: {
    verticalScrollbarSize: 11,
    horizontalScrollbarSize: 11,
    useShadows: false,
    alwaysConsumeMouseWheel: false,
  },
  unicodeHighlight: { ambiguousCharacters: false, invisibleCharacters: false },
}

export { monaco }
export type Monaco = typeof monaco
export type CodeEditor = monaco.editor.IStandaloneCodeEditor
export type DiffEditor = monaco.editor.IStandaloneDiffEditor
