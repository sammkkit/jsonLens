export type Indent = 2 | 4 | 'tab'

interface Token {
  type: 'punct' | 'string' | 'number' | 'literal'
  text: string
}

export function indentString(indent: Indent): string {
  return indent === 'tab' ? '\t' : ' '.repeat(indent)
}

/**
 * Re-prints JSON from its own token stream rather than via
 * `JSON.parse` + `JSON.stringify`. That keeps number literals exactly as the
 * author wrote them (`1e3`, `1.0`, integers beyond 2^53 all survive) and keeps
 * object keys in source order, which a round-trip through a JS object would
 * silently rewrite for integer-like keys.
 *
 * Assumes `text` is valid JSON — validate with `parseJson` first.
 */
export function printJson(
  text: string,
  options: { indent?: Indent | null; sortKeys?: boolean } = {},
): string {
  const pad = options.indent == null ? '' : indentString(options.indent)
  const sortKeys = options.sortKeys ?? false
  const tokens = tokenize(text)
  let index = 0

  const nl = pad ? '\n' : ''
  const space = pad ? ' ' : ''

  function printValue(level: number): string {
    const token = tokens[index]
    if (!token) return ''
    if (token.type === 'punct' && token.text === '{') return printObject(level)
    if (token.type === 'punct' && token.text === '[') return printArray(level)
    index++
    return token.text
  }

  function printObject(level: number): string {
    index++ // '{'
    const inner = pad.repeat(level + 1)
    const members: { key: string; text: string }[] = []
    while (tokens[index] && tokens[index].text !== '}') {
      if (tokens[index].text === ',') {
        index++
        continue
      }
      const keyToken = tokens[index++]
      index++ // ':'
      const value = printValue(level + 1)
      members.push({ key: keyToken.text, text: `${keyToken.text}:${space}${value}` })
    }
    index++ // '}'
    if (members.length === 0) return '{}'
    if (sortKeys) members.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    const body = members.map((m) => inner + m.text).join(',' + nl)
    return `{${nl}${body}${nl}${pad.repeat(level)}}`
  }

  function printArray(level: number): string {
    index++ // '['
    const inner = pad.repeat(level + 1)
    const items: string[] = []
    while (tokens[index] && tokens[index].text !== ']') {
      if (tokens[index].text === ',') {
        index++
        continue
      }
      items.push(printValue(level + 1))
    }
    index++ // ']'
    if (items.length === 0) return '[]'
    const body = items.map((item) => inner + item).join(',' + nl)
    return `[${nl}${body}${nl}${pad.repeat(level)}]`
  }

  return printValue(0)
}

export function formatJson(text: string, indent: Indent, sortKeys = false): string {
  return printJson(text, { indent, sortKeys })
}

export function minifyJson(text: string, sortKeys = false): string {
  return printJson(text, { indent: null, sortKeys })
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < text.length) {
    const code = text.charCodeAt(i)
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      i++
      continue
    }
    const ch = text[i]
    if (ch === '{' || ch === '}' || ch === '[' || ch === ']' || ch === ':' || ch === ',') {
      tokens.push({ type: 'punct', text: ch })
      i++
      continue
    }
    if (ch === '"') {
      const start = i
      i++
      while (i < text.length) {
        if (text[i] === '\\') {
          i += 2
          continue
        }
        if (text[i] === '"') {
          i++
          break
        }
        i++
      }
      tokens.push({ type: 'string', text: text.slice(start, i) })
      continue
    }
    const start = i
    while (i < text.length && !/[\s{}[\]:,]/.test(text[i])) i++
    if (i === start) i++
    const raw = text.slice(start, i)
    tokens.push({ type: /^[-\d]/.test(raw) ? 'number' : 'literal', text: raw })
  }
  return tokens
}
