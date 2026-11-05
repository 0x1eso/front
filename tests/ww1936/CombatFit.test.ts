// ww90: the combat overhaul's fit. Rules are checked on the pure functions;
// the win table's targets come from `duel-fit.ts --plan` (the report has them).
import { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";
import {
  ARMOR_FULL_PROTECT_FROM,
  armorProtectPm,
  bandProtectPm,
  researchedArmor,
} from "@openfront/engine-lib/ww1936/CombatRules";
import {
  GEN1,
  STATIC_KEY_STATS,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { describe, expect, test } from "vitest";

const ZERO = techTotals(new Set());
const stats = (
  list: readonly (readonly [BattalionId, number])[],
  tech = ZERO,
) =>
  templateStats(
    {
      name: "t",
      battalions: list.flatMap(([id, n]) => new Array<BattalionId>(n).fill(id)),
      support: [],
    },
    tech,
    GEN1,
    STATIC_KEY_STATS,
  );

describe("rifles against light vehicles", () => {
  test("85 % starts at armour 20; under it the most is 50 %", () => {
    expect(ARMOR_FULL_PROTECT_FROM).toBe(2000);
    // Rifles (pierce 4) on a Pz I or armoured car (13) and a Pz III (30).
    expect(armorProtectPm(1300, 400)).toBe(500);
    expect(armorProtectPm(1999, 400)).toBe(500);
    expect(armorProtectPm(2000, 400)).toBe(850);
    expect(armorProtectPm(3000, 400)).toBe(850);
  });

  test("the fall to nothing at equal pierce is the same on either side of the line", () => {
    expect(armorProtectPm(1200, 800)).toBe(500);
    expect(armorProtectPm(1200, 1000)).toBe(250);
    expect(armorProtectPm(1200, 1200)).toBe(0);
    expect(armorProtectPm(3000, 2500)).toBe(250);
  });

  test("a division's bands read it too", () => {
    const rifles = stats([["infantry", 9]]);
    expect(bandProtectPm(rifles.bandPierce, rifles.bandHard, 1300)).toBe(500);
    expect(bandProtectPm(rifles.bandPierce, rifles.bandHard, 3000)).toBe(850);
  });

  test("armour research counts half only if it would lift a light vehicle over the line", () => {
    expect(researchedArmor(1300, 20)).toBe(1560);
    expect(researchedArmor(1800, 10)).toBe(1980);
    expect(researchedArmor(1800, 20)).toBe(1980);
    expect(researchedArmor(2000, 20)).toBe(2400);
    expect(researchedArmor(3000, 20)).toBe(3600);
  });

  test("a template's armour goes through it", () => {
    const plate = { ...ZERO, armorArmorPct: 100 } as typeof ZERO;
    // Generation 1 light tanks are armour 10: +100 % is 20, so half of it.
    expect(stats([["light_armor", 9]]).armor).toBe(1000);
    expect(stats([["light_armor", 9]], plate).armor).toBe(1500);
    // Medium tanks are over the line anyway.
    expect(stats([["medium_armor", 9]], plate).armor).toBe(8000);
  });
});
