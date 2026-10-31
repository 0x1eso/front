// World War 1936 P6 lane U4 (plan Task 13): the MIO, market and energy view models.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { EQUIP_KEY_COUNT } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ReadonlyScenarioData } from "@openfront/engine-api/ww1936/ScenarioTypes";
import { ScenarioIndex } from "@openfront/engine-lib/ww1936/ScenarioIndex";
import fs from "fs";
import { render } from "lit";
import path from "path";
import { describe, expect, it } from "vitest";
import { DepthIndustryModel } from "../../../src/client/hud/ww1936/DepthIndustryModel";
import {
  MARKET_MAX_COUNT,
  renderMarketTab,
} from "../../../src/client/hud/ww1936/WwMarketTab";
import { REGION } from "../../ww1936/seaFixture";
import { depthGame } from "./DepthU4Fixture";
import { seaDetail, SID } from "./SeaAirFixture";

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

  it("final review D (D2): a market order's count never passes the schema's cap", () => {
    const stock = new Array<number>(EQUIP_KEY_COUNT).fill(0);
    stock[0] = 3_000_000;
    const g = depthGame({
      details: [seaDetail("GBR", { stock, tradePartners: [SID("ITA")] })],
      market: {
        listings: [
          {
            id: 1,
            // Italy: at peace with me (Germany, at war, may not sell to me).
            seller: SID("ITA"),
            key: 0,
            design: null,
            count: 2_500_000,
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
    const sent: WwOrder[] = [];
    const box = document.createElement("div");
    const ui = {
      send: (o: WwOrder) => sent.push(o),
      confirm: (_k: string, act: () => void) => act(),
      armed: () => false,
      redraw: () => render(renderMarketTab(m, ui), box),
      name: () => "",
      regionName: () => "",
      me: SID("GBR"),
      pick: {} as Record<string, number>,
    };
    ui.redraw();
    // Open the listing (its count slider starts at the whole listing), buy.
    (box.querySelector("[data-ww-listing='1'] button") as HTMLElement).click();
    expect(
      (box.querySelector("[data-ww-buy-count]") as HTMLInputElement).max,
    ).toBe(String(MARKET_MAX_COUNT));
    const buy = box.querySelector("[data-ww-buy]") as HTMLButtonElement;
    expect(buy.disabled).toBe(false);
    buy.click();
    // My offer: the whole stock by default.
    ui.pick.mine = 1;
    ui.redraw();
    (box.querySelector("[data-ww-list]") as HTMLElement).click();
    expect(sent).toEqual([
      { kind: "market_buy", listing: 1, count: MARKET_MAX_COUNT },
      { kind: "market_list", key: 0, count: MARKET_MAX_COUNT },
    ]);
    for (const order of sent) {
      expect(IntentSchema.safeParse({ type: "ww_order", order }).success).toBe(
        true,
      );
    }
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
});
