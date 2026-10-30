---
name: Twenty-Nine Trainer
description: A local-first Twenty-Nine practice table with a fair-information coach.
colors:
  page: "#0d0f0d"
  surface: "#141714"
  surface-raised: "#1a1e1a"
  line: "rgba(233, 236, 227, 0.09)"
  text: "#e9ece3"
  text-soft: "#b8bfb4"
  text-muted: "#8c9489"
  brass: "#c7a86a"
  brass-soft: "#dfc99b"
  ivory: "#efe9da"
  felt: "#1c4f38"
  card: "#f5f0e3"
  card-red: "#a94040"
  card-ink: "#1c211b"
  positive: "#8fbf9a"
  negative: "#d67c74"
typography:
  display:
    fontFamily: "Newsreader Variable, Newsreader, Georgia, serif"
    fontSize: "2.75rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  interface:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  heading:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0"
  body:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  meta:
    fontFamily: "IBM Plex Sans Variable, IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ivory}"
    textColor: "{colors.card-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-soft}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
  table:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.md}"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: "16px"
  playing-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-ink}"
    rounded: "7px"
    width: "68px"
    height: "96px"
---

## Overview

**Creative North Star: "The quiet card room."**

The player came to a table, not a control panel. The chrome sits in graphite ink; the green baize is the one rich surface; the cards are ivory; the fittings are brass. The coach is a calm read beside the table, not a dashboard of advice tiles. Nothing glows, nothing competes with the hand.

**Key characteristics**

- One rich moment: the felt table, its double brass inlay, and the ivory cards.
- Quiet chrome: graphite surfaces, hairline rules, three text roles.
- One accent: brass for contract, trump, and the one live fitting. The primary action is ivory, not coloured.
- A printed-scorecard voice: Newsreader for the few display headlines, IBM Plex Sans for everything operational.
- Plain-spoken coaching that names the visible evidence behind every claim.

## Colours

The palette is deliberately narrow.

- **Page (#0d0f0d)** is the room. **Surface (#141714)** is a panel. **Surface Raised (#1a1e1a)** is an inset or hover. Borders are the text colour at 8–10%.
- **Felt (#1c4f38)** belongs to the table only. It may carry a same-hue vignette and a fine grain; it never tints the surrounding chrome.
- **Brass (#c7a86a)** marks the contract, the trump fitting, a selected chip, and the coach's action label. It is a fitting, not a button fill. **Brass Soft (#dfc99b)** is the lighter ink on dark.
- **Ivory (#efe9da)** is the card stock and the primary button fill. Text on ivory is **Card Ink (#1c211b)**.
- **Text (#e9ece3)**, **Text Soft (#b8bfb4)** and **Text Muted (#8c9489)** are the only text roles. **Quiet (#7d877c)** is for captions and counts.
- **Positive (#8fbf9a)** and **Negative (#d67c74)** carry meaning only. They are never used as decoration.
- Suit ink is consistent: hearts and diamonds are red; spades and clubs are near-black on ivory and light on dark. Use the light suit ink outside card faces. The score-card pip follows the same rule.

**The Brass Rule.** If brass is on more than a few fittings, it has become a theme colour. Put it back on the contract, the trump plaque, and the coach's action.

## Typography

Two families, both carrying real work.

- **Newsreader** is the display face: the brand wordmark, the post-hand verdict, and modal titles. It is never used for labels or controls.
- **IBM Plex Sans** is the interface face. Its slightly technical tone suits a game of counts and contracts.
- Weights are 400 and 500; 600 is reserved for card indices and small tokens. No 700–900.
- Sizes: 44px verdict, 30px modal title, 22px wordmark, 19px table title, 15–16px panel title, 13px body, 11–12px meta, 10–11px table fittings and card indices.
- No uppercase labels with wide tracking. No negative tracking below 24px. No italic for emphasis.
- Tabular numerals for scores, points, bids, percentages, and trick counts.

## Layout

Desktop is a two-zone app: a fluid table column and a 296px context rail, inside a 1440px frame.

- **Match ribbon** is one horizontal bar in the top bar: score, hand, miniature contract card, dealer, turn state. Cells are divided by hairlines, not six separate cards.
- **Table column.** A charcoal frame holds the felt. During the auction and trump choice the felt is 430px tall; during play it is 470–560px. Corner facts, auction board, seat place cards, compass-point played cards, and a bottom row of table objects: card-stack scoreboard, contract meter, trump plaque.
- **Decision dock** follows the table: header, hand, action bar. Hint and Compare sit in the header on the player's turn. A completed trick or auction pauses above the dock with Continue.
- **Right rail.** Coach first; then **Table notes** (visible-card reading plus the last few events); then **Club record** (session stats and ranking). During review the coach gives way to the score slip; the notes and record remain reference.
- **Review.** A dark ledger surface, not a white sheet. Serif verdict, four-stat line, coach review and trick timeline, then the full-width deep review.
- Breakpoints: 1180px collapses the rail below the table; 1100px hides the dealer tile; 900px wraps the match ribbon under the brand and hides the table centre once cards are down; 760px stacks the review; 620px compacts the table and turns the match ribbon into a 2×2 grid; 420px tightens seats, cards, and stats.
- Touch targets are 44px on phones. The hand wraps rather than shrinking below a readable card size.

**The One-Table Rule.** The felt is the only large saturated surface. Panels, modals, and the review stay in the graphite ramp.

## Depth and motion

Depth comes from surface steps and hairlines. Cards and modals may carry a soft neutral shadow; nothing gets a coloured glow.

- Card hover lifts 4px; press settles 1px and scales 0.99.
- One easing curve: `cubic-bezier(0.22, 1, 0.36, 1)`.
- 120–180ms for hover and press; 300–500ms for entrances.
- Motion explains state: a trump flip, a trick announcement, a thinking pulse. No looping decoration.
- Respect `prefers-reduced-motion`.

## Components

- **Buttons.** Primary is ivory with card ink, 40px tall (44px on phones), 8px radius. Secondary is raised surface with a hairline. Quiet is transparent. No neon fills.
- **Match ribbon.** Score, hand, contract mini-card, dealer token, turn state; divided by hairlines in one rounded bar.
- **Table.** Green baize with a fine grain and a double brass inset line. Four dark place cards for the other seats; the human's hand is the dock. Played cards sit at the compass points. Empty slots are dashed hairlines, not buttons.
- **Table objects.** A physical card stack for the match score; a 3px brass contract meter; a face-down trump card that flips when revealed, with a 2-card reverse indicator.
- **Coach feed.** One read at a time with previous/next, position counter, Latest, and Live. A read has a phase tag and source, a goal line, a title, a summary, an optional action, a plan line, at most two evidence bullets, and a quiet model note. The history is grouped by turn; rule and hybrid updates replace each other instead of stacking.
- **Off-turn reads.** While an opponent or partner acts, the coach stops giving card advice and reads the public table: contract count, known voids, likely plan. The last-play explanation joins the history; there is no separate live box.
- **Pause bar.** Names the winner and points, offers Continue and the optional pair declaration. The same bar pauses a completed auction.
- **Stake panel.** A quiet panel that explains the match-point swing and offers one decision.
- **Review.** Dark ledger with a serif verdict; stats, coach review, trick timeline, deep review. Ivory cards are the only bright objects.
- **Settings and guide.** Dark modal, serif title, sentence-case group labels, hairline rows, brass toggles. No uppercase eyebrows.

## Do and don't

- **Do** keep the felt as the only saturated surface.
- **Do** use brass for contract, trump, selection, and the coach's action label; do not fill buttons with it.
- **Do** put the hand and bid/play controls before the coach on phones.
- **Do** pause on a completed trick until the player continues.
- **Do** name the visible card, count, or point total behind a coaching claim.
- **Do** keep suit ink consistent: red hearts/diamonds, light black suits on dark.
- **Do** keep touch targets at 44px and preserve a readable card size.
- **Do** use tabular numerals for every score and percentage.
- **Don't** use lime, neon, glows, gradient text, or colour-tinted chrome.
- **Don't** use 800+ weights, uppercase tracked labels, or tiny 8px text.
- **Don't** return to a three-column dashboard of equal panels.
- **Don't** turn the review into a white sheet inside the dark room.
- **Don't** add a separate live Last Play box; use the coach history.
- **Don't** animate width, height, or layout properties; use transform and opacity.
