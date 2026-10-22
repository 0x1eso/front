// World War 1936 P6 (plan Task 4, spec §7.2–§7.3): the arms market — a
// listing leaves the stock, a purchase pays civilian factories for 30
// days and its units arrive by land 10 days after each day's shipment;
// the generation discount; what never goes on the market; embargoes that
// close trade, licences and deals. Numbers on human countries (plan
// decision 30), the common day called directly.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { MARKET_DAYS } from "@openfront/engine-api/ww1936/DepthTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { grantLicence } from "@openfront/engine/ww1936/depth/Licences";
import {
  dayCommonMarket,
  listingPriceMilli,
  MARKET_TRANSIT_DAYS,
} from "@openfront/engine/ww1936/depth/Market";
import type { DesignSlot } from "@openfront/engine/ww1936/depth/WwDepth";
import {
  landReachOf,
  partnerJudge,
} from "@openfront/engine/ww1936/economy/Trade";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture, TEST_TANK } from "./depthFixture";
import { gameHash, stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const { DEU, FRA, POL } = DEEP.tag;
const INF1 = equipKey("infantry_equipment", 1);

async function deep() {
  const runner = await wwRunner(
    {},
    [
      { clientID: "HUMANDEU", country: "DEU" },
      { clientID: "HUMANFRA", country: "FRA" },
    ],
    DEEP.map,
  );
  stepTo(runner, WW_PREP_TICKS + 2);
  const ww = runner.game.worldWar()!;
  const tick = runner.game.ticks();
  return { runner, ww, d: ww.depth, tick, day: ww.day(tick) };
}

describe("World War 1936 P6: the arms market", () => {
  it("market purchase pays over 30 days and delivers by land", async () => {
    const { ww, d, tick, day } = await deep();
    const deu = ww.economy.country(DEU)!;
    const fra = ww.economy.country(FRA)!;
    expect(landReachOf(ww.economy, FRA).has(DEU)).toBe(true);
    const deuStock = deu.stock[INF1];
    const fraStock = fra.stock[INF1];
    expect(
      d.issue(DEU, { kind: "market_list", key: INF1, count: 6000 }, tick),
    ).toBeNull();
    expect(deu.stock[INF1]).toBe(deuStock - 6000);
    const listing = d.market.listings[0];
    expect(listing).toMatchObject({ seller: DEU, key: INF1, count: 6000 });
    // Not one's own; 6,000 rifles (3,000 industry) need 20 factories.
    expect(
      d.issue(
        DEU,
        { kind: "market_buy", listing: listing.id, count: 10 },
        tick,
      ),
    ).toBe("listing_bad");
    expect(
      d.issue(
        FRA,
        { kind: "market_buy", listing: listing.id, count: 6000 },
        tick,
      ),
    ).toBe("no_civs");
    // 600 rifles: 300 industry, ceil(300 / 150) = 2 civilian factories.
    const msg = vi.spyOn(d, "message");
    expect(
      d.issue(
        FRA,
        { kind: "market_buy", listing: listing.id, count: 600 },
        tick,
      ),
    ).toBeNull();
    expect(listing.count).toBe(5400);
    const deal = d.market.deals[0];
    expect(deal).toMatchObject({
      buyer: FRA,
      seller: DEU,
      key: INF1,
      count: 600,
      priceMilli: 300_000,
      paidMilli: 0,
      deliveredMilli: 0,
      civs: 2,
      startDay: day,
      endDay: day + MARKET_DAYS + MARKET_TRANSIT_DAYS,
    });
    expect(msg).toHaveBeenCalledWith(FRA, "ww1936_market_sale", {
      buyerTag: "FRA",
      sellerTag: "DEU",
      count: 600,
      item: "infantry_equipment",
    });
    // The two factories leave France for Germany while it pays.
    expect(d.civsOut(FRA)).toBe(2);
    expect(d.civsIn(DEU)).toBe(2);
    const arrived: number[] = [];
    for (let k = 1; k <= 40; k++) {
      dayCommonMarket(d, day + k, tick);
      arrived.push(fra.stock[INF1] - fraStock);
      if (k === 15) {
        expect(deal.paidMilli).toBe(150_000);
        expect(deal.deliveredMilli).toBe(50_000);
      }
      if (k === 29) expect(d.civsOut(FRA)).toBe(2);
      if (k === 30) {
        expect(deal.paidMilli).toBe(300_000);
        expect(d.civsOut(FRA)).toBe(0);
        expect(d.civsIn(DEU)).toBe(0);
      }
    }
    // A 30th a day from day 11 (by land, 10 days on the road).
    expect(arrived.slice(0, 10)).toEqual(new Array<number>(10).fill(0));
    expect(arrived[10]).toBe(20);
    expect(arrived[14]).toBe(100);
    expect(arrived[29]).toBe(400);
    expect(arrived[39]).toBe(600);
    expect(d.market.deals).toEqual([]);
    expect(msg).toHaveBeenLastCalledWith(DEU, "ww1936_market_sale", {
      buyerTag: "FRA",
      sellerTag: "DEU",
      count: 600,
      item: "infantry_equipment",
    });
    // Withdrawn: the rest goes home.
    expect(
      d.issue(FRA, { kind: "market_unlist", listing: listing.id }, tick),
    ).toBe("listing_bad");
    expect(
      d.issue(DEU, { kind: "market_unlist", listing: listing.id }, tick),
    ).toBeNull();
    expect(d.market.listings).toEqual([]);
    expect(deu.stock[INF1]).toBe(deuStock - 600);
  });

  it("market price discounts old equipment", async () => {
    const { ww, d, tick, day } = await deep();
    const deu = ww.economy.country(DEU)!;
    for (const t of ["artillery_2", "artillery_3"] as const) deu.addTech(t);
    const price = (gen: number) =>
      listingPriceMilli(
        d,
        { seller: DEU, key: equipKey("artillery", gen) },
        100,
      );
    // 1936 against Germany's newest (1942): 6 years, half price.
    expect(price(1)).toBe(175_000);
    // 1939: 3 years, 75% of the generation's 4,375.
    expect(price(2)).toBe(328_125);
    // The newest: full price, 5,250 a gun.
    expect(price(3)).toBe(525_000);
    // A purchase pays the discounted price.
    deu.stock[equipKey("artillery", 1)] = 100;
    expect(
      d.issue(
        DEU,
        { kind: "market_list", key: equipKey("artillery", 1), count: 100 },
        tick,
      ),
    ).toBeNull();
    const id = d.market.listings[0].id;
    expect(
      d.issue(FRA, { kind: "market_buy", listing: id, count: 100 }, tick),
    ).toBeNull();
    expect(d.market.deals[0]).toMatchObject({
      priceMilli: 175_000,
      civs: 2,
      startDay: day,
    });
  });

  it("atomic bombs and ships cannot be listed", async () => {
    const { ww, d, tick } = await deep();
    const deu = ww.economy.country(DEU)!;
    for (const t of [
      "atomic_bomb",
      "convoy",
      "floating_harbor",
      "flying_bomb",
      "ballistic_rocket",
    ] as const) {
      const key = equipKey(t, 1);
      deu.stock[key] = 20;
      expect(
        d.issue(DEU, { kind: "market_list", key, count: 1 }, tick),
        t,
      ).toBe("listing_bad");
      expect(deu.stock[key]).toBe(20);
    }
    // Ships are no stock items at all (P4 ships): no key names one.
    expect(
      d.issue(DEU, { kind: "market_list", key: 4000, count: 1 }, tick),
    ).toBe("listing_bad");
    // Nor more than the stock holds, nor a captured design (spec §5.6).
    const tank = equipKey("tank_design", 1);
    d.country(DEU)!.des.tank[0] = {
      def: TEST_TANK as DesignSlot["def"],
      origin: "captured",
      from: FRA,
      fromSlot: 1,
      obsolete: false,
      savedDay: 0,
    };
    deu.stock[tank] = 5;
    expect(
      d.issue(DEU, { kind: "market_list", key: tank, count: 5 }, tick),
    ).toBe("listing_bad");
    d.country(DEU)!.des.tank[0]!.origin = "own";
    expect(
      d.issue(DEU, { kind: "market_list", key: tank, count: 6 }, tick),
    ).toBe("listing_bad");
    expect(
      d.issue(DEU, { kind: "market_list", key: tank, count: 5 }, tick),
    ).toBeNull();
    expect(d.market.listings[0].design).toEqual(TEST_TANK);
    // Six listings at most (a seventh key is refused, more of a listed key is not).
    for (const t of [
      "support_equipment",
      "artillery",
      "anti_tank",
      "motorized",
      "light_tank",
    ] as const) {
      deu.stock[equipKey(t, 1)] = 50;
      expect(
        d.issue(
          DEU,
          { kind: "market_list", key: equipKey(t, 1), count: 10 },
          tick,
        ),
        t,
      ).toBeNull();
    }
    expect(
      d.issue(DEU, { kind: "market_list", key: INF1, count: 10 }, tick),
    ).toBe("listing_bad");
    expect(
      d.issue(
        DEU,
        { kind: "market_list", key: equipKey("artillery", 1), count: 10 },
        tick,
      ),
    ).toBeNull();
    expect(d.market.listings).toHaveLength(6);
    expect(
      d.market.listings.find((l) => l.key === equipKey("artillery", 1))?.count,
    ).toBe(20);
  });

  it("embargo closes trade, licence and market", async () => {
    const { ww, d, tick, day } = await deep();
    const econ = ww.economy;
    const deu = econ.country(DEU)!;
    const fra = econ.country(FRA)!;
    deu.addTech("medium_tank_1");
    econ.addTrade(FRA, DEU, 0, 1);
    econ.addTrade(DEU, FRA, 1, 1);
    const pairTrades = () =>
      econ
        .trades()
        .filter(
          (t) =>
            (t.buyer === FRA && t.seller === DEU) ||
            (t.buyer === DEU && t.seller === FRA),
        ).length;
    expect(pairTrades()).toBe(2);
    expect(
      grantLicence(d, DEU, FRA, equipKey("medium_tank", 1), 0, day),
    ).toBeNull();
    const deuStock = deu.stock[INF1];
    const fraStock = fra.stock[INF1];
    d.issue(DEU, { kind: "market_list", key: INF1, count: 600 }, tick);
    const listing = d.market.listings[0].id;
    expect(
      d.issue(FRA, { kind: "market_buy", listing, count: 300 }, tick),
    ).toBeNull();
    dayCommonMarket(d, day + 15, tick);
    expect(fra.stock[INF1] - fraStock).toBe(50);
    // France embargoes Germany: 25 political power.
    const pp = ww.politics.country(FRA)!.ppMilli;
    expect(d.issue(FRA, { kind: "embargo", target: DEU }, tick)).toBeNull();
    expect(ww.politics.country(FRA)!.ppMilli).toBe(pp - 25_000);
    expect(d.embargoed(DEU, FRA)).toBe(true);
    expect(pairTrades()).toBe(0);
    expect(d.market.licences).toEqual([]);
    expect(d.market.deals).toEqual([]);
    // The units still on the road go back to the seller.
    expect(deu.stock[INF1]).toBe(deuStock - 600 + 250);
    expect(fra.stock[INF1]).toBe(fraStock + 50);
    expect(d.market.listings[0].count).toBe(300);
    // Trade, the market and licences are closed between the two.
    expect(partnerJudge(econ, FRA)(DEU)).toBe("no_partner");
    expect(partnerJudge(econ, DEU)(FRA)).toBe("no_partner");
    expect(d.issue(FRA, { kind: "market_buy", listing, count: 10 }, tick)).toBe(
      "embargoed",
    );
    expect(
      d.issue(
        FRA,
        {
          kind: "licence_request",
          from: DEU,
          key: equipKey("medium_tank", 1),
        },
        tick,
      ),
    ).toBe("embargoed");
    expect(d.issue(FRA, { kind: "embargo", target: DEU }, tick)).toBe(
      "embargoed",
    );
    // Lifting is free.
    expect(
      d.issue(FRA, { kind: "embargo_lift", target: DEU }, tick),
    ).toBeNull();
    expect(d.embargoed(DEU, FRA)).toBe(false);
    expect(d.issue(FRA, { kind: "embargo_lift", target: DEU }, tick)).toBe(
      "bad_target",
    );
    expect(ww.politics.country(FRA)!.ppMilli).toBe(pp - 25_000);
    // A democracy needs the target's share of the tension (5%).
    ww.politics.country(FRA)!.ruling = IDEO_DEM;
    ww.politics.threatBp[POL] = 499;
    expect(d.issue(FRA, { kind: "embargo", target: POL }, tick)).toBe(
      "tension_gate",
    );
    ww.politics.threatBp[POL] = 500;
    expect(d.issue(FRA, { kind: "embargo", target: POL }, tick)).toBeNull();
    expect(d.issue(FRA, { kind: "embargo", target: FRA }, tick)).toBe(
      "bad_target",
    );
  });

  it("a buyer that can no longer pay ends its newest deal", async () => {
    const { ww, d, tick, day } = await deep();
    const deu = ww.economy.country(DEU)!;
    const fra = ww.economy.country(FRA)!;
    const deuStock = deu.stock[INF1];
    d.issue(DEU, { kind: "market_list", key: INF1, count: 600 }, tick);
    const listing = d.market.listings[0].id;
    for (const count of [300, 300]) {
      expect(
        d.issue(FRA, { kind: "market_buy", listing, count }, tick),
      ).toBeNull();
    }
    const [first, second] = d.market.deals;
    dayCommonMarket(d, day + 1, tick);
    expect(d.market.deals).toEqual([first, second]);
    // France loses its civilian factories: the newest deal goes first,
    // then the other, its rifles back to Germany.
    fra.totals.civ = 1;
    dayCommonMarket(d, day + 2, tick);
    expect(d.market.deals).toEqual([]);
    expect(deu.stock[INF1]).toBe(deuStock);
  });

  it("a refused market order changes nothing", async () => {
    const { runner, ww, d, tick } = await deep();
    ww.politics.country(DEU)!.ppMilli = 10_000;
    const before = gameHash(runner);
    const snap = JSON.stringify(d.snapshot());
    const stock = [...ww.economy.country(DEU)!.stock];
    const orders: [WwOrder, string][] = [
      [{ kind: "mio_trait", family: "mio_armor", trait: "p1" }, "prereq"],
      [{ kind: "mio_invest", family: "mio_armor" }, "prereq"],
      [{ kind: "licence_request", from: DEU, key: INF1 }, "no_partner"],
      [{ kind: "licence_answer", request: 99, accept: true }, "bad_index"],
      [{ kind: "licence_cancel", licence: 99 }, "bad_index"],
      [
        {
          kind: "market_list",
          key: equipKey("atomic_bomb", 1),
          count: 1,
        },
        "listing_bad",
      ],
      [{ kind: "market_unlist", listing: 99 }, "listing_bad"],
      [{ kind: "market_buy", listing: 99, count: 1 }, "listing_bad"],
      [{ kind: "embargo", target: FRA }, "no_pp"],
      [{ kind: "embargo_lift", target: FRA }, "bad_target"],
    ];
    for (const [o, block] of orders) {
      expect(d.issue(DEU, o, tick), o.kind).toBe(block);
    }
    expect(gameHash(runner)).toBe(before);
    expect(JSON.stringify(d.snapshot())).toBe(snap);
    expect([...ww.economy.country(DEU)!.stock]).toEqual(stock);
  });
});
