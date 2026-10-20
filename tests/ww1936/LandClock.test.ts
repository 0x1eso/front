// World War 1936 P2: the land war's clock (P2 spec §2.2; Review Focus 2).
// The troop mirror (p.setTroops(fieldMen)) runs at the end of a country's
// land day, so it shows when that day ran.
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Player } from "@openfront/engine/game/Game";
import { land, step, stepTo, wwRunner } from "./util";

describe("the land war's clock (P2 spec §2.2)", () => {
  test("land daily step runs once per country per day", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const l = land(g);
    const players = g.allPlayers() as Player[];
    // Day 0 (ticks 600–607, 8 ticks) and day 1 (608–614, 7 ticks).
    for (const day of [0, 1]) {
      const start = dayStartTick(day, WW_PREP_TICKS);
      const end = dayStartTick(day + 1, WW_PREP_TICKS);
      stepTo(runner, start);
      for (const p of players) p.setTroops(0);
      while (g.ticks() < end) {
        const t = g.ticks();
        step(runner);
        for (const p of players) {
          const id = p.smallID();
          const ran = start + (id % WW_DAY_SPLIT) <= t;
          expect(p.troops(), `day ${day} tick ${t} country ${id}`).toBe(
            ran ? l.fieldMen(id) : 0,
          );
        }
        // Zeroed again after its turn: it stays 0 until its next day.
        if (t === start + WW_DAY_SPLIT - 1 && day === 0) {
          for (const p of players) p.setTroops(0);
          while (g.ticks() < end) {
            step(runner);
            for (const q of players) expect(q.troops()).toBe(0);
          }
        }
      }
    }
    expect(l.fieldMen(1)).toBeGreaterThan(0);
  });

  test("the daily step skips the preparation minute", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const l = land(g);
    const players = g.allPlayers() as Player[];
    step(runner);
    for (const p of players) p.setTroops(0);
    stepTo(runner, WW_PREP_TICKS);
    for (const p of players) expect(p.troops()).toBe(0);
    // The first day's turns mirror the divisions again.
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS));
    for (const p of players) {
      expect(p.troops()).toBe(l.fieldMen(p.smallID()));
    }
  });
});
