// Tank design reform, phase 1: the automatic generation swap (Sustain) —
// a division holding old tanks takes non-old ones from the stock at
// reinforcement's pace, and the day costs nothing when there is nothing to swap.
import {
  DesignDef,
  KS,
  KS_FIELDS,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  MOVE_SEA,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  recommendedTank,
  tankStats,
} from "@openfront/engine-lib/ww1936/DesignRules";
import {
  oldInfoOf,
  rowScore,
  TANK_OLD_PCT,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import {
  dailySustain,
  swapPlanOf,
} from "@openfront/engine/ww1936/land/Sustain";
import { reinforceCap } from "@openfront/engine/ww1936/land/Training";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  gameHash,
  HUMAN,
  placeArmy,
  step,
  stepTo,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const LONDON = DEEP.region.london;
const M1 = equipKey("medium_tank", 1);
const M2 = equipKey("medium_tank", 2);
const M3 = equipKey("medium_tank", 3);
const sl = (k: number) => GROUND_EQUIP_KEYS.indexOf(k);

async function game() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "GBR" }],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const ce = ww.economy.country(GBR)!;
  for (const t of WW_TECH_IDS) ce.addTech(t);
  for (const k of GROUND_EQUIP_KEYS) ce.stock[k] = 0;
  const cl = ww.land.country(GBR)!;
  const id = cl.nextTemplateId;
  expect(
    ww.land.issue(
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
  return { runner, ww, ce, land: ww.land, tpl: id };
}

/** A division of `n` medium I tanks (the old static), supplied, with `fresh` medium III in the stock. */
async function setup(fresh: number) {
  const g = await game();
  g.ce.stock[M1] = 50;
  const army = placeArmy(g.runner.game, "GBR", LONDON, 1, g.tpl);
  const r = g.land.divisions.rowOf(army.divisions[0]);
  g.land.divisions.supply[r] = 1000;
  g.ce.stock[M3] = fresh;
  return { ...g, r };
}

const total = (g: Awaited<ReturnType<typeof setup>>) =>
  [M1, M2, M3].map((k) => g.ce.stock[k] + g.land.divisions.equipOf(g.r)[sl(k)]);

describe("generation swap", () => {
  it("the old static is old against the best, as the rule says", async () => {
    const g = await setup(100);
    const ks = g.land.keyStatsOf(GBR);
    const info = oldInfoOf(ks, g.ce.researched);
    const g3 = ks.group[sl(M3)];
    expect(info.best[g3]).toBe(ks.score[sl(M3)]);
    expect(ks.score[sl(M1)] * 100).toBeLessThan(
      info.best[g3] * (100 - TANK_OLD_PCT),
    );
    expect(info.old[sl(M1)]).toBe(1);
    expect(info.old[sl(M3)]).toBe(0);
  });

  it("swaps at reinforcement's pace, per need group, and conserves the equipment", async () => {
    const g = await setup(100);
    const before = total(g);
    const rPct = g.ce.stats.reinforcePct ?? 0;
    const cap = reinforceCap(Math.floor((1000 * (100 + rPct)) / 100))(50);
    expect(cap).toBeGreaterThan(0);
    dailySustain(g.land, GBR, 10);
    const eq = g.land.divisions.equipOf(g.r);
    expect(eq[sl(M3)]).toBe(cap);
    expect(eq[sl(M1)]).toBe(50 - cap);
    expect(g.ce.stock[M1]).toBe(cap);
    expect(g.ce.stock[M3]).toBe(100 - cap);
    expect(total(g)).toEqual(before);
    // A second day swaps the same again (the pace is a day's share).
    dailySustain(g.land, GBR, 11);
    expect(eq[sl(M3)]).toBe(2 * cap);
  });

  it("is skipped without supply", async () => {
    const g = await setup(100);
    g.land.divisions.supply[g.r] = 0;
    dailySustain(g.land, GBR, 10);
    expect(g.land.divisions.equipOf(g.r)[sl(M3)]).toBe(0);
    expect(g.ce.stock[M3]).toBe(100);
  });

  it("is skipped at sea", async () => {
    const g = await setup(100);
    g.land.divisions.mode[g.r] = MOVE_SEA;
    g.land.divisions.need[g.r] = 0;
    dailySustain(g.land, GBR, 10);
    expect(g.land.divisions.equipOf(g.r)[sl(M3)]).toBe(0);
  });

  it("goes on in a battle", async () => {
    const g = await setup(100);
    g.land.divisions.battle[g.r] = 1;
    dailySustain(g.land, GBR, 10);
    expect(g.land.divisions.equipOf(g.r)[sl(M3)]).toBeGreaterThan(0);
  });

  it("has no plan without old equipment or without better stock", async () => {
    const g = await setup(0);
    // Old held, nothing better in the stock: no plan.
    expect(swapPlanOf(g.land, g.ce, GBR)).toBeNull();
    dailySustain(g.land, GBR, 10);
    expect(g.land.divisions.equipOf(g.r)[sl(M1)]).toBe(50);
    // Only the best is held and in stock: nothing old is swapped (the plan
    // may name the group when old keys exist; no division changes).
    g.ce.stock[M3] = 100;
    g.ce.stock[M1] = 0;
    const eq = g.land.divisions.equipOf(g.r);
    g.land.addEquip(g.r, sl(M1), -50);
    g.land.addEquip(g.r, sl(M3), 50);
    const snap = Array.from(eq);
    dailySustain(g.land, GBR, 11);
    expect(Array.from(g.land.divisions.equipOf(g.r))).toEqual(snap);
  });

  it("never swaps a non-old key for a slightly better one", async () => {
    const g = await setup(0);
    // The division holds a medium III design that is only a little weaker than
    // the static medium III in the stock: neither is old, nothing is swapped.
    const fit = recommendedTank("medium_3", g.ce.researched, "tank");
    // A fit in the band: weaker than the static medium III, within 15 % of it.
    const ks0 = g.land.keyStatsOf(GBR);
    const target = ks0.score[sl(M3)];
    let def: DesignDef | null = null;
    for (const gun of ["gun_hv", "gun_cs", "gun_small"]) {
      for (const aL of [0, 1, 2, 3, 4]) {
        const cand = {
          ...fit,
          modules: fit.modules.map((m, i) => (i === 0 ? gun : m)),
          armorLevel: aL,
          engineLevel: 0,
          name: "Near",
        } as DesignDef;
        const st = tankStats(cand, {
          techs: g.ce.researched,
          projects: -1,
          relPp: 0,
          costPct: 0,
        });
        const row = new Int32Array(KS_FIELDS);
        row[KS.soft] = st.soft;
        row[KS.hard] = st.hard;
        row[KS.def] = st.def;
        row[KS.brk] = st.brk;
        row[KS.pierce] = st.pierce;
        row[KS.armor] = st.armor;
        row[KS.speedCenti] = st.speedCenti;
        const sc = rowScore(row, 0, st.group, st.year);
        if (def === null && sc < target && sc * 100 >= target * 85) def = cand;
      }
    }
    expect(def).not.toBeNull();
    expect(
      g.ww.depth.issue(
        GBR,
        { kind: "design_save", def: def as never },
        g.runner.game.ticks(),
      ),
    ).toBeNull();
    const ks = g.land.keyStatsOf(GBR);
    const info = oldInfoOf(ks, g.ce.researched);
    const dj = sl(equipKey("tank_design", 1));
    expect(info.old[dj]).toBe(0);
    expect(info.old[sl(M3)]).toBe(0);
    expect(ks.score[sl(M3)]).toBeGreaterThan(ks.score[dj]);
    // Division: the design's tanks; stock: the better static.
    const eq = g.land.divisions.equipOf(g.r);
    g.land.addEquip(g.r, sl(M1), -eq[sl(M1)]);
    g.land.addEquip(g.r, dj, 50);
    g.ce.stock[M1] = 0;
    g.ce.stock[M3] = 100;
    dailySustain(g.land, GBR, 10);
    expect(g.land.divisions.equipOf(g.r)[dj]).toBe(50);
    expect(g.ce.stock[M3]).toBe(100);
  });

  it("old stock still fills a gap when nothing better is left", async () => {
    const g = await game();
    g.ce.stock[M1] = 100;
    g.ce.stock[M3] = 20;
    const army = placeArmy(g.runner.game, "GBR", LONDON, 1, g.tpl);
    const r = g.land.divisions.rowOf(army.divisions[0]);
    const eq = g.land.divisions.equipOf(r);
    expect(eq[sl(M3)]).toBe(20);
    expect(eq[sl(M1)]).toBe(30);
  });

  it("snapshot and restore in the middle of the swap give the same game", async () => {
    const g = await setup(100);
    dailySustain(g.land, GBR, 10);
    const b = await wwRestore(
      g.runner,
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    expect(gameHash(b)).toBe(gameHash(g.runner));
    step(g.runner, 15 * 5);
    step(b, 15 * 5);
    expect(gameHash(b)).toBe(gameHash(g.runner));
  });
});
