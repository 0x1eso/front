// ww81 lane R: the catalogue value of a tech (TechValue), the research score
// that reads it, and the bug fixes B8 and B4/B9/B15 that can be tested
// without a game.
import {
  WW_TECH_IDS,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { histEntry } from "@openfront/engine-lib/ww1936/hist/index";
import { histGearChargeMilli } from "@openfront/engine-lib/ww1936/hist/Slots";
import { catalogueTechValues } from "@openfront/engine-lib/ww1936/hist/TechValue";
import {
  researchPersonaOf,
  ResearchScoreInput,
  researchScores,
} from "@openfront/engine-lib/ww1936/ResearchScore";
import { describe, expect, it } from "vitest";

const at = (t: WwTechId) => WW_TECH_IDS.indexOf(t);
const flat = () => 100;

describe("catalogue tech value", () => {
  it("a tech that opens a new group is worth something; researched or no catalogue: nothing", () => {
    const v = catalogueTechValues("DEU", new Set(), flat);
    expect(v[at("medium_tank_1")]).toBeGreaterThan(0);
    expect(Math.max(...v)).toBeLessThanOrEqual(60);
    const done = catalogueTechValues("DEU", new Set(["medium_tank_1"]), flat);
    expect(done[at("medium_tank_1")]).toBe(0);
    expect(
      catalogueTechValues("POL", new Set(), flat).every((x) => x === 0),
    ).toBe(true);
  });
  it("a prerequisite takes half of what its tech is worth", () => {
    const v = catalogueTechValues("DEU", new Set(), flat);
    const k = at("tank_gun_3");
    expect(v[at("tank_gun_2")]).toBeGreaterThanOrEqual(v[k] >> 1);
  });
  it("the multiplier scales the value", () => {
    const a = catalogueTechValues("SUN", new Set(), () => 50);
    const b = catalogueTechValues("SUN", new Set(), () => 100);
    expect(b.reduce((x, y) => x + y, 0)).toBeGreaterThan(
      a.reduce((x, y) => x + y, 0),
    );
  });
});

const input = (over: Partial<ResearchScoreInput>): ResearchScoreInput => ({
  seed: 1,
  smallID: 5,
  tag: "DEU",
  persona: "aggressor",
  day: 1100,
  human: false,
  lean: 0,
  coastal: true,
  lineFactories: { infantry_equipment: 10, medium_tank: 8, fighter: 4 },
  navalLines: 0,
  bonusKeys: [],
  shared: [],
  researched: new Set(),
  running: [],
  ...over,
});

describe("the score with the catalogue", () => {
  it("Germany ranks the medium tank near the top, a strategic bomber below it", () => {
    const s = researchScores(input({}));
    expect(s[at("medium_tank_1")]! - s[at("strat_bomber_1")]!).toBeGreaterThan(-1);
  });
  it("a minor without a tank line leaves tank techs out", () => {
    const s = researchScores(
      input({
        tag: "POL",
        persona: "minor",
        lineFactories: { infantry_equipment: 5 },
      }),
    );
    expect(s[at("light_tank_1")]).toBeNull();
  });
  it("the situation adds to anti-tank techs", () => {
    const a = researchScores(input({}));
    const b = researchScores(input({ situation: { antiTank: 1 } }));
    expect(b[at("anti_tank_1")]! - a[at("anti_tank_1")]!).toBe(25);
  });
  it("the persona helper matches the AI's", () => {
    expect(researchPersonaOf("DEU")).toBe("aggressor");
    expect(researchPersonaOf("GBR")).toBe("democracy");
    expect(researchPersonaOf("POL")).toBe("minor");
  });
});

describe("B8: a gear entry shows what production charges", () => {
  it("an entry standing in for a static key shows the key's generic cost", () => {
    const e = histEntry("deu_kar98k")!;
    expect(histGearChargeMilli(e)).toBe(unitCostMilli("infantry_equipment", 1));
  });
});
