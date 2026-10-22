// World War 1936 P5: the endgame's client view (plan Task 1 review fixes).
import type { WwEndgameData } from "@openfront/engine-api/ww1936/EndgameTypes";
import { describe, expect, it } from "vitest";
import { wwActive } from "../../../src/client/hud/ww1936/WorldWarModel";
import { WwEndgameView } from "../../../src/client/view/WwEndgameView";

const country = (smallID: number, state: "dormant" | "active" | "gone") => ({
  smallID,
  state,
  nameKey: null,
  nameArg: null,
  color: null,
  flag: "",
});

/** A game where every country is alive and none capitulated. */
function fakeGame(view: WwEndgameView) {
  return {
    wwEndgame: () => view,
    worldWarData: () => ({ capitulated: [] }),
    playerBySmallID: () => ({ isPlayer: () => true, isAlive: () => true }),
  } as never;
}

describe("World War 1936 P5: the endgame view", () => {
  it("a region whose cores all went is nobody's core, not the scenario's", () => {
    const v = new WwEndgameView();
    expect(v.coreHolders(4)).toBeNull();
    v.apply({ news: [], coreChanges: [{ region: 4, holders: [2] }] });
    expect(v.coreHolders(4)).toEqual([2]);
    v.apply({ news: [], coreChanges: [{ region: 4, holders: [] }] });
    expect(v.coreHolders(4)).toEqual([]);
  });

  it("an occupation row listed as gone is dropped", () => {
    const v = new WwEndgameView();
    const row = {
      region: 6,
      controller: 2,
      resBp: 0,
      targetBp: 0,
      compBp: 0,
      needDeci: 0,
      supDeci: 0,
      factoryPct: 0,
      law: "occ_military",
      uprisingDays: 0,
      compHighDays: 0,
    } as unknown as NonNullable<WwEndgameData["occupation"]>[number];
    v.apply({ news: [], occupation: [row, { ...row, region: 7 }] });
    expect([...v.occupation.keys()]).toEqual([6, 7]);
    v.apply({ news: [], occupation: [], occupationGone: [6] });
    expect([...v.occupation.keys()]).toEqual([7]);
  });

  it("wwActive reads the endgame's country state", () => {
    const v = new WwEndgameView();
    const g = fakeGame(v);
    // Before the first update: the player's own state.
    expect(wwActive(g, 3)).toBe(true);
    v.apply({
      news: [],
      countries: [
        country(3, "gone"),
        country(4, "dormant"),
        country(5, "active"),
      ],
    } as WwEndgameData);
    expect([3, 4, 5].map((id) => wwActive(g, id))).toEqual([
      false,
      false,
      true,
    ]);
    // An exile plays on.
    v.apply({
      news: [],
      exiles: [
        {
          smallID: 3,
          host: 5,
          legitBp: 5000,
          deltaBp: 0,
          virtualMil: 5,
          capital: 0,
        },
      ],
    });
    expect(wwActive(g, 3)).toBe(true);
  });
});
