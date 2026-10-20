// World War 1936 P3 (spec §10.4 economy and military groups; plan
// decisions 20, 21; controller rulings R5, R17, R18): every kind once and
// every region pick, on the test map ww1936pol (Germany: Berlin 3, a
// metropolis with 8 factories; Munich 4, a large city with 7) with the
// test content.
import {
  equipKey,
  RESOURCE_IDS,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_ARMY_XP_MAX_MILLI } from "@openfront/engine-api/ww1936/LandTypes";
import type {
  Effect,
  RegionPick,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { EFFECT_KINDS } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { RESERVE_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  GENERALS,
  titledGeneralId,
} from "@openfront/engine-lib/ww1936/Generals";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import {
  pickRegions,
  WW_RELOCATION_DAYS,
} from "@openfront/engine/ww1936/politics/EffectsEcon";
import { politicsFixture } from "./politicsFixture";
import { byTag, HUMAN, pol, POL, step, takeRegion, wwRunner } from "./util";

const STEEL = RESOURCE_IDS.indexOf("steel");

beforeEach(() =>
  usePoliticsContent(
    politicsFixture({
      spirits: [
        { id: "gen_relocating", stats: {}, icon: "factory", hidden: true },
        { id: "t_dmz", stats: {}, icon: "flag", rules: [{ dmz: "rhineland" }] },
      ],
      templates: [
        {
          id: "t_inf",
          country: "any",
          battalions: [
            "infantry",
            "infantry",
            "infantry",
            "infantry",
            "infantry",
            "infantry",
            "artillery",
          ],
          support: [],
        },
        {
          id: "t_heavy",
          country: "any",
          battalions: ["medium_armor", "medium_armor"],
          support: [],
        },
      ],
    }),
  ),
);
afterEach(() => usePoliticsContent(null));

async function game() {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }], POL);
  step(runner);
  const g = runner.game;
  const ww = g.worldWar()!;
  const p = pol(g);
  const deu = byTag(g, "DEU").smallID();
  const pl = byTag(g, "POL").smallID();
  const run = (effects: Effect[]) =>
    applyEffects(makeCtx(p, deu, deu, 0, g.ticks()), effects);
  const pick = (x: RegionPick, n?: number) => pickRegions(p, deu, x, n);
  const ce = ww.economy.country(deu)!;
  /** Free factory slots of a region (its slots with Germany's slotPct). */
  const free = (r: number) =>
    ww.economy.regionSlots(r, ce.stats.slotPct) -
    ww.economy.civ[r] -
    ww.economy.mil[r] -
    ww.economy.dock[r];
  return {
    runner,
    g,
    ww,
    p,
    econ: ww.economy,
    land: ww.land,
    deu,
    pl,
    c: p.country(deu)!,
    ce,
    run,
    pick,
    free,
  };
}

describe("region picks (spec §10.4)", () => {
  it("every pick names regions the actor controls, in its order", async () => {
    const { g, p, deu, pl, pick, free } = await game();
    expect(free(3)).toBeGreaterThan(free(4));
    expect(pick("capital")).toEqual([3]);
    expect(pick({ group: "french_border_de" })).toEqual([3, 4]);
    // Most free slots first (Berlin), then infrastructure, then id.
    expect(pick({ best: 2 })).toEqual([3, 4]);
    expect(pick({ best: 5 })).toEqual([3, 4]);
    expect(pick({ best: 1, of: "rhineland" })).toEqual([4]);
    expect(pick({ coreBest: 1 })).toEqual([3]);
    // Bordering Poland (3–6, 4–6, 4–7): the most victory points first.
    expect(pick({ borderWith: { tag: "POL" }, n: 2 })).toEqual([3, 4]);
    expect(pick({ borderWith: { tag: "SUN" }, n: 2 })).toEqual([]);
    // "threat": the neighbour with the most tension.
    p.threatBp[byTag(g, "FRA").smallID()] = 900;
    p.threatBp[pl] = 300;
    expect(pick({ borderWith: "threat", n: 1 })).toEqual([3]);
    // By resources: Munich 41, Berlin 6.
    expect(pick({ withResources: 2 })).toEqual([4, 3]);
    expect(pick({ regions: [4, 6, 4] })).toEqual([4]);
    expect(pick({ coastal: true, n: 2 })).toEqual([]);
    expect(pick({ acquired: true, n: 2 })).toEqual([]);
    // Krakow taken and made German by law: acquired, and coastal.
    takeRegion(g, 7, "DEU");
    expect(pick({ coastal: true, n: 2 })).toEqual([7]);
    expect(pick({ acquired: true, n: 2 })).toEqual([]);
    p.setLegalOwner(7, deu, true);
    expect(pick({ acquired: true, n: 2 })).toEqual([7]);
    expect(pick({ coreBest: 3 })).toContain(7);
    // Berlin lost: the capital pick falls to the most valuable region left.
    takeRegion(g, 3, "POL");
    expect(pick("capital")).toEqual([4]);
    expect(pick({ group: "french_border_de" })).toEqual([4]);
    expect(pick({ best: 3 }, 1)).toHaveLength(1);
  });
});

describe("economy and military effects", () => {
  it("the economy group, then the military group", () => {
    expect(EFFECT_KINDS.slice(20, 39)).toEqual([
      "build",
      "infra",
      "rail",
      "fort",
      "resource",
      "move_buildings",
      "manpower",
      "equipment",
      "send_equipment",
      "research_bonus",
      "add_tech",
      "research_slot",
      "reserve",
      "army_xp",
      "unlock_template",
      "add_general",
      "remove_general",
      "restore_general",
      "divisions",
    ]);
  });

  it("build: at once, region by region, the rest dropped", async () => {
    const { econ, run, free } = await game();
    const [b, m] = [free(3), free(4)];
    // Berlin full first, then one in Munich; one more than both hold dropped.
    run([{ kind: "build", where: { best: 2 }, building: "civ", count: b + 1 }]);
    expect([econ.civ[3], econ.civ[4]]).toEqual([5 + b, 4 + 1]);
    run([
      { kind: "build", where: { regions: [4] }, building: "mil", count: m + 2 },
    ]);
    expect(econ.mil[4]).toBe(3 + m - 1);
    expect(free(4)).toBe(0);
    // A dock needs the sea.
    run([{ kind: "build", where: "capital", building: "dock", count: 1 }]);
    expect(econ.dock[3]).toBe(0);
    // A level building: up to its maximum.
    run([{ kind: "build", where: "capital", building: "fort", count: 7 }]);
    expect(econ.fort[3]).toBe(5);
  });

  it("infra, rail, fort: levels up to 5, no fort in a demilitarised region", async () => {
    const { p, deu, econ, run } = await game();
    const where = { group: "french_border_de" };
    run([{ kind: "infra", where, amount: 1 }]);
    expect([econ.infra[3], econ.infra[4]]).toEqual([5, 5]);
    run([{ kind: "rail", where, amount: 4 }]);
    expect([econ.rail[3], econ.rail[4]]).toEqual([5, 5]);
    p.country(deu)!.spirits.push({ id: "t_dmz", untilDay: -1, addedDay: 0 });
    run([{ kind: "fort", where, amount: 2 }]);
    expect([econ.fort[3], econ.fort[4]]).toEqual([2, 0]);
  });

  it("resource: a lasting deposit, in the output and the snapshot", async () => {
    const { g, p, econ, ce, run } = await game();
    econ.refreshTotals(ce, p.day(), g.ticks());
    const before = ce.totals.produced[STEEL];
    run([
      { kind: "resource", where: { regions: [4] }, res: "steel", amount: 5 },
    ]);
    expect(econ.deposit(4, STEEL)).toBe(45);
    econ.refreshTotals(ce, p.day(), g.ticks());
    expect(ce.totals.produced[STEEL]).toBeGreaterThan(before);
    // Rubber where there was none; never below none.
    run([{ kind: "resource", where: "capital", res: "rubber", amount: 3 }]);
    expect(econ.deposit(3, RESOURCE_IDS.indexOf("rubber"))).toBe(3);
    run([{ kind: "resource", where: "capital", res: "rubber", amount: -9 }]);
    expect(econ.deposit(3, RESOURCE_IDS.indexOf("rubber"))).toBe(0);
    const s = econ.snapshot();
    expect(s.resBonus).toBeDefined();
    econ.resBonus.fill(0);
    econ.restoreState(s);
    expect(econ.deposit(4, STEEL)).toBe(45);
  });

  it("move_buildings: what fits moves, and the factories relocate for 60 days", async () => {
    const { p, econ, c, run, free } = await game();
    // Berlin keeps one free slot.
    run([
      { kind: "build", where: "capital", building: "civ", count: free(3) - 1 },
    ]);
    expect(free(3)).toBe(1);
    run([
      {
        kind: "move_buildings",
        from: { regions: [4] },
        to: { regions: [3] },
        building: "mil",
        count: 3,
      },
    ]);
    expect([econ.mil[3], econ.mil[4]]).toEqual([4, 2]);
    expect(c.spirits).toContainEqual({
      id: "gen_relocating",
      untilDay: p.day() + WW_RELOCATION_DAYS,
      addedDay: p.day(),
    });
    // Nowhere to go: nothing moves.
    c.spirits = [];
    run([
      {
        kind: "move_buildings",
        from: { regions: [4] },
        to: { regions: [3] },
        building: "mil",
        count: 1,
      },
    ]);
    expect([econ.mil[3], econ.mil[4]]).toEqual([4, 2]);
    expect(c.spirits).toEqual([]);
  });

  it("manpower, equipment, send_equipment", async () => {
    const { econ, pl, ce, run } = await game();
    const men = ce.manpower;
    run([{ kind: "manpower", amount: 1000, recruitablePct: 10 }]);
    expect(ce.manpower).toBe(
      men + 1000 + Math.floor(ce.totals.recruitable / 10),
    );
    const g1 = equipKey("infantry_equipment", 1);
    const g2 = equipKey("infantry_equipment", 2);
    const have2 = ce.stock[g2];
    run([
      { kind: "equipment", type: "infantry_equipment", gen: 2, count: 500 },
      // Support equipment has two generations: skipped.
      { kind: "equipment", type: "support_equipment", gen: 3, count: 500 },
    ]);
    expect(ce.stock[g2]).toBe(have2 + 500);
    const pe = econ.country(pl)!;
    const [mine1, mine2, their1, their2] = [
      ce.stock[g1],
      ce.stock[g2],
      pe.stock[g1],
      pe.stock[g2],
    ];
    // The oldest generation first, as far as the stock goes.
    run([
      {
        kind: "send_equipment",
        to: { tag: "POL" },
        type: "infantry_equipment",
        count: mine1 + 100,
      },
    ]);
    expect([ce.stock[g1], ce.stock[g2]]).toEqual([0, mine2 - 100]);
    expect([pe.stock[g1], pe.stock[g2]]).toEqual([
      their1 + mine1,
      their2 + 100,
    ]);
  });

  it("research_bonus (5 at most), add_tech, research_slot (0..2, R5), reserve", async () => {
    const { g, p, econ, c, ce, run } = await game();
    for (let i = 1; i <= 6; i++) {
      run([{ kind: "research_bonus", branch: "infantry", pct: i, uses: 1 }]);
    }
    expect(c.researchBonuses.map((b) => b.pct)).toEqual([2, 3, 4, 5, 6]);
    run([{ kind: "research_bonus", tech: "inf_eq_2", pct: 50, uses: 2 }]);
    expect(c.researchBonuses[4]).toEqual({ key: "inf_eq_2", pct: 50, uses: 2 });
    // add_tech: researched at once; a slot working on it is free again.
    const slot = ce.slots.findIndex((s) => s !== null);
    const tech = ce.slots[slot]!.tech;
    run([{ kind: "add_tech", tech }]);
    expect(ce.researched.has(tech)).toBe(true);
    expect(ce.slots[slot]).toBeNull();
    // research_slot: at most two more, six in all.
    econ.refreshTotals(ce, p.day(), g.ticks());
    const base = ce.totals.slotCount;
    for (let i = 0; i < 3; i++) run([{ kind: "research_slot", amount: 1 }]);
    expect(c.extraResearchSlots).toBe(2);
    econ.refreshTotals(ce, p.day(), g.ticks());
    expect(ce.totals.slotCount).toBe(Math.min(6, base + 2));
    run([{ kind: "research_slot", amount: -1 }]);
    expect(c.extraResearchSlots).toBe(1);
    run([
      { kind: "reserve", key: "radar", amount: 3 },
      { kind: "reserve", key: "radar", amount: 4 },
    ]);
    expect(c.reserved[RESERVE_KEYS.indexOf("radar")]).toBe(7);
  });

  it("army_xp within P2's cap", async () => {
    const { land, deu, run } = await game();
    const cl = land.country(deu)!;
    const xp = cl.armyXpMilli;
    run([{ kind: "army_xp", amount: 10 }]);
    expect(cl.armyXpMilli).toBe(xp + 10_000);
    run([{ kind: "army_xp", amount: 1000 }]);
    expect(cl.armyXpMilli).toBe(WW_ARMY_XP_MAX_MILLI);
    run([{ kind: "army_xp", amount: -1000 }]);
    expect(cl.armyXpMilli).toBe(0);
  });

  it("unlock_template: P2's checks, its key as the name, no army experience (R17)", async () => {
    const { land, deu, ce, run } = await game();
    const cl = land.country(deu)!;
    cl.armyXpMilli = 0;
    const n = cl.templates.length;
    run([{ kind: "unlock_template", template: "t_inf" }]);
    expect(cl.templates).toHaveLength(n + 1);
    const t = cl.templates[n];
    expect(t.key).toBe("t_inf");
    expect(t.def.name).toBe("");
    expect(t.def.battalions).toHaveLength(7);
    // Once.
    run([{ kind: "unlock_template", template: "t_inf" }]);
    expect(cl.templates).toHaveLength(n + 1);
    // A battalion without its tech: refused.
    if (!ce.researched.has("medium_tank_1")) {
      run([{ kind: "unlock_template", template: "t_heavy" }]);
      expect(cl.templates).toHaveLength(n + 1);
    }
    // Twelve at most.
    while (cl.templates.length < 12) {
      cl.templates.push({ ...t, id: cl.nextTemplateId++, key: "" });
    }
    ce.addTech("medium_tank_1");
    run([{ kind: "unlock_template", template: "t_heavy" }]);
    expect(cl.templates).toHaveLength(12);
    expect(cl.armyXpMilli).toBe(0);
  });

  it("add_general, remove_general, restore_general", async () => {
    const { p, land, deu, run } = await game();
    const cl = land.country(deu)!;
    cl.armyXpMilli = 0;
    const n = cl.generals.length;
    const no = cl.nextTitleNo;
    // A titled general for nothing (R17: no army experience).
    run([{ kind: "add_general" }]);
    expect(cl.generals).toHaveLength(n + 1);
    expect(cl.generals[n]).toMatchObject({
      id: titledGeneralId(deu, no),
      roster: -1,
      army: 0,
    });
    expect(cl.armyXpMilli).toBe(0);
    // A named one leaves the army it leads and serves nowhere.
    const roster = GENERALS.findIndex((x) => x.id === "rundstedt");
    const led = cl.generals.find((x) => x.roster === roster)!;
    const army = land.armiesOf(deu).find((a) => a.general === led.id);
    run([{ kind: "remove_general", general: "rundstedt" }]);
    expect(p.removedGenerals.has("rundstedt")).toBe(true);
    expect(led.army).toBe(0);
    if (army !== undefined) expect(army.general).toBe(0);
    run([{ kind: "restore_general", general: "rundstedt" }]);
    expect(p.removedGenerals.has("rundstedt")).toBe(false);
    run([{ kind: "remove_general", general: "rundstedt" }]);
    run([{ kind: "add_general", general: "rundstedt" }]);
    expect(p.removedGenerals.has("rundstedt")).toBe(false);
  });

  it("divisions: a new army, men and equipment from the pool as far as they go", async () => {
    const { land, deu, ce, run } = await game();
    const before = land.armiesOf(deu).length;
    run([{ kind: "divisions", template: "t_inf", count: 2, where: "capital" }]);
    const armies = land.armiesOf(deu);
    expect(armies).toHaveLength(before + 1);
    const a = armies[armies.length - 1];
    expect(a.divisions).toHaveLength(2);
    const rows = a.divisions.map((d) => land.divisions.rowOf(d));
    expect(rows.map((r) => land.divisions.region[r])).toEqual([3, 3]);
    const men = land.divisions.men[rows[0]];
    expect(men).toBe(6500);
    // Short of men: a thin division, then none.
    ce.manpower = men + 10;
    run([{ kind: "divisions", template: "t_inf", count: 3, where: "capital" }]);
    const all = land.armiesOf(deu);
    const b = all[all.length - 1];
    expect(b.divisions).toHaveLength(2);
    expect(
      b.divisions.map((d) => land.divisions.men[land.divisions.rowOf(d)]),
    ).toEqual([men, 10]);
    expect(ce.manpower).toBe(0);
    // No men at all: no army.
    const k = land.armiesOf(deu).length;
    run([{ kind: "divisions", template: "t_inf", count: 1, where: "capital" }]);
    expect(land.armiesOf(deu)).toHaveLength(k);
  });
});
