// World War 1936 P6 (plan Task 14): the mine pattern's dots — density
// mines / 200,000 per tile, mine blue, a known enemy's red, an unknown one hidden.
import { describe, expect, it } from "vitest";
import { FogModel } from "../../../src/client/hud/ww1936/FogModel";
import {
  dotCount,
  mineInstances,
  type MineSamples,
} from "../../../src/client/render/gl/passes/WwMinePass";
import { fogGame, ID } from "./FogFixture";

const samples: MineSamples = {
  bySr: new Map([
    [7, { area: 100_000, tiles: Uint32Array.from([5, 12, 30, 41]) }],
  ]),
};

describe("WwMinePass", () => {
  it("the dot count follows mines / 200,000 per tile", () => {
    expect(dotCount(100, 100_000, 400)).toBe(50);
    expect(dotCount(0, 100_000, 400)).toBe(0);
    expect(dotCount(1000, 100_000_000, 3)).toBe(3);
  });

  it("mine dots are blue, a known enemy's red, an unknown one's hidden", () => {
    const out = new Float32Array(64);
    const n = mineInstances(
      samples,
      [
        [7, 1, 2_000],
        [7, 2, 2_000],
        [7, 3, 2_000],
      ],
      10,
      (owner) => (owner === 1 ? 0 : owner === 2 ? 1 : -1),
      out,
    );
    // 2000 * 100000 / 200000 = 1000 → capped by the 4 samples, twice.
    expect(n).toBe(8);
    expect(out[2]).toBe(0);
    expect(out[4 * 4 + 2]).toBe(1);
    expect([out[0], out[1]]).toEqual([5, 0]);
  });

  it("the fog judges a side key's mines: mine, a known enemy's, hidden; a faction by its best-known member", () => {
    // Germany observes; the row's second column is a P4 side key.
    const g = fogGame({ levels: [0, 0, 60, 0] });
    const POL_FACTION = 100_000 + 3;
    const politics = {
      factionIdx: () => -1,
      global: {
        factions: [
          { idx: 3, leader: ID("ITA"), members: [ID("ITA"), ID("POL")] },
        ],
      },
    };
    const fog = new FogModel({
      ...(g.game as object),
      wwPolitics: () => politics,
    } as never);
    expect(fog.mineSideView(ID("DEU"))).toBe(0);
    expect(fog.mineSideView(ID("POL"))).toBe(1);
    // A faction key: its best-known member (Poland, close) shows it.
    expect(fog.mineSideView(POL_FACTION)).toBe(1);
    g.setLevels([0, 0, 30, 0]);
    expect(
      new FogModel({
        ...(g.game as object),
        wwPolitics: () => politics,
      } as never).mineSideView(ID("POL")),
    ).toBe(-1);
    expect(
      new FogModel({
        ...(g.game as object),
        wwPolitics: () => politics,
      } as never).mineSideView(POL_FACTION),
    ).toBe(-1);
    // A spectator sees every side's mines.
    g.state.spectator = true;
    expect(new FogModel(g.game as never).mineSideView(ID("POL"))).toBe(1);
  });
});
