import { describe, expect, it } from "vitest";
import {
  buildFlightTrajectory,
  firstSamEntry,
} from "../../src/client/render/gl/utils/FlightTrajectory";

describe("straight flight preview", () => {
  it("puts the control points on the line and has no untargetable stretch", () => {
    const t = buildFlightTrajectory(0, 0, 90, 30, []);
    expect([t.p0x, t.p0y, t.p3x, t.p3y]).toEqual([0, 0, 90, 30]);
    expect([t.p1x, t.p1y]).toEqual([30, 10]);
    expect([t.p2x, t.p2y]).toEqual([60, 20]);
    expect(t.tUntargetableStart).toBe(-1);
    expect(t.tUntargetableEnd).toBe(-1);
    expect(t.tSamIntercept).toBe(1);
  });

  it("marks where the line first enters a SAM's range", () => {
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 50, y: 0, r: 10 }])).toBeCloseTo(
      0.4,
    );
    expect(
      buildFlightTrajectory(0, 0, 100, 0, [{ x: 50, y: 0, r: 10 }])
        .tSamIntercept,
    ).toBeCloseTo(0.4);
  });

  it("ignores SAMs the line passes by, and is 0 when it starts inside one", () => {
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 50, y: 30, r: 10 }])).toBe(1);
    expect(firstSamEntry(0, 0, 100, 0, [{ x: 2, y: 0, r: 10 }])).toBe(0);
    expect(
      firstSamEntry(0, 0, 100, 0, [
        { x: 80, y: 0, r: 5 },
        { x: 30, y: 0, r: 5 },
      ]),
    ).toBeCloseTo(0.25);
  });
});
