---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# Surface: Practice table and hand review

## Scope and mode

Operate. The whole app: live table, auction, trump choice, trick play, and post-hand review. Desktop and mobile matter equally.

## Audience and job

Casual Twenty-Nine players practising alone. Job: read the table, make the correct bid or play quickly, and learn from the hand without leaving the session.

## Action and content

Primary action: the current legal decision (bid, choose trump, play a card). Supporting content: match score, contract, whose turn, points on the table, the coach's visible-card evidence, and the hand review. Session stats persist locally.

## Constraints

Preserve all game rules and evaluator behaviour. Optional royal-pair, seventh-card, reverse, double/redouble, and last-trick rules have settings switches; the coach can be turned off. The live tip is a hybrid: visible-card rule first, then the sampled model when it has a clear edge. On another seat's turn it becomes a non-actionable table read, with a Last Play explanation after the card. Compare and deep-review sample sizes, plus the bot search budget and search toggle, are settings. Suit symbols are consistently red for hearts/diamonds and light for spades/clubs outside ivory card faces. Bots use sanitized determinized search with an exact double-dummy endgame; they never receive real hidden hands. Keep the visual identity (dark green club-table, lime accent) confirmed in PRODUCT.md. No hidden information in the coach. Must hold at 320-1720px, 44px touch targets, 16px body text, reduced motion.

## Direction contract

THESIS: The table is the interface. One decision, one obvious next action, with coaching attached to the decision instead of a dashboard of equal panels. It refuses the three-column sports-dashboard arrangement where score, contract, log, and progress compete with the hand.

OWN-WORLD: Deep felt-green ground, warm ivory card stock, lime reserved for the actionable state, amber for warnings and red for errors; hairline rules and inset wells replace stacked cards. One humanist system sans, fixed 1.15 type steps, tabular numerals for scores. Seats are solid ink chips, not glass.

STORY: The player sees whose turn it is, what the table holds, and exactly which cards are legal; then bids or plays, opening the coach's evidence when wanted; then reviews the hand's decisions in the same vocabulary.

FIRST VIEWPORT: One compact top bar carries the brand, team score plaques, hand, a miniature contract card, dealer token, turn state, coach switch, guide, and settings. The felt table dominates beneath it with corner facts, an auction board or ghost trick slots, seat chips with card fans, and a bottom rail of table objects: a physical match-score card stack, contract meter, and face-down trump card (or a 2-card reverse indicator) that flips on reveal. The hand docks under the table with the bid/play action bar inside the same dock. A completed trick pauses above the dock with Continue; the same bar pauses a completed auction before trump is chosen. The right rail carries coach, card reading, table events, session stats, and ranking as padded cards. At 390px the top bar wraps to two rows, the auction board becomes 2×2, cards overlap slightly, and controls stay 44px.

FORM: Refinement of the established club-table world. The three-column dashboard collapses to table plus one context rail; score, contract, and round move into the top-bar match strip; the coach merges into the decision dock on phones and stays in the rail on wide screens; completed tricks pause for review.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
