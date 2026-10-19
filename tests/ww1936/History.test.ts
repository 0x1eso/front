import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  HISTORY,
  HISTORY_MAX_DELAY_DAYS,
} from "@openfront/engine-lib/ww1936/History";
import { rollHistory } from "@openfront/engine/ww1936/HistoryRun";
import { byTag, HUMAN, step, stepTo, wwRunner } from "./util";

const DEU_POL = HISTORY.findIndex(
  (e) => e.actor === "DEU" && e.target === "POL",
);
const GBR_DEU = HISTORY.findIndex(
  (e) => e.actor === "GBR" && e.target === "DEU",
);

/** Only the given entries, at the given days. */
function only(entries: Record<number, number>): [number, boolean][] {
  return HISTORY.map((_, i) => [entries[i] ?? -1, false]);
}

describe("the historical calendar (spec §7.4)", () => {
  test("the table is sorted by date and names two different countries", () => {
    for (let i = 1; i < HISTORY.length; i++) {
      expect(dayOfDate(HISTORY[i].date)).toBeGreaterThanOrEqual(
        dayOfDate(HISTORY[i - 1].date),
      );
    }
    for (const e of HISTORY) expect(e.actor).not.toBe(e.target);
  });

  test("each entry is skipped or happens 0..20 days late, the same way every time", async () => {
    const a = await wwRunner();
    const b = await wwRunner();
    step(a);
    step(b);
    const plan = a.game.worldWar()!.history();
    expect(plan).toHaveLength(HISTORY.length);
    expect(b.game.worldWar()!.history()).toEqual(plan);
    let skipped = 0;
    plan.forEach(([fire], i) => {
      if (fire === -1) {
        skipped++;
        return;
      }
      const day = dayOfDate(HISTORY[i].date);
      expect(fire).toBeGreaterThanOrEqual(day);
      expect(fire).toBeLessThanOrEqual(day + HISTORY_MAX_DELAY_DAYS);
    });
    expect(skipped).toBeLessThan(HISTORY.length / 3);
  });

  test("rolling uses one chance and one delay per entry", () => {
    const fake = { plan: [] as [number, boolean][] };
    const ww = {
      setHistory: (p: [number, boolean][]) => (fake.plan = p),
    } as unknown as Parameters<typeof rollHistory>[0];
    rollHistory(ww, new PseudoRandom(42), true);
    const replay = new PseudoRandom(42);
    HISTORY.forEach((e, i) => {
      const skip = replay.chance(10);
      const delay = replay.nextInt(0, HISTORY_MAX_DELAY_DAYS + 1);
      expect(fake.plan[i][0]).toBe(skip ? -1 : dayOfDate(e.date) + delay);
    });
    rollHistory(ww, new PseudoRandom(42), false);
    expect(fake.plan).toEqual([]);
  });

  test("historical AI off: no calendar", async () => {
    const runner = await wwRunner({ historicalAi: false });
    step(runner);
    expect(runner.game.worldWar()!.history()).toEqual([]);
  });

  test("a due entry fires for a nation: a declaration, then a join", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    step(runner);
    ww.setHistory(only({ [DEU_POL]: 2, [GBR_DEU]: 3 }));
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS) + 1);
    const [deu, pol, gbr, ita] = ["DEU", "POL", "GBR", "ITA"].map((t) =>
      byTag(g, t as "DEU"),
    );
    expect(ww.isAtWar(deu.smallID(), pol.smallID())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), deu.smallID())).toBe(false);
    stepTo(runner, dayStartTick(3, WW_PREP_TICKS) + 1);
    expect(ww.isAtWar(gbr.smallID(), deu.smallID())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), ita.smallID())).toBe(false);
    expect(ww.history()[DEU_POL][1]).toBe(true);
  });

  test("a human country is never moved by the calendar", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    step(runner);
    ww.setHistory(only({ [DEU_POL]: 1 }));
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    expect(
      ww.isAtWar(byTag(g, "DEU").smallID(), byTag(g, "POL").smallID()),
    ).toBe(false);
    expect(ww.history()[DEU_POL][1]).toBe(true);
  });

  test("an entry with a country the scenario lacks passes quietly", async () => {
    const runner = await wwRunner();
    const ww = runner.game.worldWar()!;
    step(runner);
    ww.setHistory(only({ 0: 1 })); // ESN → ESR: neither is on the test map
    stepTo(runner, dayStartTick(2, WW_PREP_TICKS));
    expect(ww.history()[0][1]).toBe(true);
    expect(ww.data().wars).toEqual([]);
  });
});
