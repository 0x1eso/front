// World War 1936 P3 (spec §4.1, §6.1, §9.1): political power and the
// weekly drift of the bases, on the test map ww1936pol with the test
// content (a human country: no AI politics, no AI economy).
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { lawBlock } from "@openfront/engine/ww1936/economy/LawsRun";
import { hireAdvisor } from "@openfront/engine/ww1936/politics/Advisors";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { payPp } from "@openfront/engine/ww1936/politics/Power";
import { addSpirit } from "@openfront/engine/ww1936/politics/Spirits";
import { stabilityLines } from "@openfront/engine/ww1936/politics/Stability";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, stepTo, wwRunner } from "./util";

const DEU_HUMAN = [{ clientID: HUMAN, country: "DEU" as const }];

/** Runs until country `id`'s political step of day `d` is done. */
function afterDay(runner: GameRunner, id: number, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (id % WW_DAY_SPLIT) + 1);
}

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      spirits: [
        { id: "gen_t_spirit", stats: { ppGainPct: 10 }, icon: "flag" },
        {
          id: "t_drift",
          stats: { stabilityWeeklyBp: 100, warSupportWeeklyBp: -50 },
          icon: "flag",
        },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function deu() {
  const runner = await wwRunner({}, DEU_HUMAN, POL);
  const g = runner.game;
  const p = pol(g);
  const id = byTag(g, "DEU").smallID();
  return { runner, g, p, id, c: p.country(id)! };
}

describe("political power", () => {
  it("PP grows by the daily gain and stops at 1,500", async () => {
    const { runner, p, id, c } = await deu();
    afterDay(runner, id, 2);
    // Days 0, 1 and 2: 2.00 a day (no modifiers, 51% stability: +0%).
    expect(c.ppMilli).toBe(50_000 + 3 * 2000);
    expect(c.ppCumMilli).toBe(3 * 2000);
    addSpirit(p, id, "gen_t_spirit", undefined, 2);
    expect(p.dailyGainMilli(id)).toBe(2200);
    let before = c.ppMilli;
    afterDay(runner, id, 3);
    expect(c.ppMilli - before).toBe(2200);
    // The cap: what goes over 1,500 is lost.
    c.ppMilli = 1_499_000;
    afterDay(runner, id, 4);
    expect(c.ppMilli).toBe(1_500_000);
    before = c.ppCumMilli;
    afterDay(runner, id, 5);
    expect(c.ppMilli).toBe(1_500_000);
    // The running total counts every day's gain.
    expect(c.ppCumMilli - before).toBe(2200);
  });

  it("a negative PP blocks spending and costs 10% stability", async () => {
    const { runner, g, p, id, c } = await deu();
    afterDay(runner, id, 1);
    expect(c.stabBp).toBe(5100);
    c.ppMilli = -10_000;
    expect(payPp(p, id, 0)).toBe(false);
    expect(payPp(p, id, 10)).toBe(false);
    expect(c.ppMilli).toBe(-10_000);
    expect(hireAdvisor(p, id, 0, "title:administrator", 1)).toBe("no_pp");
    const ce = g.worldWar()!.economy.country(id)!;
    expect(lawBlock(g.worldWar()!.economy, ce, "economy", "civilian", 2)).toBe(
      "no_pp",
    );
    afterDay(runner, id, 2);
    // Spec §4.1: −10% while below 0 (−8 PP after the day's +2).
    expect(c.ppMilli).toBe(-8000);
    expect(c.stabBp).toBe(4100);
    expect(stabilityLines(p, id, "stab")).toContainEqual({
      key: "ww1936.pol.line.stab_no_pp",
      bp: -1000,
    });
    // Below 50% stability: −0.5% PP gain per point (spec §6.2).
    expect(c.stats.ppGainPct).toBe(-4);
    c.ppMilli = 0;
    afterDay(runner, id, 3);
    expect(c.stabBp).toBe(5100);
    expect(stabilityLines(p, id, "stab").map((l) => l.key)).not.toContain(
      "ww1936.pol.line.stab_no_pp",
    );
  });

  it("weekly drift moves the bases", async () => {
    const { runner, p, id, c } = await deu();
    afterDay(runner, id, 0);
    addSpirit(p, id, "t_drift", undefined, 0);
    const seen: [number, number, number][] = [];
    for (let d = 1; d <= 15; d++) {
      afterDay(runner, id, d);
      seen.push([d, c.stabBaseBp, c.wsBaseBp]);
    }
    // Every 7 days, on (day + smallID) % 7 === 0 (spec §6.1).
    let stab = 5000;
    let ws = 5000;
    for (const [d, s, w] of seen) {
      if ((d + id) % 7 === 0) {
        stab += 100;
        ws -= 50;
      }
      expect([d, s, w]).toEqual([d, stab, ws]);
    }
    expect(stab).toBe(5200);
    expect(ws).toBe(4900);
    // The bases stay within 0..100%.
    c.wsBaseBp = 20;
    for (let d = 16; d <= 23; d++) afterDay(runner, id, d);
    expect(c.wsBaseBp).toBe(0);
  });
});
