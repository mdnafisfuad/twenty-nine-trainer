export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Phase = 'auction' | 'trump' | 'stake' | 'play' | 'review'
export type Team = 0 | 1

export interface RuleSet {
  /** Award one extra point to the winner of the eighth trick. */
  lastTrickBonus: boolean
  /** Allow the K+Q of trump to be declared as a royal pair. */
  pair: boolean
  /** Allow the bidder to call for the seventh card instead of naming trump. */
  seventhCard: boolean
  /** Allow the defending team to double and the declaring team to redouble. */
  double: boolean
  /** Allow the bidder to declare a no-trump reverse, where the ranking flips on reveal. */
  reverse: boolean
  /** Allow the bidder to pair a named trump with the reversed ranking. */
  reverseTrump: boolean
}

export const DEFAULT_RULES: RuleSet = {
  lastTrickBonus: false,
  pair: true,
  seventhCard: true,
  double: true,
  reverse: false,
  reverseTrump: false,
}

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

export interface PairDeclaration {
  player: number
  team: Team
  trickNumber: number
  effect: 'reduce' | 'raise'
}

export interface AuctionAction {
  player: number
  bid: number | null
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
  /** True when the contract uses the reversed ranking (7 high, J low) once revealed. */
  reverse: boolean
  /** True when this player knew the reverse at decision time. */
  knownReverse: boolean
  indicatorSuit: Suit | null
  trumpRevealed: boolean
  /** Set when this player exposed the hidden contract; they must trump this trick if able. */
  mustTrump: number | null
  player: number
  bidder: number | null
  highBid: number | null
  dealer: number
  matchScore: [number, number]
  rules: RuleSet
  pair: PairDeclaration | null
  stake: 1 | 2 | 4
  seventhCard: Card | null
}

export interface MistakeNote {
  trickNumber: number
  level: 'opportunity' | 'efficiency' | 'good'
  title: string
  detail: string
  chosenCard?: string
  betterCard?: string
  /** Card points that changed hands because of this decision, when known. */
  pointsAtStake?: number
}

export interface BidRecord {
  hand: Card[]
  bid: number | null
  highBidBefore: number | null
  partnerWasHigh: boolean
  advisedBid: number
  bestSuit: Suit
  power: number
}

export interface BidReview {
  verdict: 'good' | 'aggressive' | 'timid'
  title: string
  detail: string
  advised: number
  actual: number | null
}

export interface HandReview {
  bid: number
  /** The bid after any royal-pair adjustment. */
  target: number
  bidder: number
  trumpSuit: Suit | null
  reverse: boolean
  indicatorSuit: Suit | null
  success: boolean
  contractTeam: Team
  teamPoints: [number, number]
  cardPoints: [number, number]
  lastTrickBonus: number
  pair: PairDeclaration | null
  stake: 1 | 2 | 4
  scoreDelta: number
  scoreAfter: [number, number]
  matchWinner: Team | null
  notes: MistakeNote[]
  bidReview: BidReview | null
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
  /** The auction is over and stays on screen until the player continues. */
  auctionComplete: boolean
  trumpSuit: Suit | null
  trumpRevealed: boolean
  /** The player who exposed the hidden contract this trick; they must play trump if able. */
  mustTrump: number | null
  /** Ranking-flip contract; with no trump suit this is a no-trump reverse. */
  reverse: boolean
  /** Display suit of the 2-card reverse indicator for a no-trump reverse. It has no effect on play. */
  indicatorSuit: Suit | null
  /** The bidder's seventh card, set aside until trump is declared. */
  seventhCard: Card | null
  currentTrick: PlayedCard[]
  tricks: TrickRecord[]
  /** A completed trick held on screen until the player continues. */
  pausedTrick: TrickRecord | null
  matchScore: [number, number]
  handNumber: number
  handId: number
  rules: RuleSet
  pair: PairDeclaration | null
  stake: 1 | 2 | 4
  stakeStage: 'defend' | 'redouble' | null
  auctionActions: AuctionAction[]
  message: string
  log: string[]
  decisions: DecisionRecord[]
  review: HandReview | null
  bidRecords: BidRecord[]
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
export const maxBidFor = (rules: RuleSet) => rules.lastTrickBonus ? 29 : 28

/** Second-person copy for the human, third-person copy for the bots. */
const act = (player: number, third: string, second: string) => player === 0 ? `You ${second}` : `${PLAYER_NAMES[player]} ${third}`
const leadLine = (player: number) => player === 0 ? 'You lead' : `${PLAYER_NAMES[player]} leads`

function makeDeck(): Card[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
    points: rankPoint[rank],
    strength: rankStrength[rank],
  })))
}

/** A pristine 32-card deck; callers must copy before mutating. */
export const FULL_DECK: readonly Card[] = makeDeck()

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
  rules: RuleSet = DEFAULT_RULES,
  handId = 1,
  message = 'Four cards each. Read the hand, then bid with a plan.',
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
    auctionComplete: false,
    trumpSuit: null,
    trumpRevealed: false,
    mustTrump: null,
    reverse: false,
    indicatorSuit: null,
    seventhCard: null,
    currentTrick: [],
    tricks: [],
    pausedTrick: null,
    matchScore: [...matchScore],
    handNumber,
    handId,
    rules: {
      lastTrickBonus: rules.lastTrickBonus === true,
      pair: rules.pair !== false,
      seventhCard: rules.seventhCard !== false,
      double: rules.double !== false,
      reverse: rules.reverse === true,
      reverseTrump: rules.reverseTrump === true,
    },
    pair: null,
    stake: 1,
    stakeStage: null,
    auctionActions: [],
    message,
    log: ['Four cards dealt to each player. Auction started.'],
    decisions: [],
    review: null,
    bidRecords: [],
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

/**
 * Maps a suit's raw power score to the highest contract the bot model considers reasonable.
 * Kept separate so the coach and the bots reason from the same thresholds.
 */
export function bidCeiling(power: number): number {
  if (power >= 8.3) return 22
  if (power >= 7.2) return 20
  if (power >= 6.2) return 19
  if (power >= 5.35) return 18
  if (power >= 4.65) return 17
  if (power >= 4.0) return 16
  return 15
}

export interface OpeningReport {
  suit: Suit
  power: number
  points: number
  /** Highest contract the raw suit strength supports. */
  ceiling: number
  /** Ceiling nudged by point density; the friendly coaching number. */
  advised: number
  /** True when the opening four already hold the K+Q of the best suit. */
  pairPotential: boolean
}

/** Evaluate the four opening cards only. Policy must never look at opponents' hands. */
export function openingReport(cards: Card[]): OpeningReport {
  const suit = bestTrump(cards)
  const power = suitPower(cards, suit)
  const points = totalPoints(cards)
  const ceiling = bidCeiling(power)
  let advised = ceiling
  if (ceiling >= 16) {
    if (points >= 7) advised += 1
    else if (points <= 2) advised -= 1
  }
  const pairPotential = cards.some(c => c.suit === suit && c.rank === 'K')
    && cards.some(c => c.suit === suit && c.rank === 'Q')
  return { suit, power, points, ceiling, advised, pairPotential }
}

function withVersion(state: GameState, changes: Partial<GameState>): GameState {
  return { ...state, ...changes, version: state.version + 1 }
}

export function botBid(state: GameState, player: number): number | null {
  const hand = state.hands[player]
  const report = openingReport(hand)
  const maxBid = maxBidFor(state.rules)
  const partner = (player + 2) % 4
  const partnerActions = state.auctionActions.filter(action => action.player === partner)
  const partnerBid = partnerActions.reduce((best, action) => action.bid !== null && action.bid > best ? action.bid : best, 0)
  const partnerHigh = state.bidder !== null && teamOf(state.bidder) === teamOf(player)

  // Never outbid partner just because the raw suit score allows it. Partner owns the
  // trump choice, and raising over them only increases the target the team must make.
  if (partnerHigh) return null

  // A deterministic pseudo-random roll keeps bluffs reproducible for a given auction
  // state. Thin hands are the ones with a playable suit but a sub-16 projection.
  const roll = (state.handId * 7919 + player * 104729 + state.auctionActions.length * 31 + (state.highBid ?? 0) * 17) % 100
  const thin = report.advised === 15 && report.power >= 3.6 && report.points >= 4
  const aggressive = report.points >= 6 || report.pairPotential
  const pressure = state.consecutivePasses >= 2 ? 10 : 0
  const bluff = roll < (thin ? 24 : 8) + pressure

  if (state.highBid === null) {
    if (report.advised >= 19) return Math.min(maxBid, 17)
    if (report.advised >= 16) return 16
    // Occasionally steal a cheap opening with a thin but playable four-card hand.
    if (thin && bluff) return 16
    return null
  }

  const nextBid = state.highBid + 1
  if (nextBid > maxBid) return null

  // A raise needs more than the bare minimum: without a partner bid, the hand should
  // project at least one level above the contract being taken on. A high contested bid
  // gets a further cushion because the opponent's bid is evidence the deal is not soft.
  // Aggressive hands and partner support earn a one-level discount; the pair can earn one more.
  const opponentHigh = state.bidder !== null && teamOf(state.bidder) !== teamOf(player)
  const contested = opponentHigh ? (state.highBid >= 21 ? 2 : state.highBid >= 18 ? 1 : 0) : 0
  const partnerSupport = partnerBid > 0 ? 1 : 0
  const pairDiscount = state.rules.pair && report.pairPotential ? 1 : 0
  const aggression = aggressive ? 1 : 0
  const needed = nextBid + (partnerSupport ? 0 : 1) + contested - pairDiscount - aggression
  if (report.advised >= needed && report.ceiling >= nextBid) return nextBid

  // Pressure raise: one level thin, but only with a real suit and some point density.
  // This is the thoughtful bluff: it never jumps the auction, and it stops at high levels.
  const thinRaise = state.highBid <= 18 && report.advised >= nextBid - 1 && report.power >= 3.8 && report.points >= 4
  if (thinRaise && bluff) return nextBid
  // Low-level contest: with a playable suit, occasionally take the fight to 17 or 18
  // rather than conceding the auction on the first opposing bid.
  const contest = state.highBid <= 17 && report.advised >= state.highBid - 1 && report.power >= 3.9 && report.points >= 3
  if (contest && roll < 35) return nextBid
  return null
}

export function applyBid(state: GameState, player: number, bid: number | null): GameState {
  if (state.phase !== 'auction' || state.currentPlayer !== player || state.auctionComplete) return state
  const maxBid = maxBidFor(state.rules)
  if (bid !== null && (bid < 16 || bid > maxBid || (state.highBid !== null && bid <= state.highBid))) return state
  let highBid = state.highBid
  let bidder = state.bidder
  let consecutivePasses = state.consecutivePasses
  let entry = ''
  if (bid === null) {
    consecutivePasses += 1
    entry = `${act(player, 'passes', 'pass')}.`
  } else {
    highBid = bid
    bidder = player
    consecutivePasses = 0
    entry = `${act(player, `bids ${bid}`, `bid ${bid}`)}.`
  }
  const log = [...state.log, entry].slice(-28)
  const auctionActions = [...state.auctionActions, { player, bid }]
  // Keep the human's auction reasoning so the post-hand review can judge the bid, not only card play.
  let bidRecords = state.bidRecords
  if (player === 0) {
    const report = openingReport(state.hands[0])
    bidRecords = [...state.bidRecords, {
      hand: [...state.hands[0]],
      bid,
      highBidBefore: state.highBid,
      partnerWasHigh: state.bidder !== null && teamOf(state.bidder) === teamOf(0),
      advisedBid: report.advised,
      bestSuit: report.suit,
      power: report.power,
    }]
  }

  if (highBid === null && consecutivePasses >= 4) {
    return {
      ...newHand(state.dealer, state.handNumber, state.matchScore, state.rules, state.handId + 1,
        'Everyone passed. The deal was reshuffled—try evaluating the next hand.'),
      version: state.version + 1,
    }
  }
  if (highBid !== null && bidder !== null && consecutivePasses >= 3) {
    return withVersion(state, {
      highBid, bidder, consecutivePasses, phase: 'auction', currentPlayer: bidder, auctionComplete: true,
      log, bidRecords, auctionActions,
      message: `${PLAYER_NAMES[bidder]} won the auction at ${highBid}. Review the auction, then continue to choose trump.`,
    })
  }
  const nextPlayer = (player + 1) % 4
  return withVersion(state, {
    highBid, bidder, consecutivePasses, currentPlayer: nextPlayer, log, bidRecords, auctionActions,
    message: nextPlayer === 0 ? 'Your turn to bid or pass.' : `${PLAYER_NAMES[nextPlayer]} to bid or pass.`,
  })
}

/** Keep the finished auction on screen until the player is ready to choose trump. */
export function continueAfterAuction(state: GameState): GameState {
  if (state.phase !== 'auction' || !state.auctionComplete) return state
  const bidder = state.bidder ?? 0
  return withVersion(state, {
    phase: 'trump',
    auctionComplete: false,
    currentPlayer: bidder,
    message: bidder === 0
      ? 'You won the auction.'
      : `${PLAYER_NAMES[bidder]} is choosing trump.`,
  })
}

/**
 * Keep this helper separate so bidding decisions never need to inspect hidden opponents' cards.
 * A held K+Q is worth a little extra because the royal pair can move the target by four.
 */
export function chooseBotTrump(hand: Card[]): Suit {
  return SUITS.reduce((best, suit) => {
    const pairBonus = hand.some(card => card.suit === suit && card.rank === 'K')
      && hand.some(card => card.suit === suit && card.rank === 'Q') ? 0.7 : 0
    const bestPairBonus = hand.some(card => card.suit === best && card.rank === 'K')
      && hand.some(card => card.suit === best && card.rank === 'Q') ? 0.7 : 0
    return suitPower(hand, suit) + pairBonus > suitPower(hand, best) + bestPairBonus ? suit : best
  }, SUITS[0])
}

/** Deal the second four cards; optionally set aside the bidder's seventh card. */
function completeDeal(state: GameState, setAsideSeventh: boolean): { hands: Card[][]; seventhCard: Card | null } {
  const hands = state.hands.map(hand => [...hand])
  const dealOrder = Array.from({ length: 4 }, (_, i) => (state.dealer + i + 1) % 4)
  const bidder = state.bidder
  let cursor = 0
  let seventhCard: Card | null = null
  for (let round = 0; round < 4; round++) {
    for (const id of dealOrder) {
      const card = state.deck[cursor++]
      if (!card) continue
      // The bidder's seventh card is the third card of the second deal.
      if (setAsideSeventh && round === 2 && id === bidder) seventhCard = card
      hands[id].push(card)
    }
  }
  if (seventhCard && bidder !== null) {
    hands[bidder] = hands[bidder].filter(card => card.id !== seventhCard!.id)
  }
  return { hands, seventhCard }
}

function startPlay(
  state: GameState,
  hands: Card[][],
  trumpSuit: Suit | null,
  seventhCard: Card | null,
  log: string[],
  message: string,
  reverse = false,
  indicatorSuit: Suit | null = null,
): GameState {
  const leader = (state.dealer + 1) % 4
  const needsStake = state.rules.double
  return withVersion(state, {
    phase: needsStake ? 'stake' : 'play',
    hands,
    initialHands: hands.map(hand => [...hand]),
    deck: [],
    auctionComplete: false,
    trumpSuit,
    trumpRevealed: false,
    mustTrump: null,
    reverse,
    indicatorSuit,
    seventhCard,
    currentTrick: [],
    tricks: [],
    pausedTrick: null,
    currentPlayer: leader,
    pair: null,
    stake: 1,
    stakeStage: needsStake ? 'defend' : null,
    log,
    message: needsStake
      ? 'Defenders may double the stakes before the first trick.'
      : message,
  })
}

export function chooseTrump(state: GameState, player: number, suit: Suit): GameState {
  if (state.phase !== 'trump' || state.bidder !== player) return state
  const { hands } = completeDeal(state, false)
  const trumpLog = player === 0
    ? `You choose ${SUIT_LABEL[suit]} as trump.`
    : `${PLAYER_NAMES[player]} chooses a hidden trump suit.`
  const log = [...state.log, trumpLog, 'Four more cards dealt to each player.'].slice(-28)
  return startPlay(state, hands, suit, null, log,
    `${leadLine((state.dealer + 1) % 4)}. Trump stays hidden until a void player calls for it.`)
}

/** The bidder calls the seventh card instead of naming a suit. */
export function chooseSeventhCard(state: GameState, player: number): GameState {
  if (state.phase !== 'trump' || state.bidder !== player || !state.rules.seventhCard) return state
  const { hands, seventhCard } = completeDeal(state, true)
  if (!seventhCard) return chooseTrump(state, player, chooseBotTrump(state.hands[player]))
  const log = [
    ...state.log,
    player === 0 ? 'You call for the seventh card. The trump suit stays hidden.' : `${PLAYER_NAMES[player]} calls for the seventh card.`,
    'Four more cards dealt to each player. The seventh card is set aside.',
  ].slice(-28)
  return startPlay(state, hands, seventhCard.suit, seventhCard, log,
    `${leadLine((state.dealer + 1) % 4)}. Trump stays hidden until a void player calls for it.`)
}

/** The 2 is only a table indicator for reverse; its suit does not become trump. */
export function reverseIndicatorSuit(hand: Card[]): Suit {
  return SUITS.reduce((best, suit) => {
    const count = hand.filter(card => card.suit === suit).length
    const bestCount = hand.filter(card => card.suit === best).length
    return count < bestCount ? suit : best
  }, SUITS[0])
}

/**
 * Reverse is a ranking-flip contract. Without a trump suit the table indicator is a 2;
 * when it is revealed, the ranking flips (7 high, J low) for that trick and every later trick.
 */
export function chooseReverse(state: GameState, player: number): GameState {
  if (state.phase !== 'trump' || state.bidder !== player || !state.rules.reverse) return state
  const { hands } = completeDeal(state, false)
  const indicatorSuit = reverseIndicatorSuit(state.hands[player] ?? [])
  const log = [
    ...state.log,
    player === 0 ? 'You declare Reverse—no trump.' : `${PLAYER_NAMES[player]} sets a hidden contract.`,
    'Four more cards dealt to each player. The 2 indicator is set aside.',
  ].slice(-28)
  return startPlay(state, hands, null, null, log,
    `${leadLine((state.dealer + 1) % 4)}. The contract stays hidden until a void player calls for it.`,
    true, indicatorSuit)
}

/**
 * The reverse-with-trump variant keeps a named trump suit and uses the flipped ranking:
 * the trump 7 is the strongest card on the table, while the trump J is the weakest trump.
 */
export function chooseReverseTrump(state: GameState, player: number, suit: Suit): GameState {
  if (state.phase !== 'trump' || state.bidder !== player || !state.rules.reverseTrump) return state
  const { hands } = completeDeal(state, false)
  const log = [
    ...state.log,
    player === 0 ? `You declare Reverse with ${SUIT_LABEL[suit]} as trump.` : `${PLAYER_NAMES[player]} sets a hidden contract.`,
    'Four more cards dealt to each player.',
  ].slice(-28)
  return startPlay(state, hands, suit, null, log,
    `${leadLine((state.dealer + 1) % 4)}. Trump and the reverse ranking stay hidden until a void player calls for them.`,
    true)
}

/**
 * Resolve one double/redouble decision. The defending side acts first; if they double,
 * the declaring side may redouble. The multiplier is applied to the match score.
 */
export function resolveStake(state: GameState, double: boolean): GameState {
  if (state.phase !== 'stake' || !state.stakeStage) return state
  if (state.stakeStage === 'defend') {
    if (double) {
      return withVersion(state, {
        stake: 2,
        stakeStage: 'redouble',
        log: [...state.log, 'The defending team doubles. The hand is worth 2 match points.'].slice(-28),
        message: 'The declaring team may redouble. The hand is now worth 2 match points.',
      })
    }
    return withVersion(state, {
      phase: 'play',
      stake: 1,
      stakeStage: null,
      log: [...state.log, 'The defenders decline to double.'].slice(-28),
      message: `${leadLine(state.currentPlayer)} the first trick.`,
    })
  }
  if (double) {
    return withVersion(state, {
      phase: 'play',
      stake: 4,
      stakeStage: null,
      log: [...state.log, 'The declaring team redoubles. The hand is worth 4 match points.'].slice(-28),
      message: `${leadLine(state.currentPlayer)}. The hand is worth 4 match points.`,
    })
  }
  return withVersion(state, {
    phase: 'play',
    stake: 2,
    stakeStage: null,
    log: [...state.log, 'The declaring team does not redouble.'].slice(-28),
    message: `${leadLine(state.currentPlayer)}. The hand is worth 2 match points.`,
  })
}

/** A conservative defender heuristic that uses only the defender's own hand and public bid. */
export function botDoubleDecision(state: GameState, player: number): boolean {
  if (state.stakeStage !== 'defend' || state.bidder === null || state.highBid === null) return false
  if (teamOf(state.bidder) === teamOf(player)) return false
  const hand = state.hands[player] ?? []
  const power = Math.max(...SUITS.map(suit => suitPower(hand, suit)))
  const points = totalPoints(hand)
  if (state.highBid >= 24) return true
  if (state.highBid >= 21 && (power >= 4.9 || points >= 6)) return true
  if (state.highBid >= 18 && power >= 5.6 && points >= 5) return true
  return false
}

/** A conservative declarer heuristic. The bidder may use the trump suit; a partner may not. */
export function botRedoubleDecision(state: GameState, player: number): boolean {
  if (state.stakeStage !== 'redouble' || state.bidder === null || state.highBid === null) return false
  if (teamOf(state.bidder) !== teamOf(player)) return false
  const hand = state.hands[player] ?? []
  const knowsTrump = player === state.bidder && state.trumpSuit
  const power = knowsTrump
    ? suitPower(hand, state.trumpSuit!)
    : Math.max(...SUITS.map(suit => suitPower(hand, suit)))
  const points = totalPoints(hand)
  if (state.highBid <= 17 && (power >= 5.2 || points >= 8)) return true
  if (state.highBid <= 20 && power >= 6.3) return true
  return false
}

/** The bid after any royal-pair adjustment. */
export function contractTarget(state: Pick<GameState, 'highBid' | 'bidder' | 'pair' | 'rules'>): number {
  if (state.highBid === null) return 0
  if (!state.pair || state.bidder === null) return state.highBid
  const maxBid = maxBidFor(state.rules)
  const delta = state.pair.team === teamOf(state.bidder) ? -4 : 4
  // A royal pair can never push the contract below the opening minimum.
  return Math.max(16, Math.min(maxBid, state.highBid + delta))
}

/** A player may declare K+Q of trump after their side wins a trick, while both cards are still held. */
export function pairEligible(state: GameState, player: number): boolean {
  if (!state.rules.pair || state.pair || !state.trumpRevealed || !state.trumpSuit || state.phase !== 'play') return false
  const lastTrick = state.tricks[state.tricks.length - 1]
  if (!lastTrick || teamOf(lastTrick.winner) !== teamOf(player)) return false
  const hand = state.hands[player] ?? []
  return hand.some(card => card.suit === state.trumpSuit && card.rank === 'K')
    && hand.some(card => card.suit === state.trumpSuit && card.rank === 'Q')
}

export function declarePair(state: GameState, player: number): GameState {
  if (!pairEligible(state, player)) return state
  const lastTrick = state.tricks[state.tricks.length - 1]
  const effect = teamOf(player) === teamOf(state.bidder ?? 0) ? 'reduce' : 'raise'
  const pair: PairDeclaration = { player, team: teamOf(player), trickNumber: lastTrick.number, effect }
  const declarer = act(player, 'declares', 'declare')
  return withVersion(state, {
    pair,
    log: [...state.log, `${declarer} the royal pair. ${effect === 'reduce' ? 'The contract target drops by 4.' : 'The contract target rises by 4.'}`].slice(-28),
    message: `${declarer} the royal pair. The bidding team now needs ${contractTarget({ ...state, pair })} points.`,
  })
}

function autoDeclareBotPairs(state: GameState): GameState {
  let next = state
  for (const player of [2, 1, 3]) {
    if (pairEligible(next, player)) next = declarePair(next, player)
  }
  return next
}

export function legalCards(hand: Card[], trick: PlayedCard[]): Card[] {
  if (trick.length === 0) return hand
  const ledSuit = trick[0].card.suit
  const follow = hand.filter(card => card.suit === ledSuit)
  return follow.length > 0 ? follow : hand
}

/**
 * True when the player is void in the led suit and may choose to expose the hidden contract.
 * The reveal is optional; a player may instead discard without revealing.
 */
export function canExposeContract(state: GameState, player: number): boolean {
  if (state.phase !== 'play' || state.pausedTrick || state.trumpRevealed) return false
  if (!state.reverse && !state.trumpSuit) return false
  const ledSuit = state.currentTrick[0]?.card.suit
  if (!ledSuit) return false
  return !(state.hands[player] ?? []).some(card => card.suit === ledSuit)
}

/**
 * Legal cards including the bidder's set-aside seventh card. It may not be led unless it is the
 * bidder's last card, and may only be played when the bidder cannot follow from the hand.
 * After exposing the hidden contract, the revealer must play a trump if one is available.
 */
export function legalCardsFor(state: GameState, player: number): Card[] {
  const hand = state.hands[player] ?? []
  const trick = state.currentTrick
  const base = legalCards(hand, trick)
  const seventh = state.seventhCard
  let cards = base
  if (seventh && !state.trumpRevealed && state.bidder === player) {
    if (trick.length === 0) {
      cards = hand.length === 0 ? [seventh] : base
    } else {
      const ledSuit = trick[0].card.suit
      const canFollow = hand.some(card => card.suit === ledSuit)
      cards = canFollow ? base : [...base, seventh]
    }
  }
  if (state.mustTrump === player && state.trumpSuit && trick.length > 0) {
    const ledSuit = trick[0].card.suit
    const canFollow = hand.some(card => card.suit === ledSuit)
    if (!canFollow) {
      const trumps = cards.filter(card => card.suit === state.trumpSuit)
      if (trumps.length) return trumps
    }
  }
  return cards
}

/** Reverse swaps the ranking: 7 becomes high and J low. Point values never change. */
export function cardStrength(card: Card, reverse: boolean): number {
  return reverse ? 9 - card.strength : card.strength
}

export function winnerOfTrick(plays: PlayedCard[], trumpSuit: Suit | null, trumpRevealed: boolean, reverse = false): number {
  if (plays.length === 0) return 0
  const ledSuit = plays[0].card.suit
  const trumps = trumpRevealed && trumpSuit ? plays.filter(play => play.card.suit === trumpSuit) : []
  const candidates = trumps.length ? trumps : plays.filter(play => play.card.suit === ledSuit)
  const strength = (play: PlayedCard) => cardStrength(play.card, reverse)
  return candidates.reduce((best, current) => strength(current) > strength(best) ? current : best).player
}

function playUtility(state: GameState, trick: PlayedCard[], card: Card, player: number, revealed: boolean, reverse: boolean, bonus = 0): number {
  const plays = [...trick, { player, card }]
  const winner = winnerOfTrick(plays, state.trumpSuit, revealed, reverse)
  const points = plays.reduce((sum, p) => sum + p.card.points, 0) + bonus
  const won = teamOf(winner) === teamOf(player)
  // Winning the trick is the strategic objective; conserve strong cards if the outcome is unchanged.
  return (won ? 5 + points : -5 - points) - cardStrength(card, reverse) * 0.28 + card.points * 0.12
}

/** Public cards this seat has not seen. Deliberately excludes every other player's hand. */
function publicUnseenCards(state: GameState, player: number): Card[] {
  const known = new Set((state.hands[player] ?? []).map(card => card.id))
  if (state.bidder === player && state.seventhCard) known.add(state.seventhCard.id)
  const seen = new Set<string>()
  for (const trick of state.tricks) for (const play of trick.plays) seen.add(play.card.id)
  for (const play of state.currentTrick) seen.add(play.card.id)
  return FULL_DECK.filter(card => !known.has(card.id) && !seen.has(card.id))
}

/** Void suits a seat has already exposed by playing off-suit. */
function publicVoids(state: GameState): Set<Suit>[] {
  const voids = Array.from({ length: 4 }, () => new Set<Suit>())
  const groups = [...state.tricks.map(trick => trick.plays), state.currentTrick]
  for (const plays of groups) {
    const ledSuit = plays[0]?.card.suit
    if (!ledSuit) continue
    for (const play of plays.slice(1)) {
      if (play.card.suit !== ledSuit) voids[play.player].add(ledSuit)
    }
  }
  return voids
}

function beatsCard(candidate: Card, target: Card, trump: Suit | null, reverse: boolean): boolean {
  if (trump) {
    const candidateTrump = candidate.suit === trump
    const targetTrump = target.suit === trump
    if (candidateTrump !== targetTrump) return candidateTrump
    if (candidateTrump && targetTrump) return cardStrength(candidate, reverse) > cardStrength(target, reverse)
  }
  if (candidate.suit !== target.suit) return false
  return cardStrength(candidate, reverse) > cardStrength(target, reverse)
}

/** True when no unseen card could legally beat this card from here. */
function isCardSafe(card: Card, trump: Suit | null, reverse: boolean, unseen: Card[]): boolean {
  return !unseen.some(candidate => beatsCard(candidate, card, trump, reverse))
}

function lowestRisk(cards: Card[], trump: Suit | null, strength: (card: Card) => number): Card {
  const nonTrump = trump ? cards.filter(card => card.suit !== trump) : cards
  const pool = nonTrump.length ? nonTrump : cards
  return [...pool].sort((a, b) => a.points - b.points || strength(a) - strength(b))[0]
}

function chooseLead(state: GameState, player: number, hand: Card[], unseen: Card[], trump: Suit | null, reverse: boolean): Card {
  const strength = (card: Card) => cardStrength(card, reverse)
  const suits = SUITS.map(suit => {
    const cards = hand.filter(card => card.suit === suit).sort((a, b) => strength(b) - strength(a))
    if (!cards.length) return null
    const top = cards[0]
    const outstanding = unseen.filter(card => card.suit === suit).sort((a, b) => strength(b) - strength(a))[0]
    return {
      suit,
      cards,
      top,
      control: !outstanding || strength(top) > strength(outstanding),
      points: cards.reduce((sum, card) => sum + card.points, 0),
      length: cards.length,
      trump: trump === suit,
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null)
  if (!suits.length) return hand[0]

  const trumpInfo = suits.find(item => item.trump)
  const trumpsUnseen = trump ? unseen.filter(card => card.suit === trump).length : 0
  if (trumpInfo && trumpInfo.control && trumpInfo.length >= 2 && trumpsUnseen > 0) return trumpInfo.top
  if (trumpInfo && trumpInfo.control && trumpsUnseen === 0 && trumpInfo.points > 0) return trumpInfo.top

  const controls = suits
    .filter(item => item.control && !item.trump)
    .sort((a, b) => b.points - a.points || b.length - a.length)
  if (controls.length) return controls[0].top

  // No control: probe cheaply. With trump exposed, avoid a suit an opponent has shown
  // they can ruff; otherwise prefer a long, low-point suit.
  const voids = publicVoids(state)
  const partner = (player + 2) % 4
  const opponents = [0, 1, 2, 3].filter(seat => teamOf(seat) !== teamOf(player))
  const partnerHasShownTrump = !!trump && [...state.tricks.flatMap(trick => trick.plays), ...state.currentTrick]
    .some(play => play.player === partner && play.card.suit === trump)
  const nonTrump = suits.filter(item => !item.trump)
  const ruffSuits = partnerHasShownTrump
    ? nonTrump
      .filter(item => voids[partner].has(item.suit) && !opponents.some(opponent => voids[opponent].has(item.suit)))
      .sort((a, b) => a.points - b.points || b.length - a.length)
    : []
  if (ruffSuits.length) return [...ruffSuits[0].cards].sort((a, b) => strength(a) - strength(b))[0]
  const safe = nonTrump
    .filter(item => !trump || !opponents.some(opponent => voids[opponent].has(item.suit)))
    .sort((a, b) => a.points - b.points || b.length - a.length)
  const choice = safe[0] ?? nonTrump[0] ?? suits[0]
  return [...choice.cards].sort((a, b) => strength(a) - strength(b))[0]
}

/**
 * Public-information decision: should this bot call for the hidden contract before discarding?
 * The bidder knows the suit and only calls when a trump can win; other seats call only on a
 * valuable last-to-play trick, and never when partner already holds it.
 */
export function botShouldReveal(state: GameState, player: number): boolean {
  if (!canExposeContract(state, player)) return false
  const trick = state.currentTrick
  if (trick.length !== 3) return false
  const winner = winnerOfTrick(trick, state.trumpSuit, state.trumpRevealed, state.reverse && state.trumpRevealed)
  if (teamOf(winner) === teamOf(player)) return false
  const lastTrickBonus = state.tricks.length === 7 && state.rules.lastTrickBonus ? 1 : 0
  const trickPoints = trick.reduce((sum, play) => sum + play.card.points, 0) + lastTrickBonus
  const knowsSuit = state.bidder === player && !state.seventhCard
  if (knowsSuit && state.trumpSuit) {
    const winningCard = trick.find(play => play.player === winner)?.card ?? trick[0].card
    const trumps = (state.hands[player] ?? []).filter(card => card.suit === state.trumpSuit)
    return trumps.some(card => beatsCard(card, winningCard, state.trumpSuit, state.reverse))
  }
  // Other seats cannot identify their trumps yet. Call only when the last trick has enough
  // points to justify the risk; otherwise keep the contract hidden and discard.
  return trickPoints >= 2
}

export function chooseBotCard(state: GameState, player: number): Card {
  const hand = state.hands[player] ?? []
  let options = legalCardsFor(state, player)
  if (options.length <= 1) return options[0]
  const trick = state.currentTrick
  // Repeat the follow-suit filter at the policy boundary. The engine and legalCardsFor
  // already enforce it; this keeps the heuristic honest if either changes later.
  const ledSuit = trick[0]?.card.suit
  const canFollowFromHand = !!ledSuit && hand.some(card => card.suit === ledSuit)
  if (canFollowFromHand) options = options.filter(card => card.suit === ledSuit)

  // Trump is live only after someone has called for it. A void discard without a reveal
  // leaves the contract hidden, so do not plan around trumps the seat cannot see.
  const hiddenHomeTrump = !state.trumpRevealed && state.bidder === player && !state.seventhCard ? state.trumpSuit : null
  const nonTrumpDiscards = hiddenHomeTrump ? options.filter(card => card.suit !== hiddenHomeTrump) : []
  const discardPool = nonTrumpDiscards.length ? nonTrumpDiscards : options
  const revealed = state.trumpRevealed
  const reverseNow = state.reverse && revealed
  const trump = revealed ? state.trumpSuit : null
  const strength = (card: Card) => cardStrength(card, reverseNow)
  const unseen = publicUnseenCards(state, player)
  const team = teamOf(player)

  // ---------------- Leading ----------------
  if (trick.length === 0) return chooseLead(state, player, hand, unseen, trump, reverseNow)

  // ---------------- Following ----------------
  const currentWinner = winnerOfTrick(trick, state.trumpSuit, revealed, reverseNow)
  const partnerWinning = teamOf(currentWinner) === team
  const winningCard = trick.find(play => play.player === currentWinner)?.card ?? trick[0].card
  const lastTrickBonus = state.tricks.length === 7 && state.rules.lastTrickBonus ? 1 : 0
  const trickPoints = trick.reduce((sum, play) => sum + play.card.points, 0) + lastTrickBonus
  const lastToPlay = trick.length === 3
  const beatsNow = (card: Card) => beatsCard(card, winningCard, trump, reverseNow)

  if (partnerWinning) {
    if (lastToPlay) {
      return [...discardPool].sort((a, b) => b.points - a.points || strength(a) - strength(b))[0]
    }
    // If partner's card cannot be beaten, throw points under it. If it can be beaten,
    // overtake only when a safe winner exists; otherwise keep the high cards.
    if (isCardSafe(winningCard, trump, reverseNow, unseen)) {
      const nonOvertaking = discardPool.filter(card => !beatsNow(card))
      const pool = nonOvertaking.length ? nonOvertaking : discardPool
      return [...pool].sort((a, b) => b.points - a.points || strength(a) - strength(b))[0]
    }
    const safeWinners = options.filter(card => beatsNow(card) && isCardSafe(card, trump, reverseNow, unseen))
    if (safeWinners.length) {
      return [...safeWinners].sort((a, b) => (strength(a) + a.points * 0.25) - (strength(b) + b.points * 0.25))[0]
    }
    return lowestRisk(discardPool, trump, strength)
  }

  const winners = options.filter(beatsNow)
  if (winners.length) {
    if (lastToPlay) {
      return [...winners].sort((a, b) => {
        const delta = playUtility(state, trick, b, player, revealed, reverseNow, lastTrickBonus) - playUtility(state, trick, a, player, revealed, reverseNow, lastTrickBonus)
        return delta || strength(a) - strength(b)
      })[0]
    }
    const safeWinners = winners.filter(card => isCardSafe(card, trump, reverseNow, unseen))
    const pool = safeWinners.length ? safeWinners : winners
    const cheapest = [...pool].sort((a, b) => (strength(a) + a.points * 0.25) - (strength(b) + b.points * 0.25))[0]
    const spentTrump = !!trump && cheapest.suit === trump && strength(cheapest) >= 7
    const canDuck = options.some(card => !beatsNow(card))
    // Do not burn a J/9 trump on a pointless trick when a cheap discard is available.
    if (trickPoints === 0 && spentTrump && canDuck && hand.filter(card => card.suit === trump).length > 1) {
      return lowestRisk(options, trump, strength)
    }
    return cheapest
  }

  // Cannot win: concede cheaply, saving trump and point cards.
  return lowestRisk(discardPool, trump, strength)
}

/**
 * Certain, visible-information checks only. A note is produced when the last player to act could
 * compare candidates with the cards already on the table; hidden-contract decisions are
 * deliberately excluded because the outcome was not knowable at decision time.
 */
function analyzeDecision(decision: DecisionRecord): MistakeNote[] {
  const { trickBefore, player, card, legalCards: legal, trickNumber } = decision
  if (trickBefore.length !== 3 || legal.length < 2) return []
  const ledSuit = trickBefore[0].card.suit
  const wasRevealed = decision.trumpRevealed
  const knownTrump = decision.knownTrumpSuit
  const knownReverse = decision.knownReverse
  const reverseActive = knownReverse && wasRevealed
  if (!knownTrump && !knownReverse && !wasRevealed && legal.some(candidate => candidate.suit !== ledSuit)) return []

  const scored = legal.map(candidate => {
    const winner = winnerOfTrick([...trickBefore, { player, card: candidate }], knownTrump, wasRevealed, reverseActive)
    return { candidate, winner, wins: teamOf(winner) === teamOf(player) }
  })
  const selected = scored.find(item => item.candidate.id === card.id)
  if (!selected) return []

  const partnerHeldTrick = teamOf(winnerOfTrick(trickBefore, knownTrump, wasRevealed, knownReverse && wasRevealed)) === teamOf(player)
  const lastTrickBonus = decision.completedTricksBefore.length === 7 && decision.rules.lastTrickBonus ? 1 : 0
  const trickPoints = trickBefore.reduce((sum, play) => sum + play.card.points, 0) + card.points + lastTrickBonus
  const winners = scored.filter(item => item.wins).sort((a, b) => cardStrength(a.candidate, reverseActive) - cardStrength(b.candidate, reverseActive))

  if (!selected.wins) {
    const cheapestWin = winners[0]
    if (cheapestWin && (trickPoints >= 1 || cardStrength(cheapestWin.candidate, reverseActive) <= 6)) {
      return [{
        trickNumber,
        level: 'opportunity',
        title: 'A winning trick was left on the table',
        detail: `This trick carried ${trickPoints} point${trickPoints === 1 ? '' : 's'} and you played last, so the visible cards decided it. ${cardText(cheapestWin.candidate)} was the cheapest card that still won it for your team; ${cardText(card)} gave the trick away.`,
        chosenCard: cardText(card),
        betterCard: cardText(cheapestWin.candidate),
        pointsAtStake: trickPoints,
      }]
    }
    const freeDiscard = scored
      .filter(item => !item.wins && item.candidate.points === 0)
      .sort((a, b) => cardStrength(a.candidate, reverseActive) - cardStrength(b.candidate, reverseActive))[0]
    if (card.points > 0 && freeDiscard) {
      return [{
        trickNumber,
        level: 'opportunity',
        title: 'Points were donated to the opponents',
        detail: `The opponents already had this trick, so ${cardText(card)} handed them ${card.points} extra point${card.points === 1 ? '' : 's'}. ${cardText(freeDiscard.candidate)} was a free discard that would have kept your point cards for later.`,
        chosenCard: cardText(card),
        betterCard: cardText(freeDiscard.candidate),
        pointsAtStake: card.points,
      }]
    }
    return []
  }

  const cheaperWin = winners
    .filter(item => item.candidate.id !== card.id && cardStrength(item.candidate, reverseActive) <= cardStrength(card, reverseActive) - 2)
    .sort((a, b) => cardStrength(a.candidate, reverseActive) - cardStrength(b.candidate, reverseActive))[0]
  if (cheaperWin && cardStrength(card, reverseActive) >= 6) {
    return [{
      trickNumber,
      level: 'efficiency',
      title: 'You spent more control than the trick needed',
      detail: `${cardText(cheaperWin.candidate)} would also have won this trick, keeping ${cardText(card)} as a control card for a later point-rich trick.`,
      chosenCard: cardText(card),
      betterCard: cardText(cheaperWin.candidate),
    }]
  }
  if (partnerHeldTrick && card.points === 0) {
    const pointCard = scored
      .filter(item => item.candidate.points > 0)
      .sort((a, b) => b.candidate.points - a.candidate.points)[0]
    if (pointCard) {
      return [{
        trickNumber,
        level: 'efficiency',
        title: 'Points were left uncollected',
        detail: `Your partner already held this trick and you played last. Adding ${cardText(pointCard.candidate)} would have counted its ${pointCard.candidate.points} point${pointCard.candidate.points === 1 ? '' : 's'} for your team; ${cardText(card)} kept them in hand where they can still be captured by the opponents.`,
        chosenCard: cardText(card),
        betterCard: cardText(pointCard.candidate),
        pointsAtStake: pointCard.candidate.points,
      }]
    }
  }
  return []
}

function buildBidReview(records: BidRecord[], reverse = false): BidReview | null {
  if (!records.length) return null
  const committed = records.filter(record => record.bid !== null).sort((a, b) => (b.bid ?? 0) - (a.bid ?? 0))[0]
  const last = records[records.length - 1]
  const advised = (committed ?? last).advisedBid
  const suit = SUIT_LABEL[(committed ?? last).bestSuit]
  const suitPhrase = reverse ? 'in a reverse contract' : `with ${suit} as trump`
  if (!committed) {
    if (last.partnerWasHigh) {
      return { verdict: 'good', title: 'Correct to stay out of your partner’s auction', detail: 'Your partner already held the highest bid. Passing kept the contract at a level your side had chosen instead of raising your own team.', advised, actual: null }
    }
    if (advised >= 16) {
      return { verdict: 'timid', title: 'A playable hand was passed', detail: `These four cards project around ${advised} points ${suitPhrase}. Opening at 16 would have kept your team in the auction at a realistic level.`, advised, actual: null }
    }
    return { verdict: 'good', title: 'Passing matched the hand', detail: 'The opening four project below the 16-point minimum, so staying out of the auction was disciplined rather than passive.', advised, actual: null }
  }
  const bid = committed.bid!
  if (bid > advised + 1) {
    return { verdict: 'aggressive', title: `Bidding ${bid} asked for more than the hand promised`, detail: `This hand projects around ${advised} points ${suitPhrase}. The extra ${bid - advised} point${bid - advised === 1 ? '' : 's'} had to come from partner or a lucky distribution, which is why the contract felt tight.`, advised, actual: bid }
  }
  if (bid < advised - 2) {
    return { verdict: 'timid', title: `Bidding ${bid} was below the hand’s ceiling`, detail: `The same cards could support about ${advised}. Bidding closer to that level wins more auctions without making the cards you play any harder.`, advised, actual: bid }
  }
  return { verdict: 'good', title: `Your bid of ${bid} matched the hand`, detail: `The opening four project around ${advised} points, so the contract was pitched at a realistic level.`, advised, actual: bid }
}

/**
 * A player who is void in the led suit may expose the hidden contract before choosing a card.
 * The reveal is public; that player must then play a trump this trick if one is available.
 */
export function revealHiddenContract(state: GameState, player: number): GameState {
  if (state.phase !== 'play' || state.pausedTrick || state.trumpRevealed || state.currentPlayer !== player) return state
  const ledSuit = state.currentTrick[0]?.card.suit
  if (!ledSuit || !canExposeContract(state, player)) return state

  let hands = state.hands
  if (state.seventhCard && state.bidder !== null) {
    hands = state.hands.map((seat, index) => index === state.bidder ? [...seat, state.seventhCard!] : seat)
  }
  const reverseWithTrump = state.reverse && !!state.trumpSuit
  const leadLabel = SUIT_LABEL[ledSuit]
  const trumpHeld = !!state.trumpSuit && hands[player].some(card => card.suit === state.trumpSuit)
  const obligation = trumpHeld
    ? player === 0
      ? ' You must play a trump this trick.'
      : ` ${PLAYER_NAMES[player]} must play a trump this trick.`
    : ''
  const logEntry = (state.reverse
    ? reverseWithTrump
      ? `${act(player, 'cannot follow', 'cannot follow')} ${leadLabel}—trump is revealed: ${SUIT_LABEL[state.trumpSuit!]} with the reverse ranking (7 high, J low).`
      : `${act(player, 'cannot follow', 'cannot follow')} ${leadLabel}—reverse revealed: 7 is high, J is low.`
    : `${act(player, 'cannot follow', 'cannot follow')} ${leadLabel}—trump is revealed: ${SUIT_LABEL[state.trumpSuit!]}.`) + obligation
  const revealMessage = state.reverse
    ? reverseWithTrump
      ? `Reverse revealed: ${SUIT_LABEL[state.trumpSuit!]} is trump—7 is high and J is low.`
      : 'Reverse revealed: no trump—7 is high and J is low.'
    : `Trump revealed: ${SUIT_LABEL[state.trumpSuit!]} can now beat other suits.`
  return withVersion(state, {
    hands,
    trumpRevealed: true,
    mustTrump: player,
    seventhCard: null,
    log: [...state.log, logEntry].slice(-32),
    message: `${revealMessage}${obligation}`,
  })
}

export function playCard(state: GameState, player: number, cardId: string): GameState {
  if (state.phase !== 'play' || state.currentPlayer !== player || state.pausedTrick) return state
  const handBefore = state.hands[player]
  const legal = legalCardsFor(state, player)
  const card = legal.find(c => c.id === cardId)
  if (!card) return state
  // Belt-and-braces follow-suit guard. legalCardsFor already returns only the led suit
  // when the player holds it; this keeps that invariant even if a caller passes a card
  // that was legal before a state transition.
  const ledSuit = state.currentTrick[0]?.card.suit
  if (ledSuit && handBefore.some(c => c.suit === ledSuit) && card.suit !== ledSuit) return state
  const isSeventhPlay = state.bidder === player && state.seventhCard?.id === card.id && !state.trumpRevealed
  const trickBefore = [...state.currentTrick]
  const wasRevealed = state.trumpRevealed
  // Only the bidder's seventh card forces the contract into the open. A void player who
  // plays off-suit without revealing keeps trump hidden for the rest of this trick.
  const revealsNow = !wasRevealed && isSeventhPlay
  const trumpRevealed = wasRevealed || revealsNow
  const nextHand = isSeventhPlay ? handBefore : handBefore.filter(c => c.id !== card.id)
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
    reverse: state.reverse,
    knownReverse: state.reverse && (wasRevealed || state.bidder === player),
    indicatorSuit: state.indicatorSuit,
    trumpRevealed: wasRevealed,
    mustTrump: state.mustTrump,
    player,
    bidder: state.bidder,
    highBid: state.highBid,
    dealer: state.dealer,
    matchScore: [...state.matchScore] as [number, number],
    rules: { ...state.rules },
    pair: state.pair ? { ...state.pair } : null,
    stake: state.stake,
    seventhCard: state.seventhCard ? { ...state.seventhCard } : null,
  }] : state.decisions
  const logEntry = isSeventhPlay
    ? `${act(player, 'shows', 'show')} the seventh card—trump is revealed: ${SUIT_LABEL[state.trumpSuit!]}.`
    : `${act(player, `plays ${cardText(card)}`, `play ${cardText(card)}`)}.`
  let next: GameState = withVersion(state, {
    hands,
    currentTrick,
    trumpRevealed,
    mustTrump: state.mustTrump === player ? null : state.mustTrump,
    seventhCard: revealsNow ? null : state.seventhCard,
    decisions,
    log: [...state.log, logEntry].slice(-32),
    message: revealsNow
      ? `Trump revealed: ${SUIT_LABEL[state.trumpSuit!]} can now beat other suits.`
      : `${PLAYER_NAMES[player]} played ${cardText(card)}.`,
  })
  if (currentTrick.length < 4) {
    return { ...next, currentPlayer: (player + 1) % 4 }
  }
  const winner = winnerOfTrick(currentTrick, state.trumpSuit, trumpRevealed, state.reverse && trumpRevealed)
  const cardPoints = currentTrick.reduce((sum, play) => sum + play.card.points, 0)
  const isLast = state.tricks.length === 7
  const bonus = isLast && state.rules.lastTrickBonus ? 1 : 0
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
  const pointLabel = `${trickRecord.points} ${trickRecord.points === 1 ? 'pt' : 'pts'}`
  const winnerAction = act(winner, `wins trick ${trickRecord.number}`, `win trick ${trickRecord.number}`)
  const finalText = winner === 0 ? 'You won the final trick' : `${PLAYER_NAMES[winner]} won the final trick`
  let completed: GameState = {
    ...next,
    currentTrick: [],
    tricks,
    currentPlayer: winner,
    pausedTrick: trickRecord,
    message: isLast
      ? `${finalText} (${pointLabel}). Continue to review the hand.`
      : `${winnerAction} with ${pointLabel}. Review the four cards, then continue.`,
    log: [...next.log, `${winnerAction} (${pointLabel}).`].slice(-32),
  }
  completed = autoDeclareBotPairs(completed)
  return completed
}

/** Leave the paused trick on screen and continue play. */
export function continueAfterTrick(state: GameState): GameState {
  if (!state.pausedTrick) return state
  const next = withVersion(state, {
    pausedTrick: null,
    message: state.tricks.length === 8
      ? 'Hand complete. Review the decisions.'
      : `${leadLine(state.currentPlayer)} trick ${state.tricks.length + 1}.`,
  })
  if (next.tricks.length === 8) return finishHand(next)
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
  const target = contractTarget(state) || bid
  const success = pointTotals[contractTeam] >= target
  const scoreDelta = success ? state.stake : -state.stake
  const scoreAfter: [number, number] = [...state.matchScore]
  scoreAfter[contractTeam] += scoreDelta
  let matchWinner: Team | null = null
  if (scoreAfter[0] >= 6 || scoreAfter[1] <= -6) matchWinner = 0
  if (scoreAfter[1] >= 6 || scoreAfter[0] <= -6) matchWinner = 1
  const notes = state.decisions.flatMap(analyzeDecision)
  const review: HandReview = {
    bid,
    target,
    bidder,
    trumpSuit: state.trumpSuit,
    reverse: state.reverse,
    indicatorSuit: state.indicatorSuit,
    success,
    contractTeam,
    teamPoints: pointTotals,
    cardPoints,
    lastTrickBonus: state.tricks[7]?.bonus ?? 0,
    pair: state.pair ? { ...state.pair } : null,
    stake: state.stake,
    scoreDelta,
    scoreAfter,
    matchWinner,
    notes,
    bidReview: buildBidReview(state.bidRecords, state.reverse),
  }
  return {
    ...state,
    phase: 'review',
    matchScore: scoreAfter,
    currentTrick: [],
    pausedTrick: null,
    seventhCard: null,
    review,
    message: success
      ? `Contract made: ${PLAYER_NAMES[bidder]} bid ${bid} and the team captured ${pointTotals[contractTeam]} against a target of ${target}.`
      : `Contract failed: ${PLAYER_NAMES[bidder]} bid ${bid} against a target of ${target}, but the team captured ${pointTotals[contractTeam]}.`,
    version: state.version + 1,
  }
}

export function totalPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + card.points, 0)
}
