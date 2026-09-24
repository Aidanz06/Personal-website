# tailor studio slides

Drop the presentation here as numbered images: `01.png`, `02.png`, `03.png`, …

- **Order comes from the filename.** Reordering the deck is renaming files.
  Numbers are compared numerically, so `10.png` sorts after `2.png` either
  way, but zero-padding keeps the folder readable.
- **PNG or JPEG.** Width and height are read from the file header, so the
  page reserves the right box before the image arrives and nothing jumps.
- **Every slide needs alt text.** Add it to `../slides.json`, keyed by
  filename. A slide with no entry renders a visible bracketed placeholder
  saying so — on the page and in the alt attribute — rather than shipping
  silently inaccessible.

If you have a PDF instead of images, leave it here and say so: converting it
one image per page needs a tool that is not installed yet, and nothing gets
installed without asking first.
