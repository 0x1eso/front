# World War 1936 Unlimited Slow-Pace Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lobby option for an unlimited World War 1936 game. The whole game runs 4× slower, so 1945 arrives after about 3 h. The historical AI hands over to the free AI on 1945-09-02. The historical AI lobby toggle defaults to off.

**Architecture:** A slow wall clock. The simulation runs tick for tick as today, but one tick lasts 400 ms instead of 100 ms. The server turn interval, the local server and `Config.msPerTick()` all derive the tick length from the game config through one helper file, `packages/engine-lib/src/ww1936/Pace.ts`. A few human decision windows counted in ticks are divided by the tempo, so they keep their real seconds.

**Tech Stack:** TypeScript, Vitest, Zod/zbin, Lit, Node ws server.

**Spec:** `docs/superpowers/specs/2026-10-29-ww1936-unlimited-tempo-design.md`

## Global Constraints

- Engine packages (`packages/engine*`):
  - No `Math.random`, no `Date`, no approximated `Math`; use `DetMath`.
  - Every engine change comes with tests.
- Append `ww1936Unlimited` **last** in `GameConfigSchema`; the zbin wire order depends on it.
- A config without the key (or with `worldWar1936` off) behaves exactly as today:
  - `VanillaDigest` is unchanged.
  - `WW1936_DIGEST = "a34597533afa802a"` (`tests/ww1936/WorldWarSnapshot.test.ts:447`) is unchanged.
  - `normalizeWorldWar1936Config` still returns the same object when the mode is off.
- Strings: add every new string to `resources/lang/en.json` and `ko.json` only. Keep en.json sorted at every level (`tests/EnJsonSorted.test.ts`).
- Work only in your lane worktree:
  - Never touch `/home/eser/dev/OpenFrontIO` (the live server) or `~/.cloudflared`.
  - No dev servers except throwaway ones on ports 9500–9502 with `--strictPort`, stopped by PID.
  - Never use `pkill`.
- Lanes run focused tests, `npm run typecheck` and `npx eslint <changed files>` only. Do not run the full suite; the integrator runs it.
- Commit style: `feat(ww1936): …` / `fix(ww1936): …` / `test(ww1936): …`.

## Review Focus

1. A client or server restored from a snapshot or a reconnect mid-game in unlimited mode must agree on `prepEndTick` and the tick length. Both come from the normalized config and the snapshot. Task 1 tests a snapshot round trip of the config key; Task 2 tests that `prepEndTick` survives a WorldWar snapshot restore.
2. A host turns unlimited on, then turns the mode off. The key must do nothing outside the mode: tempo 1, 100 ms, vanilla config identity unchanged. Covered by Task 1 `Pace.test.ts` and the ModeConfig test.
3. An old record without the key must play the 45-minute game at 100 ms. Covered by Task 1 (`wwTempo` absent → 1, Victory at 45:00) and the unchanged digests.
4. In multiplayer, every client must tick at the server's interval. The server must read the final, normalized config at `start()`, not a lobby value from before the last host patch. Covered by a Task 3 GameServer test.
5. A long solo game past day 32,767 must keep its once-a-day doctrine tallies. Covered by the Task 2 Int32 test.

---

### Task 1: Config key, pace helpers, tick length, victory

**Files:**

- Modify: `packages/engine-api/src/Schemas.ts`. Append `ww1936Unlimited` after `ww1936Nukes` (around line 505), with a comment.
- Create: `packages/engine-lib/src/ww1936/Pace.ts`
- Modify: `packages/engine-lib/src/ww1936/ModeConfig.ts:54` (unlimited → `delete c.maxTimerValue`; otherwise 45)
- Modify: `packages/engine-lib/src/configuration/Config.ts:188` (`msPerTick()`), and add `wwUnlimited()` and `wwTempo()` next to `historicalAi()`
- Modify: `packages/engine/src/game/GameImpl.ts:1053` (`elapsedGameSeconds`)
- Modify: `packages/engine/src/ww1936/Victory.ts:72` (no time-out when unlimited)
- Modify: `src/server/ConfigPatch.ts:14-44` (copy the key)
- Test: `tests/ww1936/Pace.test.ts` (new), `tests/ww1936/ModeConfig.test.ts`, `tests/ww1936/Victory.test.ts`, `tests/server/ConfigPatch.test.ts`, `tests/zbin/wire.test.ts` (round trip with the key)

**Interfaces (Produces):**

- `export const WW_UNLIMITED_TEMPO = 4;`
- `export const WW_HISTORY_END_ISO = "1945-09-02";`
- `export function wwUnlimited(gc: GameConfig): boolean`: true only when `gc.worldWar1936 === true && gc.ww1936Unlimited === true`.
- `export function wwTempo(gc: GameConfig): number`: `WW_UNLIMITED_TEMPO` when unlimited, else `1`.
- `export function msPerTickOf(gc: GameConfig): number`: `100 * wwTempo(gc)`.
- `export function wwRealTicks(gc: GameConfig, ticks: number): number`: `Math.ceil(ticks / wwTempo(gc))`.
- `export function historicalAiActive(config: Config, day: number): boolean`: `config.historicalAi() && day < dayOfDate(WW_HISTORY_END_ISO)`. The end day is 3,532. Import `dayOfDate` from `./Calendar`, and import `Config` type-only.
- `Config.msPerTick()` returns `msPerTickOf(this._gameConfig)`.
- `Config.wwUnlimited()` and `Config.wwTempo()` delegate to the helpers.

- [ ] **Step 1: Write failing tests**
  - `tests/ww1936/Pace.test.ts`:
    - `wwTempo` is 1 for `{}`, for `{ww1936Unlimited: true}` without the mode, and for `{worldWar1936: true}`.
    - `wwTempo` is 4 for `{worldWar1936: true, ww1936Unlimited: true}`.
    - `msPerTickOf` gives 100 and 400 for those cases.
    - `wwRealTicks(unl, 600) === 150`, `(unl, 200) === 50`, `(unl, 300) === 75`, `(timed, 300) === 300`.
    - `historicalAiActive(cfgOn, 3531) === true`, `(cfgOn, 3532) === false`, `(cfgOff, 0) === false`.
  - `ModeConfig.test.ts`:
    - Unlimited normalization leaves `maxTimerValue` undefined, and `new Config(...).maxTimerMinutes()` is `null`.
    - Unlimited keeps `ww1936Unlimited: true`.
    - Timed is still 45.
    - Mode off with the key returns the identical object (`toBe`).
  - `Victory.test.ts`: in an unlimited game, `worldWarVerdict(mg, ww, 45*60)` and `(…, 10*3600)` are `null` while two camps live. The existing timed cases stay as they are.
  - `ConfigPatch.test.ts`: `applyGameConfigPatch(target, {worldWar1936: true, ww1936Unlimited: true})` keeps the key, and the server rules leave `maxTimerValue` unset.
  - `wire.test.ts`: a game-start round trip with `ww1936Unlimited: true` decodes equal.
  - `GameImpl`: `elapsedGameSeconds()` at 25 ticks after start is `2.5` (timed) and `10` (unlimited). Add this to `tests/ww1936/Pace.test.ts` using `wwRunner` from the ww1936 test utils.

- [ ] **Step 2: Run them and confirm they fail.** Run `npx vitest tests/ww1936/Pace.test.ts tests/ww1936/ModeConfig.test.ts tests/ww1936/Victory.test.ts tests/server/ConfigPatch.test.ts tests/zbin/wire.test.ts --run`. Expect missing-module and assertion failures.

- [ ] **Step 3: Implement** the files above.
  - `elapsedGameSeconds()` becomes `(this.ticksSinceStart() * this.config().msPerTick()) / 1000`.
  - In Victory, return `null` before the time check when `mg.config().wwUnlimited()`.

- [ ] **Step 4: Run the Step 2 command plus `tests/VanillaDigest.test.ts tests/ww1936/WorldWarSnapshot.test.ts`.** Expect all to pass with both digests unchanged. Then run `npm run typecheck`.

- [ ] **Step 5: Commit:** `feat(ww1936): ww1936Unlimited config key, pace helpers, tick length from the config`

### Task 2: Engine — real-time windows, free AI after 1945-09-02, Int32 tallies

**Files:**

- Modify: `packages/engine/src/ww1936/WorldWar.ts:90`. `_prepEndTick` is `wwRealTicks(gc, WW_PREP_TICKS)`, set where the constructor has the game; the snapshot restore at line 548 still wins.
- Add `historicalAiNow(): boolean` to `WorldWar`. It returns `historicalAiActive(this.mg.config(), this.day(this.mg.ticks()))`; use the field names the class actually has.
- Modify the event card timeouts at `packages/engine/src/ww1936/politics/Events.ts:203-204`. Wrap both constants in `wwRealTicks(gc, …)`.
- Modify the peace-conference round length at `packages/engine/src/ww1936/endgame/Conference.ts:360,533,550`. Wrap it in `wwRealTicks`.
- Modify the takeover card deadline at `packages/engine/src/ww1936/endgame/Exile.ts:741`. Wrap it in `wwRealTicks`.
- Modify the licence card deadline at `packages/engine/src/ww1936/depth/Licences.ts:375`. Wrap it in `wwRealTicks`.
- Modify every in-game read of `config().historicalAi()` under `packages/engine/src/ww1936/**` (find them with `rg -n "historicalAi\(\)" packages/engine/src`). Use `historicalAiNow()`, or `historicalAiActive(config, day)` where a `day` is already in scope.
  - Leave as they are: day-0 / start-only reads (`WorldWarExecution.ts:43` roll, `WwDepth.ts:654` `startAiDoctrines`). Leave a one-line comment on each.
- Modify the land and navy tallies: `land/WwLand.ts:135,177` and `navy/WwNavy.ts:133,165`. Change `tallyDay` from `Int16Array` to `Int32Array`, and update their snapshot restore.
- Test: `tests/ww1936/PaceEngine.test.ts` (new). Extend existing tests only where a constant moved.

**Interfaces:**

- Consumes (Task 1): `wwRealTicks`, `historicalAiActive`, `WW_HISTORY_END_ISO`, `Config.wwUnlimited()`.
- Produces: `WorldWar.historicalAiNow(): boolean`.
  - Engine deadlines carried in the data: `deadlineTick`, `roundEndTick`.
  - Task 3's client reads the windows' totals through `wwRealTicks(config, CONST)`.

- [ ] **Step 1: Write failing tests** in `PaceEngine.test.ts`. Build the games with `wwRunner({ ww1936Unlimited: true })` and `wwRunner({})`, and use the same harnesses the existing Events, Conference, Exile and Licences tests use to raise a card or round.
  - `prepEndTick()` is 150 (unlimited) and 600 (timed).
  - After a snapshot round trip in unlimited, `prepEndTick()` is still 150.
  - Event card window: `deadlineTick - firedTick` is 50 or 75 in unlimited, and 200 or 300 in timed.
  - Peace round: `roundEndTick - tick` is 75 in unlimited and 300 in timed.
  - Takeover card window: 75 in unlimited, 300 in timed.
  - Licence card window: 50 in unlimited, 200 in timed.
  - `historicalAiNow()` with historical on: true at day 3,531 and false at day 3,532. With historical off it is always false. Reach the day by advancing the ticks of a cheap test game, or by computing it through `dayStartTick(3532, prepEnd)` with the ticks the harness allows.
  - One representative switched site behaves as the free AI after the end. Prefer the `historical_ai` condition in `politics/Conditions.ts:111`: it evaluates true before day 3,532 and false after.
  - Tallies: write day 40,000 into a land and a navy `tallyDay` slot. It reads back as 40,000, and the once-a-day guard skips a second tally that day.

- [ ] **Step 2: Run** `npx vitest tests/ww1936/PaceEngine.test.ts --run`. Expect it to fail.

- [ ] **Step 3: Implement** the changes listed under Files.

- [ ] **Step 4: Run** `npx vitest tests/ww1936/PaceEngine.test.ts tests/ww1936/Events.test.ts tests/ww1936/WorldWarSnapshot.test.ts tests/ww1936/AiPolitics.test.ts tests/ww1936/PeaceAi.test.ts tests/VanillaDigest.test.ts --run`, plus the existing test files of each module you touched. Expect everything to pass with digests unchanged. Then run `npm run typecheck`.

- [ ] **Step 5: Commit:** `feat(ww1936): decision windows keep real seconds at a slow pace; free AI after 1945-09-02; 32-bit tally days`

### Task 3: Server and client clock

**Files:**

- `src/server/GameServer.ts`:
  - Line 1243: the turn `setInterval` uses `msPerTickOf(this.gameConfig)`. Read it after the final normalization in `start()`, line 1168.
  - Lines 389 and 1220: telemetry `turnIntervalMs` uses the same value.
  - Line 226 and `pastMaxDuration` at line 1719: the cap is 24 h when `wwUnlimited(this.gameConfig)`, else 3 h.
- `src/client/LocalServer.ts:94-95`: the turn interval is `msPerTickOf(<the game's config from lobbyConfig: the start info's config, or the record's for a replay>) * this.replaySpeedMultiplier`.
- `src/client/view/GameView.ts:1103`: `elapsedGameSeconds` uses `this._config.msPerTick()`, as in Task 1.
- `src/client/hud/ww1936/WorldWarModel.ts:170` (`prepSecondsLeft`) and `WwDials.ts:308`: convert seconds with `msPerTick`.
- `src/client/hud/ww1936/PoliticsModel.ts:2544`: event card `secondsLeft` converts with `msPerTick`.
- `src/client/hud/ww1936/WwPeaceCard.ts:469-471`: total `wwRealTicks(config, WW_PEACE_ROUND_TICKS)`; seconds via `msPerTick`.
- `src/client/hud/ww1936/WwTakeoverCard.ts:114-115`: total `wwRealTicks(config, WW_TAKEOVER_CARD_TICKS)`; seconds via `msPerTick`.
- The licence card display, if `DepthIndustryModel` or its view shows seconds or a fraction: same treatment.
- Audit `src/server/GameServer.ts`, `src/client/ClientGameRunner.ts` and `src/client/Transport.ts` for hard-coded 100 ms-per-turn timing, for example lag or "behind" thresholds counted in turns but meant as seconds. Fix the ones that would misbehave at 400 ms in this mode, and list the rest in your report.
- Test: `tests/server/GameServerTempo.test.ts` (new; follow `tests/server/GameServerWire.test.ts` for the harness), `tests/client/LocalServerTempo.test.ts` (new; follow `tests/client/LocalServer.test.ts`), `tests/client/ww1936/PaceHud.test.ts` (new).

**Interfaces:** Consumes Task 1's `msPerTickOf`, `wwRealTicks`, `wwUnlimited` and `Config.msPerTick()`. These helpers take the plain `GameConfig`, so on the client pass `game.config().gameConfig()` (`wwRealTicks(game.config().gameConfig(), WW_PEACE_ROUND_TICKS)`). The engine constants stay exported from `engine-api`.

- [ ] **Step 1: Write failing tests**
  - GameServer: a ww1936 unlimited game emits turns every 400 ms on fake timers (advance 1,200 ms → 3 turns). A timed ww1936 game emits every 100 ms.
  - GameServer: a host patch that turns unlimited on just before `start()` is honoured.
  - GameServer: `pastMaxDuration()` is false at 3 h + 1 s for unlimited, true at 24 h + 1 s, and true at 3 h + 1 s for timed.
  - LocalServer: an unlimited singleplayer config hands a turn only after 400 ms; a vanilla one after 100 ms.
  - HUD: with a fake game at `msPerTick` 400:
    - `prepSecondsLeft` at 50 ticks before `prepEnd` is 20.
    - The event card's `secondsLeft` for 25 ticks left is 10.
    - The peace card's fraction for 75 ticks left is 1, and its seconds are 30.
    - The takeover card's fraction for 75 ticks left is 1.
  - HUD: at 100 ms, the same functions give today's values.

- [ ] **Step 2: Run the new tests.** Expect them to fail.

- [ ] **Step 3: Implement** the changes listed under Files.

- [ ] **Step 4: Run** the new tests plus `tests/server/GameServerWire.test.ts tests/client/LocalServer*.test.ts tests/client/WorldWarHud.test.ts tests/client/ww1936`. Expect them to pass. Then run `npm run typecheck`.

- [ ] **Step 5: Commit:** `feat(ww1936): turn interval and HUD countdowns follow the game's tick length; 24 h cap for unlimited games`

### Task 4: Lobby toggle, historical AI off by default, summary, strings

**Files:**

- `src/client/SinglePlayerModal.ts`:
  - `DEFAULT_OPTIONS`: add `historicalAi: false` (line 149) and a new `ww1936Unlimited: false`.
  - Add `@state() private ww1936Unlimited`.
  - Add the toggle `{ labelKey: "ww1936.lobby.unlimited", checked: this.ww1936Unlimited }` right after the historical AI toggle (line 624).
  - Handler case `"ww1936.lobby.unlimited"` (near line 1010).
  - Reset (line 868).
  - Start config (lines 1419-1425): `ww1936Unlimited: this.ww1936Unlimited`.
- `src/client/HostLobbyModal.ts`:
  - `historicalAi = false` (lines 123 and 1223).
  - New state, toggle after the historical AI one (line 771), handler (line 1376).
  - `putGameConfig` sends `ww1936Unlimited` (line 1949).
  - Reset.
- `src/client/utilities/LobbySettingsSummary.ts:112-130`: in the `worldWar1936` block, when `c.ww1936Unlimited === true`, push `{ label: translateText("private_lobby.game_length"), value: translateText("ww1936.lobby.unlimited_on") }`.
- `resources/lang/en.json` and `ko.json`: under `ww1936.lobby`, sorted:
  - `"unlimited": "Unlimited game (slow pace)"` / `"무제한 게임 (느린 템포)"`
  - `"unlimited_on": "Unlimited · about 3 hours to 1945"` / `"무제한 · 1945년까지 약 3시간"`
- `tests/ww1936/WorldWarI18n.test.ts`: add both keys to the required list.
- Test: `tests/client/ww1936/UnlimitedLobby.test.ts` (new; copy the structure of `tests/ww1936/NukesLobby.test.ts`). Update `tests/client/WorldWarLobby.test.ts` and any test that asserted the historical AI default as on.

**Interfaces:** Consumes Task 1's `GameConfig.ww1936Unlimited`. No producers.

- [ ] **Step 1: Write failing tests** (`UnlimitedLobby.test.ts`):
  - The solo modal in ww1936 mode shows the `ww1936.lobby.unlimited` toggle, unchecked by default.
  - Checking it makes the start config carry `ww1936Unlimited: true`, and the normalized config has no `maxTimerValue`.
  - The historical AI toggle is unchecked by default, and the start config has `historicalAi: false`.
  - The host modal sends `ww1936Unlimited` and `historicalAi: false` by default in `putGameConfig`.
  - The summary for `{worldWar1936: true, ww1936Unlimited: true}` has a `private_lobby.game_length` row with `ww1936.lobby.unlimited_on`. For a timed ww1936 config the row shows 45 min as today.

- [ ] **Step 2: Run** `npx vitest tests/client/ww1936/UnlimitedLobby.test.ts --run`. Expect it to fail.

- [ ] **Step 3: Implement** the changes listed under Files.

- [ ] **Step 4: Run** the new test plus `tests/client/WorldWarLobby.test.ts tests/ww1936/NukesLobby.test.ts tests/ww1936/WorldWarI18n.test.ts tests/EnJsonSorted.test.ts tests/server/CountryPick.test.ts`. Expect them to pass. Then run `npm run typecheck` and `npx prettier --check resources/lang/en.json resources/lang/ko.json`.

- [ ] **Step 5: Commit:** `feat(ww1936): unlimited slow-pace toggle in solo and host lobbies; historical AI starts off`

### Task 5: Integration (controller)

- [ ] Merge Task 1 into `ww1936` first. Start lanes 2, 3 and 4 from it in parallel, then merge all three.
- [ ] Run `npm run typecheck`, `npm run lint`, and the full `npx vitest --run`. Then run the ww1936 perf tests alone with `--no-file-parallelism`. Confirm both digests are unchanged.
- [ ] Browser smoke on port 9500 (throwaway Vite and server, stopped by PID): a solo ww1936 game with unlimited on.
  - The date advances about 1 day per 3 s.
  - The preparation countdown starts at about 60 s.
  - The sidebar timer counts up in real seconds.
  - The console has no errors.
- [ ] Report to the owner in Korean.
