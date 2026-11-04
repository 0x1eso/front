// World War 1936, the fast unlimited game: no timer, the 45-minute game's
// tempo. The calendar is a pure function of the tick, so the game keeps
// going past 1945 (the timed game ends at day 3,520, 45:00).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  dateOfDay,
  dayOfDate,
  formatIsoDate,
} from "@openfront/engine-lib/ww1936/Calendar";
import { worldWarVerdict } from "@openfront/engine/ww1936/Victory";
import { stepToDate, wwRunnerCapture } from "./util";

describe("the fast unlimited game past the 45-minute mark", () => {
  test("the clock runs on: a sensible date, no timer end, no winner", async () => {
    const { runner, updates } = await wwRunnerCapture({
      ww1936Unlimited: true,
      ww1936FastTempo: true,
    });
    const g = runner.game;
    const ww = g.worldWar()!;
    expect(g.config().msPerTick()).toBe(100);
    expect(g.config().maxTimerMinutes()).toBeNull();

    stepToDate(runner, "1946-03-01");

    // Past 1945-08 and past 45:00 by far; ticks are 100 ms.
    expect(g.elapsedGameSeconds()).toBeGreaterThan(45 * 60);
    expect(g.elapsedGameSeconds()).toBe(g.ticks() / 10);
    const day = ww.day(g.ticks());
    expect(day).toBe(dayOfDate("1946-03-01"));
    expect(formatIsoDate(dateOfDay(day))).toBe("1946-03-01");
    // No end by time: no verdict, no winner, no Win update.
    expect(worldWarVerdict(g, ww, g.elapsedGameSeconds())).toBeNull();
    expect(g.getWinner()).toBeNull();
    expect(updates.flatMap((u) => u.updates[GameUpdateType.Win])).toEqual([]);
  }, 300_000);
});
