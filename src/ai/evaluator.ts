import {
  bidCeiling,
  chooseBotCard,
  chooseBotTrump,
  continueAfterTrick,
  legalCardsFor,
  playCard,
  SUITS,
  RANKS,
  suitPower,
  teamOf,
  type Card,
  type DecisionRecord,
  type GameState,
  type Suit,
  type Team,
} from '../game'
import { evaluateEndgameCandidate } from './endgame'

export interface MoveEstimate {
  cardId: string
  cardLabel: string
  samples: number
  /** Probability that the player's team achieves its hand objective. For defenders, this means defeating the contract. */
  teamGoalRate: number
  /** Probability that the bidding team makes its contract. */
  contractSuccessRate: number
  /** Average card-point difference for the player's team. */
  expectedPointMargin: number
  /** Combined ranking score. Contract outcome dominates the point-margin tiebreak. */
  expectedUtility: number
  standardError: number
}

export interface MoveEvaluation {
  samples: number
  evaluatedMoves: number
  recommendedCardId: string | null
  recommendationGap: number
  unknownTrumpModeled: boolean
  notes: string[]
  options: MoveEstimate[]
}

export interface DeepReviewItem {
  trickNumber: number
  chosenCardId: string
  chosenCardLabel: string
  recommendedCardId: string | null
  recommendedCardLabel: string | null
  chosenGoalRate: number
  recommendedGoalRate: number
  goalRateGain: number
  pointMarginGain: number
  samples: number
  confidence: 'close' | 'suggestive' | 'strong'
}

export interface DeepReviewResult {
  decisions: DeepReviewItem[]
  samplesPerDecision: number
  evaluatedDecisions: number
  summary: string
}

const POINTS: Record<string, number> = { J: 3, '9': 2, A: 1, '10': 1, K: 0, Q: 0, '8': 0, '7': 0 }
const STRENGTH: Record<string, number> = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 }
const DECK: Card[] = SUITS.flatMap(suit => RANKS.map(rank => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  points: POINTS[rank],
  strength: STRENGTH[rank],
})))

function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value += 0x6D2B79F5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function publicPlays(state: GameState) {
  return [...state.tricks.flatMap(trick => trick.plays), ...state.currentTrick]
}

/**
 * Remove private information before an evaluation is run. In particular, this removes opponents'
 * hands, the original deal, the deck and the actual hidden trump suit. The sampler works only from
 * the player's hand and public play history.
 */
export function sanitizeStateForEvaluation(input: GameState, player = 0): GameState {
  const knowsMode = input.trumpRevealed || input.bidder === player
  return {
    ...input,
    hands: input.hands.map((hand, index) => index === player ? [...hand] : []),
    initialHands: null,
    deck: [],
    trumpSuit: knowsMode ? input.trumpSuit : null,
    reverse: knowsMode ? input.reverse : false,
    indicatorSuit: knowsMode ? input.indicatorSuit : null,
    seventhCard: input.bidder === player ? input.seventhCard : null,
    pausedTrick: null,
    decisions: [],
    review: null,
    bidRecords: [],
    log: [...input.log],
  }
}

/** Reconstruct an evaluation-only state from what was available at a previously recorded decision. */
export function stateFromDecision(decision: DecisionRecord): GameState {
  const hands: Card[][] = [[], [], [], []]
  hands[decision.player] = [...decision.handBefore]
  return {
    phase: 'play',
    hands,
    initialHands: null,
    deck: [],
    dealer: decision.dealer,
    currentPlayer: decision.player,
    highBid: decision.highBid,
    bidder: decision.bidder,
    consecutivePasses: 0,
    auctionComplete: false,
    trumpSuit: decision.knownTrumpSuit,
    trumpRevealed: decision.trumpRevealed,
    mustTrump: decision.mustTrump ?? null,
    reverse: decision.knownReverse,
    indicatorSuit: decision.knownReverse ? decision.indicatorSuit : null,
    seventhCard: decision.seventhCard ? { ...decision.seventhCard } : null,
    currentTrick: [...decision.trickBefore],
    tricks: decision.completedTricksBefore.map(trick => ({ ...trick, plays: [...trick.plays] })),
    pausedTrick: null,
    matchScore: [...decision.matchScore] as [number, number],
    handNumber: 1,
    handId: 1,
    rules: { ...decision.rules },
    pair: decision.pair ? { ...decision.pair } : null,
    stake: decision.stake,
    stakeStage: null,
    auctionActions: [],
    message: '',
    log: [],
    decisions: [],
    review: null,
    bidRecords: [],
    version: 0,
  }
}

interface SampledWorld {
  hands: Card[][]
  trumpSuit: Suit | null
}

function inferKnownVoids(state: GameState): Set<Suit>[] {
  const voids = Array.from({ length: 4 }, () => new Set<Suit>())
  const playGroups = [...state.tricks.map(trick => trick.plays), state.currentTrick]
  for (const plays of playGroups) {
    const ledSuit = plays[0]?.card.suit
    if (!ledSuit) continue
    for (const play of plays.slice(1)) {
      if (play.card.suit !== ledSuit) voids[play.player].add(ledSuit)
    }
  }
  return voids
}

function assignUnknownCards(
  pool: Card[],
  capacitiesInput: number[],
  voids: Set<Suit>[],
  viewer: number,
  random: () => number,
): Card[][] | null {
  const hands: Card[][] = Array.from({ length: 4 }, () => [])
  const capacities = [...capacitiesInput]
  const cards = shuffled(pool, random)
  const recipientSeats = [0, 1, 2, 3].filter(seat => seat !== viewer)

  function visit(): boolean {
    if (cards.length === 0) return capacities.every((size, seat) => seat === viewer || size === 0)

    let chosenIndex = -1
    let chosenOptions: number[] = []
    for (let index = 0; index < cards.length; index++) {
      const card = cards[index]
      const options = recipientSeats.filter(seat => capacities[seat] > 0 && !voids[seat].has(card.suit))
      if (options.length === 0) return false
      if (chosenIndex < 0 || options.length < chosenOptions.length) {
        chosenIndex = index
        chosenOptions = options
        if (options.length === 1) break
      }
    }

    const [card] = cards.splice(chosenIndex, 1)
    const options = shuffled(chosenOptions, random).sort((a, b) => capacities[b] - capacities[a])
    for (const seat of options) {
      capacities[seat] -= 1
      hands[seat].push(card)
      // A cheap feasibility check prevents exploring branches that cannot fill a remaining seat.
      const cardsLeft = cards.length
      const remainingCapacity = capacities.reduce((sum, size, seat) => sum + (seat === viewer ? 0 : size), 0)
      const feasible = cardsLeft === remainingCapacity && recipientSeats.every(target => {
        if (capacities[target] <= 0) return true
        return cards.some(candidate => !voids[target].has(candidate.suit))
      })
      if (feasible && visit()) return true
      hands[seat].pop()
      capacities[seat] += 1
    }
    cards.splice(chosenIndex, 0, card)
    return false
  }

  return visit() ? hands : null
}

interface TrumpBelief {
  suit: Suit | null
}

function openingFourCombinations(cards: Card[]): Card[][] {
  const combinations: Card[][] = []
  for (let a = 0; a < cards.length - 3; a++) {
    for (let b = a + 1; b < cards.length - 2; b++) {
      for (let c = b + 1; c < cards.length - 1; c++) {
        for (let d = c + 1; d < cards.length; d++) combinations.push([cards[a], cards[b], cards[c], cards[d]])
      }
    }
  }
  return combinations
}

function sampledTrump(state: GameState, hands: Card[][], player: number, random: () => number): TrumpBelief | null {
  if (state.reverse && !state.trumpSuit) return { suit: null }
  if (state.bidder === player) return state.trumpSuit ? { suit: state.trumpSuit } : null
  if (state.bidder === null || state.highBid === null) return null

  // Reconstruct the bidder's original eight cards from their sampled remaining cards and public plays.
  // The opening four are not known, so enumerate plausible four-card subsets and weight them using
  // the visible contract and the simple bot-bidding thresholds. This is a prior, not certainty.
  const bidder = state.bidder
  const playedByBidder = publicPlays(state).filter(play => play.player === bidder).map(play => play.card)
  const bidderFullHand = [...hands[bidder], ...playedByBidder]
  if (bidderFullHand.length !== 8) return null
  const subsets = openingFourCombinations(bidderFullHand)
  const weighted = subsets.map(openingFour => {
    const bestScore = Math.max(...SUITS.map(suit => suitPower(openingFour, suit)))
    const ceiling = bidCeiling(bestScore)
    // A soft compatibility weight keeps aggressive human auctions playable. A hard cutoff
    // would make the sampler return no worlds when a player bids above the bot threshold.
    const gap = state.highBid! - ceiling
    const weight = gap <= 0 ? 1 : Math.max(0.02, Math.pow(0.45, gap))
    return { openingFour, weight }
  })
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) return null
  let pick = random() * totalWeight
  let selected = weighted[weighted.length - 1].openingFour
  for (const item of weighted) {
    pick -= item.weight
    if (pick <= 0 && item.weight > 0) {
      selected = item.openingFour
      break
    }
  }
  const suit = state.trumpRevealed && state.trumpSuit ? state.trumpSuit : chooseBotTrump(selected)
  return { suit }
}

function sampleWorld(state: GameState, player: number, random: () => number): SampledWorld | null {
  const ownHand = state.hands[player] ?? []
  const plays = publicPlays(state)
  const playedIds = new Set(plays.map(play => play.card.id))
  const ownIds = new Set(ownHand.map(card => card.id))
  const knownSeventh = state.bidder === player ? state.seventhCard : null
  const pool = DECK.filter(card => !playedIds.has(card.id) && !ownIds.has(card.id) && card.id !== knownSeventh?.id)
  const playedCounts = [0, 0, 0, 0]
  for (const play of plays) playedCounts[play.player] += 1
  const capacities = [0, 1, 2, 3].map(seat => seat === player ? 0 : Math.max(0, 8 - playedCounts[seat]))
  const expectedOwnCount = (knownSeventh ? 7 : 8) - playedCounts[player]
  if (ownHand.length !== expectedOwnCount || pool.length !== capacities.reduce((sum, value) => sum + value, 0)) return null

  const voids = inferKnownVoids(state)
  const hands: Card[][] = Array.from({ length: 4 }, () => [])
  hands[player] = [...ownHand]
  const assigned = assignUnknownCards(pool, capacities, voids, player, random)
  if (!assigned) return null
  for (let seat = 0; seat < 4; seat++) if (seat !== player) hands[seat] = assigned[seat]
  const trumpBelief = sampledTrump(state, hands, player, random)
  if (!trumpBelief) return null
  return { hands, trumpSuit: trumpBelief.suit }
}

function evaluateOneWorld(state: GameState, player: number, candidate: Card, world: SampledWorld): {
  goal: boolean
  contractSuccess: boolean
  pointMargin: number
} | null {
  // Once the mode is public and only a few tricks remain, solve the sampled deal exactly.
  // This removes rollout noise from the part of the hand where precision matters most.
  const exact = evaluateEndgameCandidate(state, player, candidate, world.hands)
  if (exact) return exact

  let simulation: GameState = {
    ...state,
    hands: world.hands.map(hand => [...hand]),
    initialHands: null,
    deck: [],
    trumpSuit: world.trumpSuit,
    decisions: [],
    review: null,
    log: [],
    version: 0,
  }
  simulation = playCard(simulation, player, candidate.id)
  let safety = 0
  while (simulation.phase === 'play' && safety < 40) {
    if (simulation.pausedTrick) {
      simulation = continueAfterTrick(simulation)
      safety += 1
      continue
    }
    const active = simulation.currentPlayer
    const selected = chooseBotCard(simulation, active)
    if (!selected) return null
    simulation = playCard(simulation, active, selected.id)
    safety += 1
  }
  if (!simulation.review) return null
  const review = simulation.review
  const playerTeam = teamOf(player)
  const contractTeam = teamOf(review.bidder)
  const goal = playerTeam === contractTeam ? review.success : !review.success
  const pointMargin = review.teamPoints[playerTeam] - review.teamPoints[(1 - playerTeam) as Team]
  return { goal, contractSuccess: review.success, pointMargin }
}

/**
 * Monte Carlo rollout evaluator. Every candidate is tested against the same sampled worlds. Samples
 * respect cards already seen, players' remaining card counts, and suits they have shown to be void in.
 */
export function evaluateMoves(
  inputState: GameState,
  player = 0,
  requestedSamples = 200,
  seed = 290029,
): MoveEvaluation {
  const state = sanitizeStateForEvaluation(inputState, player)
  const candidates = legalCardsFor(state, player)
  if (state.phase !== 'play' || state.currentPlayer !== player || candidates.length === 0) {
    return { samples: 0, evaluatedMoves: 0, recommendedCardId: null, recommendationGap: 0, unknownTrumpModeled: false, notes: ['Move analysis is available on your turn during trick play.'], options: [] }
  }
  const sampleCount = Math.max(16, Math.min(400, Math.floor(requestedSamples)))
  const random = seededRandom(seed)
  const worlds: SampledWorld[] = []
  let attempts = 0
  while (worlds.length < sampleCount && attempts < sampleCount * 24) {
    attempts += 1
    const world = sampleWorld(state, player, random)
    if (world) worlds.push(world)
  }
  if (!worlds.length) {
    return { samples: 0, evaluatedMoves: 0, recommendedCardId: null, recommendationGap: 0, unknownTrumpModeled: false, notes: ['Could not construct valid unseen deals from the recorded public information. Try again on the next trick.'], options: [] }
  }

  const options: MoveEstimate[] = candidates.map(candidate => {
    let goalCount = 0
    let contractCount = 0
    let marginSum = 0
    let utilitySum = 0
    let utilitySquaredSum = 0
    let validSamples = 0
    for (const world of worlds) {
      const result = evaluateOneWorld(state, player, candidate, world)
      if (!result) continue
      validSamples += 1
      if (result.goal) goalCount += 1
      if (result.contractSuccess) contractCount += 1
      marginSum += result.pointMargin
      const utility = (result.goal ? 1 : -1) + result.pointMargin * 0.01
      utilitySum += utility
      utilitySquaredSum += utility * utility
    }
    const goalRate = validSamples ? goalCount / validSamples : 0
    const meanUtility = validSamples ? utilitySum / validSamples : -Infinity
    const variance = validSamples > 1 ? Math.max(0, (utilitySquaredSum - validSamples * meanUtility * meanUtility) / (validSamples - 1)) : 0
    const standardError = validSamples > 0 ? Math.sqrt(goalRate * (1 - goalRate) / validSamples) : 1
    return {
      cardId: candidate.id,
      cardLabel: `${candidate.rank}${({ spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' } as Record<Suit, string>)[candidate.suit]}`,
      samples: validSamples,
      teamGoalRate: goalRate,
      contractSuccessRate: validSamples ? contractCount / validSamples : 0,
      expectedPointMargin: validSamples ? marginSum / validSamples : 0,
      expectedUtility: meanUtility - variance * 0.000001,
      standardError,
    }
  }).sort((a, b) => b.expectedUtility - a.expectedUtility || b.teamGoalRate - a.teamGoalRate || b.expectedPointMargin - a.expectedPointMargin)

  const best = options[0]
  const runnerUp = options[1]
  const unknownTrumpModeled = !state.trumpRevealed && state.bidder !== player && (!state.reverse || !!state.trumpSuit)
  const notes = [
    `Each move was evaluated over ${worlds.length} plausible unseen deals using the same sampled deals for fair comparison.`,
    'The evaluator uses your hand, public cards, inferred voids and remaining-card counts—not the opponents’ actual hidden hands.',
  ]
  if (state.bidder !== player) notes.push('Sampled deals are weighted against the visible auction using the bot’s simplified bidding thresholds; real human bidding can differ.')
  if (state.reverse) notes.push(state.trumpSuit
    ? 'This is a reverse contract: the ranking flips (7 high, J low) when the contract is revealed, and the named suit still beats other suits.'
    : 'This is a reverse contract: no trump, and the ranking flips (7 high, J low) once the 2 indicator is revealed.')
  if (unknownTrumpModeled) notes.push('Trump is still hidden, so its suit is sampled from plausible opening four-card hands for the bidder. Results are approximate.')
  if (state.trumpRevealed && !state.seventhCard && 8 - state.tricks.length <= 4) {
    notes.push('With four or fewer tricks left, each sampled deal is solved exactly by double-dummy search instead of a heuristic rollout.')
  }
  if (best && runnerUp && best.teamGoalRate - runnerUp.teamGoalRate < 0.06 && Math.abs(best.expectedPointMargin - runnerUp.expectedPointMargin) < 1.25) {
    notes.push('The top options are close. Treat the recommendation as a tie-break, not a proven best move.')
  }
  return {
    samples: worlds.length,
    evaluatedMoves: options.length,
    recommendedCardId: best?.cardId ?? null,
    recommendationGap: best && runnerUp ? best.expectedUtility - runnerUp.expectedUtility : 0,
    unknownTrumpModeled,
    notes,
    options,
  }
}

export function evaluateRecordedDecisions(
  decisions: DecisionRecord[],
  requestedSamples = 200,
  seed = 290029,
): DeepReviewResult {
  const items: DeepReviewItem[] = []
  const samples = Math.max(16, Math.min(400, Math.floor(requestedSamples)))
  decisions.filter(decision => decision.legalCards.length > 1).forEach((decision, index) => {
    const snapshot = stateFromDecision(decision)
    const result = evaluateMoves(snapshot, decision.player, samples, seed + index * 7919)
    const chosen = result.options.find(option => option.cardId === decision.card.id)
    const recommended = result.options.find(option => option.cardId === result.recommendedCardId)
    if (!chosen || !recommended || !result.samples) return
    const goalRateGain = recommended.teamGoalRate - chosen.teamGoalRate
    const pointMarginGain = recommended.expectedPointMargin - chosen.expectedPointMargin
    const confidence = goalRateGain >= 0.18 ? 'strong' : goalRateGain >= 0.08 ? 'suggestive' : 'close'
    items.push({
      trickNumber: decision.trickNumber,
      chosenCardId: chosen.cardId,
      chosenCardLabel: chosen.cardLabel,
      recommendedCardId: recommended.cardId,
      recommendedCardLabel: recommended.cardLabel,
      chosenGoalRate: chosen.teamGoalRate,
      recommendedGoalRate: recommended.teamGoalRate,
      goalRateGain,
      pointMarginGain,
      samples: result.samples,
      confidence,
    })
  })
  const meaningful = items.filter(item => item.recommendedCardId !== item.chosenCardId && item.goalRateGain >= 0.08)
  return {
    decisions: items,
    samplesPerDecision: samples,
    evaluatedDecisions: items.length,
    summary: meaningful.length
      ? `${meaningful.length} decision${meaningful.length === 1 ? '' : 's'} showed a potentially better alternative across sampled deals. These are estimates, not certainties.`
      : 'No large, consistent improvement was identified. Several moves may be strategically close, and the rollout model is approximate.',
  }
}
