// A plane design save moves the static planes of its cell into `dcounts`
// (the first save absorbs them), so `counts` is all zero. Every map path that
// counts the planes of a deployment has to count both.
import { WP_OUT } from "@openfront/engine-api/ww1936/AirTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, it, vi } from "vitest";
import { AirSortiePass } from "../../../src/client/render/gl/passes/AirSortiePass";
import {
  KIND_TEXT,
  SHIP_CELL,
  ShipSpriteProgram,
} from "../../../src/client/render/gl/passes/FleetTokenPass";
import {
  deploymentPlanes,
  WwAirView,
} from "../../../src/client/view/WwAirView";
import { REGION, SR } from "../../ww1936/seaFixture";

const DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const scenario = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);
const ME = 3;

function recordingGL() {
  const written: Float32Array[] = [];
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "bufferSubData") {
          return (
            _t: number,
            _o: number,
            d: Float32Array,
            _s: number,
            n: number,
          ) => written.push(d.slice(0, n));
        }
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, written };
}

const day = (counts: number[], dcounts?: number[]) => ({
  zones: [
    {
      sr: SR.westLand,
      sides: [
        {
          side: ME,
          supPm: 700,
          sorties: [130, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        },
      ],
      result: [],
    },
  ],
  deployments: [
    {
      id: 1,
      owner: ME,
      sr: SR.westLand,
      type: "fighter" as const,
      mission: "air_superiority" as const,
      counts,
      ...(dcounts === undefined ? {} : { dcounts }),
      target: 100,
      base: REGION.berlin,
    },
  ],
  removedDeployments: [],
  details: [],
});

describe("design planes on the map", () => {
  it("counts static and design planes of a deployment", () => {
    expect(deploymentPlanes({ counts: [10, 5] })).toBe(15);
    expect(deploymentPlanes({ counts: [0, 0], dcounts: [100, 20] })).toBe(120);
  });

  it("a deployment of design planes only still flies sorties and shows its chip", () => {
    const { gl, written } = recordingGL();
    const sprites = new ShipSpriteProgram(gl, {}, {});
    const pass = new AirSortiePass(gl, {}, sprites);
    const air = new WwAirView(scenario, () => ME);
    air.apply(day([0], [100]));
    pass.update(air, null, 0, 4);
    air.apply(day([0], [100]));
    pass.update(air, null, 0, 4);
    expect(pass.airborneCount).toBe(3);
    pass.draw(new Float32Array(9), 0.25, 0, 300, 4, air, true);
    const chip = Array.from(written[written.length - 1]);
    expect(chip[2]).toBe(KIND_TEXT);
    expect(chip.slice(4, 8)).toEqual([
      SHIP_CELL.plane,
      SHIP_CELL.digit0 + 1,
      SHIP_CELL.digit0,
      SHIP_CELL.digit0,
    ]);
    expect(air.deployedIn(SR.westLand, "fighter")).toBe(100);
  });

  it("a wing in flight loads the plane atlas by itself", () => {
    // The wing model flies no sortie and a quiet sky spawns no wreck: the
    // atlas used to load only on those, so the planes drew blank.
    let made = 0;
    vi.stubGlobal(
      "Image",
      class {
        crossOrigin = "";
        src = "";
        constructor() {
          made++;
        }
        decode() {
          return Promise.reject(new Error("no image in the test"));
        }
      },
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { gl } = recordingGL();
      const pass = new AirSortiePass(gl, {}, new ShipSpriteProgram(gl, {}, {}));
      const air = new WwAirView(scenario, () => ME);
      air.apply({
        zones: [],
        deployments: [],
        removedDeployments: [],
        details: [],
        briefs: [
          {
            id: 1,
            owner: ME,
            side: ME,
            type: 0,
            base: REGION.berlin,
            planes: 150,
            phase: WP_OUT,
            until: 105,
            flySr: SR.westLand,
            hit: REGION.warsaw,
            flyMission: 0,
          },
        ],
        flights: [[1, WP_OUT, 105, 5, 8, 6, REGION.warsaw, 150]],
      });
      pass.setFlightClock(102, 1000, null);
      expect(made).toBe(0);
      pass.draw(new Float32Array(9), 0.25, 0, 300, 4, air, false);
      expect(made).toBe(1);
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
});
