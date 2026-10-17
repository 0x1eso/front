import type { GameMap } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  carpetBombPoints,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { ConstructionExecution } from "@openfront/engine/execution/ConstructionExecution";
import type { Game, Unit } from "@openfront/engine/game/Game";
import { carpetDropTiles } from "@openfront/engine/warfare/Carpet";
import { straightFlightPath } from "@openfront/engine/warfare/FlightPath";
import { ParadropExecution } from "@openfront/engine/warfare/ParadropExecution";
import { describe, expect, test, vi } from "vitest";
import {
  BOMB_FALL_MS,
  FLASH_MS,
  PARACHUTE_MS,
} from "../../../../src/client/render/frame/derive/PlaneFx";
import { flightSteps } from "../../../../src/client/render/frame/derive/PlaneTrack";
import { AirFxPass } from "../../../../src/client/render/gl/passes/AirFxPass";
import { PlanePass } from "../../../../src/client/render/gl/passes/PlanePass";
import type { UnitState } from "../../../../src/client/render/types";
import {
  UT_BOMBER,
  UT_CARGO_PLANE,
  UT_SAM_MISSILE,
  UT_TRANSPORT_PLANE,
  UT_WARSHIP,
} from "../../../../src/client/render/types";
import { BLUE, own, RED, warfareGame } from "../../../warfare/util";

function countingGL() {
  const counts = {
    instanced: 0,
    arrays: 0,
    deletedPrograms: 0,
    uploads: [] as Float32Array[],
  };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArraysInstanced") return () => counts.instanced++;
        if (prop === "drawArrays") return () => counts.arrays++;
        if (prop === "deleteProgram") return () => counts.deletedPrograms++;
        if (prop === "bufferSubData") {
          return (_t: number, _o: number, data: Float32Array) =>
            counts.uploads.push(data.slice());
        }
        if (prop === "getProgramParameter") return () => true;
        if (prop === "getShaderParameter") return () => true;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

const W = 200;
const cam = new Float32Array(9);
const config = { msPerTick: () => 100 } as never;
const header = { mapWidth: W, mapHeight: W } as never;
const tile = (x: number, y: number) => y * W + x;

function unit(over: Partial<UnitState>): UnitState {
  return {
    id: 1,
    unitType: UT_TRANSPORT_PLANE,
    ownerID: 3,
    lastOwnerID: null,
    pos: 0,
    lastPos: 0,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: true,
    waitTicks: 0,
    markedForDeletion: false,
    health: null,
    underConstruction: false,
    targetUnitId: null,
    targetTile: null,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    constructionStartTick: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
    ...over,
  } as UnitState;
}

function setupPlanes() {
  const { gl, counts } = countingGL();
  const pass = new PlanePass(gl, header, {} as WebGLTexture, config);
  let now = 0;
  pass.setTimeFn(() => now);
  return { pass, counts, setNow: (t: number) => (now = t) };
}

const noStructures = new Map<number, UnitState>();

describe("PlanePass", () => {
  test("draws nothing, and uploads nothing, without planes", () => {
    const { pass, counts } = setupPlanes();
    pass.updateUnits(
      new Map([[1, unit({ id: 1, unitType: UT_WARSHIP })]]),
      1,
      noStructures,
    );
    pass.drawShadows(cam);
    pass.drawAir(cam);
    expect(pass.planeCount).toBe(0);
    expect(counts.instanced).toBe(0);
  });

  test("a plane heading east is rotated a quarter turn, with the take-off size", () => {
    const { pass, counts, setNow } = setupPlanes();
    // 105 tiles in 35 steps of 3: tick 2 of the flight is at x = 50.
    const plane = unit({
      pos: tile(50, 100),
      lastPos: tile(44, 100),
      targetTile: tile(149, 100),
    });
    pass.updateUnits(new Map([[1, plane]]), 1, noStructures);
    setNow(100); // end of the tick: at pos
    pass.drawShadows(cam);
    const inst = counts.uploads[0];
    expect(inst[0]).toBeCloseTo(50.5);
    expect(inst[1]).toBeCloseTo(100.5);
    expect(inst[2]).toBeCloseTo(Math.PI / 2);
    // flown 6 of 105 tiles: still small, but bigger than the minimum
    expect(inst[3]).toBeLessThan(22);
    expect(inst[3]).toBeGreaterThan(22 * 0.45);
    // shadow draw, then contrail + plane
    pass.drawAir(cam);
    expect(counts.instanced).toBe(3);
  });

  test("positions are smoothed between ticks", () => {
    const { pass, counts, setNow } = setupPlanes();
    pass.updateUnits(
      new Map([
        [
          1,
          unit({
            pos: tile(60, 20),
            lastPos: tile(50, 20),
            targetTile: tile(150, 20),
          }),
        ],
      ]),
      1,
      noStructures,
    );
    setNow(50);
    pass.drawShadows(cam);
    expect(counts.uploads[0][0]).toBeCloseTo(55.5);
  });

  test("shrinks before arrival (transport) but a bomber does not", () => {
    const sizeNearEnd = (type: string) => {
      const { pass, counts, setNow } = setupPlanes();
      const leg = (pos: number, lastPos: number, tick: number) =>
        pass.updateUnits(
          new Map([
            [
              1,
              unit({
                unitType: type,
                pos: tile(pos, 10),
                lastPos: tile(lastPos, 10),
                targetTile: tile(100, 10),
              }),
            ],
          ]),
          tick,
          noStructures,
        );
      leg(10, 0, 1); // took off from x = 0
      leg(98, 97, 2); // 98% of the way
      setNow(1e6);
      pass.drawShadows(cam);
      return counts.uploads[counts.uploads.length - 1][3];
    };
    expect(sizeNearEnd(UT_TRANSPORT_PLANE)).toBeLessThan(22 * 0.6);
    expect(sizeNearEnd(UT_BOMBER)).toBeCloseTo(26);
  });

  test("cargo planes are translucent and use their structure target", () => {
    const { pass, counts, setNow } = setupPlanes();
    const airport = unit({ id: 9, pos: tile(150, 40) });
    pass.updateUnits(
      new Map([
        [
          1,
          unit({
            unitType: UT_CARGO_PLANE,
            pos: tile(70, 40),
            lastPos: tile(60, 40),
            targetUnitId: 9,
          }),
        ],
      ]),
      1,
      new Map([[9, airport]]),
    );
    setNow(100);
    pass.drawShadows(cam);
    const inst = counts.uploads[0];
    expect(inst[6]).toBeLessThan(1); // alpha
    expect(inst[2]).toBeCloseTo(Math.PI / 2);
  });

  test("keeps heading while stationary and drops finished planes", () => {
    const { pass, counts, setNow } = setupPlanes();
    const moving = unit({ pos: tile(50, 50), lastPos: tile(50, 60) });
    pass.updateUnits(new Map([[1, moving]]), 1, noStructures);
    const still = unit({ pos: tile(50, 50), lastPos: tile(50, 50) });
    pass.updateUnits(new Map([[1, still]]), 2, noStructures);
    setNow(100);
    pass.drawShadows(cam);
    expect(counts.uploads[0][2]).toBeCloseTo(0); // north
    pass.updateUnits(new Map(), 3, noStructures);
    expect(pass.planeCount).toBe(0);
  });

  test("bomberPosition prefers the attacker's bomber", () => {
    const { pass, setNow } = setupPlanes();
    pass.updateUnits(
      new Map([
        [
          1,
          unit({
            id: 1,
            unitType: UT_BOMBER,
            ownerID: 1,
            pos: tile(10, 10),
            lastPos: tile(10, 10),
          }),
        ],
        [
          2,
          unit({
            id: 2,
            unitType: UT_BOMBER,
            ownerID: 2,
            pos: tile(90, 90),
            lastPos: tile(90, 90),
          }),
        ],
      ]),
      1,
      noStructures,
    );
    setNow(0);
    const out = { x: 0, y: 0 };
    expect(pass.bomberPosition(2, 12, 12, out)).toBe(true);
    expect(out.x).toBeCloseTo(90);
    expect(pass.bomberPosition(7, 12, 12, out)).toBe(true); // no such owner: nearest
    expect(out.x).toBeCloseTo(10);
  });

  test("disposes its GPU programs", () => {
    const { pass, counts } = setupPlanes();
    pass.dispose();
    expect(counts.deletedPrograms).toBe(2);
  });
});

describe("AirFxPass", () => {
  function setup() {
    const { gl, counts } = countingGL();
    const pass = new AirFxPass(gl, {} as WebGLTexture);
    let now = 0;
    pass.setTimeFn(() => now);
    return { pass, counts, setNow: (t: number) => (now = t) };
  }

  test("idle draws nothing", () => {
    const { pass, counts } = setup();
    expect(pass.isIdle()).toBe(true);
    pass.draw(cam, 2);
    expect(counts.arrays).toBe(0);
  });

  test("a bomb falls, then lands once: a flash and the blast callback", () => {
    const { pass, counts, setNow } = setup();
    const landed = vi.fn();
    pass.setBombLandHandler(landed);
    pass.spawnBomb(10, 10, 30, 10);
    pass.draw(cam, 2);
    expect(counts.arrays).toBe(1); // the bomb
    expect(landed).not.toHaveBeenCalled();
    setNow(BOMB_FALL_MS);
    counts.arrays = 0;
    pass.draw(cam, 2);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(landed).toHaveBeenCalledWith(30, 10);
    expect(counts.arrays).toBe(1); // the flash
    setNow(BOMB_FALL_MS + FLASH_MS);
    pass.draw(cam, 2);
    expect(landed).toHaveBeenCalledTimes(1);
    expect(pass.isIdle()).toBe(true);
  });

  test("a run of drops lands one after another", () => {
    const { pass, setNow } = setup();
    const landed = vi.fn();
    pass.setBombLandHandler(landed);
    for (let i = 0; i < 8; i++) {
      setNow(i * 100);
      pass.spawnBomb(0, 0, i * 6, 0);
      pass.draw(cam, 2);
    }
    for (let t = 800; t <= 7 * 100 + BOMB_FALL_MS + 50; t += 50) {
      setNow(t);
      pass.draw(cam, 2);
    }
    expect(landed.mock.calls.map((c) => c[0])).toEqual([
      0, 6, 12, 18, 24, 30, 36, 42,
    ]);
  });

  test("a paradrop draws a handful of parachutes for ~1.5 s", () => {
    const { pass, counts, setNow } = setup();
    pass.spawnParadrop(40, 40, 3);
    pass.draw(cam, 2);
    expect(counts.arrays).toBeGreaterThanOrEqual(5);
    setNow(PARACHUTE_MS);
    counts.arrays = 0;
    pass.draw(cam, 2);
    expect(counts.arrays).toBe(0);
    expect(pass.isIdle()).toBe(true);
  });

  test("a barrage impact flash lives FLASH_MS", () => {
    const { pass, counts, setNow } = setup();
    pass.spawnFlash(5, 5);
    pass.draw(cam, 2);
    expect(counts.arrays).toBe(1);
    setNow(FLASH_MS);
    pass.draw(cam, 2);
    expect(pass.isIdle()).toBe(true);
  });

  test("disposes its program", () => {
    const { pass, counts } = setup();
    pass.dispose();
    expect(counts.deletedPrograms).toBe(1);
  });
});

describe("PlanePass interceptions", () => {
  const plane = (over: Partial<UnitState> = {}) =>
    unit({
      id: 1,
      pos: tile(50, 100),
      lastPos: tile(44, 100),
      targetTile: tile(150, 100),
      ...over,
    });
  const missile = (target: number, id = 9) =>
    unit({
      id,
      unitType: UT_SAM_MISSILE,
      ownerID: 5,
      pos: tile(60, 100),
      lastPos: tile(58, 100),
      targetUnitId: target,
    });

  test("a hunted plane that vanishes unfinished is shot down", () => {
    const { pass } = setupPlanes();
    pass.updateUnits(
      new Map([
        [1, plane()],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    pass.updateUnits(new Map(), 2, noStructures);
    const hit = pass.takeShotDown(UT_TRANSPORT_PLANE, 3, tile(52, 100), false);
    expect(hit).not.toBeNull();
    expect(hit?.x).toBe(52);
    // consumed
    expect(
      pass.takeShotDown(UT_TRANSPORT_PLANE, 3, tile(52, 100), false),
    ).toBeNull();
  });

  test("arriving at the target is not a shoot-down, even when hunted", () => {
    const { pass } = setupPlanes();
    pass.updateUnits(
      new Map([
        [1, plane()],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    pass.updateUnits(new Map(), 2, noStructures);
    expect(
      pass.takeShotDown(UT_TRANSPORT_PLANE, 3, tile(52, 100), true),
    ).toBeNull();
  });

  test("a plane lost with no missile after it is not a shoot-down", () => {
    const { pass } = setupPlanes();
    pass.updateUnits(new Map([[1, plane()]]), 1, noStructures);
    pass.updateUnits(new Map(), 2, noStructures);
    expect(
      pass.takeShotDown(UT_TRANSPORT_PLANE, 3, tile(52, 100), false),
    ).toBeNull();
  });

  test("cargo planes are never wrecked", () => {
    const { pass } = setupPlanes();
    pass.updateUnits(
      new Map([
        [1, plane({ unitType: UT_CARGO_PLANE })],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    pass.updateUnits(new Map(), 2, noStructures);
    expect(
      pass.takeShotDown(UT_CARGO_PLANE, 3, tile(52, 100), false),
    ).toBeNull();
  });

  test("a wreck is drawn for about a second, then gone", () => {
    const { pass, counts, setNow } = setupPlanes();
    pass.spawnWreck(50, 100, 0, 0, 3, UT_TRANSPORT_PLANE);
    setNow(500);
    pass.drawShadows(cam);
    pass.drawAir(cam);
    expect(counts.instanced).toBe(2); // shadow + plane, no contrail
    const before = counts.instanced;
    setNow(1100);
    pass.drawShadows(cam);
    pass.drawAir(cam);
    expect(counts.instanced).toBe(before);
  });

  test("a bomber whose missile vanished flies on: evade flare", () => {
    const { pass } = setupPlanes();
    const flares: number[][] = [];
    pass.setEvadeHandler((x, y) => flares.push([x, y]));
    const bomber = plane({ unitType: UT_BOMBER });
    pass.updateUnits(
      new Map([
        [1, bomber],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    expect(flares).toEqual([]);
    pass.updateUnits(new Map([[1, bomber]]), 2, noStructures);
    expect(flares).toEqual([[50, 100]]);
  });

  test("a missile vanishing with its transport plane gone makes no flare", () => {
    const { pass } = setupPlanes();
    const flares: number[][] = [];
    pass.setEvadeHandler((x, y) => flares.push([x, y]));
    pass.updateUnits(
      new Map([
        [1, plane({ unitType: UT_BOMBER })],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    pass.updateUnits(new Map(), 2, noStructures);
    expect(flares).toEqual([]);
  });

  test("a transport plane never triggers the evade flare", () => {
    const { pass } = setupPlanes();
    const flares: number[][] = [];
    pass.setEvadeHandler((x, y) => flares.push([x, y]));
    const p = plane();
    pass.updateUnits(
      new Map([
        [1, p],
        [9, missile(1)],
      ]),
      1,
      noStructures,
    );
    pass.updateUnits(new Map([[1, p]]), 2, noStructures);
    expect(flares).toEqual([]);
  });
});

describe("PlanePass flies the straight line, not the tile staircase", () => {
  // The engine's flight path, on a W x W map.
  const map = {
    x: (t: number) => t % W,
    y: (t: number) => Math.floor(t / W),
    ref: (x: number, y: number) => y * W + x,
    isValidCoord: (x: number, y: number) =>
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      x < W &&
      y >= 0 &&
      y < W,
  } as unknown as GameMap;

  interface Frame {
    x: number;
    y: number;
    heading: number;
    size: number;
    trail: number;
  }

  /**
   * Fly `path` tick by tick (100 ms each), drawing 6 frames a tick, the way
   * the client sees it: pos = path[k], lastPos = path[k - 1].
   */
  function fly(
    path: number[],
    over: Partial<UnitState>,
    structures: ReadonlyMap<number, UnitState> = noStructures,
  ): Frame[] {
    const { pass, counts, setNow } = setupPlanes();
    const frames: Frame[] = [];
    for (let k = 0; k < path.length; k++) {
      setNow(k * 100);
      const plane = unit({
        pos: path[k],
        lastPos: path[Math.max(0, k - 1)],
        ...over,
      });
      pass.updateUnits(new Map([[1, plane]]), k + 1, structures);
      for (let f = 1; f <= 6; f++) {
        setNow(k * 100 + (f * 100) / 6);
        counts.uploads.length = 0;
        pass.drawShadows(cam);
        const inst = counts.uploads[0];
        frames.push({
          x: inst[0] - 0.5,
          y: inst[1] - 0.5,
          heading: inst[2],
          size: inst[3],
          trail: inst[7],
        });
      }
    }
    return frames;
  }

  // Instances are float32: compare to its precision.
  const ANGLE_EPS = 1e-5;
  const TILE_EPS = 1e-3;

  function expectStraightGlide(
    frames: Frame[],
    from: [number, number],
    to: [number, number],
  ): void {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const len = Math.hypot(dx, dy);
    const heading = Math.atan2(dx, -dy);
    let prevAlong = -Infinity;
    for (const [i, f] of frames.entries()) {
      // One heading for the whole flight: no shaking.
      expect(Math.abs(f.heading - heading), `heading @${i}`).toBeLessThan(
        ANGLE_EPS,
      );
      // On the line, never beside it.
      const rx = f.x - from[0];
      const ry = f.y - from[1];
      const off = Math.abs(rx * dy - ry * dx) / len;
      expect(off, `off the line @${i}`).toBeLessThan(TILE_EPS);
      // Never backwards.
      const along = (rx * dx + ry * dy) / len;
      expect(along, `backwards @${i}`).toBeGreaterThanOrEqual(
        prevAlong - TILE_EPS,
      );
      prevAlong = along;
    }
    // Starts on the airport, ends on the line's end.
    expect(Math.abs(frames[0].x - from[0])).toBeLessThan(TILE_EPS);
    expect(Math.abs(frames[0].y - from[1])).toBeLessThan(TILE_EPS);
    const last = frames[frames.length - 1];
    expect(Math.abs(last.x - to[0])).toBeLessThan(TILE_EPS);
    expect(Math.abs(last.y - to[1])).toBeLessThan(TILE_EPS);
  }

  /** The distance flown each tick, at the end of each tick. */
  function perTick(frames: Frame[], from: [number, number]): number[] {
    const out: number[] = [];
    let prev = 0;
    for (let i = 5; i < frames.length; i += 6) {
      const d = Math.hypot(frames[i].x - from[0], frames[i].y - from[1]);
      out.push(d - prev);
      prev = d;
    }
    return out;
  }

  test("a diagonal transport flight: one heading, on the line, even speed", () => {
    const from: [number, number] = [10, 10];
    const to: [number, number] = [160, 70];
    const path = straightFlightPath(map, tile(...from), tile(...to), 3);
    // The staircase itself: step headings swing by more than 10 degrees.
    const steps = path.slice(1).map((t, i) => {
      const p = path[i];
      return Math.atan2(
        (t % W) - (p % W),
        -((t - (t % W)) / W - (p - (p % W)) / W),
      );
    });
    expect(Math.max(...steps) - Math.min(...steps)).toBeGreaterThan(0.17);

    const frames = fly(path, { targetTile: tile(...to) });
    expectStraightGlide(frames, from, to);
    const ticks = perTick(frames, from).slice(1); // tick 0 sits on the airport
    const step = Math.hypot(150, 60) / (path.length - 1);
    for (const d of ticks) expect(Math.abs(d - step)).toBeLessThan(TILE_EPS);
  });

  test("a cargo flight between airports glides on its line", () => {
    const from: [number, number] = [20, 150];
    const to: [number, number] = [130, 40];
    const path = straightFlightPath(map, tile(...from), tile(...to), 3);
    const dest = unit({
      id: 9,
      unitType: "Airport",
      ownerID: 4,
      pos: tile(...to),
    });
    const frames = fly(
      path,
      { unitType: UT_CARGO_PLANE, targetUnitId: 9 },
      new Map([[9, dest]]),
    );
    expectStraightGlide(frames, from, to);
  });

  test("a bomber flies through the aim on to its last drop point", () => {
    const from: [number, number] = [15, 20];
    const aim: [number, number] = [110, 95];
    const drops = carpetDropTiles(map as never, tile(...from), tile(...aim));
    const end = drops[drops.length - 1];
    const path = straightFlightPath(map, tile(...from), end, 3);
    const frames = fly(path, { unitType: UT_BOMBER, targetTile: tile(...aim) });
    expectStraightGlide(frames, from, [end % W, (end - (end % W)) / W]);
  });

  test("seen first in mid-flight, it finds its airport's line", () => {
    const from: [number, number] = [12, 180];
    const to: [number, number] = [170, 30];
    const path = straightFlightPath(map, tile(...from), tile(...to), 3);
    const airport = unit({
      id: 5,
      unitType: "Airport",
      ownerID: 3,
      pos: tile(...from),
    });
    const frames = fly(
      path.slice(9),
      { targetTile: tile(...to) },
      new Map([[5, airport]]),
    );
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    for (const f of frames) {
      expect(Math.abs(f.heading - Math.atan2(dx, -dy))).toBeLessThan(ANGLE_EPS);
      const off = Math.abs((f.x - from[0]) * dy - (f.y - from[1]) * dx);
      expect(off / Math.hypot(dx, dy)).toBeLessThan(TILE_EPS);
    }
  });
});

describe("PlanePass on the engine's real flights", () => {
  const ANGLE_EPS = 1e-5;
  const TILE_EPS = 1e-3;

  interface Flown {
    frames: { x: number; y: number; heading: number }[];
    airport: { x: number; y: number };
  }

  /**
   * Run the game tick by tick and draw the plane `planeOf` finds the way the
   * client would: its tile and last tile each tick, six frames a tick.
   */
  function flyEngine(
    game: Game,
    planeOf: () => Unit | undefined,
    maxTicks: number,
  ): Flown {
    const { gl, counts } = countingGL();
    const pass = new PlanePass(
      gl,
      { mapWidth: game.width(), mapHeight: game.height() } as never,
      {} as WebGLTexture,
      config,
    );
    let now = 0;
    pass.setTimeFn(() => now);
    const frames: Flown["frames"] = [];
    let airport: Flown["airport"] | null = null;
    let seen = false;
    for (let tick = 1; tick <= maxTicks; tick++) {
      game.executeNextTick();
      const p = planeOf();
      if (p === undefined || !p.isActive()) {
        if (seen) break;
        continue;
      }
      if (!seen) airport = { x: game.x(p.tile()), y: game.y(p.tile()) };
      seen = true;
      const structures = new Map<number, UnitState>();
      for (const a of game.units(UnitType.Airport)) {
        structures.set(
          a.id(),
          unit({
            id: a.id(),
            unitType: "Airport",
            ownerID: a.owner().smallID(),
            pos: a.tile(),
          }),
        );
      }
      const state = unit({
        id: p.id(),
        unitType: p.type(),
        ownerID: p.owner().smallID(),
        pos: p.tile(),
        lastPos: p.lastTile(),
        targetTile: p.targetTile() ?? null,
        targetUnitId: p.targetUnit()?.id() ?? null,
      });
      now = tick * 100;
      pass.updateUnits(new Map([[p.id(), state]]), tick, structures);
      for (let f = 1; f <= 6; f++) {
        now = tick * 100 + (f * 100) / 6;
        counts.uploads.length = 0;
        pass.drawShadows(cam);
        const inst = counts.uploads[0];
        frames.push({ x: inst[0] - 0.5, y: inst[1] - 0.5, heading: inst[2] });
      }
    }
    expect(airport).not.toBeNull();
    return { frames, airport: airport! };
  }

  /** Straight from the airport towards `end`: one heading, on the line, forward. */
  function expectFlight(
    { frames, airport }: Flown,
    end: { x: number; y: number },
  ): void {
    const dx = end.x - airport.x;
    const dy = end.y - airport.y;
    const len = Math.hypot(dx, dy);
    expect(frames.length).toBeGreaterThan(30);
    expect(Math.abs(frames[0].x - airport.x)).toBeLessThan(TILE_EPS);
    expect(Math.abs(frames[0].y - airport.y)).toBeLessThan(TILE_EPS);
    let prev = -Infinity;
    for (const [i, f] of frames.entries()) {
      expect(
        Math.abs(f.heading - Math.atan2(dx, -dy)),
        `heading @${i}`,
      ).toBeLessThan(ANGLE_EPS);
      const rx = f.x - airport.x;
      const ry = f.y - airport.y;
      expect(Math.abs(rx * dy - ry * dx) / len, `off @${i}`).toBeLessThan(
        TILE_EPS,
      );
      const along = (rx * dx + ry * dy) / len;
      expect(along, `back @${i}`).toBeGreaterThanOrEqual(prev - TILE_EPS);
      prev = along;
    }
    // The same distance every tick: each tick's tile is matched to its step
    // of the engine's path, not projected (no uneven staircase steps).
    const step = len / flightSteps(dx, dy);
    let flownBefore = 0;
    for (let i = 5; i < frames.length; i += 6) {
      const flown = Math.hypot(
        frames[i].x - airport.x,
        frames[i].y - airport.y,
      );
      const d = flown - flownBefore;
      flownBefore = flown;
      if (i === 5) continue; // the take-off tick sits on the airport
      expect(Math.abs(d - step), `tick ${(i - 5) / 6}`).toBeLessThan(TILE_EPS);
    }
    // The last tick before it lands is one step short of the end.
    const last = frames[frames.length - 1];
    expect(Math.hypot(last.x - end.x, last.y - end.y)).toBeLessThanOrEqual(
      PLANE_SPEED + TILE_EPS,
    );
  }

  async function airfield(map: string) {
    const game = await warfareGame(map, { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 60, 40, 40, 60);
    red.addGold(10_000_000n);
    red.addTroops(100_000);
    blue.addTroops(100_000);
    return { game, red, blue };
  }

  test("a paradrop flies from its airport straight to the drop tile", async () => {
    const { game, red } = await airfield("big_plains");
    red.buildUnit(UnitType.Airport, game.ref(10, 10), {});
    const dst = { x: 97, y: 71 };
    game.addExecution(
      new ParadropExecution(red, 20_000, game.ref(dst.x, dst.y)),
    );
    const flown = flyEngine(
      game,
      () => red.units(UnitType.TransportPlane)[0],
      200,
    );
    expect(flown.airport).toEqual({ x: 10, y: 10 });
    expectFlight(flown, dst);
  });

  test("a bomber flies through its aim to the last drop point on the map", async () => {
    const { game, red } = await airfield("plains");
    red.buildUnit(UnitType.Airport, game.ref(5, 8), {});
    const aim = { x: 88, y: 93 };
    game.addExecution(
      new ConstructionExecution(red, UnitType.Bomber, game.ref(aim.x, aim.y)),
    );
    const flown = flyEngine(game, () => red.units(UnitType.Bomber)[0], 200);
    const onMap = carpetBombPoints(5, 8, aim.x, aim.y).filter(
      (p) => p.x < 100 && p.y < 100,
    );
    expect(onMap.length).toBeLessThan(8); // its last points are off the map
    expectFlight(flown, onMap[onMap.length - 1]);
  });

  test("a cargo plane flies from its airport straight to the other one", async () => {
    const game = await warfareGame("big_plains", { instantBuild: true });
    const red = own(game, RED.id, 0, 0, 30, 30);
    const blue = own(game, BLUE.id, 110, 70, 20, 20);
    red.addGold(10_000_000n);
    blue.addGold(10_000_000n);
    game.addExecution(
      new ConstructionExecution(red, UnitType.Airport, game.ref(12, 9)),
      new ConstructionExecution(blue, UnitType.Airport, game.ref(121, 83)),
    );
    const flown = flyEngine(game, () => red.units(UnitType.CargoPlane)[0], 600);
    expect(flown.airport).toEqual({ x: 12, y: 9 });
    expectFlight(flown, { x: 121, y: 83 });
  });
});
