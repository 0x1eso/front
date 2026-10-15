import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { describe, expect, it } from "vitest";
import { SAMRadiusPass } from "../../../../src/client/render/gl/passes/SamRadiusPass";
import { createRenderSettings } from "../../../../src/client/render/gl/RenderSettings";
import { samRange } from "../../../../src/client/render/gl/utils/NukeTrajectory";
import type { UnitState } from "../../../../src/client/render/types";

/** Every GL call is a no-op returning a dummy handle. */
function glStub(): WebGL2RenderingContext {
  return new Proxy(
    {},
    {
      get: (_target, prop) =>
        typeof prop === "string" && /^[A-Z0-9_]+$/.test(prop) ? 0 : () => ({}),
    },
  ) as WebGL2RenderingContext;
}

function sam(ownerID: number, extra: Partial<UnitState> = {}): UnitState {
  return {
    id: ownerID,
    ownerID,
    lastOwnerID: null,
    unitType: UnitType.SAMLauncher,
    pos: 50 * 200 + 50 + ownerID * 100,
    lastPos: 0,
    isActive: true,
    reachedTarget: false,
    retreating: false,
    targetable: false,
    waitTicks: 0,
    markedForDeletion: false,
    health: 100,
    underConstruction: false,
    constructionStartTick: null,
    targetUnitId: null,
    targetTile: null,
    troops: 0,
    missileTimerQueue: [],
    level: 1,
    veterancy: 0,
    hasTrainStation: false,
    trainType: null,
    loaded: null,
    samUpgradeStartTick: null,
    samUpgradeStartRange: null,
    samUpgradeTargetLevel: null,
    samUpgradeDuration: null,
    ...extra,
  };
}

/** Radii of the active-range circles (even groups) per SAM owner. */
function activeRadii(pass: SAMRadiusPass, units: UnitState[], tick: number) {
  const circles: { radius: number; group: number }[] = (
    pass as any
  ).collectSAMCircles(new Map(units.map((u) => [u.id, u])), tick);
  return circles.filter((c) => c.group % 2 === 0).map((c) => c.radius);
}

describe("SAM range rings use the owner's modified range (M3)", () => {
  // Owner 2 has the air-defense law; owner 1 does not.
  const rangeOf = (ownerID: number, base: number) =>
    ownerID === 2 ? Math.min(150, base * 1.3) : base;

  it("a SAM's ring is samRangeOf its owner", () => {
    const pass = new SAMRadiusPass(glStub(), 200, createRenderSettings());
    pass.setSamRangeOf(rangeOf);
    expect(activeRadii(pass, [sam(1)], 0)).toEqual([samRange(1)]);
    expect(activeRadii(pass, [sam(2)], 0)).toEqual([samRange(1) * 1.3]);
  });

  it("an upgrading SAM grows like the engine's interpolation, then the modifier", () => {
    const pass = new SAMRadiusPass(glStub(), 200, createRenderSettings());
    pass.setSamRangeOf(rangeOf);
    const start = samRange(1);
    const upgrading = sam(2, {
      samUpgradeStartTick: 0,
      samUpgradeDuration: 10,
      samUpgradeTargetLevel: 2,
      samUpgradeStartRange: start,
    });
    const halfway = start + (samRange(2) - start) / 2;
    expect(activeRadii(pass, [upgrading], 5)[0]).toBeCloseTo(halfway * 1.3, 9);
  });

  it("without a range function the ring is the base range", () => {
    const pass = new SAMRadiusPass(glStub(), 200, createRenderSettings());
    expect(activeRadii(pass, [sam(2)], 0)).toEqual([samRange(1)]);
  });
});
