import { describe, expect, it } from 'vitest'
import { formatJson, minifyJson } from './format'
import { parseJson } from './parser'

/** Formatting must never change what the document means. */
function sameValue(a: string, b: string): boolean {
  return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b))
}

describe('formatJson', () => {
  it('expands compact JSON', () => {
    expect(formatJson('{"user":{"name":"Sam","age":21}}', 2)).toBe(
      ['{', '  "user": {', '    "name": "Sam",', '    "age": 21', '  }', '}'].join('\n'),
    )
  })

  it('honours the indent setting', () => {
    expect(formatJson('{"a":1}', 4)).toBe('{\n    "a": 1\n}')
    expect(formatJson('{"a":1}', 'tab')).toBe('{\n\t"a": 1\n}')
  })

  it('keeps empty containers on one line', () => {
    expect(formatJson('{"a":{},"b":[]}', 2)).toBe('{\n  "a": {},\n  "b": []\n}')
  })

  it('is idempotent', () => {
    const once = formatJson('{"a":[1,{"b":null}],"c":true}', 2)
    expect(formatJson(once, 2)).toBe(once)
  })

  it('preserves number literals exactly', () => {
    // A JSON.parse/stringify round-trip would rewrite every one of these.
    const text = '{"exp":1e3,"trailing":1.50,"big":12345678901234567890,"neg":-0}'
    const formatted = formatJson(text, 2)
    expect(formatted).toContain('"exp": 1e3')
    expect(formatted).toContain('"trailing": 1.50')
    expect(formatted).toContain('"big": 12345678901234567890')
    expect(formatted).toContain('"neg": -0')
  })

  it('preserves key order, including integer-like keys', () => {
    // Object property order would be reshuffled by a JS object round-trip.
    expect(formatJson('{"2":"b","1":"a","x":"c"}', 2)).toBe(
      '{\n  "2": "b",\n  "1": "a",\n  "x": "c"\n}',
    )
  })

  it('preserves string escapes and unicode', () => {
    const text = '{"s":"a\\nb\\u00e9 → 🎉","q":"say \\"hi\\""}'
    expect(sameValue(formatJson(text, 2), text)).toBe(true)
    expect(formatJson(text, 2)).toContain('\\u00e9')
  })

  it('sorts keys when asked, recursively', () => {
    expect(formatJson('{"b":1,"a":{"d":2,"c":3}}', 2, true)).toBe(
      ['{', '  "a": {', '    "c": 3,', '    "d": 2', '  },', '  "b": 1', '}'].join('\n'),
    )
  })

  it('leaves array order alone when sorting keys', () => {
    expect(formatJson('{"xs":[3,1,2]}', 2, true)).toContain('[\n    3,\n    1,\n    2\n  ]')
  })
})

describe('minifyJson', () => {
  it('strips all insignificant whitespace', () => {
    const text = '{\n  "a": [ 1, 2 ],\n  "b": { "c": null }\n}'
    expect(minifyJson(text)).toBe('{"a":[1,2],"b":{"c":null}}')
  })

  it('round-trips with format', () => {
    const text = '{"a":[1,{"b":"x y"}],"c":false}'
    expect(minifyJson(formatJson(text, 4))).toBe(text)
  })

  it('keeps whitespace that lives inside strings', () => {
    expect(minifyJson('{"a":"  spaced  \\n value  "}')).toBe('{"a":"  spaced  \\n value  "}')
  })

  it('produces output the parser accepts', () => {
    const text = '{"deep":{"list":[{"k":1},{"k":2}]},"u":"héllo"}'
    const minified = minifyJson(text)
    expect(parseJson(minified).ok).toBe(true)
    expect(sameValue(minified, text)).toBe(true)
  })
})
