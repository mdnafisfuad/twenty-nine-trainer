import {
  cardStrength,
  cardText,
  contractTarget,
  FULL_DECK,
  legalCardsFor,
  maxBidFor,
  openingReport,
  pairEligible,
  PLAYER_NAMES,
  SUITS,
  SUIT_LABEL,
  SUIT_SYMBOL,
  suitPower,
  teamOf,
  winnerOfTrick,
  type Card,
  type GameState,
  type PlayedCard,
  type Suit,
} from './game'

export type CoachTone = 'neutral' | 'good' | 'warn' | 'danger'

export interface CoachInsight {
  /** Short context label, e.g. "Auction" or "Trick 3". */
  tag: string
  tone: CoachTone
  title: string
  summary: string
  /** At most a few short, specific reasons. */
  bullets: string[]
  /** A concrete instruction for the current decision. */
  action?: string
  /** The one-sentence plan behind the action. */
  plan?: string
  /** Candidate card the coach would play now, when one can be named. */
  recommendedCardId?: string | null
  confidence: 'certain' | 'estimate'
  /** Rules-only advice, a hybrid verdict, or a non-actionable table read. */
  source?: 'rules' | 'hybrid' | 'observation'
  /** UI-only history identity; the app sets this so one turn replaces its own tip. */
  turnKey?: string
}

export interface SuitReport {
  suit: Suit
  cards: Card[]
  count: number
  points: number
  power: number
  hasJack: boolean
  hasNine: boolean
}

const teamName = (player: number) => PLAYER_NAMES[player]
const suitLine = (cards: Card[], suit: Suit): string => {
  const inSuit = cards.filter(card => card.suit === suit).sort((a, b) => b.strength - a.strength)
  if (!inSuit.length) return 'no cards'
  return `${inSuit.length} card${inSuit.length === 1 ? '' : 's'} (${inSuit.map(card => card.rank).join(', ')})`
}

/** Suits ranked by the same power model the bots use for trump. */
export function rankSuits(hand: Card[]): SuitReport[] {
  return SUITS.map(suit => {
    const cards = hand.filter(card => card.suit === suit).sort((a, b) => b.strength - a.strength)
    return {
      suit,
      cards,
      count: cards.length,
      points: cards.reduce((sum, card) => sum + card.points, 0),
      power: suitPower(hand, suit),
      hasJack: cards.some(card => card.rank === 'J'),
      hasNine: cards.some(card => card.rank === '9'),
    }
  }).sort((a, b) => b.power - a.power)
}

function publicPlays(state: GameState): PlayedCard[] {
  return [...state.tricks.flatMap(trick => trick.plays), ...state.currentTrick]
}

/** Cards the viewer has seen: own hand, the known seventh card, plus every card played face-up. */
export function seenCards(state: GameState, player: number): Set<string> {
  const own = (state.hands[player] ?? []).map(card => card.id)
  const played = publicPlays(state).map(play => play.card.id)
  const seventh = state.bidder === player && state.seventhCard ? [state.seventhCard.id] : []
  return new Set([...own, ...played, ...seventh])
}

export function unseenCards(state: GameState, player: number): Card[] {
  const seen = seenCards(state, player)
  return FULL_DECK.filter(card => !seen.has(card.id))
}

/**
 * Suits a seat has failed to follow. The rules force a follow when possible, so an off-suit
 * play is public proof of a void — no hidden information is used.
 */
export function knownVoids(state: GameState): Set<Suit>[] {
  const voids = Array.from({ length: 4 }, () => new Set<Suit>())
  for (const plays of [...state.tricks.map(trick => trick.plays), state.currentTrick]) {
    const ledSuit = plays[0]?.card.suit
    if (!ledSuit) continue
    for (const play of plays.slice(1)) {
      if (play.card.suit !== ledSuit) voids[play.player].add(ledSuit)
    }
  }
  return voids
}

function completedPoints(state: GameState): [number, number] {
  const totals: [number, number] = [0, 0]
  for (const trick of state.tricks) totals[teamOf(trick.winner)] += trick.points
  return totals
}

function topUnseen(state: GameState, player: number, suit: Suit): Card | null {
  return unseenCards(state, player)
    .filter(card => card.suit === suit)
    .sort((a, b) => b.strength - a.strength)[0] ?? null
}

function contractLine(state: GameState, player: number): string | null {
  if (state.bidder === null || state.highBid === null || state.phase !== 'play') return null
  const target = contractTarget(state)
  const totals = completedPoints(state)
  const ourTeam = teamOf(player)
  const contractTeam = teamOf(state.bidder)
  const stakeLine = state.stake > 1 ? ` The hand is worth ${state.stake} match points.` : ''
  if (contractTeam === ourTeam) {
    const need = Math.max(0, target - totals[ourTeam])
    const remaining = Math.max(0, 8 - state.tricks.length)
    return need === 0
      ? `Your team already has ${totals[ourTeam]} points — the ${target}-point target is covered. Every extra trick now protects the margin.${stakeLine}`
      : `Your team has ${totals[ourTeam]} of the ${target} points needed. ${remaining} trick${remaining === 1 ? '' : 's'} remain to find ${need}.${stakeLine}`
  }
  const conceded = totals[contractTeam]
  const needed = target - conceded
  return conceded >= target
    ? `The bidding team already reached ${conceded} points. Your side needs the remaining tricks to limit the damage.${stakeLine}`
    : `The bidding team needs ${needed} more point${needed === 1 ? '' : 's'}. Every point you win from here denies them.${stakeLine}`
}

// ---------------------------------------------------------------------------
// Auction
// ---------------------------------------------------------------------------

export function bidInsight(state: GameState, player = 0): CoachInsight {
  const hand = state.hands[player] ?? []
  const report = openingReport(hand)
  const maxBid = maxBidFor(state.rules)
  const minBid = state.highBid === null ? 16 : state.highBid + 1
  const partnerHigh = state.bidder !== null && teamOf(state.bidder) === teamOf(player)
  const suit = SUIT_LABEL[report.suit]
  if (state.auctionComplete && state.highBid !== null && state.bidder !== null) {
    const ours = teamOf(state.bidder) === teamOf(player)
    const bidderName = state.bidder === 0 ? 'You' : PLAYER_NAMES[state.bidder]
    return {
      tag: 'Auction won', tone: ours ? 'good' : 'neutral', confidence: 'certain',
      title: `${bidderName} won the auction at ${state.highBid}`,
      summary: 'The auction is over. Read the final board, then continue to choose the contract.',
      plan: `The contract target is ${state.highBid}. Continue when you are ready to choose trump.`,
      bullets: [
        `${ours ? 'Your' : 'The bidding'} side needs ${state.highBid} points. ${state.bidder === 0 ? 'You will choose trump next.' : `${PLAYER_NAMES[state.bidder]} will choose the contract next.`}`,
        ...(state.rules.reverse ? ['Reverse is available: no trump, with the ranking flipping to 7 high on the first void.'] : []),
        ...(state.rules.reverseTrump ? ['Reverse with trump is also available: name a suit, and the trump 7 becomes the strongest card once revealed.'] : []),
      ],
      action: 'Continue',
    }
  }
  const bullets = [
    `${suit} is your strongest suit: ${suitLine(hand, report.suit)}, with ${report.points} card point${report.points === 1 ? '' : 's'}.`,
    `Trump power ${report.power.toFixed(1)} projects a contract around ${report.advised}. The opening minimum is 16.`,
  ]
  if (state.rules.reverse) {
    bullets.push('Reverse is available to the bidder: no trump, and after the first void 7 is high and J is low.')
  }
  if (state.rules.reverseTrump) {
    bullets.push('Reverse with trump is available: name a suit and the ranking flips to 7 high, J low when the contract is revealed. The royal pair can still be declared.')
  }
  if (state.rules.pair && report.pairPotential) {
    bullets.push(`You also hold the K+Q of ${suit}. If trump is revealed and your side wins a trick, declaring the royal pair lowers the target by 4.`)
  }
  if (state.rules.seventhCard) {
    bullets.push('After winning the auction you can name a suit or call the seventh card to set trump sight unseen.')
  }

  if (partnerHigh) {
    bullets.push(`Your partner holds the auction at ${state.highBid}. Raising your own team only makes the contract harder.`)
    return {
      tag: 'Auction', tone: 'neutral', confidence: 'certain',
      title: 'Let your partner carry this contract',
      summary: 'Your partner already has the highest bid. Passing keeps the target where your side chose it.',
      plan: 'Pass now and support the contract your partner already owns. Raising would only make that target harder.',
      bullets,
      action: 'Pass',
    }
  }

  if (report.advised >= minBid) {
    const target = Math.min(maxBid, report.advised)
    if (state.highBid !== null) {
      bullets.push(`You need about ${minBid} to overtake ${state.highBid}; this hand can support ${target}.`)
    }
    return {
      tag: 'Auction', tone: 'good', confidence: 'estimate',
      title: `Bid ${target} with this hand`,
      summary: `Your opening four are strongest in ${suit}. Bid the level the cards support; do not chase a higher number just to scare the table.`,
      plan: `Bid ${target}. If partner takes over, pass and support their contract.`,
      bullets,
      action: `Bid ${target}`,
    }
  }

  if (state.highBid === null) {
    bullets.push(`Opening at 16 needs more control than ${report.power.toFixed(1)}. A speculative opening is a bluff, not a plan.`)
    return {
      tag: 'Auction', tone: 'warn', confidence: 'estimate',
      title: 'Pass — this hand cannot open at 16',
      summary: `Your best trump suit is ${suit}, but it does not offer enough control to open at 16. Passing costs nothing and keeps your team out of a contract it cannot support.`,
      plan: 'Pass. A rescue bid here would put your team in a contract the opening four cannot carry.',
      bullets,
      action: 'Pass',
    }
  }

  bullets.push(`The current bid is ${state.highBid}. Power ${report.power.toFixed(1)} falls short of the ${minBid} needed to overtake it, so a raise would be a bluff.`)
  return {
    tag: 'Auction', tone: 'warn', confidence: 'estimate',
    title: `Pass — this hand cannot support ${minBid}`,
    summary: `Your best trump suit is ${suit}, but it does not offer enough control for ${minBid}. Passing keeps your team out of a contract it cannot support.`,
    plan: `Pass. Let the opponents carry a target your hand cannot beat.`,
    bullets,
    action: 'Pass',
  }
}

// ---------------------------------------------------------------------------
// Trump choice
// ---------------------------------------------------------------------------

export function trumpInsight(state: GameState, player = 0): CoachInsight {
  const hand = state.hands[player] ?? []
  const ranked = rankSuits(hand)
  const best = ranked[0]
  const runnerUp = ranked[1]
  const bullets = ranked.slice(0, 3).map(item => {
    const traits = [
      item.hasJack && item.hasNine ? 'Jack + Nine control' : item.hasJack ? 'the Jack' : item.hasNine ? 'the Nine' : '',
      `${item.count} card${item.count === 1 ? '' : 's'}`,
    ].filter(Boolean).join(', ')
    return `${SUIT_LABEL[item.suit]}: ${traits} — ${suitLine(hand, item.suit)}.`
  })
  if (state.rules.pair) {
    const pairSuit = ranked.find(item => item.cards.some(card => card.rank === 'K') && item.cards.some(card => card.rank === 'Q'))
    if (pairSuit) {
      bullets.push(`You hold the K+Q of ${SUIT_LABEL[pairSuit.suit]}. Declaring the royal pair after your side wins a trick lowers the target by 4.`)
    }
  }
  if (state.rules.seventhCard) {
    bullets.push('Or call the seventh card: the 7th card dealt to you sets trump and stays out of your hand until trump is revealed.')
  }
  if (state.rules.reverse) {
    bullets.push('Or declare Reverse: no trump. The 2 indicator stays face down; the first void flips the ranking to 7 high, J low. A pair cannot be declared.')
  }
  if (state.rules.reverseTrump) {
    bullets.push('Or declare Reverse with trump: name a suit and the ranking flips to 7 high, J low once revealed. The trump 7 becomes the strongest card, and the royal pair can be declared.')
  }
  if (best.count === 1) {
    bullets.push(`${SUIT_LABEL[best.suit]} has only one trump. A longer suit with the same high cards gives you more safety.`)
  } else if (runnerUp && best.power - runnerUp.power < 0.5) {
    bullets.push(`${SUIT_LABEL[best.suit]} and ${SUIT_LABEL[runnerUp.suit]} are close. Prefer the one with more cards and point cards.`)
  }
  return {
    tag: 'Trump', tone: 'good', confidence: 'certain',
    title: `Choose ${SUIT_LABEL[best.suit]} as trump`,
    summary: `You choose trump from these four cards only. ${SUIT_LABEL[best.suit]} gives you the best mix of high cards and length; strength matters more than raw length.`,
    plan: `Choose ${SUIT_LABEL[best.suit]}. Draw trumps with it first, then cash your point cards.`,
    bullets,
    action: `Choose ${SUIT_LABEL[best.suit]}${SUIT_SYMBOL[best.suit]}`,
  }
}

// ---------------------------------------------------------------------------
// Trick play
// ---------------------------------------------------------------------------

export function playInsight(state: GameState, player = 0): CoachInsight {
  const hand = state.hands[player] ?? []
  const trick = state.currentTrick
  const legal = legalCardsFor(state, player)
  const tag = `Trick ${state.tricks.length + 1}`
  if (pairEligible(state, player)) {
    const pairCards = hand
      .filter(card => card.suit === state.trumpSuit && (card.rank === 'K' || card.rank === 'Q'))
      .map(cardText)
      .join(' ')
    const target = contractTarget(state)
    const clamped = teamOf(player) === teamOf(state.bidder ?? 0) && target === 16 && (state.highBid ?? 0) > 16
    const effect = teamOf(player) === teamOf(state.bidder ?? 0)
      ? `Your target drops by 4, from ${state.highBid} to ${target}${clamped ? ' (the 16-point opening floor)' : ''}.`
      : `The bidding team’s target rises by 4, from ${state.highBid} to ${target}.`
    return {
      tag, tone: 'good', confidence: 'certain',
      title: `Declare the royal pair (${pairCards})`,
      summary: 'Your side won the last trick and both trump honours are still in your hand. The pair can be declared now, before you play either card.',
      plan: `Declare the pair before either honour is played. ${effect}`,
      bullets: [effect, 'This is a public declaration: the table sees the pair and the target changes immediately.'],
      action: 'Declare pair',
    }
  }
  if (state.pausedTrick) {
    const paused = state.pausedTrick
    const ours = teamOf(paused.winner) === teamOf(player)
    const line = contractLine(state, player)
    const bullets = [
      `${PLAYER_NAMES[paused.winner]} took ${paused.points} point${paused.points === 1 ? '' : 's'} (${paused.cardPoints} card point${paused.cardPoints === 1 ? '' : 's'}${paused.bonus ? ` + ${paused.bonus} last-trick bonus` : ''}).`,
    ]
    if (line) bullets.push(line)
    return {
      tag: `Trick ${paused.number}`,
      tone: ours ? 'good' : 'warn',
      confidence: 'certain',
      title: ours ? `Your side won trick ${paused.number}` : `Opponents won trick ${paused.number}`,
      summary: ours
        ? 'The four cards are still on the table. Read them, then continue when you are ready for the next lead.'
        : 'The four cards are still on the table. Check what the opponents captured before the next lead.',
      plan: 'Update the point count and the contract target from these four cards, then continue.',
      bullets,
    }
  }
  if (!legal.length) {
    return { tag, tone: 'neutral', title: 'Your hand is empty', summary: 'All eight of your cards have been played.', bullets: [], confidence: 'certain' }
  }

  const knowsMode = state.trumpRevealed || state.bidder === player
  const knownReverse = state.reverse && knowsMode
  const reverseActive = knownReverse && state.trumpRevealed
  const knownTrump = knowsMode ? state.trumpSuit : null
  const strengthOf = (card: Card) => cardStrength(card, reverseActive)
  const voids = knownVoids(state)
  const line = contractLine(state, player)
  const trickPoints = trick.reduce((sum, play) => sum + play.card.points, 0)
  const seventhLine = state.seventhCard && state.bidder === player
    ? `Your seventh card ${cardText(state.seventhCard)} is set aside; it joins your hand when trump is revealed.`
    : null

  // ---------------- Leading ----------------
  if (trick.length === 0) {
    const suits = SUITS.map(suit => {
      const cards = hand.filter(card => card.suit === suit).sort((a, b) => strengthOf(b) - strengthOf(a))
      if (!cards.length) return null
      const top = cards[0]
      const outstanding = topUnseen(state, player, suit)
      return {
        suit,
        cards,
        top,
        outstanding,
        control: !outstanding || strengthOf(top) > strengthOf(outstanding),
        trump: knownTrump === suit,
        points: cards.reduce((sum, card) => sum + card.points, 0),
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null)

    const trumpsOutstanding = knownTrump ? unseenCards(state, player).filter(card => card.suit === knownTrump).length : 0
    const trumpControl = suits.find(item => item.trump && item.control)
    const controls = suits
      .filter(item => item.control && !item.trump)
      .sort((a, b) => b.points - a.points || strengthOf(b.top) - strengthOf(a.top))

    const bullets = [
      knownReverse
        ? state.trumpRevealed
          ? state.trumpSuit
            ? `${SUIT_LABEL[state.trumpSuit]} is trump. Reverse is active: the 7 of trump is the strongest card, and 7 is high in every suit.`
            : 'No trump. Reverse is active: 7 is high and J is low.'
          : state.trumpSuit
            ? `You declared Reverse with ${SUIT_LABEL[state.trumpSuit]} as trump; the first void reveals both the suit and the 7-high ranking.`
            : 'No trump. Your 2 indicator is still face down; the first void flips the ranking to 7 high, J low.'
        : knownTrump
          ? `${trumpsOutstanding} trump${trumpsOutstanding === 1 ? '' : 's'} remain unseen${trumpsOutstanding ? ` (${SUIT_LABEL[knownTrump]})` : ''}.`
          : 'Trump is still hidden, so an opponent who is void can change the trick by playing off-suit.',
      ...(seventhLine ? [seventhLine] : []),
    ]

    if (knownTrump && trumpControl && trumpsOutstanding > 0) {
      if (line) bullets.push(line)
      return {
        tag, tone: 'good', confidence: 'certain',
        title: `Lead ${cardText(trumpControl.top)} to draw trumps`,
        summary: 'You hold the highest remaining trump. Leading it forces the opponents to spend their trumps and protects your point cards.',
        plan: 'Draw trumps first. Once the opponents are out of trumps, cash your point cards safely.',
        bullets,
        action: `Play ${cardText(trumpControl.top)}`,
        recommendedCardId: trumpControl.top.id,
      }
    }

    if (controls.length) {
      const choice = controls[0]
      bullets.push(`You hold the highest remaining ${SUIT_LABEL[choice.suit]} (${cardText(choice.top)})${choice.outstanding ? `; the best outstanding card is ${cardText(choice.outstanding)}` : ''}.`)
      if (choice.points > 0) bullets.push(`That suit also holds ${choice.points} point${choice.points === 1 ? '' : 's'} for your team to collect.`)
      if (line) bullets.push(line)
      return {
        tag, tone: 'good', confidence: 'certain',
        title: `Lead ${cardText(choice.top)} — you hold the top ${SUIT_LABEL[choice.suit]}`,
        summary: `Leading the top card in ${SUIT_LABEL[choice.suit]} collects the trick and keeps the suit safe for later.`,
        plan: `Cash ${SUIT_LABEL[choice.suit]} now. Keep your other high cards for later tricks.`,
        bullets,
        action: `Play ${cardText(choice.top)}`,
        recommendedCardId: choice.top.id,
      }
    }

    const safeSuits = suits
      .filter(item => !item.trump)
      .sort((a, b) => a.points - b.points || strengthOf(a.top) - strengthOf(b.top))
    const safe = safeSuits[0] ?? suits[0]
    const lowCard = [...safe.cards].sort((a, b) => strengthOf(a) - strengthOf(b))[0]
    const voidOpponent = [1, 3].find(seat => voids[seat].has(safe.suit))
    if (voidOpponent !== undefined && !knowsMode) {
      bullets.push(`${teamName(voidOpponent)} is void in ${SUIT_LABEL[safe.suit]}, so this lead may reveal the hidden mode.`)
    }
    if (knownReverse && voidOpponent !== undefined) {
      bullets.push(`${teamName(voidOpponent)} is void in ${SUIT_LABEL[safe.suit]}; leading it can expose the reverse and flip the ranking immediately.`)
    }
    if (line) bullets.push(line)
    return {
      tag, tone: 'neutral', confidence: 'estimate',
      title: `Probe with a low ${SUIT_LABEL[safe.suit]}`,
      summary: knownReverse
        ? knownTrump
          ? `You do not hold the top card in a suit outright yet. Lead cheaply, expose the reverse on your terms, and keep the trump 7s and 8s for the tricks they must win.`
          : 'You do not hold the top card in a suit outright yet. Lead cheaply, expose the reverse when it suits you, and keep your new high cards (7s and 8s) for tricks you can win.'
        : 'You do not hold the top card in a suit outright yet. Lead cheaply, learn who is void, and keep your high cards for tricks you can win.',
      plan: knownReverse
        ? knownTrump
          ? 'Lead low, reveal the reverse on your terms, and save the high trumps for the point-rich tricks.'
          : 'Lead low, reveal the reverse on your terms, and keep the 7s and 8s for the flipped ranking.'
        : 'Lead low, learn the voids, and keep your high cards until a suit is safe.',
      bullets,
      action: `Play ${cardText(lowCard)}`,
      recommendedCardId: lowCard.id,
    }
  }

  // ---------------- Following ----------------
  const ledSuit = trick[0].card.suit
  const canFollow = hand.some(card => card.suit === ledSuit)
  const reverseNow = knownReverse && (state.trumpRevealed || !canFollow)
  const strengthNow = (card: Card) => cardStrength(card, reverseNow)
  const winnerBefore = winnerOfTrick(trick, knownTrump, state.trumpRevealed, reverseNow)
  const partnerWinning = teamOf(winnerBefore) === teamOf(player)
  const lastToPlay = trick.length === 3
  const playersAfter = 3 - trick.length
  const bullets = [`${trickPoints} point${trickPoints === 1 ? '' : 's'} on the table. ${SUIT_LABEL[ledSuit]} was led.`]
  if (knownReverse) {
    bullets.push(state.trumpRevealed
      ? knownTrump
        ? `Reverse is active: ${SUIT_LABEL[knownTrump]} is trump, the trump 7 is the strongest card, and 7 is high in every suit.`
        : 'Reverse is active: no trump, 7 is high and J is low.'
      : knownTrump
        ? `You declared Reverse with ${SUIT_LABEL[knownTrump]} as trump; the first void reveals the suit and the 7-high ranking.`
        : 'No trump: playing off-suit exposes the 2 and flips the ranking.')
  }
  if (seventhLine) bullets.push(seventhLine)
  if (state.mustTrump === player && state.trumpSuit) {
    bullets.push('You exposed the contract, so the rules require a trump from you this trick if you hold one.')
  }

  // The hidden contract must be exposed before a void player can discard.
  if (!canFollow && !state.trumpRevealed) {
    const hasTrump = !!state.trumpSuit
    bullets.push(hasTrump
      ? 'The reveal is public: the trump suit applies from this trick onward, and the revealer must play a trump if able.'
      : 'The reveal is public: the reverse ranking starts with this trick, and there is no trump to play.')
    if (line) bullets.push(line)
    return {
      tag, tone: 'warn', confidence: 'certain',
      title: hasTrump
        ? state.reverse ? 'Reveal the hidden reverse trump' : 'Reveal the hidden trump first'
        : 'Reveal the hidden reverse first',
      summary: 'You are void in the led suit. The face-down contract must be exposed before you choose a card.',
      plan: hasTrump
        ? 'Tap the hidden contract to reveal it, then play a trump if you have one. If you have no trump, discard your cheapest card.'
        : 'Tap the hidden contract to reveal it, then discard your cheapest card. There is no trump suit to play.',
      bullets,
      action: 'Reveal the contract',
    }
  }

  if (partnerWinning) {
    if (lastToPlay) {
      const bestPoint = [...legal].sort((a, b) => b.points - a.points || strengthNow(b) - strengthNow(a))[0]
      if (bestPoint.points > 0) {
        bullets.push(`You play last, so your partner's card already holds the trick. ${cardText(bestPoint)} adds ${bestPoint.points} point${bestPoint.points === 1 ? '' : 's'} that the opponents can no longer touch.`)
        if (line) bullets.push(line)
        return {
          tag, tone: 'good', confidence: 'certain',
          title: `Your team has the trick — add ${cardText(bestPoint)}`,
          summary: 'With your partner winning and nobody left to beat it, every point card you throw in is captured by your team.',
          plan: 'Add points while partner’s winning card is protected. No opponent can change this trick.',
          bullets,
          action: `Play ${cardText(bestPoint)}`,
          recommendedCardId: bestPoint.id,
        }
      }
      const cheapest = [...legal].sort((a, b) => strengthNow(a) - strengthNow(b))[0]
      bullets.push('No point cards are left to add, so keep your stronger cards for later tricks.')
      return {
        tag, tone: 'good', confidence: 'certain',
        title: `Play low with ${cardText(cheapest)}`,
        summary: 'Your partner already won the trick. Finishing with a low card keeps your stronger cards in hand.',
        plan: 'Let partner’s card win. Save your high cards for a trick they can control later.',
        bullets,
        action: `Play ${cardText(cheapest)}`,
        recommendedCardId: cheapest.id,
      }
    }
    const safeCard = [...legal].sort((a, b) => {
      const aTrump = knownTrump === a.suit ? 1 : 0
      const bTrump = knownTrump === b.suit ? 1 : 0
      return aTrump - bTrump || a.points - b.points || strengthNow(a) - strengthNow(b)
    })[0]
    bullets.push(`${playersAfter} opponent${playersAfter === 1 ? '' : 's'} still ${playersAfter === 1 ? 'plays' : 'play'} after you, so the trick is not secured yet.`)
    if (line) bullets.push(line)
    return {
      tag, tone: 'neutral', confidence: 'certain',
      title: 'Partner is winning — play low',
      summary: `Your partner is ahead, but ${playersAfter} opponent${playersAfter === 1 ? '' : 's'} still play${playersAfter === 1 ? 's' : ''} after you. Spend the least valuable card and keep your high cards for a trick you can definitely win.`,
      plan: 'Do not overtake partner unless an opponent can still beat the trick. Keep your high cards for the next lead.',
      bullets,
      action: `Play ${cardText(safeCard)}`,
      recommendedCardId: safeCard.id,
    }
  }

  const takesTrick = legal
    .filter(card => {
      const revealed = state.trumpRevealed || card.suit !== ledSuit
      const reverseFor = knownReverse && revealed
      return teamOf(winnerOfTrick([...trick, { player, card }], knownTrump, revealed, reverseFor)) === teamOf(player)
    })
    .sort((a, b) => strengthNow(a) - strengthNow(b) || a.points - b.points)

  if (takesTrick.length) {
    const cheapest = takesTrick[0]
    bullets.push(`${cardText(cheapest)} is the cheapest legal card that still moves the trick to your side.`)
    if (trickPoints > 0) bullets.push(`It captures ${trickPoints + cheapest.points} point${trickPoints + cheapest.points === 1 ? '' : 's'} for your team.`)
    if (line) bullets.push(line)
    return {
      tag, tone: 'good', confidence: 'certain',
      title: `Take the trick with ${cardText(cheapest)}`,
      summary: 'Your opponents lead the trick. Overtaking with the cheapest winning card keeps your strongest cards for later.',
      plan: 'Win this trick with the cheapest card that still does the job. Save your Jacks and Nines for later point tricks.',
      bullets,
      action: `Play ${cardText(cheapest)}`,
      recommendedCardId: cheapest.id,
    }
  }

  const discard = [...legal]
    .filter(card => (knownTrump ? card.suit !== knownTrump : true))
    .sort((a, b) => a.points - b.points || strengthNow(a) - strengthNow(b))[0] ?? [...legal].sort((a, b) => a.points - b.points || strengthNow(a) - strengthNow(b))[0]
  bullets.push('No legal card beats the current winner, so any point card you add is captured by the opponents.')
  if (line) bullets.push(line)
  return {
    tag, tone: 'warn', confidence: 'certain',
    title: `You cannot win this trick — discard ${cardText(discard)}`,
    summary: 'Concede cheaply. Keeping point cards in hand gives your team a chance to capture them in a trick it wins later.',
    plan: 'Give up this trick at the lowest cost. Save your point cards for a trick your team can win.',
    bullets,
    action: `Play ${cardText(discard)}`,
    recommendedCardId: discard.id,
  }
}

// ---------------------------------------------------------------------------
// Off-turn table reads
// ---------------------------------------------------------------------------

/**
 * A non-actionable read for the seat that is currently acting. This is what the coach
 * shows while an opponent or partner is thinking, instead of pretending it is your turn.
 * It uses only public information: the trick, known voids, the contract and the cards
 * already played.
 */
export function observationInsight(state: GameState, player = 0): CoachInsight {
  if (state.phase === 'auction') {
    const actor = state.currentPlayer
    const name = PLAYER_NAMES[actor]
    if (state.auctionComplete) {
      return {
        tag: 'Auction complete', tone: 'neutral', confidence: 'certain', source: 'observation',
        title: 'The auction is complete',
        summary: `The contract is paused at ${state.highBid}. Review the final board, then continue to the trump choice.`,
        plan: 'Read the final auction board before continuing. The target is fixed now.',
        bullets: [
          state.bidder !== null ? `${PLAYER_NAMES[state.bidder]} won the auction with ${state.highBid}.` : 'The auction has ended.',
          'The trump choice is the next decision.',
        ],
      }
    }
    const nextBid = state.highBid === null ? 16 : state.highBid + 1
    return {
      tag: 'Table read', tone: 'neutral', confidence: 'estimate', source: 'observation',
      title: `${name} is considering the auction`,
      summary: `The high bid is ${state.highBid ?? 'not open'}. ${name} will raise only if the opening four support ${nextBid}; a pass usually means their best suit falls short.`,
      plan: `Watch whether ${name} raises or passes. The level tells you how strong their opening four are.`,
      bullets: [
        state.highBid === null ? 'The opening minimum is 16.' : `The next bid is ${nextBid}.`,
        'A bot uses the same public auction standard as the table: thin hands pass, supported hands raise.',
      ],
    }
  }

  if (state.phase === 'trump') {
    const bidder = state.bidder ?? 0
    return {
      tag: 'Contract read', tone: 'neutral', confidence: 'estimate', source: 'observation',
      title: `${PLAYER_NAMES[bidder]} is choosing the contract`,
      summary: 'The bidder chooses trump from the opening four, calls the seventh card, or declares Reverse. The choice stays hidden until the first void.',
      plan: 'Watch the first suit they lead and whether the trump indicator flips. That tells you where their strength sits.',
      bullets: [
        `Contract target: ${contractTarget(state)} points.`,
        state.rules.reverse || state.rules.reverseTrump
          ? `Reverse is available${state.rules.reverse && state.rules.reverseTrump ? ' with or without trump' : state.rules.reverseTrump ? ' with a named trump' : ' as no trump'}; the ranking flips to 7 high on the first void.`
          : 'The trump suit is hidden.',
      ],
    }
  }

  if (state.phase === 'stake') {
    const doubling = state.stakeStage === 'defend'
    return {
      tag: 'Stake read', tone: 'neutral', confidence: 'estimate', source: 'observation',
      title: doubling ? 'The defenders are deciding whether to double' : 'The declaring side is deciding whether to redouble',
      summary: doubling
        ? 'A double means the defenders expect the contract to fail; a pass keeps the hand at one match point.'
        : 'A redouble means the declaring side is confident the contract is safe; otherwise the hand stays doubled.',
      plan: 'Watch the decision: a double or redouble is a public statement about how safe the contract looks.',
      bullets: [
        `The hand is currently worth ${doubling ? 1 : 2} match point${doubling ? '' : 's'} before the decision.`,
        `The contract target remains ${contractTarget(state)}.`,
      ],
    }
  }

  if (state.phase !== 'play') {
    return {
      tag: 'Table read', tone: 'neutral', confidence: 'certain', source: 'observation',
      title: 'Read the table before the next decision',
      summary: 'The next action belongs to another seat. Use the visible cards and the contract count to update your plan.',
      plan: 'Follow the points and the voids; they decide which suits are safe.',
      bullets: [],
    }
  }

  const actor = state.currentPlayer
  const name = PLAYER_NAMES[actor]
  const trick = state.currentTrick
  const ledSuit = trick[0]?.card.suit
  const voids = knownVoids(state)
  const trickPoints = trick.reduce((sum, play) => sum + play.card.points, 0)
  const knownTrump = state.trumpRevealed ? state.trumpSuit : null
  const currentWinner = trick.length > 0 ? winnerOfTrick(trick, state.trumpSuit, state.trumpRevealed, state.reverse && state.trumpRevealed) : null
  const line = contractLine(state, player)
  const unseen = unseenCards(state, player)
  const trumpsUnseen = knownTrump ? unseen.filter(card => card.suit === knownTrump).length : 0
  const bullets = [`Public cards only: ${trick.length} card${trick.length === 1 ? '' : 's'} on the table for ${trickPoints} point${trickPoints === 1 ? '' : 's'}.`]
  const actorVoids = [...voids[actor]].map(suit => SUIT_LABEL[suit])
  if (trick.length === 0 && actorVoids.length) bullets.push(`${name} has shown void in ${actorVoids.join(', ')}; those suits are not lead options.`)
  if (knownTrump) bullets.push(`${trumpsUnseen} trump${trumpsUnseen === 1 ? '' : 's'} remain unseen.${state.reverse && state.trumpRevealed ? ' Reverse ranking: the trump 7 is strongest, and 7 is high in every suit.' : ''}`)
  else if (state.reverse && state.trumpRevealed) bullets.push('No trump: Reverse is active, so 7 is high and J is low.')
  else bullets.push('The contract mode is still hidden. A void is the next public information.')
  if (line) bullets.push(line)

  if (trick.length === 0) {
    bullets.splice(1, 0, 'Likely lead: a low probe, a trump draw, or a point card protected by a higher card.')
    return {
      tag: 'Table read', tone: 'neutral', confidence: 'estimate', source: 'observation',
      title: `${name} is on lead`,
      summary: `A low lead is usually a probe; a trump lead usually tries to draw trumps; a point card usually has a higher card behind it. Watch the first card to learn ${name}'s plan.`,
      plan: `Do not commit your high cards yet. Read the suit and the size of the lead before you choose your response.`,
      bullets,
    }
  }

  const actorVoid = !!ledSuit && voids[actor].has(ledSuit)
  const winnerName = currentWinner === null ? 'nobody' : PLAYER_NAMES[currentWinner]
  const partnerWinning = currentWinner !== null && teamOf(currentWinner) === teamOf(actor)
  bullets.splice(1, 0, actorVoid
    ? 'Likely action: ruff if they still hold trump, otherwise discard a low card.'
    : partnerWinning
      ? 'Likely action: duck and let their partner keep the trick.'
      : 'Likely action: try to win with the cheapest card, otherwise discard low.')
  return {
    tag: 'Table read', tone: 'neutral', confidence: 'estimate', source: 'observation',
    title: `${name} is following ${SUIT_LABEL[ledSuit!]}`,
    summary: actorVoid
      ? `${name} has already shown void in ${SUIT_LABEL[ledSuit!]}. They can ruff if they still hold trump, otherwise they must discard.`
      : `${name} must follow ${SUIT_LABEL[ledSuit!]} if possible. ${winnerName} currently wins the trick.`,
    plan: `Watch whether ${name} follows, ruffs, or discards. That tells you their shape for the next lead.`,
    bullets: [
      ...bullets,
      `Current winner: ${winnerName}. ${trickPoints} point${trickPoints === 1 ? '' : 's'} at stake.`,
    ],
  }
}

/**
 * Explain the last card a non-human seat played. This is a public read of the table,
 * not a claim about the actual hidden hand.
 */
export function lastPlayInsight(state: GameState, player = 0): CoachInsight | null {
  if (state.phase !== 'play') return null
  const paused = state.pausedTrick
  const plays = paused?.plays ?? state.currentTrick
  if (plays.length === 0) return null
  const last = plays[plays.length - 1]
  if (last.player === player) return null
  const name = PLAYER_NAMES[last.player]
  const card = last.card
  const ledSuit = plays[0].card.suit
  const followed = card.suit === ledSuit
  const isLead = plays.length === 1
  const knownTrump = state.trumpRevealed ? state.trumpSuit : null
  const isTrump = !!knownTrump && card.suit === knownTrump
  const reverseActive = state.reverse && state.trumpRevealed
  const winner = paused ? paused.winner : winnerOfTrick(plays, state.trumpSuit, state.trumpRevealed, reverseActive)
  const winningNow = winner === last.player
  const trickPoints = paused ? paused.points : plays.reduce((sum, play) => sum + play.card.points, 0)
  const points = card.points
  let summary: string
  let plan: string

  if (isLead) {
    if (isTrump) {
      summary = `${name} led trump to draw trumps and cut down future ruffs.`
      plan = 'Expect more trump leads. Keep your point cards protected.'
    } else if (points > 0) {
      summary = `${name} led ${cardText(card)}, a ${points}-point card. A point lead usually means a higher card in the same suit is behind it.`
      plan = `Do not treat ${SUIT_LABEL[card.suit]} as safe just because ${cardText(card)} is on the table.`
    } else {
      summary = `${name} led a low ${SUIT_LABEL[card.suit]}. That is usually a probe: keep the high cards and learn who is void.`
      plan = `Expect ${name} to hold higher cards in ${SUIT_LABEL[card.suit]}.`
    }
  } else if (!followed) {
    if (isTrump) {
      summary = `${name} was void in ${SUIT_LABEL[ledSuit]} and ruffed with ${cardText(card)}.`
      plan = `Their void is public now. Avoid leading ${SUIT_LABEL[ledSuit]} while they can still ruff.`
    } else {
      summary = `${name} was void in ${SUIT_LABEL[ledSuit]} and discarded ${cardText(card)}, saving trump and point cards.`
      plan = `They are void in ${SUIT_LABEL[ledSuit]}; a lead there can be ruffed if they still hold trump.`
    }
  } else if (winningNow) {
    summary = paused
      ? `${name} played ${cardText(card)}, and it won the trick. That usually keeps stronger cards in the suit for later.`
      : `${name} played ${cardText(card)}, which currently wins the trick. That usually keeps stronger cards in the suit for later.`
    plan = 'They have the trick; expect their stronger cards to appear in a later trick.'
  } else {
    const pointLine = points > 0 ? ` It adds ${points} point${points === 1 ? '' : 's'} to the trick.` : ''
    summary = `${name} followed with ${cardText(card)}, but ${PLAYER_NAMES[winner]} ${paused ? 'won' : 'currently wins'} the trick.${pointLine}`
    plan = 'They are conceding this trick cheaply; the winner captures the points.'
  }

  const ours = teamOf(last.player) === teamOf(player)
  return {
    tag: 'Last play', tone: ours ? (winningNow ? 'good' : 'neutral') : (winningNow ? 'warn' : 'neutral'), confidence: 'certain', source: 'observation',
    title: `${name} played ${cardText(card)}`,
    summary,
    plan,
    bullets: [
      `${trickPoints} point${trickPoints === 1 ? '' : 's'} on the table. Current winner: ${PLAYER_NAMES[winner]}.`,
      isLead ? 'This was the lead, so it set the suit for the trick.' : followed ? `They followed ${SUIT_LABEL[ledSuit]}.` : `They were void in ${SUIT_LABEL[ledSuit]}.`,
    ],
  }
}

// ---------------------------------------------------------------------------
// Table reading (facts, not advice)
// ---------------------------------------------------------------------------

export function tableReading(state: GameState, player = 0): string[] {
  const unseen = unseenCards(state, player)
  const pointCards = unseen
    .filter(card => card.points > 0)
    .sort((a, b) => b.points - a.points || b.strength - a.strength)
  const lines: string[] = []

  if (state.phase === 'auction') {
    const hand = state.hands[player] ?? []
    const report = openingReport(hand)
    const pointCards = hand.filter(card => card.points > 0).length
    const longest = [...rankSuits(hand)].sort((a, b) => b.count - a.count || b.power - a.power)[0]
    const points = hand.reduce((sum, card) => sum + card.points, 0)
    lines.push(`You hold <b>${pointCards}</b> point card${pointCards === 1 ? '' : 's'} worth <b>${points}</b> point${points === 1 ? '' : 's'} in the opening four.`)
    lines.push(`Longest suit: <b>${SUIT_LABEL[longest.suit]}</b> (${longest.count} card${longest.count === 1 ? '' : 's'}). Best control: <b>${SUIT_LABEL[report.suit]}</b>.`)
    if (state.rules.pair && report.pairPotential) lines.push(`You hold the <b>K+Q of ${SUIT_LABEL[report.suit]}</b> — a royal pair if you win the auction and reveal trump.`)
    if (state.auctionComplete && state.bidder !== null) lines.push(`Auction won by <b>${state.bidder === 0 ? 'you' : PLAYER_NAMES[state.bidder]}</b> at <b>${state.highBid}</b>. Continue to choose the contract.`)
    lines.push('The other 28 cards are unseen; four more arrive after the auction.')
    return lines
  }

  if (state.phase === 'play') {
    const totals = completedPoints(state)
    const ourTeam = teamOf(player)
    const theirTeam = (1 - ourTeam) as 0 | 1
    const target = contractTarget(state)
    lines.push(`Points captured — your team <b>${totals[ourTeam]}</b>, opponents <b>${totals[theirTeam]}</b>. Contract target <b>${target}</b>.`)
    if (state.pair) lines.push(`The <b>${state.pair.effect === 'reduce' ? 'bidding' : 'defending'}</b> side declared the royal pair; the target is <b>${target}</b>.`)
    if (state.stake > 1) lines.push(`The hand is worth <b>${state.stake} match points</b> after the stake.`)
  }

  if (state.seventhCard && state.bidder === player) {
    lines.push(`Your seventh card <b>${cardText(state.seventhCard)}</b> is set aside and will join your hand when trump is revealed.`)
  }

  lines.push(
    pointCards.length
      ? `<b>${pointCards.length}</b> point card${pointCards.length === 1 ? '' : 's'} still unseen: ${pointCards.slice(0, 4).map(cardText).join(', ')}${pointCards.length > 4 ? '…' : ''}.`
      : 'All point cards have been played.',
  )

  if (state.reverse) {
    if (state.trumpRevealed) {
      lines.push(state.trumpSuit
        ? `Reverse is active: <b>${SUIT_LABEL[state.trumpSuit]}</b> is trump; the trump 7 is the strongest card, and 7 is high in every suit.`
        : 'Reverse is active: <b>no trump</b>; 7 is high and J is low.')
    } else if (state.bidder === player) {
      lines.push(state.trumpSuit
        ? `You declared <b>Reverse</b> with <b>${SUIT_LABEL[state.trumpSuit]}</b> as trump. The suit and the 7-high ranking stay hidden until the first void.`
        : 'You declared <b>Reverse</b>—no trump. The 2 indicator stays face down until the first void, then 7 becomes high and J low.')
    } else {
      lines.push('The contract is still hidden. A void will expose the trump and the reverse ranking.')
    }
    if (state.trumpSuit && state.trumpRevealed) {
      const trumps = unseen.filter(card => card.suit === state.trumpSuit)
      lines.push(`Trump is <b>${SUIT_LABEL[state.trumpSuit]}</b>. ${trumps.length} trump${trumps.length === 1 ? '' : 's'} unseen; the trump 7 is still the strongest card on the table.`)
    }
  } else if (state.trumpSuit && state.trumpRevealed) {
    const trumps = unseen.filter(card => card.suit === state.trumpSuit)
    const top = trumps.sort((a, b) => b.strength - a.strength)[0]
    lines.push(`Trump is <b>${SUIT_LABEL[state.trumpSuit]}</b> and revealed. ${trumps.length} trump${trumps.length === 1 ? '' : 's'} unseen${top ? `, highest ${cardText(top)}` : ''}.`)
  } else if (state.trumpSuit && state.bidder === player) {
    lines.push(`You know trump is <b>${SUIT_LABEL[state.trumpSuit]}</b>, but it stays hidden from the table until the first void.`)
  } else if (state.trumpSuit) {
    lines.push('Trump is still hidden. Avoid being the first player to show a void unless it wins the trick.')
  }

  const voids = knownVoids(state)
  const voidLines = [1, 3]
    .flatMap(seat => [...voids[seat]].map(suit => `${PLAYER_NAMES[seat]} is void in ${SUIT_LABEL[suit]}`))
  if (voidLines.length) lines.push(`${voidLines.slice(0, 2).join('; ')}.`)

  return lines.slice(0, 5)
}

// ---------------------------------------------------------------------------
// Post-hand insights
// ---------------------------------------------------------------------------

export interface HandInsights {
  bullets: string[]
  lesson: string
}

export function handInsights(game: GameState): HandInsights {
  const review = game.review
  if (!review) return { bullets: [], lesson: '' }
  const ourTeam = 0
  const theirTeam = 1
  const biddingTeam = review.contractTeam
  const biddingPoints = review.teamPoints[biddingTeam]
  const bullets: string[] = []

  if (biddingTeam === ourTeam) {
    const margin = biddingPoints - review.target
    bullets.push(
      margin >= 0
        ? `Your team needed <b>${review.target}</b> and captured <b>${biddingPoints}</b> points — ${margin} above the line.`
        : `Your team needed <b>${review.target}</b> and captured <b>${biddingPoints}</b> — ${Math.abs(margin)} point${Math.abs(margin) === 1 ? '' : 's'} short.`,
    )
  } else {
    bullets.push(
      review.success
        ? `The opponents needed <b>${review.target}</b> and reached <b>${biddingPoints}</b>. Your defence needed to hold them ${biddingPoints - review.target + 1} point${biddingPoints - review.target + 1 === 1 ? '' : 's'} lower.`
        : `The opponents needed <b>${review.target}</b> and finished on <b>${biddingPoints}</b>. Your defence took the contract down.`,
    )
  }
  if (review.pair) {
    bullets.push(`The royal pair was declared by <b>${PLAYER_NAMES[review.pair.player]}</b>, moving the target ${review.pair.effect === 'reduce' ? 'down' : 'up'} to <b>${review.target}</b>.`)
  }
  if (review.stake > 1) {
    bullets.push(`The hand was played for <b>${review.stake} match points</b> after the ${review.stake === 4 ? 'redouble' : 'double'}.`)
  }

  const trumpSuit = review.trumpSuit
  const trumpsLost = trumpSuit
    ? game.tricks
      .filter(trick => teamOf(trick.winner) === theirTeam)
      .flatMap(trick => trick.plays.filter(play => teamOf(play.player) === ourTeam && play.card.suit === trumpSuit))
    : []
  if (review.reverse) {
    bullets.push(trumpSuit
      ? `This was a <b>reverse</b> contract with <b>${SUIT_LABEL[trumpSuit]}</b> as trump: 7 was high in every suit, so the trump 7 was the strongest card once revealed.`
      : 'This was a <b>reverse</b> contract: no trump, with 7 high and J low once the 2 indicator was exposed.')
  } else if (trumpSuit) {
    bullets.push(
      trumpsLost.length
        ? `<b>${trumpsLost.length}</b> trump${trumpsLost.length === 1 ? '' : 's'} from your team went into tricks the opponents won.`
        : 'Your team never wasted a trump on a trick the opponents won.',
    )
  }

  const revealTrick = game.tricks.find(trick => {
    const ledSuit = trick.plays[0]?.card.suit
    return trick.plays.some(play => ledSuit && play.card.suit !== ledSuit)
  })
  bullets.push(
    review.reverse
      ? revealTrick
        ? review.trumpSuit
          ? `The reverse was exposed on trick <b>${revealTrick.number}</b>. From that trick onward, 7s were the strongest cards in every suit and ${SUIT_LABEL[review.trumpSuit]} won every ruff.`
          : `Reverse was exposed on trick <b>${revealTrick.number}</b>. From that trick onward, 7s were the strongest cards.`
        : review.trumpSuit
          ? 'The reverse trump was never exposed, so the normal ranking stood all hand.'
          : 'The 2 indicator was never exposed, so the normal ranking stood all hand.'
      : revealTrick
        ? `Trump first appeared on trick <b>${revealTrick.number}</b>. Before that, only the led suit could win — high cards were safe.`
        : 'Nobody showed a void, so trump never decided a trick. Following suit cleanly kept the hand readable.',
  )

  const worstLoss = game.tricks
    .filter(trick => teamOf(trick.winner) === theirTeam)
    .sort((a, b) => b.cardPoints - a.cardPoints)[0]
  if (worstLoss && worstLoss.cardPoints > 0) {
    bullets.push(`The most expensive trick you lost was trick <b>${worstLoss.number}</b> (${worstLoss.cardPoints} points).`)
  }

  bullets.push(`Point cards captured: your team <b>${review.cardPoints[ourTeam]}</b>, opponents <b>${review.cardPoints[theirTeam]}</b>.`)

  const donated = review.notes.filter(note => note.level === 'opportunity').reduce((sum, note) => sum + (note.pointsAtStake ?? 0), 0)
  const efficiency = review.notes.filter(note => note.level === 'efficiency').length
  let lesson: string
  if (!review.success && biddingTeam === ourTeam) {
    if (donated >= 2) lesson = `The contract slipped by ${Math.abs(biddingPoints - review.target)}. You also gave away about ${donated} point${donated === 1 ? '' : 's'} on lost tricks — discarding zero-point cards there would have closed most of the gap.`
    else if (review.bidReview?.verdict === 'aggressive') lesson = `The contract was pitched above what the opening four cards promised. Bid one lower when the hand relies on partner or lucky distribution.`
    else if (trumpsLost.length >= 2) lesson = `Two or more trumps went into lost tricks. Keep one trump back for the late point-rich tricks instead of spending it on a trick your side could not win.`
    else lesson = `The contract was close. Review the tricks where point cards went to the opponents and aim to win one more of those next time.`
  } else if (review.success && biddingTeam === ourTeam) {
    lesson = efficiency
      ? `Contract made, but ${efficiency} efficiency note${efficiency === 1 ? '' : 's'} show points left in hand. Collecting them would have widened a narrow margin.`
      : 'A controlled contract: you kept the trump count healthy and took the point cards when the trick was already yours.'
  } else if (review.success && biddingTeam === theirTeam) {
    lesson = 'The opponents made their contract. Look for the trick where your side could have taken one extra point card with a cheaper winning card.'
  } else {
    lesson = donated >= 2
      ? `The defence held, but about ${donated} point${donated === 1 ? '' : 's'} were donated. Zero-point discards make the difference between a comfortable defeat and a one-point scare.`
      : 'A disciplined defence: you conceded cheap tricks and kept enough control to keep the bidding team short of the line.'
  }

  return { bullets: bullets.slice(0, 7), lesson }
}

export function stakeInsight(state: GameState, player = 0): CoachInsight {
  const contractTeam = teamOf(state.bidder ?? 0)
  const defending = teamOf(player) !== contractTeam
  const stage = state.stakeStage
  if (!stage) {
    return {
      tag: 'Stakes', tone: 'neutral', confidence: 'certain',
      title: 'Play the hand at the current stake',
      summary: 'No double is active. The hand is worth one match point to the bidding team.',
      plan: 'Play the hand at the normal stake. The target is unchanged.',
      bullets: [],
    }
  }
  const doubling = stage === 'defend'
  const bidder = state.bidder ?? 0
  const sideLabel = teamOf(bidder) === teamOf(player) ? 'Your side' : `${PLAYER_NAMES[bidder]}'s side`
  const bullets = [
    `${sideLabel} bid ${state.highBid} for a target of ${contractTarget(state)} points.`,
    doubling
      ? 'A double makes the hand worth 2 match points to the bidding team, won or lost.'
      : 'A redouble makes the hand worth 4 match points to the bidding team, won or lost.',
  ]
  if (defending) {
    const hand = state.hands[player] ?? []
    const bestPower = Math.max(...SUITS.map(suit => suitPower(hand, suit)))
    bullets.push(`Your best suit power is ${bestPower.toFixed(1)}. Double when you expect the contract to fail.`)
  } else {
    bullets.push('Redouble only when the contract is comfortably inside what your side can make.')
  }
  return {
    tag: 'Stakes',
    tone: doubling ? 'warn' : 'neutral',
    confidence: 'estimate',
    title: doubling ? 'Double the stakes?' : 'Redouble the stakes?',
    summary: doubling
      ? 'The defenders can double before the first trick. The bidding team keeps the same target; only the match-point swing changes.'
      : 'The defenders doubled. Your side can redouble to make the hand worth four match points.',
    plan: doubling
      ? 'Double only when you expect the contract to fail. Otherwise play on at one match point.'
      : 'Redouble only when the contract is comfortably inside what your side can make.',
    bullets,
    action: doubling ? 'Double if the contract looks short' : 'Redouble only with a strong contract',
  }
}

export function coachInsight(state: GameState, player = 0): CoachInsight {
  if (state.phase === 'auction') return bidInsight(state, player)
  if (state.phase === 'trump') return trumpInsight(state, player)
  if (state.phase === 'stake') return stakeInsight(state, player)
  if (state.phase === 'play') return playInsight(state, player)
  return {
    tag: 'Review', tone: 'neutral', confidence: 'certain',
    title: 'Review the decisions, not just the result',
    summary: 'Hidden cards can create unlucky outcomes without making a move wrong. Use the note list and the sampled-deal review together.',
    bullets: [],
  }
}
