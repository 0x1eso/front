// World War 1936 P4 (plan Task 1 Step 25): the air war wired into the game
// on ww1936sea, and the stock ledger of planes out on deployments.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { deploymentSide } from "@openfront/engine/ww1936/air/WwAir";
import {
  damageBuilding,
  drawPlanes,
  losePlanes,
  returnPlanes,
} from "@openfront/engine/ww1936/economy/Buildings";
import { AIR_BASE, REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [{ clientID: HUMAN, country: "DEU" as const }];

describe("air wiring", () => {
  it("every strategic region has an air zone state", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    expect(ww.air.zoneState).toHaveLength(ww.scenario.strategicList().length);
    expect(ww.air.deployments.size).toBe(0);
  });

  it("drawPlanes takes the newest generation first and returnPlanes restores it", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ce = runner.game.worldWar()!.economy.country(TAG_ID.DEU)!;
    const [g1, g2, g3] = [1, 2, 3].map((g) => equipKey("fighter", g));
    ce.stock[g1] = 10;
    ce.stock[g2] = 5;
    ce.stock[g3] = 0;
    const got = drawPlanes(ce, "fighter", 8);
    expect(got).toEqual([3, 5, 0]);
    expect([ce.stock[g1], ce.stock[g2]]).toEqual([7, 0]);
    expect([ce.planesDeployed[g1], ce.planesDeployed[g2]]).toEqual([3, 5]);
    returnPlanes(ce, "fighter", got);
    expect([ce.stock[g1], ce.stock[g2]]).toEqual([10, 5]);
    expect([ce.planesDeployed[g1], ce.planesDeployed[g2]]).toEqual([0, 0]);
    // A loss leaves the stock as it was and takes the deployed ones.
    const out = drawPlanes(ce, "fighter", 20);
    expect(out).toEqual([10, 5, 0]);
    losePlanes(ce, "fighter", [4, 5, 0]);
    expect(ce.planesDeployed[g1]).toBe(6);
    expect(ce.stock[g1] + ce.stock[g2]).toBe(0);
  });

  it("shootDown takes losses off the deployment and the ledger (P5's kill site)", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    const ce = ww.economy.country(TAG_ID.DEU)!;
    ce.stock[equipKey("fighter", 1)] = 50;
    const counts = drawPlanes(ce, "fighter", 30);
    const d = ww.air.addDeployment({
      owner: TAG_ID.DEU,
      sr: 2,
      type: 0,
      mission: 0,
      counts,
      target: 30,
      base: REGION.berlin,
      lossRest: 0,
      auto: false,
      volunteerFor: 0,
    });
    expect(ww.air.shootDown(d.id, [40, 0, 0], TAG_ID.FRA)).toBe(30);
    expect(d.counts).toEqual([0, 0, 0]);
    expect(ce.planesDeployed[equipKey("fighter", 1)]).toBe(0);
    expect(ce.stock[equipKey("fighter", 1)]).toBe(20);
    expect(ww.air.shootDown(d.id, [1, 0, 0], TAG_ID.FRA)).toBe(0);
    expect(ww.air.shootDown(999, [1, 0, 0], 0)).toBe(0);
  });

  it("a volunteer wing fights on its host's side (P5)", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    const base = {
      owner: TAG_ID.ITA,
      sr: 2,
      type: 0,
      mission: 0,
      counts: [0, 0, 0],
      target: 0,
      base: REGION.rome,
      lossRest: 0,
      auto: false,
    };
    const own = ww.air.addDeployment({ ...base, volunteerFor: 0 });
    const vol = ww.air.addDeployment({ ...base, volunteerFor: TAG_ID.DEU });
    expect(deploymentSide(ww.air, own)).toBe(ww.land.sideOf(TAG_ID.ITA));
    expect(deploymentSide(ww.air, vol)).toBe(ww.land.sideOf(TAG_ID.DEU));
  });

  it("base capacity is level × 200 less damage", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    const ww = runner.game.worldWar()!;
    expect(ww.air.baseCapacity(REGION.berlin)).toBe(AIR_BASE[3] * 200);
    expect(ww.air.baseCapacity(REGION.paris)).toBe(0);
    damageBuilding(ww.economy, REGION.berlin, "air_base", 500);
    expect(ww.air.baseCapacity(REGION.berlin)).toBe(300);
    damageBuilding(ww.economy, REGION.berlin, "air_base", 5000);
    expect(ww.air.baseCapacity(REGION.berlin)).toBe(0);
  });
});
