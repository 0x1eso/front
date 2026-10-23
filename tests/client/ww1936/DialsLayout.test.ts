import { describe, expect, it } from "vitest";
import {
  dockHeightPx,
  WW_DIAL_COUNT,
} from "../../../src/client/hud/ww1936/WwDials";

describe("the dock's layout", () => {
  it("is one slim row: 40 px on a phone in landscape, 44 elsewhere", () => {
    expect(WW_DIAL_COUNT).toBe(10);
    expect(dockHeightPx(true)).toBe(40);
    expect(dockHeightPx(false)).toBe(44);
    // The tap target stays at least 36 px.
    expect(dockHeightPx(true)).toBeGreaterThanOrEqual(36);
  });
});
