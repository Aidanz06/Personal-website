# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences, neither ranked above the other:

- **People arriving from LinkedIn**: recruiters, hiring managers and
  professional contacts forming a first impression of Aidan.
- **People who know Aidan, or are about to**: friends, classmates, people
  he meets, who want to see what he's like and what he's into.

Both usually arrive through a shared link, often on a phone, and spend a
few minutes at most.

## Product Purpose

aidan zheng's personal site: what he makes, what he shoots, what he listens
to. Aidan is a third-year student at Northeastern.

A visit succeeds when someone leaves with:

1. **a sense of who Aidan is**: his taste and what he cares about, carried
   by the photographs, the music, and how the site itself is made;
2. **his work**: that he built Tailor Studio, and how he thinks about
   building things;
3. **a memory of the site itself**: something people remember and mention.

Being contacted is not a success measure. Contact links exist, but they
aren't the goal of a visit.

## Positioning

The whole site is an ASCII koi pond you descend. Water, ripples, a koi that
swims alongside the reader, stepping stones that are the pages, and
photographs resting on the bottom as rocks you bring up: all drawn as
characters on one canvas. The pages are in the water rather than laid over
it, and the site is built so that everything is also real, accessible HTML.

## Operating Context

- Routes: `/` (the pond: greeting, navigation stones, photo gallery rocks,
  contact links at the bottom), `/tailor-studio` (a case study with its
  12-slide deck), `/about` (prose plus the photograph grid), `/listening`
  (the month's top five tracks from last.fm, opening as ASCII album covers).
- Three themes, selectable from a control beside the name: koi (default),
  phosphor, paper.
- Content updates Aidan does himself: dropping photos into `public/photos`
  and running `npm run photos:sync`; editing `content/listening.json` (the
  hide list); writing MDX copy. /listening refreshes from last.fm on its own
  every six hours.
- Deployed on Vercel from the GitHub repo `Aidanz06/Personal-website`;
  pushes to `main` deploy.
- Live at `https://www.aidanzheng.me`. The apex redirects to www, so www is
  the address canonical links, the sitemap and link previews use.

## Capabilities and Constraints

- Next.js 16 app router, static pages with ISR, React 19, TypeScript,
  Tailwind v4, MDX, vitest. The pond renderer (`lib/pond`, `lib/ascii`) has
  no dependencies. New dependencies need Aidan's approval first.
- last.fm credentials (`LASTFM_API_KEY`, `LASTFM_USER`) are server-only; a
  test asserts they never reach the client bundle.
- Scripts never overwrite source media or anything Aidan wrote. They write
  new files, and fill only blank fields.
- A bug becomes a failing test before it is fixed. `docs/build-notes.md`
  gets a section for each piece of work.
- **Open decisions:**
  - the all-lowercase voice: current practice, not yet decided as a rule;
  - the "no pitch" stance (no résumé, co-op, GPA or hire-me framing):
    current, but may change;
  - naming camera, lens or audio gear: currently never done, not a rule.

## Brand Commitments

- The name is written "aidan zheng".
- Tailor Studio is described honestly. It was built with Claude: Aidan found
  the problem, scoped it, set the bar and steered, and Claude wrote most of
  the code. As of 2026-09-24 the page no longer states who built it
  (Aidan's call). The copy still never claims he wrote the code by hand.
- Unfinished content appears as a visible bracketed placeholder, never as
  plausible filler.

## Evidence on Hand

- **Photographs:** 22 stills and 3 silent clips in `public/photos`, with
  `captions.json`. As of 2026-09-24 all 25 lack descriptions, 10 shoot dates
  lack a place, and 5 clips lack a date.
- **Tailor Studio deck:** 12 slides in `public/tailor-studio/slides`. Six
  are clipped on the right in the source PDF; their alt text is drafted and
  awaiting Aidan's check.
- **Listening:** live last.fm data for the user `azyaya123`.
- **Absent, and not to be fabricated:** /about prose (four placeholders),
  testimonials, metrics, press. Contact is email only
  (`zheng.ai@northeastern.edu`); Aidan chose not to list GitHub or LinkedIn. Nothing about Tailor
  Studio's usage or results beyond what Aidan states.

## Product Principles

1. **The pond is the site.** New content belongs in the water: a stone, a
   rock, something surfacing. It isn't a page bolted on beside it.
2. **Show, don't claim.** Taste and work are demonstrated through the
   photographs, the music, the project and the craft of the site. Qualities
   are never asserted in copy.
3. **Everyone gets the same site.** Mobile first among equals, then
   keyboard, screen reader, JavaScript off and reduced motion. None of these
   gets a lesser version.
4. **Honest about what is unfinished and who made what.** Visible
   placeholders, truthful authorship, no invented evidence.

## Accessibility & Inclusion

- Mobile is the main concern: every page must work at 375px wide, with no
  horizontal scroll and comfortable tap targets.
- Full function by keyboard and screen reader; the canvas is decorative and
  `aria-hidden`, and every stone and rock is a real link or button.
- Works with JavaScript off (plain HTML fallbacks), and honours
  `prefers-reduced-motion`.
- Text contrast of at least 4.5:1 (WCAG AA) in every theme, and 3:1 for the
  koi, enforced by `lib/contrast.test.ts`.
