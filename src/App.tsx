import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BookOpen, Brain, Check,
  ChevronLeft, ChevronRight, CircleHelp, Clock3, Crown, Eye, Flag, Hand, Lightbulb, RotateCcw,
  Settings2, ShieldCheck, Sparkles, Swords, Target, X,
} from 'lucide-react'
import {
  applyBid, botBid, botDoubleDecision, botRedoubleDecision, cardText,
  chooseBotCard, chooseBotTrump, chooseReverse, chooseSeventhCard, chooseTrump, continueAfterAuction,
  continueAfterTrick, contractTarget, declarePair, DEFAULT_RULES, isRedSuit, legalCardsFor,
  maxBidFor, newHand, openingReport, pairEligible, playCard, PLAYER_NAMES, PLAYER_POSITIONS,
  resolveStake, SUITS, SUIT_LABEL, SUIT_SYMBOL, teamOf, type Card, type GameState, type RuleSet,
  type Suit,
} from './game'
import { coachInsight, handInsights, lastPlayInsight, observationInsight, tableReading, type CoachInsight } from './coach'
import { sanitizeStateForEvaluation, type DeepReviewResult, type MoveEvaluation } from './ai/evaluator'
import { chooseBotCardWithSearch } from './ai/search'
import './styles.css'

type SessionStats = {
  handsPlayed: number
  contractsMade: number
  contractsAttempted: number
  clearMistakes: number
}

type Preferences = RuleSet & {
  coach: boolean
  compareSamples: number
  reviewSamples: number
  botSamples: number
  searchBots: boolean
}

const DEFAULT_STATS: SessionStats = { handsPlayed: 0, contractsMade: 0, contractsAttempted: 0, clearMistakes: 0 }
const STATS_KEY = 'twenty-nine-trainer-stats-v1'
const PREFS_KEY = 'twenty-nine-trainer-preferences-v2'
const COMPARE_SAMPLE_OPTIONS = [48, 96, 200, 400] as const
const REVIEW_SAMPLE_OPTIONS = [48, 96, 200, 400] as const
const BOT_SAMPLE_OPTIONS = [24, 48, 96, 200] as const
const DEFAULT_COMPARE_SAMPLES = 200
const DEFAULT_REVIEW_SAMPLES = 200
const DEFAULT_BOT_SAMPLES = 96
const DEFAULT_PREFERENCES: Preferences = {
  ...DEFAULT_RULES,
  coach: true,
  compareSamples: DEFAULT_COMPARE_SAMPLES,
  reviewSamples: DEFAULT_REVIEW_SAMPLES,
  botSamples: DEFAULT_BOT_SAMPLES,
  searchBots: true,
}

function sampleChoice(value: unknown, options: readonly number[], fallback: number): number {
  return typeof value === 'number' && options.includes(value) ? value : fallback
}

function getStats(): SessionStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_KEY) || 'null') as Partial<SessionStats> | null
    return { ...DEFAULT_STATS, ...parsed }
  } catch {
    return DEFAULT_STATS
  }
}

function getPreferences(): Preferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') as Partial<Preferences> | null
    return {
      lastTrickBonus: parsed?.lastTrickBonus === true,
      pair: parsed?.pair !== false,
      seventhCard: parsed?.seventhCard !== false,
      double: parsed?.double !== false,
      reverse: parsed?.reverse === true,
      coach: parsed?.coach !== false,
      compareSamples: sampleChoice(parsed?.compareSamples, COMPARE_SAMPLE_OPTIONS, DEFAULT_COMPARE_SAMPLES),
      reviewSamples: sampleChoice(parsed?.reviewSamples, REVIEW_SAMPLE_OPTIONS, DEFAULT_REVIEW_SAMPLES),
      botSamples: sampleChoice(parsed?.botSamples, BOT_SAMPLE_OPTIONS, DEFAULT_BOT_SAMPLES),
      searchBots: parsed?.searchBots !== false,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function sortHand(cards: Card[]): Card[] {
  const order: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  return [...cards].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || b.strength - a.strength)
}

function suitColor(suit: Suit) {
  return isRedSuit(suit) ? 'red' : 'black'
}

/** Render suit symbols with the same red/light ink everywhere outside the card faces. */
function SuitText({ text }: { text: string }) {
  return <>{text.split(/([♠♥♦♣])/g).map((part, index) => {
    if (part === '♥' || part === '♦') return <span key={index} className="suit-red">{part}</span>
    if (part === '♠' || part === '♣') return <span key={index} className="suit-light">{part}</span>
    return <span key={index}>{part}</span>
  })}</>
}

function colorizeSuitSymbols(text: string): string {
  return text
    .replace(/[♥♦]/g, '<span class="suit-red">$&</span>')
    .replace(/[♠♣]/g, '<span class="suit-light">$&</span>')
}

function CardFace({ card, hidden = false, playable = false, disabled = false, compact = false, onClick, label }: {
  card?: Card
  hidden?: boolean
  playable?: boolean
  disabled?: boolean
  compact?: boolean
  onClick?: () => void
  label?: string
}) {
  if (hidden || !card) {
    return <div className={`playing-card card-back ${compact ? 'card-compact' : ''}`} aria-label="Face-down card"><div className="back-pattern"><span>29</span></div></div>
  }
  const color = suitColor(card.suit)
  const content = <>
    <span className={`card-corner corner-top ${color}`}><strong>{card.rank}</strong><span>{SUIT_SYMBOL[card.suit]}</span></span>
    <span className={`card-center-suit ${color}`}>{SUIT_SYMBOL[card.suit]}</span>
    <span className={`card-corner corner-bottom ${color}`}><strong>{card.rank}</strong><span>{SUIT_SYMBOL[card.suit]}</span></span>
  </>
  if (onClick || playable) {
    return <button type="button" className={`playing-card ${playable ? 'card-playable' : ''} ${disabled ? 'card-disabled' : ''} ${compact ? 'card-compact' : ''}`} onClick={onClick} disabled={disabled} aria-label={label || cardText(card)}>
      {content}
    </button>
  }
  return <div className={`playing-card ${compact ? 'card-compact' : ''}`} aria-label={label || cardText(card)}>{content}</div>
}

function PlayerSeat({ player, count, isCurrent, dealer, bidder }: {
  player: number
  count: number
  isCurrent: boolean
  dealer: boolean
  bidder: boolean
}) {
  const name = PLAYER_NAMES[player]
  const ours = teamOfSeat(player) === 0
  const initial = player === 0 ? 'Y' : player === 2 ? 'P' : player === 1 ? 'E' : 'W'
  const status = [
    ours ? 'your team' : 'opponents',
    `${count} cards`,
    isCurrent ? 'taking their turn' : '',
    dealer ? 'dealer' : '',
    bidder ? 'auction winner' : '',
  ].filter(Boolean).join(', ')
  const fanCount = Math.max(0, Math.min(8, count))
  return <div className={`player-seat seat-${PLAYER_POSITIONS[player]} ${isCurrent ? 'seat-active' : ''} ${ours ? 'seat-ours' : 'seat-theirs'} ${player === 0 ? 'seat-human' : ''}`} aria-label={`${name}: ${status}`}>
    <div className={`seat-avatar avatar-${ours ? 'ours' : 'theirs'}`} aria-hidden="true">{initial}</div>
    <div className="seat-copy">
      <div className="seat-name-line"><strong>{name}</strong>{isCurrent && <span className="turn-dot" aria-hidden="true" />}</div>
      <div className="seat-handline" aria-hidden="true">
        <span className="seat-fan">{Array.from({ length: fanCount }, (_, index) => <i key={index} style={{ '--fan': index } as CSSProperties} />)}</span>
        <span className="seat-count">{count}</span>
      </div>
    </div>
    <div className="seat-tokens">
      {dealer && <span className="seat-token seat-token-dealer" aria-label="Dealer">D</span>}
      {bidder && <span className="seat-token seat-token-bid" aria-label="Auction winner"><Crown size={11} aria-hidden="true" /></span>}
    </div>
  </div>
}

function teamOfSeat(player: number): 0 | 1 {
  return player % 2 === 0 ? 0 : 1
}

/** The match score as a pair of physical card stacks on the felt. */
function ScoreBoard({ score }: { score: [number, number] }) {
  const stack = (team: 0 | 1) => {
    const value = score[team]
    const depth = Math.min(5, Math.max(0, Math.abs(value) - 1))
    return <div className={`score-card-stack ${team === 0 ? 'score-mine' : 'score-theirs'} ${value < 0 ? 'is-negative' : value > 0 ? 'is-positive' : ''}`}>
      {Array.from({ length: depth }, (_, index) => <i key={index} className="score-card-ghost" style={{ '--depth': index } as CSSProperties} aria-hidden="true" />)}
      <div className="score-card" aria-hidden="true">
        <span className="score-card-pip">{value < 0 ? '♦' : '♠'}</span>
        <strong>{value > 0 ? `+${value}` : value}</strong>
      </div>
    </div>
  }
  return <div className="table-scoreboard" aria-label={`Match score. You ${score[0]}, them ${score[1]}. First to plus six wins.`}>
    <span className="table-object-label">Match</span>
    <div className="score-stacks">{stack(0)}<span className="score-vs" aria-hidden="true">–</span>{stack(1)}</div>
    <div className="score-team-labels" aria-hidden="true"><span>You</span><span /><span>Them</span></div>
  </div>
}

/** A face-down trump indicator that flips when the suit is revealed. */
function TrumpStash({ suit, reverse, indicatorSuit, revealed, knownToYou }: {
  suit: Suit | null
  reverse: boolean
  indicatorSuit: Suit | null
  revealed: boolean
  knownToYou: boolean
}) {
  const shownSuit = reverse ? indicatorSuit : suit
  const showReverse = reverse && (revealed || knownToYou)
  const caption = reverse
    ? revealed
      ? 'No trump'
      : knownToYou ? 'You: Reverse' : 'Hidden'
    : !suit
      ? 'Not set'
      : revealed
        ? SUIT_LABEL[suit]
        : knownToYou ? `You know: ${SUIT_LABEL[suit]}` : 'Hidden'
  return <div className={`trump-stash ${revealed ? 'is-revealed' : ''} ${showReverse ? 'is-reverse' : ''}`} aria-label={showReverse ? `Reverse indicator: ${caption}` : `Trump: ${caption}`}>
    <span className="table-object-label">{showReverse ? 'Reverse' : 'Trump'}</span>
    <div className={`trump-stash-card ${revealed && shownSuit ? 'stash-flipped' : ''}`}>
      {revealed && shownSuit
        ? <div className={`stash-face ${isRedSuit(shownSuit) ? 'stash-red' : 'stash-black'}`}>
          <span className="stash-index">{reverse ? 'R' : 'T'}</span>
          <strong>{reverse ? <><em className="stash-two">2</em>{SUIT_SYMBOL[shownSuit]}</> : SUIT_SYMBOL[shownSuit]}</strong>
          <span className="stash-index stash-index-bottom">{reverse ? 'R' : 'T'}</span>
        </div>
        : <div className="stash-back"><div className="stash-back-pattern"><span>29</span></div></div>}
    </div>
    <span className="trump-stash-caption">{caption}</span>
  </div>
}

function insightKey(tip: CoachInsight): string {
  return `${tip.tag}|${tip.source ?? 'rules'}|${tip.title}|${tip.summary}|${tip.plan ?? ''}|${tip.bullets.join('¦')}|${tip.action ?? ''}|${tip.recommendedCardId ?? ''}`
}

/** Coach advice with a history the player can step through. */
function CoachFeed({ tips, index, onIndex, modelNote, objective, lastPlay }: {
  tips: CoachInsight[]
  index: number
  onIndex: (index: number) => void
  modelNote?: string
  objective?: string
  lastPlay?: CoachInsight | null
}) {
  if (tips.length === 0) return null
  const current = index < 0 ? tips.length - 1 : Math.min(index, tips.length - 1)
  const tip = tips[current]
  const atLatest = current >= tips.length - 1
  return <div className="coach-feed">
    {lastPlay && <div className={`coach-last-play tone-${lastPlay.tone}`}>
      <div className="coach-last-play-head"><span>LAST PLAY</span><strong><SuitText text={lastPlay.title} /></strong></div>
      <p><SuitText text={lastPlay.summary} /></p>
      {lastPlay.plan && <p className="coach-last-play-plan"><SuitText text={lastPlay.plan} /></p>}
    </div>}
    <div className="coach-feed-nav">
      <button type="button" className="coach-nav" onClick={() => onIndex(Math.max(0, current - 1))} disabled={current <= 0} aria-label="Previous coaching tip"><ChevronLeft size={16} aria-hidden="true" /></button>
      <span className="coach-feed-count" aria-live="polite">{current + 1}<i>/</i>{tips.length}</span>
      <button type="button" className="coach-nav" onClick={() => onIndex(Math.min(tips.length - 1, current + 1))} disabled={atLatest} aria-label="Next coaching tip"><ChevronRight size={16} aria-hidden="true" /></button>
      {!atLatest ? <button type="button" className="coach-latest" onClick={() => onIndex(-1)}>Latest</button> : <span className="coach-live"><i aria-hidden="true" />Live</span>}
    </div>
    <CoachInsightCard insight={tip} modelNote={atLatest ? modelNote : undefined} objective={atLatest ? objective : undefined} />
  </div>
}

function CoachInsightCard({ insight, modelNote, objective }: { insight: CoachInsight; modelNote?: string; objective?: string }) {
  const sourceLabel = insight.source === 'observation'
    ? 'TABLE READ'
    : insight.source === 'hybrid'
      ? 'HYBRID · RULE + MODEL'
      : insight.confidence === 'certain' ? 'VISIBLE CARDS' : 'RULE ESTIMATE'
  return <div className={`coach-insight tone-${insight.tone} ${insight.source === 'hybrid' ? 'is-hybrid' : ''} ${insight.source === 'observation' ? 'is-observation' : ''}`}>
    <div className="inline-coach-head">
      <span className="coach-tag">{insight.tag}</span>
      <span className="coach-confidence">{sourceLabel}</span>
    </div>
    {objective && <p className="coach-objective"><span>TABLE GOAL</span><SuitText text={objective} /></p>}
    <h4 className="coach-insight-title"><SuitText text={insight.title} /></h4>
    <p className="coach-summary"><SuitText text={insight.summary} /></p>
    {insight.plan && <p className="coach-plan"><span>PLAN</span><SuitText text={insight.plan} /></p>}
    {insight.action && <div className="coach-action"><Lightbulb size={16} aria-hidden="true" /><span><strong>Do this:</strong> <SuitText text={insight.action} /></span></div>}
    {insight.bullets.length > 0 && <ul className="coach-bullets">
      {insight.bullets.map((bullet, index) => <li key={`${index}-${bullet}`}><SuitText text={bullet} /></li>)}
    </ul>}
    {modelNote && <p className="coach-reco"><Target size={15} aria-hidden="true" /><span><SuitText text={modelNote} /></span></p>}
  </div>
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const closeHandler = useRef(onClose)
  closeHandler.current = onClose
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') closeHandler.current() }
    document.addEventListener('keydown', onKey)
    closeRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><p className="eyebrow">{eyebrow || 'TWENTY-NINE TRAINER'}</p><h2>{title}</h2></div><button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
      {children}
    </section>
  </div>
}

function TrumpChooser({ onChoose, onSeventh, onReverse, seventhEnabled, reverseEnabled }: { onChoose: (suit: Suit) => void; onSeventh: () => void; onReverse: () => void; seventhEnabled: boolean; reverseEnabled: boolean }) {
  return <div className="trump-chooser">
    <div className="action-copy"><div><h3>Choose your trump</h3><p>Pick the suit you want to control, call the seventh card, or declare Reverse.</p></div></div>
    <div className="suit-choice-grid">
      {SUITS.map(suit => <button key={suit} className="suit-choice" onClick={() => onChoose(suit)}>
        <span className={`suit-choice-symbol ${isRedSuit(suit) ? 'suit-red' : 'suit-light'}`}>{SUIT_SYMBOL[suit]}</span><span>{SUIT_LABEL[suit]}</span><span className="choice-arrow">Choose <ArrowUpRight size={13} /></span>
      </button>)}
    </div>
    {seventhEnabled && <button className="seventh-choice" onClick={onSeventh}>
      <span className="seventh-choice-icon"><Sparkles size={18} aria-hidden="true" /></span>
      <span><strong>Call the seventh card</strong><small>The seventh card dealt to you sets trump and stays out of your hand until trump is revealed.</small></span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>}
    {reverseEnabled && <button className="seventh-choice reverse-choice" onClick={onReverse}>
      <span className="seventh-choice-icon reverse-choice-icon">R</span>
      <span><strong>Declare Reverse — no trump</strong><small>A 2 is the table indicator. It stays face down; the first void flips the ranking to 7 high and J low. No royal pair.</small></span>
      <ArrowUpRight size={16} aria-hidden="true" />
    </button>}
  </div>
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: () => void }) {
  return <div className="setting-row">
    <div className="setting-copy"><strong>{title}</strong><p>{description}</p></div>
    <button role="switch" aria-checked={checked} aria-label={title} className={`toggle ${checked ? 'toggle-on' : ''}`} onClick={onChange}><span /></button>
  </div>
}

function SelectRow({ title, description, value, options, suffix = 'deals', disabled = false, onChange }: {
  title: string
  description: string
  value: number
  options: readonly number[]
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return <div className={`setting-row setting-row-select ${disabled ? 'is-disabled' : ''}`}>
    <div className="setting-copy"><strong>{title}</strong><p>{description}</p></div>
    <select className="setting-select" aria-label={title} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))}>
      {options.map(option => <option key={option} value={option}>{option} {suffix}</option>)}
    </select>
  </div>
}

function ruleSummary(rules: RuleSet): string {
  return `Pair ${rules.pair ? 'on' : 'off'} · Seventh ${rules.seventhCard ? 'on' : 'off'} · Reverse ${rules.reverse ? 'on' : 'off'} · Double ${rules.double ? 'on' : 'off'} · Last trick ${rules.lastTrickBonus ? 'on' : 'off'}`
}

function MoveAnalysisPanel({ analysis, objectiveLabel }: { analysis: MoveEvaluation; objectiveLabel: string }) {
  if (!analysis.options.length) return <section className="move-analysis-panel"><p>{analysis.notes[0] || 'No move estimates are available.'}</p></section>
  return <section className="move-analysis-panel">
    <div className="analysis-panel-heading"><div><span className="eyebrow">HYBRID COACH</span><h3>Compare your legal moves</h3></div><span className="analysis-sample-pill">{analysis.samples} sampled deals</span></div>
    <p className="analysis-intro">Estimated chance your team succeeds at {objectiveLabel}. The same plausible deals were used for every option, and the live tip adopts this result when the edge is clear.</p>
    <div className="move-estimate-list">{analysis.options.map((option, index) => <article key={option.cardId} className={`move-estimate-row ${index === 0 ? 'move-estimate-best' : ''}`}>
      <span className="move-estimate-card"><SuitText text={option.cardLabel} /></span>
      <div className="move-estimate-detail"><div className="move-estimate-top"><strong>{index === 0 ? 'Model top' : `Option ${index + 1}`}</strong><span>{Math.round(option.teamGoalRate * 100)}%</span></div><div className="move-estimate-track"><i style={{ width: `${Math.round(option.teamGoalRate * 100)}%` }} /></div><small>Expected point margin: {option.expectedPointMargin > 0 ? '+' : ''}{option.expectedPointMargin.toFixed(1)} · ±{Math.round(option.standardError * 196)} pp sampling error</small></div>
      {index === 0 && <span className="analysis-best-tag">TOP MODEL</span>}
    </article>)}</div>
    <div className="analysis-footnotes">{analysis.notes.map(note => <p key={note}>{note}</p>)}</div>
  </section>
}

function DeepReviewPanel({ result, objectiveLabel, onSelectTrick }: { result: DeepReviewResult; objectiveLabel: string; onSelectTrick: (index: number) => void }) {
  return <section className="deep-review-panel">
    <div className="analysis-panel-heading"><div><span className="eyebrow">FULL-HAND ANALYSIS</span><h3>Alternative-move review</h3></div><span className="analysis-sample-pill">{result.samplesPerDecision} deals / move</span></div>
    <p className="analysis-intro">{result.summary} The percentages are estimates from simulated continuations, not guarantees.</p>
    <div className="deep-review-list">{result.decisions.map((item, index) => {
      const same = item.chosenCardId === item.recommendedCardId
      const gain = Math.round(item.goalRateGain * 100)
      return <article key={`${item.trickNumber}-${index}`} className={`deep-review-item ${!same && gain >= 8 ? 'deep-review-actionable' : ''}`}>
        <div className="deep-review-item-top"><span className="feedback-kicker">TRICK {item.trickNumber}</span><span className={`deep-confidence confidence-${item.confidence}`}>{same ? 'Top-ranked move' : item.confidence === 'strong' ? 'Strong signal' : item.confidence === 'suggestive' ? 'Worth reviewing' : 'Close decision'}</span></div>
        <strong><SuitText text={same ? `You played ${item.chosenCardLabel} — top-ranked` : `You played ${item.chosenCardLabel}; model prefers ${item.recommendedCardLabel}`} /></strong>
        <p>Estimated chance of {objectiveLabel}: {Math.round(item.chosenGoalRate * 100)}% → {Math.round(item.recommendedGoalRate * 100)}%{gain > 0 ? ` (+${gain} percentage points)` : gain < 0 ? ` (${gain} percentage points)` : ''}. Expected point-margin change: {item.pointMarginGain > 0 ? '+' : ''}{item.pointMarginGain.toFixed(1)}.</p>
        <button className="inline-link" onClick={() => onSelectTrick(item.trickNumber - 1)}>Inspect trick <ArrowUpRight size={12} /></button>
      </article>
    })}</div>
    <p className="analysis-caveat">The evaluator uses your hand and public play history, estimates hidden trump when needed, and rolls out the rest of each deal with the current bot policy. With four or fewer tricks left, each sampled deal is solved exactly instead of rolled out. The model can still be wrong; use it as a study aid.</p>
  </section>
}

function ReviewScreen({ game, onNext, onNewMatch, onSelectTrick, selectedTrick, onDeepAnalyze, deepReview, analysisLoading, analysisError, coachEnabled }: {
  game: GameState
  onNext: () => void
  onNewMatch: () => void
  onSelectTrick: (index: number) => void
  selectedTrick: number
  onDeepAnalyze: () => void
  deepReview: DeepReviewResult | null
  analysisLoading: boolean
  analysisError: string | null
  coachEnabled: boolean
}) {
  const review = game.review
  const insights = useMemo(() => handInsights(game), [game])
  if (!review) return null
  const ourContract = review.contractTeam === 0
  const winnerIsOurs = review.matchWinner === 0
  const selected = game.tricks[selectedTrick]
  const notes = review.notes
  const userMoves = game.decisions.length
  const pointSwing = review.teamPoints[0] - review.teamPoints[1]
  const contractDeltaGood = review.contractTeam === 0 ? review.scoreDelta >= 0 : review.scoreDelta <= 0
  const contractDeltaLabel = review.contractTeam === 0 ? 'your side' : 'the bidding side'
  const goodForUs = ourContract ? review.success : !review.success
  const headline = review.matchWinner !== null
    ? (winnerIsOurs ? 'Match won. Excellent work.' : 'Match lost. Take the lessons forward.')
    : ourContract
      ? (review.success ? 'Contract made.' : 'Contract missed.')
      : (review.success ? 'Opponents made it.' : 'Defence held.')
  const bidReview = review.bidReview
  const noteMeta = (level: 'opportunity' | 'efficiency' | 'good') => level === 'opportunity'
    ? { icon: <Target size={16} aria-hidden="true" />, label: 'Cost points' }
    : level === 'efficiency'
      ? { icon: <Lightbulb size={16} aria-hidden="true" />, label: 'Efficiency' }
      : { icon: <Check size={16} aria-hidden="true" />, label: 'Good decision' }
  return <div className="review-screen">
    <div className="review-topline"><div><h2>{headline}</h2><p className="review-meta">Hand {String(game.handNumber).padStart(2, '0')} · post-hand review</p><p className="review-subtitle">Review the decisions, not just the result. Hidden cards can create unlucky outcomes without making a move wrong.</p></div><div className="review-top-right"><div className={`result-stamp ${goodForUs ? 'result-good' : 'result-bad'}`}><span>{goodForUs ? <Check size={16} /> : <ArrowDownRight size={16} />}</span>{ourContract ? (review.success ? 'CONTRACT MADE' : 'CONTRACT MISSED') : (review.success ? 'OPPONENTS MADE IT' : 'DEFENCE HELD')}{review.stake > 1 && <b className="stake-chip">{review.stake}×</b>}</div>{review.matchWinner === null && <button className="button-primary" onClick={onNext}>Deal next hand <ArrowUpRight size={16} aria-hidden="true" /></button>}</div></div>
    <div className="review-stat-grid">
      <div className="review-stat"><span>Winning bid</span><strong>{review.bid}</strong><small><SuitText text={`${PLAYER_NAMES[review.bidder]} · ${review.reverse ? 'No trump · Reverse' : review.trumpSuit ? `${SUIT_SYMBOL[review.trumpSuit]} ${SUIT_LABEL[review.trumpSuit]}` : 'Hidden trump'}`} /></small></div>
      <div className="review-stat"><span>Contract target</span><strong>{review.target}</strong><small>{review.pair ? `Royal pair by ${PLAYER_NAMES[review.pair.player]}` : 'Bid unchanged'}{review.stake > 1 ? ` · ${review.stake} match points` : ''}</small></div>
      <div className="review-stat"><span>Your team</span><strong>{review.teamPoints[0]} <small>/ 28{review.lastTrickBonus ? '+1' : ''}</small></strong><small>{review.cardPoints[0]} card points{review.lastTrickBonus ? ' + last trick bonus' : ''}</small></div>
      <div className="review-stat"><span>Opponents</span><strong>{review.teamPoints[1]}</strong><small>{review.cardPoints[1]} card points</small></div>
    </div>
    <div className="review-modifiers">
      <span className={contractDeltaGood ? 'positive' : 'negative'}>{review.scoreDelta > 0 ? '+' : ''}{review.scoreDelta} match point{Math.abs(review.scoreDelta) === 1 ? '' : 's'} to {contractDeltaLabel}</span>
      <span className={pointSwing >= 0 ? 'positive' : 'negative'}>Point difference {pointSwing > 0 ? '+' : ''}{pointSwing}</span>
      {review.pair && <span>Pair: target {review.pair.effect === 'reduce' ? '−4' : '+4'}</span>}
      {review.stake > 1 && <span>Stake: {review.stake}×</span>}
    </div>
    <div className="review-main-grid">
      <section className="review-panel coach-review-panel">
        <div className="panel-heading review-coach-heading"><div className="panel-icon gold-icon"><Brain size={19} /></div><div><h3>{coachEnabled ? "Coach's review" : 'Hand review'}</h3><p>{coachEnabled ? 'Bid check, visible-card rules, and sampled-deal analysis' : 'Bid check and visible-card notes'}</p></div>{coachEnabled && <button className="button-secondary deep-analyze-button" onClick={onDeepAnalyze} disabled={analysisLoading || game.decisions.length === 0} aria-live="polite">{analysisLoading ? <><Activity size={15} className="analysis-spin" /> Analyzing…</> : <><Target size={15} /> {deepReview ? 'Run again' : 'Deep analysis'}</>}</button>}</div>
        {bidReview && <article className={`bid-review bid-review-${bidReview.verdict}`}>
          <div className="bid-review-icon">{bidReview.verdict === 'good' ? <Check size={18} aria-hidden="true" /> : <Flag size={18} aria-hidden="true" />}</div>
          <div>
            <h4>{bidReview.title}</h4>
            <p>{bidReview.detail}</p>
            <div className="bid-review-meta"><span>Hand projects <b>{bidReview.advised}</b></span><span>Your call <b>{bidReview.actual === null ? 'Pass' : bidReview.actual}</b></span></div>
          </div>
        </article>}
        {notes.length ? <div className="feedback-list">{notes.map((note, index) => {
          const meta = noteMeta(note.level)
          return <article key={`${note.trickNumber}-${index}`} className={`feedback-item feedback-${note.level}`}>
            <div className="feedback-icon">{meta.icon}</div>
            <div><div className="feedback-title-row"><span className="feedback-kicker">TRICK {note.trickNumber}</span><span className="feedback-tag">{meta.label}</span></div><h4>{note.title}</h4><p>{note.detail}</p>{note.betterCard && <button className="inline-link" onClick={() => onSelectTrick(note.trickNumber - 1)}>Review trick <ArrowUpRight size={14} aria-hidden="true" /></button>}</div>
          </article>
        })}</div> : <div className="no-mistakes"><div className="success-orbit"><ShieldCheck size={24} /></div><h4>No clear tactical error detected</h4><p>The review checks your bids and the plays where the visible cards made a reliable comparison. Early plays involve hidden information, so the game will not label a reasonable move a mistake just because an opponent later had the perfect card.</p></div>}
        {coachEnabled && analysisError && <p className="analysis-error" role="alert">{analysisError}</p>}
        {insights.bullets.length > 0 && <section className="review-insights">
          <h4>What the hand showed</h4>
          <ul>{insights.bullets.map((bullet, index) => <li key={index} dangerouslySetInnerHTML={{ __html: colorizeSuitSymbols(bullet) }} />)}</ul>
        </section>}
        <div className="lesson-callout"><Sparkles size={18} aria-hidden="true" /><div><strong>Key lesson</strong><p><SuitText text={insights.lesson} /></p></div></div>
        {ourContract && <div className="contract-note"><Flag size={15} aria-hidden="true" /><span>Your side made the bid. Contract outcome is based on points captured by the bidding team.</span></div>}
      </section>
      <section className="review-panel trick-review-panel">
        <div className="panel-heading"><div className="panel-icon green-icon"><Swords size={19} /></div><div><h3>Trick timeline</h3><p>Select any trick to inspect every card</p></div></div>
        <div className="trick-timeline">{game.tricks.map((trick, index) => <button key={trick.number} className={`trick-chip ${index === selectedTrick ? 'selected' : ''}`} onClick={() => onSelectTrick(index)} aria-pressed={index === selectedTrick} aria-label={`Trick ${trick.number}, won by ${PLAYER_NAMES[trick.winner]}, ${trick.points} points`}>
          <span className="trick-chip-num">{String(trick.number).padStart(2, '0')}</span><span className="trick-chip-winner">{PLAYER_NAMES[trick.winner]}</span><strong>{trick.points}<small> pts</small></strong><span className="trick-chip-mark">{trick.winner % 2 === 0 ? 'OUR TEAM' : 'THEM'}</span>
        </button>)}</div>
        {selected && <div className="selected-trick-detail"><div className="selected-trick-head"><div><span className="detail-label">TRICK {selected.number}</span><h4>{PLAYER_NAMES[selected.winner]} won · {selected.points} point{selected.points === 1 ? '' : 's'}</h4></div><span className="trick-won-badge">{selected.winner % 2 === 0 ? 'Your team' : 'Opponents'}</span></div>
          <div className="review-plays">{selected.plays.map((play, i) => <div key={`${selected.number}-${play.player}`} className="review-play"><span className="review-play-player">{PLAYER_NAMES[play.player]}</span><CardFace card={play.card} compact /><span className="review-play-order">{i === 0 ? 'LEAD' : i === 3 ? 'LAST' : `PLAY ${i + 1}`}</span></div>)}</div>
          <p className="trick-explainer">{review.trumpSuit && selected.plays.some(p => p.card.suit === review.trumpSuit) && game.tricks.find(t => t.number === selected.number) ? `Trump was ${SUIT_LABEL[review.trumpSuit]}. ` : ''}{PLAYER_NAMES[selected.winner]} took the trick. Card points in this trick: {selected.cardPoints}{selected.bonus ? `, plus ${selected.bonus} last-trick bonus` : ''}.</p>
        </div>}
      </section>
    </div>
    {coachEnabled && deepReview && <DeepReviewPanel result={deepReview} objectiveLabel={review.contractTeam === 0 ? 'making the contract' : 'defeating the contract'} onSelectTrick={onSelectTrick} />}
    <div className="review-footer"><div className="review-footer-copy"><Check size={16} aria-hidden="true" /><span>Hand review · {userMoves} of your decisions recorded</span></div><div className="review-actions"><button className="button-secondary" onClick={onNewMatch}><RotateCcw size={16} /> New match</button>{review.matchWinner === null && <button className="button-primary" onClick={onNext}>Deal next hand <ArrowUpRight size={16} /></button>}</div></div>
  </div>
}

type EvaluatorResponse =
  | { requestId: number; kind: 'moves'; version: number; result: MoveEvaluation }
  | { requestId: number; kind: 'review'; version: number; result: DeepReviewResult }
  | { requestId: number; kind: 'error'; version: number; error: string }

type PendingEvaluation = { id: number; kind: 'moves' | 'review'; version: number }

type TableAnnouncement =
  | { kind: 'trump'; suit: Suit }
  | { kind: 'reverse'; suit: Suit | null }
  | { kind: 'pair'; player: number; effect: 'reduce' | 'raise'; target: number }

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(getPreferences)
  const [game, setGame] = useState<GameState>(() => newHand(3, 1, [0, 0], preferences, 1))
  const [stats, setStats] = useState<SessionStats>(getStats)
  const [showGuide, setShowGuide] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedTrick, setSelectedTrick] = useState(0)
  const [bidChoice, setBidChoice] = useState(16)
  const processedHand = useRef<number | null>(null)
  const analyzedHand = useRef<number | null>(null)
  const autoAnalysisKey = useRef('')
  const evaluatorWorker = useRef<Worker | null>(null)
  const nextEvaluationId = useRef(0)
  const pendingEvaluation = useRef<PendingEvaluation | null>(null)
  const currentGameVersion = useRef(game.version)
  currentGameVersion.current = game.version
  const [moveAnalysis, setMoveAnalysis] = useState<{ version: number; result: MoveEvaluation } | null>(null)
  const [deepReview, setDeepReview] = useState<DeepReviewResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState<'moves' | 'review' | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [tipHistory, setTipHistory] = useState<CoachInsight[]>([])
  const [tipIndex, setTipIndex] = useState(-1)
  const lastTipKey = useRef('')
  const lastPlayKey = useRef('')
  const [announcement, setAnnouncement] = useState<TableAnnouncement | null>(null)
  const previousReveal = useRef(game.trumpRevealed)
  const previousPair = useRef<string | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('./ai/evaluator.worker.ts', import.meta.url), { type: 'module' })
    evaluatorWorker.current = worker
    worker.onmessage = (event: MessageEvent<EvaluatorResponse>) => {
      const response = event.data
      const pending = pendingEvaluation.current
      if (!pending || pending.id !== response.requestId) return
      pendingEvaluation.current = null
      setAnalysisLoading(null)
      if (pending.version !== currentGameVersion.current) return
      if (response.kind === 'error') {
        setAnalysisError(response.error)
        return
      }
      if (pending.kind === 'moves' && response.kind === 'moves') {
        setMoveAnalysis({ version: pending.version, result: response.result })
      } else if (pending.kind === 'review' && response.kind === 'review') {
        setDeepReview(response.result)
      }
    }
    worker.onerror = () => {
      setAnalysisError('The strategy evaluator stopped unexpectedly. Try again after the next move.')
      setAnalysisLoading(null)
      pendingEvaluation.current = null
    }
    return () => {
      worker.terminate()
      evaluatorWorker.current = null
    }
  }, [])

  useEffect(() => { try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)) } catch { /* Keep practice playable when storage is unavailable. */ } }, [stats])
  useEffect(() => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)) } catch { /* Preferences fall back to defaults. */ } }, [preferences])

  useEffect(() => {
    if (game.phase === 'review' && game.review && processedHand.current !== game.handId) {
      processedHand.current = game.handId
      setStats(previous => ({
        handsPlayed: previous.handsPlayed + 1,
        contractsMade: previous.contractsMade + (game.review!.contractTeam === 0 && game.review!.success ? 1 : 0),
        contractsAttempted: previous.contractsAttempted + (game.review!.contractTeam === 0 ? 1 : 0),
        clearMistakes: previous.clearMistakes + game.review!.notes.length,
      }))
      setSelectedTrick(0)
    }
  }, [game.phase, game.review, game.handId])

  useEffect(() => {
    let timer: number | undefined
    if (game.phase === 'auction' && !game.auctionComplete && game.currentPlayer !== 0) {
      const player = game.currentPlayer
      const decision = botBid(game, player)
      const version = game.version
      timer = window.setTimeout(() => setGame(current => current.version === version ? applyBid(current, player, decision) : current), 460 + Math.random() * 300)
    } else if (game.phase === 'trump' && game.bidder !== null && game.bidder !== 0) {
      const player = game.bidder
      const suit = chooseBotTrump(game.hands[player])
      const version = game.version
      timer = window.setTimeout(() => setGame(current => current.version === version ? chooseTrump(current, player, suit) : current), 550)
    } else if (game.phase === 'stake' && game.stakeStage && game.bidder !== null) {
      const contractTeam = teamOf(game.bidder)
      const humanActs = game.stakeStage === 'defend' ? teamOf(0) !== contractTeam : teamOf(0) === contractTeam
      if (!humanActs) {
        const version = game.version
        const stage = game.stakeStage
        const actor = stage === 'defend' ? 1 : game.bidder
        const decision = stage === 'defend' ? botDoubleDecision(game, actor) : botRedoubleDecision(game, actor)
        timer = window.setTimeout(() => setGame(current => current.version === version ? resolveStake(current, decision) : current), 720)
      }
    } else if (game.phase === 'play' && !game.pausedTrick && game.currentPlayer !== 0) {
      const player = game.currentPlayer
      const version = game.version
      // Search inside the timer so StrictMode's development double-effect does not run the
      // evaluator twice, and so the table stays responsive while the bot is "thinking".
      timer = window.setTimeout(() => {
        const card = preferences.searchBots
          ? chooseBotCardWithSearch(game, player, { samples: preferences.botSamples })
          : chooseBotCard(game, player)
        setGame(current => current.version === version ? playCard(current, player, card.id) : current)
      }, 520 + Math.random() * 280)
    }
    return () => { if (timer !== undefined) window.clearTimeout(timer) }
  }, [game])

  useEffect(() => {
    if (preferences.coach && game.phase === 'review' && game.review && game.decisions.length > 0 && analyzedHand.current !== game.handId) {
      analyzedHand.current = game.handId
      requestDeepReview()
    }
  }, [game.phase, game.handId, game.review, preferences.coach])


  const sortedHand = useMemo(() => sortHand(game.hands[0] || []), [game.hands])
  const maxBid = maxBidFor(game.rules)
  const target = contractTarget(game)
  const minBid = game.highBid === null ? 16 : game.highBid + 1
  const userCanBid = game.phase === 'auction' && !game.auctionComplete && game.currentPlayer === 0
  const userCanPlay = game.phase === 'play' && game.currentPlayer === 0 && !game.pausedTrick
  const userStakeTurn = game.phase === 'stake' && game.stakeStage !== null && game.bidder !== null && (
    game.stakeStage === 'defend' ? teamOf(0) !== teamOf(game.bidder) : teamOf(0) === teamOf(game.bidder)
  )
  const currentLegal = useMemo(() => userCanPlay ? legalCardsFor(game, 0).map(card => card.id) : [], [game, userCanPlay])
  // Start the sampled comparison automatically on the human's turn so the live tip can
  // become a hybrid verdict without waiting for a button press.
  useEffect(() => {
    if (!preferences.coach || !userCanPlay || !evaluatorWorker.current) return
    const key = `${game.handId}:${game.version}:${preferences.compareSamples}`
    if (autoAnalysisKey.current === key) return
    autoAnalysisKey.current = key
    requestMoveAnalysis()
  }, [preferences.coach, preferences.compareSamples, userCanPlay, game.handId, game.version])
  const currentTrickPoints = game.currentTrick.reduce((sum, item) => sum + item.card.points, 0)
  const trumpVisible = !!game.trumpSuit && (game.phase === 'review' || game.trumpRevealed || game.bidder === 0)
  const reverseVisible = game.reverse && (game.trumpRevealed || game.bidder === 0)
  const pointTotals = useMemo(() => {
    const totals: [number, number] = [0, 0]
    for (const trick of game.tricks) totals[teamOf(trick.winner)] += trick.points
    return totals
  }, [game.tricks])
  const contractTeam = game.bidder === null ? null : teamOf(game.bidder)
  const contractPoints = contractTeam === null ? 0 : pointTotals[contractTeam]
  const targetPct = target > 0 ? Math.min(100, (contractPoints / target) * 100) : 0
  const insight = useMemo(() => coachInsight(game), [game])
  const reading = useMemo(() => tableReading(game), [game])
  const coachObjective = useMemo(() => {
    const tricksLeft = Math.max(0, 8 - game.tricks.length)
    if (game.phase === 'auction') {
      if (game.auctionComplete && game.bidder !== null) return `Auction won by ${PLAYER_NAMES[game.bidder]} at ${game.highBid}`
      if (game.highBid === null) return 'Auction · open at 16 or pass'
      return game.highBid >= maxBid
        ? `Auction · maximum bid ${maxBid}`
        : `Auction · high bid ${game.highBid} · next bid ${game.highBid + 1}`
    }
    if (game.phase === 'trump') return `Contract target ${target} · choose trump`
    if (game.phase === 'stake') return `Stake · hand worth ${game.stake} match point${game.stake === 1 ? '' : 's'}`
    if (game.phase === 'play' && game.bidder !== null) {
      const contractTeam = teamOf(game.bidder)
      const have = pointTotals[contractTeam]
      const trickLabel = `${tricksLeft} trick${tricksLeft === 1 ? '' : 's'} left`
      return contractTeam === 0
        ? `Make ${target} · ${have}/${target} · ${trickLabel}`
        : `Defend ${target} · they have ${have}/${target} · ${trickLabel}`
    }
    return undefined
  }, [game.phase, game.auctionComplete, game.bidder, game.highBid, game.stake, game.tricks.length, maxBid, target, pointTotals])
  const hybrid = useMemo<{ insight: CoachInsight; note?: string }>(() => {
    const rule = insight
    if (!preferences.coach || !userCanPlay || !moveAnalysis || moveAnalysis.version !== game.version) {
      return { insight: rule }
    }
    const result = moveAnalysis.result
    const best = result.options[0]
    if (!best) return { insight: rule }
    const ruleOption = rule.recommendedCardId
      ? result.options.find(option => option.cardId === rule.recommendedCardId)
      : undefined
    const samples = result.samples
    const error = Math.round(best.standardError * 196)
    const percent = (rate: number) => Math.round(rate * 100)
    const note = `Sampled model: ${best.cardLabel} at ${percent(best.teamGoalRate)}%${ruleOption && ruleOption.cardId !== best.cardId ? ` vs ${ruleOption.cardLabel} at ${percent(ruleOption.teamGoalRate)}%` : ''} over ${samples} deals (±${error} pp).`
    if (!ruleOption) return { insight: rule, note }
    if (best.cardId === ruleOption.cardId) {
      return {
        insight: {
          ...rule,
          source: 'hybrid',
          bullets: [...rule.bullets, `The sampled model agrees: ${best.cardLabel} is also the top-rated play (${percent(best.teamGoalRate)}% over ${samples} deals).`],
        },
        note,
      }
    }
    const goalEdge = best.teamGoalRate - ruleOption.teamGoalRate
    if (Math.abs(goalEdge) < 0.005) {
      return {
        insight: {
          ...rule,
          source: 'hybrid',
          bullets: [...rule.bullets, `The sampled model sees no meaningful difference between ${best.cardLabel} and ${ruleOption.cardLabel} (${percent(best.teamGoalRate)}% each over ${samples} deals).`],
        },
        note,
      }
    }
    const utilityEdge = best.expectedUtility - ruleOption.expectedUtility
    const requiredEdge = rule.confidence === 'certain' ? 0.1 : 0.08
    const clear = goalEdge >= requiredEdge || (goalEdge > 0 && utilityEdge >= 0.12)
    if (!clear) {
      return {
        insight: {
          ...rule,
          source: 'hybrid',
          bullets: [...rule.bullets, `The sampled model is close: ${best.cardLabel} ${percent(best.teamGoalRate)}% vs ${ruleOption.cardLabel} ${percent(ruleOption.teamGoalRate)}%. The visible rule is a fair tie-break.`],
        },
        note,
      }
    }
    const edge = Math.max(1, Math.round(goalEdge * 100))
    return {
      insight: {
        ...rule,
        source: 'hybrid',
        confidence: 'estimate',
        tone: best.teamGoalRate >= 0.5 ? 'good' : 'neutral',
        title: `${best.cardLabel} is the stronger percentage play`,
        summary: `The rule coach preferred ${ruleOption.cardLabel}. Over ${samples} plausible deals, the model gives ${best.cardLabel} a ${percent(best.teamGoalRate)}% chance of your team’s objective versus ${percent(ruleOption.teamGoalRate)}% — a ${edge}-point edge.`,
        plan: `Take the percentage play: ${best.cardLabel}. The model is planning the rest of the hand, not only this trick.`,
        bullets: [
          `Rule view: ${ruleOption.cardLabel} — ${rule.title}.`,
          `Sampled view: ${best.cardLabel} ${percent(best.teamGoalRate)}% vs ${ruleOption.cardLabel} ${percent(ruleOption.teamGoalRate)}% over ${samples} deals (±${error} pp).`,
          ...(rule.confidence === 'certain' ? ['The rule card still does what it says; the model is choosing a different plan for the remaining tricks.'] : []),
        ],
        action: `Play ${best.cardLabel}`,
        recommendedCardId: best.cardId,
      },
      note,
    }
  }, [preferences.coach, userCanPlay, moveAnalysis, game.version, insight])
  const modelNote = useMemo(() => {
    if (!preferences.coach || !userCanPlay) return undefined
    if (analysisLoading === 'moves') return `Sampling ${preferences.compareSamples} plausible deals for every legal card…`
    return hybrid.note
  }, [preferences.coach, preferences.compareSamples, userCanPlay, analysisLoading, hybrid])
  const lastPlay = useMemo(() => lastPlayInsight(game), [game])
  const liveInsight = useMemo(() => {
    if (game.phase === 'play' && !game.pausedTrick) {
      return game.currentPlayer === 0 ? hybrid.insight : observationInsight(game)
    }
    if (game.phase === 'auction' && (game.auctionComplete || game.currentPlayer !== 0)) return observationInsight(game)
    if (game.phase === 'trump' && game.bidder !== 0) return observationInsight(game)
    if (game.phase === 'stake' && !userStakeTurn) return observationInsight(game)
    return hybrid.insight
  }, [game, hybrid, userStakeTurn])
  const myTurn = userCanBid || (game.phase === 'trump' && game.bidder === 0) || userCanPlay || userStakeTurn
  const advisedBid = useMemo(() => {
    const report = openingReport(game.hands[0] ?? [])
    return Math.min(maxBid, Math.max(16, report.advised))
  }, [game.hands, maxBid])
  const coachAdvisesPass = preferences.coach && userCanBid && insight.action === 'Pass'
  useEffect(() => {
    if (userCanBid) setBidChoice(Math.min(maxBid, Math.max(minBid, advisedBid)))
  }, [advisedBid, maxBid, minBid, userCanBid])

  // Reset the history before the advice effect can append the new hand's first tip.
  useEffect(() => {
    lastTipKey.current = ''
    lastPlayKey.current = ''
    setTipHistory([])
    setTipIndex(-1)
    setAnnouncement(null)
  }, [game.handId])
  // Keep one entry per distinct piece of advice so the arrow keys can revisit earlier tips.
  useEffect(() => {
    if (!preferences.coach) return
    const key = insightKey(liveInsight)
    if (key === lastTipKey.current) return
    lastTipKey.current = key
    setTipHistory(history => [...history, liveInsight].slice(-40))
  }, [liveInsight, preferences.coach])
  // Keep each last-play explanation in the history as well, so the arrow keys can
  // revisit how an opponent or partner was reading the table.
  useEffect(() => {
    if (!preferences.coach || !lastPlay) return
    const key = insightKey(lastPlay)
    if (key === lastPlayKey.current) return
    lastPlayKey.current = key
    setTipHistory(history => [...history, lastPlay].slice(-40))
  }, [lastPlay, preferences.coach])
  // Show the live insight immediately; the history effect catches up after the render.
  const coachTips = useMemo(() => {
    const last = tipHistory[tipHistory.length - 1]
    const same = last && insightKey(last) === insightKey(liveInsight)
    return same ? tipHistory : [...tipHistory, liveInsight].slice(-40)
  }, [tipHistory, liveInsight])
  useEffect(() => {
    if (previousReveal.current === game.trumpRevealed) return
    previousReveal.current = game.trumpRevealed
    if (!game.trumpRevealed) return
    if (game.reverse) {
      setAnnouncement({ kind: 'reverse', suit: game.indicatorSuit })
      const timer = window.setTimeout(() => setAnnouncement(current => current?.kind === 'reverse' ? null : current), 2400)
      return () => window.clearTimeout(timer)
    }
    if (!game.trumpSuit) return
    setAnnouncement({ kind: 'trump', suit: game.trumpSuit })
    const timer = window.setTimeout(() => setAnnouncement(current => current?.kind === 'trump' ? null : current), 2400)
    return () => window.clearTimeout(timer)
  }, [game.trumpRevealed, game.trumpSuit, game.reverse, game.indicatorSuit])
  useEffect(() => {
    const key = game.pair ? `${game.pair.trickNumber}-${game.pair.player}-${game.pair.effect}` : null
    if (key === previousPair.current) return
    previousPair.current = key
    if (!game.pair) return
    setAnnouncement({ kind: 'pair', player: game.pair.player, effect: game.pair.effect, target: contractTarget(game) })
    const timer = window.setTimeout(() => setAnnouncement(current => current?.kind === 'pair' ? null : current), 2400)
    return () => window.clearTimeout(timer)
  }, [game.pair, game.highBid, game.rules, game.bidder])

  const stateLabel = game.phase === 'review' ? 'Reviewing' : game.auctionComplete ? 'Auction complete' : game.pausedTrick ? 'Trick complete' : game.phase === 'stake' ? (userStakeTurn ? 'Your call' : 'Bots deciding') : myTurn ? 'Your move' : 'Bots thinking'
  const displayTrick = game.pausedTrick?.plays ?? game.currentTrick
  const displayTrickPoints = displayTrick.reduce((sum, play) => sum + play.card.points, 0)
  const displayWinner = game.pausedTrick?.winner
  const pairJustDeclared = game.pair && game.pausedTrick && game.pair.trickNumber === game.pausedTrick.number ? game.pair : null

  function nextHand() {
    pendingEvaluation.current = null
    setAnalysisLoading(null)
    setAnalysisError(null)
    setMoveAnalysis(null)
    setDeepReview(null)
    setGame(current => newHand((current.dealer + 1) % 4, current.handNumber + 1, current.matchScore, preferences, current.handId + 1, 'New hand. Start by judging your first four cards.'))
  }
  function newMatch() {
    processedHand.current = null
    analyzedHand.current = null
    pendingEvaluation.current = null
    setAnalysisLoading(null)
    setAnalysisError(null)
    setMoveAnalysis(null)
    setDeepReview(null)
    setGame(current => newHand(3, 1, [0, 0], preferences, current.handId + 1, 'Fresh match. Take your time and plan each bid.'))
  }
  function humanBid(bid: number | null) {
    setGame(current => applyBid(current, 0, bid))
    setBidChoice(Math.min(maxBid, (game.highBid ?? 15) + 2))
  }
  function chooseUserTrump(suit: Suit) { setGame(current => chooseTrump(current, 0, suit)) }
  function chooseUserSeventh() { setGame(current => chooseSeventhCard(current, 0)) }
  function chooseUserReverse() { setGame(current => chooseReverse(current, 0)) }
  function continueAuction() { setGame(current => continueAfterAuction(current)) }
  function continueTrick() { setGame(current => continueAfterTrick(current)) }
  function humanStake(double: boolean) { setGame(current => resolveStake(current, double)) }
  function declareUserPair() { setGame(current => declarePair(current, 0)) }
  function chooseUserCard(card: Card) { if (userCanPlay && currentLegal.includes(card.id)) setGame(current => playCard(current, 0, card.id)) }
  function requestMoveAnalysis() {
    if (!preferences.coach || !evaluatorWorker.current || !userCanPlay) return
    const requestId = ++nextEvaluationId.current
    pendingEvaluation.current = { id: requestId, kind: 'moves', version: game.version }
    setAnalysisError(null)
    setMoveAnalysis(null)
    setAnalysisLoading('moves')
    // Strip private opponent hands and hidden trump before the snapshot enters the worker.
    const safeState = sanitizeStateForEvaluation(game, 0)
    evaluatorWorker.current.postMessage({ requestId, kind: 'moves', state: safeState, samples: preferences.compareSamples, seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  function requestDeepReview() {
    if (!preferences.coach || !evaluatorWorker.current || game.phase !== 'review' || !game.decisions.length) return
    const requestId = ++nextEvaluationId.current
    pendingEvaluation.current = { id: requestId, kind: 'review', version: game.version }
    setAnalysisError(null)
    setDeepReview(null)
    setAnalysisLoading('review')
    const safeDecisions = game.decisions.map(decision => ({ ...decision, trumpSuit: decision.knownTrumpSuit }))
    evaluatorWorker.current.postMessage({ requestId, kind: 'review', decisions: safeDecisions, samples: preferences.reviewSamples, seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  function askForHint() {
    if (!preferences.coach) return
    if (!moveAnalysis || moveAnalysis.version !== game.version) requestMoveAnalysis()
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const wide = window.matchMedia('(min-width: 1181px)').matches
    window.setTimeout(() => {
      const coachTarget = wide ? document.querySelector('.rail-panel-coach') : document.getElementById('coach-panel')
      coachTarget?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
    }, 90)
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to the table</a>
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><span>2</span><span>9</span><i>♠</i></div><div className="brand-text"><div>Twenty-Nine <span>TRAINER</span></div><small>Play smarter, one hand at a time</small></div></div>
      <div className="match-strip" role="group" aria-label="Match status">
        <div className="score-cluster">
          <div className={`team-score ${game.matchScore[0] > 0 ? 'is-ahead' : game.matchScore[0] < 0 ? 'is-behind' : ''}`}>
            <span className="team-token" aria-hidden="true">Y</span>
            <span className="team-copy"><span>You</span><strong>{game.matchScore[0] > 0 ? '+' : ''}{game.matchScore[0]}</strong></span>
          </div>
          <span className="score-sep" aria-hidden="true" />
          <div className={`team-score ${game.matchScore[1] > 0 ? 'is-ahead' : game.matchScore[1] < 0 ? 'is-behind' : ''}`}>
            <span className="team-token" aria-hidden="true">T</span>
            <span className="team-copy"><span>Them</span><strong>{game.matchScore[1] > 0 ? '+' : ''}{game.matchScore[1]}</strong></span>
          </div>
        </div>
        <div className="match-tile match-hand">
          <span className="tile-icon" aria-hidden="true"><Hand size={15} /></span>
          <span className="tile-copy"><span>Hand</span><strong>{String(game.handNumber).padStart(2, '0')}</strong></span>
        </div>
        <div className={`match-tile match-contract ${game.highBid === null ? 'is-empty' : ''} ${game.reverse && reverseVisible ? 'is-reverse' : ''}`}>
          <span className="contract-mini" aria-hidden="true">
            {game.highBid === null
              ? <span className="contract-mini-back">29</span>
              : game.reverse
                ? <>
                  <span className="contract-mini-rank">{reverseVisible ? '2' : '?'}</span>
                  <span className={`contract-mini-suit ${reverseVisible && game.indicatorSuit ? (isRedSuit(game.indicatorSuit) ? 'suit-red' : 'suit-light') : 'suit-muted'}`}>{reverseVisible && game.indicatorSuit ? SUIT_SYMBOL[game.indicatorSuit] : '?'}</span>
                </>
                : <>
                  <span className="contract-mini-rank">{game.highBid}</span>
                  <span className={`contract-mini-suit ${trumpVisible && game.trumpSuit ? (isRedSuit(game.trumpSuit) ? 'suit-red' : 'suit-light') : 'suit-muted'}`}>{trumpVisible && game.trumpSuit ? SUIT_SYMBOL[game.trumpSuit] : '?'}</span>
                </>}
          </span>
          <span className="tile-copy">
            <span>Contract</span>
            <strong>{game.highBid === null ? 'Open' : `Target ${target}`}</strong>
            <small>{game.highBid === null ? 'No bid yet' : game.reverse ? (reverseVisible ? 'Reverse · no trump' : 'Trump hidden') : game.stake > 1 ? `${game.stake}× stake${game.pair ? ' · pair' : ''}` : game.pair ? 'Royal pair' : `Bidder ${PLAYER_NAMES[game.bidder ?? 0]}`}</small>
          </span>
        </div>
        <div className="match-tile match-dealer">
          <span className="dealer-token" aria-hidden="true">D</span>
          <span className="tile-copy"><span>Dealer</span><strong>{PLAYER_NAMES[game.dealer]}</strong></span>
        </div>
        <div className={`match-state ${myTurn || game.pausedTrick || game.auctionComplete ? 'state-mine' : ''}`}><span className="state-dot" aria-hidden="true" />{stateLabel}</div>
      </div>
      <div className="topbar-actions">
        <button className={`top-action coach-switch ${preferences.coach ? 'is-on' : 'is-off'}`} onClick={() => setPreferences(current => ({ ...current, coach: !current.coach }))} aria-pressed={preferences.coach} aria-label={preferences.coach ? 'Turn coach off' : 'Turn coach on'} title={preferences.coach ? 'Coach on — click to turn off' : 'Coach off — click to turn on'}>
          <Brain size={18} aria-hidden="true" />
          <span className="coach-label">Coach</span>
          {preferences.coach && <span className="coach-dot" aria-hidden="true" />}
        </button>
        <button className="top-action" onClick={() => setShowGuide(true)} aria-label="How to play"><BookOpen size={17} aria-hidden="true" /><span>How to play</span></button>
        <button className="round-icon-button" onClick={() => setShowSettings(true)} aria-label="Practice settings"><Settings2 size={20} aria-hidden="true" /></button>
      </div>
    </header>

    <main className="app-layout" id="main">
      <section className="game-column">
        {game.phase === 'review' && game.review ? <ReviewScreen game={game} onNext={nextHand} onNewMatch={newMatch} selectedTrick={selectedTrick} onSelectTrick={setSelectedTrick} onDeepAnalyze={requestDeepReview} deepReview={deepReview} analysisLoading={analysisLoading === 'review'} analysisError={analysisError} coachEnabled={preferences.coach} /> : <>
          <div className="table-frame">
            <div className={`felt-table ${game.phase === 'auction' || game.phase === 'trump' ? 'is-bidding' : ''} ${announcement ? 'is-announcing' : ''}`}>
              <div className="felt-grain" />
              <div className="felt-orbit orbit-one" /><div className="felt-orbit orbit-two" />
              <div className="table-fact fact-tl"><span>Trick</span><strong>{game.pausedTrick?.number ?? Math.min(8, game.tricks.length + 1)}<em>/8</em></strong></div>
              <div className="table-fact fact-tr"><span>On table</span><strong>{displayTrickPoints}<em>{displayTrickPoints === 1 ? ' pt' : ' pts'}</em></strong></div>
              {(game.phase === 'play' || game.phase === 'stake') && [1, 2, 3].map(player => <PlayerSeat key={player} player={player} count={game.hands[player]?.length ?? 0} isCurrent={game.phase === 'play' && game.currentPlayer === player && !game.pausedTrick} dealer={game.dealer === player} bidder={game.bidder === player} />)}
              {announcement && <div className={`table-announce announce-${announcement.kind}`} key={announcement.kind === 'trump' ? `trump-${announcement.suit}` : announcement.kind === 'reverse' ? `reverse-${announcement.suit}` : `pair-${announcement.player}-${announcement.target}`} role="status" aria-live="polite">
                {announcement.kind === 'trump' ? <>
                  <div className={`announce-card ${isRedSuit(announcement.suit) ? 'announce-red' : 'announce-black'}`}><span>{SUIT_SYMBOL[announcement.suit]}</span></div>
                  <div className="announce-copy"><span>TRUMP REVEALED</span><strong>{SUIT_LABEL[announcement.suit]}</strong></div>
                </> : announcement.kind === 'reverse' ? <>
                  <div className="announce-card announce-reverse"><span>2</span><i aria-hidden="true">R</i></div>
                  <div className="announce-copy"><span>REVERSE REVEALED</span><strong>No trump · 7 is high</strong><small>J is now the lowest card</small></div>
                </> : <>
                  <div className="announce-card announce-crown"><Crown size={30} aria-hidden="true" /></div>
                  <div className="announce-copy"><span>ROYAL PAIR</span><strong>{announcement.effect === 'reduce' ? 'Target drops to' : 'Target rises to'} {announcement.target}</strong><small>{PLAYER_NAMES[announcement.player]} showed the K + Q of trump</small></div>
                </>}
              </div>}
              {game.phase === 'auction' || game.phase === 'trump' ? <div className="table-center is-bidding">
                <div className="center-logo" aria-hidden="true"><span>29</span><i>♠</i></div>
                <strong className="center-title">{game.auctionComplete ? 'Auction complete' : game.phase === 'auction' ? 'The auction' : 'Choose your edge'}</strong>
                <span className="center-subtitle">{game.auctionComplete ? `${PLAYER_NAMES[game.bidder ?? 0]} won at ${game.highBid} · continue below` : game.phase === 'auction' ? (game.highBid === null ? 'Opening bid · minimum 16' : `High bid ${game.highBid} · ${PLAYER_NAMES[game.bidder ?? 0]}`) : game.rules.reverse ? 'Choose a suit, the seventh card, or Reverse' : 'Trump stays hidden until the first void'}</span>
                {game.phase === 'auction' && <>
                  <div className="auction-seats">
                    {[0, 1, 2, 3].map(player => {
                      const action = game.auctionActions.filter(item => item.player === player).slice(-1)[0]
                      return <div key={player} className={`auction-seat ${game.currentPlayer === player ? 'auction-current' : ''} ${game.bidder === player ? 'auction-high' : ''}`}>
                        <span>{PLAYER_NAMES[player]}</span>
                        <strong>{action ? (action.bid === null ? 'Pass' : action.bid) : '—'}</strong>
                      </div>
                    })}
                  </div>
                  <div className="bid-ladder" aria-hidden="true">
                    {Array.from({ length: maxBid - 15 }, (_, index) => 16 + index).map(value => <span key={value} className={`bid-step ${game.highBid === value ? 'bid-step-current' : ''} ${game.highBid === null && value === 16 ? 'bid-step-min' : ''} ${game.highBid !== null && value < game.highBid ? 'bid-step-past' : ''}`}>{value}</span>)}
                  </div>
                </>}
                {game.phase === 'trump' && <div className="trump-pips" aria-hidden="true">{SUITS.map(suit => <span key={suit} className={`trump-pip ${isRedSuit(suit) ? 'suit-red' : 'suit-light'}`}>{SUIT_SYMBOL[suit]}</span>)}</div>}
                <div className="table-message" role="status" aria-live="polite"><SuitText text={game.message} /></div>
              </div> : <>
                <div className="table-center">
                  <div className="center-logo" aria-hidden="true"><span>29</span><i>♠</i></div>
                  {game.pausedTrick
                    ? <><strong className="center-title">Trick {game.pausedTrick.number} complete</strong><span className="center-subtitle">{PLAYER_NAMES[game.pausedTrick.winner]} won · {game.pausedTrick.points} point{game.pausedTrick.points === 1 ? '' : 's'}</span></>
                    : game.phase === 'stake'
                      ? <><strong className="center-title">Before the first trick</strong><span className="center-subtitle">Contract {game.highBid} · target {target}</span></>
                      : <><strong className="center-title">Trick {game.tricks.length + 1} <span>of 8</span></strong><span className="center-subtitle">{game.currentTrick.length === 0 ? 'Lead any suit' : `${SUIT_LABEL[game.currentTrick[0].card.suit]} led · ${currentTrickPoints} point${currentTrickPoints === 1 ? '' : 's'} on table`}</span></>}
                  {!game.pausedTrick && <div className="table-message" role="status" aria-live="polite"><SuitText text={game.message} /></div>}
                </div>
                {[0, 1, 2, 3].map(player => {
                  const played = displayTrick.find(play => play.player === player)
                  if (played) {
                    return <div key={player} className={`played-card played-${PLAYER_POSITIONS[player]} ${displayWinner === player ? 'played-winner' : ''}`}><CardFace card={played.card} compact /></div>
                  }
                  return <div key={player} className={`trick-slot trick-slot-${PLAYER_POSITIONS[player]}`} aria-hidden="true"><span>{player === 0 ? 'YOU' : PLAYER_NAMES[player].slice(0, 1)}</span></div>
                })}
              </>}
              <div className="felt-bottom">
                <ScoreBoard score={game.matchScore} />
                {game.bidder !== null && <div className={`felt-contract ${contractTeam !== 0 ? 'is-opponent' : ''}`}>
                  <span className="table-object-label">Contract {target}</span>
                  <div className="felt-contract-body"><div className="contract-meter-track"><i style={{ width: `${targetPct}%` }} /></div></div>
                  <span className="felt-contract-caption">{contractPoints} / {target} captured</span>
                </div>}
                <TrumpStash suit={game.trumpSuit} reverse={game.reverse} indicatorSuit={game.indicatorSuit} revealed={game.trumpRevealed} knownToYou={game.bidder === 0} />
              </div>
            </div>
          </div>

          {game.phase === 'auction' && game.auctionComplete && <div className="trick-result auction-result" role="status">
            <div className="trick-result-copy">
              <span className="trick-result-kicker">Auction complete</span>
              <strong>{PLAYER_NAMES[game.bidder ?? 0]} won at {game.highBid}</strong>
              <small>{game.bidder === 0 ? 'Continue to choose your contract.' : 'Continue to let the bidder choose the contract.'}</small>
            </div>
            <button className="button-primary" onClick={continueAuction}>Continue <ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>}

          {game.pausedTrick && <div className="trick-result" role="status">
            <div className="trick-result-copy">
              <span className="trick-result-kicker">Trick {game.pausedTrick.number} complete</span>
              <strong>{PLAYER_NAMES[game.pausedTrick.winner]} won · {game.pausedTrick.points} point{game.pausedTrick.points === 1 ? '' : 's'}</strong>
              <small>{pairJustDeclared ? `${PLAYER_NAMES[pairJustDeclared.player]} declared the royal pair — target ${target}.` : game.tricks.length === 8 ? 'Review the four cards, then open the hand review.' : 'Review the four cards before the next lead.'}</small>
            </div>
            {pairEligible(game, 0) && <button className="button-secondary pair-declare" onClick={declareUserPair} title={teamOf(0) === teamOf(game.bidder ?? 0) ? 'Lower your target by 4' : 'Raise the bidding team’s target by 4'}><Crown size={15} aria-hidden="true" /> Declare royal pair</button>}
            <button className="button-primary" onClick={continueTrick}>{game.tricks.length === 8 ? 'See review' : 'Continue'} <ArrowUpRight size={16} aria-hidden="true" /></button>
          </div>}

          {game.phase === 'trump' && game.bidder === 0 && <TrumpChooser onChoose={chooseUserTrump} onSeventh={chooseUserSeventh} onReverse={chooseUserReverse} seventhEnabled={game.rules.seventhCard} reverseEnabled={game.rules.reverse} />}

          {game.phase === 'stake' && <section className="stake-panel" aria-label="Stake decision">
            <div className="stake-copy">
              <span className="stake-kicker">{game.stakeStage === 'redouble' ? 'REDOUBLE' : 'DOUBLE'}</span>
              <h2>{game.stakeStage === 'redouble' ? 'Redouble to four?' : 'Double the stakes?'}</h2>
              <p>{game.stakeStage === 'redouble' ? 'The defenders doubled. Make the hand worth four match points — or leave it at two.' : 'Make the hand worth two match points. The contract target does not change.'}</p>
            </div>
            {userStakeTurn ? <div className="stake-actions">
              <button className="button-secondary" onClick={() => humanStake(false)}>{game.stakeStage === 'redouble' ? 'No redouble' : 'Play on'}</button>
              <button className="button-primary" onClick={() => humanStake(true)}>{game.stakeStage === 'redouble' ? 'Redouble' : 'Double'}</button>
            </div> : <div className="waiting-strip"><Clock3 size={16} aria-hidden="true" /><span>{game.stakeStage === 'defend' ? 'The defenders are deciding whether to double…' : 'The bidding side is deciding whether to redouble…'}</span><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
          </section>}

          <section className={`decision-dock ${myTurn ? 'dock-active' : ''}`} aria-label="Your decision">
            <div className="dock-head">
              <div className="dock-title"><Hand size={18} aria-hidden="true" /><h2>Your hand</h2><span className="dock-count">{sortedHand.length} cards</span></div>
              {preferences.coach && userCanPlay && <div className="dock-actions"><button className="button-quiet" onClick={askForHint}><Lightbulb size={15} aria-hidden="true" /> Hint</button><button className="button-secondary" onClick={requestMoveAnalysis} disabled={analysisLoading === 'moves'} aria-live="polite">{analysisLoading === 'moves' ? <><Activity size={14} className="analysis-spin" aria-hidden="true" /> Analyzing</> : <><Target size={14} aria-hidden="true" /> Compare</>}</button></div>}
            </div>
            {(game.pausedTrick || game.phase === 'auction' || game.phase === 'trump' || game.phase === 'stake') && <p className="dock-help">{game.pausedTrick ? 'The completed trick is above. Continue when you are ready.' : game.auctionComplete ? 'The auction is over. Continue above to choose the contract.' : game.phase === 'auction' ? 'Four cards. Bid or pass.' : game.phase === 'trump' ? 'Your opening four.' : 'The deal is complete; the stake is being decided.'}</p>}
            <div className={`hand-cards ${sortedHand.length === 0 ? 'hand-cards-empty' : ''}`}>
              {sortedHand.map(card => {
                const playable = userCanPlay && currentLegal.includes(card.id)
                const disabled = userCanPlay && !playable
                return <div key={card.id} className={`hand-card-wrap ${playable ? 'is-playable' : ''} ${disabled ? 'is-muted' : ''}`}><CardFace card={card} playable={playable} disabled={disabled} onClick={userCanPlay ? () => chooseUserCard(card) : undefined} label={`Play ${card.rank} of ${SUIT_LABEL[card.suit]}`} /></div>
              })}
              {sortedHand.length === 0 && <div className="empty-hand">Your cards have been played.</div>}
            </div>
            {game.seventhCard && game.bidder === 0 && <div className="seventh-note"><Sparkles size={16} aria-hidden="true" /><span>Seventh card set aside: <b><SuitText text={cardText(game.seventhCard)} /></b> - trump is <b>{SUIT_LABEL[game.seventhCard.suit]}</b>, hidden from the table until the first void.</span></div>}
            {userCanBid && <div className="action-bar">
              <div className="action-copy"><h3>Your bid</h3><p>{game.highBid === null ? 'Open at 16 or pass. Only bid if the hand can support it.' : `Beat the current bid of ${game.highBid}, or pass to leave the auction.`}</p>{preferences.coach && <span className="action-advice">Coach: <SuitText text={insight.action ?? 'Pass'} /></span>}</div>
              <div className="bid-controls">
                <label className="bid-select-wrap"><span>Bid</span><select value={Math.min(maxBid, Math.max(minBid, bidChoice))} onChange={e => setBidChoice(Number(e.target.value))} aria-label="Choose bid amount">{Array.from({ length: Math.max(0, maxBid - minBid + 1) }, (_, index) => minBid + index).map(value => <option key={value} value={value}>{value} points</option>)}</select></label>
                <button className={coachAdvisesPass ? 'button-primary pass-button' : 'button-secondary pass-button'} onClick={() => humanBid(null)}>Pass</button>
                <button className={coachAdvisesPass ? 'button-secondary' : 'button-primary'} disabled={minBid > maxBid} onClick={() => humanBid(Math.min(maxBid, Math.max(minBid, bidChoice)))}>Bid {Math.min(maxBid, Math.max(minBid, bidChoice))} <ArrowUpRight size={16} aria-hidden="true" /></button>
              </div>
            </div>}
            {game.phase === 'auction' && !userCanBid && !game.auctionComplete && <div className="waiting-strip"><Clock3 size={16} aria-hidden="true" /><span>{PLAYER_NAMES[game.currentPlayer]} is considering the hand. Watch how the bidding develops.</span><span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span></div>}
            {preferences.coach && <div className="dock-coach dock-coach-mobile" id="coach-panel" aria-label="Coach insight">
              <CoachFeed tips={coachTips} index={tipIndex} onIndex={setTipIndex} modelNote={modelNote} objective={coachObjective} lastPlay={lastPlay} />
            </div>}
          </section>
          {preferences.coach && analysisError && game.phase === 'play' && userCanPlay && <p className="analysis-error" role="alert">{analysisError}</p>}
          {preferences.coach && moveAnalysis && moveAnalysis.version === game.version && <MoveAnalysisPanel analysis={moveAnalysis.result} objectiveLabel={game.bidder !== null && game.bidder % 2 === 0 ? 'making the contract' : 'defeating the contract'} />}
        </>}
      </section>

      <aside className="right-rail">
        {preferences.coach && game.phase !== 'review' && <section className="rail-panel rail-panel-coach" aria-label="Coach insight">
          <div className="rail-head"><h2>Coach</h2><Brain size={16} aria-hidden="true" /></div>
          <CoachFeed tips={coachTips} index={tipIndex} onIndex={setTipIndex} modelNote={modelNote} objective={coachObjective} lastPlay={lastPlay} />
        </section>}

        {preferences.coach && <section className="rail-panel rail-panel-reading">
          <div className="rail-head"><h2>Card reading</h2><Eye size={16} aria-hidden="true" /></div>
          <ul className="coach-reading">{reading.map((line, index) => <li key={index} dangerouslySetInnerHTML={{ __html: colorizeSuitSymbols(line) }} />)}</ul>
          <p className="rail-footnote"><ShieldCheck size={14} aria-hidden="true" /> Visible information only</p>
        </section>}

        <section className="rail-panel rail-panel-events">
          <div className="rail-head"><h2>Table events</h2><span className="rail-count">{game.log.length}</span></div>
          <ol className="event-list">
            {game.log.slice(-7).reverse().map((entry, index) => <li className={`event-row ${index === 0 ? 'event-current' : ''}`} key={`${entry}-${index}`}><span className="event-bullet" aria-hidden="true" /><p><SuitText text={entry} /></p></li>)}
          </ol>
        </section>

        <section className="rail-panel rail-panel-session">
          <div className="rail-head"><h2>This session</h2></div>
          <dl className="stats-list">
            <div><dt>Hands reviewed</dt><dd>{stats.handsPlayed}</dd></div>
            <div><dt>Contracts made</dt><dd>{stats.contractsMade}{stats.contractsAttempted ? <span className="stat-sub"> / {stats.contractsAttempted}</span> : null}</dd></div>
            <div><dt>Coach notes</dt><dd>{stats.clearMistakes}</dd></div>
          </dl>
          <button className="link-button" onClick={() => setShowGuide(true)}><BookOpen size={16} aria-hidden="true" /> Strategy field notes <ArrowUpRight size={14} aria-hidden="true" /></button>
        </section>

        <section className="rail-panel rail-panel-rules">
          <div className="rail-head"><h2>Ranking</h2></div>
          <div className="rank-row"><span>J</span><span>9</span><span>A</span><span>10</span><span>K</span><span>Q</span><span>8</span><span>7</span></div>
          <p className="rail-copy">J = 3 pts · 9 = 2 · A and 10 = 1. The rest score nothing.</p>
        </section>
      </aside>
    </main>

    {showGuide && <Modal title="Play the hand, not just the cards." eyebrow="QUICK STRATEGY GUIDE" onClose={() => setShowGuide(false)}>
      <div className="guide-content">
        <div className="guide-intro"><div className="guide-large-icon"><BookOpen size={22} /></div><p>Twenty-Nine is a four-player partnership game. You and your partner sit opposite each other. The team that wins the auction chooses trump and must capture enough points to make the contract. The first team to +6 game points wins; a team at −6 loses.</p></div>
        <div className="guide-rule"><span>01</span><div><h3>Learn the ranking</h3><p><strong>J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7.</strong> Jacks are worth 3 points, nines 2, aces and tens 1. The other cards score zero.</p></div></div>
        <div className="guide-rule"><span>02</span><div><h3>Bid for a reason</h3><p>You see four cards before the auction. Consider suit strength and length. The usual minimum is 16; a higher bid makes your contract harder.</p></div></div>
        <div className="guide-rule"><span>03</span><div><h3>Follow suit</h3><p>Play the suit led if you have it. The first player unable to follow reveals trump. From that trick onward, trump can beat another suit. The table enforces follow-suit, so a revoke cannot be played by accident.</p></div></div>
        <div className="guide-rule"><span>04</span><div><h3>Declare the royal pair</h3><p>If you still hold the K and Q of trump after your side wins a trick, declare the pair. The bidding side drops its target by 4; the defending side raises the bidding team’s target by 4. Turn this rule off in settings if your table does not play it.</p></div></div>
        <div className="guide-rule"><span>05</span><div><h3>Call the seventh card</h3><p>Instead of naming trump, the bidder can call for the seventh card dealt to them. It sets trump sight unseen and stays out of their hand until trump is revealed. Once revealed, it joins the hand. Turn this rule off in settings.</p></div></div>
        <div className="guide-rule"><span>06</span><div><h3>Double and redouble</h3><p>After trump is set, the defenders may double the hand to 2 match points. The declaring side may redouble to 4. The contract target does not change. Turn this rule off in settings.</p></div></div>
        <div className="guide-rule"><span>07</span><div><h3>Declare Reverse</h3><p>Instead of a suit, the bidder may declare Reverse: no trump, with a 2 as the table indicator. The 2 stays face down; the first void exposes it and flips the ranking to 7 high, J low for that trick and every trick after. A royal pair cannot be declared. Turn this rule off in settings.</p></div></div>
        <div className="guide-rule"><span>08</span><div><h3>Review fairly</h3><p>The coach flags clear opportunities when the visible trick allows a reliable comparison. It does not treat every unlucky outcome as a mistake. While another seat acts, it switches to a table read; after a card lands, the Last Play strip explains what that card was trying to do.</p></div></div>
        <div className="guide-footnote"><CircleHelp size={14} /><span>Classic auction. Single-hand declarations and the Bangladesh-specific bidding sequence are not implemented.</span></div>
      </div>
      <div className="modal-bottom"><button className="button-primary" onClick={() => setShowGuide(false)}>Back to the table <ArrowUpRight size={15} /></button></div>
    </Modal>}

    {showSettings && <Modal title="Practice settings" onClose={() => setShowSettings(false)}>
      <div className="settings-content">
        <div className="settings-group">
          <h3 className="settings-group-title">Table rules</h3>
          <ToggleRow title="Royal pair (K+Q of trump)" description="After your side wins a trick, declaring the pair moves the target by 4, never below the 16-point opening minimum. Applies to the next hand." checked={preferences.pair} onChange={() => setPreferences(current => ({ ...current, pair: !current.pair }))} />
          <ToggleRow title="Seventh-card trump" description="The bidder may call for the seventh card instead of naming a suit. Applies to the next hand." checked={preferences.seventhCard} onChange={() => setPreferences(current => ({ ...current, seventhCard: !current.seventhCard }))} />
          <ToggleRow title="Reverse (no trump)" description="Adds a Reverse option to the trump chooser. The 2 indicator stays face down; the first void flips the ranking to 7 high, J low. A royal pair cannot be declared. Applies to the next hand." checked={preferences.reverse} onChange={() => setPreferences(current => ({ ...current, reverse: !current.reverse }))} />
          <ToggleRow title="Double & redouble" description="Defenders may double to 2 match points; the declaring side may redouble to 4. Applies to the next hand." checked={preferences.double} onChange={() => setPreferences(current => ({ ...current, double: !current.double }))} />
          <ToggleRow title="Last-trick bonus (+1)" description="The winner of the eighth trick earns one additional point. Applies to the next hand." checked={preferences.lastTrickBonus} onChange={() => setPreferences(current => ({ ...current, lastTrickBonus: !current.lastTrickBonus }))} />
        </div>
        <div className="settings-group">
          <h3 className="settings-group-title">Coach</h3>
          <ToggleRow title="Coach & hints" description="Show the live coach, card reading, hint button, move comparison, and post-hand model review. Applies immediately." checked={preferences.coach} onChange={() => setPreferences(current => ({ ...current, coach: !current.coach }))} />
          <SelectRow title="Compare samples" description="Plausible unseen deals tested for every legal card. Higher is steadier and slower; 200 is a balanced default." value={preferences.compareSamples} options={COMPARE_SAMPLE_OPTIONS} suffix="deals" onChange={value => setPreferences(current => ({ ...current, compareSamples: value }))} />
          <SelectRow title="Deep review samples" description="Deals per recorded decision after the hand. 200 is thorough; 400 is slower but steadier." value={preferences.reviewSamples} options={REVIEW_SAMPLE_OPTIONS} suffix="/ decision" onChange={value => setPreferences(current => ({ ...current, reviewSamples: value }))} />
        </div>
        <div className="settings-note"><Target size={15} /><span>The live tip starts with the visible-card rule. When the sampled comparison finishes, its card and plan become the hybrid verdict; when the two views disagree, the tip explains both.</span></div>
        <div className="settings-group">
          <h3 className="settings-group-title">Bots</h3>
          <ToggleRow title="Search-based bots" description="On: sample unseen deals and solve the final four tricks exactly. Off: faster visible-information heuristic bots." checked={preferences.searchBots} onChange={() => setPreferences(current => ({ ...current, searchBots: !current.searchBots }))} />
          <SelectRow title="Bot search samples" description="Budget per bot move. The endgame uses fewer because each sampled deal is solved exactly. Higher is slower but more precise." value={preferences.botSamples} options={BOT_SAMPLE_OPTIONS} suffix="/ move" disabled={!preferences.searchBots} onChange={value => setPreferences(current => ({ ...current, botSamples: value }))} />
        </div>
        <div className="settings-note"><Brain size={15} /><span>Bot and coach searches are sanitized before sampling. They never receive the real hidden hands or the set-aside seventh card of another seat.</span></div>
        <div className="settings-note"><ShieldCheck size={15} /><span>Session statistics and these settings are stored locally in this browser. The current hand and its review remain in memory.</span></div>
        <div className="settings-summary"><span>Current hand</span><strong>{ruleSummary(game.rules)}</strong><span>Next hand</span><strong>{ruleSummary(preferences)}</strong></div>
      </div>
      <div className="modal-bottom"><button className="button-primary" onClick={() => setShowSettings(false)}>Done <Check size={15} /></button></div>
    </Modal>}
    <footer className="site-footer"><span>TWENTY-NINE TRAINER</span><span>Local-only practice · no account, backend, or external AI · stats stay in this browser</span><span>J · 9 · A · 10 · K · Q · 8 · 7</span></footer>
  </div>
}
