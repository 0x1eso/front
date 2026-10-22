// World War 1936 P6 lane E (plan Task 3 Step 8, spec §5): designs in a
// real game — a human Britain on ww1936deep, the techs and experience
// given by the test (plan decision 30).
import type { DepthOrder, WwOrder } from "@openfront/engine-api/Schemas";
import type { TankDesignStats } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  EQUIP_KEYS,
  equipKey,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  GROUND_EQUIP_KEYS,
  GROUND_STATIC_SLOTS,
} from "@openfront/engine-api/ww1936/LandTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  convertCost,
  designXpCost,
  reliabilityLossBp,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { copyDesignTo } from "@openfront/engine/ww1936/depth/DesignCopy";
import {
  conversionCostMilli,
  equipCostMilli,
  equipResources,
  lineRetentionBp,
  navalLineDesignBlock,
  saveDesign,
} from "@openfront/engine/ww1936/depth/Designs";
import { addLine } from "@openfront/engine/ww1936/economy/Production";
import { designLossMilli } from "@openfront/engine/ww1936/land/Battles";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  clearStartSetup,
  HUMAN,
  placeArmy,
  step,
  stepTo,
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
    expect(
      d.issue(GBR, { kind: "design_save", def: HEAVY }, runner.game.ticks()),
    ).toBeNull();
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
    // Topped up for a division (the test does not wait for 80 tanks).
    ce.stock[key] += 100;
    const tpl = template(ww, GBR, ["heavy_armor", "heavy_armor"]);
    const army = placeArmy(runner.game, "GBR", LONDON, 1, tpl);
    const r = ww.land.divisions.rowOf(army.divisions[0]);
    const j = GROUND_STATIC_SLOTS; // design slot 1
    expect(ww.land.divisions.equipOf(r)[j]).toBe(80);
    // The battalion numbers are the design's (spec §5.2.6).
    const s = ww.land.baseStatsOf(r);
    expect(s.soft).toBe(2 * ds.soft);
    expect(s.hard).toBe(2 * ds.hard);
    expect(s.brk).toBe(2 * ds.brk);
    expect(s.armor).toBe(ds.armor);
    expect(s.speedCenti).toBe(ds.speedCenti);
    expect(s.hardnessPm).toBe(ds.hardnessPm);
    // Radio: +2 organisation over the battalion's 10.
    expect(s.orgMilli).toBe(12_000);
    // Losses follow the design's reliability (spec §5.2.2).
    const ks = ww.land.keyStatsOf(GBR);
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
  });
});
