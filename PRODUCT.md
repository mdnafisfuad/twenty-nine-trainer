# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Casual Twenty-Nine players practising alone, on a mix of phones and desktops. They already know the card game's shape — partnerships, bidding, trump — and want repetition and feedback rather than a beginner tutorial.

## Product Purpose

A local-first Twenty-Nine practice table with three bots, a live coach, and a post-hand review. Success is a player who can make a confident decision within seconds, understand why it was right or wrong, and start the next hand without friction.

## Positioning

The coach reasons only from the player's own hand and public play - no hidden-card cheating - and combines deterministic visible-card rules with a Monte Carlo sampler running locally in a Web Worker. The live tip starts with the rule verdict and becomes a hybrid when the sampled result arrives: the model takes over when its edge is clear, while the visible rule remains the tie-break in close spots. A neighbouring trainer could copy the rules, but not the fair-information model, the hybrid explanation, plus card-specific reasoning at the moment of decision.

## Operating Context

Browser only: no account, backend, or API key. One session covers the deal, auction, trump selection, eight tricks, score, and review; the current hand, statistics, and preferences persist in local storage. Sessions are short and solo, often on a phone in portrait, sometimes on a laptop with the coach open. The app can be installed as a PWA and launched offline.

## Capabilities and Constraints

- Four players in fixed partnerships; the human is South.
- Simplified classic auction: J > 9 > A > 10 > K > Q > 8 > 7; J = 3, 9 = 2, A/10 = 1; minimum bid 16.
- Four-card opening deal, auction, trump chosen from the opening four (or the seventh-card option), second deal, and a hidden trump revealed on the first void.
- Optional royal pair (K+Q of trump), seventh-card trump, reverse (no-trump ranking flip), reverse with trump, double/redouble, and last-trick bonus; each can be switched off in Practice settings.
- The completed auction pauses with a Continue button before the declarer chooses the contract.
- Every completed trick pauses on the table until the player continues, so the four cards can be read before the next lead.
- The table carries physical objects: a card-stack match scoreboard whose suit mark shows the score's sign, a left-to-right point race with a contract marker, a face-down trump card that flips when revealed, and seat chips with card fans instead of status sentences. When the player is void and trump is still hidden, the trump card is tappable.
- Coach advice is kept as a per-hand history that can be stepped through with previous/next controls. The live tip is a hybrid of the visible-card rule and the sampled model.
- On another seat's turn, the coach switches to a non-actionable table read: what that seat may be trying to do, what the current trick and known voids imply. The explanation of their card then joins the coach history so it can be stepped back through.
- Suit symbols use consistent ink: hearts and diamonds are red in coach text, event logs, review copy, and card labels; black suits use light ink on dark surfaces.
- Compare uses 200 sampled deals per card by default; deep review uses 200 per decision. Both are adjustable from 48 to 400 in Practice settings.
- Single-hand declarations and the Bangladesh auction sequence are not implemented.
- The live coach may use only visible information; the deep evaluator receives sanitized state and runs in a Web Worker.
- Bots use partner-aware deterministic bidding and determinized Monte Carlo card search; once the mode is public and four or fewer tricks remain, each sampled deal is solved exactly with double-dummy minimax. Bot search is sanitized before sampling, so it cannot see the real hidden hands. Search can be switched off for faster heuristic bots, and its sample budget is configurable.
- The coach, hints, card reading, and model panels can be turned off from the top bar or settings.
- Static-deployable (Cloudflare Pages) as an installable PWA, with the current hand, session stats, and rule preferences stored locally. An in-app resume prompt offers continue or a fresh match; restart is always available in settings.

## Brand Commitments

The identity is a quiet private card room: graphite-ink chrome, a green baize table, ivory cards, and brass fittings. The felt is the one saturated surface; brass is a fitting, not a button colour. Keep the "Twenty-Nine Trainer" name and the plain-spoken coaching voice.

## Evidence on Hand

- `README.md` documents the implemented rules, evaluator, and Cloudflare Pages deployment.
- `src/game.ts` is the rules authority; `src/coach.ts` is the visible-information coach; `src/ai/evaluator.ts` is the sampler.
- No testimonials, customers, benchmarks, or commercial claims exist. Do not invent any.

## Product Principles

1. The next action is the loudest thing on screen.
2. Every coaching claim names the visible evidence behind it.
3. Save explanation for after the decision when the hand is over.
4. Never use hidden information to judge a move.
5. Practice resumes in one tap.

## Accessibility & Inclusion

The user explicitly asked for larger, more readable type and better accessibility. Target: 16px body text, 44px minimum touch targets, visible keyboard focus, reduced-motion support, state conveyed by more than colour, and layouts that hold from 320px to 1720px.
