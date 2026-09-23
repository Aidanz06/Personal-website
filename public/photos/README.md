# photos

Photographs the koi carries. Drop image files in here (jpg / png / webp /
avif) and they are picked up on the next build — no code change needed.

Two synthetic stand-ins are here so the mechanism works before real
photographs exist — one landscape, one portrait, because sizing bugs that
only bite tall images are invisible against a landscape test pattern. Delete
both once yours are in.

Regenerate them with:

    node scripts/generate-test-image.mjs 1200 900 public/photos/00-placeholder-test-pattern.png
    node scripts/generate-test-image.mjs 900 1350 public/photos/01-placeholder-portrait.png

Keep each file under ~250KB after optimisation; see the performance budget in
the PRD.
