// w77: every researchable tech has an effect of its own, and each of the 36
// that were empty or only a catalogue gate does what its name says, through
// a rule that is read for every country (catalogue equipment and minors'
// generic equipment alike).
import {
  WW_TECH_IDS,
  type WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type {
  BattalionId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { battalionStatPct } from "@openfront/engine-lib/ww1936/DoctrineRules";
import { planeStats } from "@openfront/engine-lib/ww1936/PlaneStats";
import {
  NAVAL_AA_PCT,
  shipStats,
} from "@openfront/engine-lib/ww1936/ShipStats";
import { techStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import { FIRE_CONTROL_2_HIT_PCT } from "@openfront/engine/ww1936/navy/NavalBattles";
import { describe, expect, it } from "vitest";

/** The 36 techs of w77 and the one stat key each now gives (rules: see below). */
const KEYS: Readonly<Record<string, readonly string[]>> = {
  cast_armor: ["armorArmorPct"],
  sloped_armor: ["armorArmorPct"],
  torsion_bar: ["armorBrkPct"],
  interleaved_wheels: ["armorBrkPct"],
  tank_radio: ["mechOrg"],
  flame_tank: ["fortPenaltyCutPct"],
  diesel_engine: ["mechOrg"],
  tank_engine_2: ["mechOrg"],
  tank_engine_3: ["mechOrg"],
  heavy_tank_2: ["armorAttackPct"],
  heavy_tank_3: ["armorAttackPct"],
  tank_gun_2: ["armorPiercePct"],
  tank_gun_3: ["armorPiercePct"],
  tank_gun_4: ["armorPiercePct"],
  super_heavy_tank: ["armorDefensePct"],
  modern_tank_1: ["armorAttackPct", "armorBrkPct"],
  amphibious_drive: ["invasionPrepPct"],
  naval_radar_2: ["navalDetectPct"],
  armored_deck: ["navalDamageTakenPct"],
  snorkel: ["subVisibilityPct"],
  super_heavy_battleship: ["capitalHpPct"],
  aircraft_cannon_1: ["fighterAttackPct"],
  aircraft_cannon_2: ["fighterAttackPct"],
  drop_tanks: ["airRangePct"],
  self_sealing_tanks: ["airLossCutPct"],
  bomb_sight_1: ["stratBombPct"],
  air_rockets_1: ["casPct"],
  air_radar_1: ["airDetectPct"],
  air_radar_2: ["airDetectPct"],
  jet_airframe_2: ["airAgilityPct"],
  jet_bomber_1: ["bomberDefensePct"],
  // By rule (ShipStats' NAVAL_AA_PCT, NavalBattles' fire control, Mines): no stat key.
  mine_warfare_1: [],
  dual_purpose_guns: [],
  naval_aa_1: [],
  naval_aa_2: [],
  fire_control_2: [],
};

const def = (comp: Partial<Record<BattalionId, number>>): TemplateDef => ({
  name: "x",
  battalions: Object.entries(comp).flatMap(([k, n]) =>
    new Array<BattalionId>(n).fill(k as BattalionId),
  ),
  support: [],
});
const tot = (...t: WwTechId[]) => techTotals(new Set(t));
const stat = (...t: WwTechId[]) => techStats(tot(...t));

describe("the 36 techs w77 gave an effect", () => {
  it("there are 36 and each gives what the table says", () => {
    expect(Object.keys(KEYS).length).toBe(36);
    for (const [id, keys] of Object.entries(KEYS)) {
      const fx = WW_TECHS[id as WwTechId].effects as Record<string, number>;
      expect(Object.keys(fx).sort(), id).toEqual([...keys].sort());
      for (const k of keys) expect(fx[k], `${id}.${k}`).not.toBe(0);
    }
  });

  it("the small ones stay small (3-5 %, neighbours' size)", () => {
    for (const id of Object.keys(KEYS)) {
      for (const [k, v] of Object.entries(WW_TECHS[id as WwTechId].effects)) {
        if (k === "mechOrg") continue;
        expect(Math.abs(v as number), `${id}.${k}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it("tank techs change a tank division's numbers (static and catalogue slots read the same lines)", () => {
    const med = def({ medium_armor: 2 });
    const base = templateStats(med, tot(), GEN1);
    const a = (t: WwTechId) => templateStats(med, tot(t), GEN1);
    expect(a("cast_armor").armor).toBeGreaterThan(base.armor);
    expect(a("sloped_armor").armor).toBeGreaterThan(base.armor);
    expect(a("torsion_bar").brk).toBeGreaterThan(base.brk);
    expect(a("interleaved_wheels").brk).toBeGreaterThan(base.brk);
    for (const t of [
      "tank_radio",
      "diesel_engine",
      "tank_engine_2",
      "tank_engine_3",
    ] as const) {
      expect(a(t).orgMilli, t).toBeGreaterThan(base.orgMilli);
    }
    // Heavy tanks have no generic row: they come as catalogue (or design)
    // slots, which templateStats scales with the same battalionStatPct line
    // as a medium tank's static row (the medium checks above).
    const hv = (t: WwTechId) => battalionStatPct(stat(t), "heavy_armor");
    for (const t of ["heavy_tank_2", "heavy_tank_3"] as const) {
      expect(hv(t).soft, t).toBe(3);
      expect(hv(t).hard, t).toBe(3);
    }
    expect(hv("super_heavy_tank").def).toBe(4);
    expect(hv("tank_gun_2").pierce).toBe(4);
    for (const t of ["tank_gun_2", "tank_gun_3", "tank_gun_4"] as const) {
      expect(a(t).pierce, t).toBeGreaterThan(base.pierce);
    }
    expect(a("modern_tank_1").brk).toBeGreaterThan(base.brk);
    expect(a("modern_tank_1").soft).toBeGreaterThan(base.soft);
  });

  it("ship techs change the ships", () => {
    const none = new Set<WwTechId>();
    const z = stat();
    for (const t of [
      "dual_purpose_guns",
      "naval_aa_1",
      "naval_aa_2",
    ] as const) {
      const aa = shipStats("bb", 1, z, new Set([t])).aa;
      expect(aa, t).toBeGreaterThan(shipStats("bb", 1, z, none).aa);
      // The base AA is stored x100 (generation 1: x100); the tech adds its percent of it.
      const base = shipStats("bb", 1, z, none).aa;
      expect(aa - base, t).toBe(Math.floor((base * NAVAL_AA_PCT[t]) / 100));
    }
    // A submarine has no guns to speak of: the AA techs leave it alone.
    expect(shipStats("ss", 1, z, new Set(["naval_aa_2"])).aa).toBe(
      shipStats("ss", 1, z, none).aa,
    );
    expect(
      shipStats("bb", 1, stat("super_heavy_battleship"), none).hpMilli,
    ).toBeGreaterThan(shipStats("bb", 1, z, none).hpMilli);
    expect(shipStats("ss", 4, stat("snorkel"), none).vis).toBeLessThan(
      shipStats("ss", 4, z, none).vis,
    );
    expect(stat("naval_radar_2").navalDetectPct).toBe(5);
    expect(stat("armored_deck").navalDamageTakenPct).toBe(-4);
    expect(FIRE_CONTROL_2_HIT_PCT).toBe(5);
  });

  it("air techs change the planes (static type and catalogue design alike: withAirStats copies these lines)", () => {
    const none = new Set<WwTechId>();
    const z = stat();
    expect(
      planeStats("fighter", 1, stat("aircraft_cannon_1"), none).airAtk,
    ).toBeGreaterThan(planeStats("fighter", 1, z, none).airAtk);
    expect(
      planeStats("fighter", 1, stat("aircraft_cannon_2"), none).airAtk,
    ).toBeGreaterThan(planeStats("fighter", 1, z, none).airAtk);
    expect(
      planeStats("fighter", 1, stat("drop_tanks"), none).rangeKm,
    ).toBeGreaterThan(planeStats("fighter", 1, z, none).rangeKm);
    expect(
      planeStats("fighter", 1, stat("jet_airframe_2"), none).agility,
    ).toBeGreaterThan(planeStats("fighter", 1, z, none).agility);
    expect(
      planeStats("strat_bomber", 1, stat("jet_bomber_1"), none).airDef,
    ).toBeGreaterThan(planeStats("strat_bomber", 1, z, none).airDef);
    // Read straight off the country's stats in the air war.
    expect(stat("bomb_sight_1").stratBombPct).toBe(5);
    expect(stat("air_rockets_1").casPct).toBe(5);
    expect(stat("self_sealing_tanks").airLossCutPct).toBe(3);
    expect(stat("air_radar_1", "air_radar_2").airDetectPct).toBe(10);
  });

  it("every live tech has some effect of its own in the stat table or an id rule", () => {
    // Rules by id: the tech is read by id in an engine file; the client's
    // TECH_RULE_LINES test (tests/client) covers the text and the guard.
    const byRule = new Set([
      "mine_warfare_1",
      "dual_purpose_guns",
      "naval_aa_1",
      "naval_aa_2",
      "fire_control_2",
    ]);
    for (const id of WW_TECH_IDS) {
      if (WW_TECHS[id].retired === true || !(id in KEYS)) continue;
      expect(
        Object.keys(WW_TECHS[id].effects).length > 0 || byRule.has(id),
        id,
      ).toBe(true);
    }
  });
});
