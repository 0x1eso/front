// Research overhaul, phase 2: every new tech effect changes a result.
import { WW_TECH_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { BattalionId } from "@openfront/engine-api/ww1936/LandTypes";
import { divisionMods } from "@openfront/engine-lib/ww1936/CombatRules";
import {
  PLANE_BASE_DEFS,
  PLANE_MODULE_DEFS,
  SHIP_MODULE_DEFS,
  TANK_BASE_DEFS,
  TANK_MODULE_DEFS,
} from "@openfront/engine-lib/ww1936/DesignRules";
import { techStats } from "@openfront/engine-lib/ww1936/Stats";
import {
  GEN1,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals, WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
const ZERO = techTotals(new Set());
const tpl = (bats: BattalionId[]) => ({
  name: "t",
  battalions: bats,
  support: [],
});
const stats = (bats: BattalionId[], over: Record<string, number>) =>
  templateStats(tpl(bats), { ...ZERO, ...over } as never, GEN1);

describe("unread stat keys now change a division", () => {
  const cases: [string, BattalionId[], string][] = [
    ["infAttackPct", ["infantry"], "soft"],
    ["infDefensePct", ["infantry"], "def"],
    ["infHardPct", ["infantry"], "hard"],
    ["motSpeedPct", ["motorized"], "speedCenti"],
    ["motOrg", ["motorized"], "orgMilli"],
    ["artSpeedPct", ["artillery"], "speedCenti"],
    ["atPiercePct", ["anti_tank"], "pierce"],
    ["atHardPct", ["anti_tank"], "hard"],
    ["armorArmorPct", ["medium_armor"], "armor"],
    ["armorBrkPct", ["medium_armor"], "brk"],
  ];
  for (const [k, bats, field] of cases) {
    it(k, () => {
      const a = stats(bats, {}) as never as Record<string, number>;
      const b = stats(bats, { [k]: 20 }) as never as Record<string, number>;
      expect(b[field], k).toBeGreaterThan(a[field]);
    });
  }

  it("reconPct raises the recon company's bonus", () => {
    const inf = tpl(["infantry", "infantry"]);
    const flags = templateStats(
      { ...inf, support: ["recon"] },
      ZERO,
      GEN1,
    ).flags;
    const mods = (reconPct: number) =>
      divisionMods({ ...NEUTRAL, flags, tech: { ...ZERO, reconPct } as never })
        .mods.attackBp;
    expect(mods(20)).toBeGreaterThan(mods(0));
  });

  it("the techs carry the keys", () => {
    const t = techStats(
      techTotals(
        new Set(["inf_imp_1", "inf_at_1", "art_towing", "at_imp_1"] as never),
      ),
    );
    expect(t.infAttackPct).toBe(3);
    expect(t.infHardPct).toBe(15);
    expect(t.artSpeedPct).toBe(10);
    expect(t.atPiercePct).toBe(10);
  });
});

// The neutral modifier input of LandRules.test, trimmed to what divisionMods reads.
const NEUTRAL = {
  attacking: true,
  genAtt: 0,
  genDef: 0,
  traits: 0,
  flags: 0,
  tech: ZERO,
  exp: 0,
  planBp: 0,
  land: "plains",
  weather: "clear",
  river: 0,
  strait: false,
  fort: 0,
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
} as never as Parameters<typeof divisionMods>[0];

describe("designer parts", () => {
  it("every tech design part is in the designer tables behind its own tech", () => {
    let n = 0;
    for (const id of WW_TECH_IDS) {
      const d = WW_TECHS[id].design;
      if (d === undefined) continue;
      n++;
      const table =
        d.designer === "tank"
          ? d.part === "chassis"
            ? TANK_BASE_DEFS
            : TANK_MODULE_DEFS
          : d.designer === "ship"
            ? SHIP_MODULE_DEFS
            : d.part === "chassis"
              ? PLANE_BASE_DEFS
              : PLANE_MODULE_DEFS;
      const def = (table as Record<string, { tech?: string }>)[d.id];
      expect(def, `${id} -> ${d.id}`).toBeDefined();
      expect(def.tech, id).toBe(id);
    }
    expect(n).toBe(11);
  });
});
