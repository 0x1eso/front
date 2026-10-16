import { describe, expect, test, vi } from "vitest";
import {
  BOMB_FALL_MS,
  FLASH_MS,
  PARACHUTE_MS,
} from "../../../../src/client/render/frame/derive/PlaneFx";
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
const header = { mapWidth: W } as never;
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
    const plane = unit({
      pos: tile(50, 100),
      lastPos: tile(44, 100),
      targetTile: tile(150, 100),
    });
    pass.updateUnits(new Map([[1, plane]]), 1, noStructures);
    setNow(100); // end of the tick: at pos
    pass.drawShadows(cam);
    const inst = counts.uploads[0];
    expect(inst[0]).toBeCloseTo(50.5);
    expect(inst[1]).toBeCloseTo(100.5);
    expect(inst[2]).toBeCloseTo(Math.PI / 2);
    // flown 6 of 100 tiles: still small, but bigger than the minimum
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
