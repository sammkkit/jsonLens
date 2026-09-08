import type { JsonValue } from '../json/parser'
import { pathKey, pathLabel, type PathSeg } from '../json/path'
import type { Change } from './types'

/**
 * Ceiling on reported changes. Two wholly unrelated megabyte documents can
 * differ in millions of places; past this point the list stops being something
 * a person reads, and the UI says so rather than freezing.
 */
export const MAX_CHANGES = 20000
const MAX_LCS_CELLS = 1_000_000
const PREVIEW_LENGTH = 60

type JsonType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object'

export function typeOf(value: JsonValue): JsonType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'boolean' || t === 'number' || t === 'string') return t
  return 'object'
}

/**
 * Structural diff: compares JSON by value, not by text. Object key order is
 * irrelevant, arrays are aligned with an LCS so an insertion doesn't report
 * every following element as modified, and each change carries the path it
 * lives at on both sides so the UI can jump to it in either document.
 */
export function diffJson(left: JsonValue, right: JsonValue): Change[] {
  const changes: Change[] = []
  const hashes = new WeakMap<object, string>()

  function truncated(): boolean {
    return changes.length >= MAX_CHANGES
  }

  function push(change: Change): void {
    if (!truncated()) changes.push(change)
  }

  function walk(leftPath: PathSeg[], rightPath: PathSeg[], a: JsonValue, b: JsonValue): void {
    if (truncated()) return
    const ta = typeOf(a)
    const tb = typeOf(b)

    if (ta !== tb) {
      push(makeChange('type', leftPath, rightPath, a, b))
      return
    }

    if (ta === 'object') {
      const objA = a as Record<string, JsonValue>
      const objB = b as Record<string, JsonValue>
      if (hash(a) === hash(b)) return
      for (const key of Object.keys(objA)) {
        if (Object.hasOwn(objB, key)) {
          walk([...leftPath, key], [...rightPath, key], objA[key], objB[key])
        } else {
          push(makeChange('removed', [...leftPath, key], undefined, objA[key], undefined))
        }
      }
      for (const key of Object.keys(objB)) {
        if (!Object.hasOwn(objA, key)) {
          push(makeChange('added', undefined, [...rightPath, key], undefined, objB[key]))
        }
      }
      return
    }

    if (ta === 'array') {
      const arrA = a as JsonValue[]
      const arrB = b as JsonValue[]
      if (hash(a) === hash(b)) return
      diffArrays(leftPath, rightPath, arrA, arrB)
      return
    }

    if (a !== b) push(makeChange('modified', leftPath, rightPath, a, b))
  }

  function diffArrays(
    leftPath: PathSeg[],
    rightPath: PathSeg[],
    a: JsonValue[],
    b: JsonValue[],
  ): void {
    const pairs = align(a, b)
    for (const [i, j] of pairs) {
      if (truncated()) return
      if (i >= 0 && j >= 0) {
        walk([...leftPath, i], [...rightPath, j], a[i], b[j])
      } else if (i >= 0) {
        push(makeChange('removed', [...leftPath, i], undefined, a[i], undefined))
      } else {
        push(makeChange('added', undefined, [...rightPath, j], undefined, b[j]))
      }
    }
  }

  /**
   * Aligns two arrays into (leftIndex, rightIndex) pairs; -1 means "absent on
   * that side". Equal elements are matched by an LCS, and elements inside the
   * gaps between matches are paired positionally so an edited element reads as
   * one modification instead of a delete plus an add.
   */
  function align(a: JsonValue[], b: JsonValue[]): [number, number][] {
    const ha = a.map(hash)
    const hb = b.map(hash)
    const pairs: [number, number][] = []

    const matches: [number, number][] =
      a.length * b.length > MAX_LCS_CELLS ? [] : lcs(ha, hb)

    let i = 0
    let j = 0
    const flushGap = (endI: number, endJ: number) => {
      while (i < endI && j < endJ) pairs.push([i++, j++])
      while (i < endI) pairs.push([i++, -1])
      while (j < endJ) pairs.push([-1, j++])
    }
    for (const [mi, mj] of matches) {
      flushGap(mi, mj)
      pairs.push([i++, j++])
    }
    flushGap(a.length, b.length)
    return pairs
  }

  function hash(value: JsonValue): string {
    if (value === null || typeof value !== 'object') return canonical(value)
    const cached = hashes.get(value)
    if (cached !== undefined) return cached
    const computed = canonical(value)
    hashes.set(value, computed)
    return computed
  }

  function canonical(value: JsonValue): string {
    if (value === null) return 'null'
    if (Array.isArray(value)) return '[' + value.map(hash).join(',') + ']'
    if (typeof value === 'object') {
      const keys = Object.keys(value).sort()
      return (
        '{' +
        keys.map((k) => JSON.stringify(k) + ':' + hash((value as Record<string, JsonValue>)[k])).join(',') +
        '}'
      )
    }
    return JSON.stringify(value) ?? 'null'
  }

  walk([], [], left, right)
  return changes
}

function makeChange(
  kind: Change['kind'],
  leftPath: PathSeg[] | undefined,
  rightPath: PathSeg[] | undefined,
  left: JsonValue | undefined,
  right: JsonValue | undefined,
): Change {
  const displayPath = rightPath ?? leftPath ?? []
  return {
    kind,
    label: pathLabel(displayPath),
    leftPath,
    rightPath,
    leftKey: leftPath ? pathKey(leftPath) : undefined,
    rightKey: rightPath ? pathKey(rightPath) : undefined,
    left: left === undefined ? undefined : preview(left),
    right: right === undefined ? undefined : preview(right),
    leftType: left === undefined ? undefined : typeOf(left),
    rightType: right === undefined ? undefined : typeOf(right),
  }
}

/** Compact, human-sized rendering of a value for the changes panel. */
export function preview(value: JsonValue): string {
  if (Array.isArray(value)) {
    return value.length === 0 ? '[]' : `[${value.length} item${value.length === 1 ? '' : 's'}]`
  }
  if (value !== null && typeof value === 'object') {
    const size = Object.keys(value).length
    return size === 0 ? '{}' : `{${size} key${size === 1 ? '' : 's'}}`
  }
  const text = JSON.stringify(value) ?? 'null'
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH - 1) + '…' : text
}

/** Longest common subsequence over element hashes, returned as index pairs. */
function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length
  const m = b.length
  if (n === 0 || m === 0) return []
  const table = new Uint32Array((n + 1) * (m + 1))
  const width = m + 1
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1])
    }
  }
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pairs.push([i, j])
      i++
      j++
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      i++
    } else {
      j++
    }
  }
  return pairs
}
