# Research overhaul: binding brief (owner approved "추천대로 진행해", 2026-10-31)

## Specs (binding, in this order)
1. /home/eser/dev/ww6-research-changes.md: the approved change list. It wins where it differs from the design.
2. /home/eser/dev/ww6-research-design.md: the full design, with rules, data, mockups and tests.

## Owner decisions (final)
- **Slots:** drop the factory rule. Start slots: majors 3, USA/USSR 4, others 2. Sources: two research focuses per major (existing ones get +1 slot where the change list says), the generic focuses, and the new decision "전시 과학 동원" (≥10 factories AND (at war ≥180 days OR world tension ≥50%), 100 PP, once). Cap 6. Per changes §1.
- **Techs:** 126 → 234 (108 new), 9 → 10 tabs (a new support tab). The 1945 target for majors is 45–60% complete. Concentrated ⇄ dispersed industry is an either/or. 4 techs open after special projects finish. Research days are the current formula × the per-tech multiplier (improvement 0.75, normal 1, big 1.25) × one global knob. Per changes §2.
- **Equipment:** policy A. Keep the existing generations and fill the gaps with improvement techs, designer modules and chassis. Add no new equipment kinds; mechanized and rocket artillery are a later, optional R6.
- **No save migration.** The owner has no saves. Skip the legacy-slot preservation and the old-save tests.
- **No research queue.** It is dropped everywhere.
- **Slot hint:** auto-research never picks focuses or decisions, in line with the approved automation scope. The slot chip shows a yellow dot when a slot source is available but unused.
- **Additional ideas, top 3, included:**
  - auto-research leanings (5 presets: 균형/육군/해군/공군/산업), 1 byte of state
  - a "다음 추천" card when a research finishes
  - research bonuses shown on the screen, plus research grants
- **AI and auto-research:** one integer scoring function shared by both (role + need + bonus + seeded jitter). Auto-research pushes back techs for equipment kinds the player doesn't build. Choosing a tech by hand still turns auto-research off, as today.
- **Tree screen** per changes §4: year axis 1936→1945, a tab rail on the left, a side sheet (280 px on phone, 320 px fixed on tablet), and two taps to start (node, then "▶ 시작"). When all slots are full, double-tap a slot chip to clear it; progress is kept (w6-resprog). The doctrine tab shows a mastery summary plus a button to the doctrine screen.

## Project rules (binding)
- Never touch /home/eser/dev/OpenFrontIO, the live server. Never use ports 3000–3002/9000. Never pkill or killall, and never `git add -A`. Add no npm dependencies.
- Determinism:
  - integer math, seeded rolls (`wwRoll`), no Map/Set order hazards
  - all new state is snapshotted, restored and hashed
  - VanillaDigest never changes; re-pin WW1936_DIGEST and WW1936_EASY_DIGEST only after three equal runs, and explain why.
- Package boundaries: rules in engine-lib, state in engine, contract types in engine-api. The client never imports engine. Run `tests/LayerBoundaries.test.ts`.
- Text: translateText, en.json and ko.json only. Keep en.json sorted (EnJsonSorted). In Korean, put a space after `}` before Hangul.
- Sensitivity: /home/eser/dev/OpenFrontIO/.superpowers/hoi/decisions.md. No Japanese colonial content; Korea and Taiwan rules unchanged; captured-tech events never come from Korea or Taiwan.
- History is flavour. The AI judges situations, games should differ, and nothing is tuned to exact dates.
- Never cut features for speed; only tests may be trimmed.
