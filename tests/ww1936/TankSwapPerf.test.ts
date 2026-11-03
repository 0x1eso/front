// Tank design reform, phase 1: what the generation swap costs a country's day
// with 2,000 divisions — when nothing is to be swapped and when everything is.
// Rough by design (the machine is shared): the bounds are loose, the numbers
// are the point (the file the run writes is read by hand).
import {
  equipKey,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIP_KEYS } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { fieldDivision } from "@openfront/engine/ww1936/land/LandStartRun";
import {
  dailySustain,
  swapOld,
  swapPlanOf,
} from "@openfront/engine/ww1936/land/Sustain";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { HUMAN, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const LONDON = DEEP.region.london;
const M1 = equipKey("medium_tank", 1);
const M3 = equipKey("medium_tank", 3);
const DIVISIONS = 2_000;

const best = (f: () => void, n = 7): number => {
  let b = Infinity;
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    f();
    b = Math.min(b, performance.now() - t);
  }
  return b;
};

describe("generation swap cost", () => {
  it("2,000 divisions: nothing to swap, a plan with nothing held, everything to swap", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const l = ww.land;
    const ce = ww.economy.country(GBR)!;
    for (const t of WW_TECH_IDS) ce.addTech(t);
    ce.manpower = 1_000_000_000;
    for (const k of GROUND_EQUIP_KEYS) ce.stock[k] = 0;
    const cl = l.country(GBR)!;
    const tpl = cl.nextTemplateId;
    expect(
      l.issue(
        GBR,
        {
          kind: "template_save",
          template: 0,
          base: 0,
          name: "T",
          battalions: ["medium_armor"],
          support: [],
        } as never,
        "player",
      ),
    ).toBeNull();
    ce.stock[M1] = 200_000;
    const army = l.newArmy(GBR)!;
    for (let i = 0; i < DIVISIONS; i++) {
      expect(fieldDivision(l, cl, ce, cl.template(tpl)!, LONDON, army)).toBe(
        true,
      );
    }
    const rows = [...l.rowsOf(GBR)];
    expect(rows.length).toBeGreaterThanOrEqual(DIVISIONS);
    for (const r of rows) l.divisions.supply[r] = 1000;
    const out: string[] = [];

    // 1. Divisions hold only old; no better stock anywhere: the plan is null.
    ce.stock[M3] = 0;
    expect(swapPlanOf(l, ce, GBR)).toBeNull();
    out.push(
      `nothing to swap, plan only: ${best(() => swapPlanOf(l, ce, GBR)).toFixed(3)} ms`,
    );
    out.push(
      `nothing to swap, whole day: ${best(() => dailySustain(l, GBR, 10)).toFixed(3)} ms`,
    );

    // 2. Better stock exists but no division holds anything old: rows scanned.
    const jM1 = GROUND_EQUIP_KEYS.indexOf(M1);
    const jM3 = GROUND_EQUIP_KEYS.indexOf(M3);
    for (const r of rows) {
      const n = l.divisions.equipOf(r)[jM1];
      l.addEquip(r, jM1, -n);
      l.addEquip(r, jM3, n);
    }
    ce.stock[M3] = 200_000;
    const plan = swapPlanOf(l, ce, GBR);
    expect(plan).not.toBeNull();
    out.push(
      `plan, nothing held old, rows scanned: ${best(() => {
        for (const r of rows) swapOld(l, ce, r, plan!);
      }).toFixed(3)} ms`,
    );
    out.push(
      `plan, nothing held old, whole day: ${best(() => dailySustain(l, GBR, 11)).toFixed(3)} ms`,
    );

    // 3. Everything old: each division swaps its share (a fresh set each timing).
    const reset = () => {
      for (const r of rows) {
        const n = l.divisions.equipOf(r)[jM3];
        l.addEquip(r, jM3, -n);
        l.addEquip(r, jM1, n);
        ce.stock[M3] += n;
        ce.stock[M1] -= n;
      }
    };
    const timed: number[] = [];
    for (let i = 0; i < 5; i++) {
      reset();
      const p = swapPlanOf(l, ce, GBR)!;
      const t = performance.now();
      for (const r of rows) swapOld(l, ce, r, p);
      timed.push(performance.now() - t);
    }
    out.push(
      `everything old, swap rows only: ${Math.min(...timed).toFixed(3)} ms`,
    );
    const whole: number[] = [];
    for (let i = 0; i < 5; i++) {
      reset();
      const t = performance.now();
      dailySustain(l, GBR, 12 + i);
      whole.push(performance.now() - t);
    }
    out.push(`everything old, whole day: ${Math.min(...whole).toFixed(3)} ms`);
    // (Set W21_PERF_OUT to read the numbers: they are rough on a shared machine.)
    const file = process.env.W21_PERF_OUT;
    if (file !== undefined) {
      (await import("node:fs")).writeFileSync(file, out.join("\n"));
    }
    // Rough bounds only.
    expect(Math.min(...timed)).toBeLessThan(2_000);
  }, 120_000);
});
