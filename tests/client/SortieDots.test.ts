import { describe, expect, it } from "vitest";
import {
  SORTIE_DOT_STEP,
  SORTIE_DOTS_MAX,
  sortieDotCentersX,
  sortiesLeft,
} from "../../src/client/render/gl/utils/SortieDots";

describe("airport sortie dots", () => {
  it("shows level minus the sorties in use", () => {
    expect(sortiesLeft(3, 0)).toBe(3);
    expect(sortiesLeft(3, 1)).toBe(2);
    expect(sortiesLeft(3, 3)).toBe(0);
    expect(sortiesLeft(1, 5)).toBe(0);
  });

  it("one dot per sortie, centred over the airport", () => {
    expect(sortieDotCentersX(10, 0)).toEqual([]);
    expect(sortieDotCentersX(10, 1)).toEqual([10.5]);
    const three = sortieDotCentersX(10, 3);
    expect(three).toHaveLength(3);
    expect(three[1]).toBe(10.5);
    expect(three[1] - three[0]).toBeCloseTo(SORTIE_DOT_STEP);
    expect(three[2] - three[1]).toBeCloseTo(SORTIE_DOT_STEP);
  });

  it("caps a tall airport's row", () => {
    expect(sortieDotCentersX(0, 20)).toHaveLength(SORTIE_DOTS_MAX);
  });
});
