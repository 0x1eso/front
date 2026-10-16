import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  CARPET_BOMB_OUTER,
  carpetBombPoints,
} from "@openfront/engine-lib/warfare/Warfare";
import { describe, expect, it } from "vitest";
import {
  airportAimRings,
  carpetAimRings,
  carpetTiles,
  carpetWouldBreakAlliance,
  flightSource,
  FLYER_MARK_RADIUS,
  warfareGhostRadius,
} from "../../src/client/controllers/WarfarePreview";

const W = 1000;
const dist2 = (a: number, b: number) => {
  const dx = (a % W) - (b % W);
  const dy = Math.floor(a / W) - Math.floor(b / W);
  return dx * dx + dy * dy;
};
const ref = (x: number, y: number) => y * W + x;

function unit(
  x: number,
  y: number,
  opts: Partial<{ level: number; busy: boolean }> = {},
) {
  return {
    tile: () => ref(x, y),
    level: () => opts.level ?? 1,
    isActive: () => true,
    isInCooldown: () => opts.busy ?? false,
    isUnderConstruction: () => false,
  };
}

describe("warfare ghost previews", () => {
  it("draws each unit's ring", () => {
    expect(warfareGhostRadius(UnitType.CoastalBattery, 1)).toBe(40);
    expect(warfareGhostRadius(UnitType.Airport, 1)).toBe(150);
    expect(warfareGhostRadius(UnitType.Airport, 3)).toBe(210);
    expect(warfareGhostRadius(UnitType.CoastalBarrage, 1)).toBe(12);
    // The bomber's 8 blasts are drawn along its line, not as one circle.
    expect(warfareGhostRadius(UnitType.Bomber, 1)).toBe(0);
    expect(warfareGhostRadius(UnitType.City, 1)).toBe(0);
  });

  it("a bomber leaves from the nearest airport with a free sortie in range", () => {
    const near = unit(100, 0, { busy: true });
    const far = unit(0, 0);
    const target = ref(140, 0);
    expect(flightSource([near, far], UnitType.Bomber, target, dist2)).toBe(
      far.tile(),
    );
    expect(flightSource([near], UnitType.Bomber, target, dist2)).toBeNull();
    expect(
      flightSource([unit(0, 0)], UnitType.Bomber, ref(170, 0), dist2),
    ).toBeNull();
    expect(
      flightSource(
        [unit(0, 0, { level: 2 })],
        UnitType.Bomber,
        ref(170, 0),
        dist2,
      ),
    ).toBe(ref(0, 0));
  });

  it("a barrage leaves from the nearest loaded silo at any distance", () => {
    const silos = [unit(0, 0), unit(150, 0)];
    expect(
      flightSource(silos, UnitType.CoastalBarrage, ref(190, 0), dist2),
    ).toBe(ref(150, 0));
    // Past the old 200-tile limit it still fires.
    expect(
      flightSource([unit(0, 0)], UnitType.CoastalBarrage, ref(500, 0), dist2),
    ).toBe(ref(0, 0));
    // But only a ready one.
    expect(
      flightSource(
        [unit(0, 0, { busy: true })],
        UnitType.CoastalBarrage,
        ref(5, 0),
        dist2,
      ),
    ).toBeNull();
  });

  const xy = (t: number) => ({ x: t % W, y: Math.floor(t / W) });

  it("aim rings: the range of each airport with a sortie, and a mark on the flyer", () => {
    const a = unit(100, 50);
    const busy = unit(10, 10, { busy: true });
    const b = unit(300, 50, { level: 2 });
    const rings = airportAimRings([a, busy, b], a.tile(), xy);
    expect(rings).toEqual([
      expect.objectContaining({ x: 100, y: 50, radius: 150, outline: true }),
      expect.objectContaining({ x: 300, y: 50, radius: 180, outline: true }),
      expect.objectContaining({
        x: 100,
        y: 50,
        radius: FLYER_MARK_RADIUS,
        outline: false,
      }),
    ]);
    // No airport reaches the aim: the ranges show, nothing is marked.
    expect(airportAimRings([a], null, xy)).toHaveLength(1);
  });

  it("the carpet circles are exactly the engine's carpetBombPoints", () => {
    const src = { x: 100, y: 100 };
    const aim = { x: 130, y: 140 };
    const rings = carpetAimRings(src, aim, false);
    const pts = carpetBombPoints(100, 100, 130, 140);
    expect(rings).toHaveLength(8);
    expect(rings.map((r) => [r.x, r.y])).toEqual(pts.map((p) => [p.x, p.y]));
    expect(rings.every((r) => r.radius === CARPET_BOMB_OUTER)).toBe(true);
    // Straight line from the airport through the aim.
    const mid = (pts[3].x + pts[4].x) / 2;
    expect(Math.abs(mid - 130)).toBeLessThanOrEqual(1);
    // A carpet that breaks an alliance turns red.
    expect(carpetAimRings(src, aim, true)[0].color).not.toEqual(rings[0].color);
  });

  it("carpetTiles skips blasts that fall off the map", () => {
    const game = {
      isValidCoord: (x: number, y: number) =>
        x >= 0 && y >= 0 && x < 50 && y < 50,
      ref: (x: number, y: number) => y * 50 + x,
    };
    // Aim at the map's corner: half the line is off the map.
    const tiles = carpetTiles({ x: 25, y: 25 }, { x: 0, y: 0 }, game);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(8);
  });

  it("the alliance warning looks at every blast of the carpet", () => {
    // An ally structure near only the last blast (tile 7) breaks the alliance.
    const game = {
      anyUnitNearby: (t: number) => t === 7,
      circleSearch: () => {},
      ownerID: () => 0,
    };
    const config = { nukeAllianceBreakThreshold: () => 100 };
    const allySmallIds = new Set([2]);
    const tiles = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(
      carpetWouldBreakAlliance({
        game: game as any,
        tiles,
        config,
        allySmallIds,
      }),
    ).toBe(true);
    expect(
      carpetWouldBreakAlliance({
        game: game as any,
        tiles: tiles.filter((t) => t !== 7),
        config,
        allySmallIds,
      }),
    ).toBe(false);
  });
});
