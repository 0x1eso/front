// World War 1936 P6 lane U4 (plan Task 13): the MIO, market and energy view models.
import { describe, expect, it } from "vitest";
import {
  DepthIndustryModel,
  offered,
  strikeTargets,
} from "../../../src/client/hud/ww1936/DepthIndustryModel";
import { depthGame } from "./DepthU4Fixture";
import { SID } from "./SeaAirFixture";

describe("DepthIndustryModel", () => {
  it("a buy preview shows factories for 30 days", () => {
    const g = depthGame({
      market: {
        listings: [
          {
            id: 1,
            seller: SID("DEU"),
            key: 0,
            design: null,
            count: 4,
            priceMilli: 600_000,
          },
        ],
        deals: [],
        licences: [],
        embargoes: [],
        pendingLicences: [],
      },
    });
    const m = new DepthIndustryModel(g.game);
    const row = m.listings()[0];
    // 600,000 milli for 4 pieces, 150,000 a factory: 4 civilian factories.
    const p = m.buyPreview(row, 4);
    expect(p.factories).toBe(4);
    expect(p.days).toBe(30);
    expect(m.buyPreview(row, 2).factories).toBe(2);
  });

  it("the energy line adds up its sources", () => {
    const g = depthGame({
      detail: {
        energy: {
          demand: 84,
          coal: 18,
          hydro: 6,
          plants: 1,
          dams: 2,
          ratioPm: 920,
        },
      },
    });
    const e = new DepthIndustryModel(g.game).energyLine()!;
    expect(e.coalPower).toBe(54);
    expect(e.hydroPower).toBe(12);
    expect(e.plantPower).toBe(6);
    expect(e.supply).toBe(
      e.coalPower + e.hydroPower + e.plantPower + e.damPower,
    );
    expect(e.pct).toBe(92);
    expect(e.short).toBe(true);
  });

  it("the trait grid marks exclusive cells", () => {
    // State arsenal: p1 free (bit 0), then p2 (bit 1) and p3 (bit 2) owned.
    const g = depthGame({
      detail: {
        mio: {
          arch: [0, -1, -1, -1, -1, -1],
          fundsMilli: [0, 0, 0, 0, 0, 0],
          traits: [0b111, 0, 0, 0, 0, 0],
          size: [5, 0, 0, 0, 0, 0],
          points: [2, 0, 0, 0, 0, 0],
          investReady: [0, 0, 0, 0, 0, 0],
        },
      },
    });
    const grid = new DepthIndustryModel(g.game).traitGrid(0);
    const state = (id: string) => grid.find((c) => c.id === id)!.state;
    expect(state("p1")).toBe("free");
    expect(state("p3")).toBe("owned");
    // q3 excludes the owned p3; q1 (a free column start) can be bought.
    expect(state("q3")).toBe("exclusive");
    expect(state("q1")).toBe("buyable");
    expect(state("q2")).toBe("locked");
  });

  it("strike targets grey out the no-strike regions with the engine-lib judge", () => {
    const sc = {
      landRegions: [
        { id: 1, name: "Taiwan" },
        { id: 2, name: "Keijō (Seoul)" },
        { id: 3, name: "Honshu" },
      ],
    } as never;
    const rows = strikeTargets(sc, [1, 2, 3], () => true);
    expect(rows.map((r) => r.noStrike)).toEqual([true, true, false]);
    expect(offered(rows)).toEqual([3]);
  });
});
