// World War 1936 P4 (plan Task 11 Step 5): the sea and air layers' colour
// tables on the test map ww1936sea; the layers' strategic lookup and the
// sorties the air pass flies.
import type { AirZoneData } from "@openfront/engine-api/ww1936/AirTypes";
import type { SeaRegionData } from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  AirSortiePass,
  sortiePlanes,
} from "../../../src/client/render/gl/passes/AirSortiePass";
import {
  KIND_TEXT,
  SHIP_CELL,
  ShipSpriteProgram,
} from "../../../src/client/render/gl/passes/FleetTokenPass";
import {
  regionTileCodes,
  SR_LUT_W,
  strategicLookup,
} from "../../../src/client/render/gl/passes/RegionBorderPass";
import {
  airLayerColors,
  LAYER_FILL_ALPHA,
  LAYER_FLAG_CONVOY_LOSS,
  RAMP_AIR_MINE,
  RAMP_CONTESTED,
  RAMP_ENEMY,
  RAMP_SEA_MINE,
  seaLayerColors,
  seaLayerFlags,
} from "../../../src/client/view/AirZoneColors";
import { WwAirView } from "../../../src/client/view/WwAirView";
import { WwNavyView } from "../../../src/client/view/WwNavyView";
import { REGION, SR, ZONE } from "../../ww1936/seaFixture";

const DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const scenario = ScenarioIndex.fromFiles(
  JSON.parse(
    fs.readFileSync(path.join(DIR, "scenario.json"), "utf8"),
  ) as ReadonlyScenarioData,
  new Uint8Array(fs.readFileSync(path.join(DIR, "regions.bin"))),
);
const ME = 3;
const ENEMY = 1;

const rgba = (t: Uint8Array, sr: number) => {
  const i = scenario.srIdxOf(sr) * 4;
  return [t[i], t[i + 1], t[i + 2], t[i + 3]];
};

function airZone(sr: number, sides: [number, number][]): AirZoneData {
  return {
    sr,
    sides: sides.map(([side, supPm]) => ({
      side,
      supPm,
      sorties: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    })),
    result: [],
  };
}

function seaRegion(
  sr: number,
  sup: [number, number][],
  convoyLoss: [number, number][] = [],
): SeaRegionData {
  return { sr, sup, spotted: [], convoyLoss };
}

describe("AirZoneColors (spec §18.2)", () => {
  it("superiority maps to the colour ramp", () => {
    const air = new WwAirView(scenario, () => ME);
    air.apply({
      zones: [
        airZone(SR.westLand, [[ME, 1000]]),
        airZone(SR.eastLand, [[ENEMY, 1000]]),
        airZone(SR.central, [
          [ENEMY, 500],
          [ME, 500],
        ]),
        airZone(SR.approaches, [
          [ENEMY, 250],
          [ME, 750],
        ]),
      ],
      deployments: [],
      removedDeployments: [],
      details: [],
    });
    const t = airLayerColors(air);
    expect(t).toHaveLength(256 * 4);
    expect(rgba(t, SR.westLand)).toEqual([...RAMP_AIR_MINE, LAYER_FILL_ALPHA]);
    expect(rgba(t, SR.eastLand)).toEqual([...RAMP_ENEMY, LAYER_FILL_ALPHA]);
    expect(rgba(t, SR.central)).toEqual([...RAMP_CONTESTED, LAYER_FILL_ALPHA]);
    // 750 ‰: half way from contested to green.
    const mid = rgba(t, SR.approaches);
    for (let c = 0; c < 3; c++) {
      expect(mid[c]).toBe(
        Math.round((RAMP_CONTESTED[c] + RAMP_AIR_MINE[c]) / 2),
      );
    }

    // The sea layer: blue ↔ red by my side's supremacy.
    const navy = new WwNavyView(scenario, () => ME);
    navy.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [],
        endedBattles: [],
        seaRegions: [
          seaRegion(SR.central, [[ME, 1000]]),
          seaRegion(SR.eastern, [[ENEMY, 1000]]),
        ],
        details: [],
      },
      1,
    );
    const s = seaLayerColors(navy);
    expect(rgba(s, SR.central)).toEqual([...RAMP_SEA_MINE, LAYER_FILL_ALPHA]);
    expect(rgba(s, SR.eastern)).toEqual([...RAMP_ENEMY, LAYER_FILL_ALPHA]);
  });

  it("unknown zones are transparent", () => {
    const air = new WwAirView(scenario, () => ME);
    // No day yet anywhere: all clear.
    expect(airLayerColors(air).every((b) => b === 0)).toBe(true);
    air.apply({
      zones: [
        airZone(SR.westLand, [[ME, 600]]),
        // Flown over, but nobody holds any superiority.
        airZone(SR.eastLand, [[ENEMY, 0]]),
      ],
      deployments: [],
      removedDeployments: [],
      details: [],
    });
    const t = airLayerColors(air);
    expect(rgba(t, SR.eastLand)).toEqual([0, 0, 0, 0]);
    expect(rgba(t, SR.central)).toEqual([0, 0, 0, 0]);
    expect(rgba(t, SR.westLand)[3]).toBe(LAYER_FILL_ALPHA);
    // Only the known zone is written; a reused table is cleared first.
    let written = 0;
    for (let i = 3; i < t.length; i += 4) if (t[i] !== 0) written++;
    expect(written).toBe(1);
    const reused = new Uint8Array(256 * 4).fill(255);
    expect(airLayerColors(air, reused)).toBe(reused);
    expect(rgba(reused, SR.central)).toEqual([0, 0, 0, 0]);

    // The sea layer: an unknown region, or one where no side has power.
    const navy = new WwNavyView(scenario, () => ME);
    navy.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [],
        endedBattles: [],
        seaRegions: [
          seaRegion(SR.central, [], [[ME, 2_500]]),
          seaRegion(SR.eastern, [[ENEMY, 800]], [[ENEMY, 1_000]]),
        ],
        details: [],
      },
      1,
    );
    const s = seaLayerColors(navy);
    expect(rgba(s, SR.central)).toEqual([0, 0, 0, 0]);
    expect(rgba(s, SR.approaches)).toEqual([0, 0, 0, 0]);
    // My convoys sank in Central Waters only: it blinks, Eastern does not.
    const f = seaLayerFlags(navy);
    expect(f[scenario.srIdxOf(SR.central)]).toBe(LAYER_FLAG_CONVOY_LOSS);
    expect(f[scenario.srIdxOf(SR.eastern)]).toBe(0);
  });
});

/** A WebGL stand-in recording what each bufferSubData sent. */
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

describe("sea and air layers on the map (spec §18.2)", () => {
  it("every tile finds its strategic region through its code", () => {
    const lut = strategicLookup(scenario);
    const codes = regionTileCodes(
      scenario.regionIds,
      scenario.width,
      scenario.height,
    );
    const W = scenario.width;
    const srOfTile = (x: number, y: number) => {
      const code = codes[y * W + x] & 0x7fff;
      return lut[(code >> 8) * SR_LUT_W + (code & 255)] - 1;
    };
    const center = (zone: number) => {
      const t = scenario.zoneCenter(zone);
      return [t % W, Math.floor(t / W)] as const;
    };
    expect(srOfTile(...center(ZONE.west))).toBe(
      scenario.srIdxOf(SR.approaches),
    );
    expect(srOfTile(...center(ZONE.narrows))).toBe(
      scenario.srIdxOf(SR.central),
    );
    const berlin = scenario.centerTile(REGION.berlin);
    expect(srOfTile(berlin % W, Math.floor(berlin / W))).toBe(
      scenario.srIdxOf(SR.westLand),
    );
    // Land regions come first: the sea layer starts at the first sea index.
    const firstSea = scenario.strategicList().length - scenario.seaSrCount();
    expect(scenario.srIdxOf(SR.approaches)).toBeGreaterThanOrEqual(firstSea);
    expect(scenario.srIdxOf(SR.eastLand)).toBeLessThan(firstSea);
  });

  it("a deployment flies min(6, ceil(sorties / 60)) planes on its zone's day", () => {
    expect([0, 1, 60, 61, 300, 361, 5000].map(sortiePlanes)).toEqual([
      0, 1, 1, 2, 5, 6, 6,
    ]);
    const { gl, written } = recordingGL();
    const sprites = new ShipSpriteProgram(gl, {}, {});
    const pass = new AirSortiePass(gl, {}, sprites);
    const air = new WwAirView(scenario, () => ME);
    const day = (fighterSorties: number) => ({
      zones: [
        {
          sr: SR.westLand,
          sides: [
            {
              side: ME,
              supPm: 700,
              sorties: [fighterSorties, 0, 0, 0, 0, 0, 0, 0, 0, 0],
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
          counts: [100],
          target: 100,
          base: REGION.berlin,
        },
      ],
      removedDeployments: [],
      details: [],
    });
    air.apply(day(130));
    pass.update(air, null, 0, 4); // the first view: nothing launches
    expect(pass.airborneCount).toBe(0);
    air.apply(day(130));
    pass.update(air, null, 0, 4);
    expect(pass.airborneCount).toBe(3);
    // The next day tops up to the day's number, never past it.
    air.apply(day(500));
    pass.update(air, null, 100, 4);
    expect(pass.airborneCount).toBe(6);
    air.apply(day(10));
    pass.update(air, null, 200, 4);
    expect(pass.airborneCount).toBe(6);
    // Zoomed far out nothing new takes off.
    const pass2 = new AirSortiePass(gl, {}, sprites);
    pass2.update(air, null, 0, 4);
    air.apply(day(130));
    pass2.update(air, null, 0, 0.3);
    expect(pass2.airborneCount).toBe(0);

    // The air layer's chip: "✈100" over the zone.
    pass.draw(new Float32Array(9), 0.25, 0, 300, 4, air, true);
    const chip = Array.from(written[written.length - 1]);
    expect(chip[2]).toBe(KIND_TEXT);
    expect(chip.slice(4, 8)).toEqual([
      SHIP_CELL.plane,
      SHIP_CELL.digit0 + 1,
      SHIP_CELL.digit0,
      SHIP_CELL.digit0,
    ]);
    expect(chip[11]).toBe(4);
  });
});
