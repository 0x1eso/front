import { describe, expect, it, vi } from "vitest";
import {
  structureRings,
  WarfareRingPass,
  zoneRings,
} from "../../../../src/client/render/gl/passes/WarfareRingPass";
import type { UnitState } from "../../../../src/client/render/types";
import {
  UT_AIRPORT,
  UT_CITY,
  UT_COASTAL_BARRAGE,
  UT_COASTAL_BATTERY,
} from "../../../../src/client/render/types";

const MAP_W = 100;

function unit(
  id: number,
  unitType: string,
  ownerID: number,
  pos: number,
  extra: Partial<UnitState> = {},
): UnitState {
  return {
    id,
    unitType,
    ownerID,
    lastOwnerID: null,
    pos,
    lastPos: pos,
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
    ...extra,
  };
}

function units(...list: UnitState[]): Map<number, UnitState> {
  return new Map(list.map((u) => [u.id, u]));
}

/** A GL stand-in that counts draw calls. */
function countingGL() {
  const counts = { draws: 0 };
  const gl = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
        if (prop === "drawArrays") return () => counts.draws++;
        return () => ({});
      },
    },
  ) as WebGL2RenderingContext;
  return { gl, counts };
}

describe("warfare rings", () => {
  it("rings a battery's reach and an airport's range, coloured by owner", () => {
    const rings = structureRings(
      units(
        unit(1, UT_COASTAL_BATTERY, 1, 5 * MAP_W + 7),
        unit(2, UT_AIRPORT, 2, 10, { level: 2 }),
        unit(3, UT_CITY, 1, 20),
        unit(4, UT_AIRPORT, 3, 30, { underConstruction: true }),
      ),
      MAP_W,
      1,
      new Set([2]),
    );
    expect(rings.map((r) => [r.x, r.y, r.radius])).toEqual([
      [7, 5, 40],
      [10, 0, 180],
    ]);
    expect(rings[0].color).not.toEqual(rings[1].color);
    expect(rings.every((r) => r.outline)).toBe(true);
  });

  it("rings every barrage zone", () => {
    expect(
      zoneRings(units(unit(9, UT_COASTAL_BARRAGE, 4, 2 * MAP_W + 3)), MAP_W),
    ).toEqual([
      expect.objectContaining({ x: 3, y: 2, radius: 12, outline: false }),
    ]);
  });

  it("draws zones always and structure rings only while shown", () => {
    const { gl, counts } = countingGL();
    const pass = new WarfareRingPass(gl, MAP_W, true);
    pass.updateStructures(units(unit(1, UT_COASTAL_BATTERY, 1, 7)));
    pass.updateUnits(units(unit(9, UT_COASTAL_BARRAGE, 4, 3)));
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(1);
    pass.setVisible(true);
    pass.draw(new Float32Array(9));
    expect(counts.draws).toBe(3);
    pass.dispose();
  });

  it("does no work with the option off", () => {
    const { gl, counts } = countingGL();
    const pass = new WarfareRingPass(gl, MAP_W, false);
    const rebuild = vi.spyOn(pass as any, "rebuild");
    pass.setVisible(true);
    pass.setLocalPlayer(1);
    pass.setAllies(new Set([2]));
    pass.updateStructures(units(unit(1, UT_COASTAL_BATTERY, 1, 7)));
    pass.updateUnits(units(unit(9, UT_COASTAL_BARRAGE, 4, 3)));
    pass.draw(new Float32Array(9));
    expect(rebuild).not.toHaveBeenCalled();
    expect(counts.draws).toBe(0);
  });

  it("rebuilds the structure rings only when the allies really change", () => {
    const { gl } = countingGL();
    const pass = new WarfareRingPass(gl, MAP_W, true);
    pass.updateStructures(units(unit(1, UT_COASTAL_BATTERY, 2, 7)));
    const rebuild = vi.spyOn(pass as any, "rebuild");
    pass.setAllies(new Set([2]));
    expect(rebuild).toHaveBeenCalledTimes(1);
    pass.setAllies(new Set([2])); // a fresh Set, same members, every tick
    pass.setAllies(new Set([2]));
    expect(rebuild).toHaveBeenCalledTimes(1);
    pass.setAllies(new Set([2, 3]));
    expect(rebuild).toHaveBeenCalledTimes(2);
  });

  it("draws structure rings as outlines and barrage zones filled", () => {
    const calls: [string, number][] = [];
    const gl = new Proxy(
      {},
      {
        get: (_t, prop) => {
          if (typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop)) return 0;
          if (prop === "getUniformLocation")
            return (_p: unknown, n: string) => n;
          if (prop === "uniform1f")
            return (loc: string, v: number) => calls.push([loc, v]);
          return () => ({});
        },
      },
    ) as WebGL2RenderingContext;
    const pass = new WarfareRingPass(gl, MAP_W, true);
    pass.updateStructures(units(unit(1, UT_COASTAL_BATTERY, 1, 7)));
    pass.updateUnits(units(unit(9, UT_COASTAL_BARRAGE, 4, 3)));
    pass.setVisible(true);
    pass.draw(new Float32Array(9));
    expect(
      calls.filter(([l]) => l === "uOutlineOnly").map(([, v]) => v),
    ).toEqual([1, 0]);
  });
});
