// World War 1936 ww91 section 8: the plans wired into the AI's day, on the test
// map (a human's Poland, Germany the AI). The rule functions are in AiPlans.test.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import {
  EQUIP_KEYS,
  WW_DAY_SPLIT,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  AI_PLANS,
  type NationalPlan,
} from "@openfront/engine-lib/ww1936/AiPlans";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { startDoctrinePick } from "@openfront/engine-lib/ww1936/DoctrineRules";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { declareWar } from "@openfront/engine/ww1936/Diplomacy";
import { aiLandTick } from "@openfront/engine/ww1936/land/AiLand";
import {
  AI_UNIT_FOCUSES,
  aiPickFocus,
} from "@openfront/engine/ww1936/politics/AiFocus";
import { unlockTemplate } from "@openfront/engine/ww1936/politics/EffectsEcon";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { afterEach, describe, expect, it } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  pol,
  stepTo,
  takeRegion,
  warAfterPrep,
  wwGameStart,
  wwRunner,
} from "./util";

/** What a line's four companies ask of the tree. */
const COMPANY_TECHS: readonly WwTechId[] = [
  "artillery_1",
  "support_eq_1",
  "anti_tank_1",
  "engineer_company",
  "recon_company",
];

function finishDay(runner: GameRunner, d: number) {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
}

const row = AI_PLANS as Record<string, Partial<NationalPlan>>;
const kept = row.DEU;
afterEach(() => {
  row.DEU = kept;
});

/** On world1936: Germany the AI, Poland a human, at war, the board blank. */
async function war() {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const runner = await createGameRunner(
    wwGameStart({ historicalAi: false }, [{ clientID: HUMAN, country: "POL" }]),
    undefined,
    await loadMapFiles(
      new NodeGameMapLoader(path.join(dir, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    ),
    (gu) => {
      if ("errMsg" in gu) throw new Error(gu.errMsg);
    },
  );
  const g = runner.game;
  const l = land(g);
  const deu = byTag(g, "DEU").smallID();
  const pol = byTag(g, "POL").smallID();
  warAfterPrep(runner, HUMAN, "DEU");
  clearLand(g);
  for (const id of [deu, pol]) {
    const ce = l.econ.country(id)!;
    ce.manpower += 10_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
  }
  const sc = l.scenario;
  const front = sc.landRegions
    .map((r) => r.id)
    .filter(
      (r) =>
        l.controller[r] === deu &&
        sc.edgesOf(r).some((e) => l.controller[e.to] === pol),
    );
  const across = (r: number) =>
    sc.edgesOf(r).find((e) => l.controller[e.to] === pol)!.to;
  return { runner, g, l, deu, pol, front, across };
}

describe("rule 3 in the AI's day", () => {
  it("an outnumbered front keeps its fist behind the line, and lets it go when level", async () => {
    row.DEU = { poolPct: 25 };
    const { runner, g, l, front, across } = await war();
    const mine = [0, 1, 2, 3, 4, 5].map((i) =>
      placeArmy(g, "DEU", front[i % front.length], 8),
    );
    const theirs = [0, 1, 2, 3].map((i) =>
      placeArmy(g, "POL", across(front[i % front.length]), 24),
    );
    const day = g.worldWar()!.day(g.ticks());
    for (let d = day + 1; d <= day + 3; d++) finishDay(runner, d);
    const line = new Set(front);
    const back = () =>
      mine.filter(
        (a) =>
          l.armies.has(a.id) &&
          a.order.kind === "front" &&
          a.order.zone.length === 1 &&
          !line.has(a.order.zone[0]),
      );
    expect(back().length).toBeGreaterThan(0);
    expect(back().length).toBeLessThan(mine.length - 1);
    // The enemy thinned out: the pool goes in (one army may stay the reserve).
    for (const a of theirs.slice(1)) {
      for (const id of [...a.divisions]) {
        l.killDivision(l.divisions.rowOf(id), false);
      }
    }
    for (let d = day + 4; d <= day + 6; d++) finishDay(runner, d);
    expect(back().length).toBeLessThanOrEqual(1);
  }, 120_000);
});

describe("rule 1 in the AI's day", () => {
  it("many enemies on land: the one that matters gets the effort", async () => {
    const { runner, g, l, deu, pol, front, across } = await war();
    const ww = g.worldWar()!;
    dropPact(g, "DEU", "FRA");
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "FRA"), g.ticks());
    const fra = byTag(g, "FRA").smallID();
    const sc = l.scenario;
    const west = sc.landRegions
      .map((r) => r.id)
      .filter(
        (r) =>
          l.controller[r] === deu &&
          sc.edgesOf(r).some((e) => l.controller[e.to] === fra),
      );
    expect(west.length).toBeGreaterThan(0);
    const ce = l.econ.country(fra)!;
    ce.manpower += 10_000_000;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 100_000;
    for (let i = 0; i < 4; i++) {
      placeArmy(g, "DEU", front[i % front.length], 12);
      placeArmy(g, "DEU", west[i % west.length], 12);
    }
    placeArmy(g, "POL", across(front[0]), 16);
    placeArmy(
      g,
      "FRA",
      sc.edgesOf(west[0]).find((e) => l.controller[e.to] === fra)!.to,
      16,
    );
    const day = ww.day(g.ticks());
    for (let d = day + 1; d <= day + 75; d++) finishDay(runner, d);
    // France's small allies (no division facing us) don't hold up the war:
    // with Poland gone an effort stands on France.
    expect(ww.isAtWar(deu, pol)).toBe(false);
    expect(
      l
        .armiesOf(deu)
        .filter((a) => a.order.kind === "plan" && a.order.enemy === fra).length,
    ).toBeGreaterThan(0);
  }, 240_000);
});

describe("the plan's small rules in the game", () => {
  it("the Soviet Union takes its evacuation path when the west is threatened", async () => {
    const { g } = await war();
    const ww = g.worldWar()!;
    const pol = ww.politics;
    const sun = byTag(g, "SUN").smallID();
    dropPact(g, "DEU", "SUN");
    declareWar(g, ww, byTag(g, "DEU"), byTag(g, "SUN"), g.ticks());
    const c = pol.country(sun)!;
    c.focus = null;
    c.queue = [];
    const day = ww.day(g.ticks());
    const west = [...pol.content.groupIdx.get("soviet_west_industry")!.regions];
    expect(west.length).toBeGreaterThan(0);
    takeRegion(g, west[0], "DEU");
    expect(aiPickFocus(pol, sun, day)).toBe("sun_patriotic_war");
  }, 120_000);

  it("a major's refit walks to its table; the width rule leaves it alone", async () => {
    const runner = await wwRunner({ historicalAi: false }, []);
    const g = runner.game;
    const l = land(g);
    const deu = byTag(g, "DEU").smallID();
    const ce = l.econ.country(deu)!;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
    ce.researched.add("artillery_1");
    for (let i = 0; i < 6; i++) aiLandTick(l, deu, deu);
    const line = l.country(deu)!.templates[0].def.battalions;
    expect(line.filter((b) => b === "infantry")).toHaveLength(8);
    expect(line.filter((b) => b === "artillery")).toHaveLength(2);
    expect(line).toHaveLength(10);
  }, 60_000);

  it("ww105: a major's line, and its focus line, take their guns as companies", async () => {
    const runner = await wwRunner({ historicalAi: false }, []);
    const g = runner.game;
    const l = land(g);
    const sun = byTag(g, "SUN").smallID();
    const ce = l.econ.country(sun)!;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
    for (const t of COMPANY_TECHS) ce.researched.add(t);
    const focus = unlockTemplate(pol(g), sun, "sun_rifle_ii")!;
    for (let i = 0; i < 8; i++) aiLandTick(l, sun, sun);
    for (const tpl of [l.country(sun)!.templates[0], focus]) {
      const { battalions, support } = tpl.def;
      expect(battalions.filter((b) => b === "infantry")).toHaveLength(6);
      expect(battalions.filter((b) => b === "artillery")).toHaveLength(1);
      expect(battalions).toHaveLength(7);
      expect([...support].sort()).toEqual([
        "engineer",
        "recon",
        "support_anti_tank",
        "support_artillery",
      ]);
    }
  }, 60_000);

  it("ww105: a line out of company gear gives the company up and takes it back", async () => {
    const runner = await wwRunner({ historicalAi: false }, []);
    const g = runner.game;
    const l = land(g);
    const sun = byTag(g, "SUN").smallID();
    const ce = l.econ.country(sun)!;
    for (let k = 0; k < ce.stock.length; k++) ce.stock[k] += 1_000_000;
    for (const t of COMPANY_TECHS) ce.researched.add(t);
    for (let i = 0; i < 8; i++) aiLandTick(l, sun, sun);
    const line = l.country(sun)!.templates[0];
    expect(line.def.support).toContain("engineer");
    const setGear = (n: number) => {
      EQUIP_KEYS.forEach(([t], k) => {
        if (t === "support_equipment") ce.stock[k] = n;
      });
    };
    // Training goes on: a stock near nothing alone takes no company away.
    const cl = l.country(sun)!;
    cl.trainees.push({
      entry: 0,
      template: line.id,
      men: 0,
      equip: [],
      days: 1,
    });
    setGear(0);
    aiLandTick(l, sun, sun);
    expect(line.def.support).toContain("recon");
    // Nothing trains: the last company on the gear goes, one a refit; the guns
    // stay, and none comes back while the stock is empty.
    cl.trainees.length = 0;
    cl.training.length = 0;
    setGear(0);
    aiLandTick(l, sun, sun);
    expect(line.def.support).not.toContain("recon");
    expect(line.def.support).toContain("engineer");
    cl.trainees.length = 0;
    cl.training.length = 0;
    setGear(0);
    aiLandTick(l, sun, sun);
    expect(line.def.support).not.toContain("engineer");
    expect(line.def.support).toContain("support_artillery");
    expect(line.def.support).toContain("support_anti_tank");
    setGear(1_000_000);
    aiLandTick(l, sun, sun);
    aiLandTick(l, sun, sun);
    expect(line.def.support).toContain("engineer");
    expect(line.def.support).toContain("recon");
  }, 60_000);
});

describe("the switch (ww91 8.1)", () => {
  it("a major keeps its own doctrine row with the historical AI off", () => {
    const table = [
      { tag: "DEU", gd: ["gd_a", null, null], sub: [null, null, null] },
      { tag: "@aggressor", gd: ["gd_b", null, null], sub: [null, null, null] },
    ];
    const pick = (tag: string, historical: boolean) =>
      startDoctrinePick({
        tag,
        personality: "aggressor",
        historical,
        navy: false,
        table,
        seed: 1,
        id: 1,
        deviationPct: 0,
      } as never).gd[0];
    expect(pick("DEU", false)).toBe("gd_a");
    expect(pick("DEU", true)).toBe("gd_a");
    expect(pick("POL", false)).toBe("gd_b");
  });

  it("the seven unit focuses are real focuses", async () => {
    const runner = await wwRunner({ historicalAi: false }, []);
    const pol = runner.game.worldWar()!.politics;
    const ids = new Set(pol.content.focuses.map((f) => f.id));
    for (const f of AI_UNIT_FOCUSES) expect(ids.has(f)).toBe(true);
    expect(AI_UNIT_FOCUSES.size).toBe(7);
  });
});
