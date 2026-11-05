import { describe, expect, test } from "vitest";
import {
  battalionName,
  natUnitNote,
} from "../../../src/client/hud/ww1936/NationalNames";

describe("national battalion names", () => {
  test("the unit name replaces its base battalion only, and only once held", () => {
    // natUnit 7 (Italy): mountain becomes Alpini; the others keep their names.
    expect(battalionName("mountain", 0)).toBe(battalionName("mountain"));
    expect(battalionName("mountain", 7)).not.toBe(battalionName("mountain", 0));
    expect(battalionName("marine", 7)).toBe(battalionName("marine", 0));
    expect(natUnitNote("mountain", 7)).not.toBeNull();
    expect(natUnitNote("mountain", 0)).toBeNull();
    expect(natUnitNote("infantry", 7)).toBeNull();
  });
});
