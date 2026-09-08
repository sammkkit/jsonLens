import { describe, expect, it } from 'vitest'
import { displayChord, matchesEvent, parseChord } from './keys'

/** Minimal stand-in for the fields matchesEvent reads. */
function event(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...init,
  } as KeyboardEvent
}

describe('parseChord', () => {
  it('splits modifiers from the key', () => {
    expect(parseChord('mod+shift+f')).toEqual({ mod: true, shift: true, alt: false, key: 'f' })
    expect(parseChord('alt+arrowdown')).toEqual({
      mod: false,
      shift: false,
      alt: true,
      key: 'arrowdown',
    })
  })
})

describe('matchesEvent', () => {
  // The platform is passed explicitly so these assertions don't depend on the
  // machine the tests happen to run on. `mod` is Ctrl off Mac, Cmd on it.
  it('matches an exact modifier combination', () => {
    expect(matchesEvent('mod+s', event({ key: 's', code: 'KeyS', ctrlKey: true }), false)).toBe(true)
    expect(matchesEvent('mod+s', event({ key: 's', code: 'KeyS' }), false)).toBe(false)
    expect(matchesEvent('mod+s', event({ key: 's', code: 'KeyS', metaKey: true }), true)).toBe(true)
  })

  it('rejects extra modifiers', () => {
    expect(
      matchesEvent('mod+z', event({ key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true }), false),
    ).toBe(false)
    expect(
      matchesEvent(
        'mod+shift+z',
        event({ key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe(true)
  })

  it('rejects the opposite platform modifier', () => {
    expect(matchesEvent('mod+s', event({ key: 's', code: 'KeyS', metaKey: true }), false)).toBe(
      false,
    )
    expect(matchesEvent('mod+s', event({ key: 's', code: 'KeyS', ctrlKey: true }), true)).toBe(false)
  })

  it('matches bracket chords by physical key, since Shift rewrites the character', () => {
    // Shift+[ arrives as "{" — the chord still has to match.
    expect(
      matchesEvent(
        'mod+shift+[',
        event({ key: '{', code: 'BracketLeft', ctrlKey: true, shiftKey: true }),
        false,
      ),
    ).toBe(true)
  })

  it('matches Alt chords despite composed characters', () => {
    // macOS turns Alt+Z into "Ω".
    expect(matchesEvent('alt+z', event({ key: 'Ω', code: 'KeyZ', altKey: true }), true)).toBe(true)
  })

  it('matches arrow keys', () => {
    expect(
      matchesEvent(
        'alt+arrowdown',
        event({ key: 'ArrowDown', code: 'ArrowDown', altKey: true }),
        false,
      ),
    ).toBe(true)
    expect(
      matchesEvent('alt+arrowdown', event({ key: 'ArrowUp', code: 'ArrowUp', altKey: true }), false),
    ).toBe(false)
  })
})

describe('displayChord', () => {
  it('renders Windows and Linux labels', () => {
    expect(displayChord('mod+shift+f', false)).toBe('Ctrl+Shift+F')
    expect(displayChord('alt+arrowdown', false)).toBe('Alt+↓')
    expect(displayChord('mod+alt+[', false)).toBe('Ctrl+Alt+[')
  })

  it('renders macOS symbols', () => {
    expect(displayChord('mod+shift+f', true)).toBe('⌘⇧F')
    expect(displayChord('mod+alt+[', true)).toBe('⌘⌥[')
    expect(displayChord('alt+arrowdown', true)).toBe('⌥↓')
  })
})
