import { diffJson, MAX_CHANGES } from './diff/engine'
import type { Change } from './diff/types'
import { parseJson, type ParseError } from './json/parser'

export interface DocReport {
  valid: boolean
  error?: ParseError
  lines: number
  bytes: number
  /** Number of nodes, useful as a rough size signal. */
  nodes: number
}

export interface AnalysisResult {
  left: DocReport
  right?: DocReport
  changes?: Change[]
  /** True when the change list hit `MAX_CHANGES` and is incomplete. */
  truncated?: boolean
}

export interface AnalysisRequest {
  id: number
  left: string
  right: string | null
}

export interface AnalysisResponse extends AnalysisResult {
  id: number
}

/**
 * Runs on the worker thread (and, as a fallback, inline). Parses each document
 * once, diffs them structurally, and resolves every change to a source line so
 * the UI never has to re-parse.
 */
export function analyze(request: AnalysisRequest): AnalysisResponse {
  const leftParse = parseJson(request.left)
  const left: DocReport = {
    valid: leftParse.ok,
    error: leftParse.ok ? undefined : leftParse.error,
    lines: countLines(request.left),
    bytes: byteLength(request.left),
    nodes: leftParse.ok ? leftParse.locs.size : 0,
  }

  if (request.right === null) return { id: request.id, left }

  const rightParse = parseJson(request.right)
  const right: DocReport = {
    valid: rightParse.ok,
    error: rightParse.ok ? undefined : rightParse.error,
    lines: countLines(request.right),
    bytes: byteLength(request.right),
    nodes: rightParse.ok ? rightParse.locs.size : 0,
  }

  if (!leftParse.ok || !rightParse.ok) return { id: request.id, left, right }

  const changes = diffJson(leftParse.value, rightParse.value)
  for (const change of changes) {
    if (change.leftKey) change.leftLine = leftParse.locs.get(change.leftKey)?.line
    if (change.rightKey) change.rightLine = rightParse.locs.get(change.rightKey)?.line
    // Anchor added/removed entries on the other side at their parent, so both
    // editors still scroll to a sensible place.
    if (change.leftLine === undefined && change.rightPath) {
      change.leftLine = nearestAncestorLine(leftParse.locs, change.rightPath)
    }
    if (change.rightLine === undefined && change.leftPath) {
      change.rightLine = nearestAncestorLine(rightParse.locs, change.leftPath)
    }
  }

  return { id: request.id, left, right, changes, truncated: changes.length >= MAX_CHANGES }
}

function nearestAncestorLine(
  locs: Map<string, { line: number }>,
  path: (string | number)[],
): number | undefined {
  for (let end = path.length - 1; end >= 0; end--) {
    let key = '$'
    for (let i = 0; i < end; i++) {
      const seg = path[i]
      key += typeof seg === 'number' ? '#' + seg : '.' + seg
    }
    const hit = locs.get(key)
    if (hit) return hit.line
  }
  return undefined
}

function countLines(text: string): number {
  if (text.length === 0) return 1
  let lines = 1
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) lines++
  }
  return lines
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length
}
