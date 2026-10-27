import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BookOpen, Brain, Check, ChevronDown,
  CircleHelp, Clock3, Crown, Eye, Flag, Hand, Lightbulb, RotateCcw,
  Settings2, ShieldCheck, Sparkles, Swords, Target, Trophy, X,
} from 'lucide-react'
import {
  applyBid, botBid, botHint, cardText, chooseBotCard, chooseBotTrump, chooseTrump,
  isRedSuit, legalCards, newHand, playCard, PLAYER_NAMES, PLAYER_POSITIONS,
  SUITS, SUIT_LABEL, SUIT_SYMBOL, type Card, type GameState, type Suit,
} from './game'
import { sanitizeStateForEvaluation, type DeepReviewResult, type MoveEvaluation } from './ai/evaluator'
import './styles.css'

type SessionStats = {
  handsPlayed: number
  contractsMade: number
  contractsAttempted: number
  clearMistakes: number
}

const DEFAULT_STATS: SessionStats = { handsPlayed: 0, contractsMade: 0, contractsAttempted: 0, clearMistakes: 0 }
const STATS_KEY = 'twenty-nine-trainer-stats-v1'

function getStats(): SessionStats {
  try {
    const parsed = JSON.parse(localStorage.getItem(STATS_KEY) || 'null') as Partial<SessionStats> | null
    return { ...DEFAULT_STATS, ...parsed }
  } catch {
    return DEFAULT_STATS
  }
}

function sortHand(cards: Card[]): Card[] {
  const order: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  return [...cards].sort((a, b) => order.indexOf(a.suit) - order.indexOf(b.suit) || b.strength - a.strength)
}

function suitColor(suit: Suit) {
  return isRedSuit(suit) ? 'red' : 'black'
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

function PlayerSeat({ player, count, isCurrent, dealer, bidder, trumpRevealed }: {
  player: number
  count: number
  isCurrent: boolean
  dealer: boolean
  bidder: boolean
  trumpRevealed: boolean
}) {
  const name = PLAYER_NAMES[player]
  return <div className={`player-seat seat-${PLAYER_POSITIONS[player]} ${isCurrent ? 'seat-active' : ''} ${player === 0 ? 'seat-human' : ''}`}>
    <div className={`seat-avatar avatar-${player % 2 === 0 ? 'ours' : 'theirs'}`}>{player === 0 ? 'Y' : player === 2 ? 'P' : player === 1 ? 'E' : 'W'}</div>
    <div className="seat-copy">
      <div className="seat-name-line"><strong>{name}</strong>{isCurrent && <span className="turn-dot" />}</div>
      <span className="seat-subtitle">{player % 2 === 0 ? 'Your team' : 'Opponents'} · {count} cards</span>
      <div className="seat-badges">
        {dealer && <span className="mini-badge">D</span>}
        {bidder && <span className="mini-badge bid-badge"><Crown size={9} /> Bid</span>}
        {player === 0 && <span className="mini-badge you-badge">YOU</span>}
      </div>
    </div>
    {player !== 0 && <div className="mini-card-stack" aria-hidden="true"><i /><i /><i /></div>}
    {player === 0 && trumpRevealed && <span className="seat-mini-trump" title="Trump revealed"><Eye size={12} /></span>}
  </div>
}

function Modal({ title, eyebrow, onClose, children }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><p className="eyebrow">{eyebrow || 'TWENTY-NINE TRAINER'}</p><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      {children}
    </section>
  </div>
}

function TrumpChooser({ onChoose }: { onChoose: (suit: Suit) => void }) {
  return <div className="trump-chooser">
    <div className="action-copy"><span className="step-number">02</span><div><h3>Choose your trump</h3><p>Pick the suit you want to control. Look for the Jack, Nine, and suit length.</p></div></div>
    <div className="suit-choice-grid">
      {SUITS.map(suit => <button key={suit} className={`suit-choice ${isRedSuit(suit) ? 'red' : 'black'}`} onClick={() => onChoose(suit)}>
        <span className="suit-choice-symbol">{SUIT_SYMBOL[suit]}</span><span>{SUIT_LABEL[suit]}</span><span className="choice-arrow">Choose <ArrowUpRight size={13} /></span>
      </button>)}
    </div>
  </div>
}

function MoveAnalysisPanel({ analysis, objectiveLabel }: { analysis: MoveEvaluation; objectiveLabel: string }) {
  if (!analysis.options.length) return <section className="move-analysis-panel"><p>{analysis.notes[0] || 'No move estimates are available.'}</p></section>
  return <section className="move-analysis-panel">
    <div className="analysis-panel-heading"><div><span className="eyebrow">MONTE CARLO COACH</span><h3>Compare your legal moves</h3></div><span className="analysis-sample-pill">{analysis.samples} sampled deals</span></div>
    <p className="analysis-intro">Estimated chance your team succeeds at {objectiveLabel}. The same plausible deals were used for every option.</p>
    <div className="move-estimate-list">{analysis.options.map((option, index) => <article key={option.cardId} className={`move-estimate-row ${index === 0 ? 'move-estimate-best' : ''}`}>
      <span className="move-estimate-card">{option.cardLabel}</span>
      <div className="move-estimate-detail"><div className="move-estimate-top"><strong>{index === 0 ? 'Recommended' : `Option ${index + 1}`}</strong><span>{Math.round(option.teamGoalRate * 100)}%</span></div><div className="move-estimate-track"><i style={{ width: `${Math.round(option.teamGoalRate * 100)}%` }} /></div><small>Expected point margin: {option.expectedPointMargin > 0 ? '+' : ''}{option.expectedPointMargin.toFixed(1)} · ±{Math.round(option.standardError * 196)} pp sampling error</small></div>
      {index === 0 && <span className="analysis-best-tag">BEST ESTIMATE</span>}
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
        <strong>{same ? `You played ${item.chosenCardLabel} — top-ranked` : `You played ${item.chosenCardLabel}; model prefers ${item.recommendedCardLabel}`}</strong>
        <p>Estimated chance of {objectiveLabel}: {Math.round(item.chosenGoalRate * 100)}% → {Math.round(item.recommendedGoalRate * 100)}%{gain > 0 ? ` (+${gain} percentage points)` : gain < 0 ? ` (${gain} percentage points)` : ''}. Expected point-margin change: {item.pointMarginGain > 0 ? '+' : ''}{item.pointMarginGain.toFixed(1)}.</p>
        <button className="inline-link" onClick={() => onSelectTrick(item.trickNumber - 1)}>Inspect trick <ArrowUpRight size={12} /></button>
      </article>
    })}</div>
    <p className="analysis-caveat">The evaluator uses your hand and public play history, estimates hidden trump when needed, and rolls out the rest of each deal with the current bot policy. The model can be wrong; use it as a study aid.</p>
  </section>
}

function ReviewScreen({ game, onNext, onNewMatch, onSelectTrick, selectedTrick, onDeepAnalyze, deepReview, analysisLoading, analysisError }: {
  game: GameState
  onNext: () => void
  onNewMatch: () => void
  onSelectTrick: (index: number) => void
  selectedTrick: number
  onDeepAnalyze: () => void
  deepReview: DeepReviewResult | null
  analysisLoading: boolean
  analysisError: string | null
}) {
  const review = game.review
  if (!review) return null
  const ourContract = review.contractTeam === 0
  const winnerIsOurs = review.matchWinner === 0
  const selected = game.tricks[selectedTrick]
  const notes = review.notes
  const userMoves = game.decisions.length
  const pointSwing = review.teamPoints[0] - review.teamPoints[1]
  const headline = review.matchWinner !== null ? (winnerIsOurs ? 'Match won. Excellent work.' : 'Match lost. Take the lessons forward.') : review.success ? 'Contract made.' : 'Contract missed.'
  return <div className="review-screen">
    <div className="review-topline"><div><p className="eyebrow">HAND {String(game.handNumber).padStart(2, '0')} · POST-HAND REVIEW</p><h2>{headline}</h2><p className="review-subtitle">Review the decisions, not just the result. Hidden cards can create unlucky outcomes without making a move wrong.</p></div><div className={`result-stamp ${review.success ? 'result-good' : 'result-bad'}`}><span>{review.success ? <Check size={15} /> : <ArrowDownRight size={15} />}</span>{review.success ? 'CONTRACT MADE' : 'CONTRACT MISSED'}</div></div>
    <div className="review-stat-grid">
      <div className="review-stat"><span>Winning bid</span><strong>{review.bid}</strong><small>{PLAYER_NAMES[review.bidder]} · {SUIT_SYMBOL[review.trumpSuit]} {SUIT_LABEL[review.trumpSuit]}</small></div>
      <div className="review-stat"><span>Your team</span><strong>{review.teamPoints[0]} <small>/ 28{review.lastTrickBonus ? '+1' : ''}</small></strong><small>{review.cardPoints[0]} card points{review.lastTrickBonus ? ' + last trick bonus if earned' : ''}</small></div>
      <div className="review-stat"><span>Opponents</span><strong>{review.teamPoints[1]}</strong><small>{review.cardPoints[1]} card points</small></div>
      <div className="review-stat"><span>Point difference</span><strong className={pointSwing >= 0 ? 'positive' : 'negative'}>{pointSwing > 0 ? '+' : ''}{pointSwing}</strong><small>After all eight tricks</small></div>
    </div>
    <div className="review-main-grid">
      <section className="review-panel coach-review-panel">
        <div className="panel-heading review-coach-heading"><div className="panel-icon gold-icon"><Brain size={17} /></div><div><h3>Coach's review</h3><p>Rule checks plus sampled-deal analysis</p></div><button className="button-secondary deep-analyze-button" onClick={onDeepAnalyze} disabled={analysisLoading || game.decisions.length === 0}>{analysisLoading ? <><Activity size={13} className="analysis-spin" /> Analyzing…</> : <><Target size={13} /> {deepReview ? 'Run again' : 'Deep analysis'}</>}</button></div>
        {notes.length ? <div className="feedback-list">{notes.map((note, index) => <article key={`${note.trickNumber}-${index}`} className={`feedback-item feedback-${note.level}`}>
          <div className="feedback-icon">{note.level === 'opportunity' ? <Target size={15} /> : <Lightbulb size={15} />}</div>
          <div><div className="feedback-title-row"><span className="feedback-kicker">TRICK {note.trickNumber}</span><span className="feedback-tag">{note.level === 'opportunity' ? 'Missed opportunity' : 'Efficiency'}</span></div><h4>{note.title}</h4><p>{note.detail}</p>{note.betterCard && <button className="inline-link" onClick={() => onSelectTrick(note.trickNumber - 1)}>Review trick <ArrowUpRight size={12} /></button>}</div>
        </article>)}</div> : <div className="no-mistakes"><div className="success-orbit"><ShieldCheck size={22} /></div><h4>No clear tactical error detected</h4><p>The review checked your moves where the visible cards made a clear comparison possible. Early plays involve hidden information, so the game will not label a reasonable move a mistake just because an opponent later had the perfect card.</p></div>}
        {analysisError && <p className="analysis-error">{analysisError}</p>}
        {deepReview && <DeepReviewPanel result={deepReview} objectiveLabel={review.contractTeam === 0 ? 'making the contract' : 'defeating the contract'} onSelectTrick={onSelectTrick} />}
        <div className="lesson-callout"><Sparkles size={16} /><div><strong>Key lesson</strong><p>{review.success ? 'You made the contract. In the next hand, focus on whether you preserved control cards while collecting points.' : 'Your contract fell short. Study the remaining high cards and ask which point-rich tricks your team needed to secure.'}</p></div></div>
        {ourContract && <div className="contract-note"><Flag size={14} /><span>Your side made the bid. Contract outcome is based on points captured by the bidding team.</span></div>}
      </section>
      <section className="review-panel trick-review-panel">
        <div className="panel-heading"><div className="panel-icon green-icon"><Swords size={17} /></div><div><h3>Trick timeline</h3><p>Select any trick to inspect every card</p></div></div>
        <div className="trick-timeline">{game.tricks.map((trick, index) => <button key={trick.number} className={`trick-chip ${index === selectedTrick ? 'selected' : ''}`} onClick={() => onSelectTrick(index)}>
          <span className="trick-chip-num">{String(trick.number).padStart(2, '0')}</span><span className="trick-chip-winner">{PLAYER_NAMES[trick.winner]}</span><strong>{trick.points}<small> pts</small></strong><span className="trick-chip-mark">{trick.winner % 2 === 0 ? 'OUR TEAM' : 'THEM'}</span>
        </button>)}</div>
        {selected && <div className="selected-trick-detail"><div className="selected-trick-head"><div><span className="eyebrow">TRICK {selected.number}</span><h4>{PLAYER_NAMES[selected.winner]} won · {selected.points} point{selected.points === 1 ? '' : 's'}</h4></div><span className="trick-won-badge">{selected.winner % 2 === 0 ? 'Your team' : 'Opponents'}</span></div>
          <div className="review-plays">{selected.plays.map((play, i) => <div key={`${selected.number}-${play.player}`} className="review-play"><span className="review-play-player">{PLAYER_NAMES[play.player]}</span><CardFace card={play.card} compact /><span className="review-play-order">{i === 0 ? 'LEAD' : i === 3 ? 'LAST' : `PLAY ${i + 1}`}</span></div>)}</div>
          <p className="trick-explainer">{selected.plays.some(p => p.card.suit === review.trumpSuit) && game.tricks.find(t => t.number === selected.number) ? `Trump was ${SUIT_LABEL[review.trumpSuit]}. ` : ''}{PLAYER_NAMES[selected.winner]} took the trick. Card points in this trick: {selected.cardPoints}{selected.bonus ? `, plus ${selected.bonus} last-trick bonus` : ''}.</p>
        </div>}
      </section>
    </div>
    <div className="review-footer"><div className="review-footer-copy"><Check size={15} /><span>Hand review · {userMoves} of your decisions recorded</span></div><div className="review-actions"><button className="button-secondary" onClick={onNewMatch}><RotateCcw size={15} /> New match</button>{review.matchWinner === null && <button className="button-primary" onClick={onNext}>Deal next hand <ArrowUpRight size={15} /></button>}</div></div>
  </div>
}

type EvaluatorResponse =
  | { requestId: number; kind: 'moves'; version: number; result: MoveEvaluation }
  | { requestId: number; kind: 'review'; version: number; result: DeepReviewResult }
  | { requestId: number; kind: 'error'; version: number; error: string }

type PendingEvaluation = { id: number; kind: 'moves' | 'review'; version: number }

export default function App() {
  const [lastTrickPreference, setLastTrickPreference] = useState(false)
  const [game, setGame] = useState<GameState>(() => newHand(3, 1, [0, 0], false, 1))
  const [stats, setStats] = useState<SessionStats>(getStats)
  const [showGuide, setShowGuide] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [coachOpen, setCoachOpen] = useState(true)
  const [selectedTrick, setSelectedTrick] = useState(0)
  const [bidChoice, setBidChoice] = useState(16)
  const processedHand = useRef<number | null>(null)
  const analyzedHand = useRef<number | null>(null)
  const evaluatorWorker = useRef<Worker | null>(null)
  const nextEvaluationId = useRef(0)
  const pendingEvaluation = useRef<PendingEvaluation | null>(null)
  const currentGameVersion = useRef(game.version)
  currentGameVersion.current = game.version
  const [moveAnalysis, setMoveAnalysis] = useState<{ version: number; result: MoveEvaluation } | null>(null)
  const [deepReview, setDeepReview] = useState<DeepReviewResult | null>(null)
  const [analysisLoading, setAnalysisLoading] = useState<'moves' | 'review' | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

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
    if (game.phase === 'auction' && game.currentPlayer !== 0) {
      const player = game.currentPlayer
      const decision = botBid(game, player)
      const version = game.version
      timer = window.setTimeout(() => setGame(current => current.version === version ? applyBid(current, player, decision) : current), 460 + Math.random() * 300)
    } else if (game.phase === 'trump' && game.bidder !== null && game.bidder !== 0) {
      const player = game.bidder
      const suit = chooseBotTrump(game.hands[player])
      const version = game.version
      timer = window.setTimeout(() => setGame(current => current.version === version ? chooseTrump(current, player, suit) : current), 550)
    } else if (game.phase === 'play' && game.currentPlayer !== 0) {
      const player = game.currentPlayer
      const card = chooseBotCard(game, player)
      const version = game.version
      timer = window.setTimeout(() => setGame(current => current.version === version ? playCard(current, player, card.id) : current), 520 + Math.random() * 280)
    }
    return () => { if (timer !== undefined) window.clearTimeout(timer) }
  }, [game])

  useEffect(() => {
    if (game.phase === 'review' && game.review && game.decisions.length > 0 && analyzedHand.current !== game.handId) {
      analyzedHand.current = game.handId
      requestDeepReview()
    }
  }, [game.phase, game.handId, game.review])

  const sortedHand = useMemo(() => sortHand(game.hands[0] || []), [game.hands])
  const currentLegal = useMemo(() => game.phase === 'play' && game.currentPlayer === 0 ? legalCards(game.hands[0], game.currentTrick).map(c => c.id) : [], [game])
  const minBid = game.highBid === null ? 16 : game.highBid + 1
  const maxBid = game.lastTrickBonusEnabled ? 29 : 28
  const userCanBid = game.phase === 'auction' && game.currentPlayer === 0
  const userCanPlay = game.phase === 'play' && game.currentPlayer === 0
  const currentTrickPoints = game.currentTrick.reduce((sum, item) => sum + item.card.points, 0)
  const currentBidTeam = game.bidder === null ? null : game.bidder % 2 === 0 ? 'ours' : 'theirs'
  const liveHint = botHint(game)
  const phaseTitle = game.phase === 'auction' ? 'Read your hand. Make your call.' : game.phase === 'trump' ? 'Choose the suit you can control.' : game.phase === 'play' ? 'Win the right tricks.' : 'Review your decisions.'

  function nextHand() {
    pendingEvaluation.current = null
    setAnalysisLoading(null)
    setAnalysisError(null)
    setMoveAnalysis(null)
    setDeepReview(null)
    setGame(current => newHand((current.dealer + 1) % 4, current.handNumber + 1, current.matchScore, lastTrickPreference, current.handId + 1, 'New hand. Start by judging your first four cards.'))
  }
  function newMatch() {
    processedHand.current = null
    analyzedHand.current = null
    pendingEvaluation.current = null
    setAnalysisLoading(null)
    setAnalysisError(null)
    setMoveAnalysis(null)
    setDeepReview(null)
    setGame(current => newHand(3, 1, [0, 0], lastTrickPreference, current.handId + 1, 'Fresh match. Take your time and plan each bid.'))
  }
  function humanBid(bid: number | null) {
    setGame(current => applyBid(current, 0, bid))
    setBidChoice(Math.min(28, (game.highBid ?? 15) + 2))
  }
  function chooseUserTrump(suit: Suit) { setGame(current => chooseTrump(current, 0, suit)) }
  function chooseUserCard(card: Card) { if (userCanPlay && currentLegal.includes(card.id)) setGame(current => playCard(current, 0, card.id)) }
  function requestMoveAnalysis() {
    if (!evaluatorWorker.current || !userCanPlay) return
    const requestId = ++nextEvaluationId.current
    pendingEvaluation.current = { id: requestId, kind: 'moves', version: game.version }
    setAnalysisError(null)
    setMoveAnalysis(null)
    setAnalysisLoading('moves')
    // Strip private opponent hands and hidden trump before the snapshot enters the worker.
    const safeState = sanitizeStateForEvaluation(game, 0)
    evaluatorWorker.current.postMessage({ requestId, kind: 'moves', state: safeState, samples: 64, seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  function requestDeepReview() {
    if (!evaluatorWorker.current || game.phase !== 'review' || !game.decisions.length) return
    const requestId = ++nextEvaluationId.current
    pendingEvaluation.current = { id: requestId, kind: 'review', version: game.version }
    setAnalysisError(null)
    setDeepReview(null)
    setAnalysisLoading('review')
    const safeDecisions = game.decisions.map(decision => ({ ...decision, trumpSuit: decision.knownTrumpSuit }))
    evaluatorWorker.current.postMessage({ requestId, kind: 'review', decisions: safeDecisions, samples: 32, seed: Math.floor(Math.random() * 0x7fffffff) })
  }

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><span>2</span><span>9</span><i>♠</i></div><div className="brand-text"><div>Twenty-Nine <span>TRAINER</span></div><small>Play smarter, one hand at a time</small></div></div>
      <div className="topbar-center"><span className="online-dot" /> Local practice <span className="topbar-divider" /> <span>No account required</span></div>
      <div className="topbar-actions"><button className="top-action" onClick={() => setShowGuide(true)}><BookOpen size={15} /><span>How to play</span></button><button className="round-icon-button" onClick={() => setShowSettings(true)} aria-label="Settings"><Settings2 size={18} /></button></div>
    </header>

    <main className="app-layout">
      <aside className="left-rail">
        <div className="rail-section-title"><span>YOUR SESSION</span><span className="live-label"><i /> LIVE</span></div>
        <section className="score-card">
          <div className="score-card-head"><span className="eyebrow">MATCH SCORE</span><span className="target-chip"><Target size={11} /> FIRST TO +6</span></div>
          <div className="match-score-row">
            <div className="score-team score-ours"><div className="team-avatar-stack"><span>Y</span><span>P</span></div><div><small>Your team</small><strong>{game.matchScore[0] > 0 ? '+' : ''}{game.matchScore[0]}</strong></div></div>
            <div className="score-separator">VS</div>
            <div className="score-team score-theirs"><div className="team-avatar-stack team-avatar-dark"><span>E</span><span>W</span></div><div><small>Opponents</small><strong>{game.matchScore[1] > 0 ? '+' : ''}{game.matchScore[1]}</strong></div></div>
          </div>
          <div className="score-track"><span style={{ width: `${Math.min(100, Math.abs(game.matchScore[0]) / 6 * 100)}%` }} /></div>
          <div className="score-footer"><span>Hand {String(game.handNumber).padStart(2, '0')}</span><span>Dealer: {PLAYER_NAMES[game.dealer]}</span></div>
        </section>

        <div className="rail-section-title rail-spaced"><span>CONTRACT</span><span className="status-pill">{game.phase === 'auction' ? 'BIDDING' : game.phase === 'trump' ? 'TRUMP' : game.phase === 'play' ? 'IN PLAY' : 'COMPLETE'}</span></div>
        <section className="contract-card">
          <div className="contract-top"><span className="contract-icon"><Crown size={16} /></span><div><small>Current high bid</small><strong>{game.highBid ?? '—'}</strong></div></div>
          <div className="contract-details"><span>Bidder</span><strong>{game.bidder === null ? 'No bid yet' : PLAYER_NAMES[game.bidder]}</strong></div>
          <div className="contract-details"><span>Target team</span><strong>{currentBidTeam === null ? 'Undecided' : currentBidTeam === 'ours' ? 'Your team' : 'Opponents'}</strong></div>
          <div className="contract-details"><span>Trump</span><strong>{game.trumpSuit && (game.trumpRevealed || game.bidder === 0) ? <span className={suitColor(game.trumpSuit)}>{SUIT_SYMBOL[game.trumpSuit]} {SUIT_LABEL[game.trumpSuit]}</span> : game.phase === 'trump' && game.bidder === 0 ? 'Choose now' : game.trumpSuit ? 'Hidden' : 'Unknown'}</strong></div>
          {game.phase === 'play' && <div className="points-progress"><div><span>Your team</span><strong>{game.review?.teamPoints[0] ?? game.tricks.filter(t => t.winner % 2 === 0).reduce((n, t) => n + t.points, 0)} pts</strong></div><div><span>On table</span><strong>{currentTrickPoints} pts</strong></div></div>}
        </section>

        <div className="rail-section-title rail-spaced"><span>YOUR PROGRESS</span><Activity size={13} /></div>
        <section className="progress-card">
          <div className="progress-row"><span className="progress-icon"><Hand size={14} /></span><div><small>Hands reviewed</small><strong>{stats.handsPlayed}</strong></div></div>
          <div className="progress-row"><span className="progress-icon green"><Trophy size={14} /></span><div><small>Contracts made</small><strong>{stats.contractsMade}<em>{stats.contractsAttempted ? ` / ${stats.contractsAttempted}` : ' so far'}</em></strong></div></div>
          <div className="progress-row"><span className="progress-icon gold"><Lightbulb size={14} /></span><div><small>Coach notes</small><strong>{stats.clearMistakes}</strong></div></div>
          <div className="progress-caption">Progress is stored in this browser.</div>
        </section>
        <button className="guide-link-card" onClick={() => setShowGuide(true)}><span className="guide-icon"><BookOpen size={18} /></span><span><strong>Strategy field notes</strong><small>Ranking, bidding & trick play</small></span><ArrowUpRight size={15} /></button>
      </aside>

      <section className="game-column">
        {game.phase === 'review' && game.review ? <ReviewScreen game={game} onNext={nextHand} onNewMatch={newMatch} selectedTrick={selectedTrick} onSelectTrick={setSelectedTrick} onDeepAnalyze={requestDeepReview} deepReview={deepReview} analysisLoading={analysisLoading === 'review'} analysisError={analysisError} /> : <>
          <div className="game-heading"><div><div className="heading-meta"><span className="eyebrow">PRACTICE TABLE</span><span className="round-label">ROUND {String(game.handNumber).padStart(2, '0')}</span></div><h1>{phaseTitle}</h1><p>{game.phase === 'auction' ? 'You will see four cards first. Decide whether your hand can support a contract.' : game.phase === 'trump' ? 'Strong trump cards and a useful suit length give you control.' : 'Read the trick, count the points, and think one play ahead.'}</p></div><button className={`hint-toggle ${coachOpen ? 'hint-active' : ''}`} onClick={() => setCoachOpen(v => !v)}><Brain size={15} /> Coach {coachOpen ? 'on' : 'off'} <ChevronDown size={13} /></button></div>

          <div className="table-frame">
            <div className="table-frame-top"><div className="table-label"><span className="table-status-dot" /> <span>{game.phase === 'auction' ? userCanBid ? 'YOUR TURN TO BID' : `${PLAYER_NAMES[game.currentPlayer]} IS THINKING` : game.phase === 'trump' ? 'TRUMP SELECTION' : userCanPlay ? 'YOUR TURN TO PLAY' : `${PLAYER_NAMES[game.currentPlayer]} IS PLAYING`}</span></div><div className="table-top-right"><span className="trick-count">{game.phase === 'auction' ? '4 CARDS DEALT' : `${game.tricks.length}/8 TRICKS`}</span><span className="table-top-badge">{game.phase === 'play' && game.trumpRevealed && game.trumpSuit ? <><span className={suitColor(game.trumpSuit)}>{SUIT_SYMBOL[game.trumpSuit]}</span> TRUMP UP</> : game.phase === 'play' && game.bidder === 0 && game.trumpSuit ? <><span className={suitColor(game.trumpSuit)}>{SUIT_SYMBOL[game.trumpSuit]}</span> YOUR TRUMP</> : `${game.lastTrickBonusEnabled ? 29 : 28} POINTS`}</span></div></div>
            <div className="felt-table">
              <div className="felt-grain" />
              <div className="felt-orbit orbit-one" /><div className="felt-orbit orbit-two" />
              {[0, 1, 2, 3].map(player => <PlayerSeat key={player} player={player} count={game.hands[player]?.length ?? 0} isCurrent={game.currentPlayer === player && game.phase !== 'review'} dealer={game.dealer === player} bidder={game.bidder === player} trumpRevealed={game.trumpRevealed} />)}
              {game.currentTrick.map(play => <div key={play.player} className={`played-card played-${PLAYER_POSITIONS[play.player]}`}><CardFace card={play.card} compact /></div>)}
              <div className="table-center">
                <div className="center-logo"><span>29</span><i>♠</i></div>
                {game.phase === 'auction' && <><strong className="center-title">The auction</strong><span className="center-subtitle">{game.highBid === null ? 'Opening bid · minimum 16' : `High bid ${game.highBid} · ${PLAYER_NAMES[game.bidder ?? 0]}`}</span></>}
                {game.phase === 'trump' && <><strong className="center-title">Choose your edge</strong><span className="center-subtitle">The trump suit stays hidden</span></>}
                {game.phase === 'play' && <><strong className="center-title">Trick {game.tricks.length + 1} <span>of 8</span></strong><span className="center-subtitle">{game.currentTrick.length === 0 ? 'Lead any suit' : `${SUIT_LABEL[game.currentTrick[0].card.suit]} led · ${currentTrickPoints} points on table`}</span></>}
                <div className="table-message">{game.message}</div>
              </div>
              <div className="felt-bottom-rule"><span>PARTNERSHIP PLAY</span><span>J · 9 · A · 10 · K · Q · 8 · 7</span></div>
            </div>
          </div>

          {game.phase === 'trump' && game.bidder === 0 && <TrumpChooser onChoose={chooseUserTrump} />}

          <section className={`hand-panel ${userCanPlay ? 'hand-panel-active' : ''}`}>
            <div className="hand-panel-head"><div><div className="hand-title-row"><Hand size={16} /><h3>Your hand</h3><span className="hand-count-pill">{sortedHand.length} cards</span></div><p>{game.phase === 'auction' ? 'Judge the four cards you have. Four more arrive after trump is chosen.' : game.phase === 'trump' ? 'Your four opening cards are shown above. Trump choice locks in the deal.' : userCanPlay ? 'Tap a legal card to play. Cards you cannot use now are dimmed.' : 'Your cards stay visible while the other players take their turns.'}</p></div><span className="card-sort-note">SORTED BY SUIT</span></div>
            <div className={`hand-cards ${sortedHand.length > 6 ? 'hand-cards-full' : ''}`}>
              {sortedHand.map(card => {
                const playable = userCanPlay && currentLegal.includes(card.id)
                const disabled = userCanPlay && !playable
                return <div key={card.id} className={`hand-card-wrap ${playable ? 'is-playable' : ''} ${disabled ? 'is-muted' : ''}`}><CardFace card={card} playable={playable} disabled={disabled} onClick={userCanPlay ? () => chooseUserCard(card) : undefined} label={`Play ${card.rank} of ${SUIT_LABEL[card.suit]}`} />{playable && <span className="play-indicator"><Check size={10} /> PLAY</span>}</div>
              })}
              {sortedHand.length === 0 && <div className="empty-hand">Your cards have been played.</div>}
            </div>
            {userCanBid && <div className="decision-panel bid-panel"><div className="action-copy"><span className="step-number">01</span><div><h3>Your bid</h3><p>{game.highBid === null ? 'Open at 16 or pass. Only bid if the hand can support it.' : `Beat the current bid of ${game.highBid}, or pass to leave the auction.`}</p></div></div><div className="bid-controls"><label className="bid-select-wrap"><span>POINTS</span><select value={Math.min(maxBid, Math.max(minBid, bidChoice))} onChange={e => setBidChoice(Number(e.target.value))} aria-label="Choose bid amount">{Array.from({ length: Math.max(0, maxBid - minBid + 1) }, (_, index) => minBid + index).map(value => <option key={value} value={value}>{value} points</option>)}</select></label><button className="button-secondary pass-button" onClick={() => humanBid(null)}>Pass</button><button className="button-primary" disabled={minBid > maxBid} onClick={() => humanBid(Math.min(maxBid, Math.max(minBid, bidChoice)))}>Bid {Math.min(maxBid, Math.max(minBid, bidChoice))} <ArrowUpRight size={15} /></button></div></div>}
            {game.phase === 'auction' && !userCanBid && <div className="waiting-strip"><Clock3 size={15} /><span>{PLAYER_NAMES[game.currentPlayer]} is considering the hand. Watch how the bidding develops.</span><span className="thinking-dots"><i /><i /><i /></span></div>}
            {game.phase === 'play' && <div className="play-footer"><div className="play-turn-copy">{userCanPlay ? <><span className="turn-indicator" /><strong>Your move</strong><span>Follow suit whenever possible.</span></> : <><Clock3 size={14} /><strong>{PLAYER_NAMES[game.currentPlayer]} is thinking</strong><span>Study the cards on the table.</span></>}</div>{userCanPlay && <div className="play-footer-actions"><button className="button-quiet" onClick={() => setCoachOpen(true)}><Lightbulb size={14} /> Get a hint</button><button className="button-primary" onClick={requestMoveAnalysis} disabled={analysisLoading === 'moves'}>{analysisLoading === 'moves' ? <><Activity size={13} className="analysis-spin" /> Analyzing</> : <><Target size={13} /> Compare moves</>}</button></div>}</div>}
          </section>
          {coachOpen && <section className="inline-coach"><div className="inline-coach-mark"><Brain size={17} /></div><div className="inline-coach-content"><div className="inline-coach-head"><strong>Coach's thought</strong><span>BASED ON VISIBLE INFORMATION</span></div><p>{liveHint}</p></div><button className="coach-collapse" onClick={() => setCoachOpen(false)} aria-label="Hide coach"><X size={15} /></button></section>}
          {analysisError && game.phase === 'play' && userCanPlay && <p className="analysis-error">{analysisError}</p>}
          {moveAnalysis && moveAnalysis.version === game.version && <MoveAnalysisPanel analysis={moveAnalysis.result} objectiveLabel={game.bidder !== null && game.bidder % 2 === 0 ? 'making the contract' : 'defeating the contract'} />}
        </>}
      </section>

      <aside className="right-rail">
        <div className="rail-section-title"><span>TABLE INTELLIGENCE</span><Brain size={13} /></div>
        <section className="right-card strategy-card"><div className="strategy-card-top"><div className="strategy-emblem"><Sparkles size={16} /></div><span className="strategy-label">LIVE COACH</span></div><h3>{game.phase === 'auction' ? 'Make a bid with a plan.' : game.phase === 'trump' ? 'Choose power, not just length.' : 'Read the trick before you act.'}</h3><p>{liveHint}</p><div className="strategy-footer"><span><Eye size={12} /> No hidden-card cheating</span><span><ShieldCheck size={12} /> Fair review</span></div></section>
        <div className="rail-section-title rail-spaced"><span>RECENT TABLE EVENTS</span><span className="event-count">{game.log.length}</span></div>
        <section className="event-card">
          {game.log.slice(-7).reverse().map((entry, index) => <div className="event-row" key={`${entry}-${index}`}><span className={`event-bullet ${index === 0 ? 'event-bullet-active' : ''}`} /><p>{entry}</p></div>)}
        </section>
        <div className="rail-section-title rail-spaced"><span>REMEMBER</span><CircleHelp size={13} /></div>
        <section className="quick-rule-card"><div className="quick-rule-line"><span className="rule-rank">J</span><span className="rule-rank">9</span><span className="rule-rank">A</span><span className="rule-rank">10</span><span className="rule-rank">K</span></div><p>Card rank is unusual: <strong>Jack beats Nine</strong>, then Ace, Ten, King, Queen, Eight, Seven.</p><div className="quick-rule-points"><span><b>J</b> 3 pts</span><span><b>9</b> 2 pts</span><span><b>A / 10</b> 1 pt</span></div></section>
        <div className="privacy-note"><ShieldCheck size={14} /><span>Runs entirely in your browser. No account, backend, or external AI required.</span></div>
      </aside>
    </main>

    {showGuide && <Modal title="Play the hand, not just the cards." eyebrow="QUICK STRATEGY GUIDE" onClose={() => setShowGuide(false)}>
      <div className="guide-content">
        <div className="guide-intro"><div className="guide-large-icon"><BookOpen size={22} /></div><p>Twenty-Nine is a four-player partnership game. You and your partner sit opposite each other. The team that wins the auction chooses trump and must capture enough points to make the contract.</p></div>
        <div className="guide-rule"><span>01</span><div><h3>Learn the ranking</h3><p><strong>J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7.</strong> Jacks are worth 3 points, nines 2, aces and tens 1. The other cards score zero.</p></div></div>
        <div className="guide-rule"><span>02</span><div><h3>Bid for a reason</h3><p>You see four cards before the auction. Consider suit strength and length. The usual minimum is 16; a higher bid makes your contract harder.</p></div></div>
        <div className="guide-rule"><span>03</span><div><h3>Follow suit</h3><p>Play the suit led if you have it. In this version, the first player unable to follow reveals trump. From that trick onward, trump can beat another suit.</p></div></div>
        <div className="guide-rule"><span>04</span><div><h3>Help your partner</h3><p>If your partner is safely winning, avoid spending a powerful card unnecessarily. Add point cards when they improve your team's capture.</p></div></div>
        <div className="guide-rule"><span>05</span><div><h3>Review fairly</h3><p>The coach flags clear opportunities when the visible trick allows a reliable comparison. It does not treat every unlucky outcome as a mistake.</p></div></div>
        <div className="guide-footnote"><CircleHelp size={14} /><span>This starter uses a simplified classic auction. Pair/Royals, seventh-card trump, doubling, and the Bangladesh-specific auction sequence are not implemented yet.</span></div>
      </div>
      <div className="modal-bottom"><button className="button-primary" onClick={() => setShowGuide(false)}>Back to the table <ArrowUpRight size={15} /></button></div>
    </Modal>}

    {showSettings && <Modal title="Practice settings" onClose={() => setShowSettings(false)}>
      <div className="settings-content"><div className="setting-row"><div className="setting-copy"><strong>Last-trick bonus (+1)</strong><p>When enabled, the winner of the eighth trick earns one additional point. The setting applies to the next hand.</p></div><button role="switch" aria-checked={lastTrickPreference} className={`toggle ${lastTrickPreference ? 'toggle-on' : ''}`} onClick={() => setLastTrickPreference(v => !v)}><span /></button></div><div className="settings-note"><ShieldCheck size={15} /><span>Session statistics are saved locally in this browser. The current hand and its review remain in memory until you start another hand or reload.</span></div><div className="settings-summary"><span>Current hand</span><strong>{game.lastTrickBonusEnabled ? 'Last trick = 1 bonus point' : '28 card points · no last-trick bonus'}</strong><span>Next hand</span><strong>{lastTrickPreference ? 'Last trick bonus enabled' : 'No last-trick bonus'}</strong></div></div>
      <div className="modal-bottom"><button className="button-primary" onClick={() => setShowSettings(false)}>Done <Check size={15} /></button></div>
    </Modal>}
    <footer className="site-footer"><span>TWENTY-NINE TRAINER</span><span>Built for practice · All progress stays local</span><span>J · 9 · A · 10 · K · Q · 8 · 7</span></footer>
  </div>
}
