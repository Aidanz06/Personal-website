---
name: aidan zheng
description: A personal site drawn as an ASCII koi pond at night, which you descend.
colors:
  night-water: "#0b100f"
  moonlit-ink: "#ece7dd"
  koi-orange: "#f0813a"
  pond-moss: "#243230"
  kohaku-red: "#d2451e"
  tancho-cream: "#f7efe2"
  drowned-grey: "color-mix(in srgb, #ece7dd 55%, #0b100f)"
  hairline: "color-mix(in srgb, #ece7dd 16%, #0b100f)"
  phosphor-ground: "#0a0714"
  phosphor-ink: "#cfe8c8"
  phosphor-green: "#6fe04a"
  phosphor-water: "#1e2733"
  phosphor-teal: "#3fd9c0"
  phosphor-lime: "#d4ee3c"
  paper-ground: "#ece6d8"
  paper-navy: "#15263f"
  paper-blue: "#2459ad"
  paper-water: "#cfc7b5"
  paper-sky: "#3a78c9"
  paper-deep: "#2159a8"
  paper-tail: "#15325f"
typography:
  display:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(2.5rem, 9vw, 3.5rem)"
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "Newsreader, Georgia, 'Times New Roman', serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.35
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: "0px"
spacing:
  "0.5": "4px"
  "1": "8px"
  "1.5": "12px"
  "2": "16px"
  "2.5": "20px"
  "3": "24px"
  "4": "32px"
  "5": "40px"
  "6": "48px"
components:
  stone-label:
    textColor: "{colors.moonlit-ink}"
    typography: "{typography.headline}"
  stone-label-active:
    textColor: "{colors.koi-orange}"
    typography: "{typography.headline}"
  stone-note:
    textColor: "{colors.drowned-grey}"
    typography: "{typography.label}"
  rock-number:
    textColor: "{colors.drowned-grey}"
    typography: "{typography.label}"
  rock-number-active:
    textColor: "{colors.koi-orange}"
    typography: "{typography.label}"
  text-link:
    textColor: "{colors.koi-orange}"
  text-control:
    textColor: "{colors.drowned-grey}"
    typography: "{typography.label}"
  caption-meta:
    textColor: "{colors.drowned-grey}"
    typography: "{typography.label}"
  caption-line:
    textColor: "{colors.moonlit-ink}"
    typography: "{typography.label}"
---

# Design System: aidan zheng

## Overview

**Creative North Star: "The Night Pond"**

The site is a dark, still pond seen from above, and you read it by looking
down into it. Everything lives in the water: the water itself, the ripples
you leave, one koi that swims alongside you, the stepping stones that lead
to the pages, and the photographs resting on the bottom as small rocks. All
of it is drawn as monospace characters on a single canvas, so nothing is
laid on top of the pond. Light draws the eye: the koi, a link, a picture
surfacing out of the characters. Everything else stays dark and quiet.

The feel is **crafted and playful, with calm underneath**. It's crafted
because every surface shows its making: the characters, the measured glyph
ramp, captions and controls set in monospace like instrument labels. It's
playful because of small rewards for attention: a koi that comes to the
stone you focus, rings breathing off the listening stone, album covers
rising as ASCII art, bubbles rising above the gallery. And
it's calm because motion is slow, most of the surface is empty water, and
nothing competes for attention. Going deeper means going more personal: the
name at the surface, then the navigation, then photographs and music in the
depths.

Two looks are confirmed rejections: **template portfolios** (hero, grid of project
cards, skills bars) and **boxes and cards** (rounded containers, drop
shadows, filled buttons, anything that sits on the pond like furniture).
Glossy treatments are **not** ruled out. They're an open experiment, to be
tried deliberately and in specific places.

**Key Characteristics:**
- One grid of character cells draws everything in the pond.
- Colour belongs to the living thing; everything else is monochrome.
- No containers: no radius, no shadows, no boxes. Hairlines only.
- Three typefaces, each with one job: serif for names, sans for prose, mono for machinery.
- Every control in the pond is real HTML over a decorative canvas.
- Slow, eased motion that stops completely under reduced motion.

## Colors

A near-black pond with one warm living colour. The site ships three themes,
and each fills the same set of colour slots, so no component knows which
theme is active.

### Primary
- **Koi Orange** (`koi-orange`): the koi's body and the site's only accent.
  It's used for links, the hovered or focused stone's label, and the number
  of an open photo rock. It's taken from the fish, not picked separately.

### Secondary
- **Kohaku Red** (`kohaku-red`): the koi's head, and the deep end of its
  gradient. It appears only on the fish.
- **Tancho Cream** (`tancho-cream`): the koi's tail and markings. It's also
  the bright end of the duotone that tints photographs into the pond's
  colours.

### Neutral
- **Night Water** (`night-water`): the ground, deep water with a faint green
  cast.
- **Moonlit Ink** (`moonlit-ink`): a warm off-white for body text, names and
  headings, and for an album cover kept as ASCII art.
- **Pond Moss** (`pond-moss`): the water's own characters. It's dim on
  purpose: texture, not content.
- **Drowned Grey** (`drowned-grey`): 55% ink mixed into the ground. Used for
  labels, captions, notes, controls, and the stones themselves.
- **Hairline** (`hairline`): 16% ink into the ground. The only line colour:
  rules, the footer's top edge, the theme swatch's frame.

### Themes
- **Koi** (default): the palette above.
- **Phosphor**: a CRT reading of the same pond. Violet-black ground
  (`phosphor-ground`), pale green ink, and a phosphor-green accent. The koi
  run teal → green → lime.
- **Paper**: sailcloth and blue. A warm off-white canvas ground
  (`paper-ground`, deliberately not bright), navy ink and a blue accent. The
  koi run sky → blue → navy tail. Muted text here is a 68% mix, not 55%,
  because a lighter ground leaves less room for grey to recede into.
  Photographs duotone from the navy tail up to the ground, like a cyanotype
  print.

### Named Rules
**The Living Colour Rule.** Colour belongs to living things. Water, stones,
rules and text stay monochrome; the koi's colours are the single exception,
and the accent is taken from the koi. Anything new that wants a colour has
to be alive or be a link.

**The Presence Rule.** The pond draws presence, the same way on every
ground: more of a thing means a denser glyph (`presenceRamp`). Quiet water is
nearly blank on paper exactly as it is at night. Pictures go into the field
as presence too, inverted on a light ground (`photoPresence`), so they stay
positive.

**The Theme Slot Rule.** A colour is never written into a component. Every
colour resolves through a `--t-*` slot, so a new theme is one CSS block, and
the pond canvas repaints from the same slots when the theme changes.

**The Contrast Floor Rule.** In every theme, body, muted and link text clear
4.5:1 against the ground, and every koi colour clears 3:1.
`lib/contrast.test.ts` parses the real stylesheet and enforces it, so a theme
that breaks this doesn't ship.

## Typography

**Display Font:** Newsreader (with Georgia)
**Body Font:** Inter (with system-ui)
**Label/Mono Font:** JetBrains Mono (with ui-monospace)

**Character:** A text serif for the few words that are names; a neutral
sans that gets out of the way of prose; and a metric-stable mono that
carries everything mechanical and draws the ASCII grid itself. Each family
has one job, and none of them is there to be noticed.

### Hierarchy
- **Display** (400, clamp(2.5rem, 9vw, 3.5rem), 1.05): the homepage greeting
  and each inner page's name. Once per page.
- **Headline** (400, 1.375rem, 1.35): stepping-stone labels, section heads
  in prose, and inner-page headings.
- **Body** (400, 1.0625rem, 1.6): prose on /about and /tailor-studio,
  within the 640px column.
- **Label** (400, 0.875rem, 1.5): mono. Stone notes, rock numbers, captions,
  slideshow controls, the theme glyph, and "on repeat · last 30 days".
- **Caption** (400, 0.75rem, 1.45): mono. The one genuinely subordinate
  line, such as the exposure under a photograph or "as of september 24".
  Never body copy.

### Named Rules
**The Machinery Is Mono Rule.** Anything that describes, numbers, controls
or labels is set in mono. Anything a person would say aloud (a name, a
heading, a sentence) is not.

**The Metric-Stable Rule.** The ASCII grid depends on every glyph having the
same advance width. Any replacement mono must be metric-stable, or the pond
tears.

Copy is currently all lowercase as an authoring convention, never through
`text-transform`. Whether that stays a rule is an open decision
(PRODUCT.md).

## Layout

A single reading column over a full-bleed pond.

- **The column:** 640px max width, centred, with a 20px side gutter
  (`column`). All text lives in it.
- **The breakout:** 960px, centred on the same axis, for slides only. Slides
  are pictures of text and stop being legible at 640.
- **Depth, not pages:** the homepage is one long descent. Positions are in
  viewport heights (`vh`), so the descent feels the same on any screen.
  Navigation stones step down by 0.56 of a screen, gallery rows by 0.383, and
  each group ends with 0.6 of a screen of empty water. Depths are derived
  from list position, never typed in.
- **Rhythm:** an 8px base unit (`--spacing: 8px`). Half steps are used; the
  20px gutter is `2.5`.
- **Responsive:** built at 375px first. The only breakpoint in regular use
  is 640px. An opened picture takes 88% of the width below 640, 72% up to
  1024, and 60% (capped at 640px) above.
- **Density:** sparse. Most of the surface is empty water, and that
  emptiness is most of why the pond reads as a pond.

## Elevation & Depth

Flat, with no shadows anywhere. Depth is literal: scroll position is depth
in the pond, and deeper content is more personal. Layering happens inside
the canvas's single field of cells, where brightness decides what shows. A
koi swims over a stone because it's brighter, not because of a z-index.
The only lifting is a picture surfacing: an opened photograph or cover rises
out of the characters and stays inside the water's vignette.

### Named Rules
**The One Grid Rule.** Everything in the pond writes brightness into one
field of character cells, drawn once through one density ramp. A new
element in the water is a new source writing into that field, not a second
renderer on top of it.

**The Surfacing Rule.** Nothing floats over the pond. Things come up out of
it: a picture resolves from its own characters, is tinted into the pond's
colours, and dissolves at its edges into the water.

## Shapes

No radius, anywhere (`rounded.none`). There are no boxes to round. The only
line is a 1px hairline in the rule colour, used for dividers, the footer's
top edge, and the frame around a theme swatch. Real shapes are organic and
drawn in characters: the round stones, the koi's body, the soft fade at a
picture's edge. A hard rectangle in the pond reads as a mistake. That's why
the ASCII covers and the gallery heading are feathered or distorted rather
than cut off square.

## Components

### Stepping Stone (navigation)
The site's navigation: a real link laid over a stone drawn in the canvas.
- **Shape:** a round character stone, sized to the smaller screen dimension
  and clamped between 92px and 240px across. The whole stone is the link.
- **Label:** below the stone, never on it (on the stone, the text lands on
  its brightest part and can't be read). The label is a headline in ink,
  with a mono note underneath in Drowned Grey.
- **Hover / Focus:** the stone brightens in the canvas, the label turns koi
  orange and underlined, and the koi swims over to it. Focus behaves exactly
  like hover, so the keyboard path feels intended.
- **Ringing:** a stone may give off a slow ripple every 1.8s, like a speaker
  cone. Only the listening stone does.

### Photo / Album Rock
A button, not a link: nothing navigates. The rock *is* the picture.
- **Shape:** a smaller round character stone. At least 52px across for a
  photo, 60px for an album; album size scales with play count.
- **Accessible name:** starts with the visible name, then the description
  ("qianling bridge: A stone arch bridge…"), so what a voice-control user
  sees is what they can say.
- **Label:** below it, in Drowned Grey, or koi orange while open. A photo
  rock's label is the name Aidan wrote for it (`captions.json` → `name`),
  as swaying Gallery Text; a rock with no name has no label. An album rock shows its rank (`01`–`05`). Hidden while its own
  picture is showing.
- **Order and groups:** photo rocks run newest first, so going deeper goes
  back in time, grouped by shoot: a place in a month, kept together within
  the month. Each group starts a new row under a marker in Gallery Text
  ("kamakura · may 2025", `undated`), which fades while a photo is open.
  Neighbouring single-photo shoots share one marker naming their places and
  span ("qianling, hawaii, kaua'i · 2025–2026"), so a lone photo never costs
  a marker and a row of its own. /about's grid uses the same order.
- **States:** hover or focus opens it, a click or tap pins it
  (`aria-pressed`), and a second click or tap closes it outright. Esc
  closes it on both pages. Opening takes about 2.5 seconds: characters
  first, then the picture handing over. While a picture is open, the
  stone labels and section heading fade out of its way.
- **Keyboard:** the photo gallery is one Tab stop. The arrow keys move
  between rocks (no wrapping), Home and End jump to the ends, and Tab
  returns to the rock last visited. While a rock has keyboard focus a mono
  hint sits at the bottom of the screen: "↑ ↓ between photographs · esc to
  close". A focused stone or rock scrolls in with a quarter-screen margin,
  and arrow moves centre it, so what it opens has room.
- **Caption:** mono, under the opened picture. Place and date in Drowned
  Grey, then a personal line in ink, then exposure in Caption size. Album
  captions are "title · artist". A blank field is left out, never shown as
  an empty bracket.

### The Pond Floor
Where the homepage ends: on the bottom of the page, 8vh above it, not
partway up the last screen. The contact link in body Small (email only,
in koi orange), then
"↑ back to the surface" in mono Drowned Grey. That is a plain `#surface`
link, so it works without JavaScript. With JavaScript it scrolls smoothly
back up through the water, instantly under reduced motion, and hands focus
to the greeting. The koi follows the reader down and back up.

### Surfacing Picture (signature)
How any image appears in the pond. A photograph resolves from coarse pond
characters into the real image, duotoned from Tancho Cream to the water's
colour and faded to transparent at every side, so it dissolves into the
water around it with no box: the characters under it step aside as it
arrives, and never leave a frame of dots. An album cover resolves into its own
finer ASCII art instead: 4px characters, a 16-step ramp measured from the
site's own mono font, contrast stretched per cover, drawn in ink with
feathered edges, drifting slowly. A cover last.fm has no art for opens as
its own title drawn in characters.

### Bubbles
Between the last navigation stone and the gallery, 0.45 of a screen of
extra water (`GALLERY_GAP_VH`) holds nine bubbles: `o`, `°` and `.` in mono,
in Drowned Grey, across the full width of the pond (not just the text
column), rising the height of the gap over 5–9 seconds each. Each
fades in, sways a few pixels at the midpoint, and "pops" at the top. The
positions come from a seeded sequence, so they're identical on every visit
and between server and browser. It's pure CSS (`.bubble`): it runs with
JavaScript off, is hidden under reduced motion, and is `aria-hidden`. It
tells the visitor the pond goes deeper, without an arrow or a word.

### Theme Control
A single mono glyph (◐) in Drowned Grey beside the name, with no border and
no box. It opens a list of themes, each with a two-square swatch (ground and
accent) framed in a hairline. It's hidden entirely when JavaScript is off,
because it couldn't do anything.

### Text Controls
Every other control is a word or a character in mono label size, Drowned
Grey: `← aidan zheng`, slideshow previous and next, the slide counter.
Disabled means 40% opacity. There are no button shapes. Each one carries
`hit-area`, an invisible layer that makes the tappable area at least 44×44
without changing what's drawn. The controls stay as small as the design
wants, and a finger can still hit them.

### Links
Koi orange, with a 1px underline offset 0.2em, thickening to 2px on hover
(120ms). Focus is a square 2px accent outline, offset 3px, on everything that can take focus.

### Gallery Text
The gallery's words, its heading, the year markers, and the name under each
rock, are regular text that sways slowly as if seen through the water
(`.water-wobble`: a 7s skew of ±1.4° and a 1px lift, each element on its own
phase).
- **Heading:** "photo gallery", a real `<h2>` in the headline serif, muted.
- **Year markers:** mono label size, muted, `aria-hidden` (each rock's name
  already carries its year).
- **Photo names:** mono label size under the rock, muted (or koi orange
  while open), capped at 9rem and centred so a long name wraps under its
  rock.

The sway is a transform, so the browser moves already-drawn text instead
of re-drawing it. That keeps it crisp and cheap on phones, and it's held
still under reduced motion. It replaced wavy ASCII art drawn through an
animated SVG filter, which cost a redraw of every visible label on every
frame.

## Do's and Don'ts

### Do:
- **Do** put new things in the water: a stone, a rock, something surfacing,
  drawn into the one character field.
- **Do** make every interactive element real HTML over the canvas (a link or
  a button) and keep the canvas `aria-hidden`.
- **Do** resolve every colour through a `--t-*` slot, and check new
  pairings against the 4.5:1 and 3:1 floors in all three themes.
- **Do** set labels, captions, numbers and controls in mono at label or
  caption size, in Drowned Grey.
- **Do** keep motion slow and eased (the page change is 480ms
  `cubic-bezier(0.2, 0.7, 0.3, 1)`; a picture takes about 2.5s to surface),
  and stop it entirely under `prefers-reduced-motion` without hiding
  content.
- **Do** design at 375px first. Nothing scrolls sideways, and tap targets
  stay at least 44px.
- **Do** feather, dissolve or distort edges in the pond rather than cutting
  them square.
- **Do** set reading text over the moving pond with `over-water`: a soft
  halo in the ground colour around every glyph, so the koi passing behind a
  paragraph can't break its letters. No box, and it works in every theme.
- **Do** let a picture have the stage: while one is open, every label near
  it (rock names or ranks, the year markers, the section heading) fades out
  of the way.

### Don't:
- **Don't** add cards, boxes, rounded corners, drop shadows or filled
  buttons. The site's argument is that it has no furniture.
- **Don't** build the template portfolio: hero, grid of project cards,
  skills bars, logo walls.
- **Don't** use colour on anything that isn't alive or a link.
- **Don't** add a second renderer or overlay that draws over the pond.
  Write into the field.
- **Don't** hit-test the canvas for interaction.
- **Don't** set body copy in mono, or use Caption size for anything a
  visitor must read.
- **Don't** apply glossy effects (glass, glow, gradient text) broadly. They're
  an open experiment: try one in a specific place, on purpose, and judge it
  there.
