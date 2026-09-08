import { useMemo } from 'react'
import { docText, setDocText, type Side } from '../editor/documents'
import { revealLine, runEditorCommand } from '../editor/registry'
import { downloadText, pickFile } from '../lib/file'
import { formatJson, minifyJson } from '../lib/json/format'
import { IS_MAC } from '../lib/keys'
import { parseJson } from '../lib/json/parser'
import { NEW_DOCUMENT, SAMPLE_LEFT, SAMPLE_RIGHT } from '../lib/samples'
import { useAnalysisState } from '../state/analysis'
import { useAppState, useDispatch } from '../state/store'
import { useUi } from '../state/ui'
import { revealChange } from './navigation'

export type ActionGroup = 'File' | 'Edit' | 'JSON' | 'View' | 'Compare' | 'Help'

/** Imperative and past-tense wording for the two halves of a transform notice. */
const FORMAT = { verb: 'Format', past: 'Formatted' }
const MINIFY = { verb: 'Minify', past: 'Minified' }
const SORT_KEYS = { verb: 'Sort keys in', past: 'Sorted keys in' }

export interface AppAction {
  id: string
  title: string
  group: ActionGroup
  /** Chord specs; the first is shown as the action's shortcut. */
  keys?: string[]
  run: () => void
  enabled: boolean
  /** Renders a checkmark in menus for toggles and radio choices. */
  checked?: boolean
  detail?: string
  separatorBefore?: boolean
}

export interface ActionSet {
  list: AppAction[]
  byId: Map<string, AppAction>
  run: (id: string) => void
}

export function useActions(): ActionSet {
  const state = useAppState()
  const dispatch = useDispatch()
  const ui = useUi()
  const { changes } = useAnalysisState()

  return useMemo(() => {
    const { mode, focus, names, settings } = state
    const isDiff = mode === 'diff'
    const isLanding = mode === 'landing'
    const target: Side = isDiff ? focus : 'left'
    const editing = !isLanding

    /** Applies a whole-document transform, reporting syntax errors in place. */
    const transform = (
      side: Side,
      fn: (text: string) => string,
      label: { verb: string; past: string },
    ) => {
      const text = docText(side)
      const parsed = parseJson(text, { locations: false })
      if (!parsed.ok) {
        ui.notify({
          kind: 'error',
          text: `Can't ${label.verb.toLowerCase()} ${names[side]}: ${parsed.error.message} (line ${parsed.error.line}, column ${parsed.error.column})`,
          goTo: { side, line: parsed.error.line },
        })
        revealLine(side, parsed.error.line, { focus: true })
        return
      }
      setDocText(side, fn(text))
      ui.notify({ kind: 'info', text: `${label.past} ${names[side]}` })
    }

    const goToChange = (index: number) => {
      if (changes.length === 0) return
      const next = ((index % changes.length) + changes.length) % changes.length
      ui.setChangeIndex(next)
      revealChange(changes[next], settings.layout)
    }

    const openInto = async (side: Side) => {
      const file = await pickFile()
      if (!file) return
      setDocText(side, file.text)
      dispatch({ type: 'name', side, name: file.name })
      dispatch({ type: 'focus', side })
      if (isLanding) dispatch({ type: 'mode', mode: 'edit' })
      const parsed = parseJson(file.text, { locations: false })
      ui.notify(
        parsed.ok
          ? { kind: 'info', text: `Opened ${file.name}` }
          : {
              kind: 'error',
              text: `${file.name}: ${parsed.error.message} (line ${parsed.error.line})`,
              goTo: { side, line: parsed.error.line },
            },
      )
    }

    const startCompare = () => {
      if (docText('right').trim() === '') setDocText('right', docText('left'))
      dispatch({ type: 'mode', mode: 'diff' })
      ui.setChangeIndex(-1)
    }

    const list: AppAction[] = [
      {
        id: 'file.new',
        title: 'New JSON',
        group: 'File',
        keys: ['mod+alt+n'],
        enabled: true,
        run: () => {
          setDocText('left', NEW_DOCUMENT)
          setDocText('right', '')
          dispatch({ type: 'name', side: 'left', name: 'document.json' })
          dispatch({ type: 'name', side: 'right', name: 'changed.json' })
          dispatch({ type: 'focus', side: 'left' })
          dispatch({ type: 'mode', mode: 'edit' })
          ui.setChangeIndex(-1)
          window.setTimeout(() => revealLine('left', 2, { focus: true }), 60)
        },
      },
      {
        id: 'file.open',
        title: isDiff ? 'Open into Original…' : 'Open JSON…',
        group: 'File',
        keys: ['mod+o'],
        enabled: true,
        detail: 'upload file from disk',
        run: () => void openInto(isDiff ? 'left' : target),
      },
      {
        id: 'file.openRight',
        title: 'Open into Changed…',
        group: 'File',
        keys: ['mod+shift+o'],
        enabled: isDiff,
        run: () => void openInto('right'),
      },
      {
        id: 'file.save',
        title: isDiff ? `Download ${focus === 'left' ? 'Original' : 'Changed'}` : 'Download JSON',
        group: 'File',
        keys: ['mod+s'],
        enabled: editing,
        separatorBefore: true,
        detail: 'save export .json',
        run: () => {
          downloadText(names[target], docText(target))
          ui.notify({ kind: 'info', text: `Downloaded ${names[target]}` })
        },
      },
      {
        id: 'file.example',
        title: 'Load Example Comparison',
        group: 'File',
        enabled: true,
        separatorBefore: true,
        detail: 'sample demo',
        run: () => {
          setDocText('left', SAMPLE_LEFT)
          setDocText('right', SAMPLE_RIGHT)
          dispatch({ type: 'name', side: 'left', name: 'original.json' })
          dispatch({ type: 'name', side: 'right', name: 'changed.json' })
          dispatch({ type: 'mode', mode: 'diff' })
          ui.setChangeIndex(-1)
        },
      },

      {
        id: 'edit.undo',
        title: 'Undo',
        group: 'Edit',
        keys: ['mod+z'],
        enabled: editing,
        run: () => runEditorCommand(target, 'undo'),
      },
      {
        id: 'edit.redo',
        title: 'Redo',
        group: 'Edit',
        keys: ['mod+shift+z'],
        enabled: editing,
        run: () => runEditorCommand(target, 'redo'),
      },
      {
        id: 'edit.find',
        title: 'Find',
        group: 'Edit',
        keys: ['mod+f'],
        enabled: editing,
        separatorBefore: true,
        run: () => runEditorCommand(target, 'actions.find'),
      },
      {
        id: 'edit.replace',
        title: 'Replace',
        group: 'Edit',
        // ⌘H is taken by macOS itself (Hide Application) and never reaches the
        // page, so Macs lead with the editor's own ⌥⌘F.
        keys: IS_MAC ? ['mod+alt+f', 'mod+h'] : ['mod+h', 'mod+alt+f'],
        enabled: editing,
        run: () => runEditorCommand(target, 'editor.action.startFindReplaceAction'),
      },
      {
        // Deliberately unbound: the editor's own Go to Line chord already works,
        // and claiming ⌘G here would shadow Find Next.
        id: 'edit.gotoLine',
        title: 'Go to Line…',
        group: 'Edit',
        enabled: editing,
        run: () => runEditorCommand(target, 'editor.action.gotoLine'),
      },
      {
        id: 'edit.selectAll',
        title: 'Select All',
        group: 'Edit',
        keys: ['mod+a'],
        enabled: editing,
        separatorBefore: true,
        run: () => runEditorCommand(target, 'editor.action.selectAll'),
      },
      {
        id: 'edit.copyAll',
        title: 'Copy Document to Clipboard',
        group: 'Edit',
        enabled: editing,
        run: () => {
          navigator.clipboard.writeText(docText(target)).then(
            () => ui.notify({ kind: 'info', text: `Copied ${names[target]} to clipboard` }),
            () => ui.notify({ kind: 'error', text: 'Clipboard access was blocked by the browser' }),
          )
        },
      },

      {
        id: 'json.format',
        title: 'Format JSON',
        group: 'JSON',
        keys: ['mod+shift+f'],
        enabled: editing,
        detail: 'prettify beautify indent',
        run: () => transform(target, (text) => formatJson(text, settings.indent), FORMAT),
      },
      {
        id: 'json.minify',
        title: 'Minify JSON',
        group: 'JSON',
        keys: ['mod+shift+m'],
        enabled: editing,
        detail: 'compact collapse whitespace',
        run: () => transform(target, (text) => minifyJson(text), MINIFY),
      },
      {
        id: 'json.sortKeys',
        title: 'Sort Keys A→Z',
        group: 'JSON',
        enabled: editing,
        detail: 'normalize order alphabetical',
        run: () => transform(target, (text) => formatJson(text, settings.indent, true), SORT_KEYS),
      },
      {
        id: 'json.foldAll',
        title: 'Fold All',
        group: 'JSON',
        keys: ['mod+alt+['],
        enabled: editing,
        separatorBefore: true,
        detail: 'collapse everything',
        run: () => runEditorCommand(target, 'editor.foldAll'),
      },
      {
        id: 'json.unfoldAll',
        title: 'Unfold All',
        group: 'JSON',
        keys: ['mod+alt+]'],
        enabled: editing,
        detail: 'expand everything',
        run: () => runEditorCommand(target, 'editor.unfoldAll'),
      },
      {
        id: 'json.fold',
        title: 'Fold at Cursor',
        group: 'JSON',
        keys: ['mod+shift+['],
        enabled: editing,
        run: () => runEditorCommand(target, 'editor.fold'),
      },
      {
        id: 'json.unfold',
        title: 'Unfold at Cursor',
        group: 'JSON',
        keys: ['mod+shift+]'],
        enabled: editing,
        run: () => runEditorCommand(target, 'editor.unfold'),
      },

      {
        id: 'compare.start',
        title: 'Compare JSON',
        group: 'Compare',
        keys: ['mod+alt+d'],
        enabled: !isDiff,
        detail: 'diff side by side',
        run: startCompare,
      },
      {
        id: 'compare.close',
        title: 'Close Comparison',
        group: 'Compare',
        keys: ['mod+alt+d'],
        enabled: isDiff,
        run: () => {
          dispatch({ type: 'mode', mode: 'edit' })
          dispatch({ type: 'focus', side: 'left' })
        },
      },
      {
        id: 'compare.next',
        title: 'Next Difference',
        group: 'Compare',
        keys: ['alt+arrowdown'],
        enabled: isDiff && changes.length > 0,
        separatorBefore: true,
        run: () => goToChange(ui.changeIndex + 1),
      },
      {
        id: 'compare.prev',
        title: 'Previous Difference',
        group: 'Compare',
        keys: ['alt+arrowup'],
        enabled: isDiff && changes.length > 0,
        run: () => goToChange(ui.changeIndex <= 0 ? changes.length - 1 : ui.changeIndex - 1),
      },
      {
        id: 'compare.swap',
        title: 'Swap Sides',
        group: 'Compare',
        keys: ['mod+alt+s'],
        enabled: isDiff,
        separatorBefore: true,
        run: () => {
          const left = docText('left')
          setDocText('left', docText('right'))
          setDocText('right', left)
          dispatch({ type: 'swapNames' })
          ui.setChangeIndex(-1)
        },
      },
      {
        // The structural diff already ignores layout and key order, but the
        // side-by-side text diff cannot. These two rewrite both documents into
        // the same shape so the visual diff shows only real changes.
        id: 'compare.formatBoth',
        title: 'Format Both Documents',
        group: 'Compare',
        enabled: isDiff,
        detail: 'normalize whitespace indentation noise',
        run: () => {
          transform('left', (text) => formatJson(text, settings.indent), FORMAT)
          transform('right', (text) => formatJson(text, settings.indent), FORMAT)
        },
      },
      {
        id: 'compare.normalize',
        title: 'Sort Keys in Both Documents',
        group: 'Compare',
        enabled: isDiff,
        detail: 'ignore key order normalize',
        run: () => {
          transform('left', (text) => formatJson(text, settings.indent, true), SORT_KEYS)
          transform('right', (text) => formatJson(text, settings.indent, true), SORT_KEYS)
        },
      },

      {
        id: 'view.layout',
        title: settings.layout === 'split' ? 'Switch to Unified Diff' : 'Switch to Side-by-Side Diff',
        group: 'View',
        keys: ['mod+alt+l'],
        enabled: isDiff,
        detail: 'toggle diff layout inline',
        run: () =>
          dispatch({
            type: 'settings',
            patch: { layout: settings.layout === 'split' ? 'unified' : 'split' },
          }),
      },
      {
        id: 'view.changes',
        title: 'Changes Panel',
        group: 'View',
        keys: ['mod+alt+c'],
        enabled: isDiff,
        checked: settings.showChanges,
        run: () => dispatch({ type: 'settings', patch: { showChanges: !settings.showChanges } }),
      },
      {
        id: 'view.collapseUnchanged',
        title: 'Collapse Unchanged Regions',
        group: 'View',
        enabled: isDiff,
        checked: settings.collapseUnchanged,
        detail: 'hide identical lines',
        run: () =>
          dispatch({
            type: 'settings',
            patch: { collapseUnchanged: !settings.collapseUnchanged },
          }),
      },
      {
        id: 'view.wordWrap',
        title: 'Word Wrap',
        group: 'View',
        keys: ['alt+z'],
        enabled: editing,
        checked: settings.wordWrap,
        separatorBefore: true,
        run: () => dispatch({ type: 'settings', patch: { wordWrap: !settings.wordWrap } }),
      },
      {
        id: 'view.theme',
        title: settings.theme === 'dark' ? 'Light Theme' : 'Dark Theme',
        group: 'View',
        keys: ['mod+alt+t'],
        enabled: true,
        detail: 'toggle appearance',
        run: () =>
          dispatch({
            type: 'settings',
            patch: { theme: settings.theme === 'dark' ? 'light' : 'dark' },
          }),
      },
      {
        id: 'view.indent2',
        title: 'Indent: 2 Spaces',
        group: 'View',
        enabled: true,
        checked: settings.indent === 2,
        separatorBefore: true,
        run: () => dispatch({ type: 'settings', patch: { indent: 2 } }),
      },
      {
        id: 'view.indent4',
        title: 'Indent: 4 Spaces',
        group: 'View',
        enabled: true,
        checked: settings.indent === 4,
        run: () => dispatch({ type: 'settings', patch: { indent: 4 } }),
      },
      {
        id: 'view.indentTab',
        title: 'Indent: Tabs',
        group: 'View',
        enabled: true,
        checked: settings.indent === 'tab',
        run: () => dispatch({ type: 'settings', patch: { indent: 'tab' } }),
      },

      {
        id: 'help.palette',
        title: 'Find Action…',
        group: 'Help',
        keys: ['mod+shift+a', 'mod+shift+p'],
        enabled: true,
        detail: 'command palette search',
        run: () => ui.setOverlay('palette'),
      },
      {
        id: 'help.shortcuts',
        title: 'Keyboard Shortcuts',
        group: 'Help',
        keys: ['mod+/'],
        enabled: true,
        run: () => ui.setOverlay(ui.overlay === 'shortcuts' ? null : 'shortcuts'),
      },
    ]

    const byId = new Map(list.map((action) => [action.id, action]))
    return {
      list,
      byId,
      run: (id: string) => {
        const action = byId.get(id)
        if (action?.enabled) action.run()
      },
    }
  }, [state, dispatch, ui, changes])
}
