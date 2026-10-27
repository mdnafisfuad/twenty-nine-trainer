export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Phase = 'auction' | 'trump' | 'play' | 'review'
export type Team = 0 | 1

export interface Card {
  id: string
  suit: Suit
  rank: string
  points: number
  strength: number
}

export interface PlayedCard {
  player: number
  card: Card
}

export interface TrickRecord {
  number: number
  leader: number
  plays: PlayedCard[]
  winner: number
  points: number
  cardPoints: number
  bonus: number
}

export interface DecisionRecord {
  trickNumber: number
  card: Card
  handBefore: Card[]
  trickBefore: PlayedCard[]
  completedTricksBefore: TrickRecord[]
  legalCards: Card[]
  /** Actual trump suit used by the game engine; never use it for hidden-information coaching. */
  trumpSuit: Suit | null
  /** Suit known to this player at decision time, or null if the trump was hidden. */
  knownTrumpSuit: Suit | null
  trumpRevealed: boolean
  player: number
  bidder: number | null
  highBid: number | null
  dealer: number
  matchScore: [number, number]
  lastTrickBonusEnabled: boolean
}

export interface MistakeNote {
  trickNumber: number
  level: 'opportunity' | 'efficiency' | 'good'
  title: string
  detail: string
  chosenCard?: string
  betterCard?: string
}

export interface HandReview {
  bid: number
  bidder: number
  trumpSuit: Suit
  success: boolean
  contractTeam: Team
  teamPoints: [number, number]
  cardPoints: [number, number]
  lastTrickBonus: number
  scoreAfter: [number, number]
  matchWinner: Team | null
  notes: MistakeNote[]
}

export interface GameState {
  phase: Phase
  hands: Card[][]
  initialHands: Card[][] | null
  deck: Card[]
  dealer: number
  currentPlayer: number
  highBid: number | null
  bidder: number | null
  consecutivePasses: number
  trumpSuit: Suit | null
  trumpRevealed: boolean
  currentTrick: PlayedCard[]
  tricks: TrickRecord[]
  matchScore: [number, number]
  handNumber: number
  handId: number
  lastTrickBonusEnabled: boolean
  message: string
  log: string[]
  decisions: DecisionRecord[]
  review: HandReview | null
  version: number
}

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
export const SUIT_SYMBOL: Record<Suit, string> = {
  spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣',
}
export const SUIT_LABEL: Record<Suit, string> = {
  spades: 'Spades', hearts: 'Hearts', diamonds: 'Diamonds', clubs: 'Clubs',
}
export const RANKS = ['J', '9', 'A', '10', 'K', 'Q', '8', '7']
const rankPoint: Record<string, number> = { J: 3, '9': 2, A: 1, '10': 1, K: 0, Q: 0, '8': 0, '7': 0 }
const rankStrength: Record<string, number> = { J: 8, '9': 7, A: 6, '10': 5, K: 4, Q: 3, '8': 2, '7': 1 }

export const PLAYER_NAMES = ['You', 'East', 'Partner', 'West']
export const PLAYER_POSITIONS = ['south', 'east', 'north', 'west'] as const
export const teamOf = (player: number): Team => (player % 2 === 0 ? 0 : 1)
export const cardText = (card: Card) => `${card.rank}${SUIT_SYMBOL[card.suit]}`
export const isRedSuit = (suit: Suit) => suit === 'hearts' || suit === 'diamonds'

function makeDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
    points: rankPoint[rank],
    strength: rankStrength[rank],
  })))
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function newHand(
  dealer = 3,
  handNumber = 1,
  matchScore: [number, number] = [0, 0],
  lastTrickBonusEnabled = false,
  handId = 1,
  message = 'Four cards each. Read your hand, then bid with a plan.',
): GameState {
  const deck = shuffle(makeDeck())
  const hands: Card[][] = [[], [], [], []]
  let cursor = 0
  for (let r = 0; r < 4; r++) {
    for (let step = 1; step <= 4; step++) {
      hands[(dealer + step) % 4].push(deck[cursor++])
    }
  }
  return {
    phase: 'auction',
    hands,
    initialHands: null,
    deck: deck.slice(cursor),
    dealer,
    currentPlayer: (dealer + 1) % 4,
    highBid: null,
    bidder: null,
    consecutivePasses: 0,
    trumpSuit: null,
    trumpRevealed: false,
    currentTrick: [],
    tricks: [],
    matchScore: [...matchScore],
    handNumber,
    handId,
    lastTrickBonusEnabled,
    message,
    log: ['Four cards dealt to each player. Auction started.'],
    decisions: [],
    review: null,
    version: 0,
  }
}

export function suitPower(cards: Card[], suit: Suit): number {
  const cardsInSuit = cards.filter(c => c.suit === suit)
  const values: Record<string, number> = { J: 4.0, '9': 3.1, A: 1.9, '10': 1.55, K: 0.55, Q: 0.35, '8': 0.18, '7': 0.1 }
  const highControl = cardsInSuit.reduce((sum, c) => sum + values[c.rank], 0)
  const lengthBonus = Math.max(0, cardsInSuit.length - 1) * 0.58
  const jackNineBonus = cardsInSuit.some(c => c.rank === 'J') && cardsInSuit.some(c => c.rank === '9') ? 0.9 : 0
  return highControl + lengthBonus + jackNineBonus
}

export function bestTrump(cards: Card[]): Suit {
  return SUITS.reduce((best, suit) => suitPower(cards, suit) > suitPower(cards, best) ? suit : best, SUITS[0])
}

function withVersion(state: GameState, changes: Partial<GameState>): GameState {
  return { ...state, ...changes, version: state.version + 1 }
}

export function botBid(state: GameState, player: number): number | null {
  const hand = state.hands[player]
  const bestScore = Math.max(...SUITS.map(suit => suitPower(hand, suit)))
  let ceiling = 15
  if (bestScore >= 8.3) ceiling = 22
  else if (bestScore >= 7.2) ceiling = 20
  else if (bestScore >= 6.2) ceiling = 19
  else if (bestScore >= 5.35) ceiling = 18
  else if (bestScore >= 4.65) ceiling = 17
  else if (bestScore >= 4.0) ceiling = 16
  if (state.highBid === null) {
    return ceiling >= 16 ? 16 + (ceiling >= 19 && Math.random() < 0.25 ? 1 : 0) : null
  }
  const nextBid = state.highBid + 1
  if (nextBid <= ceiling && nextBid <= (state.lastTrickBonusEnabled ? 29 : 28)) return nextBid
  // A small bluff rate makes the auction less predictable, but bots stay conservative.
  if (nextBid <= 17 && bestScore >= 3.55 && Math.random() < 0.08) return nextBid
  return null
}

export function applyBid(state: GameState, player: number, bid: number | null): GameState {
  if (state.phase !== 'auction' || state.currentPlayer !== player) return state
  const maxBid = state.lastTrickBonusEnabled ? 29 : 28
  if (bid !== null && (bid < 16 || bid > maxBid || (state.highBid !== null && bid <= state.highBid))) return state
  let highBid = state.highBid
  let bidder = state.bidder
  let consecutivePasses = state.consecutivePasses
  let entry = ''
  if (bid === null) {
    consecutivePasses += 1
    entry = `${PLAYER_NAMES[player]} passes.`
  } else {
    highBid = bid
    bidder = player
    consecutivePasses = 0
    entry = `${PLAYER_NAMES[player]} bids ${bid}.`
  }
  const log = [...state.log, entry].slice(-22)

  if (highBid === null && consecutivePasses >= 4) {
    return {
      ...newHand(state.dealer, state.handNumber, state.matchScore, state.lastTrickBonusEnabled, state.handId + 1,
        'Everyone passed. The deal was reshuffled—try evaluating the next hand.'),
      version: state.version + 1,
    }
  }
  if (highBid !== null && bidder !== null && consecutivePasses >= 3) {
    return withVersion(state, {
      highBid, bidder, consecutivePasses, phase: 'trump', currentPlayer: bidder, log,
      message: `${PLAYER_NAMES[bidder]} won the auction at ${highBid}. ${bidder === 0 ? 'Choose your trump suit.' : 'The bidder is choosing trump.'}`,
    })
  }
  const nextPlayer = (player + 1) % 4
  return withVersion(state, {
    highBid, bidder, consecutivePasses, currentPlayer: nextPlayer, log,
    message: `${PLAYER_NAMES[nextPlayer]} to bid or pass.`,
  })
}

// Keep this helper separate so bidding decisions never need to inspect hidden opponents' cards.
export function chooseBotTrump(hand: Card[]): Suit {
  return bestTrump(hand)
}

export function chooseTrump(state: GameState, player: number, suit: Suit): GameState {
  if (state.phase !== 'trump' || state.bidder !== player) return state
  const completedHands = state.hands.map(hand => [...hand])
  const dealOrder = Array.from({ length: 4 }, (_, i) => (state.dealer + i + 1) % 4)
  let cursor = 0
  for (let r = 0; r < 4; r++) {
    for (const id of dealOrder) {
      if (state.deck[cursor]) completedHands[id].push(state.deck[cursor++])
    }
  }
  const trumpLog = player === 0
    ? `${PLAYER_NAMES[player]} chooses ${SUIT_LABEL[suit]} as trump.`
    : `${PLAYER_NAMES[player]} chooses a hidden trump suit.`
  const log = [...state.log, trumpLog, 'Four more cards dealt to each player.'].slice(-22)
  return withVersion(state, {
    phase: 'play', hands: completedHands, initialHands: completedHands.map(hand => [...hand]), deck: state.deck.slice(cursor),
    trumpSuit: suit, trumpRevealed: false, currentTrick: [], tricks: [], currentPlayer: (state.dealer + 1) % 4,
    message: `${PLAYER_NAMES[(state.dealer + 1) % 4]} leads. Trump is hidden until someone cannot follow suit.`, log,
  })
}

export function legalCards(hand: Card[], trick: PlayedCard[]): Card[] {
  if (trick.length === 0) return hand
  const ledSuit = trick[0].card.suit
  const follow = hand.filter(card => card.suit === ledSuit)
  return follow.length > 0 ? follow : hand
}

export function winnerOfTrick(plays: PlayedCard[], trumpSuit: Suit | null, trumpRevealed: boolean): number {
  if (plays.length === 0) return 0
  const ledSuit = plays[0].card.suit
  const trumps = trumpRevealed && trumpSuit ? plays.filter(play => play.card.suit === trumpSuit) : []
  const candidates = trumps.length ? trumps : plays.filter(play => play.card.suit === ledSuit)
  return candidates.reduce((best, current) => current.card.strength > best.card.strength ? current : best).player
}

function playUtility(state: GameState, trick: PlayedCard[], card: Card, player: number, revealed: boolean): number {
  const plays = [...trick, { player, card }]
  const winner = winnerOfTrick(plays, state.trumpSuit, revealed)
  const points = plays.reduce((sum, p) => sum + p.card.points, 0)
  const won = teamOf(winner) === teamOf(player)
  // Winning the trick is the strategic objective; conserve strong cards if the outcome is unchanged.
  return (won ? 5 + points : -5 - points) - card.strength * 0.28 + card.points * 0.12
}

export function chooseBotCard(state: GameState, player: number): Card {
  const hand = state.hands[player]
  const options = legalCards(hand, state.currentTrick)
  const trick = state.currentTrick
  const ledSuit = trick[0]?.card.suit
  const becomesRevealed = state.trumpRevealed || (!!ledSuit && !hand.some(c => c.suit === ledSuit))
  if (trick.length === 3) {
    return [...options].sort((a, b) => {
      const delta = playUtility(state, trick, b, player, becomesRevealed) - playUtility(state, trick, a, player, becomesRevealed)
      return delta || a.strength - b.strength
    })[0]
  }
  if (trick.length > 0) {
    const currentWinner = winnerOfTrick(trick, state.trumpSuit, state.trumpRevealed || becomesRevealed)
    if (teamOf(currentWinner) === teamOf(player)) {
      // Help a partner who is already ahead; avoid burning a control card unnecessarily.
      return [...options].sort((a, b) => (a.points + a.strength * 0.32) - (b.points + b.strength * 0.32))[0]
    }
    const currentlyWinning = trick.reduce((best, play) => {
      const temp = [...trick.slice(0, trick.indexOf(play) + 1)]
      return winnerOfTrick(temp, state.trumpSuit, state.trumpRevealed || becomesRevealed) === play.player ? play : best
    }, trick[0])
    const canBeat = options.filter(card => {
      const nowRevealed = state.trumpRevealed || (!!ledSuit && card.suit !== ledSuit)
      return teamOf(winnerOfTrick([...trick, { player, card }], state.trumpSuit, nowRevealed)) === teamOf(player)
    })
    if (canBeat.length) return [...canBeat].sort((a, b) => (a.strength + a.points * 0.3) - (b.strength + b.points * 0.3))[0]
    void currentlyWinning
  }
  // Lead a high card from a suit where this hand has control, while avoiding zero-purpose low trump leads.
  return [...options].sort((a, b) => {
    const scoreA = a.strength + suitPower(hand, a.suit) * 0.3 + (state.trumpRevealed && a.suit === state.trumpSuit ? 0.25 : 0)
    const scoreB = b.strength + suitPower(hand, b.suit) * 0.3 + (state.trumpRevealed && b.suit === state.trumpSuit ? 0.25 : 0)
    return scoreB - scoreA
  })[0]
}

function analyzeKnownOpportunity(state: GameState, player: number, card: Card, trickBefore: PlayedCard[], legal: Card[], wasRevealed: boolean): MistakeNote | null {
  if (trickBefore.length !== 3 || legal.length < 2) return null
  const ledSuit = trickBefore[0].card.suit
  const revealFor = (candidate: Card) => wasRevealed || candidate.suit !== ledSuit
  const scores = legal.map(candidate => ({
    candidate,
    score: playUtility(state, trickBefore, candidate, player, revealFor(candidate)),
    winner: winnerOfTrick([...trickBefore, { player, card: candidate }], state.trumpSuit, revealFor(candidate)),
  })).sort((a, b) => b.score - a.score)
  const selected = scores.find(item => item.candidate.id === card.id)!
  const best = scores[0]
  if (best.candidate.id !== card.id && best.score - selected.score >= 2.5 && teamOf(best.winner) === teamOf(player) && teamOf(selected.winner) !== teamOf(player)) {
    return {
      trickNumber: state.tricks.length + 1,
      level: 'opportunity',
      title: 'A valuable trick was left on the table',
      detail: `${cardText(card)} let the opponents keep the trick. ${cardText(best.candidate)} would have won it for your team based on the cards already visible.`,
      chosenCard: cardText(card), betterCard: cardText(best.candidate),
    }
  }
  if (best.candidate.id !== card.id && best.score - selected.score >= 2.0 && teamOf(best.winner) === teamOf(selected.winner) && teamOf(selected.winner) === teamOf(player) && selected.candidate.strength - best.candidate.strength >= 2) {
    return {
      trickNumber: state.tricks.length + 1,
      level: 'efficiency',
      title: 'You spent more control than needed',
      detail: `${cardText(best.candidate)} would have kept the trick with your team while preserving ${cardText(card)} as a stronger control card for later.`,
      chosenCard: cardText(card), betterCard: cardText(best.candidate),
    }
  }
  return null
}

export function playCard(state: GameState, player: number, cardId: string): GameState {
  if (state.phase !== 'play' || state.currentPlayer !== player) return state
  const handBefore = state.hands[player]
  const legal = legalCards(handBefore, state.currentTrick)
  const card = legal.find(c => c.id === cardId)
  if (!card) return state
  const trickBefore = [...state.currentTrick]
  const wasRevealed = state.trumpRevealed
  const ledSuit = trickBefore[0]?.card.suit
  const voidInLedSuit = !!ledSuit && !handBefore.some(c => c.suit === ledSuit)
  const revealsNow = !wasRevealed && voidInLedSuit
  const trumpRevealed = wasRevealed || revealsNow
  const nextHand = handBefore.filter(c => c.id !== card.id)
  const hands = state.hands.map((h, i) => i === player ? nextHand : h)
  const currentTrick = [...trickBefore, { player, card }]
  const decisions = player === 0 ? [...state.decisions, {
    trickNumber: state.tricks.length + 1,
    card,
    handBefore: [...handBefore],
    trickBefore,
    completedTricksBefore: state.tricks.map(trick => ({ ...trick, plays: [...trick.plays] })),
    legalCards: [...legal],
    trumpSuit: state.trumpSuit,
    knownTrumpSuit: (wasRevealed || state.bidder === player) ? state.trumpSuit : null,
    trumpRevealed: wasRevealed,
    player,
    bidder: state.bidder,
    highBid: state.highBid,
    dealer: state.dealer,
    matchScore: [...state.matchScore] as [number, number],
    lastTrickBonusEnabled: state.lastTrickBonusEnabled,
  }] : state.decisions
  const logEntry = revealsNow ? `${PLAYER_NAMES[player]} cannot follow ${SUIT_LABEL[ledSuit!]}—trump is revealed: ${SUIT_LABEL[state.trumpSuit!]}.` : `${PLAYER_NAMES[player]} plays ${cardText(card)}.`
  let next: GameState = withVersion(state, {
    hands, currentTrick, trumpRevealed, decisions,
    log: [...state.log, logEntry].slice(-28),
    message: revealsNow ? `Trump revealed: ${SUIT_LABEL[state.trumpSuit!]} can now beat other suits.` : `${PLAYER_NAMES[player]} played ${cardText(card)}.`,
  })
  if (currentTrick.length < 4) {
    next.currentPlayer = (player + 1) % 4
    next.version = state.version + 1
    return next
  }
  const winner = winnerOfTrick(currentTrick, state.trumpSuit, trumpRevealed)
  const cardPoints = currentTrick.reduce((sum, play) => sum + play.card.points, 0)
  const isLast = state.tricks.length === 7
  const bonus = isLast && state.lastTrickBonusEnabled ? 1 : 0
  const trickRecord: TrickRecord = {
    number: state.tricks.length + 1,
    leader: currentTrick[0].player,
    plays: currentTrick,
    winner,
    points: cardPoints + bonus,
    cardPoints,
    bonus,
  }
  const tricks = [...state.tricks, trickRecord]
  next = {
    ...next,
    currentTrick: [],
    tricks,
    currentPlayer: winner,
    message: `${PLAYER_NAMES[winner]} wins trick ${trickRecord.number} with ${trickRecord.points} point${trickRecord.points === 1 ? '' : 's'}.`,
    log: [...next.log, `${PLAYER_NAMES[winner]} wins trick ${trickRecord.number} (${trickRecord.points} pts).`].slice(-28),
  }
  if (tricks.length === 8) return finishHand(next)
  return next
}

function finishHand(state: GameState): GameState {
  const cardPoints: [number, number] = [0, 0]
  const pointTotals: [number, number] = [0, 0]
  for (const trick of state.tricks) {
    const team = teamOf(trick.winner)
    cardPoints[team] += trick.cardPoints
    pointTotals[team] += trick.points
  }
  const bidder = state.bidder ?? 0
  const contractTeam = teamOf(bidder)
  const bid = state.highBid ?? 16
  const success = pointTotals[contractTeam] >= bid
  const scoreAfter: [number, number] = [...state.matchScore]
  scoreAfter[contractTeam] += success ? 1 : -1
  let matchWinner: Team | null = null
  if (scoreAfter[0] >= 6 || scoreAfter[1] <= -6) matchWinner = 0
  if (scoreAfter[1] >= 6 || scoreAfter[0] <= -6) matchWinner = 1
  const notes = state.decisions.map(decision => analyzeKnownOpportunity(
    { ...state, trumpSuit: decision.trumpSuit }, decision.player, decision.card,
    decision.trickBefore, decision.legalCards, decision.trumpRevealed,
  )).filter((note): note is MistakeNote => note !== null)
  const review: HandReview = {
    bid, bidder, trumpSuit: state.trumpSuit ?? 'spades', success, contractTeam,
    teamPoints: pointTotals, cardPoints, lastTrickBonus: state.lastTrickBonusEnabled ? 1 : 0,
    scoreAfter, matchWinner, notes,
  }
  return {
    ...state,
    phase: 'review',
    matchScore: scoreAfter,
    currentTrick: [],
    review,
    message: success ? `Contract made: ${PLAYER_NAMES[bidder]} bid ${bid} and the team captured ${pointTotals[contractTeam]}.` : `Contract failed: ${PLAYER_NAMES[bidder]} bid ${bid}, but the team captured ${pointTotals[contractTeam]}.`,
    version: state.version + 1,
  }
}

export function botHint(state: GameState): string {
  if (state.phase === 'auction') {
    if (state.highBid === null) return 'Bid only when your four cards suggest a realistic trump suit. A Jack–Nine combination is a strong starting point, but count suit length too.'
    return `The current bid is ${state.highBid}. Ask whether your best suit gives enough control to justify ${state.highBid + 1}; do not raise just to win the auction.`
  }
  if (state.phase === 'trump') return 'Compare trump strength and length. The Jack and Nine are powerful together; a long suit without high cards is not automatically the best choice.'
  if (state.phase !== 'play') return 'Review the cards that were known when you acted. Do not judge a reasonable move only by the hidden cards revealed afterward.'
  const hand = state.hands[0]
  if (state.currentTrick.length === 0) {
    return state.trumpRevealed
      ? 'Lead from a suit where your team may control the highest remaining card. Avoid spending a trump without a clear reason.'
      : 'Before trump is revealed, only the led suit matters. A high card can collect points, but remember that a void player may reveal trump.'
  }
  const ledSuit = state.currentTrick[0].card.suit
  if (!hand.some(c => c.suit === ledSuit) && !state.trumpRevealed) {
    return 'You are void in the led suit. Playing any off-suit card reveals trump in this ruleset, which can change who wins this trick.'
  }
  const currentWinner = winnerOfTrick(state.currentTrick, state.trumpSuit, state.trumpRevealed)
  if (teamOf(currentWinner) === 0) {
    return 'Your side is currently ahead. If the lead is safe, contribute a useful point card when appropriate and preserve strong control cards.'
  }
  return 'Your opponents are currently ahead. Look for the cheapest legal card that can overtake the winner; if you cannot win, avoid donating point cards.'
}

export function totalPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.points, 0)
}
