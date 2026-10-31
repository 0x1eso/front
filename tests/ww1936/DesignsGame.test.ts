// World War 1936 P6 lane E (plan Task 3 Step 8, spec §5): designs in a
// real game — a human Britain on ww1936deep, the techs and experience
// given by the test (plan decision 30).
import type { DepthOrder, WwOrder } from "@openfront/engine-api/Schemas";
import {
  PLANE_BASES,
  PlaneDesignStats,
  TankDesignStats,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
  TPL_TD_DEFEND,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  SHIP_CLASSES,
  SHIP_GENS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  convertCost,
  designBlock,
  planeStats as designPlaneStats,
  designXpCost,
  licenceCostPct,
  planeType,
  recommendedPlane,
  recommendedShip,
  reliabilityLossBp,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { lineUnitCost } from "@openfront/engine-lib/ww1936/ShipStats";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import {
  conversionCostMilli,
  designPlaneAsP4,
  designPlaneLossBp,
  designPlaneP4,
  drawDesignPlanes,
  equipCostMilli,
  equipResources,
  lineRetentionBp,
  loseDesignPlanes,
  navalLineCostMilli,
  navalLineDesignBlock,
  planeDesignSlotsOf,
  planesLossBp,
  planeStatsOfKey,
  returnDesignPlanes,
  saveDesign,
  shipLicenceCostPct,
} from "@openfront/engine/ww1936/depth/Designs";
import {
  designCtxOf,
  designDefHash,
} from "@openfront/engine/ww1936/depth/WwDepth";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import {
  designLossMilli,
  modInputOf,
} from "@openfront/engine/ww1936/land/Battles";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  clearStartSetup,
  gameHash,
  grantDoctrineStats,
  HUMAN,
  placeArmy,
  step,
  stepTo,
  wwRestore,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

/** A design as the order carries it (the wire's zod type). */
type Def = Extract<DepthOrder, { kind: "design_save" }>["def"];

const GBR = DEEP.tag.GBR;
const DEU = DEEP.tag.DEU;
const LONDON = DEEP.region.london;

/** A heavy I tank: the support gun, a three-man turret, a radio. */
const HEAVY: Def = {
  kind: "tank",
  base: "heavy_1",
  modules: ["gun_cs", "turret_3", "bogie", "welded", "petrol", "radio", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Heavy",
};
const MED1: Def = {
  kind: "tank",
  base: "medium_1",
  modules: ["gun_cs", "turret_2", "bogie", "welded", "petrol", "", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Med I",
};
const MED2: Def = { ...MED1, base: "medium_2", name: "Med II" };
/** A medium II tank destroyer (the small gun, no turret). */
const TD: Def = {
  kind: "tank",
  base: "medium_2",
  modules: ["gun_small", "turret_none", "bogie", "welded", "petrol", "", ""],
  armorLevel: 0,
  engineLevel: 0,
  name: "Jager",
};

/** A game past the preparation minute (the depth days run from there). */
async function game(
  humans: { clientID: string; country: "GBR" | "DEU" }[] = [
    { clientID: HUMAN, country: "GBR" },
  ],
) {
  const runner = await wwRunner({}, humans, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  return { runner, ww, d: ww.depth };
}

/** The test's techs and plenty of every experience. */
function prepare(ww: WorldWar, id: number, techs: WwTechId[]): void {
  const ce = ww.economy.country(id)!;
  for (const t of techs) ce.addTech(t);
  ww.land.country(id)!.armyXpMilli = 900_000;
  ww.navy.country(id)!.navyXpMilli = 400_000;
  ww.air.country(id)!.airXpMilli = 400_000;
}

const TANK_TECHS: WwTechId[] = [
  "medium_tank_1",
  "medium_tank_2",
  "heavy_tank_1",
  "tank_radio",
  "anti_tank_1",
];

/** A new template of `battalions` (P2's order); its id. */
function template(ww: WorldWar, id: number, battalions: string[]): number {
  const cl = ww.land.country(id)!;
  const before = cl.nextTemplateId;
  const block = ww.land.issue(
    id,
    {
      kind: "template_save",
      template: 0,
      base: 0,
      name: "Test",
      battalions,
      support: [],
    } as WwOrder,
    "player",
  );
  expect(block).toBeNull();
  return before;
}

/** Units of an EQUIP_KEYS index the country holds: stock, divisions, trainees (spec Review Focus 1). */
function held(ww: WorldWar, id: number, key: number): number {
  const ce = ww.economy.country(id)!;
  const land = ww.land;
  const j = GROUND_EQUIP_KEYS.indexOf(key);
  let n = ce.stock[key];
  if (j < 0) return n;
  for (const r of land.rowsOf(id)) n += land.divisions.equipOf(r)[j];
  for (const x of land.country(id)!.trainees) n += x.equip[j];
  for (const x of ww.endgame.inTransit) {
    if (x.from === id && equipKey(x.item as never, x.gen) === key) {
      n += Math.floor(x.countMilli / 1000);
    }
  }
  return n;
}

describe("World War 1936 P6: designs in the game", () => {
  it("a saved tank design is produced, trained into a heavy armor battalion and fights with its stats", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const xp0 = d.xpOf(GBR, 0);
    const shown = vi.spyOn(runner.game, "displayMessage");
    expect(
      d.issue(GBR, { kind: "design_save", def: HEAVY }, runner.game.ticks()),
    ).toBeNull();
    // The notice's final key (P3 message adds "events_display.") and its arg.
    const notes = shown.mock.calls.filter((c) =>
      String(c[0]).includes("ww1936_design_saved"),
    );
    expect(notes.map((c) => [c[0], c[4]])).toEqual([
      ["events_display.ww1936_design_saved", { name: "Heavy" }],
    ]);
    shown.mockRestore();
    expect(d.xpOf(GBR, 0)).toBe(xp0 - designXpCost(null, HEAVY));
    const slot = d.designSlot(GBR, "tank", 1)!;
    expect(slot.origin).toBe("own");
    expect(slot.def.name).toBe("Heavy");
    const ds = d.designStatsOf(GBR, "tank", 1) as TankDesignStats;
    expect(ds.role).toBe("tank");
    const key = equipKey("tank_design", 1);
    // The line builds it at the design's cost and resources.
    const ce = ww.economy.country(GBR)!;
    expect(equipCostMilli(d, GBR, key)).toBe(ds.costMilli);
    expect(equipResources(d, GBR, key)).toEqual(ds.resources);
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "tank_design", 1, 2)).toBeNull();
    step(runner, 90 * 15);
    expect(ce.stock[key]).toBeGreaterThan(0);
    // Topped up for a division (the test does not wait for 80 tanks), and
    // a tank destroyer design beside it (review E9a: train, then fight).
    ce.stock[key] += 100;
    expect(
      d.issue(GBR, { kind: "design_save", def: TD }, runner.game.ticks()),
    ).toBeNull();
    const td = d.designStatsOf(GBR, "tank", 2) as TankDesignStats;
    expect(td.role).toBe("tank_destroyer");
    ce.stock[equipKey("tank_design", 2)] = 100;
    const tpl = template(ww, GBR, ["heavy_armor", "tank_destroyer"]);
    const land = ww.land;
    expect(
      land.issue(
        GBR,
        { kind: "train", template: tpl, count: 1, army: 0, region: 0 },
        "player",
      ),
    ).toBeNull();
    const cl = land.country(GBR)!;
    const entry = cl.training[cl.training.length - 1].id;
    step(runner, 12 * 15);
    const trainee = cl.trainees.find((x) => x.entry === entry)!;
    expect(trainee.equip[GROUND_STATIC_SLOTS]).toBeGreaterThan(0);
    expect(land.issue(GBR, { kind: "deploy_now", entry }, "player")).toBeNull();
    const r = land.rowsOf(GBR).find((x) => land.divisions.template[x] === tpl)!;
    const j = GROUND_STATIC_SLOTS; // design slot 1
    const eq = land.divisions.equipOf(r);
    expect(eq[j]).toBeGreaterThan(0);
    expect(eq[j + 1]).toBeGreaterThan(0);
    // The battalion numbers are the designs' (spec §5.2.6).
    const s = land.baseStatsOf(r);
    expect(s.soft).toBe(ds.soft + td.soft);
    expect(s.hard).toBe(ds.hard + td.hard);
    expect(s.brk).toBe(ds.brk + td.brk);
    expect(s.speedCenti).toBe(Math.min(ds.speedCenti, td.speedCenti));
    // Radio: +2 organisation over the heavy battalion's 10.
    expect(s.orgMilli).toBe(11_000);
    // It fights with them: the tank destroyer's +10% when defending.
    expect(s.designFlags & TPL_TD_DEFEND).not.toBe(0);
    const here = land.divisions.region[r];
    const defend = modInputOf(land, r, here, false);
    expect(defend.designFlags).toBe(s.designFlags);
    expect(
      divisionMods(defend).defenseLines.some((l) => l.id === "tank_destroyer"),
    ).toBe(true);
    expect(
      divisionMods(modInputOf(land, r, here, true)).defenseLines.some(
        (l) => l.id === "tank_destroyer",
      ),
    ).toBe(false);
    // Losses follow the design's reliability (spec §5.2.2).
    const ks = land.keyStatsOf(GBR);
    expect(designLossMilli(ks, j, 10_000)).toBe(
      Math.floor((10_000 * reliabilityLossBp(ds.relPm)) / 10_000),
    );
  });

  it("designs draw newest first and equipment is conserved across design keys", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    expect(d.issue(GBR, { kind: "design_save", def: MED2 }, tick)).toBeNull();
    const kA = equipKey("tank_design", 1);
    const kB = equipKey("tank_design", 2);
    const ce = ww.economy.country(GBR)!;
    ce.stock[kA] = 500;
    ce.stock[kB] = 30;
    const tpl = template(ww, GBR, ["medium_armor"]);
    const army = placeArmy(runner.game, "GBR", LONDON, 1, tpl);
    const eq = ww.land.divisions.equipOf(
      ww.land.divisions.rowOf(army.divisions[0]),
    );
    // Spec §5.2.4: the 1941 chassis first, then the 1939 one.
    expect(eq[GROUND_STATIC_SLOTS + 1]).toBe(30);
    expect(eq[GROUND_STATIC_SLOTS]).toBe(20);
    // A trainee and a converting line besides.
    expect(
      ww.land.issue(
        GBR,
        { kind: "train", template: tpl, count: 1, army: 0, region: 0 },
        "player",
      ),
    ).toBeNull();
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "tank_design", 2, 2)).toBeNull();
    const line = ce.lines[0];
    expect(
      d.issue(GBR, { kind: "line_convert", line: line.id, from: kA }, tick),
    ).toBeNull();
    const keys = EQUIP_KEYS.flatMap(([t], k) =>
      t === "tank_design" || t === "medium_tank" || t === "light_tank"
        ? [k]
        : [],
    );
    const before = keys.map((k) => held(ww, GBR, k));
    let converted = 0;
    for (let i = 0; i < 1000; i++) {
      const b0 = held(ww, GBR, kB);
      step(runner, 1);
      converted += held(ww, GBR, kB) - b0;
      const now = keys.map((k) => held(ww, GBR, k));
      // Only the conversion moves units, from A to B, one for one.
      keys.forEach((k, x) => {
        const want =
          k === kA
            ? before[x] - converted
            : k === kB
              ? before[x] + converted
              : before[x];
        expect(now[x], `${EQUIP_KEYS[k].join("")} at ${i}`).toBe(want);
      });
    }
    expect(converted).toBeGreaterThan(0);
  });

  it("obsolete design slot frees when nothing holds it", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    const key = equipKey("tank_design", 1);
    const ce = ww.economy.country(GBR)!;
    ce.stock[key] = 5;
    expect(
      d.issue(GBR, { kind: "design_obsolete", design: "tank", slot: 1 }, tick),
    ).toBeNull();
    expect(d.designSlot(GBR, "tank", 1)!.obsolete).toBe(true);
    // An obsolete design takes no new line (spec §5.1).
    expect(addLine(ww.economy, ce, "tank_design", 1, 1)).toBe("bad_line");
    step(runner, 8 * 15);
    expect(d.designSlot(GBR, "tank", 1)).not.toBeNull();
    ce.stock[key] = 0;
    step(runner, 8 * 15);
    expect(d.designSlot(GBR, "tank", 1)).toBeNull();
    expect(ww.land.keyStatsOf(GBR).group[GROUND_STATIC_SLOTS]).toBe(-1);
  });

  // Batch P6-4 (lane E review minor 8): a desync in a design, a ship's
  // design or refit, or a line's conversion shows in the hash the same tick.
  it("the design state moves the hashes", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    const depth = () => d.hash();
    const h0 = depth();
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    const h1 = depth();
    expect(h1).not.toBe(h0);
    expect(
      d.issue(
        GBR,
        { kind: "design_rename", design: "tank", slot: 1, name: "Other" },
        tick,
      ),
    ).toBeNull();
    const h2 = depth();
    expect(h2).not.toBe(h1);
    expect(
      d.issue(GBR, { kind: "design_obsolete", design: "tank", slot: 1 }, tick),
    ).toBeNull();
    expect(depth()).not.toBe(h2);
    // The fit, the origin and the day each count.
    const slot = d.designSlot(GBR, "tank", 1)!;
    const h3 = depth();
    slot.savedDay++;
    expect(depth()).not.toBe(h3);
    slot.origin = "received";
    const h4 = depth();
    expect(h4).not.toBe(h3);
    expect(designDefHash({ ...MED1, modules: [...MED1.modules] })).toBe(
      designDefHash(MED1),
    );
    expect(designDefHash({ ...MED1, armorLevel: 1 })).not.toBe(
      designDefHash(MED1),
    );
    // A ship's design and its refit (WwNavy.hash).
    const t = ww.navy.ships;
    const fid = ww.navy.createFleet(GBR, LONDON, [["dd", 2, 1]]);
    const r = t.rowOf(ww.navy.fleets.get(fid)!.ships[0]);
    expect(r).toBeGreaterThanOrEqual(0);
    const n0 = ww.navy.hash();
    t.design[r] = 1;
    const n1 = ww.navy.hash();
    expect(n1).not.toBe(n0);
    t.refitTo[r] = 2;
    t.refitLeft[r] = 9;
    expect(ww.navy.hash()).not.toBe(n1);
    // A line's conversion source (WwEconomy.hash).
    const ce = ww.economy.country(GBR)!;
    const l = ce.lines[0];
    const e0 = ww.economy.hash();
    l.convertFrom = equipKey("light_tank", 1);
    expect(ww.economy.hash()).not.toBe(e0);
  });

  // Batch P6-4 (lane E review minor 6): a rename or the obsolete flag
  // changes no number — the view hears of it, the stats are not rebuilt.
  it("a rename or the obsolete flag only tells the view", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    d.takeData();
    const ver = d.designVersion(GBR);
    const seq = d.keyStatsSeq;
    const stats = d.designStatsOf(GBR, "tank", 1);
    const order = (o: DepthOrder) => expect(d.issue(GBR, o, tick)).toBeNull();
    order({ kind: "design_rename", design: "tank", slot: 1, name: "Other" });
    order({ kind: "design_obsolete", design: "tank", slot: 1 });
    expect(d.designVersion(GBR)).toBe(ver);
    expect(d.keyStatsSeq).toBe(seq);
    expect(d.designStatsOf(GBR, "tank", 1)).toBe(stats);
    const data = d.takeData()!;
    expect(data.designsOf?.map((x) => x.def?.name)).toEqual(["Other", "Other"]);
    const mine = data.details?.find((x) => x.smallID === GBR);
    expect(mine?.designs.find((x) => x.slot === 1)).toMatchObject({
      obsolete: true,
      def: { name: "Other" },
    });
    // A new save still rebuilds them.
    order({ kind: "design_save", def: MED2 });
    expect(d.designVersion(GBR)).toBe(ver + 1);
    expect(d.keyStatsSeq).not.toBe(seq);
  });

  it("line conversion consumes old stock", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def: MED2 }, tick)).toBeNull();
    const ce = ww.economy.country(GBR)!;
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "tank_design", 1, 2)).toBeNull();
    const line = ce.lines[0];
    const light = equipKey("light_tank", 1);
    const key = equipKey("tank_design", 1);
    // A plane or the line's own key is no tank to convert.
    expect(
      d.issue(
        GBR,
        { kind: "line_convert", line: line.id, from: equipKey("fighter", 1) },
        tick,
      ),
    ).toBe("bad_line");
    expect(
      d.issue(GBR, { kind: "line_convert", line: line.id, from: key }, tick),
    ).toBe("bad_line");
    expect(
      d.issue(GBR, { kind: "line_convert", line: line.id, from: light }, tick),
    ).toBeNull();
    expect(line.convertFrom).toBe(light);
    ce.stock[light] = 3;
    expect(conversionCostMilli(d, GBR, line.id, key)).toBe(
      convertCost(equipCostMilli(d, GBR, key), equipCostMilli(d, GBR, light)),
    );
    for (let i = 0; i < 3000 && ce.stock[key] < 5; i++) step(runner, 1);
    // Three light tanks rebuilt, then full-cost tanks from nothing.
    expect(ce.stock[light]).toBe(0);
    expect(ce.stock[key]).toBeGreaterThanOrEqual(5);
    expect(conversionCostMilli(d, GBR, line.id, key)).toBeNull();
    // A static light tank line to a medium chassis design keeps no 60%: P1's rule.
    expect(lineRetentionBp(d, GBR, light, key)).toBe(-1);
    expect(lineRetentionBp(d, GBR, equipKey("medium_tank", 1), key)).toBe(
      6_000,
    );
    expect(
      d.issue(GBR, { kind: "line_convert", line: line.id, from: null }, tick),
    ).toBeNull();
    expect(line.convertFrom).toBe(-1);
  });

  it("full design slots refuse a new save", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    for (let i = 1; i <= 12; i++) {
      expect(
        d.issue(
          GBR,
          { kind: "design_save", def: { ...MED1, name: `M${i}` } },
          tick,
        ),
      ).toBeNull();
    }
    const xp = d.xpOf(GBR, 0);
    expect(d.issue(GBR, { kind: "design_save", def: MED2 }, tick)).toBe(
      "design_slots_full",
    );
    expect(
      d.issue(GBR, { kind: "design_save", def: MED2, slot: 3 }, tick),
    ).toBe("design_in_use");
    expect(
      d.issue(GBR, { kind: "design_copy", from: 1, def: MED2 }, tick),
    ).toBe("design_slots_full");
    // A refusal costs nothing.
    expect(d.xpOf(GBR, 0)).toBe(xp);
    // Obsolete slots still count until the day frees them (as the designer shows).
    d.issue(GBR, { kind: "design_obsolete", design: "tank", slot: 4 }, tick);
    expect(d.issue(GBR, { kind: "design_save", def: MED2 }, tick)).toBe(
      "design_slots_full",
    );
  });

  it("a captured design cannot be put on a line", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    prepare(ww, DEU, TANK_TECHS);
    expect(saveDesign(d, DEU, MED2, 0, "own", 0, 0, 0)).toBe(1);
    const slot = copyDesignTo(d, DEU, 1, "tank", GBR, "captured");
    expect(slot).toBe(1);
    const ce = ww.economy.country(GBR)!;
    expect(addLine(ww.economy, ce, "tank_design", slot!, 1)).toBe("bad_line");
    const tick = runner.game.ticks();
    expect(
      d.issue(GBR, { kind: "design_copy", from: slot!, def: MED2 }, tick),
    ).toBe("bad_base");
    // Its own design goes on a line.
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    expect(addLine(ww.economy, ce, "tank_design", 2, 1)).toBeNull();
  });

  it("treaty member cannot save a main_heavy battleship", async () => {
    const { runner, ww, d } = await game([
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "DEU" },
    ]);
    prepare(ww, GBR, ["bb_2"]);
    prepare(ww, DEU, ["bb_2"]);
    const bb: Def = {
      kind: "ship",
      base: "bb_2",
      modules: ["main_heavy", "", "", "", "", ""],
      name: "Big Gun",
    };
    const tick = runner.game.ticks();
    expect(d.issue(GBR, { kind: "design_save", def: bb }, tick)).toBe(
      "treaty_limit",
    );
    // Not a member: Germany may.
    expect(d.issue(DEU, { kind: "design_save", def: bb }, tick)).toBeNull();
    // Britain's standard battleship is fine, and its line too.
    const std: Def = {
      kind: "ship",
      base: "bb_2",
      modules: ["", "sec_aa", "", "", "", "floatplane"],
      name: "Standard",
    };
    expect(d.issue(GBR, { kind: "design_save", def: std }, tick)).toBeNull();
    const BB = SHIP_CLASSES.indexOf("bb");
    expect(navalLineDesignBlock(d, GBR, BB, 2, 1)).toBeNull();
    expect(navalLineDesignBlock(d, GBR, BB, 3, 1)).toBe("bad_line");
    // A licensed big-gun design still may not go on a member's line.
    const lic = copyDesignTo(d, DEU, 1, "ship", GBR, "licensed")!;
    expect(navalLineDesignBlock(d, GBR, BB, 2, lic)).toBe("treaty_limit");
    expect(navalLineDesignBlock(d, DEU, BB, 2, 1)).toBeNull();
    // Spec §5.3.4 / §7.1: a naval line pays its design's modules (+8%) and
    // a licence's surcharge (10% at no gap over Britain's own bb_2).
    const hull = lineUnitCost("bb", 2) * 1000;
    const line = (design: number) => ({ cls: BB, gen: 2, progress: 0, design });
    expect(navalLineCostMilli(d, GBR, line(0))).toBe(hull);
    expect(navalLineCostMilli(d, GBR, line(1))).toBe(
      Math.floor((hull * 108) / 100),
    );
    expect(shipLicenceCostPct(d, GBR, lic)).toBe(licenceCostPct(0));
    expect(navalLineCostMilli(d, GBR, line(lic))).toBe(
      Math.floor(
        (Math.floor((hull * 110) / 100) * (100 + licenceCostPct(0))) / 100,
      ),
    );
    expect(shipLicenceCostPct(d, GBR, 1)).toBe(0);
  });

  it("a jet airframe draws on the light aircraft MIO (spec §6.1)", async () => {
    const { ww, d } = await game();
    grantDoctrineStats(ww, GBR, {
      mioCostPct_air_light: -10,
      mioCostPct_air_heavy: 5,
    });
    const ctx = (base: string) =>
      designCtxOf(d, GBR, { kind: "plane", base }).costPct;
    expect(ctx("jet_1")).toBe(-10);
    expect(ctx("small_2")).toBe(-10);
    expect(ctx("medium_1")).toBe(5);
    expect(ctx("large_3")).toBe(5);
  });
});

// Review E9b: the plane and ship numbers lane E adds to P4 (pure where it can be).
describe("World War 1936 P6: plane and ship design numbers", () => {
  const ALL = new Set(WW_TECH_IDS);
  const OK = {
    techs: ALL,
    projects: -1,
    treatyMember: false,
    treatyEscalated: true,
  };
  const ROLES = [
    undefined,
    "fighter",
    "cas",
    "naval_bomber",
    "heavy_fighter",
    "bomber",
    "strat_bomber",
    "transport_plane",
  ];

  it("the recommended fits pass the designer's checks", () => {
    for (const base of PLANE_BASES) {
      for (const role of ROLES) {
        const def = recommendedPlane(base, ALL, role);
        expect(designBlock(def, OK), `${base} ${role}`).toBeNull();
      }
    }
    expect(planeType(recommendedPlane("small_2", ALL, "cas"))).toBe("cas");
    expect(planeType(recommendedPlane("medium_2", ALL, "naval_bomber"))).toBe(
      "naval_bomber",
    );
    expect(planeType(recommendedPlane("large_1", ALL))).toBe("strat_bomber");
    expect(planeType(recommendedPlane("medium_1", ALL))).toBe("bomber");
    // No techs: machine guns, a fighter.
    expect(recommendedPlane("small_1", new Set()).modules).toEqual([
      "w_mg4",
      "w_mg2",
      "",
      "",
    ]);
    for (const cls of SHIP_CLASSES) {
      for (let g = 1; g <= SHIP_GENS[cls]; g++) {
        for (const techs of [undefined, ALL]) {
          const def = recommendedShip(`${cls}_${g}`, techs, -1);
          expect(designBlock(def, OK), `${cls}_${g}`).toBeNull();
        }
      }
    }
    // K5's standard fits without techs; the best researched with them.
    expect(recommendedShip("dd_1").modules).toEqual(["", "", "sec_aa", ""]);
    expect(recommendedShip("ss_2").modules).toEqual(["", "engine_long", ""]);
    expect(recommendedShip("cl_3", ALL).modules).toEqual([
      "",
      "aa_3",
      "",
      "radar_adv",
      "floatplane",
    ]);
    expect(recommendedShip("ss_3", ALL).modules).toEqual([
      "torp_heavy",
      "engine_long",
      "snorkel",
    ]);
  });

  it("a plane design flies as its P4 type with the design's numbers (spec §5.4.2)", () => {
    const ctx = { techs: ALL, projects: -1, relPp: 0, costPct: 0 };
    const fighter = designPlaneStats(recommendedPlane("small_2", ALL), ctx);
    const p = designPlaneAsP4(fighter, "fighter");
    expect(p.airAtk).toBe(fighter.airAttack);
    expect(p.airDef).toBe(fighter.airDefense);
    expect(p.agility).toBe(fighter.agility);
    expect(p.speedKmh).toBe(fighter.speed);
    expect(p.rangeKm).toBe(fighter.range);
    expect([p.ground, p.strat, p.naval]).toEqual([
      fighter.ground,
      fighter.strategic,
      fighter.naval,
    ]);
    // A fighter type's superiority weight: (attack + defence) / 3 (P4's rule).
    expect(p.supWeightMilli).toBe(
      Math.floor((fighter.airAttack + fighter.airDefense) / 3),
    );
    // Fuel: the type's (0.2 → 200) × the design's cost / the fighter's 22.
    expect(p.fuelPerSortieMilli).toBe(
      Math.floor((200 * fighter.costMilli) / 22_000),
    );
    // A jet × 1.6.
    const jet = designPlaneStats(recommendedPlane("jet_1", ALL), ctx);
    expect(designPlaneAsP4(jet, "fighter").fuelPerSortieMilli).toBe(
      Math.floor((Math.floor((200 * jet.costMilli) / 22_000) * 160) / 100),
    );
    // A bomber: weight 100, its fuel 0.3 × cost / 30.
    const bomber = designPlaneStats(recommendedPlane("medium_1", ALL), ctx);
    const b = designPlaneAsP4(bomber, "bomber");
    expect(b.supWeightMilli).toBe(100);
    expect(b.fuelPerSortieMilli).toBe(
      Math.floor((300 * bomber.costMilli) / 30_000),
    );
  });

  it("a plane design key carries the country's air percentages", async () => {
    const { ww, d } = await game();
    const def = { ...recommendedPlane("small_1", ALL), name: "Hawk" };
    expect(saveDesign(d, GBR, def, 0, "own", 0, 0, 0)).toBe(1);
    const key = equipKey("plane_design", 1);
    const base = d.designStatsOf(GBR, "plane", 1) as PlaneDesignStats;
    expect(planeStatsOfKey(d, GBR, key)).toBe(base);
    grantDoctrineStats(ww, GBR, {
      airAttackPct: 10,
      fighterAttackPct: 5,
      airDefensePct: -10,
    });
    const s = planeStatsOfKey(d, GBR, key)!;
    expect(s.airAttack).toBe(Math.floor((base.airAttack * 115) / 100));
    expect(s.airDefense).toBe(Math.floor((base.airDefense * 90) / 100));
    expect(s.ground).toBe(base.ground);
    // Memoised until the stats move.
    expect(planeStatsOfKey(d, GBR, key)).toBe(s);
    expect(planeStatsOfKey(d, GBR, equipKey("fighter", 1))).toBeNull();
  });
});

// T1b's plane-design helpers (draw, return, lose, numbers, reliability).
describe("World War 1936 P6: design planes for P4's deployments", () => {
  it("draw newest first onto the ledger, come back, are lost, fly with their numbers", async () => {
    const { ww, d } = await game();
    const ALL = new Set(WW_TECH_IDS);
    const ce = ww.economy.country(GBR)!;
    for (const t of [
      "fighter_2",
      "self_sealing_tanks",
      "drop_tanks",
    ] as const) {
      ce.addTech(t);
    }
    // Slot 1 a 1936 fighter, slot 2 a 1940 one, slot 3 a bomber.
    const f1 = { ...recommendedPlane("small_1", ALL), name: "F1" };
    const f2 = { ...recommendedPlane("small_2", ALL), name: "F2" };
    const b1 = { ...recommendedPlane("medium_1", ALL), name: "B1" };
    for (const def of [f1, f2, b1]) saveDesign(d, GBR, def, 0, "own", 0, 0, 0);
    expect(planeDesignSlotsOf(d, GBR, "fighter")).toEqual([2, 1]);
    expect(planeDesignSlotsOf(d, GBR, "bomber")).toEqual([3]);
    const k = (s: number) => equipKey("plane_design", s);
    ce.stock[k(1)] = 10;
    ce.stock[k(2)] = 4;
    const got = drawDesignPlanes(d, GBR, "fighter", 7);
    expect(got.slice(0, 3)).toEqual([3, 4, 0]);
    expect(got).toHaveLength(16);
    expect([ce.stock[k(1)], ce.planesDeployed[k(1)]]).toEqual([7, 3]);
    expect([ce.stock[k(2)], ce.planesDeployed[k(2)]]).toEqual([0, 4]);
    returnDesignPlanes(d, GBR, [1, 0]);
    loseDesignPlanes(d, GBR, [0, 2]);
    expect([ce.stock[k(1)], ce.planesDeployed[k(1)]]).toEqual([8, 2]);
    expect([ce.stock[k(2)], ce.planesDeployed[k(2)]]).toEqual([0, 2]);
    const p = designPlaneP4(d, GBR, 2, "fighter")!;
    const s2 = planeStatsOfKey(d, GBR, k(2))!;
    expect(p).toEqual(designPlaneAsP4(s2, "fighter"));
    expect(designPlaneP4(d, GBR, 9, "fighter")).toBeNull();
    expect(designPlaneLossBp(d, GBR, 2)).toBe(reliabilityLossBp(s2.relPm));
    expect(designPlaneLossBp(d, GBR, 9)).toBe(10_000);
    // A record of 6 static planes and 2 of slot 2: their weighted multiplier.
    const dc = new Array<number>(16).fill(0);
    dc[1] = 2;
    expect(planesLossBp(d, GBR, [6, 0, 0], dc)).toBe(
      Math.floor((6 * 10_000 + 2 * designPlaneLossBp(d, GBR, 2)) / 8),
    );
    expect(planesLossBp(d, GBR, [0, 0, 0], new Array(16).fill(0))).toBe(10_000);
  });
});

// Review E9c: a refit and a conversion survive a snapshot mid-way.
describe("World War 1936 P6: designs in a snapshot", () => {
  it("a restored game continues a refit and a converting line the same way", async () => {
    const { runner, ww, d } = await game();
    prepare(ww, GBR, TANK_TECHS);
    const tick = runner.game.ticks();
    const dd: Def = {
      kind: "ship",
      base: "dd_2",
      modules: ["", "", "sec_aa", ""],
      name: "AA",
    };
    expect(d.issue(GBR, { kind: "design_save", def: dd }, tick)).toBeNull();
    const fid = ww.navy.createFleet(GBR, LONDON, [["dd", 2, 2]]);
    const ship = ww.navy.fleets.get(fid)!.ships[0];
    expect(
      d.issue(GBR, { kind: "ship_refit", ship, slot: 1 }, tick),
    ).toBeNull();
    expect(d.issue(GBR, { kind: "design_save", def: MED1 }, tick)).toBeNull();
    expect(d.issue(GBR, { kind: "design_save", def: MED2 }, tick)).toBeNull();
    const ce = ww.economy.country(GBR)!;
    clearStartSetup(ww.economy, ce);
    expect(addLine(ww.economy, ce, "tank_design", 2, 2)).toBeNull();
    ce.stock[equipKey("tank_design", 1)] = 200;
    expect(
      d.issue(
        GBR,
        {
          kind: "line_convert",
          line: ce.lines[0].id,
          from: equipKey("tank_design", 1),
        },
        tick,
      ),
    ).toBeNull();
    step(runner, 4 * 15);
    const t = ww.navy.ships;
    expect(t.refitLeft[t.rowOf(ship)]).toBeGreaterThan(0);
    const b = await wwRestore(
      runner,
      [{ clientID: HUMAN, country: "GBR" }],
      DEEP.map,
    );
    const rows = (r: typeof runner) => {
      const w = r.game.worldWar()!;
      const s = w.navy.ships;
      const row = s.rowOf(ship);
      const e = w.economy.country(GBR)!;
      return JSON.stringify([
        s.design[row],
        s.refitTo[row],
        s.refitLeft[row],
        e.lines.map((l) => [l.key, l.convertFrom, l.progress, l.effBp]),
        e.stock[equipKey("tank_design", 1)],
        e.stock[equipKey("tank_design", 2)],
        w.depth.country(GBR)!.des,
      ]);
    };
    expect(rows(b)).toBe(rows(runner));
    for (let i = 0; i < 20 * 15; i++) {
      step(runner);
      step(b);
      expect(gameHash(b), `tick ${i}`).toBe(gameHash(runner));
    }
    expect(rows(b)).toBe(rows(runner));
    // The refit finished in both.
    expect(ww.navy.ships.design[ww.navy.ships.rowOf(ship)]).toBe(1);
  });
});
