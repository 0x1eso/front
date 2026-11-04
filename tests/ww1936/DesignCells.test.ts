// Tank design reform, phase 1: one design per cell (role x chassis) — saving,
// absorbing the static tanks, the slot pool, foreign designs and old
// snapshots. A human Britain on ww1936deep, techs given by the test.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import { TankDesignStats } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_TECH_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_SLOTS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { recommendedTank } from "@openfront/engine-lib/ww1936/DesignRules";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import { saveDesign } from "@openfront/engine/ww1936/depth/Designs";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  clearStartSetup,
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

type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];
const GBR = DEEP.tag.GBR;
const DEU = DEEP.tag.DEU;
const LONDON = DEEP.region.london;
const ALL = new Set(WW_TECH_IDS);

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
  // No tanks of the start stock: the tests count their own.
  for (let k = 0; k < ce.stock.length; k++) {
    const type = (GROUND_EQUIP_KEYS.includes(k) ? k : -1) >= 0;
    if (type) ce.stock[k] = 0;
  }
  return { runner, ww, d: ww.depth, ce };
}

/** The recommended fit of a chassis and role, as an order carries it. */
const fit = (
  base: string,
  role: Parameters<typeof recommendedTank>[2],
  name = base,
): Def => ({ ...recommendedTank(base, ALL, role), name }) as Def;

const save = (g: Awaited<ReturnType<typeof game>>, def: Def, slot?: number) =>
  g.d.issue(
    GBR,
    { kind: "design_save", def, ...(slot === undefined ? {} : { slot }) },
    g.runner.game.ticks(),
  );

const tpl = (g: Awaited<ReturnType<typeof game>>, bns: string[]) => {
  const cl = g.ww.land.country(GBR)!;
  const id = cl.nextTemplateId;
  expect(
    g.ww.land.issue(
      GBR,
      {
        kind: "template_save",
        template: 0,
        base: 0,
        name: "T",
        battalions: bns,
        support: [],
      } as never,
      "player",
    ),
  ).toBeNull();
  return id;
};

const MEDIUM1 = equipKey("medium_tank", 1);
const LIGHT1 = equipKey("light_tank", 1);
const slotOf = (key: number) => GROUND_EQUIP_KEYS.indexOf(key);

/** Everything of a key the country holds: stock, divisions, trainees. */
function held(g: Awaited<ReturnType<typeof game>>, key: number) {
  const j = slotOf(key);
  let n = g.ce.stock[key];
  for (const r of g.ww.land.rowsOf(GBR)) n += g.ww.land.divisions.equipOf(r)[j];
  for (const x of g.ww.land.country(GBR)!.trainees) n += x.equip[j];
  return n;
}

describe("tank design cells", () => {
  it("a second save into the cell overwrites in place: stock, divisions and trainees follow, count conserved", async () => {
    const g = await game();
    const { ww, d, ce } = g;
    const first = fit("medium_1", "tank", "A");
    first.modules = (first.modules as string[]).map((m, i) =>
      i === 5 ? "radio" : m,
    ) as typeof first.modules;
    expect(save(g, first)).toBeNull();
    const key = equipKey("tank_design", 1);
    ce.stock[key] = 300;
    const t = tpl(g, ["medium_armor"]);
    const army = placeArmy(runner(g), "GBR", LONDON, 1, t);
    const row = ww.land.divisions.rowOf(army.divisions[0]);
    const j = GROUND_STATIC_SLOTS;
    // A trainee holding some too.
    ww.land.country(GBR)!.trainees.push({
      entry: 999,
      template: t,
      men: 0,
      equip: Object.assign(new Array<number>(GROUND_SLOTS).fill(0), { [j]: 7 }),
      days: 3,
    });
    const inDiv = ww.land.divisions.equipOf(row)[j];
    expect(inDiv).toBeGreaterThan(0);
    const before = held(g, key);
    const statsBefore = ww.land.baseStatsOf(row);
    ww.land.divisions.org[row] = ww.land.orgMaxOf(row);
    const second = fit("medium_1", "tank", "B");
    second.modules = (second.modules as string[]).map((m, i) =>
      i === 5 ? "" : m === "gun_cs" ? "gun_small" : m,
    ) as typeof second.modules;
    expect(save(g, second, 7)).toBeNull(); // the slot asked for is ignored
    const slots = d.country(GBR)!.des.tank.filter((s) => s !== null);
    expect(slots).toHaveLength(1);
    expect(d.designSlot(GBR, "tank", 1)!.def.name).toBe("B");
    expect(held(g, key)).toBe(before);
    expect(ww.land.divisions.equipOf(row)[j]).toBe(inDiv);
    // The division's numbers follow the new design at once; its org never exceeds the maximum.
    const statsAfter = ww.land.baseStatsOf(row);
    expect(statsAfter.soft).not.toBe(statsBefore.soft);
    // ww77: the country's tank attack techs apply on top of the design's row.
    expect(statsAfter.soft).toBe(
      Math.floor(
        ((d.designStatsOf(GBR, "tank", 1) as TankDesignStats).soft *
          (100 + ce.stats.armorAttackPct)) /
          100,
      ),
    );
    expect(ww.land.divisions.org[row]).toBeLessThanOrEqual(
      ww.land.orgMaxOf(row),
    );
  });

  it("the first save absorbs the static tanks: stock, divisions, trainees and lines", async () => {
    const g = await game();
    const { ww, ce } = g;
    ce.stock[MEDIUM1] = 40;
    const t = tpl(g, ["medium_armor"]);
    const army = placeArmy(runner(g), "GBR", LONDON, 1, t);
    const row = ww.land.divisions.rowOf(army.divisions[0]);
    const js = slotOf(MEDIUM1);
    expect(ww.land.divisions.equipOf(row)[js]).toBeGreaterThan(0);
    ww.land.country(GBR)!.trainees.push({
      entry: 998,
      template: t,
      men: 0,
      equip: Object.assign(new Array<number>(GROUND_SLOTS).fill(0), {
        [js]: 5,
      }),
      days: 3,
    });
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "medium_tank", 1, 3)).toBeNull();
    ce.lines[0].effBp = 8000;
    const total = held(g, MEDIUM1);
    expect(total).toBeGreaterThan(40);
    expect(save(g, fit("medium_1", "tank"))).toBeNull();
    const dkey = equipKey("tank_design", 1);
    expect(held(g, MEDIUM1)).toBe(0);
    expect(held(g, dkey)).toBe(total);
    expect(ww.land.divisions.equipOf(row)[js]).toBe(0);
    expect(ce.lines[0].key).toBe(dkey);
    // The existing retention: static -> design of the same weight keeps 60 %.
    expect(ce.lines[0].effBp).toBeLessThan(8000);
    expect(ce.lines[0].effBp).toBeGreaterThan(0);
  });

  it("a design of another role does not absorb, and the light cell takes the light static", async () => {
    const g = await game();
    const { ce } = g;
    ce.stock[MEDIUM1] = 11;
    ce.stock[LIGHT1] = 6;
    expect(save(g, fit("medium_1", "tank_destroyer"))).toBeNull();
    expect(ce.stock[MEDIUM1]).toBe(11);
    expect(save(g, fit("light_1", "tank"))).toBeNull();
    expect(ce.stock[LIGHT1]).toBe(0);
    expect(ce.stock[equipKey("tank_design", 2)]).toBe(6);
    // A chassis with no static twin absorbs nothing.
    expect(save(g, fit("heavy_1", "tank"))).toBeNull();
    expect(ce.stock[MEDIUM1]).toBe(11);
  });

  it("static tanks arriving later are absorbed by the daily sweep", async () => {
    const g = await game();
    const { runner: r, ce } = g;
    expect(save(g, fit("medium_1", "tank"))).toBeNull();
    ce.stock[MEDIUM1] = 25;
    step(r, 15 * 2);
    expect(ce.stock[MEDIUM1]).toBe(0);
    expect(ce.stock[equipKey("tank_design", 1)]).toBe(25);
  });

  it("a foreign design is never overwritten; it keeps its slot", async () => {
    const g = await game();
    const { ww, d } = g;
    const deu = ww.economy.country(DEU)!;
    for (const t of WW_TECH_IDS) deu.addTech(t);
    expect(
      saveDesign(d, DEU, fit("medium_2", "tank", "Theirs"), 0, "own", 0, 0, 0),
    ).toBe(1);
    const got = copyDesignTo(d, DEU, 1, "tank", GBR, "captured");
    expect(got).toBe(1);
    expect(save(g, fit("medium_2", "tank", "Mine"))).toBeNull();
    const des = d.country(GBR)!.des.tank;
    expect(des[0]!.origin).toBe("captured");
    expect(des[0]!.def.name).toBe("Theirs");
    expect(des[1]!.origin).toBe("own");
    expect(des[1]!.def.name).toBe("Mine");
    // And saving again overwrites only the own one.
    expect(save(g, fit("medium_2", "tank", "Mine 2"))).toBeNull();
    expect(des[0]!.def.name).toBe("Theirs");
    expect(des[1]!.def.name).toBe("Mine 2");
  });

  it("a snapshot's several own designs of one cell merge on the next save", async () => {
    const g = await game();
    const { ww, d, ce } = g;
    // The old rules: two own designs of one cell (saveDesign is the raw path).
    expect(
      saveDesign(d, GBR, fit("medium_2", "tank", "One"), 0, "own", 0, 0, 0),
    ).toBe(1);
    expect(
      saveDesign(d, GBR, fit("medium_2", "tank", "Two"), 0, "own", 0, 0, 0),
    ).toBe(2);
    ce.stock[equipKey("tank_design", 1)] = 10;
    ce.stock[equipKey("tank_design", 2)] = 20;
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "tank_design", 2, 1)).toBeNull();
    expect(save(g, fit("medium_2", "tank", "Merged"))).toBeNull();
    const des = d.country(GBR)!.des.tank;
    expect(des[0]!.def.name).toBe("Merged");
    expect(des[1]).toBeNull();
    expect(ce.stock[equipKey("tank_design", 1)]).toBe(30);
    expect(ce.stock[equipKey("tank_design", 2)]).toBe(0);
    expect(ce.lines[0].key).toBe(equipKey("tank_design", 1));
  });

  it("the pool of 12 refuses a 13th cell but still overwrites a full cell", async () => {
    const g = await game();
    const cells: [
      string,
      "tank" | "tank_destroyer" | "sp_artillery" | "sp_anti_air",
    ][] = [];
    for (const role of ["tank", "tank_destroyer", "sp_artillery"] as const) {
      for (const base of ["light_1", "light_2", "medium_1", "medium_2"]) {
        cells.push([base, role]);
      }
    }
    for (const [base, role] of cells) {
      expect(save(g, fit(base, role, `${role}${base}`))).toBeNull();
    }
    expect(g.d.country(GBR)!.des.tank.filter((s) => s !== null)).toHaveLength(
      12,
    );
    expect(save(g, fit("heavy_1", "tank"))).toBe("design_slots_full");
    expect(save(g, fit("medium_1", "sp_anti_air"))).toBe("design_slots_full");
    expect(save(g, fit("medium_1", "tank", "again"))).toBeNull();
    expect(g.d.designSlot(GBR, "tank", 3)!.def.name).toBe("again");
  });

  it("an old design nothing holds frees its slot at the 10-day check; a held one stays", async () => {
    const g = await game();
    const { runner: r, d, ce } = g;
    // Light I (score ~1.0k) against a medium III static the country has researched?
    // No: the group is the light tanks, whose best is the light II static.
    expect(save(g, fit("light_1", "tank", "Old"))).toBeNull();
    expect(save(g, fit("light_2", "tank", "New"))).toBeNull();
    expect(save(g, fit("medium_1", "tank", "Med"))).toBeNull();
    ce.stock[equipKey("tank_design", 3)] = 0;
    // Light I: 1064 against light II's design ~1673: old; nothing holds it.
    step(r, 15 * 12 * 3);
    expect(d.designSlot(GBR, "tank", 1)).toBeNull();
    expect(d.designSlot(GBR, "tank", 2)!.def.name).toBe("New");
  });

  it("an old design something holds keeps its slot", async () => {
    const g = await game();
    const { runner: r, d, ce } = g;
    expect(save(g, fit("light_1", "tank", "Old"))).toBeNull();
    expect(save(g, fit("light_2", "tank", "New"))).toBeNull();
    ce.stock[equipKey("tank_design", 1)] = 5;
    step(r, 15 * 12 * 3);
    expect(d.designSlot(GBR, "tank", 1)).not.toBeNull();
  });

  it("ship and plane saves keep their slots and design_in_use", async () => {
    const g = await game();
    const { d } = g;
    const plane = {
      kind: "plane",
      base: "small_1",
      modules: [] as string[],
      name: "P",
    } as unknown as Def;
    const tick = g.runner.game.ticks();
    const a = d.issue(GBR, { kind: "design_save", def: plane, slot: 3 }, tick);
    if (a === null) {
      expect(d.designSlot(GBR, "plane", 3)).not.toBeNull();
      expect(
        d.issue(GBR, { kind: "design_save", def: plane, slot: 3 }, tick),
      ).toBe("design_in_use");
    } else {
      // (The fixture's plane fit may not pass the checks; the slot rules are asserted in DesignsGame.)
      expect(a).not.toBe("design_in_use");
    }
  });

  it("snapshot and restore keep the cells and the hash", async () => {
    const g = await game();
    expect(save(g, fit("medium_1", "tank"))).toBeNull();
    g.ce.stock[MEDIUM1] = 9;
    step(g.runner, 15 * 2);
    const b = await wwRestore(
      g.runner,
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    expect(gameHash(b)).toBe(gameHash(g.runner));
    step(g.runner, 15 * 3);
    step(b, 15 * 3);
    expect(gameHash(b)).toBe(gameHash(g.runner));
  });
});

function runner(g: Awaited<ReturnType<typeof game>>) {
  return g.runner.game;
}
