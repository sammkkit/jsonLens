export interface CursorInfo {
  line: number
  column: number
  /** Characters currently selected, for the status bar. */
  selected: number
}

/**
 * Caret position lives outside React: it changes on every keystroke and only
 * the status bar cares, so an external store keeps the editor tree from
 * re-rendering.
 */
let snapshot: CursorInfo = { line: 1, column: 1, selected: 0 }
const listeners = new Set<() => void>()

export function getCursor(): CursorInfo {
  return snapshot
}

export function setCursor(next: CursorInfo): void {
  if (
    next.line === snapshot.line &&
    next.column === snapshot.column &&
    next.selected === snapshot.selected
  ) {
    return
  }
  snapshot = next
  for (const listener of listeners) listener()
}

export function subscribeCursor(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
