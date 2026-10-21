// World War 1936 P5 lane A (plan Task 6 Step 7; spec §13.3): lend-lease by
// sea on ww1936sea, every country human. Britain has no land neighbour:
// its goods for Turkey go London (Western Approaches) → the Isthmus.
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_LL_SEA_KM_PER_DAY } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  lendLeaseConvoys,
  lendLeaseSeaDays,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  ROUTE_SEA,
  USE_LEND_LEASE,
} from "@openfront/engine/ww1936/endgame/LendLease";
import { findRoute } from "@openfront/engine/ww1936/navy/Convoys";
import {
  CONVOY,
  dayTick,
  fleetAtSea,
  seaGame,
  setNavalBase,
  war,
} from "./convoyUtil";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  clearLand,
  clearStartSetup,
  step,
  stepTo,
  withTestPolitics,
} from "./util";

withTestPolitics();

const INF1 = equipKey("infantry_equipment", 1);

describe("World War 1936 P5: lend-lease by sea", () => {
  test("sea lend-lease needs convoys and loses to raiding", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const game = runner.game;
    const eg = ww.endgame;
    const [gbrId, turId] = [TAG_ID.GBR, TAG_ID.TUR];
    clearLand(game);
    clearStartSetup(ww.economy, g.ce("GBR"));
    clearStartSetup(ww.economy, g.ce("TUR"));
    // Turkey is at war (spec §13.2); a naval base on the Isthmus to land at.
    war(g, "SUN", "TUR");
    setNavalBase(ww, REGION.isthmus, 1);
    // Out of London only (Malta's base would be nearer the Isthmus).
    setNavalBase(ww, REGION.malta, 0);
    // Italian submarines raid the Western Approaches (Italy at war with Britain).
    war(g, "ITA", "GBR");
    g.ce("ITA").fuelMilli = 1_000_000_000;
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["ss", 2, 30]],
      ZONE.west,
      "raid",
      SR.approaches,
    );
    const gbr = g.ce("GBR");
    const tur = g.ce("TUR");
    gbr.stock[INF1] = 10_000;
    gbr.stock[CONVOY] = 0;
    expect(
      eg.issue(
        gbrId,
        {
          kind: "lend_lease",
          to: turId,
          item: "infantry_equipment",
          gen: 1,
          perMonth: 3_000,
        },
        game.ticks(),
      ),
    ).toBeNull();
    const c = eg.lendLease[0];
    const d = ww.day(game.ticks());
    const k = gbrId % 7;
    stepTo(runner, dayTick(d, k) + 1);
    // A sea route: 100 a day of 0.5 industry is 50 a day over its km.
    expect(c.route).toBe(ROUTE_SEA);
    const r = findRoute(navy, USE_LEND_LEASE, gbrId, c.id)!;
    expect(r.srs).toContain(SR.approaches);
    expect(r.need).toBe(lendLeaseConvoys(50, r.km));
    expect(r.need).toBeGreaterThan(0);
    // No convoys: nothing leaves the stock.
    expect(r.got).toBe(0);
    expect(eg.inTransit).toEqual([]);
    expect(gbr.stock[INF1]).toBe(10_000);
    // Convoys: the next day the route has them and the goods sail (the
    // day without convoys waits in the contract, at most a month).
    gbr.stock[CONVOY] = 5;
    stepTo(runner, dayTick(d + 1, k) + 1);
    expect(r.got).toBe(r.need);
    expect(eg.inTransit).toHaveLength(1);
    const t = eg.inTransit[0];
    expect(t.sea).toBe(true);
    expect(t.countMilli).toBe(200_000);
    expect(gbr.stock[INF1]).toBe(9_800);
    const sail = lendLeaseSeaDays(r.km, WW_LL_SEA_KM_PER_DAY);
    expect(t.arriveDay).toBe(d + 1 + sail);
    // Raiding: every sea region of the way takes its loss rate, each day.
    const before = tur.stock[INF1];
    stepTo(runner, dayTick(t.arriveDay));
    let milli = t.countMilli;
    for (const sr of t.srs) {
      const pm = navy.lossRatePm(ww.scenario.srIdxOf(sr), gbrId);
      milli -= Math.floor((milli * pm) / 1000);
    }
    expect(navy.lossRatePm(ww.scenario.srIdxOf(SR.approaches), gbrId)).toBe(30);
    step(runner);
    expect(milli).toBe(194_000);
    expect(tur.stock[INF1]).toBe(before + 194);
    expect(eg.inTransit.some((x) => x === t)).toBe(false);
  });
});
