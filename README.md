# aidan zheng — personal site

a personal website drawn as an ascii koi pond. you scroll down through the
water, the stepping stones are the pages, and my photographs sit on the
bottom as rocks you can bring up.

<!-- add the live url here once it's deployed -->

## what's on it

- **the pond** (`/`): a koi swims alongside you as you scroll down. the
  stones link to the pages below and the photo rocks open in place.
- **tailor studio** (`/tailor-studio`): a desktop app i made for listing
  clothes on grailed, told as a short story with the slide deck.
- **about** (`/about`): a bit about me, plus the photographs and clips.
- **listening** (`/listening`): my five most-played tracks of the month,
  pulled from last.fm and drawn as ascii covers.

three themes (koi, phosphor, paper) sit behind the small control next to
my name.

## how it works

everything in the pond (water, ripples, the fish, stones, photographs)
writes brightness into one grid of character cells, and a single canvas
draws that grid through a density ramp. the stones and photo rocks are real
links and buttons laid over the canvas, not canvas hit-testing, so the site
works with a keyboard, with a screen reader, and with javascript turned off.
with `prefers-reduced-motion` set, nothing animates.

[`docs/build-notes.md`](docs/build-notes.md) walks through every milestone:
what was built, the decisions, and the bugs.

## stack

next.js 16 (app router, static + isr) · react 19 · typescript · tailwind v4 ·
mdx · vitest. the pond renderer has no dependencies. it's plain canvas code
in `lib/pond` and `lib/ascii`.

## running it

needs node 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # optional: last.fm key for /listening
npm run dev
```

without a last.fm key, `/listening` shows clearly labelled example data.

| script | what it does |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run build` / `npm start` | production build and serve |
| `npm test` | unit tests (vitest) |
| `npm run typecheck` | typescript, no emit |
| `npm run photos:sync` | adds new files in `public/photos` to `captions.json` without overwriting anything |

`scripts/pdf-to-slides.swift` and `scripts/video-to-loop.swift` prepare the
slide deck and video clips. they use apple frameworks, so they only run on
macos.

### adding a photograph

1. **remove location data first.** phone photos carry gps coordinates, and
   files in `public/` are publicly downloadable.
2. drop the file in `public/photos/`.
3. run `npm run photos:sync`, then fill in the blanks it lists in
   `public/photos/captions.json`.

## deploying

built for vercel. set `LASTFM_API_KEY` and `LASTFM_USER` as environment
variables in the project settings. `/listening` revalidates every six hours.

## how this was built

i built this with claude, anthropic's coding agent. i came up with the
idea, made the design calls, and reviewed every step; claude wrote most of
the code. the co-author lines on the commits say the
same thing.

## rights

© aidan zheng. the photographs, video, and writing are mine, all rights
reserved.
