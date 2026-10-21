// World War 1936 P4 (plan Task 5, lane C): sea trade (spec §10.2, P1 §7.4
// partner rule 3) on ww1936sea, every country human.
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { convoysForTrade } from "@openfront/engine-lib/ww1936/ConvoyRules";
import { damageBuilding } from "@openfront/engine/ww1936/economy/Buildings";
import {
  openTrade,
  tradePartnerBlock,
  tradePartners,
} from "@openfront/engine/ww1936/economy/Trade";
import { routeFor } from "@openfront/engine/ww1936/navy/Convoys";
import {
  seaTradeUnits,
  tradeRoute,
} from "@openfront/engine/ww1936/navy/SeaTrade";
import { CONVOY, dayTick, messages, seaGame, setNavalBase } from "./convoyUtil";
import { REGION, SEA_KM, SR, TAG_ID, ZONE } from "./seaFixture";
import { stepTo, withTestPolitics } from "./util";

withTestPolitics();

const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
/** Through Italy's turn of `day` (economy, then the navy: k = smallID % 7). */
const afterItaly = (day: number) => dayTick(day, (TAG_ID.ITA % 7) + 1);

describe("sea trade (spec §10.2)", () => {
  test("a sea trade needs convoys and delivers by efficiency", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const ita = g.ce("ITA");
    // Britain's only working base: London (Malta's is out).
    setNavalBase(ww, REGION.malta, 0);
    const way = tradeRoute(navy, TAG_ID.ITA, TAG_ID.GBR)!;
    expect(way.zones).toEqual([ZONE.middle, ZONE.west]);
    expect(way.km).toBe(SEA_KM.westMiddle);
    expect(way.srs).toEqual([SR.central, SR.approaches]);
    // Italy buys Britain's tungsten, 8 a day: Rome → London, 300 km,
    // ceil(8 × 300 / 5000) = 1 convoy.
    expect(openTrade(ww.economy, ita, TAG_ID.GBR, TUNGSTEN, 1)).toBeNull();
    const [tr] = ww.economy.trades();
    const r = routeFor(navy, "trade", TAG_ID.ITA, tr.id)!;
    expect(r.need).toBe(convoysForTrade(8, 300));
    expect(r.need).toBe(1);
    expect(r.got).toBe(1);
    const day = ww.day(runner.game.ticks());
    stepTo(runner, afterItaly(day + 1));
    expect(ita.totals.imported[TUNGSTEN]).toBe(8);
    // The seller is paid whatever arrives.
    expect(g.ce("GBR").totals.receivedCivs).toBe(1);
    // No convoys: the next allocation gives none, the next turn gets none.
    ita.stock[CONVOY] = 0;
    stepTo(runner, afterItaly(day + 2));
    expect(r.got).toBe(0);
    stepTo(runner, afterItaly(day + 3));
    expect(ita.totals.imported[TUNGSTEN]).toBe(0);
    expect(g.ce("GBR").totals.receivedCivs).toBe(1);
    // Half the need, half the units (floor).
    r.km = 700;
    r.got = 1;
    expect(convoysForTrade(8, 700)).toBe(2);
    expect(seaTradeUnits(navy, TAG_ID.ITA, tr.id, 8)).toBe(4);
  });

  test("partners need a sea route", async () => {
    const g = await seaGame();
    const { ww, navy } = g;
    const econ = ww.economy;
    // Germany has no coast: no sea route to Britain, and no land one.
    expect(econ.countryNeighbours(TAG_ID.GBR)).toEqual([]);
    expect(ww.sameFaction(TAG_ID.DEU, TAG_ID.GBR)).toBe(false);
    expect(tradeRoute(navy, TAG_ID.DEU, TAG_ID.GBR)).toBeNull();
    expect(tradePartnerBlock(econ, TAG_ID.DEU, TAG_ID.GBR)).toBe("no_partner");
    expect(tradePartners(econ, TAG_ID.DEU)).not.toContain(TAG_ID.GBR);
    // Italy's Rome and Britain's ports share the sea: partners.
    expect(tradeRoute(navy, TAG_ID.ITA, TAG_ID.GBR)).not.toBeNull();
    expect(tradePartnerBlock(econ, TAG_ID.ITA, TAG_ID.GBR)).toBeNull();
    // Over land no convoys: Italy buys from Germany by its border.
    expect(
      openTrade(
        econ,
        g.ce("ITA"),
        TAG_ID.DEU,
        RESOURCE_IDS.indexOf("steel"),
        1,
      ),
    ).toBeNull();
    expect(navy.routes.size).toBe(0);
  });

  test("a closed route closes the trade", async () => {
    const g = await seaGame();
    const { ww, navy, runner, updates } = g;
    const ita = g.ce("ITA");
    setNavalBase(ww, REGION.malta, 0);
    expect(openTrade(ww.economy, ita, TAG_ID.GBR, TUNGSTEN, 1)).toBeNull();
    const [tr] = ww.economy.trades();
    expect(routeFor(navy, "trade", TAG_ID.ITA, tr.id)).not.toBeNull();
    // London's naval base bombed out: Britain has no working port left.
    damageBuilding(ww.economy, REGION.london, "naval_base", 6_000);
    expect(tradeRoute(navy, TAG_ID.ITA, TAG_ID.GBR)).toBeNull();
    const day = ww.day(runner.game.ticks());
    stepTo(runner, afterItaly(day + 1));
    expect(ww.economy.trades()).toEqual([]);
    expect(routeFor(navy, "trade", TAG_ID.ITA, tr.id)).toBeNull();
    expect(
      messages(updates, "events_display.ww1936_trade_closed"),
    ).toContainEqual({
      to: TAG_ID.ITA,
      params: { sellerTag: "GBR", resource: "tungsten" },
    });
  });
});
