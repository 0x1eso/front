// World War 1936 P4 (plan Task 1 Step 25): air rules (spec §12.2, §13.3, §14).
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  aaLossPm,
  agilityFactorPm,
  airDeployBlock,
  airLossesMilli,
  airMoveFactorPm,
  airPenaltyBp,
  bombDamageMilli,
  casPoolCenti,
  casRoundHits,
  DeployAsk,
  detectionPm,
  rangeEffPm,
  sortieEffPm,
} from "@openfront/engine-lib/ww1936/AirRules";
import {
  planeGenTechs,
  planeStats,
} from "@openfront/engine-lib/ww1936/PlaneStats";
import { emptyStats, techStats } from "@openfront/engine-lib/ww1936/Stats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";

const Z = emptyStats();
const none = new Set<never>();
/** The stats a doctrine tech feeds (its bonuses are stat keys: P6 pre-flight). */
const doc = (...ids: WwTechId[]) => techStats(techTotals(new Set(ids)));

describe("air rules", () => {
  it("plane stats", () => {
    const f1 = planeStats("fighter", 1, Z, none);
    expect(f1.airAtk).toBe(1800);
    expect(f1.airDef).toBe(1200);
    expect(f1.supWeightMilli).toBe(1000);
    expect(f1.fuelPerSortieMilli).toBe(200);
    const f2 = planeStats("fighter", 2, Z, none);
    expect(f2.airAtk).toBe(2340);
    expect(f2.speedKmh).toBe(530);
    expect(f2.rangeKm).toBe(780);
    // Doctrines as stat keys (P6 pre-flight): the tech alone does nothing.
    expect(
      planeStats("fighter", 1, Z, new Set(["strategic_destruction_1"] as const))
        .airAtk,
    ).toBe(1800);
    expect(
      planeStats("fighter", 1, doc("strategic_destruction_1"), none).airAtk,
    ).toBe(1890);
    expect(
      planeStats("naval_bomber", 1, doc("base_strike_2"), none).naval,
    ).toBe((planeStats("naval_bomber", 1, Z, none).naval * 115) / 100);
    expect(
      planeStats("fighter", 1, doc("operational_integrity_1"), none).agility,
    ).toBe(Math.floor((planeStats("fighter", 1, Z, none).agility * 110) / 100));
    expect(planeStats("cas", 1, Z, none).supWeightMilli).toBe(100);
    expect(planeGenTechs("cv_fighter", 2)).toEqual([
      "carrier_aviation",
      "fighter_2",
    ]);
    expect(planeGenTechs("heavy_fighter", 1)).toEqual(["heavy_fighter_1"]);
  });

  it("air combat losses (spec §14.3: 500 against 500, detection 300 → 8 a day)", () => {
    expect(airLossesMilli(900_000, 300, 1200)).toBe(8035);
    expect(airLossesMilli(900_000, 300, 0)).toBe(0);
  });

  it("range and sorties", () => {
    expect(rangeEffPm(325, 650)).toBe(1000);
    expect(rangeEffPm(650, 650)).toBe(750);
    expect(rangeEffPm(651, 650)).toBe(0);
    expect(rangeEffPm(487, 650)).toBe(876);
    expect(sortieEffPm(1000, 1000, 1000, 0, null)).toBe(1000);
    expect(sortieEffPm(800, 1000, 750, 0, null)).toBe(600);
    expect(sortieEffPm(800, 1000, 750, 0, 0)).toBe(180);
    expect(sortieEffPm(800, 1000, 750, 0, 1000)).toBe(600);
  });

  it("detection and agility", () => {
    expect(detectionPm(0, false, 0, 0)).toBe(300);
    expect(detectionPm(300, true, 0, 0)).toBe(700);
    expect(detectionPm(800, true, 10, 0)).toBe(1000);
    expect(agilityFactorPm(50, 20)).toBe(1300);
    expect(agilityFactorPm(10, 50)).toBe(600);
    expect(agilityFactorPm(0, 100)).toBe(500);
  });

  it("the land war's penalty and movement (spec §14.6)", () => {
    expect(airPenaltyBp(1000, 0)).toBe(-3500);
    expect(airPenaltyBp(500, 0)).toBe(0);
    expect(airPenaltyBp(750, 0)).toBe(-1750);
    expect(airPenaltyBp(1000, 20)).toBe(-2450);
    expect(airPenaltyBp(1000, 100)).toBe(-1050);
    expect(airMoveFactorPm(1000)).toBe(700);
  });

  it("close air support and bombing", () => {
    // 100 1936 CAS planes: 360 hits a day.
    expect(casPoolCenti(100_000, 1200, 0)).toBe(36_000);
    expect(casRoundHits(36_000)).toBe(2624);
    expect(bombDamageMilli(4000, 0, 0)).toBe(1000);
    expect(bombDamageMilli(4000, 5, 0)).toBe(600);
    expect(bombDamageMilli(4000, 10, 0)).toBe(600);
    expect(bombDamageMilli(4000, 0, -15)).toBe(850);
    expect(aaLossPm(2, 0, 0, false)).toBe(6);
    expect(aaLossPm(0, 400, 0, true)).toBe(4);
  });

  it("the deployment's refusals", () => {
    const ok: DeployAsk = {
      sr: 1001,
      srKind: "sea",
      type: "naval_bomber",
      mission: "naval_patrol",
      count: 50,
      have: 100,
      deploymentsUsed: 0,
      anyBaseInRange: true,
    };
    expect(airDeployBlock(ok)).toBeNull();
    expect(airDeployBlock({ ...ok, type: "cas", mission: "cas" })).toBe(
      "bad_air_mission",
    );
    expect(
      airDeployBlock({
        ...ok,
        srKind: "land",
        type: "fighter",
        mission: "strategic_bombing",
      }),
    ).toBe("bad_air_mission");
    expect(airDeployBlock({ ...ok, deploymentsUsed: 200 })).toBe(
      "too_many_deployments",
    );
    expect(airDeployBlock({ ...ok, anyBaseInRange: false })).toBe(
      "no_air_base",
    );
    expect(airDeployBlock({ ...ok, count: 101 })).toBe("no_planes");
  });
});
