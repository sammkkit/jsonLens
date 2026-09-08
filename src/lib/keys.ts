import type { Monaco } from '../editor/monaco'

export const IS_MAC =
  typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)

export interface Chord {
  mod: boolean
  shift: boolean
  alt: boolean
  key: string
}

/**
 * Chords are written once, as `mod+shift+f`, and reused three ways: matched
 * against DOM events, converted into Monaco keybindings, and rendered for the
 * menus and the shortcut sheet. `mod` is Cmd on macOS and Ctrl elsewhere.
 */
export function parseChord(spec: string): Chord {
  const parts = spec.toLowerCase().split('+')
  const key = parts[parts.length - 1]
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key,
  }
}

export function matchesEvent(spec: string, event: KeyboardEvent, isMac = IS_MAC): boolean {
  const chord = parseChord(spec)
  const mod = isMac ? event.metaKey : event.ctrlKey
  const otherMod = isMac ? event.ctrlKey : event.metaKey
  if (mod !== chord.mod || otherMod) return false
  if (event.shiftKey !== chord.shift) return false
  if (event.altKey !== chord.alt) return false
  return keyCandidates(event).has(chord.key)
}

/**
 * Modifiers rewrite `event.key`: Alt+Z is "Ω" on macOS and Shift+[ is "{"
 * everywhere. So match against the typed character *and* the physical key
 * position, and accept either.
 */
function keyCandidates(event: KeyboardEvent): Set<string> {
  const candidates = new Set([event.key.toLowerCase()])
  const code = event.code
  if (/^Key[A-Z]$/.test(code)) candidates.add(code.slice(3).toLowerCase())
  else if (/^Digit\d$/.test(code)) candidates.add(code.slice(5))
  else if (code === 'BracketLeft') candidates.add('[')
  else if (code === 'BracketRight') candidates.add(']')
  else if (code === 'Slash') candidates.add('/')
  else if (code === 'Backslash') candidates.add('\\')
  return candidates
}

const DISPLAY_KEYS: Record<string, string> = {
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  enter: '⏎',
  escape: 'Esc',
  backspace: '⌫',
  ' ': 'Space',
}

export function displayChord(spec: string, isMac = IS_MAC): string {
  const chord = parseChord(spec)
  const key = DISPLAY_KEYS[chord.key] ?? chord.key.toUpperCase()
  if (isMac) {
    return `${chord.mod ? '⌘' : ''}${chord.alt ? '⌥' : ''}${chord.shift ? '⇧' : ''}${key}`
  }
  const parts: string[] = []
  if (chord.mod) parts.push('Ctrl')
  if (chord.alt) parts.push('Alt')
  if (chord.shift) parts.push('Shift')
  parts.push(key)
  return parts.join('+')
}

const MONACO_KEYS: Record<string, string> = {
  arrowup: 'UpArrow',
  arrowdown: 'DownArrow',
  arrowleft: 'LeftArrow',
  arrowright: 'RightArrow',
  '[': 'BracketLeft',
  ']': 'BracketRight',
  '/': 'Slash',
  ',': 'Comma',
  '.': 'Period',
  ';': 'Semicolon',
  "'": 'Quote',
  '\\': 'Backslash',
  enter: 'Enter',
  escape: 'Escape',
}

/** Translates a chord into a Monaco keybinding, or null if it has no mapping. */
export function toMonacoKeybinding(spec: string, monaco: Monaco): number | null {
  const chord = parseChord(spec)
  const codes = monaco.KeyCode as unknown as Record<string, number>
  let name: string | undefined
  if (/^[a-z]$/.test(chord.key)) name = `Key${chord.key.toUpperCase()}`
  else if (/^\d$/.test(chord.key)) name = `Digit${chord.key}`
  else name = MONACO_KEYS[chord.key]
  if (!name || codes[name] === undefined) return null

  let binding = codes[name]
  if (chord.mod) binding |= monaco.KeyMod.CtrlCmd
  if (chord.shift) binding |= monaco.KeyMod.Shift
  if (chord.alt) binding |= monaco.KeyMod.Alt
  return binding
}
