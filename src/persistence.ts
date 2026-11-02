import type {
  AuctionAction, BidRecord, Card, DecisionRecord, GameState, HandReview, PairDeclaration,
  PlayedCard, RuleSet, Suit, TrickRecord,
} from './game'

export const GAME_STORAGE_KEY = 'twenty-nine-trainer-game-v1'
const GAME_SCHEMA = 1

export interface SavedGame {
  game: GameState
  savedAt: number
}

const PHASES = new Set(['auction', 'trump', 'stake', 'play', 'review'])
const SUITS = new Set(['spades', 'hearts', 'diamonds', 'clubs'])
const RANKS = new Set(['J', '9', 'A', '10', 'K', 'Q', '8', '7'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readCard(value: unknown): Card | null {
  if (!isRecord(value)) return null
  const { id, suit, rank, points, strength } = value
  if (typeof id !== 'string' || typeof suit !== 'string' || !SUITS.has(suit) || typeof rank !== 'string' || !RANKS.has(rank)) return null
  if (typeof points !== 'number' || typeof strength !== 'number') return null
  return { id, suit: suit as Suit, rank, points, strength }
}

function readPlays(value: unknown): PlayedCard[] | null {
  if (!Array.isArray(value)) return null
  const plays: PlayedCard[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.player !== 'number' || item.player < 0 || item.player > 3) return null
    const card = readCard(item.card)
    if (!card) return null
    plays.push({ player: item.player, card })
  }
  return plays
}

function readTrick(value: unknown): TrickRecord | null {
  if (!isRecord(value)) return null
  const plays = readPlays(value.plays)
  if (!plays) return null
  const { number, leader, winner, points, cardPoints, bonus } = value
  if (typeof number !== 'number' || typeof leader !== 'number' || typeof winner !== 'number') return null
  if (typeof points !== 'number' || typeof cardPoints !== 'number' || typeof bonus !== 'number') return null
  return { number, leader, plays, winner, points, cardPoints, bonus }
}

function readHands(value: unknown): Card[][] | null {
  if (!Array.isArray(value) || value.length !== 4) return null
  const hands: Card[][] = []
  for (const hand of value) {
    if (!Array.isArray(hand)) return null
    const cards: Card[] = []
    for (const item of hand) {
      const card = readCard(item)
      if (!card) return null
      cards.push(card)
    }
    hands.push(cards)
  }
  return hands
}

function readRules(value: unknown): RuleSet {
  const rules = isRecord(value) ? value : {}
  return {
    lastTrickBonus: rules.lastTrickBonus === true,
    pair: rules.pair !== false,
    seventhCard: rules.seventhCard !== false,
    double: rules.double !== false,
    reverse: rules.reverse === true,
    reverseTrump: rules.reverseTrump === true,
  }
}

function isNumberPair(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'number')
}

function readReview(value: unknown): HandReview | null {
  if (!isRecord(value)) return null
  if (typeof value.bid !== 'number' || typeof value.target !== 'number' || typeof value.bidder !== 'number') return null
  if (typeof value.success !== 'boolean' || (value.contractTeam !== 0 && value.contractTeam !== 1)) return null
  if (!isNumberPair(value.teamPoints) || !isNumberPair(value.cardPoints) || !isNumberPair(value.scoreAfter)) return null
  if (!Array.isArray(value.notes) || typeof value.scoreDelta !== 'number') return null
  if (value.trumpSuit !== null && (typeof value.trumpSuit !== 'string' || !SUITS.has(value.trumpSuit))) return null
  return value as unknown as HandReview
}

function readGame(value: unknown): GameState | null {
  if (!isRecord(value)) return null
  if (typeof value.phase !== 'string' || !PHASES.has(value.phase)) return null

  const hands = readHands(value.hands)
  const currentTrick = readPlays(value.currentTrick)
  if (!hands || !currentTrick) return null

  const rawTricks = value.tricks
  if (!Array.isArray(rawTricks)) return null
  const tricks: TrickRecord[] = []
  for (const item of rawTricks) {
    const trick = readTrick(item)
    if (!trick) return null
    tricks.push(trick)
  }

  const pausedTrick = value.pausedTrick === null ? null : readTrick(value.pausedTrick)
  if (value.pausedTrick !== null && !pausedTrick) return null

  const seventhCard = value.seventhCard === null ? null : readCard(value.seventhCard)
  if (value.seventhCard !== null && !seventhCard) return null

  const initialHands = value.initialHands === null ? null : readHands(value.initialHands)
  if (value.initialHands !== null && !initialHands) return null

  if (!isNumberPair(value.matchScore)) return null
  if (typeof value.version !== 'number' || typeof value.handNumber !== 'number' || typeof value.handId !== 'number') return null
  if (typeof value.dealer !== 'number' || typeof value.currentPlayer !== 'number') return null
  if (typeof value.trumpRevealed !== 'boolean' || typeof value.auctionComplete !== 'boolean') return null

  const trumpSuit = value.trumpSuit === null ? null : typeof value.trumpSuit === 'string' && SUITS.has(value.trumpSuit) ? value.trumpSuit as Suit : undefined
  if (trumpSuit === undefined) return null
  const indicatorSuit = value.indicatorSuit === null ? null : typeof value.indicatorSuit === 'string' && SUITS.has(value.indicatorSuit) ? value.indicatorSuit as Suit : undefined
  if (indicatorSuit === undefined) return null

  const review = value.phase === 'review' ? readReview(value.review) : null
  if (value.phase === 'review' && !review) return null

  return {
    ...(value as unknown as GameState),
    phase: value.phase as GameState['phase'],
    hands,
    currentTrick,
    tricks,
    pausedTrick,
    seventhCard,
    initialHands,
    rules: readRules(value.rules),
    trumpSuit,
    indicatorSuit,
    review,
    log: Array.isArray(value.log) ? value.log.filter((line): line is string => typeof line === 'string') : [],
    message: typeof value.message === 'string' ? value.message : '',
    auctionActions: Array.isArray(value.auctionActions) ? value.auctionActions as AuctionAction[] : [],
    bidRecords: Array.isArray(value.bidRecords) ? value.bidRecords as BidRecord[] : [],
    decisions: Array.isArray(value.decisions) ? value.decisions as DecisionRecord[] : [],
    pair: isRecord(value.pair) ? value.pair as unknown as PairDeclaration : null,
    deck: Array.isArray(value.deck) ? value.deck as Card[] : [],
    stake: value.stake === 2 || value.stake === 4 ? value.stake : 1,
    stakeStage: value.stakeStage === 'defend' || value.stakeStage === 'redouble' ? value.stakeStage : null,
    consecutivePasses: typeof value.consecutivePasses === 'number' ? value.consecutivePasses : 0,
    highBid: typeof value.highBid === 'number' ? value.highBid : null,
    bidder: typeof value.bidder === 'number' ? value.bidder : null,
  }
}

export function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(GAME_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed) || parsed.schema !== GAME_SCHEMA || typeof parsed.savedAt !== 'number') return null
    const game = readGame(parsed.game)
    if (!game) {
      localStorage.removeItem(GAME_STORAGE_KEY)
      return null
    }
    return { game, savedAt: parsed.savedAt }
  } catch {
    return null
  }
}

export function saveGame(game: GameState): void {
  try {
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify({
      schema: GAME_SCHEMA,
      savedAt: Date.now(),
      game,
    }))
  } catch {
    // A full or unavailable storage should never stop the table.
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(GAME_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}
