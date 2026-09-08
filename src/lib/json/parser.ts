import { pathKey, type PathSeg } from './path'

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface NodeLoc {
  /** 1-based line of the member key (or of the value itself for roots/array items). */
  line: number
  /** 1-based column of the same token. */
  column: number
  /** 1-based line on which the value ends. */
  endLine: number
}

export interface ParseError {
  message: string
  line: number
  column: number
  offset: number
}

export type ParseResult =
  | { ok: true; value: JsonValue; locs: Map<string, NodeLoc> }
  | { ok: false; error: ParseError }

export interface ParseOptions {
  /** Skip building the path index (saves memory on very large documents). */
  locations?: boolean
}

const MAX_DEPTH = 2000
const NUMBER_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const ESCAPES: Record<string, string> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
}

class SyntaxErrorAt extends Error {
  offset: number

  constructor(message: string, offset: number) {
    super(message)
    this.offset = offset
  }
}

/**
 * Recursive-descent JSON parser that reports precise error positions and,
 * optionally, the source location of every node keyed by its path. One pass
 * feeds validation, the changes panel's jump-to-line, and the diff engine.
 */
export function parseJson(text: string, options: ParseOptions = {}): ParseResult {
  const withLocs = options.locations !== false
  const lineStarts = computeLineStarts(text)
  const locs = new Map<string, NodeLoc>()
  let pos = 0

  const at = (offset: number) => positionAt(lineStarts, offset)

  function skipWs(): void {
    while (pos < text.length) {
      const c = text.charCodeAt(pos)
      // space, tab, LF, CR
      if (c === 32 || c === 9 || c === 10 || c === 13) pos++
      else break
    }
  }

  function fail(message: string, offset = pos): never {
    throw new SyntaxErrorAt(message, Math.min(offset, text.length))
  }

  function expect(ch: string, message: string): void {
    if (text[pos] !== ch) fail(message)
    pos++
  }

  function parseString(): string {
    const start = pos
    pos++ // opening quote
    let out = ''
    let chunk = pos
    for (;;) {
      if (pos >= text.length) fail('Unterminated string', start)
      const ch = text[pos]
      if (ch === '"') {
        out += text.slice(chunk, pos)
        pos++
        return out
      }
      if (ch === '\\') {
        out += text.slice(chunk, pos)
        pos++
        const esc = text[pos]
        if (esc === undefined) fail('Unterminated string', start)
        if (esc === 'u') {
          const hex = text.slice(pos + 1, pos + 5)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('Invalid unicode escape sequence', pos - 1)
          out += String.fromCharCode(parseInt(hex, 16))
          pos += 5
        } else if (esc in ESCAPES) {
          out += ESCAPES[esc]
          pos++
        } else {
          fail(`Invalid escape sequence "\\${esc}"`, pos - 1)
        }
        chunk = pos
        continue
      }
      if (ch.charCodeAt(0) < 0x20) {
        fail('Control character must be escaped inside a string')
      }
      pos++
    }
  }

  function parseValue(path: PathSeg[], depth: number, tokenStart: number): JsonValue {
    if (depth > MAX_DEPTH) fail('Maximum nesting depth exceeded')
    skipWs()
    const valueStart = pos
    const ch = text[pos]
    let value: JsonValue

    if (ch === undefined) fail('Unexpected end of input')
    else if (ch === '{') value = parseObject(path, depth)
    else if (ch === '[') value = parseArray(path, depth)
    else if (ch === '"') value = parseString()
    else if (ch === 't') value = parseLiteral('true', true)
    else if (ch === 'f') value = parseLiteral('false', false)
    else if (ch === 'n') value = parseLiteral('null', null)
    else if (ch === '-' || (ch >= '0' && ch <= '9')) value = parseNumber()
    else fail(`Unexpected token "${ch}"`, valueStart)

    if (withLocs) {
      const head = at(tokenStart >= 0 ? tokenStart : valueStart)
      locs.set(pathKey(path), {
        line: head.line,
        column: head.column,
        endLine: at(pos - 1).line,
      })
    }
    return value
  }

  function parseLiteral<T>(word: string, value: T): T {
    if (text.startsWith(word, pos)) {
      pos += word.length
      return value
    }
    return fail(`Unexpected token "${text[pos]}"`)
  }

  function parseNumber(): number {
    NUMBER_RE.lastIndex = pos
    const match = NUMBER_RE.exec(text)
    if (!match || match.index !== pos) fail('Invalid number')
    pos += match![0].length
    return Number(match![0])
  }

  function parseObject(path: PathSeg[], depth: number): { [key: string]: JsonValue } {
    pos++ // '{'
    const obj: { [key: string]: JsonValue } = {}
    skipWs()
    if (text[pos] === '}') {
      pos++
      return obj
    }
    for (;;) {
      skipWs()
      const keyStart = pos
      if (text[pos] !== '"') fail('Expected a double-quoted property name')
      const key = parseString()
      skipWs()
      expect(':', 'Expected ":" after property name')
      path.push(key)
      obj[key] = parseValue(path, depth + 1, keyStart)
      path.pop()
      skipWs()
      const next = text[pos]
      if (next === ',') {
        pos++
        skipWs()
        if (text[pos] === '}') fail('Trailing comma is not allowed in JSON')
        continue
      }
      if (next === '}') {
        pos++
        return obj
      }
      fail(next === undefined ? 'Unexpected end of input' : 'Expected "," or "}" in object')
    }
  }

  function parseArray(path: PathSeg[], depth: number): JsonValue[] {
    pos++ // '['
    const arr: JsonValue[] = []
    skipWs()
    if (text[pos] === ']') {
      pos++
      return arr
    }
    for (;;) {
      path.push(arr.length)
      arr.push(parseValue(path, depth + 1, -1))
      path.pop()
      skipWs()
      const next = text[pos]
      if (next === ',') {
        pos++
        skipWs()
        if (text[pos] === ']') fail('Trailing comma is not allowed in JSON')
        continue
      }
      if (next === ']') {
        pos++
        return arr
      }
      fail(next === undefined ? 'Unexpected end of input' : 'Expected "," or "]" in array')
    }
  }

  try {
    skipWs()
    if (pos >= text.length) {
      return {
        ok: false,
        error: { message: 'Empty document', line: 1, column: 1, offset: 0 },
      }
    }
    const value = parseValue([], 0, -1)
    skipWs()
    if (pos < text.length) fail('Unexpected content after the end of the JSON value')
    return { ok: true, value, locs }
  } catch (err) {
    if (err instanceof SyntaxErrorAt) {
      const { line, column } = at(err.offset)
      return { ok: false, error: { message: err.message, line, column, offset: err.offset } }
    }
    throw err
  }
}

function computeLineStarts(text: string): number[] {
  const starts = [0]
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) starts.push(i + 1)
  }
  return starts
}

/** Binary-search an offset into a 1-based line/column pair. */
function positionAt(lineStarts: number[], offset: number): { line: number; column: number } {
  let lo = 0
  let hi = lineStarts.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (lineStarts[mid] <= offset) lo = mid
    else hi = mid - 1
  }
  return { line: lo + 1, column: offset - lineStarts[lo] + 1 }
}
