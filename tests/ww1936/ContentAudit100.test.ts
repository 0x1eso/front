// ww100 audit: rewards that look given but do nothing. A template the focus
// opens is refused without its techs, and a research bonus on a branch with
// no live tech sits in the country's five bonus places for good. And the
// owner's list: focus templates' roles, coup resistance, a puppet's demands.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { TemplateDef } from "@openfront/engine-api/ww1936/LandTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { startTechs } from "@openfront/engine-lib/ww1936/EconomyStart";
import { coupSuccessPm } from "@openfront/engine-lib/ww1936/IntelRules";
import { landStartTechs } from "@openfront/engine-lib/ww1936/LandStart";
import {
  peaceKept,
  planPeaceDemand,
} from "@openfront/engine-lib/ww1936/PeaceRules";
import { templateBlock } from "@openfront/engine-lib/ww1936/TemplateStats";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import {
  aiTrainPlan,
  roleOfTemplate,
} from "@openfront/engine/ww1936/land/AiLand";

function walk(o: unknown, see: (x: Record<string, unknown>) => void): void {
  if (o === null || typeof o !== "object") return;
  see(o as Record<string, unknown>);
  for (const v of Object.values(o)) walk(v, see);
}

describe("ww100: rewards that do what they say", () => {
  test("ww107: no focus gives a division template", () => {
    const given: string[] = [];
    walk(CONTENT.focuses, (x) => {
      if (x.kind === "unlock_template") given.push(x.template as string);
    });
    expect(given).toEqual([]);
  });

  test("ww107: every focus the template grant left still does something", () => {
    const empty = CONTENT.focuses
      .filter((f) => f.effects.length === 0)
      .map((f) => f.id)
      .sort();
    // Two that had no effect before it either.
    expect(empty).toEqual(["pol_zaolzie", "tur_hatay"]);
  });

  test("every research bonus names a branch with a live tech", () => {
    const live = new Set(
      Object.values(WW_TECHS)
        .filter((t) => t.retired !== true)
        .map((t) => t.branch as string),
    );
    const dead: string[] = [];
    for (const list of [CONTENT.focuses, CONTENT.events, CONTENT.decisions]) {
      walk(list, (x) => {
        if (x.kind !== "research_bonus" || x.branch === undefined) return;
        if (!live.has(x.branch as string)) dead.push(x.branch as string);
      });
    }
    expect(dead).toEqual([]);
  });

  test("the AI reads a focus template's role off what it is made of", () => {
    for (const [key, role] of [
      ["deu_panzer_ii", "armor"],
      ["sun_tank_division", "armor"],
      ["gbr_motor_div", "motorized"],
      ["ita_motorised_division", "motorized"],
      ["pol_armored_cavalry", "cavalry"],
      ["usa_marine_division", "mountain"],
      ["nor_ski_division", "mountain"],
      ["usa_infantry_ii", "infantry"],
    ] as const) {
      expect(roleOfTemplate(key), key).toBe(role);
    }
  });

  test("the AI trains a focus armour division, and shares the line with a focus infantry one", () => {
    const tpl = (id: number, key: string, have = 0) => ({
      id,
      key,
      have,
      men: 9000,
      fillPm: 1000,
    });
    const base = {
      personality: "aggressor" as const,
      major: true,
      dev: 5,
      hasArmorTech: true,
      hasAssault: false,
      training: 0,
      manpower: 10_000_000,
    };
    const armour = aiTrainPlan({
      ...base,
      counts: { infantry: 40, armor: 0, motorized: 0, mountain: 0, cavalry: 0 },
      templates: [tpl(1, "infantry", 40), tpl(2, "deu_panzer_ii")],
    });
    expect(armour).toContain(2);
    const line = aiTrainPlan({
      ...base,
      counts: { infantry: 1, armor: 9, motorized: 9, mountain: 9, cavalry: 9 },
      templates: [
        tpl(1, "infantry", 10),
        tpl(2, "usa_infantry_ii"),
        tpl(3, "jpn_garrison_ii"),
      ],
    });
    expect(line).toContain(2);
    expect(line).not.toContain(3);
  });

  test("land assigned to a winner is no land the loser keeps", () => {
    const facts = {
      controller: () => 7,
      legalOwner: () => 9,
      hasCore: () => false,
      neighbours: () => [],
      regionCivs: () => 8,
      ledFactionSize: () => 0,
      ships: () => [],
    };
    const table = {
      stake: [1, 2],
      base: [10, 10],
      losers: [9],
      parts: [{ id: 5 }, { id: 7 }],
      claims: [],
      conquer: [],
      topple: [],
      settled: [],
      assign: [
        [1, 7],
        [2, 7],
      ] as [number, number][],
    };
    const free = () => true;
    const demand = {
      kind: "reparations" as const,
      regions: [],
      target: 9,
      beneficiary: 0,
      k: 1,
      pct: 0,
    };
    // A loser with nothing left: nothing to demand over.
    expect(peaceKept(facts, table, 9, free)).toEqual([]);
    expect(planPeaceDemand(facts, table, 5, demand, free)).toBe("no_target");
    // The winner it went to can make it a puppet on that land; another can't.
    const puppet = { ...demand, kind: "puppet" as const };
    expect(typeof planPeaceDemand(facts, table, 7, puppet, free)).toBe(
      "object",
    );
    expect(planPeaceDemand(facts, table, 5, puppet, free)).toBe("no_target");
  });

  test("coup resistance makes a coup harder: +30 % is 1.3 times", () => {
    expect(coupSuccessPm(650, 0)).toBe(650);
    expect(coupSuccessPm(650, 30)).toBe(500);
    expect(coupSuccessPm(650, 100)).toBe(325);
    expect(coupSuccessPm(650, -20)).toBe(650);
  });
});
