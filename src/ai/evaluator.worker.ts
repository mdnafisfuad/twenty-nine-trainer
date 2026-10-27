import { evaluateMoves, evaluateRecordedDecisions, type DeepReviewResult, type MoveEvaluation } from './evaluator'
import type { DecisionRecord, GameState } from '../game'

type EvaluatorRequest =
  | { requestId: number; kind: 'moves'; state: GameState; samples: number; seed: number }
  | { requestId: number; kind: 'review'; decisions: DecisionRecord[]; samples: number; seed: number }

type EvaluatorResponse =
  | { requestId: number; kind: 'moves'; version: number; result: MoveEvaluation }
  | { requestId: number; kind: 'review'; version: number; result: DeepReviewResult }
  | { requestId: number; kind: 'error'; version: number; error: string }

type WorkerScope = {
  onmessage: ((event: MessageEvent<EvaluatorRequest>) => void) | null
  postMessage: (message: EvaluatorResponse) => void
}

const scope = self as unknown as WorkerScope
scope.onmessage = event => {
  const request = event.data
  const version = request.kind === 'moves' ? request.state.version : -1
  try {
    if (request.kind === 'moves') {
      const result = evaluateMoves(request.state, 0, request.samples, request.seed)
      scope.postMessage({ requestId: request.requestId, kind: 'moves', version, result })
    } else {
      const result = evaluateRecordedDecisions(request.decisions, request.samples, request.seed)
      scope.postMessage({ requestId: request.requestId, kind: 'review', version, result })
    }
  } catch (error) {
    scope.postMessage({ requestId: request.requestId, kind: 'error', version, error: error instanceof Error ? error.message : 'The evaluator failed unexpectedly.' })
  }
}
