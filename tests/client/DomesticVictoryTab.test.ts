import { describe, expect, it } from "vitest";
import { projectHostChoices } from "../../src/client/hud/domestic/VictoryTab";

function unit(id: number, level: number, underConstruction = false) {
  return {
    id: () => id,
    level: () => level,
    isUnderConstruction: () => underConstruction,
  };
}

describe("projectHostChoices", () => {
  it("lists finished level 3+ buildings, highest level first", () => {
    expect(
      projectHostChoices([
        unit(1, 3),
        unit(2, 2),
        unit(3, 5),
        unit(4, 4, true),
        unit(5, 3),
      ]),
    ).toEqual([
      { id: 3, level: 5 },
      { id: 1, level: 3 },
      { id: 5, level: 3 },
    ]);
  });
});
