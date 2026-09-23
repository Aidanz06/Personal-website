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
