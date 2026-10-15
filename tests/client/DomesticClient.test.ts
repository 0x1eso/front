import {
  Condition,
  GovernmentId,
  STAT_KEYS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import {
  ALL_UNIT_TYPES,
  STRUCTURE_ICON_ALIAS,
  STRUCTURE_TYPES,
  UT_ADMIN_OFFICE,
  UT_CITY,
  UT_DEFENSE_POST,
  UT_RESEARCH_INSTITUTE,
} from "../../src/client/render/types/UnitType";
import { DomesticClientView } from "../../src/client/view/DomesticClientView";

describe("DomesticClientView", () => {
  test("derives modifiers and techs from the wire data", () => {
    const view = new DomesticClientView({
      science: 0,
      political: 0,
      cumulativeScience: 0,
      cumulativePolitical: 0,
      sciencePerSec: 0,
      politicalPerSec: 0,
      techs: ["computers", "conscription"],
      research: null,
      recruitTargetPct: 60,
      laws: {},
      lawCooldownUntilTick: 0,
      governmentTier: 0,
      government: "chiefdom",
      conditions: [],
    });
    expect(view.pct("science")).toBe(30);
    expect(view.pct("troopRegen")).toBe(25);
    expect(view.hasTech("computers")).toBe(true);
    expect(view.hasTech("radar")).toBe(false);
    expect(view.recruitTargetPct()).toBe(60);
  });

  test("applies laws, the government and the active conditions", () => {
    const view = new DomesticClientView({
      science: 0,
      political: 0,
      cumulativeScience: 0,
      cumulativePolitical: 0,
      sciencePerSec: 0,
      politicalPerSec: 0,
      techs: [],
      research: null,
      recruitTargetPct: 100,
      laws: { trade: "A" },
      lawCooldownUntilTick: 0,
      governmentTier: 2,
      government: "democracy",
      conditions: ["attacking"],
    });
    expect(view.pct("trade")).toBe(40);
    expect(view.pct("political")).toBe(-50);
    expect(view.pct("goldIncome")).toBe(30);
    expect(view.laws().get("trade")).toBe("A");
  });

  test("pct matches the engine's for the same techs, laws, government and conditions", () => {
    const cases: [GovernmentId, Condition[]][] = [
      ["fascism", ["attacking", "troopsAtMostHalf"]],
      ["fascism", ["notAttacking"]],
      ["democracy", ["attacking"]],
      ["democracy", []],
    ];
    for (const [government, conditions] of cases) {
      const d = new PlayerDomestic();
      for (const tech of ["computers", "conscription"] as const) {
        d.beginResearch(tech, 0);
        d.advanceResearch(1);
      }
      // Proclaimed out of LAW_IDS order: the view rebuilds them in that order.
      d.proclaimLaw("religion", "A", 0);
      d.proclaimLaw("mobilization", "A", 0);
      d.proclaimLaw("taxation", "A", 0);
      d.chooseGovernment(government, 0);
      d.setConditions(new Set(conditions));
      const view = new DomesticClientView(d.toData());
      const engine = STAT_KEYS.map((stat) => [stat, d.pct(stat)]);
      const client = STAT_KEYS.map((stat) => [stat, view.pct(stat)]);
      expect(client).toEqual(engine);
    }
    // The conditional modifiers are in play: conscription +25, fascism +30
    // and total mobilization +100 while troops are at most half.
    const d = new PlayerDomestic();
    d.beginResearch("conscription", 0);
    d.advanceResearch(1);
    d.proclaimLaw("mobilization", "A", 0);
    d.chooseGovernment("fascism", 0);
    d.setConditions(new Set<Condition>(["attacking", "troopsAtMostHalf"]));
    const view = new DomesticClientView(d.toData());
    expect(d.pct("troopRegen")).toBe(155);
    expect(view.pct("troopRegen")).toBe(155);
    expect(view.pct("goldIncome")).toBe(30);
    expect(view.researchedTechs().has("conscription")).toBe(true);
  });
});

describe("domestic structures in the renderer", () => {
  test("render strings match the engine's unit types", () => {
    expect(UT_RESEARCH_INSTITUTE).toBe(UnitType.ResearchInstitute);
    expect(UT_ADMIN_OFFICE).toBe(UnitType.AdminOffice);
  });

  test("they are structures drawn with a borrowed atlas icon", () => {
    expect(STRUCTURE_TYPES.has(UT_RESEARCH_INSTITUTE)).toBe(true);
    expect(STRUCTURE_TYPES.has(UT_ADMIN_OFFICE)).toBe(true);
    expect(STRUCTURE_ICON_ALIAS[UT_RESEARCH_INSTITUTE]).toBe(UT_CITY);
    expect(STRUCTURE_ICON_ALIAS[UT_ADMIN_OFFICE]).toBe(UT_DEFENSE_POST);
    expect(ALL_UNIT_TYPES).toContain(UT_RESEARCH_INSTITUTE);
    expect(ALL_UNIT_TYPES).toContain(UT_ADMIN_OFFICE);
  });
});
