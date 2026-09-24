# photos

The photographs **and clips** on the site. They appear in two places from this
one folder: as the rocks down the pond, and as the grid on /about. A clip is a
rock like any other — it just moves once it opens.

## adding a photograph

1. Drop the file in here (jpg / png / webp / avif).
2. Run `npm run photos:sync`.
3. Fill in what it tells you is blank, in `captions.json`.

## adding a clip

Clips are **not** dropped in raw. A phone records 1080p60 at around 13Mbps
with an audio track; the pond plays it silently in a box a few hundred pixels
wide, so the raw file is roughly ten times what is needed.

```
swift scripts/video-to-loop.swift ~/somewhere/clip.mp4 \
  public/photos/website-NN.mp4 public/photos/posters/website-NN.jpg
```

That drops the audio, scales to fit 540x960, halves the frame rate to 30,
encodes at 900kbps, and writes a poster frame. Then run `npm run photos:sync`
as usual.

**Never point it at a file already in this folder.** The script refuses, and
that guard exists because the first run of this pipeline transcoded three
clips and copied them back over the originals, destroying the only copies.

A clip has **no date**, and the sync checklist will say so. An mp4's internal
timestamp is rewritten by any transcode, so reading it would record the day
the file was processed as the day the clip was shot. Type the real date in.

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
- **A file with no camera EXIF gets no date.** Two of the images here are
  Lightroom exports carrying no make, no model and no exposure block, and a
  `DateTimeOriginal` equal to the day they were exported. Believing that would
  invent a shoot date and a whole phantom day to name, so the sync leaves
  those blank and lists them. Same for clips.
- **Only the month and the year are ever shown**, for the same reason.
- **The camera body and the lens are never shown**, and are not read out of
  the file at all.

Nothing here is required. A photograph with no entry, or with every field
blank, still renders — it simply has no caption, which looks like a
photograph with no caption rather than like a hole in the page.

Keep each file under ~250KB after optimisation; see the performance budget in
the PRD. Files are routed through Next's image optimiser, so the originals in
here can be full-size camera exports.
