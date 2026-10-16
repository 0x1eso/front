import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  missileTargetPreview,
  satelliteSiloPreview,
} from "../../src/client/controllers/StrategicPreview";
import type { PlayerView } from "../../src/client/view";

const W = 100;
const at = (x: number, y: number) => y * W + x;

function unit(id: number, tile: number, owner: unknown, ready = true) {
  return {
    id: () => id,
    tile: () => tile,
    owner: () => owner,
    isActive: () => true,
    isUnderConstruction: () => false,
    isInCooldown: () => !ready,
  };
}

describe("strategic aim previews (the engine's rules)", () => {
  const ally = { id: () => "ally" };
  const enemy = { id: () => "enemy" };
  const silos = [unit(1, at(10, 10), null), unit(2, at(12, 10), null, false)];
  const me = {
    id: () => "me",
    isFriendly: (o: { id(): string }) => o.id() === "ally",
    units: (t: UnitType) => (t === UnitType.MissileSilo ? silos : []),
  } as unknown as PlayerView;
  const structures = {
    [UnitType.City]: [unit(7, at(50, 50), enemy), unit(3, at(50, 54), enemy)],
    [UnitType.Port]: [unit(8, at(48, 50), ally)],
    [UnitType.Factory]: [unit(9, at(20, 20), me)],
  } as Record<string, unknown[]>;
  const game = {
    units: (t: UnitType) => structures[t] ?? [],
    x: (t: number) => t % W,
    y: (t: number) => Math.floor(t / W),
  };

  test("the missile hits the nearest enemy building within 10 tiles, never a friend's or mine", () => {
    expect(missileTargetPreview(game as never, me, at(49, 51))?.id()).toBe(7);
    // Tied at 2 tiles: the lower id.
    expect(missileTargetPreview(game as never, me, at(50, 52))?.id()).toBe(3);
    expect(missileTargetPreview(game as never, me, at(47, 50))?.id()).toBe(7);
    expect(missileTargetPreview(game as never, me, at(20, 20))).toBeNull();
    expect(missileTargetPreview(game as never, me, at(70, 70))).toBeNull();
  });

  test("the satellite takes my nearest ready silo within 15 tiles", () => {
    expect(satelliteSiloPreview(game as never, me, at(13, 11))?.id()).toBe(1);
    expect(satelliteSiloPreview(game as never, me, at(40, 40))).toBeNull();
  });
});
