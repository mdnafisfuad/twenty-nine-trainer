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

Preserve all game rules and evaluator behaviour. Optional royal-pair, seventh-card, reverse, double/redouble, and last-trick rules have settings switches; the coach can be turned off. The live tip is a hybrid: visible-card rule first, then the sampled model when it has a clear edge. On another seat's turn it becomes a non-actionable table read; the explanation of their card joins the coach history. Compare and deep-review sample sizes, plus the bot search budget and search toggle, are settings. Suit symbols are consistently red for hearts/diamonds and light for spades/clubs outside ivory card faces. Bots use sanitized determinized search with an exact double-dummy endgame; they never receive real hidden hands. Keep the visual identity: graphite-ink chrome, a green baize table, ivory cards, and brass fittings. Brass is a fitting, not a button fill; the primary action is ivory. No hidden information in the coach. Must hold at 320-1720px, 44px touch targets, readable body text, reduced motion.

## Direction contract

THESIS: The table is the interface. One decision, one obvious next action, with coaching attached to the decision instead of a dashboard of equal panels. It refuses the three-column sports-dashboard arrangement where score, contract, log, and progress compete with the hand.

OWN-WORLD: Graphite-ink chrome around a deep green baize table, ivory card stock, brass fittings reserved for the contract, trump, selection and the coach action; hairline rules and surface steps replace stacked cards. Newsreader for display, IBM Plex Sans for the interface, no uppercase tracked labels, tabular numerals for scores. Seats are dark place cards, not glass.

STORY: The player sees whose turn it is, what the table holds, and exactly which cards are legal; then bids or plays, opening the coach's evidence when wanted; then reviews the hand's decisions in the same vocabulary.

FIRST VIEWPORT: One compact top bar carries the brand, team score plaques, hand, a miniature contract card, dealer token, turn state, coach switch, guide, and settings. The felt table dominates beneath it with corner facts, an auction board or ghost trick slots, seat chips with card fans, and a bottom rail of table objects: a physical match-score card stack, contract meter, and face-down trump card (or a 2-card reverse indicator) that flips on reveal. The hand docks under the table with the bid/play action bar inside the same dock. A completed trick pauses above the dock with Continue; the same bar pauses a completed auction before trump is chosen. The right rail carries the coach, then table notes (visible-card reading plus recent play), then club record (session stats and ranking). At 390px the top bar wraps to two rows, the match ribbon becomes a 2×2 grid, the auction seats reflow into four compact cells, the fifteen-step ladder is hidden to protect the table, and controls stay 44px. The review is a dark ledger surface, never a white sheet.

FORM: Refinement of the established club-table world. The three-column dashboard collapses to table plus one context rail; score, contract, and round move into the top-bar match strip; the coach merges into the decision dock on phones and stays in the rail on wide screens; completed tricks pause for review.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.
