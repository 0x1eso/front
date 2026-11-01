# War overhaul (ww7): binding brief for every lane

Owner said "전쟁 시스템 개편 진행해" (2026-11-01). Design: `docs/handoff/ww6-war-design.md`. **Where this brief differs from the design, this brief wins** (it carries the owner's changed decisions, `docs/handoff/HANDOFF.md` §5).

## Project rules (binding)
- Repo rules: root `CLAUDE.md`. Answer/report in short English lines (the coordinator translates).
- Never `git add -A`; add your files by path. Add no npm dependencies. Do not push. Keep scratch scripts in your own lane folder (`.lane/<lane>/` in your worktree, untracked).
- Determinism: integer math (bp = 1/10000, ‰ = 1/1000, milli); randomness only through stateless `wwRoll` (engine-lib `Roll.ts`) with a lane-specific purpose `idHash(...)`; iterate in id order; no Map/Set order hazards (`setInOrder` where the code does). All new state is snapshotted, restored and hashed.
- Digests: do **not** re-pin `WW1936_DIGEST`/`WW1936_EASY_DIGEST` or any other pinned digest in a lane; the coordinator re-pins once after merging. A digest test failing because of your intended behaviour change is expected: list it in your report. `tests/VanillaDigest*` must never change.
- Packages: rules in engine-lib, state in engine, contract types in engine-api; the client never imports engine (`tests/LayerBoundaries.test.ts`).
- Text: `translateText`, `resources/lang/en.json` + `ko.json` only; en.json stays key-sorted (`tests/EnJsonSorted.test.ts`); Korean: a space after `}` before Hangul. No HOI4 wording (`tests/ww1936/Originality.test.ts`).
- Append-only lists (`ARMY_ORDER_KINDS`, `LAND_ORDER_KINDS`, `WwOrderSchema` members, `WW_ORDER_BLOCKS`, tech ids …): only append at the end.
- Engine changes need tests (`tests/ww1936/*`, `setup()` from `tests/util/Setup.ts`, real simulation, no mocks).
- Perf tests (LandPerf, EndgamePerf, …) flake when the machine is busy: rerun one alone before calling it a failure.
- Owner preference: never cut features to go faster; only tests may be lean. History is flavour: the AI judges situations, games must differ, no date scripting.
- Done = your lane's tests pass, `npm run typecheck` passes, `npx vitest tests/LayerBoundaries.test.ts --run` passes, lint clean on touched files (`npx oxlint <files>`), committed on your branch. Report in ≤ 6 lines: commit hash, what is done, anything not done, expected digest failures, open questions.

## The model (owner decisions)

### 1. Army objective orders (replaces the anchor/⌈div÷3⌉ front and the design's FrontLine)
Kept as the existing two order kinds, re-meant:
- **Defend** = `order.kind "front"`: the army holds a **zone**, a set of our side's border regions against `order.enemy` (0: every enemy).
- **Attack** = `order.kind "plan"`: 1–3 `targets`, `stance` (careful/balanced/aggressive, default balanced), `executing` (the player's [실행]).
- New field `order.zone: number[]` — the player's explicit zone (defend: tap to grow/shrink). Empty = automatic.
- `army.front` (existing, derived daily and on every order change) = the zone the army holds today, **including gap fills**; the screen paints these regions in the army's colour.

Engine behaviour (lane C):
1. **Zone of the day.** Defend: `order.zone ∩ border` when that is non-empty, else a BFS along the border graph from `order.anchor` (re-anchored to the nearest border region when it left the border, as today) of `⌈divisions ÷ 2⌉` regions. Attack: `order.zone ∩ border` when non-empty, else BFS from the border region nearest the targets, `⌈divisions ÷ 3⌉` regions. Recompute on every order apply too (the screen must see a new zone within a tick, not next day).
2. **Cover first.** Every zone region gets one division before anything else (nearest free division, ties: smaller id). Too few divisions: cover by (threat × (1 + region VP)) descending, the rest stay uncovered.
3. **Spare divisions.** Defend: by weight `2 + enemy divisions facing it`, at most width × 1.5 per region, keep today's hysteresis (move only when off by > 1). Attack: all spare to the **axis** (zone regions with the smallest target distance), capped at width × 1.5 per region, overflow to the next nearest zone regions.
4. **Rotation.** A zone holder below 40 % org (not in battle) swaps with the freshest spare (≥ 70 % org) of its army that can get there within 3 days. In attacks, an attacker below 30 % org leaves the attack and a fresher one from the axis joins.
5. **Attack execution.** Axis regions attack the enemy neighbour nearest the targets (then weaker, then smaller id) when the range preview clears the stance: careful `lowPm ≥ 1000`, balanced `midPm ≥ 1000`, aggressive `highPm ≥ 1000`; org floor careful 80 %, balanced 60 %, aggressive 30 % (today's). Non-axis zone regions hold, but may walk into an **empty** enemy neighbour no farther from the targets. Targets all ours → the order turns into Defend (kind "front", zone automatic, anchor = the army's token region, `executing` false, readiness kept).
6. **Gaps between armies.** After every army of a country has its zone: border regions (vs countries we are at war with) in a border component that holds the zones of two or more of the country's front/plan armies, and that no army covers, are taken by the nearest of those armies (border-graph BFS, ties: smaller army id) while that army still has a division for every region it holds. Whatever stays uncovered is a **gap**.
7. **Gaps for the screen.** Every human country's `gaps`: border regions facing a country at war with us where none of our side's divisions stands or is headed. Daily and on order apply.
8. **Odds for the screen.** Every human army with a plan order: for each zone region, the enemy region it would attack and its win % (`odds: [from, to, winPct][]`, from `predictAttackRange`). On order apply and daily.
9. **Army groups.** `ag_front` splits its regions among the group's armies in **geographic order along the border** (not id order: replace `CommandRules.splitFront`'s id slicing with a border-chain walk), each army gets Defend with that explicit zone.
10. **Auto.** `army.autoLevel`: 0 off, 1 **수비 자동** (defend only: the AI's zone covering and gap logic, never attacks), 2 **공세 자동** (as the AI). `army_auto {on}` keeps meaning level 2 / 0. New intent `army_auto_level`. The AI uses the very same orders (lane D).

### 2. Occupation in depth bands (lane B; design §3 as written)
- `depth d = clamp(1, 4, ⌊√tiles / 10⌋)`, +1 for an urban region or VP ≥ 10, max 5 (engine-lib `BandRules.ts`).
- Per region `bandProg` (0..d) and `bandTaker` (smallID). Control and VP change only when the last band falls. A won battle: `bandProg++`, attackers move **into** the region (occupying), defenders step back to the next band inside the same region (org recovery half while doing so, time = edge time ÷ d), a new battle opens there; defenders who win push the attackers back one band (0: out). Empty bands are walked through (an empty region falls in the same total time as today). Defenders arriving in a region in progress defend the next band. Occupying attackers draw adjacent friendly supply × 80 %. The spread (tile colour) follows `bandProg/d`. Zero-org defenders with a band left are not destroyed; `evict` applies only when the last band falls.

### 3. Luck (lane A; design §2 as written)
Tactics (12 h phases, counters), initiative (who picks second, reserve odds), daily luck ±10 % (triangular, two rolls), reserve entry roll per round (25 % + initiative/4 + signal 10 + infiltration 15, max 70 %). `predictBattleRange` (low/mid/high, three expected-value runs) and `WIN_PCT` by log-ratio bucket, fitted by a deterministic 2,000-duel script and hard-coded; engine and screen share both.

### 4. Defence and capitulation (lane B2)
- Entrenchment +5 % a level (was 3 %), a level every **2** days (was 3), max unchanged.
- **Positions** (new, per region, 0–3): our side standing ≥ 5 days in a region builds a level every 5 days (Defend zone regions twice as fast), +5 % defence a level, kept when divisions change, gone when the region changes hands. A region whose every edge to the enemy crosses a river starts at 1 once held 5 days.
- Forts ≥ 3: attack direction extra width halved. Urban: +1 band (lane B's depth) and −15 % org damage taken by its defenders.
- Capitulation: holding the capital raises the surrender line +15 pp (max 95); gauge above the line `+1 + ⌊(pp over) ÷ 5⌋` a day, below it −2, capitulate at 45; only fully taken regions count (bands do that); France's floor 25 % (was 21).

### 5. Release
One release at the end (no engine-first release). Perf: land tick with 2,000 divisions within +10 % of today.

## C0 contract (the coordinator's lane; all lanes build on it)
engine-api `LandTypes.ts`:
- `ArmyOrder.zone: number[]` (idleOrder: `[]`).
- `WW_ZONE_MAX = 60`; `WW_ZONE_DIVS_DEFEND = 2`; `WW_ZONE_DIVS_ATTACK = 3`.
- `LAND_ATTACK_TACTICS = ["attack","assault","shock","infiltration","barrage","blitz","envelop"]`, `LAND_DEFENSE_TACTICS = ["defend","ambush","elastic","counter","hold","depth","withdraw"]` (append-only; text keys `ww1936.tactic.<id>`).
- `ArmyMineData`: `autoLevel?: number`, `odds?: [number, number, number][]`.
- `BattleSummary` (all optional): `band`, `depth`, `winPct`, `lowPm`, `midPm`, `highPm`, `tacticAtt`, `tacticDef` (tactic list indices), `initAtt`, `initDef`, `reinfPct`.
- `RegionLandData` (optional): `depth`, `prog`, `taker`, `pos`.
- `CountryLandDetail.gaps?: number[]`.
- `BattleRange { lowPm, midPm, highPm, winPct, days }`.
- `LAND_ORDER_KINDS` append `"army_zone"`, `"army_auto_level"`.

engine-api `Schemas.ts`, appended to `WwOrderSchema`: `{kind:"army_zone", army, regions: WwRegionId[] max WW_ZONE_MAX}` (empty: automatic), `{kind:"army_auto_level", army, level: 0..2}`.

engine-lib: `CombatRules.predictBattleRange(att, def, ctx): BattleRange` and `winPctOf(ratioPm)` — C0 stubs (low = mid = high = predictBattle; a placeholder monotone curve); lane A replaces the bodies, keeps the signatures. `LandOrderChecks`: checks for the two new kinds (own army; regions on our side; zone only for front/plan armies).

engine `WwLand.ts`:
- `Army.autoLevel` (0/1/2; `auto` stays and equals `autoLevel > 0`).
- `Battle.band`, `Battle.tacticAtt`, `Battle.tacticDef`, `Battle.phaseRound` (numbers, default 0).
- Region arrays `bandProg`, `bandTaker`, `posLevel`, `posDays` (Int32Array or number[] like `encircled`, sized like `controller`).
- Snapshot: every new field optional with defaults; restore round-trips. Hash: each new field folded **only when it is not at its default** (so today's digests hold until a lane changes behaviour).
- The issue switch routes `army_zone` (sets `order.zone`, `pending`) and `army_auto_level` (sets `autoLevel`, `auto`).
- Update builder: passes the new optional fields when set (lanes fill them).
- engine `Plans.ts`: `predictAttackRange(land, attackers, region): BattleRange` (same gathering as `predictAttack`, then `predictBattleRange`).
- Tests: snapshot round trip with non-default new state; the two intents through `land.issue`; zbin wire test for the new intents.

## Lanes and file ownership
Each lane works in its own worktree and branch from the C0 commit. Stay inside your files; when you must touch another lane's file, keep the edit small and say so in your report.

| Lane | Branch | Owns |
|---|---|---|
| A combat | `w7-A` | engine-lib `CombatRules.ts` (prediction, tactics, WIN_PCT; new `TacticRules.ts` ok), `Roll.ts` purposes; engine `Battles.ts` `fight`/`lineUp`/`joinBattle`; battle-summary fields `winPct…reinfPct`; duel script `scripts/ww1936/duel-fit.ts` |
| B bands | `w7-B` | engine-lib `BandRules.ts`; engine `Battles.ts` `won`/`endDefended`/`retreatDivision`/`refugeOf`, `Movement.ts` `arrive`, `Occupation.ts`, `Supply.ts`; summary fields `band`/`depth`, region `depth`/`prog`/`taker` |
| B2 defence | `w7-B2` | `Battles.ts` `dailyEntrench` + entrench/position terms in `modInputOf`/`CombatRules` mods, new engine `land/Positions.ts`, region `pos`, fort width line in `fight`, urban org-damage term, `Capitulation.ts` + its constants |
| C orders | `w7-C` | engine `Fronts.ts`, `Plans.ts` (`planDay`, readiness), `Orders.ts`, `depth/ArmyGroups.ts`; engine-lib `FrontRules.ts`, `CommandRules.ts` (`splitFront`), `LandOrderChecks.ts`; `odds`, `gaps`, `front` in the update |
| E screens | `w7-E` | `src/client/**`, `resources/lang/en.json` + `ko.json` |
| D AI (after C) | `w7-D` | engine `AiLand.ts`, `depth/AiCommand.ts`, army auto levels |
| F balance (last) | coordinator | `scripts/ww1936/*`, constants, digests |
