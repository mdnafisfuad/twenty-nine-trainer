# Twenty-Nine Trainer

A local-first Twenty-Nine practice game built with React, TypeScript, Vite, Tailwind CSS, and Lucide icons. It runs entirely in the browser with no backend, account, or AI API key.

## Features

- Human player plus three bot players in two fixed partnerships.
- Four-card opening deal, bidding, trump selection, second deal, hidden trump, follow-suit rules, eight tricks, and match scoring.
- Tactically biased bots that make decisions from their own hand and public game state.
- Rule-based post-hand feedback for clear tactical opportunities.
- **Monte Carlo move evaluator:** compare every legal card against 64 sampled unseen deals on your turn.
- **Automatic full-hand deep review:** after each hand, re-evaluate each recorded decision across sampled deals, show the model's alternative, and estimate how it changes the chance of achieving your team's objective. The review can be run again on demand.
- Sampling respects seen cards, known void suits, and public remaining-card counts. The worker receives a sanitized snapshot without opponents' hands or a hidden trump suit.
- Web Worker keeps simulations off the main UI thread.
- Interactive trick timeline, contextual hints, local session statistics, and responsive phone/tablet/desktop layouts.
- Static output deployable to Cloudflare Pages.

## Strategy evaluator: what it does

The evaluator does not just rank cards with fixed rules. It samples plausible hidden deals that fit the cards already played, each player's remaining card count, and suits players have shown they are void in. Every candidate legal move is rolled out using the same set of sampled deals, so comparisons are less noisy. Each rollout uses the current bot policy for the rest of the hand.

The result shows:

- Estimated chance your team achieves its objective. If your team bid, that means making the contract; if defending, that means defeating the contract.
- Estimated contract success rate and expected point margin.
- Sampling error, the number of sampled deals, and whether hidden trump was approximated.
- Alternative moves at post-hand review.

**Limits:** this is a teaching approximation, not a perfect solver. It uses the current bot policy for hypothetical continuation, and the unknown trump suit is modelled from plausible opening four-card hands when it is hidden. The percentages are estimates and should be interpreted with the sample count and uncertainty. More samples improve stability but take longer. The evaluator intentionally does not inspect the actual unseen hands when constructing scenarios.

## Rules used in this starter

This is a simplified classic auction variant for practice. Card order is **J > 9 > A > 10 > K > Q > 8 > 7**. Jacks are worth 3 points, nines 2, aces and tens 1, and other cards 0. The usual minimum bid is 16. The default hand has 28 card points; an optional +1 last-trick bonus can be enabled for the next hand. Trump is hidden until a player cannot follow suit, then applies from that trick onward.

Pair/Royals, seventh-card trump, double/redouble, single-hand declarations, and the Bangladesh-specific bidding sequence are not implemented yet.

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

1. Push this project to a Git repository.
2. In Cloudflare, open **Workers & Pages → Create application → Pages → Import an existing Git repository**.
3. Select the repository and set `SKIP_DEPENDENCY_INSTALL=1` in the Pages environment variables. This tells Pages to skip its automatic package install so the build command can install with pnpm explicitly.
4. Use these build settings for the first deployment:
   - **Framework preset:** React (Vite) or None
   - **Build command:** `corepack pnpm install --no-frozen-lockfile && corepack pnpm build`
   - **Build output directory:** `dist`
   - **Node.js version:** 22.16.0 or newer in the Node 22 line
5. After running `pnpm install` locally, commit the generated `pnpm-lock.yaml`. Once it is in the repository, change the Pages build command to `corepack pnpm install --frozen-lockfile && corepack pnpm build` for reproducible deployments. Subsequent pushes to the production branch trigger a new build.

The `public/_redirects` file supports single-page-app routing. Session statistics are saved in local browser storage; the current hand and review stay in memory. No Cloudflare Worker, environment variables, database, or secret key is required.

## Simple architecture

- `src/game.ts` — pure rules, auction, trump reveal, trick resolution, bot policy, scoring, and deterministic high-confidence coaching checks.
- `src/ai/evaluator.ts` — sanitized belief states, unseen-deal sampling, move rollouts, and full-hand evaluation.
- `src/ai/evaluator.worker.ts` — background worker for expensive strategy calculations.
- `src/App.tsx` — game screen, review screen, settings, move comparison, and browser-local stats.
- `src/styles.css` — table styling, analysis panels, and responsive layouts.

The evaluator is deliberately separated from the UI. The worker only receives the player's own hand, public tricks, and publicly inferable information; actual opponent hands and hidden trump are stripped before analysis.

## Validation note

The initial game engine had been exercised with complete bot-only simulations before this evaluator upgrade. In this environment, package-registry access is unavailable, so the pnpm install, dependency lockfile generation, and final Vite production build could not be completed here. Run `pnpm install` and `pnpm build` locally or in Cloudflare's build environment to verify the final bundle.
