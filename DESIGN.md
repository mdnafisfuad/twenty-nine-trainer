---
name: Twenty-Nine Trainer
description: A local-first Twenty-Nine practice table with a fair-information coach.
colors:
  felt-deep: "#0b1310"
  felt: "#14231b"
  felt-raised: "#1b3323"
  panel-ink: "#101a15"
  line: "rgba(200, 222, 204, 0.15)"
  text: "#eef5ee"
  text-soft: "#a9bbad"
  lime: "#bff576"
  lime-ink: "#15220f"
  gold: "#eece90"
  signal-red: "#ff9691"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  heading:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 750
    lineHeight: 1.25
    letterSpacing: "-0.03em"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  small:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 850
    lineHeight: 1.3
    letterSpacing: "0.09em"
rounded:
  xs: "5px"
  sm: "9px"
  md: "14px"
  lg: "18px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "20px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "{colors.lime-ink}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.felt-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
    height: "44px"
  match-strip:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.text}"
    padding: "0 24px"
    height: "64px"
  decision-dock:
    backgroundColor: "{colors.felt}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "16px"
  seat-chip:
    backgroundColor: "#0e2317"
    textColor: "{colors.text}"
    rounded: "{rounded.sm}"
    padding: "9px 11px"
  playing-card:
    backgroundColor: "#fffefa"
    textColor: "#17211b"
    rounded: "{rounded.xs}"
    width: "64px"
    height: "90px"
  coach-tag:
    backgroundColor: "rgba(184, 243, 107, 0.07)"
    textColor: "{colors.lime}"
    rounded: "{rounded.xs}"
    padding: "4px 8px"
---

## Overview

**Creative North Star: "The club table, not the dashboard."**

The player came to play a hand, not to read a control panel. The table is the stage; the match strip is integrated into the top bar; the hand is a dock below it; the coach is evidence attached to the decision. Everything else is reference, kept quiet in one rail or folded below on a phone.

**Key Characteristics:**

- One filled lime element at a time: the action that is actually available.
- A deep green felt field with warm ivory cards and ink-coloured seat chips.
- A compact match strip in the top bar replaces sidebar score, contract, and progress cards.
- A single decision dock that owns the hand, the bid controls, and the phone coach.
- Plain-spoken coaching that names the visible cards behind every claim.

## Colors

The palette is restrained: one green world, one lime signal, and two status hues.

- **Deep Felt (#0b1310)** is the page field. It is almost black-green so the table can glow above it.
- **Felt (#14231b)** is the raised table, dock, and top-bar surface. **Felt Raised (#1b3323)** is hover and inset depth.
- **Lime (#bff576)** belongs to the primary action, the current-turn chip, and the coach's action line. It never decorates inactive states. On lime, use **Lime Ink (#15220f)**.
- **Text (#eef5ee)** is body and data. **Text Soft (#a9bbad)** is supporting copy and labels; both clear 4.5:1 on the felt.
- **Gold (#eece90)** marks warnings and opportunities. **Signal Red (#ff9691)** is reserved for errors and missed contracts.
- Card suits keep their own ink: deep red and near-black on ivory. Never use the card-face `.red`/`.black` pair on a dark surface; use the light suit ink instead.

**The One Signal Rule.** If more than one element on screen is filled lime, one of them is not an action.

## Typography

One humanist system sans carries the whole product. It is a tool, not a brand poster.

- **Display (2rem, 700, -0.04em)** is the decision headline only. Phone display drops to 1.55rem.
- **Heading (1.5rem, 750)** is the review headline and panel titles.
- **Body (1rem, 1.55)** is all coaching and review copy. Never ship body copy below 14px; supporting UI labels sit at 12–13px.
- **Label (0.75rem, 850, 0.09em, uppercase)** is reserved for data labels in the match strip, table facts, and rail section heads. It is not a decorative kicker above a heading.
- Use **tabular numerals** for scores, points, bid values, percentages, and trick counts.
- Measures stay under 70ch for coaching prose; the rail is naturally narrow.

**The Label Rule.** A label names a datum or a section. If it only announces the heading beneath it, delete it.

## Layout

Desktop is a two-zone app: a main table column and one 320px context rail. The old three-column dashboard is gone.

- **Match strip** is integrated into the top bar: team score plaques, hand, a miniature contract card, dealer token, and one turn-state chip. It is the only place match state lives.
- **Table column** is a 390-460px felt during play, a 400px felt during the auction and trump choice on phones, and a 420px felt on phones. The felt carries corner facts, an auction board, ghost trick slots, and a bottom rail of table objects: a physical match-score card stack, the contract meter, and a face-down trump card that flips when the suit is revealed.
- **Decision dock** follows the table: header (with Hint and Compare on the player's turn), hand, action bar. The coach is in the right rail on wide screens and flattens into the dock below the action on phones. A completed trick pauses above the dock with Continue and an optional pair declaration.
- **Right rail** carries coach, card reading, table events, session stats, and ranking as evenly padded cards. It is reference, never a second action surface.
- Breakpoints: 1180px collapses the rail below the table; 940px wraps the match strip under the brand; 820px stacks the dock; 680px compacts the side seats; 470px compacts the top bar and table seats.
- Touch targets are 44px minimum. The hand scrolls horizontally rather than shrinking below a readable card size.

**The Match-Strip Rule.** Match state lives in one horizontal strip. It never returns to a sidebar card.

## Elevation & Depth

Depth is etched, not floating. Panels use a one-pixel line, a slightly lighter felt fill, and a soft offset shadow only when they sit above the page (modal, dock). There is no decorative glass; seat chips are solid ink.

- Ambient: `0 18px 40px rgba(0, 0, 0, .18)` for the active dock.
- Modal: `0 22px 80px rgba(0, 0, 0, .45)`.
- Cards: a small offset shadow plus a hairline edge; cards lift 6–8px on hover, never scale.

**The Etched Rule.** A surface earns depth from its edge and fill, not from a blur.

## Shapes

Corners are soft but not pill-shaped except for status chips. Playing cards keep a tighter 8px radius so they read as cards, not buttons. Panels use 14–18px. The brand mark and suit glyphs carry the only sharp geometry.

## Components

- **Buttons.** Primary is filled lime with lime ink, 44px tall, 9–10px radius. Secondary is felt-raised with a hairline. Quiet is a lime-tinted outline. Disabled drops to 50% and never changes size.
- **Match strip.** Team score plaques, a hand tile, a miniature contract card, a dealer token, and a tinted turn-state chip; the available action owns the lime fill.
- **Table.** Felt with a grain layer, elliptical orbits, four solid seat chips (avatar, name, card fan, dealer/bidder tokens), played cards at the compass points, and a centred status block. The bottom rail is a three-row grid: label, physical object, caption. A card stack shows the match score on the left; the contract progress track sits in the middle; a face-down trump card (or a 2-card reverse indicator) sits on the right and flips on reveal. Empty chair space is part of the composition.
- **Decision dock.** Header with Hint/Compare on the player's turn, hand, action bar. On phones the coach is a flattened section below the action, separated by a rule, not a nested card.
- **Coach feed.** One advice card at a time, with previous/next arrows, a position counter, a Latest jump, and a LIVE marker. The history resets each hand.
- **Pause bar.** After every trick the four cards stay on the felt; a bar beneath names the winner, the points, and the Continue action. It can also offer the royal-pair declaration. The same bar pauses a completed auction before trump is chosen.
- **Stake panel.** Appears after trump is set when double/redouble is enabled. It explains the match-point swing and offers the side's one decision.
- **Settings.** Rule switches apply to the next hand; the coach switch applies immediately. The modal shows the current hand's rules beside the next hand's rules.
- **Coach.** A phase tag, a rule/hybrid/read confidence tag, a table-goal strip, an action-first title and summary, a one-sentence plan, the filled action line, short evidence bullets, and an optional sampled-model note. Every bullet names a card, count, or point total. When the sampled comparison is ready, the confidence tag reads hybrid and the action may follow the model; close disagreements keep the visible rule as the tie-break. On another seat's turn, the card becomes a non-actionable table read with a **Last Play** strip above it. Suit symbols are consistently red for hearts/diamonds and light for spades/clubs outside the ivory card faces.
- **Review.** Verdict and next action at the top, stat grid, coach notes, bid review, data-driven hand insights, trick timeline, then the full-width deep review.
- **Modal.** Used only for the guide and settings; Escape closes, the close button takes focus.

## Do's and Don'ts

- **Do** keep exactly one lime-filled action in view.
- **Do** put the hand and the bid/play controls before the coach on phones.
- **Do** pause on a completed trick until the player continues.
- **Do** name the visible card, count, or point total behind a coaching claim.
- **Do** keep touch targets at 44px and body copy at 16px.
- **Do** use tabular numerals for every score and percentage.
- **Don't** return to a three-column dashboard of equal panels.
- **Don't** auto-advance past a completed trick before the player has read it.
- **Don't** nest a card inside the decision dock; use a rule and spacing.
- **Don't** use decorative eyebrows above headings; labels name data.
- **Don't** use glass, gradient text, or suit colours from the card faces on dark surfaces.
- **Don't** animate width, height, or layout properties; use transform and opacity.
