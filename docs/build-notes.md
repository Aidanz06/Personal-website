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
