// World War 1936 P6 lane D (plan Task 2, spec §3.5, §19.2): the AI's
// doctrines and command — the historical start doctrines, a woken
// country's start pick (coordinator ruling), officer corps, field
// marshals and army groups. One AI country at a time, the seed fixed by
// the game (plan decision 30).
import {
  ARMY_SPIRIT_CATEGORIES,
  GRAND_DOCTRINES,
  type StartDoctrineDef,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { startDoctrinePick } from "@openfront/engine-lib/ww1936/DoctrineRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { aiSpiritPlan } from "@openfront/engine/ww1936/depth/AiCommand";
import { FM_ARMY } from "@openfront/engine/ww1936/depth/ArmyGroups";
import { makeMarshal } from "@openfront/engine/ww1936/depth/Command";
import { aiPersonality } from "@openfront/engine/ww1936/economy/AiEconomy";
import { activateCountry } from "@openfront/engine/ww1936/endgame/Activate";
import { canServe } from "@openfront/engine/ww1936/land/GeneralsRun";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  dropPact,
  placeArmy,
  step,
  stepTo,
  warAfterPrep,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const DEU = DEEP.tag.DEU;
const HUMAN_ITA = [{ clientID: "HUMANITA", country: "ITA" as const }];

/** Spec §3.5's German row (K5 has no data on this base: one test row). */
const DEU_ROW: StartDoctrineDef = {
  tag: "DEU",
  gd: ["gd_mobile", "gd_trade_interdiction", "gd_battlefield_support"],
  sub: [
    "inf_elastic",
    "arm_breakthrough",
    "sup_deep_ops",
    "nav_cruiser",
    "nav_wolfpack",
    "nav_carrier_support",
    "air_escort",
    "air_ground_attack",
    "air_maritime_strike",
  ],
};

function afterTurn(runner: GameRunner, id: number, day: number): number {
  const ww = runner.game.worldWar()!;
  return dayStartTick(day, ww.prepEndTick()) + (id % WW_DAY_SPLIT) + 1;
}

/** The engine's own start pick for a country (DoctrineRules.startDoctrinePick, its inputs). */
function enginePick(ww: WorldWar, id: number, table: StartDoctrineDef[]) {
  const tag = ww.tagOf(id);
  const ce = ww.economy.country(id);
  return startDoctrinePick({
    table,
    tag,
    personality: aiPersonality(tag),
    historical: true,
    navy:
      ce !== null &&
      ce.totals.dock >= 3 &&
      ww.economy.regionsOf(id).some((r) => ww.scenario.harborOf(r) !== 0),
    seed: ww.politics.seed,
    id,
  });
}

const idx = (list: readonly string[], xs: readonly (string | null)[]) =>
  xs.map((x) => (x === null ? -1 : list.indexOf(x)));

describe("the AI's doctrines and command (spec §19.2)", () => {
  it("historical AI starts with the spec §3.5 doctrines", async () => {
    usePoliticsContent(depthFixture({ startDoctrines: [DEU_ROW] }));
    const runner = await wwRunner({}, HUMAN_ITA, DEEP.map);
    expect(runner.game.config().historicalAi()).toBe(true);
    stepTo(runner, WW_PREP_TICKS + 1);
    const ww = runner.game.worldWar()!;
    const doc = ww.depth.country(DEU)!.doc;
    // Its row, but for the seeded 25% chance per domain (games differ).
    const row = startDoctrinePick({
      table: [DEU_ROW],
      tag: "DEU",
      personality: "aggressor",
      historical: true,
      navy: false,
      seed: ww.politics.seed,
      id: DEU,
      deviationPct: 0,
    });
    expect(row.gd).toEqual(DEU_ROW.gd);
    expect(doc.gd).toEqual(
      idx(GRAND_DOCTRINES, enginePick(ww, DEU, [DEU_ROW]).gd),
    );
    // The sub-doctrines are the row's whatever the dice say.
    expect(doc.sub).toEqual(idx(SUBDOCTRINES, DEU_ROW.sub));
  });

  it("a country woken after day 0 takes its start doctrines", async () => {
    const runner = await wwRunner({}, HUMAN_ITA, DEEP.map);
    stepTo(runner, WW_PREP_TICKS + 10);
    const ww = runner.game.worldWar()!;
    const svk = ww.scenario.smallIdOf("SVK");
    expect(svk).toBeGreaterThan(0);
    const doc = ww.depth.country(svk)!.doc;
    expect(doc.gd).toEqual([-1, -1, -1]);
    activateCountry(
      ww.endgame,
      "SVK",
      { regions: [DEEP.region.krakow] },
      runner.game.ticks(),
    );
    expect(ww.isActor(svk)).toBe(true);
    step(runner, 2 * WW_DAY_SPLIT + 2);
    const pick = enginePick(ww, svk, []);
    expect(doc.gd).toEqual(idx(GRAND_DOCTRINES, pick.gd));
    // A minor: a land doctrine at least (spec §3.5 "그 밖").
    expect(doc.gd[0]).toBeGreaterThanOrEqual(0);
    // A human country never gets one by itself.
    expect(ww.depth.country(DEEP.tag.ITA)!.doc.gd).toEqual([-1, -1, -1]);
  });

  it("the AI's officer corps follow its grand doctrine", async () => {
    usePoliticsContent(depthFixture({ startDoctrines: [DEU_ROW] }));
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
});
