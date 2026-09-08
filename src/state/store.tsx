import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react'
import { docText, model, onDocChange, setIndentation, type Side } from '../editor/documents'
import { monaco } from '../editor/monaco'
import { MONACO_THEME, type ThemeName } from '../editor/theme'
import type { Indent } from '../lib/json/format'

export type { Side }
export type Mode = 'landing' | 'edit' | 'diff'
export type Layout = 'split' | 'unified'

export interface Settings {
  theme: ThemeName
  indent: Indent
  layout: Layout
  /** Monaco's "hide unchanged regions" in the diff view. */
  collapseUnchanged: boolean
  wordWrap: boolean
  showChanges: boolean
}

export interface State {
  mode: Mode
  names: Record<Side, string>
  texts: Record<Side, string>
  focus: Side
  settings: Settings
}

export type StoreAction =
  | { type: 'mode'; mode: Mode }
  | { type: 'text'; side: Side; text: string }
  | { type: 'name'; side: Side; name: string }
  | { type: 'focus'; side: Side }
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'swapNames' }

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  indent: 2,
  layout: 'split',
  collapseUnchanged: false,
  wordWrap: false,
  showChanges: true,
}

const STORAGE_KEY = 'jsonlens.session.v1'
const MAX_PERSISTED_BYTES = 512 * 1024

function reducer(state: State, action: StoreAction): State {
  switch (action.type) {
    case 'mode':
      return state.mode === action.mode ? state : { ...state, mode: action.mode }
    case 'text':
      return state.texts[action.side] === action.text
        ? state
        : { ...state, texts: { ...state.texts, [action.side]: action.text } }
    case 'name':
      return { ...state, names: { ...state.names, [action.side]: action.name } }
    case 'focus':
      return state.focus === action.side ? state : { ...state, focus: action.side }
    case 'settings':
      return { ...state, settings: { ...state.settings, ...action.patch } }
    case 'swapNames':
      return { ...state, names: { left: state.names.right, right: state.names.left } }
  }
}

interface Persisted {
  mode: Mode
  names: Record<Side, string>
  texts: Record<Side, string>
  settings: Settings
}

function restore(): Persisted | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw) as Partial<Persisted>
    if (!saved.texts || typeof saved.texts.left !== 'string') return null
    return {
      mode: saved.mode === 'diff' || saved.mode === 'edit' ? saved.mode : 'landing',
      names: {
        left: saved.names?.left ?? 'original.json',
        right: saved.names?.right ?? 'changed.json',
      },
      texts: { left: saved.texts.left, right: saved.texts.right ?? '' },
      settings: { ...DEFAULT_SETTINGS, ...saved.settings },
    }
  } catch {
    return null
  }
}

function initialState(): State {
  const saved = restore()
  if (saved) {
    model('left').setValue(saved.texts.left)
    model('right').setValue(saved.texts.right)
  }
  return {
    mode: saved?.mode ?? 'landing',
    names: saved?.names ?? { left: 'original.json', right: 'changed.json' },
    texts: saved?.texts ?? { left: '', right: '' },
    focus: 'left',
    settings: saved?.settings ?? DEFAULT_SETTINGS,
  }
}

const StateContext = createContext<State | null>(null)
const DispatchContext = createContext<Dispatch<StoreAction> | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)

  // Model text is the source of truth; React state mirrors it for the status
  // bar, the analyzer and persistence.
  useEffect(() => {
    const unsubscribe = (['left', 'right'] as Side[]).map((side) => {
      dispatch({ type: 'text', side, text: docText(side) })
      return onDocChange(side, (text) => dispatch({ type: 'text', side, text }))
    })
    return () => unsubscribe.forEach((off) => off())
  }, [])

  useEffect(() => {
    monaco.editor.setTheme(MONACO_THEME[state.settings.theme])
    document.documentElement.dataset.theme = state.settings.theme
    document.documentElement.style.colorScheme = state.settings.theme
  }, [state.settings.theme])

  useEffect(() => {
    setIndentation(state.settings.indent)
  }, [state.settings.indent])

  useEffect(() => {
    if (state.mode === 'landing') return
    const timer = setTimeout(() => {
      const payload: Persisted = {
        mode: state.mode,
        names: state.names,
        texts: {
          left: state.texts.left.length > MAX_PERSISTED_BYTES ? '' : state.texts.left,
          right: state.texts.right.length > MAX_PERSISTED_BYTES ? '' : state.texts.right,
        },
        settings: state.settings,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Storage full or blocked (private windows): the session simply won't
        // be restored next time.
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [state.mode, state.names, state.texts, state.settings])

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  )
}

export function useAppState(): State {
  const state = useContext(StateContext)
  if (!state) throw new Error('useAppState must be used inside StoreProvider')
  return state
}

export function useDispatch(): Dispatch<StoreAction> {
  const dispatch = useContext(DispatchContext)
  if (!dispatch) throw new Error('useDispatch must be used inside StoreProvider')
  return dispatch
}
