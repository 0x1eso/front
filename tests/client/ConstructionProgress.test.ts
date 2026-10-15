import { constructionProgress } from "../../src/client/render/gl/utils/ConstructionProgress";
import {
  applyUnitUpdateInPlace,
  unitStateFromUpdate,
} from "../../src/client/view/EntityState";
import { makeUnitUpdate } from "../util/viewStubs";

describe("construction progress", () => {
  test("uses the unit type's duration when the unit doesn't say", () => {
    expect(
      constructionProgress(
        { constructionStartTick: 100, constructionTicks: undefined },
        110,
        20,
      ),
    ).toBe(0.5);
  });

  test("uses the structure's own build time when sent (domestic mode)", () => {
    const unit = { constructionStartTick: 100, constructionTicks: 10 };
    expect(constructionProgress(unit, 105, 20)).toBe(0.5);
    expect(constructionProgress(unit, 120, 20)).toBe(1);
    expect(constructionProgress(unit, 90, 20)).toBe(0);
  });

  test("unit state carries constructionTicks from updates", () => {
    const state = unitStateFromUpdate(
      makeUnitUpdate({ underConstruction: true, constructionTicks: 25 }),
    );
    expect(state.constructionTicks).toBe(25);
    applyUnitUpdateInPlace(state, makeUnitUpdate({ underConstruction: false }));
    expect(state.constructionTicks).toBeUndefined();
  });
});
