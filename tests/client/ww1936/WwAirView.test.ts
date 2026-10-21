// World War 1936 P4 (plan Task 1 Step 25): the screens' air view.
import type { AirZoneData } from "@openfront/engine-api/ww1936/AirTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { WwAirView } from "../../../src/client/view/WwAirView";
import { SR } from "../../ww1936/seaFixture";

const DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const scenario = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);

const zone = (sr: number, sides: [number, number][]): AirZoneData => ({
  sr,
  sides: sides.map(([side, supPm]) => ({
    side,
    supPm,
    sorties: [10, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  })),
  result: [],
});

describe("WwAirView", () => {
  it("zone superiority merges per side", () => {
    const view = new WwAirView(scenario, () => 1);
    view.apply({
      zones: [
        zone(SR.westLand, [
          [1, 600],
          [3, 400],
        ]),
        zone(SR.central, [[3, 1000]]),
      ],
      deployments: [],
      removedDeployments: [],
      details: [],
    });
    expect(view.mySuperiority(SR.westLand)).toBe(600);
    expect(view.mySuperiority(SR.central)).toBe(0);
    // A zone's next day replaces its sides; the other zones stay.
    view.apply({
      zones: [zone(SR.westLand, [[3, 1000]])],
      deployments: [],
      removedDeployments: [],
      details: [],
    });
    expect(view.mySuperiority(SR.westLand)).toBe(0);
    expect(view.zones.get(SR.central)!.sides[0].supPm).toBe(1000);
  });

  it("my deployments by zone and type", () => {
    const view = new WwAirView(scenario, () => 1);
    view.apply({
      zones: [],
      deployments: [
        {
          id: 1,
          owner: 1,
          sr: SR.westLand,
          type: "fighter",
          mission: "air_superiority",
          counts: [100, 20, 0],
          target: 120,
          base: 3,
        },
        {
          id: 2,
          owner: 1,
          sr: SR.westLand,
          type: "fighter",
          mission: "interception",
          counts: [30, 0, 0],
          target: 30,
          base: 3,
        },
      ],
      removedDeployments: [],
      details: [],
    });
    expect(view.deployedIn(SR.westLand, "fighter")).toBe(150);
    expect(view.deployedIn(SR.westLand, "cas")).toBe(0);
    view.apply({
      zones: [],
      deployments: [],
      removedDeployments: [2],
      details: [],
    });
    expect(view.deployedIn(SR.westLand, "fighter")).toBe(120);
  });
});
