---
target: the homepage
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
target_identity: "file:/Users/aidanzheng/Desktop/personal-site/components/PondHome.tsx"
target_fingerprint: "sha256:1ebbe9a3b63235ecc99965143cfc6b8a83cb488b10b5dd098fc2468506fba93a"
target_path: /Users/aidanzheng/Desktop/personal-site/components/PondHome.tsx
timestamp: 2026-09-24T09-59-52Z
slug: components-pondhome-tsx
---
Method: dual-agent (A: design review · B: detector + browser)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | ~2.5–4s surfacing with labels/focus ring drawn over the photo; theme ring is great feedback |
| 2 | Match System / Real World | 3 | Nothing says rocks are photos before first hover |
| 3 | User Control and Freedom | 3 | Pinned caption stays behind on scroll |
| 4 | Consistency and Standards | 3 | Theme glyph mixes hover-open and click-toggle, breaks on touch |
| 5 | Error Prevention | 3 | Resting pointer opens photos as rocks scroll under it |
| 6 | Recognition Rather Than Recall | 2 | Photos invisible until opened; 16–20px specks on a phone |
| 7 | Flexibility and Efficiency | n/a | Experience surface |
| 8 | Aesthetic and Minimalist Design | 3 | Gallery middle is ~5 screens of similar specks |
| 9 | Error Recovery | 3 | Pond 404 a real improvement |
| 10 | Help and Documentation | n/a | Experience surface |
| **Total** | | **22/32** | **Acceptable (69%)** |

## Design Specificity Verdict
Highly specific; slips are execution on phones and in-between states, not identity. Only generic pattern: /about square grid. Detector: CLI 1 (broken-image Slideshow.tsx:61), browser 3 on / (bounce-easing ×2, monotonous-spacing) + 1 on /tailor-studio (buried-raster) — all false positives.

## Priority Issues
- [P1] Theme menu broken on touch: first tap opens+closes (mouseenter then click toggle); second tap opens a left-anchored menu off the right edge at 375 (ThemeMenu.tsx:153–173, 192). Fix: hover-open for mouse only, click always opens, right-anchor near the edge. Command: adapt.
- [P1] Pinned photo caption detaches on scroll: photo follows rock, caption fixed at settle point (PondHome.tsx:353–367, Pond.tsx ~1072). Fix: caption in document coordinates or re-report rect while moving. Command: harden.
- [P2] Labels and focus ring cover the photo while it surfaces (gate is settled rect, PondHome.tsx:80). Fix: fade on intent (activePhoto !== null). Command: polish.
- [P2] Flat endings; no email or onward link on inner pages. Fix: inner-page floor. Command: layout.
- [P3] Resting pointer opens photos mid-scroll. Fix: require pointermove since last scroll. Command: harden.

## Persona Red Flags
- Casey: theme menu fails; specks; drifting caption; deck text ~6px.
- Sam: ring over surfacing picture ~3.5s; hint says ↑↓ only.
- Jordan: rocks-as-photos unannounced; two galleries; /listening says it three times.
- Recruiter: no stack/timeframe/link; email only at the bottom of the homepage.

## Minor Observations
Opaque theme menu over the tagline; "kamakura" name under a kamakura marker; no personal lines; "cars" without a detail; 404 has two links home; deck pills break no-radius (product branding).

## Questions to Consider
- Is the pond gallery for looking at photos or for finding them?
- What should the last feeling be?
- Coarser /listening covers?
