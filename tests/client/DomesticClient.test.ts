import {
  Condition,
  STAT_KEYS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import {
  ALL_UNIT_TYPES,
  STRUCTURE_ATLAS_ORDER,
  STRUCTURE_TYPES,
  UT_ADMIN_OFFICE,
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

  test("agrees with the engine's PlayerDomestic on every stat", () => {
    const d = new PlayerDomestic();
    for (const tech of [
      "computers",
      "conscription",
      "printing_press",
    ] as const) {
      d.beginResearch(tech, 0);
      d.advanceResearch(10);
    }
    d.proclaimLaw("religion", "A", 0);
    d.proclaimLaw("mobilization", "A", 0);
    d.chooseGovernment("fascism", 0);
    d.setConditions(new Set<Condition>(["attacking", "troopsAtMostHalf"]));
    const view = new DomesticClientView(d.toData());
    for (const stat of STAT_KEYS) {
      expect(view.pct(stat), stat).toBe(d.pct(stat));
    }
  });
});

describe("domestic structures in the renderer", () => {
  test("render strings match the engine's unit types", () => {
    expect(UT_RESEARCH_INSTITUTE).toBe(UnitType.ResearchInstitute);
    expect(UT_ADMIN_OFFICE).toBe(UnitType.AdminOffice);
  });

  test("they are structures with icon-atlas columns of their own", () => {
    expect(STRUCTURE_TYPES.has(UT_RESEARCH_INSTITUTE)).toBe(true);
    expect(STRUCTURE_TYPES.has(UT_ADMIN_OFFICE)).toBe(true);
    expect(STRUCTURE_ATLAS_ORDER.indexOf(UT_RESEARCH_INSTITUTE)).toBe(6);
    expect(STRUCTURE_ATLAS_ORDER.indexOf(UT_ADMIN_OFFICE)).toBe(7);
    expect(ALL_UNIT_TYPES).toContain(UT_RESEARCH_INSTITUTE);
    expect(ALL_UNIT_TYPES).toContain(UT_ADMIN_OFFICE);
  });
});
