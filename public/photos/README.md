# photos

The photographs on the site. They appear in two places from this one folder:
as the photo rocks down the pond, and as the grid on /about.

## adding one

1. Drop the file in here (jpg / png / webp / avif).
2. Run `npm run photos:sync`.
3. Fill in what it tells you is blank, in `captions.json`.

Step 2 reads each file's EXIF and writes the date and the exposure into
`captions.json` for you. It never touches a word you wrote, so it is safe to
run as often as you like. Step 3 is the only part that needs you.

## captions.json

```json
{
  "places": { "2025-05-22": "kamakura" },
  "photos": {
    "website-01.jpg": {
      "alt": "what the photograph shows, for a screen reader",
      "line": "an optional line from you",
      "date": "2025-05-22",
      "settings": "f/8 · 1/160 · iso 320"
    }
  }
}
```

- **`places` is keyed by shoot date**, not by photograph, so a day out is
  named once rather than thirty times.
- **`alt` is not optional.** Without it the site shows
  `[photograph — aidan to describe: …]`, visibly, in place of a description.
- **`line` is optional.** Most photographs do not need one.
- **`date` and `settings` are filled in by the sync script.** If you correct
  a date by hand it stays corrected — the script only ever fills a blank,
  because the camera clock is on the wrong timezone and a re-read would put
  the wrong date back.
- **Only the month and the year are ever shown**, for the same reason.
- **The camera body and the lens are never shown**, and are not read out of
  the file at all.

Nothing here is required. A photograph with no entry, or with every field
blank, still renders — it simply has no caption, which looks like a
photograph with no caption rather than like a hole in the page.

Keep each file under ~250KB after optimisation; see the performance budget in
the PRD. Files are routed through Next's image optimiser, so the originals in
here can be full-size camera exports.
