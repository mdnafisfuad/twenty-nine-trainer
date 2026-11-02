# Twenty-Nine Trainer

A local-first Twenty-Nine practice game built with React, TypeScript, Vite, and Lucide icons. It runs entirely in the browser with no backend, account, or AI API key.

## Features

- Human player plus three bot players in two fixed partnerships.
- Four-card opening deal, bidding, trump selection, second deal, hidden trump, follow-suit rules, eight tricks, and match scoring.
- Optional classic rules, each switchable in **Practice settings**:
  - **Royal pair:** declare the K+Q of trump after your side wins a trick to move the target by 4, never below the 16-point opening minimum.
  - **Seventh-card trump:** the bidder can let their seventh dealt card set trump sight unseen.
  - **Double & redouble:** defenders can double to 2 match points and the declaring side can redouble to 4.
  - **Reverse:** the bidder can declare a no-trump contract; when the face-down 2 indicator is exposed, the ranking flips to 7 high and J low for that trick onward.
  - **Reverse with trump:** the bidder names a trump suit and keeps the flipped ranking. Once revealed, the trump 7 is the strongest card on the table, and the royal pair can still be declared.
  - **Last-trick bonus:** the eighth trick carries one extra point.
- An **auction pause** after the final pass: the completed auction board stays on screen with a Continue button before trump is chosen.
- A **pause after every completed trick**: the four cards, winner, and points stay on the table until you press Continue.
- A physical table: a card-stack **match scoreboard** whose suit mark shows the sign, a **28/29-point race** with the bidding side filling from the left, the defence from the right, and a contract marker in between, plus a face-down **trump card** that flips when the suit is revealed. When you are void in the led suit and trump is still hidden, the trump card becomes a button: tap it to reveal the contract before choosing your discard. Seat chips show each player's avatar, card fan, dealer token, and auction win instead of status sentences.
- **Coach tip history:** step back through earlier advice with previous/next arrows; a Latest jump returns to live advice.
- Trump-reveal and royal-pair announcements animate on the felt, and the trump card flips when the suit is exposed.
- **Search-based bots:** partner-aware bidding, plus determinized Monte Carlo card play over plausible unseen deals. Once the contract mode is public, the last four tricks are solved exactly with double-dummy minimax. Bots still use only their own hand and public information; the search never receives the real hidden hands.
- **Hybrid coach:** a visible-card rule tip starts every turn, then the sampled comparison turns it into a hybrid verdict. The card, plan, and confidence label update when the model has a clear edge; when the views are close, the rule remains the tie-break and the tip explains both. The live coach keeps the evidence behind each claim, plus a bid review after the hand.
- **Off-turn table reads:** while an opponent or partner is thinking, the coach stops giving you card advice and instead reads the public table: the contract count, known voids, likely suit plan, and what to watch. After a card lands, that read joins the coach history, where the arrows let you revisit what the card was likely trying to do.
- **Consistent suit ink:** hearts and diamonds are red everywhere, including coach text, event logs, card labels, and review copy; black suits use the light ink on dark surfaces.
- **Coach off switch** in the top bar and settings for a clean table with no hints or model panels.
- Rule-based post-hand feedback for clear tactical opportunities, point donations, wasted control, and uncollected points.
- **Monte Carlo move evaluator:** compare every legal card against 200 sampled unseen deals by default, with exact double-dummy solving once four or fewer tricks remain. Sample size is adjustable in **Practice settings** from 48 to 400.
- **Automatic full-hand deep review:** after each hand, re-evaluate each recorded decision across 200 sampled deals by default, show the model's alternative, and estimate how it changes the chance of achieving your team's objective. The review can be run again on demand, and its sample size is adjustable.
- **Bot controls:** search-based bots can be switched off for faster heuristic play, and the bot search budget can be set to 24, 48, 96, or 200 deals per move.
- Sampling respects seen cards, known void suits, and public remaining-card counts. The worker receives a sanitized snapshot without opponents' hands or a hidden trump suit.
- A Web Worker keeps the coach's move-comparison and deep-review simulations off the main UI thread; the bots' own search runs locally in the page during their turn.
- Interactive trick timeline, contextual hints, local session statistics, and responsive phone/tablet/desktop layouts.
- Static output deployable to Cloudflare Pages.

## Strategy evaluator: what it does

The evaluator does not just rank cards with fixed rules. It samples plausible hidden deals that fit the cards already played, each player's remaining card count, and suits players have shown they are void in. Every candidate legal move is rolled out using the same set of sampled deals, so comparisons are less noisy. Each rollout uses the current bot policy for the rest of the hand.

When trump is public and four or fewer tricks remain, the rollout is replaced by an exact double-dummy minimax solve on each sampled deal. That removes most of the late-game sampling noise and lets the review distinguish genuinely better endgame plays.

The live tip is a hybrid. It keeps the rule coach's visible-card explanation and plan. Once the sampled comparison is ready, the tip uses the model's card when it has a clear edge, and keeps the rule card as a tie-break when the top options are close. The card shows the rule and sampled views side by side so the player can see why the two agree or differ.

The bots use the same machinery for their own decisions. Each bot sanitizes its view, samples unseen deals, evaluates every legal card against the same deals, and plays the best expected move. Bidding is deterministic and partner-aware: a bot does not outbid a partner who already holds the contract, a raise without partner support must project at least one level above the contract, and a high contested bid needs a larger cushion. There is no random bluffing.

The result shows:

- Estimated chance your team achieves its objective. If your team bid, that means making the contract; if defending, that means defeating the contract.
- Estimated contract success rate and expected point margin.
- Sampling error, the number of sampled deals, and whether hidden trump was approximated.
- Alternative moves at post-hand review.

**Limits:** this is a teaching approximation, not a perfect solver. It uses the current bot policy for hypothetical continuation, and the unknown trump suit is modelled from plausible opening four-card hands when it is hidden. The percentages are estimates and should be interpreted with the sample count and uncertainty. More samples improve stability but take longer; the default is 200, and 400 is available for close study. The evaluator intentionally does not inspect the actual unseen hands when constructing scenarios.

## Rules used in this starter

This is a classic auction variant for practice. Card order is **J > 9 > A > 10 > K > Q > 8 > 7**. Jacks are worth 3 points, nines 2, aces and tens 1, and other cards 0. The usual minimum bid is 16. The default hand has 28 card points; the optional last-trick bonus makes the eighth trick worth one additional point. The first team to +6 game points wins; a team at −6 loses.

The settings panel can toggle each optional rule independently:

- **Royal pair.** A player still holding the K+Q of trump may declare it after their side wins a trick. The declaring side's target falls by 4, reduced only as far as the 16-point opening minimum; the defending side's declaration raises the bidding team's target by 4.
- **Seventh-card trump.** Instead of naming a suit, the bidder asks for the seventh card. The seventh card dealt to the bidder sets trump and is kept out of their hand until trump is revealed. It cannot be led unless it is their last card.
- **Double and redouble.** After trump is set, the defending team may double the hand to 2 match points. The declaring team may redouble to 4. The contract target is unchanged.
- **Reverse.** The bidder may declare Reverse instead of a suit. It is a no-trump contract; a 2 is placed as the table indicator and stays face down. The first player who cannot follow suit exposes it, and from that trick onward the ranking flips to **7 high, J low** (point values unchanged). A royal pair cannot be declared. The indicator's suit is cosmetic.
- **Reverse with trump.** The bidder names a trump suit and the ranking flips to **7 high, J low** once the contract is revealed. The named suit still beats other suits, so the trump 7 is the strongest card on the table and the trump J is the weakest trump. The royal pair can be declared after trump is revealed. The contract stays hidden until the first void, exactly like a normal trump contract.
- **Last-trick bonus.** The winner of the eighth trick earns one additional point.

The UI enforces follow-suit, so a revoke cannot be played by accident. Single-hand declarations and the Bangladesh-specific bidding sequence are not implemented.

## Requirements

- Node.js 22.12 or newer (the included `.nvmrc` pins Node 22.16.0).
- pnpm 10.7.1 (the exact version is pinned in `package.json`; Corepack uses that pin).

## Run locally with pnpm

```bash
corepack enable
pnpm install
pnpm dev
```

Open the local URL printed by Vite.

Create the production bundle:

```bash
pnpm build
pnpm preview
```

The build output is written to `dist/`. Commit the generated `pnpm-lock.yaml` after the first successful `pnpm install` so future installs are reproducible.

## Deploy to Cloudflare Pages

The project is a static Vite SPA. `public/_redirects` provides the SPA fallback, `public/_headers` adds security and cache headers, and `wrangler.jsonc` points Wrangler at `dist`.

1. Push this project to a Git repository.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Select the repository and use these build settings:
   - **Framework preset:** React (Vite) or None
   - **Build command:** `corepack pnpm install --frozen-lockfile && corepack pnpm build`
   - **Build output directory:** `dist`
   - **Node.js version:** 22.16.0 or newer in the Node 22 line
4. `pnpm-lock.yaml` is committed, so the frozen install is reproducible. Subsequent pushes to the production branch trigger a new build.

Alternatively, build locally and deploy with Wrangler:

```bash
pnpm build
npx wrangler pages deploy dist
```

The `_redirects` and `_headers` files are copied into `dist/` by Vite. Session statistics and rule preferences are saved in local browser storage; the current hand and review stay in memory. No Cloudflare Worker, environment variables, database, or secret key is required.

## Simple architecture

- `src/game.ts` — pure rules, auction, trump reveal, trick resolution, bot policy, scoring, bid records, and deterministic high-confidence coaching checks.
- `src/coach.ts` — visible-information insight engine: bid/trump/play recommendations, suit and unseen-card reading, and post-hand lessons.
- `src/ai/evaluator.ts` — sanitized belief states, unseen-deal sampling, move rollouts, and full-hand evaluation.
- `src/ai/evaluator.worker.ts` — background worker for expensive strategy calculations.
- `src/App.tsx` — match strip, felt table, pause bar, decision dock, stake panel, coach rail, review screen, settings, and browser-local stats.
- `src/styles.css` — club-table surface, decision-first layout, typography, and responsive rules.
- `PRODUCT.md` / `DESIGN.md` — durable product truth and the visual system for future work.
- `public/_redirects`, `public/_headers`, `wrangler.jsonc` — Cloudflare Pages SPA fallback, headers, and deploy configuration.

The evaluator is deliberately separated from the UI. The worker only receives the player's own hand, public tricks, and publicly inferable information; actual opponent hands and hidden trump are stripped before analysis.

## Validation note

The project installs and builds locally with pnpm 10.7.1 and Node 22.12+:

```bash
pnpm install
pnpm typecheck
pnpm build
```

The dev server is started with `pnpm dev`; the production bundle is written to `dist/`. Commit `pnpm-lock.yaml` so future installs and Cloudflare Pages builds are reproducible.
