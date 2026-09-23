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
