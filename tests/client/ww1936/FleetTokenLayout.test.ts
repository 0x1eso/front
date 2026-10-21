// World War 1936 P4 (plan Task 11 Step 5): where fleet tokens stand on the
// test map ww1936sea and what a tap hits; the navy passes' instances.
import type {
  CountryNavyDetail,
  FleetSummary,
  InvasionData,
  NavalBattleSummary,
  WwNavyData,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { SEA_ZONE_BASE } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { SeaAirSelection } from "../../../src/client/hud/ww1936/SeaAirSelection";
import {
  convoyShips,
  MAX_CONVOY_SHIPS,
} from "../../../src/client/render/gl/passes/ConvoyFxPass";
import {
  FleetTokenPass,
  KIND_CHIP,
  KIND_RING,
  KIND_TEXT,
  KIND_TOKEN,
  MISSION_CELL,
  RING_PREP,
  SHIP_CELL,
  ShipSpriteProgram,
  ST_BATTLE,
  ST_LOW_FUEL,
  TEXT_GREEN,
  TEXT_RED,
  TOKEN_CHOSEN,
  TOKEN_DOCKED,
} from "../../../src/client/render/gl/passes/FleetTokenPass";
import { InvasionArrowPass } from "../../../src/client/render/gl/passes/InvasionArrowPass";
import {
  battleShare,
  NavalBattleMarkerPass,
} from "../../../src/client/render/gl/passes/NavalBattleMarkerPass";
import {
  STYLE_BAND,
  STYLE_HEAD,
} from "../../../src/client/render/gl/passes/PlanArrowPass";
import {
  dockXY,
  FLEET_HIT_PX,
  FleetLayoutCache,
  hitFleet,
  layoutFleets,
  ORBIT_TICKS,
  orbitLoop,
  tokenClass,
} from "../../../src/client/view/FleetTokenLayout";
import { WwNavyView } from "../../../src/client/view/WwNavyView";
import { HARBOR, REGION, SEA, SR, ZONE } from "../../ww1936/seaFixture";

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
    counts: [2, 0, 0, 0, 1, 0, 0],
    hpPm: 1000,
    orgPm: 1000,
    zone: ZONE.middle,
    docked: 0,
    path: [],
    progPm: 0,
    stepPm: 0,
    mission: "hold",
    missionSr: 0,
    state: "on_station",
    flags: 0,
    admiral: 0,
    engage: "always",
    returnAtPct: 50,
    ships: [],
    ...over,
  };
}

function viewWith(fleets: FleetSummary[], tick = 100): WwNavyView {
  const view = new WwNavyView(scenario, () => 3);
  const data: WwNavyData = {
    fleets,
    removedFleets: [],
    battles: [],
    endedBattles: [],
    seaRegions: [],
    details: [],
  };
  view.apply(data, tick);
  return view;
}

describe("FleetTokenLayout (spec §18.2)", () => {
  it("a token on the date line is drawn at both ends", () => {
    // West Sea (x 10) → East Sea (x 170) across the date line, half way:
    // x −10, so a second slot at x 190.
    const view = viewWith([
      fleet({
        id: 7,
        zone: ZONE.west,
        path: [ZONE.east],
        progPm: 500,
        state: "moving",
      }),
    ]);
    const slots = layoutFleets(view, 100, 0, 4);
    expect(slots.map((s) => [s.fleet, s.x, s.y])).toEqual([
      [7, -10, 110],
      [7, SEA.width - 10, 110],
    ]);
    // Both ends answer a tap.
    expect(hitFleet(slots, SEA.width - 10, 110)).toBe(7);
    expect(hitFleet(slots, -10, 110)).toBe(7);
    // Well inside the map: one slot.
    const still = layoutFleets(viewWith([fleet({ id: 8 })]), 100, 0, 4);
    expect(still).toHaveLength(1);
  });

  it("docked fleets sit at their port", () => {
    const view = viewWith([
      fleet({ id: 3, docked: REGION.london, zone: HARBOR[REGION.london] }),
    ]);
    const [slot] = layoutFleets(view, 100, 0, 4);
    expect([slot.x, slot.y]).toEqual([...dockXY(scenario, REGION.london)]);
    // On London's harbor water, next to London's own tiles.
    const W = scenario.width;
    const tile = slot.y * W + slot.x;
    expect(scenario.regionIds[tile]).toBe(HARBOR[REGION.london]);
    let nearest = Infinity;
    for (let t = 0; t < scenario.regionIds.length; t++) {
      if (scenario.regionIds[t] !== REGION.london) continue;
      const d = Math.hypot((t % W) - slot.x, Math.floor(t / W) - slot.y);
      nearest = Math.min(nearest, d);
    }
    expect(nearest).toBeLessThanOrEqual(1.5);
    // Two fleets in the same port fan out; neither is at the zone center.
    const two = layoutFleets(
      viewWith([
        fleet({ id: 3, docked: REGION.london, zone: ZONE.west }),
        fleet({ id: 4, docked: REGION.london, zone: ZONE.west }),
      ]),
      100,
      0,
      4,
    );
    expect(two[0].x).toBe(two[1].x);
    expect(two[0].y).not.toBe(two[1].y);
    const zc = scenario.zoneCenter(ZONE.west);
    expect([two[0].x, two[0].y]).not.toEqual([zc % W, Math.floor(zc / W)]);
  });

  it("hit radius 24px", () => {
    const view = viewWith([fleet({ id: 5, zone: ZONE.middle })]);
    // Middle Sea center (85, 110). At 2 px a tile the radius is 12 tiles.
    const slots = layoutFleets(view, 100, 0, 2);
    expect(slots[0].radius).toBe(FLEET_HIT_PX / 2);
    expect(hitFleet(slots, 85 + 11.9, 110)).toBe(5);
    expect(hitFleet(slots, 85 + 12.1, 110)).toBe(0);
    // Zoomed in to 8 px a tile: 3 tiles.
    const close = layoutFleets(view, 100, 0, 8);
    expect(hitFleet(close, 85, 110 + 2.9)).toBe(5);
    expect(hitFleet(close, 85, 110 + 3.1)).toBe(0);
    // The nearest of two overlapping tokens wins.
    const pair = [
      { fleet: 1, x: 0, y: 0, radius: 12 },
      { fleet: 2, x: 4, y: 0, radius: 12 },
    ];
    expect(hitFleet(pair, 3, 0)).toBe(2);
    expect(hitFleet(pair, 2, 0)).toBe(1);
  });

  it("a mission token laps its region's zone centers once every 600 ticks", () => {
    const view = viewWith([
      fleet({ id: 9, mission: "patrol", missionSr: SR.central }),
    ]);
    const loop = orbitLoop(scenario, SR.central)!;
    expect(loop.pts.length).toBe(4); // Middle Sea and Narrows
    const at = (tick: number) => {
      const [s] = layoutFleets(view, tick, 0, 4);
      return [s.x, s.y];
    };
    const [x0, y0] = at(1000);
    const [x1, y1] = at(1000 + ORBIT_TICKS);
    expect(x1).toBeCloseTo(x0, 9);
    expect(y1).toBeCloseTo(y0, 9);
    expect(Math.abs(at(1000 + ORBIT_TICKS / 2)[0] - x0)).toBeGreaterThan(1);
  });

  it("the cache moves only what moves, between ticks too", () => {
    const view = viewWith([
      fleet({
        id: 1,
        zone: ZONE.middle,
        path: [ZONE.narrows],
        progPm: 0,
        stepPm: 100,
        state: "moving",
      }),
      fleet({ id: 2, zone: ZONE.east }),
    ]);
    const cache = new FleetLayoutCache();
    expect(cache.update(view, 100, 0, 4)).toBe(true);
    const x0 = cache.slots[0].x;
    expect(cache.update(view, 100, 0, 4)).toBe(false);
    expect(cache.update(view, 100, 0.5, 4)).toBe(true);
    // Middle (85) → Narrows (125): 10 % of 40 tiles a tick, half a tick.
    expect(cache.slots[0].x).toBeCloseTo(x0 + 2, 9);
    expect(cache.update(view, 101, 0, 4)).toBe(true);
    expect(cache.slots[0].x).toBeCloseTo(x0 + 4, 9);
    expect(cache.slots[1].x).toBe(170);
  });

  it("the token shows its biggest class", () => {
    expect(tokenClass([4, 2, 0, 0, 1, 1, 0])).toBe("bb");
    expect(tokenClass([4, 2, 0, 1, 0, 1, 0])).toBe("cv");
    expect(tokenClass([0, 0, 0, 0, 0, 0, 3])).toBe("ss");
    expect(tokenClass([0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(SEA_ZONE_BASE).toBeLessThan(ZONE.west);
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
const rows = (f: Float32Array) =>
  Array.from({ length: f.length / 12 }, (_, i) =>
    Array.from(f.subarray(i * 12, i * 12 + 12)),
  );

function detail(invasions: InvasionData[]): CountryNavyDetail {
  return {
    smallID: 3,
    lines: [],
    docks: 0,
    docksLent: 0,
    docksIdle: 0,
    convoys: 0,
    convoysByUse: [],
    routes: [],
    invasions,
    admirals: [],
    navyXpMilli: 0,
    convoyLoss30: [],
    fuelMilli: 0,
    fuelCapMilli: 0,
    fuelRatioPm: 1000,
  };
}

describe("navy passes (spec §18.2)", () => {
  it("tokens: silhouette, count, mission, state; the chosen one last, docked small", () => {
    const { gl, written } = recordingGL();
    const sprites = new ShipSpriteProgram(gl, {}, {});
    const pass = new FleetTokenPass(gl, sprites);
    const view = viewWith([
      fleet({
        id: 1,
        counts: [4, 2, 0, 0, 0, 1, 0],
        mission: "patrol",
        missionSr: 0,
        state: "battle",
        flags: 1,
      }),
      fleet({ id: 2, zone: ZONE.east, docked: REGION.krakow }),
    ]);
    const layout = new FleetLayoutCache();
    const sel = new SeaAirSelection();
    sel.selectFleet(1);
    pass.update(view, layout, layout.update(view, 100, 0, 4), sel);
    const r = rows(written[written.length - 1]);
    expect(r).toHaveLength(2);
    // Fleet 2 first; the chosen fleet 1 on top.
    expect(r[0][4]).toBe(SHIP_CELL.battleship);
    expect(r[0][10]).toBe(TOKEN_DOCKED);
    const [x, y, kind, owner, cell, ships, , , mission, state, flags] = r[1];
    expect([x, y]).toEqual([85, 110]);
    expect([kind, owner]).toEqual([KIND_TOKEN, 3]);
    expect(cell).toBe(SHIP_CELL.carrier);
    expect(ships).toBe(7);
    expect(mission).toBe(MISSION_CELL.patrol);
    expect(state).toBe(ST_BATTLE | ST_LOW_FUEL);
    expect(flags).toBe(TOKEN_CHOSEN);
    // Zoomed out: chips. Nothing changed: nothing rewritten.
    const n = written.length;
    pass.update(view, layout, layout.update(view, 100, 0, 4), sel);
    expect(written.length).toBe(n);
    pass.update(view, layout, layout.update(view, 100, 0, 1), sel);
    expect(rows(written[written.length - 1])[0][2]).toBe(KIND_CHIP);
  });

  it("battle markers: the bar splits by strength; a new sinking calls the handler", () => {
    const { gl, written } = recordingGL();
    const pass = new NavalBattleMarkerPass(gl, {}, {});
    const sunk: number[][] = [];
    pass.setSinkHandler((x, y, n) => sunk.push([x, y, n]));
    const battle = (round: number, s: NavalBattleSummary["sunk"]) => ({
      zone: ZONE.middle,
      attacker: 1,
      defender: 3,
      round,
      hpPm: [1000, 500] as [number, number],
      orgPm: [1000, 500] as [number, number],
      ships: [4, 4] as [number, number],
      sunk: s,
    });
    const view = viewWith([]);
    view.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [battle(1, [])],
        endedBattles: [],
        seaRegions: [],
        details: [],
      },
      101,
    );
    pass.update(view, 0);
    const m = Array.from(written[written.length - 1]);
    expect(m.slice(0, 4)).toEqual([85, 110, 1, 3]);
    expect(m[4]).toBeCloseTo(2 / 3, 6);
    expect(m[5]).toBe(0);
    expect(battleShare(battle(1, []))).toBeCloseTo(2 / 3, 9);
    expect(sunk).toEqual([]);
    view.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [battle(2, [[0, 1, -3, 3]])],
        endedBattles: [],
        seaRegions: [],
        details: [],
      },
      102,
    );
    pass.update(view, 0);
    expect(sunk).toEqual([[85, 110, 1]]);
    pass.update(view, 1);
    expect(sunk).toHaveLength(1);
  });

  it("invasion arrows: a band from the port along the route, ✓/✗ chips, the preparation ring", () => {
    const { gl, written } = recordingGL();
    const sprites = new ShipSpriteProgram(gl, {}, {});
    const pass = new InvasionArrowPass(gl, sprites);
    const view = viewWith([]);
    view.apply(
      {
        fleets: [],
        removedFleets: [],
        battles: [],
        endedBattles: [],
        seaRegions: [],
        details: [
          detail([
            {
              army: 1,
              target: REGION.kiev,
              from: REGION.london,
              state: "preparing",
              prepDone: 15,
              prepDays: 60,
              convoys: 40,
              route: [
                [SR.approaches, 800],
                [SR.central, 300],
              ],
            },
          ]),
        ],
      },
      101,
    );
    pass.update(view, 0.25);
    const [pieces, sprite] = written.slice(-2).map(rows);
    expect(pieces.filter((r) => r[6] === STYLE_BAND).length).toBeGreaterThan(8);
    expect(pieces.filter((r) => r[6] === STYLE_HEAD)).toHaveLength(1);
    // The band starts on London's coast.
    expect(pieces[0].slice(0, 2)).toEqual([...dockXY(scenario, REGION.london)]);
    const text = sprite.filter((r) => r[2] === KIND_TEXT);
    expect(text.map((r) => [r[4], r[9]])).toEqual([
      [SHIP_CELL.check, TEXT_GREEN],
      [SHIP_CELL.cross, TEXT_RED],
    ]);
    const ring = sprite.filter((r) => r[2] === KIND_RING);
    expect(ring).toHaveLength(1);
    expect(ring[0][4]).toBe(0.25);
    expect(ring[0][6]).toBe(RING_PREP);
  });

  it("convoy ships: one per 50 convoys, at least one, 40 on the map at most", () => {
    expect(convoyShips([0, 20, 50, 130])).toEqual([0, 1, 1, 3]);
    const big = convoyShips([1000, 1000, 10]);
    expect(big.reduce((a, b) => a + b, 0)).toBe(MAX_CONVOY_SHIPS);
    expect(big[2]).toBe(1);
  });
});
