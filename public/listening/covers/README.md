# album covers for the boulders

The albums in `content/listening.json` under `neverLeave` — the ones that
never leave — keep their cover art here, in the repo.

Run `npm run listening:covers` to fetch them. It downloads each boulder's
cover once from last.fm, writes it here, and fills in the `cover` field in
`content/listening.json` **only where that field is blank**. It never
overwrites a file that already exists and never overwrites a value you typed,
so it is safe to run as many times as you like.

Boulders read their covers from this folder, so they do not depend on a live
API at all. The pebbles — the "on repeat" layer — do.
