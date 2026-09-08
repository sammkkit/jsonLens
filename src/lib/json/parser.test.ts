import { describe, expect, it } from 'vitest'
import { parseJson } from './parser'
import { pathKey } from './path'

/** Parses and returns the value, failing loudly if the document was invalid. */
function value(text: string) {
  const result = parseJson(text)
  if (!result.ok) throw new Error(`expected valid JSON, got: ${result.error.message}`)
  return result.value
}

function error(text: string) {
  const result = parseJson(text)
  if (result.ok) throw new Error('expected invalid JSON')
  return result.error
}

describe('parseJson', () => {
  it('matches JSON.parse across the type space', () => {
    const samples = [
      '{"a":1}',
      '[1,2,3]',
      '"hello"',
      '42',
      '-0.5e10',
      'true',
      'false',
      'null',
      '{}',
      '[]',
      '{"nested":{"deep":{"deeper":[1,{"x":null}]}}}',
      '{"unicode":"héllo → 日本語 🎉","escaped":"line\\nbreak\\ttab\\u00e9"}',
      '{"empty string":"","zero":0,"negative":-1,"exp":1e3}',
    ]
    for (const sample of samples) {
      expect(value(sample)).toEqual(JSON.parse(sample))
    }
  })

  it('handles long strings and large arrays', () => {
    const long = 'x'.repeat(50_000)
    expect(value(`{"s":"${long}"}`)).toEqual({ s: long })

    const large = JSON.stringify(Array.from({ length: 20_000 }, (_, i) => i))
    expect((value(large) as number[]).length).toBe(20_000)
  })

  it('parses deeply nested documents', () => {
    const depth = 400
    const text = '['.repeat(depth) + ']'.repeat(depth)
    expect(value(text)).toEqual(JSON.parse(text))
  })

  it('reports depth overflow instead of blowing the stack', () => {
    const text = '['.repeat(5000) + ']'.repeat(5000)
    expect(error(text).message).toBe('Maximum nesting depth exceeded')
  })

  it('reports an empty document', () => {
    expect(error('').message).toBe('Empty document')
    expect(error('   \n  ').message).toBe('Empty document')
  })

  it('locates syntax errors by line and column', () => {
    const text = '{\n  "a": 1,\n  "b": ,\n}'
    const err = error(text)
    expect(err.line).toBe(3)
    expect(err.column).toBe(8)
    expect(err.message).toBe('Unexpected token ","')
  })

  it('rejects the usual JSON near-misses', () => {
    expect(error('{"a": 1,}').message).toContain('Trailing comma')
    expect(error('[1, 2,]').message).toContain('Trailing comma')
    expect(error("{'a': 1}").message).toContain('double-quoted')
    expect(error('{"a" 1}').message).toContain('Expected ":"')
    expect(error('{"a": 1} extra').message).toContain('Unexpected content')
    expect(error('{"a": 1').message).toBe('Unexpected end of input')
    expect(error('"unterminated').message).toBe('Unterminated string')
    expect(error('{"a": 01}').message).toContain('Expected "," or "}"')
    expect(error('undefined').message).toContain('Unexpected token')
  })

  it('indexes every node by path', () => {
    const text = ['{', '  "user": {', '    "name": "Sam",', '    "tags": ["a", "b"]', '  }', '}'].join(
      '\n',
    )
    const result = parseJson(text)
    if (!result.ok) throw new Error('expected valid JSON')

    // Object members are anchored on their key, array items on the value.
    expect(result.locs.get(pathKey(['user']))?.line).toBe(2)
    expect(result.locs.get(pathKey(['user', 'name']))?.line).toBe(3)
    expect(result.locs.get(pathKey(['user', 'tags']))?.line).toBe(4)
    expect(result.locs.get(pathKey(['user', 'tags', 1]))?.line).toBe(4)
    expect(result.locs.get(pathKey(['user']))?.endLine).toBe(5)
  })

  it('keeps the last value for duplicate keys, like JSON.parse', () => {
    expect(value('{"a":1,"a":2}')).toEqual(JSON.parse('{"a":1,"a":2}'))
  })
})
