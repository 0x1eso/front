// World War 1936 P4 (plan Task 9 Step 8): bomb damage repairs (P4 spec
// §14.8) on the test map ww1936sea, France played by a human.
import {
  BUILDING_IDS,
  BuildingId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  projectSpeedPct,
  repairCrewMilli,
  repairProgress,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  buildingIndex,
  damageBuilding,
  effectiveBuildings,
  repairBuilding,
} from "@openfront/engine/ww1936/economy/Buildings";
import {
  buildingSpeedPct,
  queueBuild,
} from "@openfront/engine/ww1936/economy/Construction";
import {
  areaCrewOf,
  REPAIR_ORDER,
  repairCostMilli,
  stepRepairs,
} from "@openfront/engine/ww1936/economy/Repairs";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, stepTo, takeRegion, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const FRA = TAG_ID.FRA;

function settleAt(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (FRA % 7) + 1);
}

async function france() {
  const runner = await wwRunner(
    {},
    [{ clientID: HUMAN, country: "FRA" }],
    SEA.map,
  );
  const econ = runner.game.worldWar()!.economy;
  const ce = econ.country(FRA)!;
  const cell = (r: number, b: BuildingId) =>
    r * BUILDING_IDS.length + buildingIndex(b);
  const speedOf = (r: number, b: BuildingId) =>
    projectSpeedPct({
      building: b,
      infra: econ.infraEff[r],
      tech: ce.stats,
      law: ce.law(),
      buildingPct: buildingSpeedPct(ce, b),
    });
  return { runner, econ, ce, cell, speedOf };
}

describe("World War 1936 P4: bomb damage repairs (spec §14.8)", () => {
  test("a crew mends at 30% of the cost, the progress rolling on", async () => {
    const { econ, ce, cell, speedOf } = await france();
    const paris = REGION.paris;
    econ.addBuilding(paris, "civ", 30);
    damageBuilding(econ, paris, "civ", 2500);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(33);
    // 30% of a building per 1,000 of damage.
    expect(repairCostMilli("civ", 1000)).toBe(3_240_000);
    expect(repairCostMilli("civ", 500)).toBe(1_620_000);
    const i = cell(paris, "civ");
    const crew = areaCrewOf(econ, FRA, paris);
    stepRepairs(econ, ce, 0);
    const day = repairProgress(Math.min(15_000, crew), speedOf(paris, "civ"));
    expect(econ.repair[i]).toBe(day);
    expect(econ.damage[i]).toBe(2500);
    // The cost reached: the top 1,000 is mended, the rest rolls on.
    econ.repair[i] = repairCostMilli("civ", 1000) - 1;
    stepRepairs(econ, ce, 0);
    expect(econ.damage[i]).toBe(1500);
    expect(econ.repair[i]).toBe(day - 1);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(34);
    // The next 1,000, then the last 500 at half the cost.
    econ.repair[i] = repairCostMilli("civ", 1000) + repairCostMilli("civ", 500);
    stepRepairs(econ, ce, 0);
    expect(econ.damage[i]).toBe(0);
    expect(econ.repair[i]).toBe(0);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(35);
  });

  test("T1: an area with no civilian factory has a crew of 2", async () => {
    const { runner, econ, ce, cell, speedOf } = await france();
    const paris = REGION.paris;
    for (const r of econ.regionsOf(FRA)) econ.civ[r] = 0;
    econ.mil[paris] = 20;
    damageBuilding(econ, paris, "mil", 1000);
    expect(areaCrewOf(econ, FRA, paris)).toBe(2000);
    stepRepairs(econ, ce, 0);
    expect(econ.repair[cell(paris, "mil")]).toBe(
      repairProgress(2000, speedOf(paris, "mil")),
    );
    // And the country's day does it too, its one factory on the queue's floor.
    settleAt(runner, 0);
    expect(ce.totals.civ).toBe(0);
    expect(econ.repair[cell(paris, "mil")]).toBeGreaterThan(
      repairProgress(2000, speedOf(paris, "mil")),
    );
    // Half a factory for each one that works.
    expect(repairCrewMilli(12)).toBe(8000);
  });

  test("T3: the queue loses nothing, repairs get what it leaves", async () => {
    const { runner, econ, ce, cell, speedOf } = await france();
    const paris = REGION.paris;
    econ.addBuilding(paris, "civ", 30);
    damageBuilding(econ, paris, "civ", 2500);
    expect(queueBuild(econ, ce, REGION.lyon, "infra", 1)).toBeNull();
    const crew = areaCrewOf(econ, FRA, paris);
    settleAt(runner, 0);
    const free = ce.totals.freeCivMilli;
    expect(free).toBeGreaterThan(15_000);
    expect(ce.queue[0].lastAssigned).toBe(15_000);
    expect(econ.repair[cell(paris, "civ")]).toBe(
      repairProgress(
        Math.min(15_000, crew + free - 15_000),
        speedOf(paris, "civ"),
      ),
    );
  });

  test("T3: the railway comes before the factories, whatever the id", async () => {
    const { econ, ce, cell } = await france();
    const paris = REGION.paris;
    econ.addBuilding(paris, "rail", 3);
    damageBuilding(econ, paris, "civ", 1000);
    damageBuilding(econ, paris, "rail", 1000);
    expect(REPAIR_ORDER.slice(0, 4).map((bi) => BUILDING_IDS[bi])).toEqual([
      "rail",
      "power_plant",
      "dam",
      "civ",
    ]);
    // A crew under 15 factories: all of it on the railway.
    expect(areaCrewOf(econ, FRA, paris)).toBeLessThan(15_000);
    stepRepairs(econ, ce, 0);
    expect(econ.repair[cell(paris, "rail")]).toBeGreaterThan(0);
    expect(econ.repair[cell(paris, "civ")]).toBe(0);
  });

  test("the damaged cells follow the damage, and a restore rebuilds them", async () => {
    const { econ } = await france();
    const { paris, lyon } = REGION;
    // One bit a building, in an Int32Array.
    expect(BUILDING_IDS.length).toBeLessThanOrEqual(31);
    expect(econ.damagedRegions).toBe(0);
    damageBuilding(econ, paris, "civ", 1000);
    damageBuilding(econ, paris, "mil", 500);
    damageBuilding(econ, lyon, "civ", 1000);
    expect(econ.damagedRegions).toBe(2);
    const civBit = 1 << buildingIndex("civ");
    const milBit = 1 << buildingIndex("mil");
    expect(econ.damagedBits[paris]).toBe(civBit | milBit);
    repairBuilding(econ, paris, "civ", 1000);
    expect(econ.damagedBits[paris]).toBe(milBit);
    // A building torn down takes its damage with it.
    econ.addBuilding(lyon, "civ", -econ.civ[lyon]);
    expect(econ.damagedBits[lyon]).toBe(0);
    expect(econ.damagedRegions).toBe(1);
    const snap = econ.snapshot();
    econ.damagedBits.fill(0);
    econ.damagedRegions = 0;
    econ.restoreState(snap);
    expect(econ.damagedBits[paris]).toBe(milBit);
    expect(econ.damagedRegions).toBe(1);
  });

  test("what the queue leaves goes to the worst-hit area alone", async () => {
    const { runner, econ, ce, cell, speedOf } = await france();
    const { lyon, warsaw } = REGION;
    // A treaty's: at peace an occupied region would be handed back.
    runner.game.worldWar()!.politics.setLegalOwner(warsaw, FRA);
    takeRegion(runner.game, warsaw, "FRA");
    settleAt(runner, 1);
    expect(econ.controllerOf(warsaw)).toBe(FRA);
    expect(econ.scenario.regionSr(warsaw)).not.toBe(
      econ.scenario.regionSr(lyon),
    );
    econ.addBuilding(warsaw, "mil", 3);
    econ.addBuilding(lyon, "mil", 5);
    damageBuilding(econ, warsaw, "mil", 1000);
    damageBuilding(econ, lyon, "mil", 3000);
    const home = areaCrewOf(econ, FRA, lyon);
    const taken = areaCrewOf(econ, FRA, warsaw);
    stepRepairs(econ, ce, 1000);
    expect(econ.repair[cell(lyon, "mil")]).toBe(
      repairProgress(home + 1000, speedOf(lyon, "mil")),
    );
    expect(econ.repair[cell(warsaw, "mil")]).toBe(
      repairProgress(taken, speedOf(warsaw, "mil")),
    );
  });
});
