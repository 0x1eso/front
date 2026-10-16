import { describe, expect, test } from "vitest";
import {
  BOMB_FALL_MS,
  bombFall,
  bombLanded,
  CONTRAIL_MAX_TILES,
  contrailLength,
  flightProgress,
  flightScale,
  FxPool,
  headingOf,
  MIN_SCALE,
  PARACHUTE_COUNT,
  PARACHUTE_MS,
  PARACHUTE_SPREAD,
  parachuteAt,
  PLANE_TYPES,
  planeAlpha,
  rotatesWithHeading,
  type ParachuteState,
} from "../../../../src/client/render/frame/derive/PlaneFx";
import {
  UT_ATOM_BOMB,
  UT_BOMBER,
  UT_CARGO_PLANE,
  UT_SHELL,
  UT_TRADE_SHIP,
  UT_TRANSPORT,
  UT_TRANSPORT_PLANE,
} from "../../../../src/client/render/types";

describe("which types rotate", () => {
  test("only the three planes", () => {
    for (const t of [UT_TRANSPORT_PLANE, UT_BOMBER, UT_CARGO_PLANE]) {
      expect(rotatesWithHeading(t)).toBe(true);
      expect(PLANE_TYPES.has(t)).toBe(true);
    }
    for (const t of [UT_TRANSPORT, UT_TRADE_SHIP, UT_ATOM_BOMB, UT_SHELL]) {
      expect(rotatesWithHeading(t)).toBe(false);
    }
  });

  test("only cargo planes are translucent", () => {
    expect(planeAlpha(UT_CARGO_PLANE)).toBeLessThan(1);
    expect(planeAlpha(UT_BOMBER)).toBe(1);
    expect(planeAlpha(UT_TRANSPORT_PLANE)).toBe(1);
  });
});

describe("headingOf", () => {
  test("nose-up sprite: north is 0, east a quarter turn clockwise", () => {
    expect(headingOf(0, -5, 9)).toBeCloseTo(0);
    expect(headingOf(5, 0, 9)).toBeCloseTo(Math.PI / 2);
    expect(headingOf(0, 5, 9)).toBeCloseTo(Math.PI);
    expect(headingOf(-5, 0, 9)).toBeCloseTo(-Math.PI / 2);
    expect(headingOf(3, -3, 9)).toBeCloseTo(Math.PI / 4);
  });

  test("keeps the previous heading while it is not moving", () => {
    expect(headingOf(0, 0, 1.25)).toBe(1.25);
  });
});

describe("flightScale", () => {
  test("transport and cargo planes start small, peak mid-flight, shrink at arrival", () => {
    for (const t of [UT_TRANSPORT_PLANE, UT_CARGO_PLANE]) {
      expect(flightScale(t, 0)).toBeCloseTo(MIN_SCALE);
      expect(flightScale(t, 0.5)).toBe(1);
      expect(flightScale(t, 1)).toBeCloseTo(MIN_SCALE);
      expect(flightScale(t, 0.05)).toBeGreaterThan(MIN_SCALE);
      expect(flightScale(t, 0.05)).toBeLessThan(1);
      expect(flightScale(t, 0.97)).toBeLessThan(1);
    }
  });

  test("a bomber grows after take-off but keeps its size over the target", () => {
    expect(flightScale(UT_BOMBER, 0)).toBeCloseTo(MIN_SCALE);
    expect(flightScale(UT_BOMBER, 1)).toBe(1);
  });

  test("is monotone through the take-off ramp", () => {
    let prev = 0;
    for (let p = 0; p <= 0.14; p += 0.01) {
      const s = flightScale(UT_TRANSPORT_PLANE, p);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  test("progress clamps and an unknown leg counts as arrived-safe", () => {
    expect(flightProgress(5, 10)).toBe(0.5);
    expect(flightProgress(50, 10)).toBe(1);
    expect(flightProgress(-1, 10)).toBe(0);
    expect(flightProgress(5, 0)).toBe(1);
    // unknown total -> mid-air size, no shrinking
    expect(flightScale(UT_TRANSPORT_PLANE, flightProgress(5, 0))).toBeCloseTo(
      MIN_SCALE,
    );
  });
});

describe("contrailLength", () => {
  test("never longer than the distance flown, capped by size", () => {
    expect(contrailLength(5, 1)).toBe(5);
    expect(contrailLength(500, 1)).toBe(CONTRAIL_MAX_TILES);
    expect(contrailLength(500, 0.5)).toBe(CONTRAIL_MAX_TILES * 0.5);
    expect(contrailLength(-3, 1)).toBe(0);
  });
});

describe("FxPool", () => {
  test("reuses free slots, then the oldest, without growing", () => {
    const pool = new FxPool(3, 1000);
    for (let i = 0; i < 3; i++) pool.spawn(i * 10).x = i;
    expect(pool.slots.filter((s) => s.active)).toHaveLength(3);
    const reused = pool.spawn(100);
    expect(reused.start).toBe(100);
    expect(pool.slots).toHaveLength(3);
    // the oldest (x = 0, start 0) was taken
    expect(pool.slots.map((s) => s.start).sort((a, b) => a - b)).toEqual([
      10, 20, 100,
    ]);
  });

  test("prune retires expired slots", () => {
    const pool = new FxPool(4, 100);
    pool.spawn(0);
    pool.spawn(60);
    expect(pool.prune(99)).toBe(2);
    expect(pool.prune(100)).toBe(1);
    expect(pool.hasActive()).toBe(true);
    expect(pool.prune(160)).toBe(0);
    expect(pool.hasActive()).toBe(false);
  });
});

describe("bombs", () => {
  test("fall accelerates and land after BOMB_FALL_MS", () => {
    expect(bombFall(0)).toBe(0);
    expect(bombFall(BOMB_FALL_MS)).toBe(1);
    expect(bombFall(BOMB_FALL_MS / 2)).toBeLessThan(0.5);
    expect(bombLanded(1000, 1000 + BOMB_FALL_MS - 1)).toBe(false);
    expect(bombLanded(1000, 1000 + BOMB_FALL_MS)).toBe(true);
  });
});

describe("parachutes", () => {
  const out: ParachuteState = { x: 0, y: 0, scale: 1, alpha: 1 };

  test("live for ~1.5 s, then gone", () => {
    expect(PARACHUTE_MS).toBe(1500);
    expect(parachuteAt(7, 0, 50, 50, 0, out)).toBe(true);
    expect(parachuteAt(7, 0, 50, 50, PARACHUTE_MS - 1, out)).toBe(true);
    expect(parachuteAt(7, 0, 50, 50, PARACHUTE_MS, out)).toBe(false);
    expect(parachuteAt(7, 0, 50, 50, -5, out)).toBe(false);
  });

  test("a handful drift out around the drop tile and fade at the end", () => {
    expect(PARACHUTE_COUNT).toBeGreaterThanOrEqual(5);
    const spots = new Set<string>();
    for (let i = 0; i < PARACHUTE_COUNT; i++) {
      parachuteAt(7, i, 50, 50, 1200, out);
      expect(Math.hypot(out.x - 50, out.y - 50)).toBeLessThanOrEqual(
        PARACHUTE_SPREAD + 3,
      );
      spots.add(`${out.x.toFixed(2)},${out.y.toFixed(2)}`);
    }
    expect(spots.size).toBe(PARACHUTE_COUNT);
    parachuteAt(7, 0, 50, 50, 100, out);
    expect(out.alpha).toBe(1);
    const early = out.scale;
    parachuteAt(7, 0, 50, 50, PARACHUTE_MS - 10, out);
    expect(out.alpha).toBeLessThan(0.1);
    expect(out.scale).toBeLessThan(early);
  });

  test("the same drop looks the same on every client", () => {
    const a: ParachuteState = { x: 0, y: 0, scale: 1, alpha: 1 };
    parachuteAt(99, 3, 10, 20, 700, out);
    parachuteAt(99, 3, 10, 20, 700, a);
    expect(a).toEqual(out);
  });
});
