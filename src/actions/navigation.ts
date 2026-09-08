import { revealLine } from '../editor/registry'
import type { Side } from '../editor/documents'
import type { Change } from '../lib/diff/types'
import type { Layout } from '../state/store'

/**
 * Scrolls both panes to a change. Only one side is scrolled explicitly — the
 * diff editor mirrors it — while the other gets a highlight so the eye can find
 * the counterpart line.
 */
export function revealChange(change: Change, layout: Layout): void {
  const primary: Side =
    layout === 'unified' ? 'right' : change.kind === 'removed' ? 'left' : 'right'
  const secondary: Side = primary === 'left' ? 'right' : 'left'
  const primaryLine = primary === 'left' ? change.leftLine : change.rightLine
  const secondaryLine = secondary === 'left' ? change.leftLine : change.rightLine

  if (primaryLine) {
    revealLine(primary, primaryLine)
    if (secondaryLine) revealLine(secondary, secondaryLine, { scroll: false })
  } else if (secondaryLine) {
    revealLine(secondary, secondaryLine)
  }
}
