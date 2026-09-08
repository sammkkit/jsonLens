import type { PathSeg } from '../json/path'

export type ChangeKind = 'added' | 'removed' | 'modified' | 'type'

export interface Change {
  kind: ChangeKind
  /** Display path, e.g. `user.age`. */
  label: string
  /** Canonical path keys used to look the node up in each document's index. */
  leftKey?: string
  rightKey?: string
  leftPath?: PathSeg[]
  rightPath?: PathSeg[]
  /** Short renderings of the two values, ready for display. */
  left?: string
  right?: string
  leftType?: string
  rightType?: string
  /** 1-based source lines, resolved against each document's parse index. */
  leftLine?: number
  rightLine?: number
}

export interface DiffSummary {
  total: number
  added: number
  removed: number
  modified: number
}

export function summarize(changes: Change[]): DiffSummary {
  let added = 0
  let removed = 0
  let modified = 0
  for (const change of changes) {
    if (change.kind === 'added') added++
    else if (change.kind === 'removed') removed++
    else modified++
  }
  return { total: changes.length, added, removed, modified }
}
