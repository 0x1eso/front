import { describe, expect, it } from "vitest";
import { domesticModeDefaults } from "../../src/client/utilities/GameConfigHelpers";

describe("turning domestic mode on in the lobby", () => {
  it("turns the timer on at 30 minutes when none is set", () => {
    const expected = { maxTimer: true, maxTimerValue: 30, overtime: false };
    expect(domesticModeDefaults(false, undefined)).toEqual(expected);
    expect(domesticModeDefaults(true, undefined)).toEqual(expected);
    // A value left behind by a switched-off timer doesn't count.
    expect(domesticModeDefaults(false, 45)).toEqual(expected);
  });

  it("keeps a timer the host already set", () => {
    expect(domesticModeDefaults(true, 45)).toEqual({
      maxTimer: true,
      maxTimerValue: 45,
      overtime: false,
    });
  });
});
