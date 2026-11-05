// ww91 lane N2: the army of each major (area A) and its national unit (area C):
// the spirits, the focuses that give the units, and the three extra rules.
import {
  TPL_MARINE_ANY,
  TPL_MOUNTAIN_MAJOR,
} from "@openfront/engine-api/ww1936/LandTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  divisionMods,
  type ModInput,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import {
  NATIONAL_SPIRITS,
  SPIRITS_NATIONAL,
} from "@openfront/engine-lib/ww1936/content/spirits/national";
import { landingBp } from "@openfront/engine-lib/ww1936/InvasionRules";
import { NATIONAL_UNITS } from "@openfront/engine-lib/ww1936/NationalUnits";
import { raidSuccessPm } from "@openfront/engine-lib/ww1936/ProjectRules";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, test } from "vitest";

const spirit = (id: string) => SPIRITS_NATIONAL.find((s) => s.id === id)!;
const TAGS = ["DEU", "SUN", "USA", "GBR", "FRA", "JPN", "ITA"];

describe("national armies and units (N2)", () => {
  test("each major starts with its army; the unit comes only by focus", () => {
    TAGS.forEach((tag, i) => {
      const t = tag.toLowerCase();
      expect(NATIONAL_SPIRITS[tag]).toContain(`nat_${t}_army`);
      expect(NATIONAL_SPIRITS[tag]).not.toContain(`nat_${t}_unit`);
      expect(spirit(`nat_${t}_unit`).stats).toEqual({ natUnit: i + 1 });
      expect(NATIONAL_UNITS[i].tag).toBe(tag);
      const given = CONTENT.focuses
        .filter((f) => f.tree === tag)
        .flatMap((f) => f.effects as Effect[])
        .filter((e) => e.kind === "add_spirit" && e.id === `nat_${t}_unit`);
      expect(given.length).toBeGreaterThan(0);
    });
  });

  test("Soviet Guards come through two focuses; Guards and Legion get the mountaineers tech", () => {
    const has = (id: string, kind: string, key: string, v: string) =>
      (CONTENT.focuses.find((f) => f.id === id)!.effects as Effect[]).some(
        (e) =>
          e.kind === kind &&
          (e as unknown as Record<string, unknown>)[key] === v,
      );
    for (const f of ["sun_guards", "sun_winter_war_lessons"]) {
      expect(has(f, "add_spirit", "id", "nat_sun_unit")).toBe(true);
      expect(has(f, "add_tech", "tech", "mountaineers")).toBe(true);
    }
    expect(
      has("fra_colonial_divisions", "add_tech", "tech", "mountaineers"),
    ).toBe(true);
    const guards = CONTENT.templates.find((t) => t.id === "sun_guards_rifle")!;
    expect(guards.battalions.filter((b) => b === "mountain")).toHaveLength(7);
    expect(guards.battalions.filter((b) => b === "artillery")).toHaveLength(3);
  });

  test("trims: mass mobilisation, light forces, assault spirit, lifeline", () => {
    expect(spirit("nat_sun_mass").stats.mioCostPct_infantry).toBe(-5);
    expect(spirit("nat_sun_mass").stats.mioCostPct_artillery).toBe(-5);
    expect(spirit("nat_ita_light_forces").stats.speedPct).toBeUndefined();
    expect(spirit("nat_jpn_assault").stats).toEqual({
      infAttackPct: 10,
      infOrg: 3,
    });
    expect(spirit("nat_gbr_lifeline").stats.convoyLossPct).toBe(-15);
    expect(spirit("nat_deu_panzer").stats.armorBrkPct).toBe(10);
  });

  test("American Marines land under a 25 % cut, other landings unchanged", () => {
    const none = new Set<never>();
    expect(landingBp(true, none, false, 0)).toBe(3500);
    expect(landingBp(true, none, false, 3)).toBe(2500);
    expect(landingBp(true, none, false, 7)).toBe(3500);
    expect(landingBp(false, none, false, 3)).toBe(7000);
    expect(TPL_MARINE_ANY).toBeGreaterThan(0);
  });

  test("Alpini pay 70 % of the fort and river penalty, other assault infantry 85 %", () => {
    const base: ModInput = {
      attacking: true,
      genAtt: 0,
      genDef: 0,
      traits: 0,
      flags: TPL_MOUNTAIN_MAJOR,
      tech: techTotals(new Set()),
      exp: 0,
      planBp: 0,
      river: 2,
      strait: false,
      fort: 3,
      entrench: 0,
      excessBp: 0,
      supplyPm: 1000,
      encircled: false,
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
    };
    const at = (n: number) =>
      divisionMods({ ...base, tech: { ...base.tech, natUnit: n } }).mods
        .attackBp;
    expect(at(7)).toBeGreaterThan(at(0));
    expect(at(2)).toBe(at(0));
  });

  test("British Commandos add 10 points to a commando raid, no other raid", () => {
    const i = {
      expLevel: 0,
      aa: 0,
      supPm: 0,
      enemyDivision: false,
      coastalFort: 0,
      bombers: 0,
    };
    expect(raidSuccessPm(1, { ...i, bonusPm: 100 })).toBe(
      raidSuccessPm(1, i) + 100,
    );
    expect(raidSuccessPm(0, { ...i, bonusPm: 100 })).toBe(raidSuccessPm(0, i));
  });
});
