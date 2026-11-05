// ww90: the combat overhaul's fit. Rules are checked on the pure functions;
// the win table's targets come from `duel-fit.ts --plan` (the report has them).
import { COUNTRY_TAGS } from "@openfront/engine-api/ww1936/Countries";
import { KS, KS_FIELDS } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  BattalionId,
  DivisionStats,
  TPL_BARE_ARMOR,
  TPL_HEAVY_LEAD,
  TPL_TANK_FORCE,
} from "@openfront/engine-api/ww1936/LandTypes";
import {
  addToSide,
  ARMOR_FULL_PROTECT_FROM,
  armorProtectPm,
  bandProtectPm,
  BARE_ARMOR_ORG_PCT,
  BARE_DEFENCE_ATTACK_CUT_BP,
  defenderHardnessPm,
  defenderOrgPct,
  emptySide,
  ENTRENCH_DEF_BP,
  POSITION_DEF_BP,
  predictBattle,
  prepKeepPm,
  researchedArmor,
  sideFearPct,
  TANK_FEAR_PCT,
  winPctOf,
} from "@openfront/engine-lib/ww1936/CombatRules";
import { tankStatsOfEntry } from "@openfront/engine-lib/ww1936/hist/ConvertTank";
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import type { TankEntry } from "@openfront/engine-lib/ww1936/hist/Types";
import { startTemplates } from "@openfront/engine-lib/ww1936/LandStart";
import {
  presetById,
  presetDef,
  TEMPLATE_PRESETS,
} from "@openfront/engine-lib/ww1936/TemplatePresets";
import {
  GEN1,
  rowScore,
  STATIC_KEY_STATS,
  tankSpeedPm,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";
import { aiPickEntry } from "@openfront/engine/ww1936/depth/AiPick";
import {
  effortScore,
  pickMainSector,
} from "@openfront/engine/ww1936/land/AiEffort";
import { aiTrainPlan } from "@openfront/engine/ww1936/land/AiLand";
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

const side = (s: DivisionStats, n = 1) => {
  const sum = emptySide();
  for (let i = 0; i < n; i++) addToSide(sum, s, s.orgMilli);
  return sum;
};
const open = {
  land: "plains" as const,
  directions: 1,
  attackerAttackBp: 10_000,
  attackerBlockBp: 10_000,
  defenderAttackBp: 10_000,
  defenderBlockBp: 10_000,
};
const tanks = stats([
  ["medium_armor", 4],
  ["motorized", 5],
]);
const rifles = stats([["infantry", 9]]);
const bare = stats([["medium_armor", 9]]);

describe("the plan's armour", () => {
  test("tanks with their motorized are armour: the plan's 4 + 5 scares rifles", () => {
    expect(tanks.flags & TPL_TANK_FORCE).not.toBe(0);
    expect(rifles.flags & TPL_TANK_FORCE).toBe(0);
    expect(
      stats([
        ["infantry", 8],
        ["medium_armor", 1],
      ]).flags & TPL_TANK_FORCE,
    ).toBe(0);
    expect(sideFearPct(side(tanks), side(rifles), 0)).toBe(TANK_FEAR_PCT);
    // Guns that reach the armour: no fear.
    const guns = stats([
      ["infantry", 6],
      ["anti_tank", 2],
    ]);
    expect(sideFearPct(side(tanks), side(guns), 0)).toBe(0);
  });

  test("trenches stop infantry more than tanks, and heavy tanks least", () => {
    expect(prepKeepPm(rifles.flags, 0)).toBe(1000);
    expect(prepKeepPm(tanks.flags, 0)).toBe(600);
    const heavy = stats([
      ["heavy_armor", 4],
      ["motorized", 5],
    ]);
    expect(heavy.flags & TPL_HEAVY_LEAD).not.toBe(0);
    expect(prepKeepPm(heavy.flags, 0)).toBe(350);
  });

  test("the prediction reads the trench as the battle does", () => {
    const dug = {
      ...open,
      defenderBlockBp: 10_000 + 5 * ENTRENCH_DEF_BP,
      defenderPrepBp: 5 * ENTRENCH_DEF_BP,
    };
    const inf = stats([
      ["infantry", 7],
      ["artillery", 2],
    ]);
    const cut = (s: DivisionStats) =>
      predictBattle(side(s), side(rifles), dug).ratioPm /
      predictBattle(side(s), side(rifles), open).ratioPm;
    expect(cut(tanks)).toBeGreaterThan(cut(inf));
  });

  test("a level of position is worth a level of entrenchment", () => {
    expect(POSITION_DEF_BP).toBe(ENTRENCH_DEF_BP);
  });
});

describe("armour with no infantry", () => {
  test("it is reached at close quarters and fires less, defending only", () => {
    expect(bare.flags & TPL_BARE_ARMOR).not.toBe(0);
    expect(defenderHardnessPm(bare.hardnessPm, bare.flags)).toBe(
      Math.floor(bare.hardnessPm / 2),
    );
    expect(defenderHardnessPm(tanks.hardnessPm, tanks.flags)).toBe(
      tanks.hardnessPm,
    );
    expect(defenderOrgPct(bare.flags)).toBe(BARE_ARMOR_ORG_PCT);
    expect(BARE_DEFENCE_ATTACK_CUT_BP).toBe(6500);
  });

  test("the prediction turns rifles on bare tanks around, not on tanks with infantry", () => {
    expect(
      predictBattle(side(rifles), side(bare), open).ratioPm,
    ).toBeGreaterThan(1000);
    expect(predictBattle(side(rifles), side(tanks), open).ratioPm).toBeLessThan(
      500,
    );
    // Attacking it is as strong as ever.
    expect(
      predictBattle(side(bare), side(rifles), open).ratioPm,
    ).toBeGreaterThan(1000);
  });

  test("no preset or start template is armour with no infantry", () => {
    const zero = (d: Parameters<typeof templateStats>[0]) =>
      templateStats(d, ZERO, GEN1).flags & TPL_BARE_ARMOR;
    for (const p of TEMPLATE_PRESETS) expect(zero(presetDef(p))).toBe(0);
    for (const tag of COUNTRY_TAGS) {
      for (const dev of [1, 3, 4]) {
        for (const t of startTemplates(tag, dev)) expect(zero(t.def)).toBe(0);
      }
    }
  });

  test("the heavy preset really is led by heavy tanks", () => {
    const def = presetDef(presetById("pre_heavy_breakthrough")!);
    expect(templateStats(def, ZERO, GEN1).flags & TPL_HEAVY_LEAD).not.toBe(0);
  });
});

describe("the win table", () => {
  test("the even fight is near half and the curve climbs", () => {
    expect(winPctOf(1000)).toBe(46);
    expect(winPctOf(707)).toBe(10);
    expect(winPctOf(1414)).toBe(88);
    expect(winPctOf(2828)).toBe(100);
  });
});

describe("the tank score sees speed", () => {
  test("nothing lost at the motorized's pace, a little gained above it", () => {
    expect(tankSpeedPm(600)).toBe(1000);
    expect(tankSpeedPm(750)).toBe(1050);
    expect(tankSpeedPm(900)).toBe(1100);
    expect(tankSpeedPm(1500)).toBe(1100);
  });

  test("slow tanks pay, and under the infantry's pace dearly", () => {
    expect(tankSpeedPm(450)).toBe(750);
    expect(tankSpeedPm(400)).toBe(666);
    expect(tankSpeedPm(300)).toBe(375);
    // A Tortoise.
    expect(tankSpeedPm(180)).toBe(135);
  });

  test("a row with no speed (the screens') stands as it is", () => {
    expect(tankSpeedPm(0)).toBe(1000);
  });
});

describe("the catalogue's slow giants", () => {
  /** The AI's pick among a country's tank destroyers, every one unlocked, nothing to fear. */
  const pick = (tag: "DEU" | "GBR" | "USA") => {
    const list = histOwn(tag, "tank")
      .filter((e) => e.family === "tank" && e.role === "td")
      .map((e, i) => {
        const s = tankStatsOfEntry(e as TankEntry);
        const row = new Int32Array(KS_FIELDS);
        row[KS.soft] = s.soft;
        row[KS.hard] = s.hard;
        row[KS.def] = s.def;
        row[KS.brk] = s.brk;
        row[KS.pierce] = s.pierce;
        row[KS.armor] = s.armor;
        row[KS.speedCenti] = s.speedCenti;
        return {
          key: i,
          id: e.id,
          score: rowScore(row, 0, s.group, s.year),
          cost: s.costMilli,
          relPm: s.relPm,
        };
      });
    return list[aiPickEntry(list, 50)].id;
  };

  test("the AI leaves Jagdtiger, Tortoise and T28 alone", () => {
    expect(pick("DEU")).not.toBe("deu_jagdtiger");
    expect(pick("DEU")).not.toBe("deu_elefant");
    expect(pick("GBR")).not.toBe("gbr_tortoise");
    expect(pick("USA")).not.toBe("usa_t28");
  });
});

describe("the main effort and forts", () => {
  const r = (region: number, fort: number) => ({
    region,
    vp: 5,
    capital: false,
    fort,
    width: 90,
    defence: 100,
    extra: 0,
  });

  test("heavy tanks and assault infantry count a fort for less", () => {
    expect(effortScore(r(1, 3), true)).toBeGreaterThan(effortScore(r(1, 3)));
    expect(effortScore(r(1, 0), true)).toBe(effortScore(r(1, 0)));
  });

  test("and they don't leave out a level 4 fort worth the most", () => {
    const rich = { ...r(1, 4), vp: 60 };
    const list = [rich, r(2, 0)];
    expect(pickMainSector(list, 0)).toBe(2);
    expect(pickMainSector(list, 0, 0, true)).toBe(1);
  });
});

describe("the AI trains for the new rules", () => {
  const input = {
    personality: "aggressor" as const,
    major: true,
    dev: 5,
    hasArmorTech: false,
    hasAssault: false,
    training: 9,
    manpower: 1_000_000,
    counts: { infantry: 30, armor: 0, motorized: 0, mountain: 0, cavalry: 0 },
    templates: [
      { id: 1, key: "infantry", men: 10_000, fillPm: 1000, have: 27 },
      {
        id: 2,
        key: "pre_artillery_div",
        men: 10_000,
        fillPm: 1000,
        have: 3,
      },
    ],
  };

  test("a line that means to attack brings guns", () => {
    expect(aiTrainPlan(input)).toEqual([1]);
    expect(aiTrainPlan({ ...input, gunPct: 10 })).toEqual([1]);
    expect(aiTrainPlan({ ...input, gunPct: 15 })).toEqual([2]);
  });

  test("assault infantry needs the research, not mountains", () => {
    const assault = {
      ...input,
      hasAssault: true,
      templates: [
        input.templates[0],
        { id: 3, key: "mountain", men: 10_000, fillPm: 1000, have: 0 },
      ],
    };
    expect(aiTrainPlan(assault)).toEqual([3]);
    expect(aiTrainPlan({ ...assault, hasAssault: false })).toEqual([1]);
    expect(
      aiTrainPlan({ ...assault, personality: "democracy" as const }),
    ).toEqual([3]);
  });

  test("forts ahead: heavy tanks weigh more among the armour", () => {
    const armour = {
      ...input,
      hasArmorTech: true,
      counts: { infantry: 30, armor: 4, motorized: 3, mountain: 0, cavalry: 0 },
      templates: [
        input.templates[0],
        {
          id: 4,
          key: "pre_medium_armored",
          men: 10_000,
          fillPm: 1000,
          have: 2,
        },
        {
          id: 5,
          key: "pre_heavy_breakthrough",
          men: 10_000,
          fillPm: 1000,
          have: 1,
        },
      ],
    };
    expect(aiTrainPlan(armour)).toEqual([4]);
    expect(aiTrainPlan({ ...armour, fortsAhead: true })).toEqual([5]);
  });
});
