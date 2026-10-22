// World War 1936 P6 (plan decisions 21, 22, 24; Review Focus 6): the depth
// systems wired into P1–P3, and nothing of them without the mode.
import { SPECIAL_PROJECTS } from "@openfront/engine-api/ww1936/DepthTypes";
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { lineOutputMilli } from "@openfront/engine-lib/ww1936/EconomyRules";
import { stepProduction } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { MINI, step, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

describe("World War 1936 P6: wiring", () => {
  it("vanilla rules untouched when the mode is off", async () => {
    // (tests/VanillaDigest.test.ts pins the off game's hashes.)
    const runner = await wwRunner({ worldWar1936: false }, [], MINI);
    expect(runner.game.worldWar()).toBeNull();
    expect(runner.game.config().gameConfig().ww1936Nukes).toBeUndefined();
  });

  it("depth stats part feeds recomputeStats", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANDEU", country: "DEU" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const ce = ww.economy.country(DEEP.tag.DEU)!;
    const before = { ...ce.stats };
    // A grand doctrine picked: D's doctrineStatsOf is a stub, so nothing
    // moves yet (lane D's tests take over once it fills it).
    d.country(DEEP.tag.DEU)!.doc.gd[0] = 0;
    d.markStats(DEEP.tag.DEU);
    step(runner);
    expect({ ...ce.stats }).toEqual(before);
    // The foundation's own line: the proximity fuze's artillery +5%.
    d.country(DEEP.tag.DEU)!.proj.done |=
      1 << SPECIAL_PROJECTS.indexOf("sp_proximity_fuze");
    d.markStats(DEEP.tag.DEU);
    step(runner);
    expect(ce.stats.artillerySoftPct).toBe(before.artillerySoftPct + 5);
  });

  it("energy penalty reaches output", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANITA", country: "ITA" }],
      DEEP.map,
    );
    stepTo(runner, WW_PREP_TICKS + 20);
    const ww = runner.game.worldWar()!;
    const econ = ww.economy;
    const ce = econ.country(DEEP.tag.ITA)!;
    expect(ce.lines.length).toBeGreaterThan(0);
    // Settle the working factories, then a day at 857‰ energy.
    stepProduction(econ, ce);
    const eff = ce.lines.map((l) => l.effBp);
    ww.depth.country(DEEP.tag.ITA)!.mech.energyPm = 857;
    expect(ww.depth.energyOutputPct(DEEP.tag.ITA)).toBe(-7);
    stepProduction(econ, ce);
    const pct = ce.law().outputPct + ce.stats.outputPct - 7;
    ce.lines.forEach((l, i) => {
      if (l.active === 0) return;
      expect(l.lastOutput).toBe(lineOutputMilli(l.active, eff[i], pct, l.fill));
    });
  });

  it("the economy hooks are neutral with no depth content", async () => {
    const runner = await wwRunner({}, [], DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 10);
    const d = runner.game.worldWar()!.depth;
    expect(d.nukesOn()).toBe(true);
    // Lane W1: coal and the energy follow the map's v5 columns, not the
    // content (Energy.test.ts); the content-driven demand (uranium) is 0.
    const uranium = RESOURCE_IDS.indexOf("uranium");
    for (let id = 1; id < d.cap; id++) {
      expect(d.priorityDemand(id)[uranium]).toBe(0);
      expect(d.civsIn(id) - d.civsOut(id)).toBe(0);
    }
    for (const [, got] of d.lastPriorityGot) expect(got[uranium]).toBe(0);
  });

  it("the energy is neutral on a map without the v5 columns (lane W1)", async () => {
    const runner = await wwRunner({}, [], MINI);
    stepTo(runner, WW_PREP_TICKS + 10);
    const d = runner.game.worldWar()!.depth;
    for (let id = 1; id < d.cap; id++) {
      expect(d.priorityDemand(id)).toEqual(RESOURCE_IDS.map(() => 0));
      expect(d.energyOutputPct(id)).toBe(0);
    }
    expect(d.lastPriorityGot.size).toBe(0);
  });
});
