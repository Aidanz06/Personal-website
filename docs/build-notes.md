# build notes

Plain-English notes on how this site is put together, written so it can be
explained out loud in an interview. One section per milestone.

---

## milestone 1 — scaffold and design system

### what got built

An empty but fully wired Next.js 16 project: TypeScript in strict mode,
Tailwind CSS v4, MDX support, Vitest, and the design tokens from the spec
encoded in one place. No real content yet — that's milestone 2.

Files worth knowing:

| file | what it does |
|---|---|
| `app/globals.css` | **The design system.** Every color, font, and spacing value lives here. |
| `app/fonts.ts` | Which three typefaces the site uses, and how to swap them. |
| `app/layout.tsx` | The HTML shell every page renders inside. |
| `mdx-components.tsx` | How MDX prose gets styled. |
| `lib/site.ts` | Strings used on more than one page (name, identity line, contact links). |
| `next.config.ts` | Turns on MDX. |

### key decisions

**Tailwind v4 has no config file, and that's the good news.** In Tailwind v3
you kept a `tailwind.config.js` in JavaScript, separate from your CSS. In v4
the theme is declared in the stylesheet itself, in an `@theme` block. The
practical effect is that a token like `--color-ground: #fafaf8` becomes two
things at once: a real CSS variable you can reference anywhere, and a set of
utility classes (`bg-ground`, `text-ground`). One declaration, no duplication,
and no second file that can drift out of sync.

**The 8px base unit is literal, not a convention.** Tailwind's spacing scale
normally counts in 4px steps, so `p-4` means 16px and you're doing mental
arithmetic constantly. Overriding `--spacing: 8px` rebases the whole scale:
`p-1` is now exactly one 8px unit, `p-2` is two, and so on. A useful side
effect is that the 20px mobile gutter the spec asks for is `px-2.5` — it
falls on the scale instead of needing a hardcoded exception.

**Muted text is derived, not hardcoded.** Instead of writing down a grey hex
code, the token mixes the near-black ink into the off-white ground by a
percentage: `color-mix(in srgb, var(--color-ink) 55%, var(--color-ground))`.
If the ground color ever changes, the muted grey follows it automatically
rather than quietly becoming wrong. The mix percentage is itself a variable
(`--muted-mix`) so it's one number to adjust.

**There is exactly one layout primitive.** A custom `column` utility holds the
640px max width, the centering, and the 20px side gutter. Pages just write
`className="column"`. No page has to remember the numbers, so no page can get
them wrong.

**Fonts are self-hosted, despite coming from Google.** `next/font/google`
downloads the font files at build time and serves them from this site's own
domain. Nothing reaches Google when a visitor loads the page — no third-party
request, no privacy question, and no render-blocking stylesheet. It also
generates the fallback metrics that stop text from jumping when the webfont
finishes loading, which protects the layout-shift budget in the PRD.

**MDX is wired through `@next/mdx`.** The three inner pages will be `.mdx`
files that *are* the routes — write prose in a file, it becomes a page. The
main alternative, `next-mdx-remote`, exists to render MDX that arrives at
runtime from a CMS or a database; since this content lives in the repo, it
would add a compile-and-serialize step to solve a problem the site doesn't
have. `@next/mdx` compiles at build time, which keeps every page static.

### the typeface pairing

Default is **Newsreader** (serif, for the name and headings), **Inter** (sans,
for body text), and **JetBrains Mono** (for the ASCII grid and small labels).

Newsreader is a *text* serif rather than a display serif, which matters
because the same face has to work at 56px for the name and at 22px for
headings; display serifs get spindly when you shrink them. JetBrains Mono was
chosen specifically because it's metric-stable — every character occupies an
identical advance width, which the ASCII renderer depends on to keep its grid
aligned.

Two alternates are written into `app/fonts.ts` as comments and are drop-in
replacements: Instrument Serif / Geist / Geist Mono for something sharper and
more editorial, or Source Serif 4 / IBM Plex for something warmer.

### non-obvious things

**The font variables are named `--ff-display`, not `--font-display`.** Tailwind
v4 claims the `--font-*` namespace for its own font utilities. If `next/font`
also wrote to `--font-display`, the token would resolve to
`var(--font-display)` pointing at itself — an infinite loop that silently
produces no font at all. The `--ff-` prefix keeps the two apart.

**Nothing uses CSS `text-transform: lowercase`.** The lowercase register is
authored by hand in the content. A transform would wreck proper nouns that are
supposed to stay capitalized (Northeastern, Grailed, Boston), it would fight
the resume page which follows normal resume casing, and screen readers handle
transformed text inconsistently.

**`passWithNoTests` is on, for now.** There's no pure logic in the codebase
until the ASCII renderer arrives, so `npm test` would otherwise fail on an
empty project.

### open flag: muted text fails contrast

The spec sets muted text at 55% of the text color. Measured against the
off-white ground that's **3.84:1**, and the PRD requires **4.5:1** minimum
(plus a Lighthouse accessibility score of 95+, which checks exactly this).

**60% is the first value that passes**, at 4.54:1.

It's built at the specified 55% for now and marked in `globals.css`. Changing
`--muted-mix` from `55%` to `60%` fixes it everywhere at once. This is Aidan's
call — the tradeoff is a slightly less recessive grey versus an accessibility
criterion the PRD already committed to.

### also placeholder

`--color-accent` is a neutral slate (`#4a4f57`, 7.89:1 on the ground), used
for links and nothing else. It's a stand-in for the real accent color, which
is still an open question in the PRD. It's one line in `globals.css`; whatever
replaces it needs to clear 4.5:1 against `#FAFAF8`.

---

## milestone 2 — routes and layout

### what got built

All four routes, rendering real structure with every unwritten piece marked
as a visible bracketed placeholder. All four are statically generated — the
build output labels each one `○ (Static)`, meaning the HTML is produced once
at build time and no server runs when someone visits.

| route | file | built as |
|---|---|---|
| `/` | `app/page.tsx` | React component |
| `/tailor-studio` | `app/(page)/tailor-studio/page.mdx` | MDX |
| `/about` | `app/(page)/about/page.mdx` | MDX |
| `/resume` | `app/(page)/resume/page.mdx` | MDX |

### key decisions

**The folder named `(page)` doesn't appear in any URL.** Parentheses around a
folder name make it a *route group* in the App Router: it groups files so
they can share a layout, without becoming a path segment. So the three inner
pages live together and share one layout file, but the URLs stay flat —
`/about`, not `/page/about`. This matters because the PRD commits to URL
stability; those paths get pasted into applications that sit in inboxes for
months.

The homepage sits outside the group because it's the one page with no back
link and a different vertical rhythm.

**An `.mdx` file *is* the page.** There's no loader, no `getStaticProps`, no
parsing step to read. Writing prose in `app/(page)/about/page.mdx` produces
`/about`. Those files contain no styling and no markup — just headings and
paragraphs — because all the styling is applied centrally in
`mdx-components.tsx`. That's the file that says "an `h2` in any MDX file
renders in the serif at 22px." Editing content never means touching React.

**Page titles come from the MDX file itself.** Each `.mdx` exports a
`metadata` object, same as a `.tsx` page would. The root layout defines a
template — `%s — aidan zheng` — so `/about` becomes "about — aidan zheng"
automatically. The homepage opts out of the template using `title.absolute`,
or it would read "aidan zheng — aidan zheng".

**Placeholder links have no `href`.** Contact entries in `lib/site.ts` carry
`href: null` until the real destination exists, and the footer renders those
as plain muted text instead of as anchors. A placeholder string inside an
`href` would produce a real, clickable link that silently navigates somewhere
wrong — worse than an obviously missing one.

**The header slot's height is committed now, before the renderer exists.**
`components/HeaderSlot.tsx` reserves the exact space `<AsciiImage>` will
occupy in milestone 3. Because the space is already allocated, the renderer
can't push the page around when it arrives — that's the Cumulative Layout
Shift budget in the PRD protected by construction rather than by testing for
it afterwards.

### the 375px fold requirement, measured

This was the one hard requirement in the milestone, so it's worth explaining
how it was met and how it was checked.

The PRD proposes a 400–500px ASCII header. On an iPhone SE, which is 667px
tall and shows roughly 554px of that once Safari's toolbars are accounted
for, a 460px header consumes the entire screen by itself — the name wouldn't
fit, let alone the availability line.

So the header height is **fluid, not fixed**:

```css
--header-height: clamp(150px, 28vh, 460px);
```

`clamp` takes a minimum, a preferred value, and a maximum. The preferred
value is 28% of the viewport height, so the header scales with the screen; it
never shrinks below 150px and never grows past 460px. Small phone gets a
187px header, desktop gets the full 460px the PRD asked for.

**Verified with real measurements, not arithmetic.** Chrome was driven
through the DevTools Protocol at emulated mobile viewports — Node 25 ships a
native WebSocket, so this needed no new dependency and nothing was added to
the project:

| viewport | header | availability line bottom | visible in Safari | headroom |
|---|---|---|---|---|
| 375 × 667 | 187px | 401px | ~554px | **152px** |
| 375 × 600 | 168px | 383px | ~498px | **115px** |

Both pass, and with margin — while displaying a placeholder that wraps to two
lines. The real availability line will almost certainly be shorter.

Horizontal scroll was checked on all four routes by comparing the document's
`scrollWidth` against its `clientWidth` and listing every element whose
bounding box crosses the viewport edge. **Zero overflowing elements on every
route.**

### non-obvious things

**A screenshot lied, and measuring caught it.** The first check used Chrome's
plain `--screenshot` flag with `--window-size=375,667
--force-device-scale-factor=2`. The resulting image appeared to show text
spilling past the right gutter — an apparent layout bug. Measuring the actual
DOM showed the padding was a correct 20px on both sides and nothing
overflowed at all; the flag combination had rendered at a different CSS
viewport than the one requested. Re-capturing through the DevTools Protocol,
where the page's own `innerWidth` can be read back and confirmed as 375,
produced a correct image.

The lesson worth keeping: for a layout requirement, assert against measured
numbers from the DOM, not against how a screenshot looks.

**The photo grid has visible outlines, and they're temporary.** Twelve empty
slots on `/about` are drawn with hairline borders purely so the placeholder
is visible. Real photographs fill those cells edge to edge and the borders
come off — the "no boxes, no cards" rule stays intact. The grid is also *not*
wired to the ASCII renderer; that's explicitly deferred, though the renderer
is being built so tiles like these can use it later.

**There is no nav bar anywhere.** The homepage carries its three links
inline, and every other page carries exactly one small link back. A
persistent header would compete with the ASCII header for attention and add
furniture to a design whose entire argument is that it has none.

**One attribute exists only for testing.** The availability line carries
`data-availability` so the fold measurement can find it reliably instead of
depending on something brittle like "the second paragraph."

---

## milestone 3 — the ascii renderer

### what got built

`<AsciiImage>` — one client component that renders a photograph as a grid of
monospace characters, with the area near the pointer resolving back into the
real photo. Plus `/lab`, a dev-only page with live sliders for tuning it.

No dependencies were added. The whole thing is canvas and arithmetic.

| file | what it does |
|---|---|
| `components/AsciiImage.tsx` | The component. The only file that touches a canvas. |
| `lib/ascii/luminance.ts` | How bright is this pixel? |
| `lib/ascii/ramp.ts` | Which character represents that brightness? |
| `lib/ascii/grid.ts` | How many cells fit, and which ones can the pointer reach? |
| `lib/ascii/blend.ts` | How much photo shows through at this distance? |
| `lib/ascii/degrade.ts` | Should the grid get coarser because the page is slow? |
| `lib/ascii/mode.ts` | Which of the four render modes applies? |
| `lib/ascii/loop.ts` | One animation loop and one pointer listener for the whole page. |
| `app/lab/` | The tuning bench. 404s in production. |

Everything except the component and the loop is a pure function — given the
same input it returns the same output and touches nothing else. That is what
makes the logic testable without a browser, and it is where all 67 unit tests
point.

### the core idea: three layers, two of them never change

The naive way to draw this is to loop over every cell each frame, work out
how close it is to the pointer, and draw either a character or a piece of the
photo. At the default settings the header is about 3,600 cells, and drawing
3,600 pieces of text 60 times a second is roughly 216,000 text operations per
second. That does not hold 60fps.

The way out is noticing that **almost nothing actually changes between
frames**. The characters are fixed for a given image at a given size — the
photo is not moving. Only the pointer moves. So:

1. **The character layer** is drawn once, off-screen: fill with the off-white
   ground, then draw every character in position. This is the expensive step,
   and it happens once per image per size, not once per frame.
2. **The photo layer** is drawn once, off-screen, cropped to the box.
3. **Each frame** does three things: stamp down the character layer, punch
   soft holes in it near the pointer, and slide the photo in behind so it
   shows through the holes.

Punching holes uses a canvas feature called composite operations —
`destination-out` erases what is already on the canvas instead of drawing
over it, and `destination-over` draws *behind* rather than in front. Erasing
a cell at 50% and then putting the photo behind it gives exactly a 50%
crossfade, for free, with no per-pixel maths.

Only cells within the outer radius of the pointer can possibly need a hole,
so the loop walks a window around the pointer rather than the whole grid —
about 1,200 cells instead of 3,600, and that number stays flat as the header
gets bigger.

**Measured cost: zero.** Frame times with the effect running flat out were
identical to frame times with it idle (33.3ms median in both cases — that
number is the test browser's own ceiling, not the renderer's). The renderer
is not the bottleneck on anything.

### the direction of the ramp is the whole trick

The ramp is `.:-=+*#%@`, sparse to dense. The mapping has to be **inverted**:
a dark part of the photograph gets a dense character like `@`, and a bright
part gets a sparse one like `.`.

The reason is that the page is dark ink on a light ground, so a character's
density controls how dark the cell reads. `@` deposits a lot of ink; `.`
leaves the ground mostly showing. Map it the intuitive way round and you get
a photographic negative. There is a unit test asserting specifically that
black maps to `@` and white maps to `.`, because it is the kind of thing that
looks plausible while being backwards.

To flip it for a light-on-dark design, reverse the ramp string. Don't change
the function.

### the four modes

The component picks one at mount, from what the browser can actually do:

| condition | mode | behaviour |
|---|---|---|
| mouse or trackpad | `pointer` | resolve follows the cursor |
| touch / no hover | `drift` | resolve point wanders on its own |
| `prefers-reduced-motion` | `static` | the plain photo, no canvas, no movement |
| no canvas support | `static` | the plain photo |

The important structural decision: the `<img>` is **real, server-rendered,
and always there**, with proper alt text. The canvas is laid over it and only
appears once it has successfully painted. So if JavaScript never runs, fails,
or is switched off, the photograph is simply what's on the page — the
fallback isn't a special case, it's the starting state. The canvas is marked
`aria-hidden` because everything it conveys is already in the img's alt text.

For reduced motion, "render fully resolved and static" is satisfied by doing
nothing at all: the fully resolved version of the image *is* the photograph,
so leaving the untouched `<img>` in place is exactly right and moves nothing.

All four were verified in a real browser:

| mode | result |
|---|---|
| pointer | 354,514 pixels change under the cursor; 154,096 mid-ease; **0 after the ease** — returns to pixel-identical abstract |
| drift | canvas changes continuously with no input at all |
| reduced motion | canvas opacity 0, `<img>` visible, alt text intact |
| JS disabled | `<img>`, alt text, and the availability line all present in the served HTML |

### one shared loop, not one per instance

There is a single `requestAnimationFrame` loop and a single `pointermove`
listener for the entire page, in `lib/ascii/loop.ts`. Instances subscribe to
it. This matters for v1, where the photography grid will put 12–20 instances
on one page: separate loops would mean 20 callbacks the browser can't
coalesce, and instances visibly drifting out of step with each other.

The pointer position is **written** on move and **read** on the frame. A
high-polling-rate mouse fires move events far more often than the screen
refreshes, so doing the work inside the move handler would mean drawing
several times per displayed frame and throwing most of it away.

Instances also unsubscribe entirely when scrolled out of view
(`IntersectionObserver`), and the loop stops itself when the last subscriber
leaves or the tab is hidden.

### things that surprised me

**A floating-point bug in the luminance function.** The Rec. 709 weights
(0.2126, 0.7152, 0.0722) sum to 1 on paper but not in floating point, so pure
white came out as 0.9999999999999999 instead of 1. Nothing visible depended
on it — 8-bit colour channels are 1/255 apart, four orders of magnitude
coarser — but the function promises a 0–1 range and callers should be able to
hit both ends. Caught by the test, fixed by snapping the endpoints.

**The frame-rate safety net was itself the bug.** The spec says to coarsen
the grid if the frame rate drops below 30fps. I implemented that literally,
and it was wrong in two ways that only showed up under measurement. 30fps is
the floor of *acceptable* — a display sitting exactly on it is meeting the
requirement, not failing it. And because a smoothed frame-rate estimate
hovering around 30 dips below it constantly, and because degradation is
one-way with nothing to restore the finer grid, a 30Hz display would ratchet
itself down to the coarsest possible rendering over a few minutes, for no
reason.

The fix was to trigger at 26fps rather than 30, giving the estimate room to
wobble without tripping. The decision was also pulled out of the component
into `lib/ascii/degrade.ts` so it could be tested: there is now a test that
runs 600 frames at exactly 30fps and asserts the grid never coarsens, and
another that jitters either side of 30 and asserts the same. Both failed
before the fix.

**Verifying it was harder than building it.** The browser used for automated
checks throttles `requestAnimationFrame` when nothing is forcing it to
redraw, so the animation would intermittently just… not run between
measurements, producing test failures that looked exactly like real bugs. I
chased two of these before recognising the pattern. The resolution was to
force the browser to produce frames during the measurement window; results
then became byte-for-byte reproducible across runs.

Worth writing down because the same trap catches real people: **an animation
test that doesn't guarantee frames are being produced is testing the test
harness, not the code.**

### tradeoffs made

**Per-cell blending rather than a smooth gradient.** Each character cell
crossfades as a whole unit, which means the transition zone has a visible
rectangular texture — you can see the cells. A continuous radial gradient
would be smoother and slightly cheaper, but it cuts through glyphs
mid-character and reads as a soft vignette over ASCII rather than as
characters resolving into a picture. The spec asked for per-cell, and
per-cell is the more honest version of the effect. It is also the main thing
to look at and form an opinion on.

**Cells are stretched to tile the box exactly.** A 640px box at cellSize 9
gives 71 columns of 9.014px rather than 71 columns of 9px plus a 1px strip of
bare ground at the edge. The requested cellSize is a target, not a promise.

**Degradation is one-way.** Once the grid coarsens it does not go back, even
if the page speeds up again. Restoring it risks oscillating between two
qualities, which is more distracting than a slightly coarse grid.

**The device pixel ratio is capped at 2.** Beyond that the cost rises
quadratically for a difference nobody can see on a photograph.

### how to run the lab

```
npm run dev
```

then open **http://localhost:3000/lab**

Every image in `public/lab/` gets its own panel with live sliders for
cellSize, cellAspect, innerRadius, outerRadius and exitEaseMs, a text field
for the ramp, and preset ramps (coarse / fine / blocks / reversed). If the
frame-rate safety net fires, the panel says so and shows the new cell size.

The route calls `notFound()` when built for production, so it ships as a 404.
Verified: `/lab` returns 404 from the production server and none of the lab
markup appears in the response.

### the source image

`public/lab/` was empty, so `scripts/generate-test-image.mjs` writes a
synthetic one: a lit sphere over a receding checkerboard with a
black-to-white step wedge down the side. It exercises smooth gradients, hard
edges and known flat tones at once, which makes it obvious whether the ramp
is mapping light and dark the right way round. It writes a PNG by hand using
only `node:zlib` — no image dependency.

**It is a test pattern, not a photograph.** Three real candidates still need
to go in `public/lab/` before the actual question can be answered.

The same file is currently sitting in the homepage header as
`public/header-placeholder.png`, with a bracketed caption saying so.

---

## milestone 4 — dark design system and swappable themes

### what changed and why

The site pivoted: the homepage is becoming an ASCII koi pond, and the
reference for it is luminous characters on a near-black ground. That inverts
the original design — off-white ground, near-black ink — and because the pond
also sits behind the inner pages, it inverts the whole site rather than just
one page.

The PRD deferred dark mode to v1.1 on the grounds that it doubles the design
surface. That reasoning doesn't apply here: dark isn't being *added*
alongside light, it's *replacing* it. One palette, not two.

### themes are one attribute

Colours are no longer written directly into the Tailwind theme. They point at
slots:

```css
@theme {
  --color-ground: var(--t-ground);
  --color-ink:    var(--t-ink);
}

:root, [data-theme='koi'] { --t-ground: #0b100f; --t-ink: #ece7dd; }
[data-theme='phosphor']   { --t-ground: #0a0714; --t-ink: #cfe8c8; }
[data-theme='paper']      { --t-ground: #fafaf8; --t-ink: #1a1a1a; }
```

Setting `data-theme` on `<html>` is the whole mechanism. Every utility class,
every component, and the canvas renderer all resolve through those slots, so
none of them knows or cares which theme is active. Adding a fourth theme is a
CSS block plus one line in `lib/themes.ts` — no component changes.

Three themes ship: **koi** (the default — a pond at night, traditional kohaku
orange and cream), **phosphor** (the CRT reading, matching the reference
image), and **paper** (the original light design, kept because it costs
nothing and makes it obvious when something has been hardcoded).

### colour belongs to living things only

The design system has no colour, by design — the visual budget goes on type
and whitespace. The koi are the single exception. Water, stone, rules and
body text all stay monochrome; only the fish carry a gradient, running head
to tail across three tokens.

A useful consequence: the link accent is no longer an arbitrary pick, which
was an open question in the PRD. It's drawn from the koi. On the default
theme that's `#f0813a`, the same orange as the fish.

### avoiding the white flash

The server has no idea which theme a returning visitor picked — that lives in
their browser's `localStorage`. Render the default and correct it in a React
effect, and there's a beat where the wrong theme is on screen. On a site
whose ground is near-black, that beat is a **full-screen white flash on every
page load**.

`components/ThemeScript.tsx` is a tiny inline script in the document head
that reads storage and sets the attribute before the browser paints anything.
It has to be inline and blocking; a module or deferred script runs too late.
It's wrapped in try/catch because reading `localStorage` throws outright in
some privacy modes.

### the ramp had to flip, and it flips itself

The renderer maps a dark pixel to the *dense* end of the character ramp.
That's correct on paper: a dense glyph like `@` deposits more dark ink, so it
reads darker.

Invert the page and that reverses. On a dark ground a dense glyph emits more
*light*, so it reads brighter — and mapping dark pixels to it produces a
photographic negative.

Rather than hardcode a direction, `orientRamp()` derives it: if the ink is
brighter than the ground, the ramp is reversed. So a new theme needs no
renderer change at all. There's a test asserting the property that actually
matters — that a dark pixel reads dark in *both* orientations.

The renderer also now watches for theme changes. It caches its rendered
layers, so the ground, the ink and the ramp direction are all baked in at
draw time; a `MutationObserver` on `data-theme` rebuilds them.

### two bugs, both found by measuring

**The contrast problem from milestone 1 solved itself.** Muted text at the
specified 55% measured 3.84:1 on the off-white ground and failed AA. On the
dark grounds the same 55% measures **5.26:1 and passes**, because light ink
on a dark ground has far more room to recede into. Only `paper` still needs
62%, so each theme now owns its own mix percentage instead of sharing one.
Measured in a real browser, every text colour clears 4.5:1 in every theme:

| theme | body text | muted text | links |
|---|---|---|---|
| koi | 15.56:1 | 5.26:1 | 7.22:1 |
| phosphor | 15.22:1 | 5.01:1 | 11.81:1 |
| paper | 16.65:1 | 4.80:1 | 5.21:1 |

**A colour-parsing bug in shipped code.** The first contrast audit reported
muted text at 1.09:1 — catastrophically bad — while the screenshots plainly
showed a correct grey. The audit was wrong, not the CSS: Chrome returns
anything derived from `color-mix()` as `color(srgb 0.52 0.52 0.50)`, with
channels as 0–1 floats rather than 0–255, and the parser treated them as
0–255 and divided by 255 again.

That mattered beyond the test, because `parseCssColor` in the renderer had
the same gap: it read `#hex` and `rgb()` but returned null for `color(srgb)`,
so a themed colour defined with `color-mix` would have silently fallen back
to a hardcoded default. Fixed test-first, including refusing colour spaces it
can't convert (`display-p3`) rather than misreading their channels as sRGB.

The lesson is the same one from milestone 2, in a new costume: **when a
measurement disagrees with what you can see, suspect the measurement first.**

### still true after the pivot

Re-verified on the dark build: no horizontal scroll at 375px, zero
overflowing elements, the availability line above the fold with 102px of
headroom, `/lab` still 404s in production, 80 unit tests passing.

---

## milestone 5 — the koi pond (spike)

### what got built

A working ASCII koi pond at `/lab/pond`, dev-only, with sliders for every
parameter. Water, cursor ripples, fish wakes, koi that steer and school, and
stones. No new dependencies.

| file | what it does |
|---|---|
| `lib/pond/water.ts` | The surface. Three sine waves summed into a height field. |
| `lib/pond/ripples.ts` | Expanding rings from the cursor and from the fish. |
| `lib/pond/koi.ts` | Steering, and the spine that makes a body bend. |
| `lib/pond/field.ts` | The compositor everything writes into. |
| `lib/ascii/atlas.ts` | Pre-rendered glyphs, so drawing is a blit not a text layout. |
| `components/Pond.tsx` | The only file that touches a canvas. |

131 unit tests, up from 80.

### the idea that makes it work: one field

Everything in the pond writes brightness into a single buffer, one value per
character cell. Water writes a height, ripples add to it, stones and fish
stamp over it. Then the renderer maps that buffer through the density ramp
and draws characters — exactly the same final step a photograph goes through.

This is why a koi turning into a photograph is going to be cheap when we get
there: a fish and a photo are not different kinds of thing, they are
different sources writing into the same field. The morph is a crossfade
between two numbers, not a special effect.

The field also carries a *material* per cell (water, koi, stone) and, for
koi, a position along the body. That is what lets colour apply only to the
fish while everything else stays monochrome.

### the water is a pure function, not a simulation

There is no state in the water at all. `waveHeight(x, y, t)` answers "how
high is the surface here, now" for any point and any moment, by summing three
sine waves.

That has three consequences worth knowing. It can be sampled at any
resolution, so coarsening the grid when the frame rate drops needs no special
handling. It can be sampled at any *offset*, which is what will make the pond
scroll as depth in the next milestone. And it is testable without a browser —
there are tests asserting it stays in range, moves over time, and does not
visibly repeat across a screen width.

The frequencies are deliberately unrelated. Frequencies sharing a common
factor tile, and the eye finds the repetition immediately.

### how a chain of dots reads as a fish

Each koi is a head that steers plus a chain of spine points, where every
point is pulled to sit exactly one segment-length behind the one in front.
That single constraint produces the S-curve a koi makes when it turns: the
body cannot pivot instantly, so it trails and bends. No springs, no physics
engine.

Two details do most of the work:

**The pointer attracts rather than repels.** That is an interaction decision,
not a physical one. The fish are going to carry the photographs, so they have
to be catchable — and hovering something that flees is the most frustrating
interaction there is. Inverting it means you never chase: you hold still and
a fish comes to you.

**The body is widest just behind the head.** A profile that peaks in the
middle looks like a grain of rice.

### the performance problem, and whether it survived

Milestone 3's notes said plainly that drawing ~3,600 characters per frame
would not hold 60fps, and that the photograph renderer only worked because
its character layer never changes. The pond breaks that assumption — the
water moves, so characters change every frame.

Two fixes, both measured:

**A glyph atlas.** Every ramp character is pre-rendered once in every colour
it can appear in, into a sprite sheet. Per frame the renderer blits tiles
instead of calling `fillText`, which does font matching, shaping and layout
before it rasterises anything.

**Dirty-cell tracking.** The renderer remembers which character and colour
each cell showed last frame and skips any cell that has not changed. Water is
slow and mostly blank, so the overwhelming majority of cells are identical
frame to frame.

Measured in the browser, at 4,224 cells with five koi and the cursor moving:

> **redrew 50 of 4224 cells last frame — 1%**

Fifty blits per frame instead of four thousand text draws. The concern was
real and it is gone.

The other half of the cost is computing the field itself, which does touch
every cell. Benchmarked in Node, away from any browser frame-rate cap:

| | |
|---|---|
| cells per frame | 4,224 |
| live ripples | 14 |
| field cost per frame | **0.377 ms** |
| share of a 60fps budget | **2.3%** |

### the fix that mattered most visually

The first version rendered still water as a perfectly regular lattice of
dots — every single cell drew *something*, so the pond looked like graph
paper.

The fix is one character: the pond's ramp has a **blank** at its sparse end
that the photograph ramp does not. The quietest water now draws nothing, and
the atlas skips it without a blit. After that change, **95.8% of the canvas
is bare ground** — and the koi are the only bright thing in the frame, which
is most of why the reference image works.

It survives the automatic ramp flip in both directions: on a dark ground the
ramp reverses and the blank lands on the dim end; on a light ground it stays
put and lands on the bright end. Either way the quietest water is empty.

### three bugs, caught by tests and by measuring

**Fish frozen on arrival.** A new koi was seeded with its own position as its
wander target, so it steered toward the spot it was already on, decelerated
to a stop, and sat motionless for up to three seconds — exactly while someone
is deciding whether the page is worth staying on. Caught by a test asserting
a fish moves with no pointer present.

**The body profile peaked in the middle.** The curve was supposed to be
widest behind the head; it was widest at the midpoint, which renders as a
grain of rice rather than a fish. Caught by a test asserting the widest point
falls in the front half.

**Reduced motion showed an empty box.** Under `prefers-reduced-motion` the
pond never subscribes to the frame loop, so it draws one still frame instead.
But the first rebuild runs before layout has given the container a size and
bails out, and the real rebuild arrives from the ResizeObserver a moment
later — with nothing left to draw the pond. Found by checking that the canvas
had any lit pixels at all, rather than just that it wasn't animating. Worth
noting: the "is it static?" check passed the whole time. A still image and a
blank one are both perfectly static.

### a sizing finding worth keeping

Character cells are twice as tall as they are wide, so vertical resolution is
half of horizontal. A fish with a 11px body radius covers barely one row and
renders as a horizontal dash. It needs ~30px to span three or four rows and
read as a body. That is now the default and there is a test asserting a koi
occupies at least three rows.

### how to run it

```
npm run dev
```

then **http://localhost:3000/lab/pond**

Sliders for cell size and aspect, water base and amplitude, ripple strength,
koi count, body radius and brightness, attract radius and strength, and stone
brightness. The readout under the pond shows live frame rate and what
fraction of cells actually had to be redrawn.

Both `/lab` and `/lab/pond` 404 in production, verified, with no lab markup
in the response.

### what is not built yet

Scroll-as-depth, stones as real links with previews, and fish carrying
photographs. Those are milestone 6, and they should wait until the pond
itself looks right.

### milestone 5a — one fish, properly

Three things came out of looking at the first pond: two sliders were dead,
the fish barely reacted to the cursor, and the whole thing should be one
well-drawn koi rather than a school of rough ones.

**Three sliders were silently dead.** `cellSize`, `cellAspect` and `koiCount`
are all baked into things built once — the grid, the glyph atlas, the fish
population — and the main effect runs a single time and owns all of that
state. Prop changes reached it through a ref, which is enough for values read
every frame (radii, brightness, water) but not for these. Moving those
sliders did nothing until an unrelated resize happened to trigger a rebuild.

Fixed with a second effect that watches only the structural values and forces
a rebuild. The rebuild also had to learn that a new `cellSize` from the props
overrides whatever the frame-rate degradation had settled on, or the slider
would be overruled by the safety net.

**The attraction radius was smaller than the pond.** It defaulted to 260px in
a 1158px-wide pond, and it is a *detection* radius — beyond it the fish is
unaware of the cursor entirely. So for most of the pond the fish genuinely
could not see you, which reads exactly like the feature being broken. The
unit test passed throughout because it placed the pointer 140px away.

It is now 1400px — bigger than any pond it will sit in — and there is a test
asserting the radius exceeds the diagonal of the pond it is swimming in.

**Locomotion was rewritten for burst and glide.** The fish used to steer with
constant-velocity forces, which moves it like a cursor. Real fish, and the
Animal Crossing ones this is chasing, swim in bursts: a few hard tail beats,
then a long glide while they slow, then another burst.

A koi is now a heading and a scalar speed rather than a velocity vector.
Speed decays constantly against drag and is topped up by periodic darts;
heading turns toward whatever it is interested in. One detail does a lot of
work: **the fish turns far better mid-burst than while gliding**, because it
steers with its tail. That is what produces a flick-and-glide arc instead of
a smooth circle.

**The tail beats as a travelling wave.** Each spine point is pushed sideways,
perpendicular to the body, by a sine whose phase lags further down the body.
The lag is the entire trick: every point moving in step is a fish wagging
rigidly, whereas a wave running head to tail is how a fish actually swims,
and the eye knows the difference immediately. Amplitude ramps cubically so
the head is effectively rigid and the tail does the sweeping, and it scales
with how hard the fish is currently beating — so a dart is visible as a
harder beat, not just as more speed.

It also gives the fins their movement for free: the tail fin hangs off the
wrist, which is already part of the wave.

### what made it read as a fish rather than a shape

Three passes, each fixing something specific:

**It was flat.** Five character rows cannot describe a curve, so the body
read as a horizontal bar however correct its pixel proportions were. Two
fixes: the cell aspect went from 2.0 to **1.7**, because a monospace glyph
box is about 0.6 wide to 1 tall and an aspect of 2 throws away vertical rows
— which are the scarce resource here. And the fish got bigger, sized by *row
count* rather than by how large it looked in pixels.

**It was a tadpole.** The body tapered to a point, so the tail fin floated
behind it as a detached smudge with nothing joining the two. Koi have a fat
wrist where the fin attaches; the minimum body width went from 0.12 to 0.26.

**The fins evaporated.** They were stamped at 0.36–0.42 brightness, which
maps to the sparse end of the ramp — so they rendered as scattered dots
rather than as fins. Anything below about 0.5 disappears. Raised to 0.52–0.62.

The body profile also changed from a steady taper to near-full through the
middle with a late narrowing, which is what a koi looks like from above. A
steady taper reads as a comma.

### still cheap

At 8,250 cells on the finer grid, with the fish and fins and a moving cursor:
**224 of 8,250 cells redrawn per frame — 3%.** 149 tests passing.

### milestone 5b — calming the fish

Tuned by eye against the lab: body radius 40, tail amplitude 15, water base
0.15. The interesting note was that the tail "jitters way too fast".

It did, and by a lot. The tail was beating at **2.1Hz idle and 9.6Hz
mid-burst**. A cruising koi is around 1Hz and tops out near 2. On top of that
the flutter wave packed about 1.5 wavelengths onto the body, so it was
wiggling in two places at once — buzzing rather than swimming.

There is also a threshold specific to rendering on a character grid: above
roughly **3Hz the tail crosses cells faster than the grid can describe it**,
so instead of reading as a sweep it reads as flicker. Smooth motion needs the
tail to spend several frames in each cell.

What changed:

| | before | after |
|---|---|---|
| idle beat | 2.1 Hz | 0.5 Hz |
| beat mid-burst | 9.6 Hz | 2.0 Hz |
| wavelengths on the body | ~1.5 | ~0.8 |
| seconds between darts | 0.55–1.9 | 1.6–3.6 |
| drag | 1.35 | 0.85 |
| top speed | 128 | 92 |
| turn rate | 2.6 | 1.7 |

Lower drag matters as much as the slower beat: it means a burst carries
further and the glide becomes the main event rather than a brief pause
between flicks.

**Measured, not eyeballed.** Cells redrawn per frame halved, from 224 to a
mean of 111. That number is a direct proxy for visual busyness — a character
only redraws when it actually changes, so fewer redraws per frame is
literally what "calmer" means on this grid.

Two regression tests lock it in: one asserting the idle and burst beat rates
stay under 1.2Hz and 3Hz, and one asserting the flutter wave crosses zero at
most twice along the body, so the "two wiggles at once" look cannot come
back. A `beatRate` slider scales both rates for further tuning.

One test had to change with it: "notices the pointer from across the pond"
allowed six seconds, which only passed because the fish had been moving twice
as fast as it should. A calm koi crosses a pond at a stroll, so it now gets
twenty.

**A note on water base at 0.15.** The blank character only appears below a
luminance of about 0.056. At base 0.15 with amplitude 0.09 the water's
darkest trough is 0.06 — just above that line — so no cell is ever empty and
the surface spans only two ramp characters. That is why it reads as an even
screen of dots rather than as waves. Raising `waterAmplitude` to around 0.15
drops the troughs below the blank threshold while lifting the crests, giving
four levels and actual wave structure. Left at 0.09 pending a look.

### milestone 5c — making the swimming fluid

Tuning: water amplitude stays at 0.09, beat rate 1.3×. The remaining note was
that the fish should move more naturally.

The cause was structural rather than a value that needed nudging: **the tail
and the movement were two unrelated animations.** A dart applied an instant
speed impulse to the body, and separately the tail waved on its own clock.
Nothing connected them, so the tail read as decoration attached to something
being dragged along.

Two changes fixed it.

**The tail now does the swimming.** There is no impulse any more. Thrust is
proportional to how fast the tail is sweeping — `|cos(tailPhase)|` — so it
peaks at mid-stroke and falls to nothing at each turnaround, twice per beat,
because a fish pushes on both halves of the sweep. A "dart" is no longer a
shove; it is a decision to beat harder, and the speed follows from that.

The result is a surge-and-ease in speed that the body's own visible motion
explains. Measured by tracking the fish across the canvas: displacement
between samples ranged from 2.5px to 22.1px, an **8.8× surge ratio**. A
constant-velocity fish would be flat.

It also means the fish never fully stops. Idle tail beating alone settles it
at around 20px/s, so it drifts between bursts rather than stalling — there is
a test for that, because a fish that coasts to a halt looks broken.

**Turns carry momentum.** Heading was a fixed turn rate clamped per frame,
which rotates at exactly one speed and stops dead the instant it arrives —
the most mechanical thing a creature can do. It is now a damped spring:
angular velocity accelerates toward the heading error and is damped, so the
fish leans into a turn, drifts a fraction past, and settles. Still ceilinged,
and it is still far more agile mid-burst than while gliding, because a fish
steers with its tail.

Five regression tests cover the new behaviour: speed must oscillate rather
than only decay, idle beating alone must keep it moving, a turn must retain
angular velocity after the error closes, the turn ceiling must hold under a
target whipping side to side, and a new fish must start with no spin.

156 tests.

---

## milestone 6 — the pond becomes the homepage

### what got built

The homepage is now a pond you descend. The canvas is fixed to the viewport
and reads the scroll position itself; the stones are stepping stones down
through the water, and each one is a real link.

The copy is down to three lines, as intended:

```
aidan zheng
business analytics @ northeastern · boston
spring 2027 co-op · [target roles — aidan to add]
```

The interests paragraph moved off the homepage, the link list became stones,
and the contact links sit at the bottom of the pond — so reaching the bottom
is how you find them.

### scroll is depth, and it is free

The water is a pure function of position and time, so descending is literally
adding the scroll offset to `y` before sampling. No extra state, no second
code path, nothing to keep in sync. That was the payoff from building the
water as a function back in milestone 5 rather than as a simulation.

Stones live in document coordinates and slide past as you scroll. **The koi
does not.** A world-anchored fish would be left behind the moment you
scrolled, leaving three screens of empty water — with one fish it should stay
with the reader the whole way down.

### the stones are real links

This is the part that matters, and it is worth being precise about why.

The stones are `<a>` elements layered over the canvas, not canvas hit-testing.
Everything follows from that: they work with a keyboard, they work with a
screen reader, they work with JavaScript off, and the browser gives them
focus rings, middle-click, and open-in-new-tab for free. The canvas stays
`aria-hidden`. **The pond is decoration layered behind functioning HTML,
never the other way round.**

Hovering or focusing a stone does two things: the stone brightens, and the
koi swims toward it. Focus counts, not just hover — so tabbing through the
links lights the pond up exactly the way a pointer does, which makes the
keyboard path feel like the intended one rather than a fallback.

### two bugs caught before committing

**The navigation disappeared without JavaScript.** The first version measured
the viewport in an effect and rendered the stone links from the result, which
meant the server sent zero links and a visitor with JS off had no way to
reach any other page. The PRD requires the site to work without JavaScript,
so this was a real failure, not a nicety.

Fixed by positioning the links in pure CSS — `top: 175vh`, `left: 66%`, and
a `clamp(92px, min(100vw,100vh) * 0.18, 240px)` hit area. CSS can express all
of that without measuring anything, so the links are plain server-rendered
HTML. The canvas computes its own pixel positions from the same specs. One
source of truth, two independent routes to it, and neither depends on the
other having run.

Verified against the served HTML: all three links, the name, the availability
line, the contact placeholders and the stone labels are all present with no
JavaScript executed.

**The labels were unreadable.** Centred on their stones, the text landed on
the brightest part of the drawing in almost the same pale colour. Two fixes:
the label moved below the stone, and stones are now drawn in the muted tone
rather than full ink. A stone is a marker; the label is the thing that has to
be read.

### verified

| check | result |
|---|---|
| no horizontal scroll at 375px | pass, zero overflowing elements |
| availability line above the fold | pass, 241px of headroom |
| tab order through the stones | tailor studio → about → resume |
| links present with JS disabled | all three, in the served HTML |
| reduced motion | static, and redraws at the new depth after a scroll |
| `/lab` and `/lab/pond` in production | both 404 |

167 tests.

### not built yet

The fish carrying photographs — a koi that resolves into an ASCII photo as
you approach it, then into the real photograph under the cursor. That is the
last piece of the original idea and it needs real photographs to be worth
building. Stone hover previews of their destination are also still open.

### milestone 6a — the koi follows you down

Three notes from review: the fish stayed put as the pond scrolled past it,
it should swim into frame as the reader descends, and it should be 1.75×
faster.

**The fish was glued to the viewport** because it swam in screen
coordinates. Scrolling moved the water and the stones past a fish that never
moved — which reads as a sticker on the glass rather than an animal in the
water.

The fix is neither extreme. Screen-space glues it to the viewport; pure
world-space abandons it the moment you scroll, and most of a three-screen
descent would be empty water. Instead the koi now swims in **world
coordinates** but is told which slice of the world the reader can see — a
*focus band* — and wanders inside it. So it lags behind a scroll and then
swims after you, which is the behaviour that actually reads as a creature
following you down.

Two details make it work:

- It re-targets **immediately** when the band moves away, rather than waiting
  out its wander timer. That wait is the difference between a fish that
  follows you and one that looks abandoned upstream.
- It is turned back at the edges of the **visible band**, not of the
  document. In a pond three screens deep, document edges would only come up
  twice in the entire descent.

**Re-entry, for jumps it cannot swim.** A reader who scrolls straight to the
bottom leaves the fish roughly 1,700px behind — a twenty-five second trip at
any believable swimming speed, with the pond empty for all of it. So beyond
about a screen's distance the koi re-enters from the near edge instead,
pointing inward with its body trailing off-screen behind it.

It is a relocation, but never a visible one: the threshold is far enough
off-screen that what you see is a fish swimming in from the side you came
from, exactly as if it had been keeping up. Measured on the real page, after
a jump to the bottom of the pond it appears at the very top edge and descends
into view over the next few seconds.

**Speed ×1.75.** Top speed 92 → 161, and thrust 150 → 262 so the resting
cruise scales with it rather than only the ceiling. The beat rate is
unchanged, so the fish covers more ground per stroke — which reads as more
powerful rather than more frantic.

Ripples and the pointer moved into world coordinates too, so a ripple now
stays where it was dropped instead of sliding along with the viewport.

Eleven new tests, including one asserting that passing no focus band leaves
the old behaviour bit-for-bit identical, so the lab is unaffected. 177 tests.

### milestone 6b — the koi carries the photographs

The photography was going to be a link to a page with a grid on it. That was
rejected as not immersive enough, and rightly — it makes the pond a menu.

Now the koi carries the photographs, and approaching it is the entire
interaction. There is no navigation, no click, and no gallery page.

### how it works, and why it was nearly free

The pond's compositor was built on the idea that everything is brightness
written into one field. A photograph is just another source writing into it,
so the koi dissolving into a picture is a crossfade between two numbers per
cell rather than a separate animation with its own machinery. The three
stages come out of one value:

1. **far** — an orange koi
2. **approaching** — the fish's region crossfades into an ASCII rendering of
   the photograph, opening outward from the fish
3. **close** — the real photograph itself

Each photo is reduced to a brightness grid once, at a fixed resolution, then
read with normalised coordinates — so the region can open to any size without
resampling the source every frame.

Because the fish is *attracted* to the cursor, you never chase it. You hold
still, it swims to you, and the picture opens as it arrives. That is the
payoff for inverting the attraction back in milestone 5a.

Adding a photograph is dropping a file into `public/photos/`. It is read at
build time, so the page stays static and there is no manifest to keep in step.

### three problems worth recording

**The characters hung over the picture like a screen door.** The koi is drawn
to the cursor but *circles* it rather than settling on it, so raw proximity
hovered somewhere short of full and wobbled — leaving the ASCII permanently
half-faded over the photograph, and flickering as the fish orbited.

Fixed with a latch: past 0.72 the photograph commits to opening, and it does
not close until proximity drops below 0.3. The wide gap between those two
numbers is what stops it strobing. The value is then eased with frame-rate
independent exponential smoothing so neither opening nor closing snaps.

**The dirty-cell optimisation did not know about the photograph.** The
renderer skips any cell whose character has not changed, which is what makes
the pond cheap — but the photograph is painted over those cells as a bitmap,
so the tracker's record of what they show becomes a lie, and they would never
be repainted once the picture closed. The cells under the photo are now
invalidated every frame it is visible.

**A photograph opening over the name buried the point of the site.** At the
surface it covered the availability line, and muted grey text on a bright
picture is unreadable.

The fix is a design rule rather than a patch: **the koi only carries
photographs in the depths.** Zero willingness across the first screen, ramping
to full over the next half — professional at the surface, personal further
down, which is the structure the pond was supposed to have anyway. Verified:
holding still at the surface opens nothing (44 grey pixels), and the same
gesture in the depths opens the picture fully (26,733).

### measured

| | |
|---|---|
| koi visible, no photo | 236 orange pixels, 41 grey |
| photograph fully open | 90 orange, 26,748 grey — the characters are fully covered |
| after moving away | 218 orange, 36 grey — the pond restores exactly |

198 tests. `public/photos/` currently holds only the synthetic test pattern;
real photographs drop straight in.

### milestone 6c — photo rocks, and a fish that keeps up

Two notes from review: the koi still took too long to arrive after a scroll,
and the photographs should live on their own small rocks rather than being
carried by the fish.

### the fish

Two changes, because the problem had two halves.

**It re-enters sooner.** The threshold was nearly a full screen outside the
visible band, which left plenty of scrolls in the range where it had to swim
the whole way back — several seconds of empty water. Now half a band.

**It swims harder while out of sight.** `catchUpBoost` scales both thrust and
the speed ceiling by how far outside the band it is, up to 3.4× a full band
away, and it beats its tail hard while doing it so it arrives already moving
rather than easing in from a glide. A fish catching up is a fish swimming
hard, so it is not a cheat — but the real reason is impatience: nobody waits
ten seconds to find out whether a website has a fish in it.

Measured on the page. Previously, after a jump to the bottom of the pond, it
had not reappeared after six and a half seconds. Now it is visible within
**700ms** and well into frame by two seconds — and after an ordinary
one-screen scroll it is back almost immediately.

### photo rocks

The koi no longer carries the photographs. Each one gets its own small rock
in the depths, and resting on a rock opens its picture in place.

This is better than the fish version for a reason worth recording: **it
removes the waiting.** With the fish you had to hold still and wait for it to
swim over, which is charming exactly once. A rock is where you left it.

Photo rocks are deliberately not navigation stones. They are `<button>`
elements, not links, because nothing navigates — and they are smaller, sit
below every navigation stone, and carry a number rather than a word. Hover
and focus both open them, so the keyboard path matches the pointer one;
tapping pins one open, which is the whole touch story since a phone has no
hover.

The pond grows to fit them: each photograph adds a step of depth, so
`public/photos/` can hold two or twenty without the layout being redesigned.

### the filter, and what it is for

A raw colour photograph appearing inside a monochrome near-black ASCII pond
looks like a browser window opened on top of the artwork. So the real image
is **duotoned into the pond's own two colours**: multiplying by the koi's
palest tone pulls the bright end warm, screening the water colour lifts the
dark end to the colour of the pond. Between them the photograph's whole range
is remapped into the palette everything else is drawn in. A vignette
dissolves the edges so it has no hard rectangular border.

*(Read as: the filter exists so the photograph does **not** look out of
place. If the intent was the opposite — a deliberately jarring, foreign
object surfacing out of the pond — it is the same code with the duotone
inverted and the vignette removed, so say the word.)*

The transition is slow on purpose — about two and a half seconds each way.
The ASCII stage needs time to be seen before the photograph takes it over,
or the resolve is just a fade.

The stylised version is rendered once per photograph at load, not per frame,
and regenerated when the theme changes because the tints come from the theme.

### verified

| check | result |
|---|---|
| koi back in frame after a full-pond jump | visible in 700ms, previously never within 6.5s |
| photo opens on hover | 8 → 27,212 grey pixels, and 27 again after leaving |
| photo opens on keyboard focus alone | 15 → 3,811 |
| tab order | tailor studio → about → resume → photo rocks |
| 375px | no horizontal scroll, zero overflowing elements, availability above fold |
| no JavaScript | 3/3 stone links, photo buttons, and the availability line all served |
| `/lab`, `/lab/pond` in production | both 404 |

218 tests.

### milestone 6d — real photographs

Thirteen real photographs arrived, and two things broke that a synthetic
landscape test pattern could never have revealed.

**Six of the thirteen are portrait.** The reveal sized itself on width alone,
so a tall photograph computed a height larger than the screen and ran off the
top and bottom. `fitWithin` now constrains both dimensions.

This is worth recording as a general point: the test pattern was landscape,
so for two milestones the portrait case simply did not exist. A synthetic
fixture only tests the cases you thought of when you drew it.

**They are 1–3.3MB each, 25MB in total.** The PRD budget is 250KB per image,
and the pond is the first thing anyone sees. Two fixes:

*Routed through Next's image optimiser.* The canvas loads photographs by URL,
so pointing at `/_next/image?url=…&w=1200&q=75` costs nothing and returns a
resized WebP. A photograph never opens wider than 600 CSS pixels, so 1200
covers a 2× display exactly:

| file | original | optimised | |
|---|---|---|---|
| website-05 | 3,415 KB | **320 KB** | 10.6× |
| website-02 | 2,476 KB | **256 KB** | 9.6× |
| website-06 | 992 KB | **22 KB** | 45× |

One gotcha: **Next 16 only accepts qualities from an allowlist**, which
defaults to `[75]`. `q=72` is not "slightly different compression", it is a
400 from the optimiser — and since the first measurement compared a 3.4MB
file against a zero-byte error page, it briefly reported the optimiser as
79,479× more efficient. A number too good to be true generally is.

*Lazy decoding.* Photographs are now decoded and filtered only when their
rock comes within a screen and a half. Decoding thirteen 2048px files and
running each through the duotone at mount would stall the page for seconds,
which is the worst possible moment.

### the filter, confirmed

The reading was right: the filter exists so the photograph does **not** look
out of place. Against real images the duotone does what the test pattern only
suggested — greens and greys remap into the pond's water tones, the
highlights warm toward the koi, and the vignette dissolves the border. It
reads as something that surfaced out of the water rather than a window opened
on top of it.

### one thing to look at

Thirteen photographs make the pond **11.5 screens deep**. That is under a
screen per photograph and the descent is the point, but it is a long page.
`PHOTO_STEP_VH` in `lib/pond/photoStones.ts` is the single number that
controls it — 0.62 today, and 0.45 would bring it to about nine screens.

225 tests.

### milestone 6e — a third off the pond, and photographs you can see

Thirteen photographs made the pond 11.5 screens deep. The brief was to cut
that by 30–40%.

**Three levers, and they are not equally good.**

*Squeezing the vertical spacing* is the obvious one and the worst. At
thirteen photographs it needs about 0.29 screens between rocks, which packs
them into a dense column and loses the stepping-stone reading entirely — the
thing the layout exists for.

*Trimming the start and the tail* buys about half a screen. Real, but not
enough alone.

*Pairing two rocks per row* is the answer. It halves the row count while
leaving the vertical rhythm **exactly as it was**, so the pond gets a third
shorter without feeling any more crowded as you descend past it. The second
rock of each pair is offset slightly in depth, because two at identical depth
reads as a grid — which is the gallery page this replaced.

All three together:

| | before | after |
|---|---|---|
| pond depth, 13 photographs | 11.49vh | **7.39vh** |
| rows of photo rocks | 13 | 7 |
| navigation stones at | 1.0 / 1.75 / 2.5 | 0.95 / 1.62 / 2.3 |

**35.7% shorter.** Measured in the browser at both 1280×860 and 375×667:
7.4 screens, thirteen rocks, **zero overlapping pairs**, nothing off-screen
horizontally, and the availability line still above the fold.

### photographs were a thumbnail on a phone

Pairing prompted a check of how large a photograph actually opens, and on a
phone the answer was **225×152** — 60% of a 375px screen. That is not a
photograph, it is a thumbnail.

The fraction is now responsive. A desktop keeps 60% so the picture sits in
the pond with water around it, which is the intent; a narrow screen has
nothing else competing for the space, so it gets 88% of it.

| viewport | before | after |
|---|---|---|
| 375 (phone) | 225×152 | **330×224** |
| 768 (tablet) | 461×312 | **553×375** |
| 1280 (desktop) | 600×407 | 640×434 |

### and the koi is 25% faster again

Top speed 161 → 201, thrust 262 → 328 so the resting cruise scales with it
rather than only the ceiling.

238 tests.

### milestone 6f — faster again

Top speed 201 → 251, thrust 328 → 410, so the resting cruise scales with the
ceiling rather than only the top end.

| | |
|---|---|
| top speed | 251 px/s |
| idle drift | 52 px/s (21% of top) |
| catching up, off-screen | 853 px/s ceiling |

One test had to change, and the way it changed is the point. "Keeps swimming
gently without ever darting" asserted an idle speed under 45px/s — an
absolute number calibrated to a thrust value that has now moved three times,
so it failed on a change that was entirely intentional. It now asserts the
idle drift is between 3% and 30% **of top speed**, because what the test
actually cares about is the *ratio* between drifting and sprinting: if idle
creeps toward a cruise, a burst stops reading as a burst. That version
survives any future speed tuning without being hand-edited.

**Measured across the speed changes.** Tracking the koi's displacement
between samples on the real page: mean 10.0px originally, 51.2px now. The
surge ratio between the slowest and fastest sample is 3.5×, down from 8.8× —
still a clear surge-and-glide, but worth knowing that the character flattens
as speed rises. Push much further and it will read as a constant glide.

238 tests.

---

# the pivot: a personal site

Milestones 1–6f built the pond on the assumption that the site's job was to
get someone to hire Aidan. It isn't. The site is personal first — what he
makes, what he shoots, what he listens to — and it happens to be linked from
LinkedIn, which is a reason to keep it presentable, not a reason to make it a
portfolio.

What follows is one section per step of that rework.

## step 1 — pivot cleanup

### what changed

**`/resume` is gone.** The route, the stone that led to it, and every mention
of it. Nothing links there any more, and the build no longer emits the page.

**The surface lost its sales pitch.** The homepage used to carry a name, an
identity line, and `spring 2027 co-op · [target roles]`. The co-op line is
deleted outright. The identity line is now a bracketed placeholder for Aidan
to write, because "business analytics @ northeastern · boston" is a LinkedIn
headline rather than a sentence about a person.

Also rewritten, for the same reason: the homepage `<title>` (now just the
name), `site.description`, both inner-page metadata descriptions, and the
placeholder prompts on /about that asked for GPA-adjacent facts and
paid-work stats.

### the non-obvious part: depth is now derived, not typed

Removing a stone from `HOME_STONES` used to mean re-tuning four numbers by
hand: the two surviving stones' depths, the pond's total depth, and the depth
at which the photographs start. Miss one and the photographs overlap the
navigation, or the pond ends above its own last stone.

So depth is no longer authored. A stone is now written down as a
`StoneDefinition` — href, label, note, x position, radius — and `depthVh` is
computed from its index:

| number | value | what it means |
|---|---|---|
| `FIRST_STONE_VH` | 0.95 | the first stone sits just below the fold |
| `STONE_STEP_VH` | 0.7 | gap between stones, and before the photographs |
| `STONE_TAIL_VH` | 0.75 | water below the last stone |

`DEEPEST_STONE_VH`, `POND_DEPTH_VH` and `PHOTOS_START_VH` all fall out of
those three. Adding the "listening" stone in step 5 is one entry in a list
and an x position at least 0.15 away from its neighbours' — nothing else.

A test asserts the derivation rather than the resulting numbers, so it keeps
holding when the list changes length.

### what it did to the pond

| | 3 stones (before) | 2 stones (now) |
|---|---|---|
| stone depths | 0.95 / 1.62 / 2.3 | 0.95 / 1.65 |
| depth before photographs | 3.05 | 2.40 |
| photographs start at | 3.0 | 2.35 |
| total depth, 13 photographs | 7.39 | **6.74** |

The pond got most of a screen shorter for free, purely because there is one
less stone to descend past.

### what's left, and why

`grep -ri "resume\|co-op\|recruiter\|business analytics"` over `app/`,
`components/`, `lib/`, `scripts/` and `public/` returns nothing. Two places
outside that scope still match and should:

- **`docs/build-notes.md`** — this file. It is a record of what was built and
  when, including the parts that were later removed. Editing history to match
  the present is how you lose the reasoning.
- **`Personal Website PRD.md`** — the original brief, kept as a source
  document.

240 tests.

## step 2 — tailor studio: a story, and a slideshow

### the story

The page was a case-study skeleton: "the problem", "key decisions",
"limitations", "my role". That is the shape of a document written to be
assessed. It is now a short first-person story in the same order a person
would actually tell it — what it is, the slides, why, how it works, what came
of it, how it got built.

It is marked `{/* DRAFT — aidan to rewrite */}` at the top of the MDX and it
is meant to be rewritten. It sticks to the facts it was given and invents
none: the fifteen-to-twenty minutes, the four things the app does, the
human-submits-every-listing rule, the accuracy tests and the model sweep, and
the authorship — built with Claude, with Aidan finding the problem, scoping
it, setting the bar and steering, and Claude writing most of the code. No
verb in it implies he typed the code himself.

### the slideshow

`public/tailor-studio/slides/` is empty right now, so the page shows a
bracketed placeholder saying exactly what to drop in there. No PDF turned up,
so nothing needed converting and nothing needed installing.

**Adding slides:** drop numbered images in that folder. That is the whole
procedure. Order comes from the filename, so reordering is renaming. Nothing
lists the slides anywhere, so nothing can fall out of step with the folder.

| file | what it does |
|---|---|
| `lib/slides.ts` | Reads the folder, joins it to `slides.json`, at build time. |
| `lib/imageSize.ts` | Intrinsic width and height, read out of the file header. |
| `lib/slideshow/transition.ts` | The dissolve curve, paging, counter, swipe. All pure. |
| `components/Slideshow.tsx` | Server: picks the viewer, the fallback or the placeholder. |
| `components/SlideshowViewer.tsx` | Client: the interactive deck and the canvas. |

### three things worth explaining

**Dimensions are read from the file header, not configured.** `next/image`
needs a width and a height to reserve the right box before the file lands.
The usual way to get those is an image library; instead `lib/imageSize.ts`
reads PNG's IHDR chunk and walks JPEG's segment chain to its start-of-frame
marker. Roughly eighty lines, no install, build-time only. It returns `null`
rather than guessing, and a slide it cannot size is skipped — a guessed
aspect ratio is a layout shift with extra steps.

The JPEG walk has one trap worth knowing: markers `0xc4`, `0xc8` and `0xcc`
sit in the middle of the start-of-frame range but are Huffman tables and
arithmetic-coding tables, not frames. Reading dimensions out of one returns
whatever that table happens to contain. There is a test for exactly that.

**Only three slides are ever in the DOM.** `loading="lazy"` defers on
*viewport* position, not visibility — so twelve stacked slides, eleven of them
at `opacity: 0`, all download the moment the section scrolls into view.
Mounting a window of `index - 1`, `index`, `index + 1` is what makes "preload
the next slide" actually true.

**The dissolve really does go through the ASCII renderer.** The brief allowed
a plain crossfade if the ASCII version was not cheap. It is cheap, because of
how the characters are stored:

Each slide is turned into **four transparent canvases**, characters only,
with each cell assigned to one of the four by a hash of its position. During
a transition the frame loop draws the source slide, veils it with an even
wash of the ground colour, and then draws the four bands at staggered alpha —
band *k* opens over its own quarter of the transition. That is one fill and
four `drawImage` calls per frame, with no per-cell work at all, and the
characters arrive in scattered waves rather than as one block fading in.

The curve holds at **full characters for the middle 20%** of the transition,
and the underlying image is swapped at the exact midpoint of that hold. So
the swap happens while nothing but characters is visible, and the two halves
read as one slide breaking apart and a different one resolving out of the
pieces. A test asserts `ascii === 1` across the whole swap window, because
the failure mode if it ever slips is a visible hard cut — the one thing the
effect exists to prevent.

The canvas is only on screen for the 760ms a transition lasts. The rest of
the time the slide is a plain `<Image>`, because a slide is a picture of text
and text has to be crisp.

### what happens when things are missing

- **No JavaScript.** The `<noscript>` block carries a stylesheet that hides
  the interactive half and an ordered list of every slide, numbered, at full
  width. Both are server-rendered, so the choice is made by the browser
  before first paint rather than by a script. The fallback images still go
  through the optimiser — `getImageProps()` returns the same `srcset`
  `<Image>` would have rendered.
- **Reduced motion.** Instant swap. No canvas, no fade.
- **Canvas unavailable, or a slide that somehow became cross-origin.** The
  dissolve bails out and the images underneath crossfade in CSS, which looks
  like a plain crossfade rather than like a failure.
- **A slide with no alt text.** The bracketed placeholder is both the `alt`
  attribute and a visible line under the deck. Slides are pictures of text,
  so a missing description is a content bug and it is shown, not buried in
  the markup.
- **Alt text that Claude drafted.** Marked `draft: true` in `slides.json` and
  rendered as `[draft alt — aidan to check] …` until that is set to `false`.

### one thing to flag

None of the interaction has been driven in a real browser — there is no
headless browser in this environment. Mouse, keys, swipe and reduced motion
are correct by construction and their logic is unit-tested, but they have not
been *watched*. First thing to check when the real slides land.

277 tests.

## step 3 — photograph captions

### what changed

Photographs now carry a description, a place, a date and an exposure, and
those four things show up in three places: the caption under an open photo
rock, the grid on /about, and what a screen reader reads out. All of it comes
from one file, `public/photos/captions.json`.

**Adding a photograph end to end is three steps.** Drop the file in
`public/photos`, run `npm run photos:sync`, fill in what the script says is
blank. That is the whole procedure, and it is written out in
`public/photos/README.md` where someone will actually look for it.

### reading EXIF without installing anything

The date and the exposure are in the files already — Lightroom exports keep
the whole EXIF block. Getting them out would normally mean an EXIF library.
Aidan's call was to write the parser instead, so `lib/exif.ts` reads four tags
and nothing else:

| tag | becomes |
|---|---|
| `DateTimeOriginal` | `"2025-05-22"` |
| `FNumber` | `f/2.8` |
| `ExposureTime` | `1/1000` |
| `PhotographicSensitivity` / `ISOSpeedRatings` | `iso 800` |

It walks the JPEG segment chain to the APP1 that starts with `Exif\0\0`,
reads the TIFF header's byte order, follows IFD0 to the Exif sub-IFD, and
pulls those four entries. About 200 lines.

**Two things it deliberately does not do.** It does not read the camera body
or the lens, which are right there in the file — this is a site about
photographs, not about gear, so the names are never read, never stored and
never shown. And it does not show the day or the time, only the month and the
year, because the camera's clock is set to the wrong timezone and at month
resolution that error cannot surface.

Tested against synthetic files in both byte orders — every photograph in the
repo came off the same body and is little-endian, so a big-endian bug would
sit there until Aidan borrowed a camera — and against all thirteen real files.

### the one rule the sync script has

`npm run photos:sync` must be safe to run twice. It fills in what the camera
knows and never touches a word Aidan wrote, and that includes a date he
corrected by hand: the script only ever fills a **blank** field, so a fixed
date survives the next sync. A test runs the merge three times over an edited
file and asserts nothing moved.

Entries whose file has vanished are kept, not deleted, and reported — that is
almost always a rename, and deleting would throw away a description to save a
line of output.

The script is `scripts/photos-sync.ts` and Node runs it directly. Worth
knowing: Node's type stripping is **strip-only**, so nothing in its import
graph may use TypeScript that needs real compilation. A `constructor(private
bytes: Uint8Array)` in `lib/exif.ts` failed with
`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; it is a plain factory function now.

### where the caption goes, and how it gets there

The photograph is painted on a canvas, so the caption cannot simply sit after
it in the markup — nothing in the document knows where the picture landed.

The pond reports it. `onPhotoRect` fires **twice per photograph**, not once
per frame: once when the reveal passes 0.85 (at which point the eased
rectangle is within a third of a percent of its final size) and once with
`null` when the picture closes. Two React renders per open, instead of a
hundred and fifty.

The pond also now keeps 92px of clear water below a photograph, because a
rock near the bottom of the screen used to open its picture flush against the
bottom edge, leaving the caption nowhere to go but on top of it.

Three lines, in the order the page reads them:

```
kamakura · may 2025      small, muted mono
the tide was further out than the guidebook said.   small, body colour
f/8 · 1/160 · iso 320    tiny, muted
```

Any of them can be missing. A blank field is omitted — never an empty
bracket, never a stranded `·`, never the word "undefined" — and a photograph
with nothing written about it shows no caption at all, which looks like a
photograph with no caption rather than a hole in the page.

### what a screen reader gets

The visible caption is `aria-hidden`. The same words are attached to the
photo rock's `<button>` through `aria-describedby`, so they are announced
**on focus**, before the picture has opened, rather than only once a
mouse-driven animation has finished. The `·` separators become commas there,
because they are a typographic device and nobody wants "middle dot" read
aloud.

The description is one sentence, and a bug in building it became a test: the
personal line usually ends in a full stop already, so joining the parts with
`". "` produced `…said.. f/8` — wrong for a reader and wrong for a listener.

### two smaller things

**`/about` shows the exposure nowhere.** At a tile width of about 160px,
three lines under every photograph is a wall of grey, so the grid shows place
· date and the personal line, and the exposure stays in the pond where a
photograph opens large enough to carry it. It is still in every tile's
description for a screen reader.

**A `node:fs` import broke the build, and now a test stops it.**
`lib/captions.ts` started out with the file-reading in it. The homepage is a
client component, so that import landed in the browser graph and Turbopack
panicked with an error naming the chunking context rather than the import.
The reading moved to `lib/captionsFile.ts`, and a test now asserts
`lib/captions.ts` imports no `node:` builtins at all.

### state right now

Thirteen photographs, three shoot dates, every date and exposure filled in
automatically. **Sixteen fields are still blank and will not ship blank:**
three places, and thirteen descriptions. `npm run photos:sync` prints the
list.

312 tests.

## step 4 — one theme control, beside the name

### what changed

The theme picker was a row of three underlined words in the footer of every
page. It is now a single muted glyph — `◐` — sitting beside Aidan's name at
the top of the homepage and beside the back link at the top of the inner
pages. The footer version is gone, and so is `ThemeSwitcher.tsx`. One
switcher, one place.

Collapsed it is one character in muted mono. No border, no background, no
box. The site's whole argument is that it has no furniture, and a theme
picker is not the thing to introduce some with.

### how it opens

| input | behaviour |
|---|---|
| hover | opens; closes 220ms after the pointer leaves |
| click or tap | toggles — a phone has no hover, so this is the whole touch story |
| focus, then Enter or Space | opens (it is a real `<button>`) |
| focus, then ↓ | opens and moves focus to the first option |
| ↑ ↓ Home End | move between options, wrapping |
| Esc | closes and returns focus to the glyph |
| Tab out of the last option | closes, same as moving the pointer away |

The 220ms close delay is not a flourish. The options sit *below* the trigger,
so there is a real gap between the glyph and the first of them, and with no
delay the menu flickers shut halfway across it.

For a screen reader: `aria-haspopup="menu"` and `aria-expanded` on the
trigger, `role="menuitemradio"` with `aria-checked` on each option — which is
what announces the current theme — and a polite live region that says
"theme: phosphor" after the menu has closed behind the choice.

Without JavaScript the glyph is a control that cannot do anything, so it is
not rendered at all: a `<noscript>` stylesheet hides it, which means the rule
only exists in the situation where it is true.

### the swatch, and the bug in the obvious version

Each option shows a two-square swatch: that theme's ground beside that
theme's accent. The colours are not written down anywhere in the component —
the swatch sets `data-theme` on *itself*, which redefines the `--t-*` slots
for that subtree, so it paints in the target theme's real values and can
never drift from `globals.css`.

The obvious version of that used `bg-ground` and `bg-accent` inside the
scoped element, and **every swatch came out in the colours of the theme
already showing.** Those utilities resolve `--color-ground`, which is
declared once on `:root` as `var(--t-ground)` — and a custom property
inherits its *already-substituted* value. By the time it reaches the swatch
it is a literal colour, and redefining `--t-ground` underneath it changes
nothing. Reading `var(--t-ground)` directly at the swatch works, because that
slot genuinely is redefined on that element.

The frame around the swatch deliberately stays *outside* the scope, in the
current theme's rule colour. Inside it, a dark theme's swatch on a dark page
would have an invisible border and read as a floating orange square.

### does the pond repaint?

Yes, and the mechanism was already there: `Pond` watches `<html>` for
`data-theme` with a MutationObserver and calls `refresh()`, which re-reads
the tokens, rebuilds the glyph atlas in the new colours, refills the
dirty-cell cache with -1 so every cell repaints, and re-runs the duotone
filter over every decoded photograph because its tints come from the theme.
`AsciiImage` does the same for its cached layers.

Two things did need fixing:

**The slideshow cached its character layers with the ink colour baked in.**
They were invalidated on resize but not on a theme change, so a dissolve
started after switching themes would have drawn its characters in the old
theme's ink. It now watches `data-theme` too.

**The colour derivation was untestable.** It lived inside the component's
effect, where there is no way to assert anything about it from Node. It is
now `lib/pond/theme.ts` — a pure function from a token reader to a palette —
and the component is four lines of assignment.

The test for it **parses `app/globals.css`** rather than restating the hex
values. Copying them here would mean the test passes forever while the
stylesheet drifts away from it; parsing the real blocks means a new theme is
covered the moment it exists. It asserts:

- every theme in `lib/themes.ts` has a block in `globals.css` — a theme
  without one silently paints the pond in koi's colours while the page around
  it changes, which is a horrible bug to chase in a browser;
- all three themes produce different grounds, different water and different
  koi, which is the property a live theme switch depends on and the one a
  cached palette would break;
- the ramp turns round for the light theme, because on a light ground a dense
  glyph reads dark and the photographs would otherwise come out as negatives;
- missing or unparseable tokens fall back instead of painting `NaN`.

### one thing to flag

As with step 2: none of this has been driven in a real browser — there is no
headless browser in this environment. The hover delay, the arrow keys and the
live repaint are correct by construction and the colour derivation is tested,
but they have not been watched.

320 tests.

## step 2b — the real deck

The slideshow shipped empty in step 2. The deck arrived as a PDF in the
tailor-studio repo, so this is the conversion and what it turned up.

### converting it, without installing anything

`scripts/pdf-to-slides.swift` renders one PNG per page using PDFKit and
CoreGraphics. Both are already on any Mac, so a deck costs nothing to
convert; everything else that does this job — poppler, mupdf, ghostscript —
is an install, and the alternative here was about eighty lines of Foundation.

```
swift scripts/pdf-to-slides.swift <pdf> public/tailor-studio/slides
```

Two details worth keeping:

**It trims each page to its own content.** The deck was exported to US Letter
**portrait**, so each 16:9 slide sits in the middle of a tall page with white
bands above and below — 2000×2588 of which only 2000×1456 is the slide.
Shipping that means every slide on the site is two-thirds empty paper. The
trim finds the bounding box of everything that is not paper-coloured, with a
tolerance of 6/255 per channel: an exported "white" is rarely `#ffffff`
exactly, it carries the renderer's own antialiasing, and an exact comparison
finds content in all four corners and trims nothing.

All twelve pages trimmed to exactly 2000×1456, which matters — a deck that
trimmed to twelve slightly different shapes would make the stage resize
between slides.

**It uses an explicit bitmap rep rather than `NSImage.lockFocus()`.** Focus
locking sizes itself from the screen's backing scale, so the same command
would produce different pixel dimensions on a laptop and an external monitor.

### the deck is clipped on the right, in the source PDF

**Six of the twelve slides have content cut off at the right edge**, and it
is in the PDF itself, not the conversion — the page's MediaBox, CropBox,
BleedBox, TrimBox and ArtBox are all 612×792, and the layout is wider than
that. Any PDF viewer shows the same.

| slide | what is cut |
|---|---|
| 02 the problem | the right edge of card 03, "price it against recent sold listings" |
| 04 the workflow | stage 05 — the slide says "five stages" and shows four |
| 05 import | the right half of the importing mockup |
| 07 review | the right column of the confirm-drafts card |
| 10 safety rails | the ends of all four "does not" lines |
| 12 get started | the end of step 3, "open a draft, click Fill, publish" |

The fix is a re-export at 16:9 landscape rather than Letter portrait — it is
a page-size setting in whatever produced the PDF, not a redesign. Re-running
the script over the new file replaces all twelve.

Shipped as-is meanwhile: the slides are legible and carry the argument, and
an empty placeholder is worse than a deck with cropped margins.

### alt text

Every slide is a picture of text, so all twelve have a real one-sentence
description in `slides.json`, written from reading each slide. They are all
marked `draft: true`, which renders as `[draft alt — aidan to check] …`
beneath the deck until Aidan clears it.

### cost

4.8MB of PNG in the repo, of which slides 01 and 12 are 1.3MB each — both are
large smooth gradients, which is the case PNG compresses worst. Delivered
bytes are far lower, because every slide goes through Next's optimiser and is
served as a resized WebP, and only three slides are ever mounted at once.

### the story got shorter

Rewritten from prose into bullets and cut from about 370 words to 250. The
"how it works" list now names the same five stages the deck does — import,
draft, review, fill, publish — so the page and the slides under it agree
instead of describing the same thing two different ways. Two of those five
stages say "mine", which is the whole argument of the project in the shape of
a list.

Still marked `{/* DRAFT — aidan to rewrite */}`.

## step 7 — clips, water on every page, and a tighter pond

Five things arrived together: the deck's tone, video in the pond, the pond
behind the inner pages, a page-change animation, and a spacing pass.

### first, something that went wrong

The three clips arrived as 1080p60 phone files. The transcode pipeline wrote
them to a scratch folder and then **copied the results back over the
originals**, which destroyed 27MB of source footage and, with it, the only
record of when each clip was shot. There is no recovering either from what is
in the repo.

`scripts/video-to-loop.swift` now refuses outright to write to its own input.
That is a two-line guard that should have been there first.

### clips

A clip is a photo rock that moves. Not a new kind of thing — the same rock,
the same ASCII stage, the same duotone, the same caption; it just keeps
going once it has opened.

**Transcoding.** `scripts/video-to-loop.swift`, AVFoundation, nothing
installed. Audio dropped, scaled to fit 540x960, 30fps, 900kbps, plus a poster
frame.

| | before | after |
|---|---|---|
| three clips | 27.6MB, 1080x1920, 60fps, ~13Mbps, with audio | **1.9MB**, 540x960, 30fps, 900kbps, silent |

The audio is dropped by building a composition containing only the video
track, so it is gone by construction rather than by a flag someone can
forget. It would never play — nothing autoplays with sound — and it is
whatever was being said around the camera, which is nobody's business.

This uses `AVAssetWriter` rather than the two lines of `AVAssetExportSession`
it looks like it wants to be, because **the export presets have no bitrate
control**. The preset route produced 540x960 at 4.8Mbps: the right dimensions
and still 5.7MB for ten seconds.

**In the pond.** A photograph is duotoned once at load. A clip changes thirty
times a second, so its filter runs every frame — into one scratch canvas it
keeps, because allocating a canvas per frame is how you find out what a
garbage collector sounds like.

What does *not* run per frame is the ASCII stage: those characters are built
from the poster frame and stay there. They are only visible while the picture
is opening, and animating them would cost a `getImageData` per frame to
animate something nobody looks at for longer than a second.

A clip plays only while its own rock is open, is rewound when it closes so it
always opens on the start of the loop, pauses when the pond scrolls out of
view, and never plays at all under reduced motion.

**On /about**, `<LoopingClip>` behaves like an animated GIF: silent, looping,
no controls. `preload="none"` plus a poster means nothing downloads until the
tile is on screen, an IntersectionObserver starts and stops it, and reduced
motion leaves the poster frame up. That last point is why it is a component
and not an `autoPlay` attribute — the attribute cannot ask.

### a date that was really an export date

Two of the new images are Lightroom exports with no make, no model and no
exposure block, carrying a `DateTimeOriginal` of the day they were exported.
The sync believed it, recorded it as a shoot date, and invented a phantom day
in `places` to go and name.

`trustedDate()` now returns a date only when there is exposure data behind
it. No aperture, no shutter and no ISO means it did not come from a camera,
so the date is unknown — and unknown lands on the checklist. The cost of
being wrong this way is one date to type in; the cost of being wrong the
other way is a caption stating something false.

### water on the inner pages, and a wave between them

The pond is now behind /about and /tailor-studio too, which is what makes
them feel like part of the same place rather than two documents sharing a
palette.

**Dimmer than the homepage, deliberately.** The homepage has a name and two
words of navigation on it. These pages are several hundred words of body
text, and a koi at full brightness passing behind a paragraph makes that
paragraph hard to read. Water base, amplitude and koi brightness are all
turned down in `PondBackdrop`.

**The page change is a wave.** The water is the only thing that survives a
navigation, so it is the only thing that can connect two pages. A row of
ripples is queued left to right, each started a beat after the last, so it
travels across rather than appearing all at once — and the incoming content
rises and fades in over 480ms behind it.

The obvious tool was React's `<ViewTransition>`, which would also animate the
*outgoing* page. It wants a wrapper inside every `page.tsx`, and two of these
pages are MDX files whose default export is the prose itself. Keeping the
transition in a wrapper in the root layout keeps the content files free of it,
at the cost of an exit animation.

Queuing is a module-level array for the same reason the pointer position is:
the canvas owns a frame loop that never re-renders, and the navigation
happens somewhere else entirely. Two fast navigations replace the queue
rather than appending to it, so clicking through three pages sends one wave
instead of a storm.

### tighter

| | before | after |
|---|---|---|
| between navigation stones | 0.70vh | **0.56vh** (−20%) |
| between gallery rows | 0.58vh | **0.383vh** (−34%) |
| pair offset | 0.16vh | 0.106vh |
| water below each group | 0.75vh | 0.60vh |
| pond depth, 25 items | ~9.9vh | **7.37vh** |

A test now asserts no two rocks overlap at 375, 768, 1280 or 1440 wide.
Closest approach with 25 items is 121px on a phone and 249px on a laptop, so
there is real room left — but at a third tighter this is worth guarding
rather than eyeballing.

One collision the numbers did cause: the "photographs" note sat 0.42vh above
the first rock, which after tightening put it on top of the *about* stone's
label. It is 0.25vh now.

### copy

**Tailor studio is a case now, not a story.** Problem, approach, decisions,
result, authorship. The five stages match the deck exactly, and the personal
asides are gone — what is left is what the project actually did. It is
shorter than the story version it replaces and carries a decisions section
the story did not have. Still `{/* DRAFT */}`, and still honest about Claude
having written most of the code.

**/about** opens with Aidan's own line, and the personal-photo slot is gone.
The homepage line under the name drops the "hi, i'm aidan" — the `<h1>`
immediately above it already says the name — and keeps only what is new.

### cost

`public/photos` is 45MB, almost all of it 22 full-size Lightroom JPEGs at
1–3MB each. Delivered bytes are far lower: every still goes through Next's
optimiser, and clips are 1.9MB for all three. If the repo size becomes a
problem, the originals are the thing to move out, not the clips.

347 tests.

### fix — the theme script was reporting itself as a hydration error

Anyone who had ever changed theme got a React hydration mismatch in the
console on every page load:

```
<html
+   data-theme="koi"
-   data-theme="phosphor"
```

The mismatch is real and it is **the design working**. The server cannot know
which theme this visitor picked last time, so it renders the default; the
inline script in `<head>` rewrites the attribute from localStorage before the
browser paints; React hydrates a moment later and finds a different value
than the one it rendered.

The alternative is not writing the attribute on the server, which is a
full-screen flash of the wrong theme on a near-black site — the exact thing
`ThemeScript` exists to prevent. So `<html>` is marked
`suppressHydrationWarning`.

That attribute deserves suspicion, because used broadly it hides real bugs.
Two things keep it honest here: **it applies one level deep**, so it covers
this element's own attributes and nothing inside the app; and a test asserts
it appears exactly once and never on `<body>`. The test strips comments
first — the first version of it counted the word in the comment explaining
the attribute and failed on its own documentation.

353 tests.

### fix — the page transition was throwing the stones off their labels

Reported as "stones aren't rendering right". It was the page-change animation
added in step 7, and the mechanism is worth writing down because it is not
obvious from either piece on its own.

**Any `transform` other than `none` makes an element the containing block for
its `position: fixed` descendants.** The animation was on `.page-flow`, the
wrapper around the whole page. The pond is a `fixed inset-0` canvas *inside*
that wrapper. So for the 480ms the animation ran, `inset-0` stopped meaning
"the viewport" and started meaning "this wrapper" — which on the homepage is
**737 viewport-heights tall**.

The canvas then measured its container at the height of the whole document
and placed the stones at `documentHeight * depthVh`, while the real anchors,
positioned in CSS `vh`, stayed at `viewportHeight * depthVh`. The drawn stones
and the links they are supposed to sit under ended up thousands of pixels
apart.

**And it did not end when the animation did.** At that size the grid is about
666,000 cells. The frame rate collapsed, and runtime degradation — which is
one-way by design, as its own comment says — ratcheted the cell size to its
ceiling and left it there. The container snapped back to the viewport half a
second later; the coarse grid did not. So the real symptom was not a
half-second glitch but a pond that rendered in enormous characters for the
rest of the session.

Two fixes, one for each half:

**The transform moved to `main`,** which is a *sibling* of the pond container
in both layouts rather than an ancestor. The content still rises; the water is
left alone. A test parses `globals.css`, finds every `@keyframes` block that
touches `transform`, and asserts every selector using it is scoped to
`> main`.

**Degradation now recalibrates when the box changes size.** A coarsened cell
size is a judgement about the box it was measured in; a large enough change
in area makes it a judgement about some other box. `shouldRecalibrate()`
compares areas — area, not dimensions, because that is what the cost scales
with, and turning a phone sideways costs exactly the same. The threshold is
1.5x, which ignores a mobile address bar appearing (about 1.1x) and a rotation
(exactly 1.0x), and catches a 7.4x explosion.

That second fix is the more valuable one: the first stops this particular
layout bug, the second stops any future transient from permanently ruining the
rendering.

364 tests.

---

# listening: a third stone, and a pond of album rocks

A "listening" stone on the homepage leads to `/listening`, a small pond where
albums are rocks. Going deeper goes back in time: pebbles near the surface are
what is on repeat this month, boulders at the bottom are the records that never
leave.

It is not a new system. It is the photo rocks from milestone 6c, the captions
from step 3, the themes from step 4 and the page wave from step 7, pointed at a
different kind of picture.

## listening step 1 — data

### what got built

Two sources, and they are deliberately unalike.

**Pebbles** come from last.fm's `user.getTopAlbums` over a one-month window.
They are a fact about the last thirty days, with a playcount and a rank and no
opinion attached. They change on their own.

**Boulders** come from `content/listening.json`, which Aidan writes. They are
choices, with a line from him and no playcount at all. They change when he
changes them, and never otherwise.

| file | what it does |
|---|---|
| `lib/listening/constants.ts` | Every number: the period, the playcount floor, how many pebbles. |
| `lib/listening/types.ts` | Pebble, boulder, hide rule, the shape of the file. |
| `lib/listening/albums.ts` | Pure: parsing last.fm, the hide list, cover detection, sizing. |
| `lib/listening/boulders.ts` | Pure: reading Aidan's file into boulders. |
| `lib/listening/lastfm.ts` | Server-only: the request, and the whole fallback chain. |
| `lib/listening/file.ts` | Server-only: reading and writing `content/listening.json`. |
| `lib/listening/data.ts` | The one call the page makes. |
| `lib/listening/fixture.ts` | A committed response to design against. |
| `lib/listening/covers.ts` | The merge behind `npm run listening:covers`. |
| `scripts/listening-covers.ts` | Fetching the boulders' covers, once. |

### the key never reaches the browser, and there is a test that says so

`LASTFM_API_KEY` and `LASTFM_USER` are read from `process.env` with no
`NEXT_PUBLIC_` prefix, which means Next will not inline them into any
JavaScript sent to a visitor. That is true by construction — and the way it
stops being true is somebody importing the wrong module into a client component
a month from now, at which point the key is compiled into a file served to
everybody, silently.

So `lib/listening/secrets.test.ts` walks the **real import graph** from every
client entry point on the site and asserts that no file reachable from it names
either variable, reads `process.env` at all, or is one of the three server-only
listening modules. It was checked by injecting `process.env.LASTFM_API_KEY`
into `lib/pond/stones.ts`, which is four imports deep from the homepage: the
test named the file and failed.

It also strips comments before searching, which is the same trap the
`suppressHydrationWarning` test fell into — the first version failed on the
comment in `boulders.ts` explaining why a `node:fs` import must not appear
there. A test that fails on its own documentation teaches everyone to weaken
the test.

### the fallback chain

Four states, in order, and none of them puts an error on the page:

1. **No key configured.** The committed fixture, plus one console line in dev
   saying exactly that. This is the state before Aidan makes a key, and a blank
   page would tell him nothing about whether the design works.
2. **last.fm answered.** Use it, and remember it.
3. **last.fm failed, and there is a remembered answer.** Use that. A dead API
   should cost freshness, not content — and the page keeps the *original* "as
   of" date, because claiming a stale list is today's is the one lie that line
   exists to prevent.
4. **last.fm failed and nothing was ever remembered.** No pebbles. The boulders
   still render, and the page says nothing about last.fm's uptime, because
   nobody came here to read about it.

Once a key exists the fixture is never used again. Fixture data on a live site
would be a lie; an empty pebble layer is merely quiet.

**What "remembered" means.** A module-level value, so it survives revalidations
inside one server process. Deliberately not a file on disk — a serverless
filesystem is read-only at runtime, and a snapshot committed to the repo would
be data pretending to be source. A cold process has no memory of it, which is
covered by the other half: a failed revalidation leaves Next serving the page
it last rendered successfully.

**The cache holds albums, not pebbles**, and that distinction is load-bearing.
The hide list is applied on the way *out* of the cache, so a record Aidan adds
to it disappears from the remembered answer too. Caching already-filtered
pebbles would have kept serving a record he had just asked never to see again —
which is how the bug was found, by a test that expected an empty list and got
the previous one.

### two things about last.fm worth knowing

**Every number is a string, and an error is an HTTP 200.** `{"error": 6}`
arrives with a perfectly good status code, so the response is checked for an
`error` field as well as for `response.ok`. A single album comes back as an
object rather than an array of one.

**It does not return "no cover art" — it returns a picture of no cover art.**
A grey star at a known image hash, which loads fine and tells the reader
nothing. `isPlaceholderCover` catches it and the album is marked coverless, so
it can open as its name drawn in characters instead. Without that check the
pond would proudly display a picture of a missing cover.

### the sizing rule

A pebble's size is the **square root** of its share of the top album's
playcount, not the share itself. A rock's presence on the page is its *area*,
and area goes as the square of the radius — so scaling the radius linearly with
playcount makes an album played twice as often look four times as important.
There is a floor at 0.52, which is what stops the eighth album becoming a speck
too small to tap on a phone.

### the fixture's covers are the test pattern

The fixture is a real `user.getTopAlbums` response in shape — strings for
numbers, the image size array, a placeholder cover, and one album under the
playcount floor that is supposed to vanish. It goes through the same parser and
the same filters the live data does. A fixture that skipped the parsing would
test the layout and nothing else.

But its image URLs are faithful in shape, which means no file is behind them,
and **a cover that 404s never opens** — hiding the exact thing the fixture
exists to let Aidan look at. So in fixture mode the cover is the repo's own
synthetic test pattern, the same one the ASCII header uses. It is visibly a
test pattern and could never be mistaken for album art. One fixture album stays
coverless on purpose, so that path is visible too.

### the covers script cannot overwrite anything

`npm run listening:covers` fetches each boulder's cover once from
`album.getInfo`, writes it into `public/listening/covers/`, and fills in the
`cover` field in `content/listening.json` **only where that field is blank**.

The contract, in full, and every clause of it is tested:

- a `cover` value that is already filled in is never touched;
- a file that already exists on disk is never downloaded over — if the file is
  there but the JSON did not point at it, the script records the name and
  downloads nothing;
- it writes only inside `public/listening/covers`, and refuses by name to write
  over `content/listening.json`;
- so a second run does nothing at all.

That last one is a test — `applyCovers` is handed the same fills twice, and
then a *different* filename for an already-filled slot, and the file comes back
unchanged both times. This is the mistake that destroyed 27MB of source footage
in step 7, and it is worth a guard rather than a promise.

The script runs manually, never on build. A build that edits its own source is
a build nobody can reason about.

### one convention worth knowing

Every relative import under `lib/listening/` carries its `.ts` extension. Node
runs `scripts/listening-covers.ts` directly and its ESM resolver does not guess
extensions, so anything the script reaches has to spell them out —
`ERR_MODULE_NOT_FOUND` on `./constants` is the failure. One rule that always
holds is easier to keep than a rule about which files the script happens to
reach today. `allowImportingTsExtensions` in tsconfig is what lets the compiler
agree, and the bundler resolves either spelling to the same module.

### what Aidan has to fill in

`content/listening.json` ships with three empty boulder slots and one empty
hide rule, so the shape is visible. An empty slot renders **nothing** — not a
rock with no name on it. A boulder with no line does render, as
`[why this one never leaves — aidan to write]`, because an unfinished page
should be visibly unfinished.

An empty hide rule hides nothing, which sounds obvious and is not: a rule that
matched everything because both its fields were blank would empty the pond, and
the file ships with exactly that rule in it.

94 new tests, 458 in total.

## listening step 2 — the /listening page

### what got built

`/listening` is an inner page like /about: back link, theme control, the
water behind it, and the page-change wave. Below the heading is a pond. The
pebbles sit near the surface, sized by playcount. The label "the ones that
never leave" sits below them, and the boulders sit at the bottom.

| file | what it does |
|---|---|
| `app/listening/page.tsx` | Server: reads the data, static, revalidates every six hours. |
| `components/ListeningPond.tsx` | Client: the pond, the rock buttons, the captions. |
| `lib/listening/rocks.ts` | Pure: where every rock goes and how big it is. |
| `lib/listening/coverless.ts` | An album with no cover, drawn as its own name. |
| `lib/listening/fallback.ts` | The page with JavaScript off: a plain list. |
| `lib/listening/format.ts` | "on repeat · last 30 days" and "as of september 23". |

**It is the photo rocks, pointed at album covers.** `Pond` already knew how to
take a list of rocks with an image each, stamp them into the field, and open
one on hover into an ASCII stage, a duotone and a caption slot. `/listening`
hands it album covers and nothing about that machinery changed. The rocks are
`<button>`s over the canvas, positioned in CSS so they are server-rendered
HTML, and the canvas is `aria-hidden`.

**It sits outside the `(page)` route group.** That group's layout renders its
own `<PondBackdrop>`, and this page needs a pond with rocks in it. Two ponds
would mean two canvases doing twice the work. The group's chrome, a back link
and the theme control, is a dozen lines, so `ListeningPond` renders it itself.

### shared changes, and why each one was needed

Three files outside this feature changed. Each one is the smallest change that
does the job:

| file | change | why |
|---|---|---|
| `lib/pond/photoStones.ts`, `components/Pond.tsx` | optional `density` on a rock, default 1 | Boulders need a heavier texture. It multiplies the stone's brightness, so every cell of the rock gets a denser character. Photo rocks leave it undefined, so they draw exactly as before. |
| `next.config.ts` | `images.remotePatterns` for `lastfm.freetls.fastly.net` | Covers have to go through the image optimiser. See below. |
| `app/globals.css` | page animation `both` → `backwards` | A bug on the homepage too. See below. |

### the homepage's photo captions have been off-screen since step 7

I found this by driving `/listening` in headless Chrome. The first opened
cover's caption was at **y = −413**, above the top of the screen. The
homepage had the same problem: a photo rock's caption was at **y = −609**. It
has been this way since the step 7 fix, so every photo caption from step 3
has been invisible.

The step 7 fix moved the page animation from the wrapper onto `main`, so the
fixed pond canvas was no longer inside it. That was correct. But the captions
are `position: fixed` too, and they live inside `main`. The animation used
`animation-fill-mode: both`, which holds the last keyframe forever. A held
`transform: none` computes to `matrix(1, 0, 0, 1, 0, 0)`. That is an identity
matrix, but it is not `none`, so `main` stayed the containing block for every
fixed caption. Each caption was placed from the top of the document instead
of the viewport, which put it above the screen by exactly `scrollY`.

The fix is one word. `backwards` applies the first keyframe only before the
animation starts. When it ends, the element goes back to its own style:
opacity 1 and no transform, which is the same as the last keyframe. It looks
identical and leaves nothing behind. Measured after the fix, the homepage
caption is at y = 654 and the listening caption at y = 677, both in an 860px
viewport and both right under their pictures.

The test came first. `lib/pageFlow.test.ts` now asserts that no animation
touching `transform` uses `both` or `forwards`. It failed on `both` and passes
on `backwards`.

`main` is still the containing block for the 480ms the animation runs after a
navigation. Nothing can be open during that window, so it doesn't matter.

### a page that was static until it had a key

The build printed `/listening` as `○` (static) with the fixture. With
credentials set, it printed **`ƒ`**, meaning rendered on every request. The
cause was `cache: 'no-store'` on the last.fm request. In this caching model,
that opts the whole route out of static rendering, which would have meant
asking last.fm once per visitor. The fixture build hid it because no fetch
ran.

The fetch now carries no cache option. It runs whenever the page renders: at
build time, then at most every six hours. A test asserts the request is never
`no-store` and never `revalidate: 0`. It failed first. After the fix the
build prints `○ /listening  6h` with credentials set.

`export const revalidate = 21600` is a literal on purpose. Next reads it
without running the module, and `60 * 60 * 6` is not something it can read.

### covers go through the optimiser, and that matters for the canvas

A cover is loaded as `/_next/image?url=<last.fm url>&w=640&q=75`, the same
way the photographs are. It saves bytes, but the main reason is that the pond
reads the pixels of every image it draws. A cross-origin image taints the
canvas and makes `getImageData` throw, which would lose the ASCII stage, the
duotone and the whole opening. Served from `/_next/image`, the cover is
same-origin.

It isn't the `<Image>` component, because the canvas loads by URL. It is the
same optimiser.

640 is the smallest width in Next's default `deviceSizes`. A width outside
that list is a 400, not a slightly different file. That's the same trap the
photographs hit with `q=72`.

### an album with no cover opens as its name

The pond can already open a picture, so a coverless album becomes one. Its
title and artist are set in monospace, white on black, in a 600×600 SVG data
URL. The pond decodes that, samples its brightness and opens it through the
same ASCII stage and duotone as a real cover. The name rises out of the
characters and resolves into type.

It is white on black rather than a theme colour. The image is reduced to
luminance and then duotoned, so the theme gets applied afterwards anyway.
Using a theme colour here would apply it twice and flatten the contrast.

A data URL is same-origin, so the canvas stays clean. The SVG uses generic
monospace, because an SVG inside an `<img>` can't reach the page's web fonts.

### the layout

**Pebbles** go two to a row with the right-hand one slightly lower, like the
photo rocks. Placement comes from rank alone, so the same data always gives
the same layout and a reload never reshuffles it. When the ranking changes,
the rocks change places. The radius is `0.062 × size` of the smaller screen
dimension, with a **30px floor**, so the least-played album is still a 60px
tap target on a phone.

**Boulders** get a row each, alternating sides. They are twice a pebble's
radius at every viewport and larger than any navigation stone. Their texture
is `density: 1.6`: the same stone drawing, pushed harder, which lands on the
`+` and `=` end of the ramp where pebbles draw `-` and `:`. They never move.

**The first pebbles peek above the fold.** They start at 0.8 screens. Heading,
intro and labels take about four tenths of a screen at 375. If the first rock
were entirely below the fold, the page would look empty, not like a pond.

**Depth follows the rock count.** A month with three albums makes a shorter
page than one with eight. With no pebbles, the boulders move up to where the
pebbles would start, so a dead API doesn't leave a screen of empty water.
There is a 1.5-screen minimum.

| | depth |
|---|---|
| 7 fixture pebbles, no boulders (today) | 2.96 screens |
| 7 pebbles, 3 boulders | ~4.6 screens |
| 8 pebbles, 6 boulders (the most it holds) | under 8, tested |

A pebble shows its rank (`01`–`08`) because the ranking is the information. A
boulder shows no number because it isn't ranked.

### captions, and reduced motion

A pebble's caption is `album · artist` in muted mono. A boulder's caption
adds Aidan's line underneath in body colour. With a cover open, the caption
sits under the picture, positioned from the rect the pond reports. On a phone
it is held inside the 20px gutter, because the picture opens nearly full
width and would otherwise push the caption against the edge of the screen.

**Under reduced motion the cover never opens.** The pond never animates, so
the picture never arrives and the pond never reports a rect. Reduced motion
should cost the movement, not the words. So when a rock is active and no rect
has arrived, the caption renders directly under the rock instead. That is
measured: with reduced motion on and a boulder focused, the caption under the
rock reads the album, the artist and the line.

The same gap exists on the homepage. Under reduced motion, photo rocks never
open. I haven't touched that; it's in the report.

### keyboard, screen reader, no JavaScript

Measured in headless Chrome at 375×667:

| check | result |
|---|---|
| tab order | back link → theme → 7 pebbles in rank order → boulders |
| accessible name | "Kid A, Radiohead": a comma, because "·" is read as "middle dot" |
| boulder description | the line, via `aria-describedby`, so it is read on focus before anything opens |
| Enter | pins the rock (`aria-pressed` goes true) |
| Esc | closes an open rock, pinned or hovered |
| overlaps at 375 | none, across 23 boxes: rocks, rank labels, section labels, header |
| horizontal scroll | none |
| JavaScript off | the rock layer is hidden and a plain list takes its place |

**Esc is new here.** The brief described it as matching the photo rocks, but
they have no Esc handler. This page listens on the window, not the button,
because a rock pinned by a tap doesn't have focus. The homepage is unchanged.

**With JavaScript off**, the buttons would be scattered over a canvas that
never draws. That's worse than a list. A `<noscript>` block carries a
stylesheet that hides the rock layer and collapses the pond's height, plus an
ordered list of pebbles and a list of boulders with their lines. It is built
as a string, like the slideshow's fallback, because a browser with JavaScript
on reads `<noscript>` contents as text, and React's hydration would find text
where it expects elements.

### what the page says in each state

| state | on the page |
|---|---|
| no env vars | fixture pebbles, "as of", and `[example data — last.fm not connected yet]` |
| last.fm answering | real pebbles, "on repeat · last 30 days", "as of" |
| last.fm failing, answer remembered | the remembered pebbles, with their **original** date |
| last.fm failing, nothing remembered | no pebbles, no "on repeat" label, no date, no error text; boulders as normal |

The last row is measured, not assumed. I built with a deliberately bad key and
temporary boulders, then restored `content/listening.json` from git. The page
had two boulders and the empty slot rendered nothing. The markup contained no
error-like words. The bad key's value appeared in no file anywhere under
`.next`.

The "on repeat" label only appears when there are pebbles. Over empty water it
would be a caption with nothing to caption.

### verified in a real browser, for once

Every step since step 2 ended with "none of this has been driven in a real
browser". This one was: Chrome is installed, and a 60-line DevTools-protocol
driver in the gitignored `Claude outputs/` folder was enough to scroll, hover,
tab, press keys, emulate reduced motion, turn JavaScript off, take
screenshots and measure boxes. That's how the caption bug above was found.
Unit tests would never have caught it, because every number in them was
right.

One thing to know: port 3000 was Aidan's own `next dev`, so production checks
ran on 3100. The server was left alone.

514 tests.

## listening step 3 — the homepage stone

### what changed

`HOME_STONE_DEFINITIONS` has a third entry: `/listening`, "listening",
"what's on repeat", at `xFraction: 0.42`. That's 0.24 from about's 0.66, so
the path zig-zags back instead of running down the right-hand side. That one
entry was the whole change to the layout. Step 1's derivation did the rest:

| | 2 stones (before) | 3 stones (now) |
|---|---|---|
| stone depths | 0.95 / 1.51 | 0.95 / 1.51 / 2.07 |
| pond depth before photographs | 2.11 | 2.67 |
| photographs start at | 2.07 | 2.63 |
| total depth, 25 items | 7.37 | **7.93** |

Measured in Chrome, nothing collides. At 375 the listening label ends 98px
above the "photographs" note, and the note ends above the first photo rock. At
1280 the gap is 127px. The existing test "twenty-five pieces of media inside
eight screens" still passes, but at 7.93 it is close. The next few
photographs will trip it, and `PHOTO_STEP_VH` is the number to look at when
they do.

The homepage is still static (`○ /`). It imports stone definitions and nothing
from `lib/listening`, so there is no last.fm data on it.

### the rings

The listening stone gives off a slow ring every 1.8 seconds, like a speaker
cone. It is built from the existing ripple system: `rings: true` on a stone
definition, and `Pond` drops an ordinary ripple at that stone's centre on a
timer. Nothing new is drawn. The stone is stamped over the water, so the ring
starts hidden under it and is seen coming out of the rim. `lib/pond/rings.ts`
holds the timing as a pure function.

- **It pauses off-screen.** A ring only fires while the stone is on screen,
  and the whole frame loop already stops when the pond is out of view. The
  timer resets when the stone leaves, so returning gives one ring straight
  away, not a backlog of rings released together. A backlog is an alert.
- **Never under reduced motion.** A ripple there would be a frozen circle.
  Measured: with reduced motion on, the homepage canvas was byte-identical
  across five seconds with the listening stone in view.

**The strength was calibrated on the page, and the first guess was wrong.**
0.2 looked right on paper because it's well under the pointer's 0.45. On the
page it was invisible. The field takes a ripple at a third of its strength, so
a single ring that faint never lifts a cell past the blank at the bottom of
the ramp. Measured around the stone for four seconds, 0.2 produced no pulse at
all. 1.0 as a positive control confirmed the rings were firing, since the lit
pixels dipped about every 1.9s, but its trough bit into the stone's rim.
**0.6** reads correctly: the stone's outer dots draw in as the trough passes
and push out as the crest does, and a faint halo travels off it.

The unit test that allowed 0.2 compared one ring against one pointer ripple.
That's the wrong comparison, because the pointer drops a ripple every 110ms
while it moves and they stack. It now compares disturbance per second, where
the ring is under an eighth of a moving pointer. A second test holds the
strength above 0.4, because a ring nobody can see is not subtle, it's absent.

### verified with three stones

| check | result |
|---|---|
| tab order | tailor studio → about → listening → photo rocks |
| focusing the listening stone | it brightens, its label turns accent, the koi comes to it |
| clicking it | navigates to /listening, and the wave crosses the pond on arrival |
| `main` transform after the page animation | `none`, so the step 2 fix holds across a navigation |
| photographs below | 25 rocks, captions under their pictures (step 2's fix) |
| 375px | no horizontal scroll, no stone or label collisions |
| `LASTFM` in any file under `.next/static` | none |

527 tests.

### fix — every real cover was a 400

The first time real data flowed through, no pebble would open. The optimiser
answered each cover with `"url" parameter is not allowed`.

`images.remotePatterns` allowed `lastfm.freetls.fastly.net`, a host I wrote
from memory. The fixture's URLs were written with the same host, so the
fixture and the config agreed with each other and the tests passed while
both were wrong. last.fm actually serves covers from
**`lastfm-img.freetls.fastly.net`**, which is every one of 100 image URLs
across three months of Aidan's account.

A rock whose cover fails to load stays a rock, so this showed up as nothing
at all: no error, no broken image, just pebbles that never opened.

`lib/listening/imageHosts.test.ts` pins the real host, independent of the
fixture. It also asserts that every host the fixture uses is allowed, so the
fixture can't quietly drift away from the config again. It failed on the old
host and passes on the new one. Watched in Chrome afterwards: the top
album's cover rises out of the characters with its caption under it.

The step 2 table above still names the old host. It's left as written,
because it records what was built at the time.

529 tests.

## listening step 4 — covers as ASCII art, smaller, floating

Asked for after seeing real covers: open them smaller, let them drift, and
keep them as ASCII art instead of resolving into the image.

Every picture in the pond already passes through characters on its way
open. A photograph then hands over to the real image, because a photograph
has to be seeable. On `/listening` the characters are now the picture. It is
one pond setting, `photoAscii`, plus `photoScale` and `photoFloat`. All three
default to the old behaviour, so the homepage is unchanged:

| setting | homepage | /listening |
|---|---|---|
| `photoScale` | 1 | **0.55**: about 300px on a laptop, 160px on a phone |
| `photoFloat` | 0 | **8px** of slow drift, on two unrelated periods |
| `photoAscii` | false | **true** |

### what `photoAscii` does, and why each part was needed

I found each of these by looking at a real cover in Chrome, not by
reasoning about it:

- **No hand-over to the real image.** That's what was asked for.
- **Characters in ink, not koi orange.** The first attempt drew the whole
  cover in the koi's head colour, because photo cells map to koi shade 0.
  That was always the case, but it only showed for a second before the real
  image took over. Held for good, it made every album read as part of the
  fish. The palette now carries the page's `ink` as a separate field, and
  the pond appends it to the atlas **after** the existing colours so no index
  moves. That's also why it isn't in `colors`: the theme tests pin that list
  and its order.
- **Tones stretched per cover.** Your top album is a pale sky with a kite in
  it. Every cell was between 0.8 and 0.95, which is the densest glyph
  everywhere: a solid slab. `stretchContrast` maps each cover's own 2nd–98th
  percentile to the full range, which is the first thing any ASCII-art tool
  does. The percentiles keep one highlight pixel from setting the range. Order
  is preserved, so it's the same picture with more contrast. Computed once per
  cover at load.
- **Edges feathered into the water.** A photograph gets a vignette from the
  real image painted over its characters. ASCII art has nothing painted over
  it, so it ended in a hard rectangle. `stampPhoto` takes an optional
  `feather`, default 0. The first version still showed a hard line, because a
  cell took the picture's colour only above half strength, so the colour
  flipped from ink to water halfway through the fade. At a feathered edge, a
  cell now stays the picture while the picture's own blend is over half, and
  just thins out. That was a failing test first.

### two things this can't do

**Thin details don't survive.** The kite on the top cover is thinner than
one character, and at 300px there are about 43 characters across. Covers
with big shapes come through clearly; *The Worship Initiative, Vol. 10*'s
figure and frame are recognisable even on a phone. Delicate covers become
texture. Making the cover smaller costs detail, and that's the trade.

**The float moves in character steps.** The characters sit on the pond's
fixed grid, so an 8px drift moves the art one cell at a time rather than
gliding. At this speed it reads as drifting. The caption doesn't move: the
pond reports the settled position, and the caption leaves room below for
the drift.

### smaller things

- The rock's orange rank number sat in the middle of the art while it was
  open. It's hidden while that rock's cover is showing.
- The caption is at least 240px wide, clamped inside the 20px gutters on
  both sides. At the cover's own 160px on a phone, an album title wrapped
  onto four lines. Measured at 375px: every caption between x = 20 and 355.
- Reduced motion is unchanged. Covers never open there, and the caption
  shows under the rock.

539 tests.

### more detail: the covers get their own, finer characters

Asked for straight after: can the ASCII covers be more detailed?

The limit wasn't the cover, it was the pond. Everything was drawn on the
pond's one grid of 7px characters with a ten-step ramp. At 300px that's
about 43 characters across, which the kite and most of the Worship
Initiative figure couldn't survive. A bigger cover would have added detail
and undone "smaller".

So a cover now hands over, at the end of its reveal, to **its own ASCII art
on a finer grid**. That's the same moment a photograph hands over to the real
image, with a different target. The coarse pond characters are still what it
rises out of. `lib/pond/asciiArt.ts` holds the pure parts:

| | pond grid | a cover's own art |
|---|---|---|
| character width | 7px | **4px** |
| characters across, 300px cover | ~43 | **~75** |
| tones | 10 | **16** |

- **4px, not smaller.** Much below that, a glyph stops reading as a
  character at 1x and becomes a smudge of tone: a blurry photograph, not
  ASCII art.
- **The ramp is measured, not typed.** Each candidate glyph is drawn in the
  site's own monospace font and its ink counted. Sixteen are then picked,
  spaced evenly by coverage. Glyph density is a property of the font, so an
  order written for one face has steps out of order in another, and every
  out-of-order step is a speck of noise in every cover. It's spaced rather
  than taken in order because most glyphs are light: the first sixteen would
  spend the ramp on shades of nearly-empty. The candidates are mostly
  punctuation, because a cover made of letters reads as a paragraph you try
  to read.
- **Same proportions and same edge fade.** The fine cells keep the pond's
  1.7 aspect, so the two read as one kind of character. `edgeFeather` is
  shared by the coarse stage and the fine art, so both dissolve along the
  same curve.
- **The coarse stage steps aside as the art arrives.** The first version left
  it underneath, and it showed through the art's soft edges as a second,
  coarser border. Now what's under the fade is plain water.
- **The drift is smooth now.** The art is a finished image drawn on whole
  device pixels, which is half-pixel steps on a 2x screen, rather than a
  field quantised to 7px cells. The coarse stage underneath holds still at
  the settled position during the rise.
- **Rendered once per cover, at the size it opens to.** It's re-rendered when
  the theme or that size changes, and it goes through `orientRamp` like the
  pond's own ramp. Checked in the paper theme: dark ink on a pale ground,
  not a negative.

Watched in Chrome: the Worship Initiative emblem is clear at laptop size and
still legible on a phone at about 40 characters across. The kite cover shows
its diagonal sky with the kite as a dark speck. It's there now, but a kite
thinner than a 4px character is still a speck.

551 tests.

## listening step 5 — the top five tracks, grouped

Asked for: five rocks for the top five, tracks instead of albums, and the
rocks grouped closer together. The boulders stay albums, because they're
records Aidan picks by hand.

### tracks, and where their covers come from

Pebbles now come from `user.getTopTracks`. Tracks are closer to what "on
repeat" means than albums: an album's playcount is the sum of its tracks, so
a record with one song played to death and eleven skipped looks the same as
one played through.

**last.fm has no art for tracks.** Every track image in Aidan's real month
was the grey placeholder star. A track's cover is its album's, so after
choosing the five, `track.getInfo` is asked for each one, in parallel, and
returns the album and its artwork. That's five small requests every six
hours, and only for the five being shown, not all fifty. A lookup that fails
costs that one cover, never the pebble.

Some tracks genuinely have no cover. Measured on the real account:

| track | what last.fm has |
|---|---|
| Touch the Sky, On and On, Purple Rain | album art |
| Majesty | no album linked at all |
| two CHRIS STASSY singles | an album, with no image, even via `album.getInfo` |

Those open as their title drawn in characters. That's the fallback built in
step 2. There is deliberately no guessing from the artist's other albums: a
wrong cover is worse than none.

`autocorrect` is off on the lookup. It's last.fm renaming a track to what it
thinks you meant, and the page should show the name that was played.

### the numbers that changed

| | albums | tracks |
|---|---|---|
| `MAX_PEBBLES` | 8 | **5** |
| `MIN_PLAYCOUNT` | 4 | **2** |

Two plays because a track's count is a fraction of its album's. At four, a
real month produced three tracks where the page asks for five. Once is
passing through; twice is a choice.

### the hide list takes a track now

A top-tracks response doesn't say which album a track is on, so a rule
naming an album couldn't be matched until after the five were already
chosen. A rule is now `{ artist }` for everything by someone,
`{ artist, track }` for one song, or `{ track }` for that title by anyone.
The empty scaffold slot in `content/listening.json` changed from `album` to
`track` to show the shape. It held none of Aidan's words. A hidden track is
backfilled from further down the list, so five still show.

### grouped

Two columns a screen deep read as a list you scroll past. The top five are
one thing, this month, so they're now a cluster you take in at once:
`PEBBLE_SLOTS`, five spots placed by hand, within 0.4 of a screen. The most
played sits top left and the rest fall away down and to the right, with no
two at the same height so it never reads as a grid. The existing no-overlap
test holds at 375, 768, 1280 and 1440 wide, and in Chrome at 375 there are
no overlaps across 14 boxes.

| | before | now |
|---|---|---|
| pebbles span | ~1.2 screens | **0.4 screens** |
| whole page, no boulders | 2.96 screens | **1.8 screens** |

### renames

`lib/listening/albums.ts` is now `pebbles.ts`, since it no longer parses
albums. On a pebble and a rock, `album` is now `title`: the track's name on a
pebble, the album's name on a boulder.

Watched in Chrome with the real account: *Majesty* opens as its title in
characters; *Touch the Sky* opens as *Empires* in fine ASCII.

570 tests.

## listening step 6 — no boulders

Aidan doesn't need "the ones that never leave", so the feature is gone
rather than left empty. It had never shown anything: all three slots in
`content/listening.json` were blank, and blank slots render nothing. But
unused code with a script, a folder and a file format attached still invites
someone to fill it in, and still has to be kept working.

Removed:

- the boulder type, layout, `BOULDER_*` numbers, and the "the ones that never
  leave" label;
- boulder lines: the second caption line, `aria-describedby`, and the section
  in the no-JavaScript list;
- `npm run listening:covers`, `lib/listening/covers.ts`, and
  `public/listening/covers/`. They existed only to keep boulder covers in the
  repo;
- `neverLeave` from `content/listening.json`, which is now only the hide
  list;
- **the shared `density` setting on photo rocks.** It was added for
  boulders' heavier texture and nothing else used it. `lib/pond/photoStones.ts`
  is back byte-for-byte to what it was before this feature, and the pond's
  photo-rock brightness line is back to the original.

The hide list moved from `boulders.ts` to its own `lib/listening/hide.ts`.
The rock type is `TrackRock` now, since the only rock is a track.

Everything the earlier steps say about boulders is history, left as written.
The page is the top five tracks: same cluster, same covers, same ASCII art.
Checked in Chrome afterwards: five rocks, both kinds of cover open, and no
overlaps at 375.

528 tests. The count fell because the covers-script and boulder tests went
with their code.

## paper, white and blue

The light theme is now white and blue, and its white is no longer glaring.

| token | before | after |
|---|---|---|
| ground | `#fafaf8`, luminance 0.955 | `#e6ecf3`, luminance **0.83**, a soft blue-white |
| ink | `#1a1a1a` | `#15263f` navy, 12.79:1 |
| muted mix | 62% | **68%**, 4.97:1 |
| accent | `#b8431a` rust | `#2459ad` blue, 5.68:1 |
| water | `#dfe3e0` | `#d0d9e5` |
| koi | red → brown | `#3a78c9` → `#2159a8` → `#15325f`, 3.75:1 at the lightest |

The id stays `paper`. A visitor's choice is saved in localStorage under the
id, so renaming it would silently reset everyone who picked it. Only the
menu's note changed, from "light" to "white and blue".

**The contrast rule is a test now.** It had only ever been comments in
`globals.css`, and this change nearly broke it unnoticed. Muted text is ink
mixed into the ground, so a softer ground moved it: the old 62% measures
4.17:1 on the new one and fails AA. `lib/contrast.test.ts` parses every
theme block in the real stylesheet and checks body, muted and link text at
4.5:1 and every koi colour at 3:1. A new theme is covered as soon as it
exists.

Compared in Chrome, before and after, on the homepage, an open photograph,
and an open cover on /listening. Photographs in this theme are as washed-out
as they were before, just cooler now: the duotone for a light ground has
always compressed them. That's unchanged here and worth a separate look.

541 tests.

## the gallery's heading, in characters

"photographs. rest on a stone to bring one up." is replaced by **photo
gallery**, drawn as ASCII art in the theme's muted tone, so it changes with
the theme like every other character in the pond.

- **The font is hand-written** in `lib/banner.ts`: five rows, only the ten
  letters the heading uses. A figlet-style library would be a dependency for
  ten letters, and its standard font puts "photo gallery" at about 90
  characters. This one is 60 on a line, and 33 stacked, which is what a phone
  gets. A letter the font doesn't have throws instead of silently dropping
  out of a heading.
- **Line height 0.62.** A monospace glyph is about 0.6 as wide as it is
  tall, so at a normal line height each font pixel was a tall, thin cell and
  the letters fell apart into dots. Matching the row pitch to the glyph width
  makes the pixels square and joins the strokes. Checked in Chrome: unreadable
  before, clear after.
- **Screen readers get the words.** A visually hidden `<h2>photo
  gallery</h2>` carries them, and the art is `aria-hidden`. Read aloud, it
  would be a minute of "number sign". The gallery also gets a real heading,
  which it didn't have before.
- **Spacing, measured:** at 375 the stacked title has 78px of clear water
  above it to the listening stone's label and 65px below it to the first
  photo rock. At 1280 those are 101px and 148px. No horizontal scroll.

The old line also explained how the rocks work. That explanation is gone,
at Aidan's request: hovering or tapping a rock is the only way in now.

548 tests.

### smaller, and under the water

Two follow-ups: make it look distorted by the water, and bring it back to
about the size of the one-line note it replaced.

**Drawing it in the pond's own canvas was the obvious route, and it was the
wrong one.** It would have given real refraction: the same waves, the pointer's
ripples and the koi's wake bending it. But the pond's grid cells are 7×12px,
so the heading could not be smaller than about 420×60px. The request was for
smaller.

So it stays HTML, at 7px with the 0.62 line height: **252×22px**, the same
height as the old note. It goes through an SVG filter: a turbulence pattern
whose frequency slowly shifts over 11 seconds, feeding a displacement map
that moves each part of the text by up to about 4px. The strokes bend and
waver like lettering seen through moving water. It needs no script, so it
works with JavaScript off, and it's one line on a phone too, so the stacked
version is gone. Under reduced motion it gets the same distortion held still:
it still looks like it's under water, it just doesn't move.

Checked in Chrome, zoomed 3× across three frames 1.8s apart: legible, and
the O, D and G visibly change shape. 150px of clear water to the first rock
at 1280, 119px at 375.

It doesn't respond to the pointer or the koi the way real refraction in the
canvas would. That's the price of the size.

548 tests.


## mobile pass (/impeccable adapt)

Phones are the main concern in PRODUCT.md, so every page was measured in
Chrome, with touch emulation, at 375×667 portrait, 667×375 landscape and
320×568. The measurements covered every tappable element's size,
horizontal overflow and text size, plus a real tap-by-tap test of the rocks.
It held up well: no horizontal scroll anywhere, including at 320, and every
stone and rock was already a comfortable target. Six things were wrong.

**1. A second tap didn't close a rock.** It's the same on the homepage and
on /listening. On a phone one tap is three events (the pointer enters, the
button takes focus, then the click), and the focus left over from the first
tap still counted as hovering. The second tap unpinned the rock, but the
picture stayed open, while `aria-pressed` told a screen reader it was
closed. The open/close logic is now one pure reducer,
`lib/pond/rockSelection.ts`, shared by both pages and tested with the real
touch sequence. The failing test came first, and the first fix was wrong in
an instructive way: closing whenever the rock was already *showing* closed
it on the very first tap, because that tap's own enter and focus had
already opened it. It closes when the rock is already *pinned*. The
homepage also gained Esc-to-close, matching /listening.

**2. Three controls were too small to tap.** The theme glyph was **8×21px**.
"← aidan zheng" was 100×21, and the slideshow arrows 19×21. The design
wants them to look that small, so they still do: a `hit-area` utility adds
an invisible layer centred on the control, extended on each axis by exactly
how far it falls short of 44px (`min(0px, (100% - 44px) / 2)`, zero for
anything already big enough). The theme menu's options grow to 44px tall on
touch screens only (`pointer-coarse`). The gap between the back link and the
glyph went from 8px to 16px so the glyph's tap zone doesn't take taps meant
for the link. Measured: every point across "← aidan zheng" goes to the link
except a 2px sliver past the "g".

**3. iOS's grey tap flash.** iOS paints a translucent grey rectangle over
anything tapped, which over a rock is a box on the pond. It's turned off
with `-webkit-tap-highlight-color: transparent`, and the focus ring still
shows.

**4. The notch in landscape.** `viewport-fit=cover`, so the water runs to
the glass. The reading column's side padding is now
`max(20px, env(safe-area-inset-*))`, so text stays clear of the notch. Zoom
is still allowed.

**5. Text on top of an opened photo in landscape.** At 375px tall a
photograph reaches up to the stone labels and the gallery heading, which are
HTML and so draw over it. They now fade out while a photograph is showing,
as /listening already did.

**6. Small overlaps.** The open rock's orange number sat in the middle of
its photograph, and the homepage caption sat flush against the screen edge
on phones. The number now hides while its photo is open, and the caption is
held inside the 20px gutters, as on /listening. Measured at 320, 375, 667 and
1280: every caption between 20px and the right gutter.

Confirmed in one follow-up round: targets are at least 44 on every page at
every size, and tapping a rock twice closes it on both pages. The 12px
captions ("as of", photo dates) were left alone on purpose. They're the
designed caption size for secondary metadata.

559 tests.

## gallery: rocks that say what they are (/impeccable clarify)

The critique scored the gallery 1 of 4 for recognition. It was 25 rocks
numbered 01–25, with nothing to choose between, and a screen reader heard
`[photograph — aidan to describe: website-NN.jpg]` 25 times.

The first idea was labels built from what's written about each photo. The
data ruled that out for now: all 10 shoot places and all 25 descriptions are
blank, and 15 of the photos share May 2025. A month label alone would have
put "may 2025" on 15 rocks. Aidan chose place labels over a visual thumbnail
in each rock, plus time order grouped by year. Each rock carries the
structure, and filling in `places` upgrades every label at once.

- **Newest first, grouped by year.** Deeper goes back in time, as on
  /listening. Each year starts a new row after 0.12 of a screen of extra
  water, under a mono marker (`2026`, `2025`, `2024`, `undated`). Undated
  photos go last. Within a month, filename order is kept, because the
  camera clock's timezone makes the day unreliable.
- **Labels are place and month.** `kyoto · may` once places are written,
  `may` until then. The year is said once, on the marker, not on 15 rocks.
  Clips say `clip`. Undated stills have no label, because the marker already
  says `undated` and a bracket on every rock would be noise.
- **Screen readers hear what is known.** They get the written description
  when there is one, and otherwise "photograph, may 2025" or "clip,
  undated". Never a filename. The markers are `aria-hidden`, since every
  name already carries its year.
- **One order everywhere on the homepage.** The page orders the photos
  once, and the rock, its hidden description and its open caption all read
  from that one list, so they can't come apart.

Pure logic lives in `lib/pond/gallery.ts` (order, group, label, name).
`placePhotoStones` gained optional groups (a new row per group, and
`photoGroupMarkers`, `galleryDepthVh`). An ungrouped gallery is laid out
exactly as before, and every existing layout test passes untouched.
Captions gained `place`, `month` and `year` as separate fields.

**The trade is depth.** The page went from 7.93 to **8.57 screens**. A new
test holds the real 25-photo split under 9. The one-photo 2026 group is the
costliest part: a whole row and a gap for one rock.

Checked in Chrome at 375 and 1280: no overlaps between rocks, labels,
markers, the heading or stone labels, and no horizontal scroll. Today the
2025 group reads "may" 14 times in a row. Only the places can fix that.

The /about grid keeps filename order.

577 tests.

### the gallery's words, in the water

Aidan didn't like the year markers and month labels as plain mono text. All
text in the gallery should be ASCII art like the heading, and all of it
wavier.

- **The font grew to the whole alphabet**, plus digits, `·` and `-`, because
  place names will be whatever Aidan writes. The ten original letters are
  unchanged, and a test pins the heading's first row so it can't drift.
  0 and o, and 1 and l, are tested as distinct.
- **`components/WaterText.tsx`** is now the one way the gallery draws text:
  a block `<span>` rather than a `<pre>`, so it can sit inside a rock's
  `<button>`, and always `aria-hidden`. `WaterFilters` defines the filters
  once per page.
- **Wavier.** Horizontal turbulence frequency dropped from 0.018 to 0.011
  (longer, rolling waves), the drift cycle went to 13s, and displacement
  went from 4.5 to 8 for the heading and markers.
- **Labels needed their own settings.** At 5px with the strong filter,
  "june" tore into noise in the first look. Labels are now 6px with
  displacement 3.5. "OCTOBER" and "clip" read well rolling. Short words
  with narrow letters ("june") still break up at the strongest moments;
  `water-small`'s scale is the number to calm if that bothers anyone.

Checked at 375 and 1280: no overlaps and no horizontal scroll. Screen
readers are unchanged, since the rocks' names still carry the words.

581 tests.

### names instead of months

Aidan's call: no months under the rocks. He'll write a unique name for each
photograph, and that name is the label.

- **Where:** `public/photos/captions.json`, a `name` field on each
  photograph beside `alt` and `line`. `npm run photos:sync` scaffolded a
  blank one on all 25 and lists the ones still unnamed. Checked by
  comparing the file's data before and after: identical apart from the 25
  blank `name` fields.
- **A data-loss bug came first.** The sync rebuilt each entry from a fixed
  list of fields, so any field it didn't know about was silently dropped on
  the next run. A typed name would have been deleted by the very tool meant
  to protect Aidan's words. It now carries every existing field forward
  before filling blanks. The failing test came first, plus one for an
  arbitrary unknown field.
- **The label** is the name, lowercased, reduced to what the banner font can
  draw, and wrapped at word boundaries to 8 letters per line (one banner per
  line, centred), so it fits a phone from a rock near the edge. A single
  longer word stays whole. No name means no label at all.
- **Screen readers:** "photograph, *name*, may 2025" until there's a
  description.

Checked with two temporary names in a build, then restored: "test name"
wraps to two centred lines, and a long name stays inside 375px as three.

590 tests.

## a stone sinking (/impeccable onboard)

The critique found that the first screen gave no reason to scroll. The first
stone's label sits below the fold (y≈830 at 860px tall), and nothing on the
surface says there's more. Aidan chose to keep the surface quiet, with just
his name, and add a cue rather than raise the stones or add words.

- **The cue** is a stone sinking. About 2.2s after arrival, a chain of six
  rings runs from half a screen down (under the identity line) to the first
  stone. Each ring is 0.42s later and a little lower than the last, fading
  as it sinks and swaying slightly, because a dead-straight drop reads as a
  loading indicator. It's the existing splash queue with new points
  (`descentCue()` in `lib/pond/splash.ts`), not a new system.
- **It doesn't nag.** It plays at most 3 times, 6.5s apart, and checks the
  scroll before every play: once the visitor passes 40px it's done its job
  and stops for good. It never plays for someone who arrives already
  scrolled, and never under reduced motion (`shouldPlayCue()`, tested).
- **Calibrated in the browser.** At strength 0.55 → 0.3 it was only visible
  in brightened frames. At 0.8 → 0.45 it shows unbrightened: a ring and its
  trough visibly sink to the stone. That's still below the page-change wave
  (0.85), so it stays an invitation rather than an event.

The Tailor Studio stone's note is now Aidan's own "something i built", in
place of "the thing i built".

600 tests.

### fix: a clicked photo wouldn't go away

Reported: "when hovering to open photos the photo doesn't disappear." A
plain hover-and-leave closed correctly, and so did scrolling or moving rock
to rock. The failing path was **hover, then click**, which is natural,
because you click the thing you're looking at. The click pinned the photo,
and after that only clicking that same rock again closed it. Moving away
didn't, and neither did clicking anywhere else.

The reducer gained a `dismiss` event, test first. It only acts on a pin,
leaving a merely hovered rock to the pointer, and it clears the pin plus the
focus a tap leaves behind. `components/usePinDismissal.ts` sends it, while a
rock is pinned, on two occasions:
- a pointer-down anywhere that isn't a rock (rocks carry `data-rock`);
- the pinned rock scrolling out of view.

The second also fixes the critique's caption that "comes loose" on scroll:
a pinned photo no longer stays open over a stretch of pond its rock has
left. Both pages use it. Checked in Chrome: click-pin then click the water
closes it, pin then scroll away closes it, and on a phone tapping the water
closes it.

603 tests.

### bubbles instead of a sinking stone

Aidan didn't like the sinking-ripple cue ("the bouncing rock just doesn't
look very good"). Of the four alternatives offered, he chose bubbles rising,
placed not at the surface but in a **wider gap between the listening stone
and the gallery**.

- **The ripple cue is gone** completely: `descentCue`, `shouldPlayCue`, its
  tests, its DESIGN.md entry and its effect on the homepage.
- **The gap:** `GALLERY_GAP_VH = 0.45` is added to `PHOTOS_START_VH`, so the
  whole gallery moves down with it. The page is now **9.02 screens** (was
  8.57). Both depth guards were moved on purpose, with comments: 25 items
  ungrouped under 8.5 (was 8), and the real grouped split under 9.5 (was 9).
  They still catch growth nobody chose.
- **The bubbles** (`lib/pond/bubbles.ts`, `components/Bubbles.tsx`): nine
  `o`, `°` and `.` glyphs, in mono and Drowned Grey, spread across the
  column in jittered slots. Each rises the full gap in 5–9 seconds, fading
  in, swaying up to 14px at the midpoint and popping at the top. Starts are
  staggered so they never rise together. The positions come from a seeded
  generator, not `Math.random`, so every visit is the same and the server's
  HTML matches the browser's (no hydration warnings, checked).
- **CSS, and an honest exception to a rule.** `lib/pageFlow.test.ts` forbids
  `transform` keyframes anywhere but `> main`, because in step 7 a
  transformed wrapper became the containing block for the fixed pond. A
  bubble is a leaf holding one glyph, so it can't cause that. The test gained
  an explicit `LEAF_SELECTORS` allowance, with a comment requiring each
  entry to stay a leaf, rather than the animation dodging the rule. The
  bubbles use fill-mode `backwards`, per the held-transform lesson.
- Hidden under reduced motion, working with JavaScript off, `aria-hidden`.

Checked in Chrome: 91px clear of the listening label and 53px clear of the
gallery heading at 375 (118 and 69 at 1280), no horizontal scroll, and the
bubbles visibly rise between frames.

601 tests.

### the pond frame now matches the page's `vh` (phones)

"Phone is still a bit buggy." There's one bug class that fits, and it
was visible in the code rather than reproduced. Headless Chrome has no
address bar to show and hide.

A phone's address bar slides away as you scroll, changing the visible
height. Two parts of the site measured height differently:
- **The pond frame was `fixed inset-0`.** It follows the VISIBLE viewport,
  so it resized as the bar showed and hid. Every resize triggered a rebuild
  and repaint mid-scroll, which shows as a flicker or jump.
- **Everything placed over it uses CSS `vh`**, which phones fix at the
  LARGEST height. The canvas placed the same rocks from its own measured
  height. While the bar was showing, drawn rocks sat above their tap targets
  by roughly 80px for each screen of depth, which is hundreds of pixels
  down in the gallery.

All three pond frames (homepage, inner pages, /listening) are now
`fixed inset-x-0 top-0 h-screen`: 100vh from the top, the same unit as
everything else. They never resize on scroll. While the bar is showing, the
bottom sliver of water sits under it, which is harmless. An opened photo is
placed within the *visible* height (`window.innerHeight`), so it can't land
under the bar. `lib/pondFrame.test.ts` pins the frame shape on all three
pages. It failed first.

Also: bubbles spread across the full width of the pond, not just the 640px
text column. They're edge-anchored slots, clamped to 5–95%.

607 tests.

### back to regular text, swaying

Aidan weighed ASCII against regular text for the gallery's words and chose
regular text for all of it: the heading, the years, and the photo names.

- **The heading** is a real `<h2>`, "photo gallery", in the headline serif,
  muted. It's no longer a hidden heading behind aria-hidden art, so screen
  readers get a landmark from the visible text.
- **Years** are mono label text, muted, and `aria-hidden`, since the names
  carry the year. **Names** are mono label text under the rock, exactly as
  Aidan types them (no lowercasing, no stripping), capped at 9rem and centred
  so long names wrap.
- **The wobble is a transform now, not a filter** (`.water-wobble`): a 7s
  skew of ±1.4° with a 1px lift, each element on its own phase, held still
  under reduced motion. The animated SVG filter it replaces made the
  browser redraw every visible label on every frame. That's graphics-chip
  work headless Chrome can't measure (it reported 60fps and a similar
  main-thread load either way, because it runs without a GPU), but it's the
  likeliest cause of lag on a phone. A transform moves already-drawn text.
  `.water-wobble` joins `.bubble` in the documented leaf allowance.
- `components/WaterText.tsx` and the hand-made font (`lib/banner.ts`) are
  deleted. They're in git history if the ASCII look ever comes back.

**A bug caught before commit:** the name wrapper was `w-36`, which in this
project is **288px**, not 144, because the spacing unit is 8px. A long name
under a right-hand rock made the phone page 402px wide. It's `w-[9rem]` now,
and 40 samples over 10 seconds showed no horizontal scroll.

591 tests.

### a square focus ring

The orange focus outline had a 1px radius, the one rounded corner on a site
whose rule is "no radius, anywhere". Both halves of the critique flagged it.
Aidan chose to square it rather than keep it as a documented exception.

`lib/noRadius.test.ts` now enforces the rule. The stylesheet may declare no
non-zero `border-radius`, and no component or page may use a `rounded-*`
class. Its first run caught a false positive of its own: the word "rounded"
in a comment about phone corners. Comments are now stripped before
searching, the same lesson the `suppressHydrationWarning` and secrets tests
learned.

593 tests.

## polish pass

An independent walk of every page at 1280×860, 768×1024 and 375×667
(touch), with keyboard. The critique's snapshot had closed itself because
the homepage changed since the review, so its items served as input, not as
a checklist.

**Fixed:**
- **Labels over an open picture.** Only the open rock's own label hid, so
  neighbouring names (homepage) and ranks (/listening) were drawn on top of
  the picture: they're HTML over the canvas. Every label now fades out over
  500ms while a picture is open, matching the year markers and heading.
  Measured: 0 of 4 names and 0 of 5 ranks visible while open, at every size.
- **The koi through body text.** On /about at 375, the koi (already dimmed
  to half on inner pages) ran straight through a paragraph, mixing its
  characters into the letters. The inner pages' prose now carries
  `over-water`: a triple text-shadow in the ground colour, a soft halo that
  masks whatever passes behind the words, with no box. Checked in koi and
  paper with the fish mid-paragraph: readable in both.

**Checked and clean:** no horizontal scroll and no console errors on any of
the four pages at any size. Captions stay inside the gutters at every width.
The focus ring is square, solid and 2px on every stop.

**Left for other steps, deliberately:**
- One keyboard stop landed a rock partly off-screen. That's `scroll-margin`,
  part of the critique's keyboard item for `/impeccable harden`.
- The page still ends on the contact placeholders, which is
  `/impeccable delight`.
- The draft alt text on /tailor-studio is Aidan's to review.
- **Observation:** the paper theme's water texture reads busier than the
  dark themes'. It predates this pass.

593 tests.

## paper: sailcloth, and water that's quiet again

Aidan asked for the light theme to be "more of a sail colour rather than
white", and for its water texture to be fixed.

**The colour.** The ground is `#ece6d8`, a warm off-white canvas. Its
luminance is 0.79, against 0.83 for the blue-white and 0.955 for the original
white. Navy ink and blue accents stay. Every pairing clears the contrast
test: ink 12.2:1, muted 4.89:1, links 5.43:1, the koi's head 3.58:1. Water is
a darker sand, `#cfc7b5`. `lib/contrast.test.ts` now pins the theme as a warm
ground with a blue accent.

**The water was a real bug, not a colour.** The pond turned its field into
glyphs through the theme's picture ramp, which flips on a light ground so
photographs stay positive. That flip also turned the pond's own drawing
upside down: the quietest water became the densest glyph, which showed up as
a busy field of faint `@`s, and the koi came out lighter than the water
around it. It has been this way since the themes landed in milestone 4, and
the comment above `POND_RAMP` claimed the opposite.

The fix separates the two ideas:
- **`presenceRamp`**: the pond always draws presence. More of a thing means
  a denser glyph, on every ground, so still water is nearly blank on paper as
  it is at night.
- **`photoPresence`**: a picture goes into the field as presence. On a light
  ground its brightness is inverted, because a dark pixel is more ink, so it
  stays positive. `stampPhoto` takes it as an optional `invert`, off on dark
  themes, which draw exactly as before (tested).
- The /listening fine art now chooses its direction from an explicit
  `lightGround` flag instead of comparing ramps.

**The photographs were washed out too, same root.** On paper the duotone
took the koi's navy tail as its *light* end and pale sand as its *dark* end,
so every photo collapsed into beige. On a light ground it now runs from the
navy tail up to the ground itself. Measured: the same photo spans 47–143 in
brightness on paper, like the dark theme, and it reads as a cyanotype. The
dark themes' duotone is pinned unchanged by a test.

Checked in Chrome at 375 in both themes: the paper homepage has quiet water
and a dense blue koi, photos and covers are positive, and the default theme
is unchanged.

601 tests.

## harden: the keyboard and screen-reader path

Three findings from the critique and polish, each measured in headless
Chrome before the fix and pinned by `lib/keyboardPath.test.ts`:

- **A focused rock could sit half off-screen.** The browser scrolled only
  far enough to show its top edge, so a photograph opened out of sight.
  Stones and rocks (both pages) now carry `scroll-my-[25vh]`. Measured at
  1280×800 and 375×667: every Tab stop lands fully on screen.
- **The gallery was 25 Tab stops** between the last stone and the contact
  links. It's now one (a roving tabindex, `lib/pond/roving.ts`, tested): the
  arrow keys move between rocks in pond order, Home/End jump to the ends,
  and there's no wrapping, because wrapping from the deepest rock would fling
  the page up eight screens. An arrow move centres the rock, smoothly unless
  reduced motion is on. Tabbing back in returns to the rock last visited.
  Nobody finds a one-stop gallery unless they're told, so a mono hint shows
  at the bottom of the screen while a rock has *keyboard* focus
  (`:focus-visible`), never for a pointer. Screen readers get the same
  sentence as an `sr-only` line under the heading.
- **The stones had no landmark, and their notes were silent.** They're in
  `<nav aria-label="pages">`, and each link's note ("what's on repeat") is
  now its `aria-describedby`, because the `aria-label` had replaced it.

/listening keeps its five rocks as five Tab stops, which is short enough.

610 tests. Build output checked: the last.fm key is not in `.next/static`.

## delight: the bottom of the pond

The homepage used to end on three bracketed placeholders floating in the
middle of the last screen, with over half a screen of empty water under
them. The only way back was to scroll the whole descent in reverse.

The thesis: reaching the bottom should feel like arriving somewhere, and
the pond should give you a way back up.

- **The footer sits on the pond floor**: anchored to the bottom of the page
  (`bottom-0 pb-[8vh]`) instead of 0.5 of a screen above it.
- **github is a real link**, to `github.com/Aidanz06`, the account the site's
  repo lives under. Email and LinkedIn stay bracketed placeholders; nothing
  is guessed.
- **"↑ back to the surface"**: a plain `#surface` link, so it works without
  JavaScript. With JavaScript it smooth-scrolls back up through the water
  (instantly under reduced motion). The koi swims up with you, because the
  pond is scroll-driven. Focus goes to the greeting (`tabIndex -1`), so the
  next Tab starts at the top instead of the floor.

No ASCII seabed was added. In the screenshots, the koi resting near the
contacts already reads as the floor, and more drawing there would compete
with it.

Tested in `lib/pondFloor.test.ts`: github has an href, email and LinkedIn
don't, the footer is bottom-anchored, and `#surface` exists. Checked in
Chrome at 1280 and 375: the footer ends flush with the page, there's no
horizontal scroll, and the climb lands at `scrollY 0` with focus on the
greeting.

614 tests.

## contact: email only

Aidan gave his email and chose to list neither GitHub nor LinkedIn, so the
footer is now a single `email` link to `mailto:zheng.ai@northeastern.edu`.
This reverses the github link from the delight step. `lib/pondFloor.test.ts`
now pins it: exactly one contact, the email, with that href.

The address was typed as `nrtheastern.edu`, which I read as a typo for
`northeastern.edu` (the school named on the homepage) and flagged back to
Aidan.

## photo names

Aidan named the 25 photo rocks. I went through a contact sheet and
suggested a name for each one from what's in it. He replaced twenty of the
suggestions with his own (mostly places: osaka, koenji, kamakura, skogafoss
and so on) and kept five as I wrote them (#3 hydrangea, #4 water lilies,
#8 car in the grass, #9 garage pair, #24 capybara lunch). They were written
into the blank `name` fields of `public/photos/captions.json` only. Nothing
else in the file changed, which the diff confirms: 25 lines, every one a
`name`.

## /about: aidan's words in

Aidan answered the questions for the three /about placeholders, and I
shaped his answers without adding anything he didn't say:

- **intro**: jogging, food, and building for fun. It links to
  /tailor-studio, the building project the site already shows.
- **photography**: he started with sports photography in high school, on
  his dad's camera. Now he looks for interesting subjects and pictures that
  bring back what it was like to be there.
- **interests**: cars, running (just starting), food (Beli), building
  things (apps, keyboards, lego), and fortnite (unreal). A short list,
  chosen by him from the brief's longer placeholder list. Gaming sits here
  rather than in the intro, where the rank gives it a detail.

The note under the photo grid ("run `npm run photos:sync`…") was an
instruction to Aidan that visitors could see. It's gone; the README in
`public/photos` already says the same thing.

One placeholder remains, visible and bracketed: the Beli profile link.

## photo descriptions (alt text)

Aidan didn't want to write 25 descriptions, which is reasonable: alt text
only needs to say what's in the frame. I wrote one short sentence per photo
from a contact sheet and put them in the blank `alt` fields of
`captions.json` only. The diff is 25 lines, every one an `alt`. They say
what's visible and nothing more. The one named landmark is the Golden Gate,
which Aidan named himself. No places were added beyond what his photo names
already say.

Screen readers now hear a real description on the /about grid and as each
homepage rock's description, instead of "[photograph — aidan to describe]".

## tailor studio copy, slide descriptions, places

- **The page, less like a generated case study.** The bold-lead bullet
  lists (problem / approach / decisions / result) became plain first-person
  paragraphs, using only facts already on the page. At Aidan's request the
  authorship section is gone. PRODUCT.md records the change: the page no
  longer says who built it, and nothing claims he wrote the code by hand.
- **An eval-harness paragraph**, with a visible bracket for what it checks
  and the bar it has to clear. Only Aidan knows those, and the page states
  only what was already true: the ai steps are gated by accuracy tests, and
  a model sweep picked the cheapest setup that passed. The unused
  `{/* DRAFT */}` marker is removed.
- **Slide descriptions are one short line each.** The page prose already
  says the rest. Aidan asked for concise, so they're marked checked
  (`draft: false`), which removes the visible "[draft alt — aidan to check]"
  line under each slide. Screen readers still get the line.
- **Places**: nine shoot dates filled from Aidan's confirmation.
  2025-05-20 (the capybara) is still blank.

The eval-harness bracket is now filled from Aidan's explanation: fixtures
of hand-labelled photos, a clustering-accuracy regression gate, and a
resumable sweep weighing accuracy against API cost across models and
batching strategies. His source text gave "say, 40 photos" only as an
example, so no fixture count or threshold appears on the page. Its lines
about what makes the work impressive were left out: the page shows the
work, and the reader can judge it.

## the domain: www.aidanzheng.me

The domain was already live. `aidanzheng.me` 308-redirects to
`www.aidanzheng.me`, so www is the canonical address, and `site.url`
(previously `https://example.com`) is set to it.

- **`metadataBase`** in the root layout, so every URL in the metadata
  resolves against the live domain.
- **Canonicals per page** (`/`, `/tailor-studio`, `/about`, `/listening`),
  never in the layout: a layout canonical would be inherited by every page
  and tell search engines they're all the homepage.
- **`app/sitemap.ts` and `app/robots.ts`**, both built from
  `lib/siteMeta.ts`. /lab, the noindex workbench, is left out of the
  sitemap and disallowed in robots.
- **Link previews**: `pageOpenGraph()` gives each page its own title
  ("tailor studio — aidan zheng") and description on top of the shared
  site name, type and locale, plus `twitter:card = summary_large_image`.
- **The preview image is a real screenshot**: the homepage at 1200×630 from
  the production build in headless Chrome, koi theme, with the theme button
  hidden for the capture. Of six frames, I used the one where the koi curves
  under the name without crossing it (`public/preview.png`, 40 KB).

**A bug found on the way, test first.** I began with the file convention
(`app/opengraph-image.png`). The built HTML showed it only on `/`: a page
that sets its own `openGraph` replaces the parent's wholesale, file-convention
image included, so /about, /tailor-studio and /listening had no og:image. The
image now lives in `public/` and `pageOpenGraph` carries it explicitly.
`lib/siteMeta.test.ts` checks that every public route's preview has it and
that the file really is 1200×630.

Verified from the production build: each page has the right canonical,
og:title and og:image; `/preview.png` serves; robots and the sitemap point
at www; the last.fm key is not in `.next/static`. 626 tests.

## the link preview becomes a mark

Aidan asked for something closer to a logo: the koi and a couple of rocks,
without his name. The preview's title already carries the name, so the
picture doesn't need to.

The homepage screenshot approach doesn't work for this. With the text
hidden, a live frame at 1200×630 is mostly empty water with small, dim
stones. At higher pixel density the characters get chunky enough, but the
koi's pose is luck: most frames cut it off at an edge.

So the mark is composed rather than captured, from the pond's own code:
`stampKoi` with a hand-built spine (a 235° arc, so the fish curls), and
`stampStone` for a stone inside the curl and a larger one beside it. Stones
are at their hovered brightness, so they hold their own next to the fish.
Water is the same wave field at base brightness. Cells go through
`presenceRamp` exactly as the pond draws them (the first attempt skipped it
and drew the water in dense `%`s). It's drawn in Chrome in the site's
JetBrains Mono and koi-theme colours, 480×252 at 2.5×, giving 1200×630.

`public/preview.png` is replaced and `PREVIEW_IMAGE.alt` describes the new
picture. The composer is a scratch script in the gitignored
`Claude outputs/verify/logo/` folder, not part of the site.

**Follow-up: the new preview didn't show.** The live site was already
serving the new file (its hash matched the commit), but it was at the same
URL, `/preview.png`, and link previews are cached by URL. It's now
`/preview-koi.png`. The rule, noted in `PREVIEW_IMAGE`: a new picture gets
a new file name.

## second critique (22/32), and the fixes Aidan chose

A fresh `/impeccable critique` ran as two independent agents: a design review
and the detector. It scored 22/32 (from 20), with heuristics 7 and 10 n/a.
The detector's five findings were all false positives: a template-string
`<img>`, "wobble" read as bounce easing, zeroed margins counted as spacing,
and the deck's hidden crossfade slides. Aidan's call on the rest:

- **Recognisable rocks** (P1) comes first, as a brainstorm before building.
- **The koi's behaviour and the first screen stay as they are.** That means
  no steering around text and no raising the first stone.
- **Everything else, now.**

### rock names are in their accessible names

The name under a rock ("qianling bridge") wasn't in the button's
accessible name, which was just the description. A voice-control user
couldn't say what they could see (WCAG 2.5.3, label in name). `rockName` now
leads with the name: "qianling bridge: A stone arch bridge over a lake…".
Tested in `gallery.test.ts`.

### opened photographs dissolve instead of ending in a box

Opened photos showed straight top and right edges. There were three causes,
each pinned in `lib/photoEdge.test.ts`:

1. **The vignette faded into an opaque fill of the ground colour.** That's
   a rectangle of plain ground laid over the water dots, so the box showed
   exactly where the dots stopped. It's now a mask (`destination-in`) that
   fades to transparent.
2. **The radial never reaches the long sides of a landscape photograph.**
   Each side now also fades linearly over `PHOTO_FEATHER` of the short side,
   the same width as the characters' feather.
3. **With the edge transparent, the photo's own coarse characters showed
   through** as a rectangle of koi-red dots. The fill had hidden them. The
   homepage's characters now step aside as the real image arrives, exactly as
   /listening's already did for its fine art, so what's under the fade is
   plain water. `stampPhoto` is feathered for every picture, not only ASCII
   ones.

Checked in Chrome for koi, paper and phosphor, at 1280 and 375. The photo
fades into the water on all four sides, and closing it leaves no residue. The
second and third tests were written as each problem appeared in the browser.
The third was red first; the second landed with its fix.

### /listening's title, the /about order, a pond 404, a checked theme

- **/listening's h1 is `text-name`**, like every other page title, instead
  of `text-heading`. `lib/pageHeadings.test.ts` checks every page's title,
  the 404 included.
- **The /about grid runs newest first**, through the same `orderGallery` as
  the pond. It was in filename order, with june 2026 sitting among may 2025.
- **A 404 in the pond** (`app/not-found.tsx`): the inner pages' quiet water,
  "nothing here / this part of the pond is empty." and "↑ back to the
  surface". It replaces Next's unstyled default. It returns a real 404
  status and is noindexed.
- **The no-flash theme script only applies a real theme.** It applied
  whatever was in `aidan-theme`, and a stale or hand-edited value matched no
  CSS theme block. The script now lives in `lib/themes.ts` as
  `themeScript()` and is tested by running it against a stand-in page. The
  first browser check still showed "dark": Chrome had served its cached copy
  of the old build. With the cache disabled, "dark" falls back to koi.

## the gallery, grouped by shoot

From the second critique's biggest finding: "the gallery is 25 blind
choices". 2025 was one run of 17 rocks, 12 of them the same kamakura day.
There were two candidate fixes. **A** drew each rock as a tiny character
version of its photo. **C** grouped the rocks by shoot. I mocked both from
the real photos in the site's font. At rock size A came out as a texture,
not a picture, and Aidan chose **C only**.

- **`orderGallery`**: still newest month first and undated last. Within a
  month, each place is now kept together, in the order it first appears,
  so kamakura's two days are one set rather than split around osaka.
- **`galleryGroups`**: one marker per shoot (place and month, "kamakura ·
  may 2025"). Neighbouring single-photo shoots share one marker that names
  their places and the span they cover. Without that, the six lone photos
  would each cost a marker and a row, and the pond would get longer for no
  gain.
- Real data gives five markers where there were four: "qianling, hawaii,
  kaua'i · 2025–2026", "kamakura · may 2025" (11), "osaka · may 2025",
  "kichijoji, london, san francisco, hangzhou · 2024–2025", and "undated".
  The page is 7311px at 1280×800, against 7215px before, with no horizontal
  scroll at 375.

Ran under `/impeccable layout`, whose layout-scoped detector was clean.
Tested in `gallery.test.ts`, written before the code.

## delight: a new pond spreads from where you chose it

`/impeccable delight`. The thesis: choosing a theme should feel like the
pond changing, not a stylesheet swapping. The theme was the one choice on
the site with no response. The palette snapped from one set of colours to
the next, while everything else (pointer, page changes, stones) already
answers in water.

- **The ring**: `ThemeMenu.choose` runs the change inside
  `document.startViewTransition`, then animates
  `::view-transition-new(root)` from `circle(0)` to a circle that covers the
  farthest corner (`themeRingRadius`), centred on the ◐. The browser's
  default cross-fade is switched off in `globals.css`, so only the clip moves.
  The state updates in `flushSync`, so the new snapshot is the finished page.
- **A splash where it started**: `requestSplashAt` queues one ripple at
  the glyph, since a single ripple reads as something dropped in. The page
  change keeps its travelling wave.
- **Timing**: 700ms, ease-out cubic. The first attempt used an exponential
  curve over 620ms and covered the screen in about 150ms, so the ring
  barely registered. Checked by capturing frames mid-transition.
- **Reduced motion or no view transitions**: an instant switch, the same
  result without the movement (`themeChange`, tested). Checked in Chrome by
  emulating reduced motion: paper is fully applied at the first frame.
- Focus returns to the theme control either way.

## the intro line

At Aidan's request, the homepage intro gains "interested in building and
designing": `site.identity` now reads "a third year student at
northeastern, interested in building and designing". It's one line at
1280. At 375 it wraps cleanly after "northeastern," with no horizontal
scroll.

## polish pass

`/impeccable polish`, after the delight pass. The morning's critique
snapshot had closed itself when PondHome changed, so this was an
independent pass. It was one batched inspection round (every page plus the
404, at 1280 and 375, in the koi and paper themes, with an opened photo and
keyboard focus) and then one confirmation round.

Holding up: no horizontal scroll anywhere, the grouped gallery, the new
photo edges on a phone (which also fixed the critique's "photo runs to the
screen edge while the caption stays in the gutter"), the 404, and the
/listening title.

Fixed, tests first:
- **The focus ring was drawn in the middle of an open photograph.**
  Arrowing to a rock opens its picture, and the square accent ring sat on
  top of it. While that rock's picture (or /listening cover) is open, the
  ring is transparent; the picture, its caption and the arrow-key hint
  indicate focus. Measured: accent before the picture opens, transparent
  once it has. `keyboardPath.test.ts`.
- **/about repeated "kamakura · may 2025" under eleven tiles.** The grid
  now uses the pond's groups: one `h3` marker per shoot over its tiles, and
  each tile captioned with its name, as the rocks are.
  `gallery.test.ts`.

Left standing on purpose: the Tailor Studio deck's own visual style (those
are the deck's slides), and the koi crossing text (Aidan's call). The
detector is clean on the changed files.

## third critique (22/32), and the five fixes

A third `/impeccable critique` ran as two independent agents, this time with
touch emulation. It held at 22/32. Everything fixed that morning checked
out, and the phone pass found two bugs the earlier runs never exercised. The
detector's findings were the same false positives as before. Aidan chose
all five fixes, with /about getting only an email as its floor. Each fix was
reproduced first, with tests before the code, and verified in Chrome
afterwards.

1. **Theme menu on a phone** (`lib/themeMenu.ts`, `ThemeMenu.tsx`).
   - Reproduced: at 375 the greeting wraps, ◐ lands at x≈350, and the menu
     opened rightward off the screen. The labels were cut off and the page
     widened to 452px.
   - Separately: hover-to-open plus click-to-toggle means one tap opens and
     shuts the menu wherever the browser fires both (Android Chrome). An
     iPhone treats the first tap as the hover, which is why it looked fine
     to Aidan.
   - Now hover opens only for `pointerType === 'mouse'`, a tap is one clean
     toggle, and `menuSide()` opens the menu leftward when rightward would
     run off the screen.
   - Verified: one tap opens it at x 250–355, with scrollWidth 375.
2. **A pinned caption detached on scroll.**
   - The picture follows its rock, but the caption was `position: fixed` at
     the spot where the picture settled. Reproduced: after a 120px scroll it
     floated in the water below the photo.
   - Now the rect is converted once into `<main>`'s coordinates and the
     caption is `absolute`, on the homepage and /listening.
   - Verified: the caption's top moved 541 → 421 for a 120px scroll.
3. **Labels and the ring stepped aside too late.** They waited for the
   settled rect, up to ~3.5s after an arrow key. Now
   `stepAside = photoOpen || (activePhoto !== null && !reducedMotion)`.
   Under reduced motion the picture never animates open, so the labels stay
   (`useReducedMotion`). Verified: both are gone at 0.7s.
4. **A resting mouse opened pictures mid-scroll** (`hoverIntent`,
   `useHoverIntent`). A hover counts only when the pointer has moved since
   the last scroll. A mouse-move path on each rock catches the case where
   mouseenter arrives before the move is recorded. Verified: a rock wheeled
   under a still pointer stays shut, and pointing at it opens it.
5. **/about ends with the email.** The previously unused `Footer` (email
   above a hairline rule) closes the page, and its link now has `hit-area`.
