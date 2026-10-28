# World War 1936 — unlimited game at a slow pace (design)

Date: 2026-10-29. Owner request: "무제한으로 하면 게임 템포 자체를 3시간 게임 정도에
맞춰서 늦춰. 1945년쯤이 3시간 정도 뒤에 도달하게끔. 그 뒤에는 자유판단으로. 역사대로
AI는 꺼진 게 기본 세팅으로."

## Intent

The mode is a fixed 45-minute game (1936-01-01 to 1945-08-21, then a win on points).
Friends who want a long session get a lobby option: an unlimited game whose whole pace
is four times slower, so 1945 arrives after about three hours. After that, history
stops steering the AI and the war goes on until one camp is left. Separately, the
"historical AI" lobby toggle now starts off.

## Goals

- A lobby toggle, solo and host, "Unlimited game (slow pace)". It is off by default, so
  the 45-minute game stays the default.
- When it is on:
  - Everything in the game runs at ¼ speed: calendar, battles, movement, production,
    research and AI.
  - 1945-08-21 comes at about 2 h 57 min.
  - There is no time limit. The only win is the last camp standing (spec §7.6).
- From 1945-09-02, the historical AI plays as the free AI (historical AI off). This is
  day 3,532, V-J Day.
- The historical AI toggle defaults to off in both lobbies.

## Non-goals

- A pace other than ×4, or a pace picker.
- Unlimited mode for other modes.
- Public lobbies (ww1936 is never public).
- Replay-viewer clock and speed for slow games. The replay viewer still assumes 10 ticks
  per second, so a slow game replays at 4× its real speed.
- Vanilla real-time timers that the mode does not use (emoji, alliance requests).
- New content after 1945.

## Anti-goals

- Changing the 45-minute game in any way. Old records and replays without the new key
  must play exactly as now. `VanillaDigest` and `WW1936_DIGEST` (a34597533afa802a) must
  stay unchanged.
- A slow pace that is not uniform, for example battles four times faster than the
  calendar.

## Approaches considered

1. **Slow clock (chosen).** The simulation is unchanged, tick for tick. Only the wall
   clock slows: one tick is 400 ms instead of 100 ms. The server's turn interval, the
   local server's turn interval and `Config.msPerTick()` all come from the game config.
   - The renderer already interpolates with `config.msPerTick()`: the land clock, units,
     planes and FX.
   - Every game-time system slows uniformly, with no engine audit.
   - Engine work per second drops by 4×.
   - A game to 1945 has the same 26.5k ticks as today, so replays and the winner replay
     cost the same.
   - Costs:
     - Input waits up to 400 ms for the next turn, which is fine for grand strategy.
     - The few human decision windows counted in ticks need scaling so they keep their
       real seconds.
     - The HUD countdowns that divide ticks by 10 need fixing.
2. **Engine clock divisor.** Ticks stay at 100 ms, the calendar is scaled by 4, and the
   world-war systems step every 4th tick. This needs an audit of about 82 `ticks()` reads
   and every per-tick system: absolute tick deadlines would not slow, and planes would
   jump in steps. Uniformity is at risk and replays get 4× bigger. Rejected.
3. **Calendar only.** Days take 4× longer, but per-tick battles and movement do not slow,
   so a battle covers a quarter of the days and balance breaks. Rejected.

## Decisions

- **Config key.**
  - Add `ww1936Unlimited: z.boolean().optional()`, appended last in `GameConfigSchema`
    (zbin field order).
  - It only counts with `worldWar1936`. When it is absent or false, the game is today's
    game.
  - In unlimited, `applyWorldWar1936Rules` deletes `maxTimerValue` (no timer) instead of
    setting 45.
  - The server copies the key (`ConfigPatch`).
- **Pace helpers.** New file `engine-lib/src/ww1936/Pace.ts`:
  - `WW_UNLIMITED_TEMPO = 4`
  - `wwUnlimited(gc)`
  - `wwTempo(gc)`: 4 or 1
  - `msPerTickOf(gc) = 100 × tempo`
  - `wwRealTicks(gc, ticks) = ceil(ticks / tempo)`
  - `WW_HISTORY_END_ISO = "1945-09-02"`
  - `historicalAiActive(config, day)`
  - `Config.msPerTick()` uses `msPerTickOf`.
- **Clock.**
  - `GameServer` starts its turn interval at `msPerTickOf(config)`; telemetry reports the
    same value.
  - `LocalServer` uses `msPerTickOf(game config) × replay multiplier`.
  - `elapsedGameSeconds()` is `ticksSinceStart × msPerTick / 1000`, in the engine and in
    `GameView`. Vanilla stays bit-identical: both forms are the correctly rounded value
    of the same rational.
- **Real-time human windows** keep their real seconds through `wwRealTicks`. In unlimited
  they become a quarter of the ticks:
  - preparation minute: `WW_PREP_TICKS` 600 → 150
  - event cards: 200 / 300 → 50 / 75
  - peace-conference round: 300 → 75
  - takeover card: 300 → 75
  - licence card: 200 → 50

  The client computes each card's total from the same helper, and seconds from
  `msPerTick`.

- **Victory.** In unlimited there is no `ww_score` time-out, only `ww_last_camp`. In timed
  games it stays at 45:00.
- **History end.**
  - Every engine read of `config().historicalAi()` that runs during the game becomes
    `historicalAiActive(config, day)`. It is true only while the config is on and
    `day < dayOfDate(WW_HISTORY_END_ISO)` (= 3,532).
  - Reads that run once on day 0 may stay as they are: doctrine picks and the start roll.
  - The switch is keyed to the date only, not to the unlimited flag. A timed game ends at
    day 3,520, before the switch, so its 45 minutes are unaffected.
  - The switch is derived from the day, so it adds no snapshot state.
- **Server cap.**
  - A started unlimited game gets a 24-hour `maxGameDuration` instead of 3 hours.
  - Empty games are still reaped after 20 s without pings (`GameServer.phase()`), so
    abandoned games do not linger.
- **Overflow.** The per-region `tallyDay` counters in `WwLand` and `WwNavy` change from
  `Int16Array` to `Int32Array`. Day 32,767 would arrive after about 27 h of slow play.
- **Historical AI default off.**
  - Only the lobby defaults change: `SinglePlayerModal` `DEFAULT_OPTIONS` and
    `HostLobbyModal` state and reset.
  - The engine keeps "absent = on" (`applyWorldWar1936Rules`, `Config.historicalAi`).
    Stored records are normalized with an explicit value, and tests, the digest and old
    replays depend on today's semantics. (Controller's call.)
- **Lobby copy** (en / ko, keys under `ww1936.lobby`):

  | Key            | en                                  | ko                             |
  | -------------- | ----------------------------------- | ------------------------------ |
  | `unlimited`    | "Unlimited game (slow pace)"        | "무제한 게임 (느린 템포)"      |
  | `unlimited_on` | "Unlimited · about 3 hours to 1945" | "무제한 · 1945년까지 약 3시간" |

  The settings summary shows `private_lobby.game_length` = `unlimited_on` for an
  unlimited game.

## Left to the builder

- Exact placement of the toggle: right after the historical AI toggle.
- The test harness used to show a historical-AI read switching after the end date.
- Any further 100 ms-turn assumption found in the server or client. Fix it if it would
  misbehave at 400 ms in this mode, otherwise list it in the report.
