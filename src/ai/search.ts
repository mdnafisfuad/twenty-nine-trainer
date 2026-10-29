import {
  chooseBotCard,
  legalCardsFor,
  type Card,
  type GameState,
} from '../game'
import { evaluateMoves } from './evaluator'

export interface BotSearchOptions {
  /** Base determinization budget. The sampler may return fewer if the constraints are tight. */
  samples?: number
  seed?: number
}

let searchSequence = 0

function sampleBudget(base: number, candidateCount: number, remainingTricks: number): number {
  // The exact endgame solver is strong but more expensive per world, so cap those worlds.
  if (remainingTricks === 4) return Math.min(base, 24)
  if (remainingTricks <= 3) return Math.min(base, 32)
  if (candidateCount <= 2) return base
  if (candidateCount >= 5) return Math.max(24, Math.round(base * 0.75))
  return base
}

/**
 * Determinized perfect-information Monte Carlo for a bot's card choice.
 *
 * The state passed in is the bot's real view. evaluation sanitizes it first, so the sampled
 * deals never contain the other seats' actual cards. The same sampled deals are reused for
 * every legal candidate, which makes the comparison paired rather than noisy.
 */
export function chooseBotCardWithSearch(state: GameState, player: number, options: BotSearchOptions = {}): Card {
  const candidates = legalCardsFor(state, player)
  if (candidates.length <= 1) return candidates[0] ?? chooseBotCard(state, player)

  // Defenders do not know a hidden reverse or a set-aside seventh card. The sampler's
  // current contract model would have to guess the mode, so use the fair heuristic instead.
  if (state.bidder !== player && !state.trumpRevealed && (state.reverse || state.seventhCard !== null)) {
    return chooseBotCard(state, player)
  }

  const remainingTricks = 8 - state.tricks.length
  const baseSamples = options.samples ?? 96
  const requestedSamples = sampleBudget(baseSamples, candidates.length, remainingTricks)
  const seed = options.seed ?? (state.handId * 1009 + state.version * 9176 + player * 37 + searchSequence++)
  let evaluation
  try {
    evaluation = evaluateMoves(state, player, requestedSamples, seed)
  } catch {
    return chooseBotCard(state, player)
  }

  if (!evaluation.recommendedCardId) return chooseBotCard(state, player)
  const recommended = candidates.find(card => card.id === evaluation.recommendedCardId)
  if (!recommended) return chooseBotCard(state, player)

  return recommended
}
