import { describe, expect, it } from 'vitest'
import { analyze } from './analysis'

const LEFT = `{
  "version": "2.4.1",
  "owner": {
    "team": "payments"
  },
  "deprecated": false
}`

const RIGHT = `{
  "version": "2.5.0",
  "owner": {
    "team": "payments",
    "oncall": "sam"
  }
}`

describe('analyze', () => {
  it('reports document stats for a single document', () => {
    const result = analyze({ id: 1, left: LEFT, right: null })
    expect(result.left.valid).toBe(true)
    expect(result.left.lines).toBe(7)
    expect(result.left.bytes).toBe(new TextEncoder().encode(LEFT).length)
    expect(result.right).toBeUndefined()
    expect(result.changes).toBeUndefined()
  })

  it('counts bytes, not characters', () => {
    const result = analyze({ id: 1, left: '{"a":"🎉"}', right: null })
    expect(result.left.bytes).toBeGreaterThan('{"a":"🎉"}'.length)
  })

  it('surfaces syntax errors with a position', () => {
    const result = analyze({ id: 1, left: '{\n  "a": 1\n  "b": 2\n}', right: null })
    expect(result.left.valid).toBe(false)
    expect(result.left.error?.line).toBe(3)
  })

  it('resolves every change to a line in both documents', () => {
    const { changes } = analyze({ id: 2, left: LEFT, right: RIGHT })
    expect(changes).toBeDefined()

    const modified = changes!.find((change) => change.label === 'version')!
    expect(modified.leftLine).toBe(2)
    expect(modified.rightLine).toBe(2)

    const added = changes!.find((change) => change.label === 'owner.oncall')!
    expect(added.rightLine).toBe(5)
    // Not present on the left, so it anchors on the nearest ancestor that is.
    expect(added.leftLine).toBe(3)

    const removed = changes!.find((change) => change.label === 'deprecated')!
    expect(removed.leftLine).toBe(6)
    expect(removed.rightLine).toBe(1)
  })

  it('skips the diff when either side is invalid', () => {
    const result = analyze({ id: 3, left: LEFT, right: '{oops}' })
    expect(result.right?.valid).toBe(false)
    expect(result.changes).toBeUndefined()
  })

  it('passes the request id through so stale results can be dropped', () => {
    expect(analyze({ id: 77, left: '{}', right: '{}' }).id).toBe(77)
  })
})
