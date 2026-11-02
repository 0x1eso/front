// World War 1936 P6 lane D (plan Task 2, spec §3.5, §19.2): the AI's
// command — officer corps, field
// marshals and army groups. One AI country at a time, the seed fixed by
// the game (plan decision 30).
import { ARMY_SPIRIT_CATEGORIES } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiSpiritPlan } from "@openfront/engine/ww1936/depth/AiCommand";
import { FM_ARMY } from "@openfront/engine/ww1936/depth/ArmyGroups";
import { makeMarshal } from "@openfront/engine/ww1936/depth/Command";
import { aiLandTick } from "@openfront/engine/ww1936/land/AiLand";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { dropPact, placeArmy, stepTo, warAfterPrep, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;
const HUMAN_ITA = [{ clientID: "HUMANITA", country: "ITA" as const }];

function afterTurn(runner: GameRunner, id: number, day: number): number {
  const ww = runner.game.worldWar()!;
  return dayStartTick(day, ww.prepEndTick()) + (id % WW_DAY_SPLIT) + 1;
}

describe("the AI's doctrines and command (spec §19.2)", () => {
  it("the AI's officer corps follow its grand doctrine", async () => {
    const runner = await wwRunner({}, HUMAN_ITA, DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    ww.land.country(DEU)!.armyXpMilli = 100_000;
    // Germany's peacetime AI day: day % 10 === smallID % 10.
    stepTo(runner, afterTurn(runner, DEU, 1));
    const plan = aiSpiritPlan(d, DEU);
    const spirits = d.country(DEU)!.cmd.spirits;
    // The three land categories, 25 experience each.
    expect(spirits.slice(0, 3)).toEqual(plan.slice(0, 3));
    expect(d.xpOf(DEU, 0)).toBeLessThanOrEqual(100 - 75 + 1);
    ARMY_SPIRIT_CATEGORIES.forEach((_, cat) => {
      expect(Math.floor(plan[cat] / 3)).toBe(cat);
    });
  });

  it("AI promotes a marshal when it has four armies", async () => {
    const runner = await wwRunner({}, HUMAN_ITA, DEEP.map);
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = g.worldWar()!;
    const land = ww.land;
    const ce = ww.economy.country(DEU)!;
    ce.manpower = 1_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    while (land.armiesOf(DEU).length < 4) {
      placeArmy(g, "DEU", DEEP.region.berlin, 5);
    }
    ww.depth.country(DEU)!.cmd.cpMilli = 60_000;
    ww.politics.country(DEU)!.ppMilli = 200_000;
    const day = 1;
    const sum = (x: { att: number; dfn: number; plan: number; log: number }) =>
      x.att + x.dfn + x.plan + x.log;
    const cl = land.country(DEU)!;
    const best = Math.max(
      ...cl.generals
        .filter((x) => canServe(land, x, day))
        .filter((x) => x.level >= 3 || sum(x) >= 12)
        .map(sum),
    );
    expect(land.fieldMarshalCount(DEU)).toBe(0);
    stepTo(runner, afterTurn(runner, DEU, day));
    expect(land.armiesOf(DEU).length).toBeGreaterThanOrEqual(4);
    expect(land.fieldMarshalCount(DEU)).toBe(1);
    const fm = cl.generals.find((x) => x.fm)!;
    expect(sum(fm)).toBe(best);
    expect(fm.fmTraits).not.toBe(0);
    // He leads no army, and P2's AI does not give him one.
    stepTo(runner, afterTurn(runner, DEU, day + 3));
    expect(fm.army).toBe(FM_ARMY);
    expect(land.armiesOf(DEU).some((a) => a.general === fm.id)).toBe(false);
  });

  it("at war the AI groups the armies of a front under its marshal", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANPOL", country: "POL" }],
      DEEP.map,
    );
    const g = runner.game;
    dropPact(g, "DEU", "POL");
    warAfterPrep(runner, "HUMANPOL", "DEU");
    const ww = g.worldWar()!;
    const land = ww.land;
    expect(ww.isAtWar(DEEP.tag.POL, DEU)).toBe(true);
    const cl = land.country(DEU)!;
    const day = ww.day(g.ticks());
    const fm = cl.generals.find((x) => x.army === 0 && canServe(land, x, day))!;
    makeMarshal(ww.depth, DEU, fm, 0);
    // A few days: P2's AI gives its armies fronts against Poland, then the
    // depth AI (daily at war) forms the group.
    stepTo(runner, afterTurn(runner, DEU, day + 4));
    const fronts = land
      .armiesOf(DEU)
      .filter((a) => a.order.kind === "front" || a.order.kind === "plan");
    expect(fronts.length).toBeGreaterThan(0);
    const group = ww.depth.groups.find((x) => x.owner === DEU);
    expect(group?.fm).toBe(fm.id);
    for (const a of fronts) expect(a.group).toBe(group!.id);
    // Front armies come first for reinforcement (spec §19.2).
    for (const a of fronts) expect(a.priority).toBe(2);
  });

  it("P2's AI never seats a field marshal, even right after an army reset", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: "HUMANPOL", country: "POL" }],
      DEEP.map,
    );
    const g = runner.game;
    dropPact(g, "DEU", "POL");
    warAfterPrep(runner, "HUMANPOL", "DEU");
    const ww = g.worldWar()!;
    const land = ww.land;
    const cl = land.country(DEU)!;
    const day = ww.day(g.ticks());
    const fm = cl.generals.find((x) => x.army === 0 && canServe(land, x, day))!;
    makeMarshal(ww.depth, DEU, fm, 0);
    // The best general there is: P2's AI would take him first.
    fm.att = 5;
    fm.dfn = 5;
    fm.plan = 5;
    fm.log = 5;
    const ce = ww.economy.country(DEU)!;
    ce.manpower = 1_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    const big = placeArmy(g, "DEU", DEEP.region.berlin, 6);
    // A P2 reset (capitulation, purge, roster end) leaves him at army 0
    // until the next depth day; the new army has no general.
    fm.army = 0;
    expect(big.general).toBe(0);
    aiLandTick(land, DEU, day);
    expect(land.armiesOf(DEU).some((a) => a.general === fm.id)).toBe(false);
    expect(fm.army).toBe(0);
    // AiLand skipped him: the next free general took the army.
    expect(big.general).not.toBe(0);
  });
});
