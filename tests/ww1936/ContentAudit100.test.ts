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
  test.each([
    ["chn_central_army", "CHN", false],
    ["chn_expeditionary", "CHN", false],
    ["jpn_amphibious_arm", "JPN", true],
  ] as [string, CountryTag, boolean][])(
    "%s opens its template from the start techs",
    (id, tag, major) => {
      const f = CONTENT.focuses.find((x) => x.id === id)!;
      const techs = new Set<WwTechId>([
        ...startTechs(tag, 0),
        ...landStartTechs(tag, major, 0),
      ]);
      const templates: string[] = [];
      walk(f.effects, (x) => {
        if (x.kind === "add_tech") techs.add(x.tech as WwTechId);
        if (x.kind === "unlock_template") templates.push(x.template as string);
      });
      expect(templates.length).toBeGreaterThan(0);
      for (const t of templates) {
        const c = CONTENT.templates.find((x) => x.id === t)!;
        const def = { ...c, name: "" } as unknown as TemplateDef;
        expect(templateBlock(def, techs, Infinity)).toBeNull();
      }
    },
  );

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

  test("land under an AI democracy counts for demands where the loser lives on", () => {
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
      dem: [1, 2],
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
    // Zones of a loser who is gone: nothing to demand over.
    expect(peaceKept(facts, table, 9, free)).toEqual([]);
    expect(planPeaceDemand(facts, table, 5, demand, free)).toBe("no_target");
    // It lives on as the democracy's puppet on that land.
    const puppet = { ...table, demPuppets: [[9, 7]] as [number, number][] };
    expect(peaceKept(facts, puppet, 9, free)).toEqual([1, 2]);
    expect(typeof planPeaceDemand(facts, puppet, 5, demand, free)).toBe(
      "object",
    );
    // A bought puppet keeps it as well, and can be bought on it.
    const bought = planPeaceDemand(
      facts,
      table,
      5,
      { ...demand, kind: "puppet" },
      free,
    );
    expect(typeof bought).toBe("object");
  });

  test("coup resistance makes a coup harder: +30 % is 1.3 times", () => {
    expect(coupSuccessPm(650, 0)).toBe(650);
    expect(coupSuccessPm(650, 30)).toBe(500);
    expect(coupSuccessPm(650, 100)).toBe(325);
    expect(coupSuccessPm(650, -20)).toBe(650);
  });
});
