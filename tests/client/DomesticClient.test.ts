import { UnitType } from "@openfront/engine-api/game/GameTypes";
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
    });
    expect(view.pct("science")).toBe(30);
    expect(view.pct("troopRegen")).toBe(25);
    expect(view.hasTech("computers")).toBe(true);
    expect(view.hasTech("radar")).toBe(false);
    expect(view.recruitTargetPct()).toBe(60);
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
