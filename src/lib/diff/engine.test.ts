import { describe, expect, it } from 'vitest'
import { parseJson, type JsonValue } from '../json/parser'
import { diffJson } from './engine'
import { summarize, type Change } from './types'

function parse(text: string): JsonValue {
  const result = parseJson(text, { locations: false })
  if (!result.ok) throw new Error(result.error.message)
  return result.value
}

function diff(left: string, right: string): Change[] {
  return diffJson(parse(left), parse(right))
}

/** Compact "kind label from→to" rendering, so expectations stay readable. */
function describeChanges(changes: Change[]): string[] {
  return changes.map((change) =>
    [change.kind, change.label, change.left ?? '·', '→', change.right ?? '·'].join(' '),
  )
}

describe('diffJson', () => {
  it('finds nothing in identical documents', () => {
    expect(diff('{"a":1,"b":[1,2]}', '{"a":1,"b":[1,2]}')).toEqual([])
  })

  it('ignores object key order', () => {
    expect(diff('{"id":123,"name":"Sam"}', '{"name":"Sam","id":123}')).toEqual([])
    expect(diff('{"a":{"x":1,"y":2}}', '{"a":{"y":2,"x":1}}')).toEqual([])
  })

  it('ignores formatting differences', () => {
    expect(diff('{"a":[1,2]}', '{\n  "a": [\n    1,\n    2\n  ]\n}')).toEqual([])
  })

  it('reports modified values with a path', () => {
    expect(describeChanges(diff('{"user":{"age":21}}', '{"user":{"age":22}}'))).toEqual([
      'modified user.age 21 → 22',
    ])
  })

  it('reports added and removed keys', () => {
    const changes = diff('{"a":1,"phone":"x"}', '{"a":1,"email":"y"}')
    expect(describeChanges(changes)).toEqual([
      'removed phone "x" → ·',
      'added email · → "y"',
    ])
  })

  it('reports type changes distinctly', () => {
    const [change] = diff('{"n":1200}', '{"n":"1200"}')
    expect(change.kind).toBe('type')
    expect(change.leftType).toBe('number')
    expect(change.rightType).toBe('string')
  })

  it('descends into nested structures', () => {
    const changes = diff(
      '{"a":{"b":{"c":1,"d":2}}}',
      '{"a":{"b":{"c":9,"d":2}}}',
    )
    expect(describeChanges(changes)).toEqual(['modified a.b.c 1 → 9'])
  })

  it('aligns arrays so an insertion is one change, not a cascade', () => {
    const changes = diff('["us","eu","ap"]', '["us","eu-central","eu","ap"]')
    expect(describeChanges(changes)).toEqual(['added [1] · → "eu-central"'])
  })

  it('reports array element edits at the right index', () => {
    const changes = diff('{"xs":[1,2,3]}', '{"xs":[1,5,3]}')
    expect(describeChanges(changes)).toEqual(['modified xs[1] 2 → 5'])
    expect(changes[0].leftPath).toEqual(['xs', 1])
    expect(changes[0].rightPath).toEqual(['xs', 1])
  })

  it('reports array truncation as removals', () => {
    const changes = diff('[1,2,3]', '[1]')
    expect(describeChanges(changes)).toEqual(['removed [1] 2 → ·', 'removed [2] 3 → ·'])
  })

  it('handles empty → populated and back', () => {
    expect(describeChanges(diff('{}', '{"a":1}'))).toEqual(['added a · → 1'])
    expect(describeChanges(diff('{"a":1}', '{}'))).toEqual(['removed a 1 → ·'])
    expect(describeChanges(diff('[]', '[1]'))).toEqual(['added [0] · → 1'])
    expect(describeChanges(diff('{"a":[1]}', '{"a":[]}'))).toEqual(['removed a[0] 1 → ·'])
  })

  it('treats a container swap as a type change, not a deep walk', () => {
    const changes = diff('{"a":{"x":1}}', '{"a":[1]}')
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe('type')
    expect(changes[0].left).toBe('{1 key}')
    expect(changes[0].right).toBe('[1 item]')
  })

  it('compares primitives exactly', () => {
    expect(diff('{"a":null}', '{"a":null}')).toEqual([])
    expect(describeChanges(diff('{"a":true}', '{"a":false}'))).toEqual(['modified a true → false'])
    expect(describeChanges(diff('{"a":0}', '{"a":-0}'))).toEqual([])
    expect(describeChanges(diff('{"a":"1"}', '{"a":1}'))[0]).toContain('type')
  })

  it('matches objects inside arrays regardless of their key order', () => {
    expect(diff('[{"a":1,"b":2}]', '[{"b":2,"a":1}]')).toEqual([])
  })

  it('truncates long value previews', () => {
    const long = 'y'.repeat(200)
    const [change] = diff('{"s":"a"}', `{"s":"${long}"}`)
    expect(change.right!.length).toBeLessThanOrEqual(60)
    expect(change.right!.endsWith('…')).toBe(true)
  })

  it('summarises counts by kind', () => {
    const changes = diff(
      '{"keep":1,"drop":2,"edit":3,"retype":4}',
      '{"keep":1,"edit":9,"retype":"4","add":5}',
    )
    expect(summarize(changes)).toEqual({ total: 4, added: 1, removed: 1, modified: 2 })
  })

  it('stays fast on large arrays', () => {
    const left = JSON.stringify(Array.from({ length: 30_000 }, (_, i) => ({ i })))
    const right = JSON.stringify(
      Array.from({ length: 30_000 }, (_, i) => ({ i: i === 29_999 ? -1 : i })),
    )
    const started = performance.now()
    const changes = diff(left, right)
    expect(changes).toHaveLength(1)
    expect(performance.now() - started).toBeLessThan(3000)
  })
})
