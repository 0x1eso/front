// World War 1936 P4 (plan Task 9 Step 8): bomb damage repairs (P4 spec
// §14.8) on the test map ww1936sea, France played by a human.
import { BUILDING_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  constructionProgress,
  projectSpeedPct,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  buildingIndex,
  damageBuilding,
  effectiveBuildings,
} from "@openfront/engine/ww1936/economy/Buildings";
import {
  buildingSpeedPct,
  queueBuild,
} from "@openfront/engine/ww1936/economy/Construction";
import { repairCostMilli } from "@openfront/engine/ww1936/economy/Repairs";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const FRA = TAG_ID.FRA;

function settleAt(runner: GameRunner, d: number): void {
  stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + (FRA % 7) + 1);
}

describe("World War 1936 P4: bomb damage repairs (spec §14.8)", () => {
  test("repairs run before construction and cost 30%", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "FRA" }],
      SEA.map,
    );
    const econ = runner.game.worldWar()!.economy;
    const ce = econ.country(FRA)!;
    const paris = REGION.paris;
    // More civilian factories than one repair takes (15), so the queue
    // behind it gets the rest; 2.5 of them stopped.
    econ.addBuilding(paris, "civ", 30);
    damageBuilding(econ, paris, "civ", 2500);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(33);
    expect(queueBuild(econ, ce, REGION.lyon, "infra", 1)).toBeNull();
    // 30% of a building per 1,000 of damage.
    expect(repairCostMilli("civ", 1000)).toBe(3_240_000);
    expect(repairCostMilli("civ", 500)).toBe(1_620_000);
    const i = paris * BUILDING_IDS.length + buildingIndex("civ");
    settleAt(runner, 0);
    const speed = projectSpeedPct({
      building: "civ",
      infra: econ.infraEff[paris],
      tech: ce.stats,
      law: ce.law(),
      buildingPct: buildingSpeedPct(ce, "civ"),
    });
    // The repair took its 15 factories first; the queue got what was left.
    const q = ce.queue[0];
    const freeBefore = ce.totals.freeCivMilli + 15_000;
    expect(freeBefore).toBeGreaterThan(15_000);
    expect(econ.repair[i]).toBe(constructionProgress(15_000, speed));
    expect(q.lastAssigned).toBe(Math.min(15_000, freeBefore - 15_000));
    expect(econ.damage[i]).toBe(2500);
    // The cost reached: the top 1,000 is mended, the rest rolls on.
    const day = econ.repair[i];
    econ.repair[i] = repairCostMilli("civ", 1000) - 1;
    settleAt(runner, 1);
    expect(econ.damage[i]).toBe(1500);
    expect(econ.repair[i]).toBe(day - 1);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(34);
    // The next 1,000, then the last 500 at half the cost.
    econ.repair[i] = repairCostMilli("civ", 1000) + repairCostMilli("civ", 500);
    settleAt(runner, 2);
    expect(econ.damage[i]).toBe(0);
    expect(econ.repair[i]).toBe(0);
    expect(effectiveBuildings(econ, paris, "civ")).toBe(35);
    // Nothing left to mend: the queue has every free factory again.
    settleAt(runner, 3);
    expect(ce.queue[0].lastAssigned).toBe(
      Math.min(15_000, ce.totals.freeCivMilli),
    );
  });
});
