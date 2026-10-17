import type { GameMap } from "@openfront/engine-api/game/GameMap";
import {
  carpetBombPoints,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { carpetDropTiles } from "@openfront/engine/warfare/Carpet";
import { straightFlightPath } from "@openfront/engine/warfare/FlightPath";
import { describe, expect, test } from "vitest";
import {
  bomberFlightEnd,
  findFlightPath,
  flightSteps,
  nextTickSpan,
  PlaneTrack,
  stepOnPath,
} from "../../../../src/client/render/frame/derive/PlaneTrack";

const W = 400;
const H = 300;
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
    y < H,
} as unknown as GameMap;

/** A small seeded generator, so the sweep is the same every run. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe("the engine's flight path, rebuilt", () => {
  test("every tile of every straight flight is found at its own step", () => {
    const rand = lcg(7);
    for (let n = 0; n < 1500; n++) {
      const ox = Math.floor(rand() * W);
      const oy = Math.floor(rand() * H);
      // Mostly long flights, some very short ones.
      const r = n % 5 === 0 ? 6 : 220;
      const ex = Math.min(
        W - 1,
        Math.max(0, ox + Math.round((rand() - 0.5) * r)),
      );
      const ey = Math.min(
        H - 1,
        Math.max(0, oy + Math.round((rand() - 0.5) * r)),
      );
      const path = straightFlightPath(
        map,
        map.ref(ox, oy),
        map.ref(ex, ey),
        PLANE_SPEED,
      );
      const steps = flightSteps(ex - ox, ey - oy);
      expect(steps).toBe(path.length - 1);
      path.forEach((t, k) => {
        const x = map.x(t);
        const y = map.y(t);
        // A flight to its own tile is [t, t]: either step is that tile.
        if (ox === ex && oy === ey) {
          expect(stepOnPath(ox, oy, ex, ey, steps, x, y)).toBe(0);
          return;
        }
        expect(stepOnPath(ox, oy, ex, ey, steps, x, y)).toBe(k);
      });
    }
  });

  test("a tile beside the path is not on it", () => {
    const steps = flightSteps(150, 60);
    const path = straightFlightPath(map, map.ref(10, 10), map.ref(160, 70), 3);
    const t = path[7];
    expect(stepOnPath(10, 10, 160, 70, steps, map.x(t), map.y(t))).toBe(7);
    expect(stepOnPath(10, 10, 160, 70, steps, map.x(t), map.y(t) + 1)).toBe(-1);
    expect(stepOnPath(10, 10, 160, 70, steps, map.x(t) + 1, map.y(t))).toBe(-1);
  });

  test("a bomber stops on its carpet's last on-map drop point", () => {
    const rand = lcg(11);
    for (let n = 0; n < 300; n++) {
      const ox = Math.floor(rand() * W);
      const oy = Math.floor(rand() * H);
      const ax = Math.floor(rand() * W);
      const ay = Math.floor(rand() * H);
      const drops = carpetDropTiles(
        map as never,
        map.ref(ox, oy),
        map.ref(ax, ay),
      );
      const end = bomberFlightEnd(ox, oy, ax, ay, W, H);
      if (drops.length === 0) {
        expect(end).toBeNull();
        continue;
      }
      const last = drops[drops.length - 1];
      // (+ 0: a point rounded from just below 0 is -0, the same tile.)
      expect([end!.x + 0, end!.y + 0]).toEqual([map.x(last), map.y(last)]);
    }
  });

  test("a bomber aimed past the map edge stops at the last point on it", () => {
    const pts = carpetBombPoints(5, 5, 290, 290);
    expect(pts[pts.length - 1].y).toBeGreaterThanOrEqual(H);
    const end = bomberFlightEnd(5, 5, 290, 290, W, H)!;
    expect(end.y).toBeLessThan(H);
    expect(pts).toContainEqual(end);
  });

  test("findFlightPath picks the origin whose path both tiles lie on", () => {
    const path = straightFlightPath(map, map.ref(20, 200), map.ref(180, 40), 3);
    const at = (k: number) => [map.x(path[k]), map.y(path[k])] as const;
    const [x, y] = at(12);
    const [lx, ly] = at(11);
    const found = findFlightPath(
      [
        { x: 60, y: 60 }, // another airport
        { x: lx, y: ly }, // where it was first seen
        { x: 20, y: 200 }, // the airport it left
      ],
      () => ({ x: 180, y: 40 }),
      x,
      y,
      lx,
      ly,
    );
    // The first-seen tile's own path happens to hold neither, or both:
    // either way the answer is a path both tiles are on.
    expect(found).not.toBeNull();
    const f = found!;
    expect(stepOnPath(f.ox, f.oy, f.ex, f.ey, f.steps, x, y)).toBeGreaterThan(
      0,
    );
    expect(
      findFlightPath(
        [
          { x: 60, y: 60 },
          { x: 20, y: 200 },
        ],
        () => ({ x: 180, y: 40 }),
        x,
        y,
        lx,
        ly,
      ),
    ).toEqual({ ox: 20, oy: 200, ex: 180, ey: 40, steps: path.length - 1 });
    expect(
      findFlightPath(
        [{ x: 60, y: 60 }],
        () => ({ x: 180, y: 40 }),
        x,
        y,
        lx,
        ly,
      ),
    ).toBeNull();
  });
});

describe("nextTickSpan", () => {
  test("follows the time between ticks", () => {
    let span = 100;
    for (let i = 0; i < 30; i++) span = nextTickSpan(span, 25, 100);
    expect(span).toBeCloseTo(25, 1);
    for (let i = 0; i < 30; i++) span = nextTickSpan(span, 100, 100);
    expect(span).toBeCloseTo(100, 1);
  });

  test("a long pause or a burst only nudges it, within bounds", () => {
    expect(nextTickSpan(100, 60_000, 100)).toBeLessThanOrEqual(200);
    expect(nextTickSpan(100, 60_000, 100)).toBeGreaterThan(100);
    let span = 100;
    for (let i = 0; i < 50; i++) span = nextTickSpan(span, 0, 100);
    expect(span).toBeGreaterThanOrEqual(10);
  });
});

describe("PlaneTrack", () => {
  /** A track on the engine path from (10, 10) to (160, 70), 3 tiles a tick. */
  function diagonal() {
    const path = straightFlightPath(map, map.ref(10, 10), map.ref(160, 70), 3);
    const track = new PlaneTrack(10, 10);
    track.setLine(10, 10, 160, 70, path.length - 1, 0);
    return { path, track };
  }

  test("each tick's tile is drawn at its step's exact point on the line", () => {
    const { path, track } = diagonal();
    const len = Math.hypot(150, 60);
    const out = { x: 0, y: 0 };
    path.forEach((t, k) => {
      const along = track.alongOf(map.x(t), map.y(t));
      expect(along).toBeCloseTo((k * len) / (path.length - 1), 9);
      track.pointAt(along, out);
      expect(out.x).toBeCloseTo(10 + (150 * k) / (path.length - 1), 9);
      expect(out.y).toBeCloseTo(10 + (60 * k) / (path.length - 1), 9);
    });
    expect(track.heading).toBeCloseTo(Math.atan2(150, -60), 12);
    // Off the path: not a step of it.
    expect(track.alongOf(map.x(path[3]), map.y(path[3]) + 1)).toBeNaN();
  });

  test("ticks that come early or late never make it jump or go back", () => {
    const { path, track } = diagonal();
    const gaps = [100, 60, 140, 100, 30, 170, 100, 85, 115, 100];
    let now = 0;
    let span = 100;
    let prev = 0;
    let maxStep = 0;
    track.jumpTo(0, 0);
    for (let k = 1; k <= gaps.length; k++) {
      const t = path[k];
      track.glideTo(track.alongOf(map.x(t), map.y(t)), now, span);
      const next = now + gaps[k - 1];
      for (let ms = now; ms < next; ms += 2) {
        const s = track.shownAt(ms);
        expect(s).toBeGreaterThanOrEqual(prev - 1e-12);
        maxStep = Math.max(maxStep, s - prev);
        prev = s;
      }
      span = nextTickSpan(span, gaps[k - 1], 100);
      now = next;
    }
    // A tick is ~3.2 tiles over ~100 ms: 2 ms is a few hundredths of a tile.
    // A snap to the next tick's start would be a whole tile or more.
    expect(maxStep).toBeLessThan(0.25);
  });

  test("moving the line keeps the plane where it is drawn", () => {
    const track = new PlaneTrack(10, 10);
    track.setLine(10, 10, 110, 10, 0, 0);
    track.jumpTo(40, 0);
    const before = track.pointAt(track.shownAt(0), { x: 0, y: 0 });
    track.setLine(10, 10, 110, 10, 34, 0); // same line, now exact
    const after = track.pointAt(track.shownAt(0), { x: 0, y: 0 });
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
  });

  test("projects tiles onto the line when the path is unknown", () => {
    const track = new PlaneTrack(0, 0);
    track.setLine(0, 0, 100, 0, 0, 0);
    expect(track.exact).toBe(false);
    expect(track.alongOf(30, 1)).toBeCloseTo(30, 9);
    expect(track.alongOf(-5, 0)).toBe(0); // never behind its start
    expect(track.heading).toBeCloseTo(Math.PI / 2, 12);
  });
});
