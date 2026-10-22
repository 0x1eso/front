import { describe, expect, it } from "vitest";
import {
  dialBlockPx,
  dialLayout,
  WW_DIAL_COUNT,
} from "../../../src/client/hud/ww1936/WwDials";

describe("the dials' layout (spec §20.2)", () => {
  it("ten dials make 3 × 4 on a phone in landscape and 2 × 5 elsewhere", () => {
    expect(WW_DIAL_COUNT).toBe(10);
    expect(dialLayout(true)).toEqual({ cols: 3, rows: 4 });
    expect(dialLayout(false)).toEqual({ cols: 2, rows: 5 });
    // 4 rows of size-11 with 6 px gaps fit a 390 px phone under the band.
    expect(dialBlockPx(true)).toBe(4 * 44 + 3 * 6 + 8);
    expect(dialBlockPx(true) + 32).toBeLessThan(390);
    expect(dialBlockPx(false)).toBe(5 * 44 + 4 * 6 + 8);
  });
});
