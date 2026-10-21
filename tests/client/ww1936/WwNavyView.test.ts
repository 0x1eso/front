// World War 1936 P4 (plan Task 1 Step 25): the screens' navy view.
import type {
  FleetSummary,
  WwNavyData,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { sideKeyOf, WwNavyView } from "../../../src/client/view/WwNavyView";
import { SR, ZONE } from "../../ww1936/seaFixture";

const DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const scenario = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);

function fleet(over: Partial<FleetSummary>): FleetSummary {
  return {
    id: 1,
    owner: 3,
    nameIdx: 0,
    num: 1,
    counts: [1, 0, 0, 0, 0, 0, 0],
    hpPm: 1000,
    orgPm: 1000,
    zone: ZONE.west,
    docked: 0,
    path: [],
    progPm: 0,
    stepPm: 0,
    mission: "hold",
    missionSr: 0,
    state: "moving",
    flags: 0,
    admiral: 0,
    engage: "always",
    returnAtPct: 50,
    ships: [],
    ...over,
  };
}

const data = (over: Partial<WwNavyData>): WwNavyData => ({
  fleets: [],
  removedFleets: [],
  battles: [],
  endedBattles: [],
  seaRegions: [],
  details: [],
  ...over,
});

describe("WwNavyView", () => {
  it("a fleet crossing the date line interpolates the short way", () => {
    const view = new WwNavyView(scenario, () => 3);
    view.apply(
      data({
        fleets: [
          fleet({ id: 1, zone: ZONE.west, path: [ZONE.east], progPm: 500 }),
        ],
      }),
      100,
    );
    // West Sea center x 10, East Sea x 170: the short way is x 10 → −30.
    const [x, y] = view.fleetXY(1, 100, 0);
    expect(x).toBe(-10);
    expect(y).toBe(110);
    // Docked or still: the zone's center.
    view.apply(data({ fleets: [fleet({ id: 2, zone: ZONE.middle })] }), 101);
    expect(view.fleetXY(2, 101, 0)).toEqual([85, 110]);
  });

  it("progress follows the step per tick", () => {
    const view = new WwNavyView(scenario, () => 3);
    view.apply(
      data({
        fleets: [
          fleet({
            id: 1,
            zone: ZONE.middle,
            path: [ZONE.narrows],
            progPm: 0,
            stepPm: 250,
          }),
        ],
      }),
      10,
    );
    expect(view.fleetXY(1, 12, 0)[0]).toBe(85 + (125 - 85) / 2);
    expect(view.fleetXY(1, 20, 0)[0]).toBe(125);
  });

  it("an update keeps unchanged fleets", () => {
    const view = new WwNavyView(scenario, () => 3);
    view.apply(data({ fleets: [fleet({ id: 1 }), fleet({ id: 2 })] }), 1);
    view.apply(data({ fleets: [fleet({ id: 2, hpPm: 500 })] }), 2);
    expect([...view.fleets.keys()]).toEqual([1, 2]);
    expect(view.fleets.get(2)!.hpPm).toBe(500);
    view.apply(data({ removedFleets: [1] }), 3);
    expect([...view.fleets.keys()]).toEqual([2]);
  });

  it("my side's supremacy, spotting and detail", () => {
    const view = new WwNavyView(
      scenario,
      () => 3,
      () => sideKeyOf(3, 1),
    );
    view.apply(
      data({
        seaRegions: [
          {
            sr: SR.central,
            sup: [
              [3, 200],
              [100_001, 800],
            ],
            spotted: [[100_001, [9]]],
            convoyLoss: [],
          },
        ],
      }),
      5,
    );
    expect(view.mySupremacy(SR.central)).toBe(800);
    expect(view.mySupremacy(SR.eastern)).toBe(0);
    expect(view.spottedByMe(9)).toBe(true);
    expect(view.spottedByMe(8)).toBe(false);
    expect(view.detail).toBeNull();
  });
});
