import {
  contractTarget,
  FULL_DECK,
  RANKS,
  SUITS,
  teamOf,
  type Card,
  type GameState,
  type Team,
} from '../game'

/**
 * Exact double-dummy search for the last few tricks of a fully-revealed hand.
 *
 * The search is run on one sampled deal at a time. It is deliberately kept out of the
 * live game state: a bot only calls it after its own determinization sampler has produced
 * a complete deal, so it never sees the real hidden hands.
 */

const RANK_INDEX = new Map(RANKS.map((rank, index) => [rank, index]))
const SUIT_INDEX = new Map(SUITS.map((suit, index) => [suit, index]))
const INDEX_BY_ID = new Map(FULL_DECK.map(card => [
  card.id,
  (SUIT_INDEX.get(card.suit) ?? 0) * 8 + (RANK_INDEX.get(card.rank) ?? 0),
]))
const POINTS = [3, 2, 1, 1, 0, 0, 0, 0]
const NORMAL_STRENGTH = [8, 7, 6, 5, 4, 3, 2, 1]
const REVERSE_STRENGTH = [1, 2, 3, 4, 5, 6, 7, 8]
const SUIT_MASKS = SUITS.map((_, suit) => (0xff << (suit * 8)) >>> 0)

interface SolvedCard {
  player: number
  card: number
}

interface EndgamePosition {
  hands: [number, number, number, number]
  trick: SolvedCard[]
  currentPlayer: number
  trumpSuit: number
  reverse: boolean
  declarerTeam: Team
  tricksPlayed: number
  lastTrickBonus: boolean
}

interface SearchContext {
  nodes: number
  limit: number
}

interface MemoEntry {
  value: number
  flag: 'exact' | 'lower' | 'upper'
}

const ABORT = Symbol('endgame-abort')

function cardIndex(card: Card): number {
  return INDEX_BY_ID.get(card.id) ?? -1
}

function cardStrength(index: number, reverse: boolean): number {
  return reverse ? REVERSE_STRENGTH[index & 7] : NORMAL_STRENGTH[index & 7]
}

function cardPoints(index: number): number {
  return POINTS[index & 7]
}

function trickWinner(trick: SolvedCard[], trumpSuit: number, reverse: boolean): number {
  const ledSuit = trick[0].card >> 3
  const trumps = trumpSuit >= 0 ? trick.filter(play => (play.card >> 3) === trumpSuit) : []
  const candidates = trumps.length ? trumps : trick.filter(play => (play.card >> 3) === ledSuit)
  let best = candidates[0]
  for (let index = 1; index < candidates.length; index++) {
    const candidate = candidates[index]
    if (cardStrength(candidate.card, reverse) > cardStrength(best.card, reverse)) best = candidate
  }
  return best.player
}

function trickValue(trick: SolvedCard[], position: EndgamePosition): number {
  const points = trick.reduce((sum, play) => sum + cardPoints(play.card), 0)
    + (position.tricksPlayed === 7 && position.lastTrickBonus ? 1 : 0)
  const winner = trickWinner(trick, position.trumpSuit, position.reverse)
  return teamOf(winner) === position.declarerTeam ? points : 0
}

function legalMask(position: EndgamePosition): number {
  let mask = position.hands[position.currentPlayer]
  if (position.trick.length > 0) {
    const ledSuit = position.trick[0].card >> 3
    const follow = mask & SUIT_MASKS[ledSuit]
    if (follow) mask = follow
  }
  return mask
}

function cardsFromMask(mask: number): number[] {
  const cards: number[] = []
  let remaining = mask >>> 0
  while (remaining) {
    const bit = remaining & -remaining
    cards.push(31 - Math.clz32(bit))
    remaining = (remaining ^ bit) >>> 0
  }
  return cards
}

function stateKey(position: EndgamePosition): string {
  return `${position.hands[0]},${position.hands[1]},${position.hands[2]},${position.hands[3]}|${position.trick.map(play => play.card).join(',')}|${position.currentPlayer}|${position.tricksPlayed}`
}

function cloneHands(hands: [number, number, number, number]): [number, number, number, number] {
  return [hands[0], hands[1], hands[2], hands[3]]
}

function search(
  position: EndgamePosition,
  alphaInput: number,
  betaInput: number,
  context: SearchContext,
  memo: Map<string, MemoEntry>,
): number {
  context.nodes += 1
  if (context.nodes > context.limit) throw ABORT

  if ((position.hands[0] | position.hands[1] | position.hands[2] | position.hands[3]) === 0 && position.trick.length === 0) {
    return 0
  }

  const key = stateKey(position)
  const cached = memo.get(key)
  let alpha = alphaInput
  let beta = betaInput
  if (cached) {
    if (cached.flag === 'exact') return cached.value
    if (cached.flag === 'lower') {
      alpha = Math.max(alpha, cached.value)
      if (alpha >= beta) return cached.value
    } else {
      beta = Math.min(beta, cached.value)
      if (alpha >= beta) return cached.value
    }
  }

  const mask = legalMask(position)
  if (mask === 0) return 0
  const maximizing = teamOf(position.currentPlayer) === position.declarerTeam
  const cards = cardsFromMask(mask)

  // Winning tricks early is the natural move order. If partner already controls the trick,
  // try low cards first so high controls are preserved for later.
  const currentWinner = position.trick.length > 0 ? trickWinner(position.trick, position.trumpSuit, position.reverse) : -1
  const partnerWinning = currentWinner >= 0 && teamOf(currentWinner) === teamOf(position.currentPlayer)
  cards.sort((a, b) => partnerWinning
    ? cardStrength(a, position.reverse) - cardStrength(b, position.reverse)
    : cardStrength(b, position.reverse) - cardStrength(a, position.reverse))

  const alphaOriginal = alpha
  const betaOriginal = beta
  let best = maximizing ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY

  for (const card of cards) {
    const bit = (1 << card) >>> 0
    const hands = cloneHands(position.hands)
    hands[position.currentPlayer] = (hands[position.currentPlayer] & ~bit) >>> 0
    const trick = [...position.trick, { player: position.currentPlayer, card }]
    let value: number

    if (trick.length < 4) {
      value = search({
        ...position,
        hands,
        trick,
        currentPlayer: (position.currentPlayer + 1) % 4,
      }, alpha, beta, context, memo)
    } else {
      const won = trickValue(trick, position)
      const winner = trickWinner(trick, position.trumpSuit, position.reverse)
      value = won + search({
        ...position,
        hands,
        trick: [],
        currentPlayer: winner,
        tricksPlayed: position.tricksPlayed + 1,
      }, alpha - won, beta - won, context, memo)
    }

    if (maximizing) {
      if (value > best) best = value
      if (best > alpha) alpha = best
    } else {
      if (value < best) best = value
      if (best < beta) beta = best
    }
    if (alpha >= beta) break
  }

  if (best <= alphaOriginal) memo.set(key, { value: best, flag: 'upper' })
  else if (best >= betaOriginal) memo.set(key, { value: best, flag: 'lower' })
  else memo.set(key, { value: best, flag: 'exact' })
  return best
}

function handMask(cards: Card[]): number {
  let mask = 0
  for (const card of cards) {
    const index = cardIndex(card)
    if (index >= 0) mask = (mask | (1 << index)) >>> 0
  }
  return mask
}

function declarerPointsSoFar(state: GameState, declarerTeam: Team): number {
  return state.tricks.reduce((sum, trick) => (
    teamOf(trick.winner) === declarerTeam ? sum + trick.points : sum
  ), 0)
}

export interface EndgameOutcome {
  goal: boolean
  contractSuccess: boolean
  pointMargin: number
}

/**
 * Value one candidate card in one sampled deal with exact minimax. Returns null when the
 * position is not eligible (hidden mode, seventh card still set aside, or too many tricks left).
 */
export function evaluateEndgameCandidate(
  state: GameState,
  player: number,
  candidate: Card,
  worldHands: Card[][],
  nodeLimit = 60_000,
): EndgameOutcome | null {
  if (state.phase !== 'play' || state.pausedTrick || state.bidder === null) return null
  if (state.currentPlayer !== player || state.currentTrick.length >= 4) return null
  if (!state.trumpRevealed) return null
  if (state.seventhCard) return null
  const remainingTricks = 8 - state.tricks.length
  if (remainingTricks < 1 || remainingTricks > 4) return null

  const declarerTeam = teamOf(state.bidder)
  const target = contractTarget(state)
  if (!target) return null
  const hands = worldHands.map(handMask) as [number, number, number, number]
  const candidateIndex = cardIndex(candidate)
  if (candidateIndex < 0) return null

  const trick: SolvedCard[] = state.currentTrick.map(play => {
    const index = cardIndex(play.card)
    return { player: play.player, card: index }
  })
  if (trick.some(play => play.card < 0)) return null

  const position: EndgamePosition = {
    hands,
    trick,
    currentPlayer: state.currentPlayer,
    trumpSuit: state.reverse ? -1 : (state.trumpSuit ? (SUIT_INDEX.get(state.trumpSuit) ?? -1) : -1),
    reverse: state.reverse,
    declarerTeam,
    tricksPlayed: state.tricks.length,
    lastTrickBonus: state.rules.lastTrickBonus,
  }

  if (!state.reverse && position.trumpSuit < 0) return null
  if (hands[player] === 0) return null
  const bit = (1 << candidateIndex) >>> 0
  if ((hands[player] & bit) === 0) return null

  hands[player] = (hands[player] & ~bit) >>> 0
  const nextTrick = [...trick, { player, card: candidateIndex }]
  const context: SearchContext = { nodes: 0, limit: nodeLimit }
  const memo = new Map<string, MemoEntry>()
  let future: number
  try {
    if (nextTrick.length < 4) {
      future = search({
        ...position,
        hands,
        trick: nextTrick,
        currentPlayer: (player + 1) % 4,
      }, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, context, memo)
    } else {
      const won = trickValue(nextTrick, position)
      const winner = trickWinner(nextTrick, position.trumpSuit, position.reverse)
      future = won + search({
        ...position,
        hands,
        trick: [],
        currentPlayer: winner,
        tricksPlayed: position.tricksPlayed + 1,
      }, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY, context, memo)
    }
  } catch (error) {
    if (error === ABORT) return null
    throw error
  }

  const declarerPoints = declarerPointsSoFar(state, declarerTeam) + future
  const totalPoints = 28 + (state.rules.lastTrickBonus ? 1 : 0)
  const playerTeam = teamOf(player)
  const contractSuccess = declarerPoints >= target
  const goal = playerTeam === declarerTeam ? contractSuccess : !contractSuccess
  const playerPoints = playerTeam === declarerTeam ? declarerPoints : totalPoints - declarerPoints
  const opponentPoints = totalPoints - playerPoints
  return { goal, contractSuccess, pointMargin: playerPoints - opponentPoints }
}
