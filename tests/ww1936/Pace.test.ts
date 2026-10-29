import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { Config } from "@openfront/engine-lib/configuration/Config";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import {
  historicalAiActive,
  msPerTickOf,
  WW_HISTORY_END_ISO,
  WW_UNLIMITED_TEMPO,
  wwRealTicks,
  wwTempo,
  wwUnlimited,
} from "@openfront/engine-lib/ww1936/Pace";
import { testGameConfig } from "../util/Wire";
import { step, stepTo, wwRunnerCapture } from "./util";

const VANILLA = testGameConfig();
const KEY_ONLY = testGameConfig({ ww1936Unlimited: true });
const TIMED = testGameConfig({ worldWar1936: true });
const UNLIMITED = testGameConfig({
  worldWar1936: true,
  ww1936Unlimited: true,
});

describe("the unlimited game's pace", () => {
  test("only the mode with the key is unlimited, four times slower", () => {
    expect(WW_UNLIMITED_TEMPO).toBe(4);
    for (const gc of [VANILLA, KEY_ONLY, TIMED]) {
      expect(wwUnlimited(gc)).toBe(false);
      expect(wwTempo(gc)).toBe(1);
      expect(msPerTickOf(gc)).toBe(100);
    }
    expect(wwUnlimited(UNLIMITED)).toBe(true);
    expect(wwTempo(UNLIMITED)).toBe(4);
    expect(msPerTickOf(UNLIMITED)).toBe(400);
  });

  test("a span in ticks keeps its real seconds, rounded up", () => {
    expect(wwRealTicks(UNLIMITED, 600)).toBe(150);
    expect(wwRealTicks(UNLIMITED, 200)).toBe(50);
    expect(wwRealTicks(UNLIMITED, 300)).toBe(75);
    expect(wwRealTicks(UNLIMITED, 301)).toBe(76);
    expect(wwRealTicks(TIMED, 300)).toBe(300);
  });

  test("Config reads the pace from the game config", () => {
    const unl = new Config(UNLIMITED, false);
    expect(unl.wwUnlimited()).toBe(true);
    expect(unl.wwTempo()).toBe(4);
    expect(unl.msPerTick()).toBe(400);
    for (const gc of [VANILLA, KEY_ONLY, TIMED]) {
      const cfg = new Config(gc, false);
      expect(cfg.wwUnlimited()).toBe(false);
      expect(cfg.wwTempo()).toBe(1);
      expect(cfg.msPerTick()).toBe(100);
    }
  });

  test("history steers the AI until V-J Day (day 3,532)", () => {
    expect(WW_HISTORY_END_ISO).toBe("1945-09-02");
    expect(dayOfDate(WW_HISTORY_END_ISO)).toBe(3532);
    const on = new Config(
      testGameConfig({ worldWar1936: true, historicalAi: true }),
      false,
    );
    const off = new Config(
      testGameConfig({ worldWar1936: true, historicalAi: false }),
      false,
    );
    expect(historicalAiActive(on, 0)).toBe(true);
    expect(historicalAiActive(on, 3531)).toBe(true);
    expect(historicalAiActive(on, 3532)).toBe(false);
    expect(historicalAiActive(off, 0)).toBe(false);
  });

  test.each([
    [{}, 2.5],
    [{ ww1936Unlimited: true }, 10],
  ])(
    "the game clock counts each tick at its wall length (%o)",
    async (config, seconds) => {
      const { runner, updates } = await wwRunnerCapture(config);
      step(runner);
      const start = updates.flatMap(
        (u) => u.updates[GameUpdateType.SpawnPhaseEnd],
      )[0].startTick;
      stepTo(runner, start + 25);
      expect(runner.game.elapsedGameSeconds()).toBe(seconds);
    },
  );
});
