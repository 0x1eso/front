// ww67: the rules that make battles read like the Second World War.
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import type {
  BattalionId,
  SupportId,
  TemplateDef,
} from "@openfront/engine-api/ww1936/LandTypes";
import { LAND_TERRAINS } from "@openfront/engine-api/ww1936/LandTypes";
import { WEATHER_SORTIE_PM } from "@openfront/engine-lib/ww1936/AirRules";
import {
  armorProtectPm,
  combatWidth,
  divisionMods,
  excessWidthBp,
  roundDamage,
  TERRAIN,
} from "@openfront/engine-lib/ww1936/CombatRules";
import {
  GEN1,
  STATIC_KEY_STATS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { WEATHER } from "@openfront/engine-lib/ww1936/Weather";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { retreatDivision } from "@openfront/engine/ww1936/land/Battles";
import { describe, expect, test } from "vitest";
import { byTag, land, placeArmy, warAfterPrep, wwRunner } from "./util";

const TECH = techTotals(new Set());
const def = (
  comp: Partial<Record<BattalionId, number>>,
  support: SupportId[] = [],
): TemplateDef => ({
  name: "x",
  battalions: Object.entries(comp).flatMap(([k, n]) =>
    new Array<BattalionId>(n).fill(k as BattalionId),
  ),
  support,
});
const stats = (d: TemplateDef) => templateStats(d, TECH, GEN1);

describe("terrain and weather call for no army of their own", () => {
  test("terrain: one width, small cuts, road cost at most 130 %", () => {
    for (const t of LAND_TERRAINS) {
      expect(combatWidth(t, 1), t).toBe(90);
      expect(combatWidth(t, 2), t).toBe(135);
      expect(TERRAIN[t].attackBp).toBeGreaterThanOrEqual(-1000);
      expect(TERRAIN[t].supplyPct).toBeLessThanOrEqual(130);
    }
    expect(excessWidthBp(92, 90)).toBe(-444);
    expect(excessWidthBp(180, 90)).toBe(-1000);
  });

  test("weather: attack, attrition, supply and sorties are capped", () => {
    for (const w of Object.values(WEATHER)) {
      expect(w.attackBp).toBeGreaterThanOrEqual(-1000);
      expect(w.attritionPm).toBeLessThanOrEqual(1);
      expect(w.supplyPct).toBeGreaterThanOrEqual(90);
    }
    for (const pm of Object.values(WEATHER_SORTIE_PM)) {
      expect(pm).toBeGreaterThanOrEqual(850);
    }
  });
});

describe("armour's protection", () => {
  test("is full for a mostly armoured division out of reach", () => {
    expect(armorProtectPm(6000, 900, 1000)).toBe(500);
    expect(armorProtectPm(6000, 500, 4000)).toBe(500);
    expect(roundDamage(920, 500)).toEqual({ orgMilli: 437, hpMilli: 302 });
  });

  test("scales with the tank share below half hardness", () => {
    expect(armorProtectPm(6000, 250, 1000)).toBe(250);
    expect(armorProtectPm(6000, 100, 1000)).toBe(100);
    expect(armorProtectPm(0, 900, 0)).toBe(0);
  });

  test("fades smoothly as pierce nears the armour", () => {
    expect(armorProtectPm(6000, 900, 5000)).toBe(250);
    expect(armorProtectPm(6000, 900, 5500)).toBe(125);
    expect(armorProtectPm(6000, 900, 6000)).toBe(0);
    expect(armorProtectPm(6000, 900, 9000)).toBe(0);
  });
});

describe("a division's pierce is what can actually hit", () => {
  const line = def({ infantry: 6, artillery: 2 }, [
    "support_artillery",
    "support_anti_tank",
  ]);
  const noAt = def({ infantry: 6, artillery: 2 }, ["support_artillery"]);
  const at = def({ infantry: 6, artillery: 1, anti_tank: 3 }, [
    "support_artillery",
    "support_anti_tank",
  ]);

  test("one company adds a little and doesn't set the number", () => {
    const company = stats(line).pierce;
    expect(company).toBeGreaterThan(stats(noAt).pierce);
    // The company's gun is 45: well under half of that reaches the division.
    expect(company).toBeLessThan(1500);
  });

  test("three battalions bring the gun's number within reach, not all of it", () => {
    const three = stats(at).pierce;
    expect(three).toBeGreaterThan(2000);
    expect(three).toBeLessThan(4000);
  });

  test("a division all tanks fires its tank's gun; half tanks, most of it", () => {
    expect(stats(def({ medium_armor: 9 })).pierce).toBe(4500);
    const pz = stats(def({ medium_armor: 5, motorized: 4 }));
    expect(pz.pierce).toBeGreaterThan(3500);
    expect(pz.pierce).toBeLessThan(4500);
    // Armour is the armoured battalions' own; hardness says how much of it there is.
    expect(pz.armor).toBe(4000);
  });

  test("anti-tank guns take the country's key", () => {
    const ks = { ...STATIC_KEY_STATS, stats: STATIC_KEY_STATS.stats.slice() };
    const atRow = STATIC_KEY_STATS.group.findIndex(
      (_, j) => STATIC_KEY_STATS.stats[j * KS_FIELDS + KS.pierce] === 5000,
    );
    ks.stats[atRow * KS_FIELDS + KS.pierce] = 10_000;
    const real = templateStats(at, TECH, GEN1, ks).pierce;
    expect(real).toBeGreaterThan(stats(at).pierce);
    expect(real).toBeLessThanOrEqual(10_000);
  });
});

describe("a pocket", () => {
  test("takes its encircled line and no supply cut", () => {
    const mods = divisionMods({
      attacking: false,
      genAtt: 0,
      genDef: 0,
      traits: 0,
      flags: 0,
      tech: TECH,
      exp: 0,
      planBp: 0,
      land: "plains",
      weather: "clear",
      river: 0,
      strait: false,
      fort: 0,
      entrench: 0,
      excessBp: 0,
      supplyPm: 0,
      encircled: true,
      airBp: 0,
      fuelBp: 0,
      landingBp: 0,
      coastalFortBp: 0,
      shoreBp: 0,
      fmAtt: 0,
      fmDef: 0,
      fmTraits: 0,
      cmdAttBp: 0,
      cmdDefBp: 0,
      enemyPlanCutBp: 0,
      fortCut: 0,
      halfSupply: false,
      designFlags: 0,
      artSoftPm: 0,
      fmPlanBp: 0,
    });
    expect(mods.mods.attackBp).toBe(5000);
    expect(mods.mods.defenseBp).toBe(5000);
    expect(mods.defenseLines.some((l) => l.id === "supply")).toBe(false);
  });
});

describe("a broken division leaves men and equipment behind", () => {
  test("15 % when broken, nothing with org left", async () => {
    const runner = await wwRunner({}, [
      { clientID: "HUMAN001", country: "DEU" },
      { clientID: "HUMAN002", country: "POL" },
    ]);
    const g = runner.game;
    warAfterPrep(runner, "HUMAN001", "POL");
    const l = land(g);
    const t = l.divisions;
    const pol = byTag(g, "POL").smallID();
    const home = l.rowsOf(pol).length > 0 ? t.region[l.rowsOf(pol)[0]] : 6;
    const a = placeArmy(g, "POL", home, 2);
    const [broken, whole] = a.divisions.map((id) => t.rowOf(id));
    const men = t.men[broken];
    const eq = [...t.equipOf(broken)].reduce((x, y) => x + y, 0);
    t.org[broken] = 0;
    retreatDivision(l, broken);
    expect(men - t.men[broken]).toBeGreaterThanOrEqual(
      Math.floor((men * 14) / 100),
    );
    expect(men - t.men[broken]).toBeLessThanOrEqual(
      Math.ceil((men * 16) / 100),
    );
    expect([...t.equipOf(broken)].reduce((x, y) => x + y, 0)).toBeLessThan(eq);
    const men2 = t.men[whole];
    retreatDivision(l, whole);
    expect(t.men[whole]).toBe(men2);
  }, 60_000);
});
