// World War 1936 P6 lane U4 (plan Task 13): the MIO, market and energy view models.
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  DepthIndustryModel,
  offered,
  strikeTargets,
} from "../../../src/client/hud/ww1936/DepthIndustryModel";
import { REGION } from "../../ww1936/seaFixture";
import { depthGame } from "./DepthU4Fixture";
import { SID } from "./SeaAirFixture";

const SEA_DIR = path.join(__dirname, "../../testdata/maps/ww1936sea");
const seaData = JSON.parse(
  fs.readFileSync(path.join(SEA_DIR, "scenario.json"), "utf8"),
) as ReadonlyScenarioData;
const seaBin = new Uint8Array(
  fs.readFileSync(path.join(SEA_DIR, "regions.bin")),
);

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
          extra: 0,
          base: 0,
          coalStock: 0,
          uraniumStock: 0,
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

  it("the energy line counts W1's extra supply and domestic base, and shows the stocks", () => {
    const g = depthGame({
      detail: {
        energy: {
          demand: 84,
          coal: 18,
          hydro: 6,
          plants: 1,
          dams: 2,
          ratioPm: 1000,
          extra: 5,
          base: 9,
          coalStock: 37,
          uraniumStock: 4,
        },
      },
    });
    const e = new DepthIndustryModel(g.game).energyLine()!;
    expect(e.supply).toBe(54 + 12 + 6 + 2 + 5 + 9);
    expect([e.coalStock, e.uraniumStock]).toEqual([37, 4]);
  });

  it("[Drop the bomb] is judged by lane S's nukeDropBlock: no bomb, then too few bombers", () => {
    const sr = ScenarioIndex.fromFiles(seaData, seaBin).srOfZoneOrRegion(
      REGION.berlin,
    );
    const none = depthGame({ summary: { atomicStock: 0 } });
    expect(new DepthIndustryModel(none.game).nukeStartBlock(sr)).toBe(
      "no_atomic",
    );
    const one = depthGame({ summary: { atomicStock: 1 } });
    expect(new DepthIndustryModel(one.game).nukeStartBlock(sr)).toBe(
      "nuke_conditions",
    );
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
    // Final review B, I2: the judge goes by world1936's fixed ids.
    const sc = {
      landRegions: [
        { id: 901, name: "Taiwan" },
        { id: 679, name: "Seoul" },
        { id: 758, name: "Tokyo" },
      ],
    } as never;
    const rows = strikeTargets(sc, [901, 679, 758], () => true);
    expect(rows.map((r) => r.noStrike)).toEqual([true, true, false]);
    expect(offered(rows)).toEqual([758]);
  });
});
