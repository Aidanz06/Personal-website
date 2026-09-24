---
target: the homepage
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/aidanzheng/Desktop/personal-site/components/PondHome.tsx"
target_fingerprint: "sha256:93a620633d8d7699f0336af30448b9bd287ee8b3ee699e9e517f64bc2d65f891"
target_path: /Users/aidanzheng/Desktop/personal-site/components/PondHome.tsx
timestamp: 2026-09-24T09-03-25Z
slug: components-pondhome-tsx
closed: true
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Surfacing, pinned state, keyboard hint good; a 9-screen descent has no depth cue |
| 2 | Match System / Real World | 3 | Rocks = photographs only clear at the "photo gallery" heading |
| 3 | User Control and Freedom | 3 | Esc, back to the surface, back links; no surface-to-gallery jump |
| 4 | Consistency and Standards | 2 | /listening h1 smaller; /about order differs from pond; rock name not in accessible name |
| 5 | Error Prevention | 3 | Theme script trusts stored value |
| 6 | Recognition Rather Than Recall | 2 | 25 near-identical rocks; cryptic ◐ |
| 7 | Flexibility and Efficiency | n/a | Experience surface |
| 8 | Aesthetic and Minimalist Design | 3 | Koi crosses reading text; deck speaks another language |
| 9 | Error Recovery | 3 | Default Next 404 |
| 10 | Help and Documentation | n/a | Nothing to document |
| **Total** | | **22/32** | **Acceptable (69%)** |

## Design Specificity Verdict
Authored core: koi in the stones' grid, lowercase notes, theme-duotoned surfacing (paper cyanotype), Aidan's rock names, pond-floor ending. Slips at edges: the boxed Tailor Studio deck (gold italic, pill tags), hard top/right edges on opened photos, a stock 3-column /about grid.
Detector: CLI 2 findings (broken-image Slideshow.tsx:61, bounce-easing globals.css:331), browser 3 (bounce-easing, monotonous-spacing, buried-raster on /tailor-studio) — all false positives. /about and /listening clean. The real issues are behavioural and beyond its rules.

## Priority Issues
- [P1] Gallery is 25 blind choices — identical rocks, ~2.5s per reveal, 2025 ≈17 rocks. Fix: per-photo rock signature (density/aspect from its image), split 2025. Command: delight / layout.
- [P1] Koi crosses reading text (h1, /about, /tailor-studio paragraphs on mobile). Fix: dim to ~30% or steer around the text column on inner pages. Command: quieter.
- [P1] Visible rock name not in accessible name (lib/pond/gallery.ts:78), WCAG 2.5.3. Fix: name first, e.g. "qianling bridge, june 2026". Command: harden.
- [P2] First screen has nothing to do: first stone at 0.95 screen. Fix: raise to ~0.75. Command: layout.
- [P2] Consistency slips: hard photo edges, /listening h1 text-heading, /about order, default 404, unvalidated theme. Command: polish.

## Persona Red Flags
- Casey: koi over paragraphs; 25 tap-and-wait cycles; open photo runs to screen edge while caption stays in gutter.
- Sam: label-in-name; focus ring drawn over the open photo; faint theme glyph.
- Jordan: no scroll cue; rocks-as-photos learned late; ◐ unexplained.
- Recruiter: no field on first screen; tailor studio labelled only "something i built"; footer shows "email" not the address.

## Minor Observations
Label/koi/year collisions; /about repeats "kamakura · may 2025" 12×; lone 2026 photo then empty water; weak names ("osaka 2", "green"); canvas lags a jump-scroll >1s.

## Questions to Consider
- What would let a rock hint at its picture while staying in the grid?
- Should the koi steer around reading text?
- Does "something i built" hide the strongest thing on the site?
