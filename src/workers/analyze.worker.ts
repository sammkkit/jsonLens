import { analyze, type AnalysisRequest } from '../lib/analysis'

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  self.postMessage(analyze(event.data))
}
