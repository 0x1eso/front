# Major focus expansion: lane brief (owner approved, 2026-10-31)

Spec (binding): /home/eser/dev/ww6-focus-design.md. Read your own country's section and the shared rules only.

## Base
Every lane branches from w6-fa 4bb5e67a4 (live code + step A). Step A added:
- the effect `{ kind: "start_project", project: <SpecialProject> }`. It is a no-op if the project is running or done, if there is no free facility, or if it is `sp_atomic` with nukes off. It waives the project's tech requirement.
- the focus field `group?: string`, UI only, not hashed. Put every focus of a branch in the same group, with a short stable id such as "deu_war_strategy".
- AI weighting, already in the engine: `ai: { base, mods: [{ if: Condition, factor }] }` with any Condition.

## Owner decisions
- Grow your tree from ~50 to ~100 focuses, adding about 50.
  - FRA, JPN and SUN must reach about +50 too: the design falls short by 3–5, so add focuses within the design's branches.
  - Keep every existing focus and id, including the research-slot focuses.
- Include 2–4 big either/or forks per country, as in the design.
- Sensitivity rules are ABOLISHED. Write historically grounded HOI-style content with real names, Japan included.
  - Never write content that celebrates atrocities or genocide. Keep it at HOI4's strategy-game level.
- History is flavour:
  - the historical AI is biased toward the historical path;
  - big political forks (Valkyrie, Vichy, Salò and similar) get a low chance of deviating;
  - other forks keep the current deviation chance.
- No automatic focus picking for humans.

## Rules
- Use only existing effect and condition kinds, plus `start_project`. If something essential is missing, write the closest existing effect and note it in your report. Do not add engine features.
- Grid positions must be unique and must not overlap existing nodes. Every prerequisite must exist and the graph must be acyclic. Exclusive pairs must be symmetric.
- Durations: mostly 70 days, 35 for small steps, as the design says.
- Text: en.json and ko.json only, as `ww1936.focus.<id>` names (and descriptions if the tree uses them).
  - Keep en.json sorted.
  - In Korean, put a space after `}` before Hangul.
  - Touch only your own country's keys, so lanes merge cleanly.
- Never touch /home/eser/dev/OpenFrontIO (the live server) or ports 3000–3002/9000. Never pkill or killall, and never `git add -A`. Never dispatch subagents, push or deploy.
- Determinism: the content changes the AI, so the WW1936 digests WILL change. Do NOT re-pin them. Skip `tests/ww1936/WorldWarSnapshot` in your checks; the integrator re-pins once after merging all lanes. VanillaDigest must stay unchanged.
- Tests:
  - Run the existing focus tests (they validate trees) and update any count pins for your tree only.
  - Add at most one compact test for your tree: it loads, has ~100 focuses, its forks are exclusive, and its groups are set.
  - Then run the focus/content tests, EnJsonSorted, LayerBoundaries, typecheck, eslint and oxlint.
- The owner is short on tokens: read efficiently and don't re-read big files.
- Commit, then report in at most 3 lines: commit, final focus count, any substituted effects.
