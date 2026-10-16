import { describe, expect, test } from "vitest";
import { paradropThreatSams } from "../../../src/client/controllers/WarfarePreview";
import { buildFlightTrajectory } from "../../../src/client/render/gl/utils/FlightTrajectory";

interface Owner {
  name: string;
}
const me: Owner = { name: "me" };
const ally: Owner = { name: "ally" };
const foe: Owner = { name: "foe" };
const W = 100;
const xy = (t: number) => ({ x: t % W, y: Math.floor(t / W) });
const sam = (owner: Owner, x: number, y: number, active = true) => ({
  isActive: () => active,
  owner: () => owner,
  tile: () => y * W + x,
  level: () => 1,
});
const threats = (sams: ReturnType<typeof sam>[]) =>
  paradropThreatSams(
    sams,
    me,
    (o) => o === ally,
    xy,
    () => 20,
  );

describe("paradrop SAM preview", () => {
  test("includes hostile SAMs, skips own, friendly and dead ones", () => {
    const got = threats([
      sam(foe, 50, 10),
      sam(me, 30, 10),
      sam(ally, 40, 10),
      sam(foe, 60, 10, false),
    ]);
    expect(got).toEqual([{ x: 50, y: 10, r: 20 }]);
  });

  test("the flight is shaded from the first SAM entry point", () => {
    const sams = threats([sam(foe, 50, 10)]);
    const data = buildFlightTrajectory(0, 10, 100, 10, sams);
    // enters the 20-tile ring at x = 30 of a 100-tile line
    expect(data.tSamIntercept).toBeCloseTo(0.3);
    expect(data.tUntargetableStart).toBe(-1);
  });

  test("no threat when no SAM covers the path", () => {
    const sams = threats([sam(foe, 50, 80), sam(ally, 50, 10)]);
    // only the far hostile SAM is a candidate, and it never touches the path
    expect(sams).toHaveLength(1);
    expect(buildFlightTrajectory(0, 10, 100, 10, sams).tSamIntercept).toBe(1);
  });
});
