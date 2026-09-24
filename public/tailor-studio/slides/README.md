# tailor studio slides

Numbered images, one per slide: `01.png`, `02.png`, `03.png`, …

The twelve here were rendered from `docs/tailor-studio-design.pdf` in the
[tailor-studio](https://github.com/Aidanz06/tailor-studio) repo.

## regenerating them from a new PDF

```
swift scripts/pdf-to-slides.swift ~/path/to/tailor-studio-design.pdf \
  public/tailor-studio/slides
```

macOS only, and it installs nothing — PDFKit and CoreGraphics are already on
the machine. Each page is trimmed to its own content, because the deck is
exported to Letter paper and the slide sits in the middle of a portrait page
with white bands above and below it. Pass `keep-margins` as a last argument
to leave them on.

Then update `../slides.json`: the script does not touch it, so an added or
reordered slide keeps whatever alt text its **filename** already had. Check
that they still line up.

## the rules

- **Order comes from the filename.** Reordering the deck is renaming files.
  Numbers are compared numerically, so `10.png` sorts after `2.png` either
  way, but zero-padding keeps the folder readable.
- **PNG or JPEG.** Width and height are read from the file header, so the
  page reserves the right box before the image arrives and nothing jumps.
- **Every slide needs alt text**, in `../slides.json`, keyed by filename.
  These are pictures of text — without a description the slide is invisible
  to a screen reader. A slide with no entry renders a visible bracketed
  placeholder saying so.
- **`draft: true` means Claude wrote the alt text and Aidan has not checked
  it.** It renders as `[draft alt — aidan to check] …` under the deck until
  that is set to `false`.
