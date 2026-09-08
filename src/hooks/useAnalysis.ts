import { useEffect, useRef, useState } from 'react'
import { analyze, type AnalysisResponse, type AnalysisResult } from '../lib/analysis'

const DEBOUNCE_MS = 140

interface Snapshot {
  result: AnalysisResult
  /** The exact inputs this result describes, held by reference. */
  left: string
  right: string | null
}

/**
 * Parses and diffs the documents off the main thread, debounced, so typing in a
 * large file never blocks the editor. Falls back to inline analysis where
 * workers are unavailable.
 */
export function useAnalysis(left: string, right: string | null) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const workerRef = useRef<Worker | null>(null)
  const latestId = useRef(0)
  const inFlight = useRef(new Map<number, { left: string; right: string | null }>())

  useEffect(() => {
    try {
      const worker = new Worker(new URL('../workers/analyze.worker.ts', import.meta.url), {
        type: 'module',
      })
      worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
        const request = inFlight.current.get(event.data.id)
        inFlight.current.delete(event.data.id)
        // Drop responses that a newer keystroke has already superseded.
        if (!request || event.data.id !== latestId.current) return
        setSnapshot({ result: event.data, left: request.left, right: request.right })
      }
      workerRef.current = worker
      return () => {
        worker.terminate()
        workerRef.current = null
      }
    } catch {
      // No worker support: analysis falls back to the main thread below.
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    const id = ++latestId.current
    const timer = setTimeout(() => {
      const worker = workerRef.current
      inFlight.current.set(id, { left, right })
      if (worker) {
        worker.postMessage({ id, left, right })
      } else {
        const response = analyze({ id, left, right })
        inFlight.current.delete(id)
        if (response.id === latestId.current) setSnapshot({ result: response, left, right })
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [left, right])

  // Derived, not stored: a result is stale exactly when it describes something
  // other than what is on screen right now.
  return {
    result: snapshot?.result ?? null,
    pending: snapshot === null || snapshot.left !== left || snapshot.right !== right,
  }
}
