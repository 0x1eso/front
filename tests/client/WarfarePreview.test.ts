import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it } from "vitest";
import {
  flightSource,
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
    expect(warfareGhostRadius(UnitType.Bomber, 1)).toBe(18);
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

  it("a barrage leaves from the nearest loaded silo within 200 tiles", () => {
    const silos = [unit(0, 0), unit(150, 0)];
    expect(
      flightSource(silos, UnitType.CoastalBarrage, ref(190, 0), dist2),
    ).toBe(ref(150, 0));
    expect(
      flightSource([unit(0, 0)], UnitType.CoastalBarrage, ref(250, 0), dist2),
    ).toBeNull();
  });
});
