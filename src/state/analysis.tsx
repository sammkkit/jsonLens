import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAnalysis } from '../hooks/useAnalysis'
import type { AnalysisResult, DocReport } from '../lib/analysis'
import type { Change } from '../lib/diff/types'
import { summarize, type DiffSummary } from '../lib/diff/types'
import { useAppState } from './store'

interface AnalysisState {
  result: AnalysisResult | null
  pending: boolean
  changes: Change[]
  summary: DiffSummary
  left?: DocReport
  right?: DocReport
  /** True once both documents have parsed and the diff is meaningful. */
  comparable: boolean
  /** The change list hit its ceiling and is incomplete. */
  truncated: boolean
}

const AnalysisContext = createContext<AnalysisState | null>(null)

const EMPTY_CHANGES: Change[] = []

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { mode, texts } = useAppState()
  const { result, pending } = useAnalysis(texts.left, mode === 'diff' ? texts.right : null)

  const value = useMemo<AnalysisState>(() => {
    const changes = result?.changes ?? EMPTY_CHANGES
    return {
      result,
      pending,
      changes,
      summary: summarize(changes),
      left: result?.left,
      right: result?.right,
      comparable: !!result?.left?.valid && !!result?.right?.valid,
      truncated: !!result?.truncated,
    }
  }, [result, pending])

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>
}

export function useAnalysisState(): AnalysisState {
  const state = useContext(AnalysisContext)
  if (!state) throw new Error('useAnalysisState must be used inside AnalysisProvider')
  return state
}
