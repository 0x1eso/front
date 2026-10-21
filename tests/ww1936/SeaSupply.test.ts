// World War 1936 P4 (plan Task 5, lane C): overseas supply (spec §10.3,
// §11.5) on ww1936sea, every country human.
import { seaHubCapacity } from "@openfront/engine-lib/ww1936/ConvoyRules";
import { routeFor } from "@openfront/engine/ww1936/navy/Convoys";
import { seaHubCapacityMilli } from "@openfront/engine/ww1936/navy/SeaSupply";
import { CONVOY, dayTick, seaGame, war } from "./convoyUtil";
import { NAVAL_BASE, PATH_KM, REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { placeArmy, stepTo, withTestPolitics } from "./util";

withTestPolitics();

const afterItaly = (day: number) => dayTick(day, (TAG_ID.ITA % 7) + 1);

describe("overseas supply (spec §10.3)", () => {
  test("a sea hub's capacity follows convoys and enemy supremacy", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    const side = land.sideOf(TAG_ID.ITA);
    // Italy holds Malta (an island: no railway to Rome), a division there.
    land.setController(REGION.malta, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.malta, 1);
    // Rome is Italy's capital: joined by rail, land supply, no sea hub.
    expect(seaHubCapacityMilli(navy, REGION.rome, side)).toBe(0);
    stepTo(runner, afterItaly(3));
    // Rome → Malta in the same harbor zone (0 km): one convoy at least.
    const r = routeFor(navy, "supply", TAG_ID.ITA, REGION.malta)!;
    expect(r.zones).toEqual([ZONE.middle]);
    expect([r.km, r.need, r.got]).toEqual([0, 1, 1]);
    // Level 1: min(4 + 2, convoys × 500 / km) = 6,000 a day.
    expect(NAVAL_BASE[REGION.malta]).toBe(1);
    expect(seaHubCapacityMilli(navy, REGION.malta, side)).toBe(6_000);
    expect(seaHubCapacityMilli(navy, REGION.malta, side)).toBe(
      seaHubCapacity(1, r.got, r.km, 1000),
    );
    // The supply runs from it: Malta's division is no longer cut off.
    expect(land.encircled[REGION.malta]).toBe(0);
    expect(land.seaHubUse[REGION.malta]).toBeGreaterThan(0);
    // An enemy holding the Central Waters: half (1000 − 1000 / 2).
    war(g, "ITA", "GBR");
    navy.setSupremacy(SR.central, new Map([[land.sideOf(TAG_ID.GBR), 1000]]));
    expect(seaHubCapacityMilli(navy, REGION.malta, side)).toBe(3_000);
    // Another side's question gets nothing.
    expect(
      seaHubCapacityMilli(navy, REGION.malta, land.sideOf(TAG_ID.GBR)),
    ).toBe(0);
    // No convoys: no supply.
    g.ce("ITA").stock[CONVOY] = 0;
    stepTo(runner, afterItaly(4));
    expect(r.got).toBe(0);
    expect(seaHubCapacityMilli(navy, REGION.malta, side)).toBe(0);
  });

  test("a beachhead ships 6 a day for 30 days", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    const side = land.sideOf(TAG_ID.ITA);
    // The Isthmus (no naval base, a harbor on the East Sea, no land way
    // from Italy) taken by Italy: lane I's beachhead table, a division.
    land.setController(REGION.isthmus, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.isthmus, 1);
    const day = ww.day(game.ticks());
    navy.beachhead.set(REGION.isthmus, { side, until: day + 30 });
    stepTo(runner, afterItaly(day + 2));
    // Rome → the Isthmus by the Narrows and the canal (its shore is ours).
    const r = routeFor(navy, "supply", TAG_ID.ITA, REGION.isthmus)!;
    expect(r.km).toBe(PATH_KM.middleToEast);
    expect(r.got).toBe(r.need);
    // min(6, convoys × 500 / km) × the route's efficiency.
    expect(seaHubCapacityMilli(navy, REGION.isthmus, side)).toBe(
      Math.min(6_000, Math.floor((r.got * 500_000) / r.km)),
    );
    expect(seaHubCapacityMilli(navy, REGION.isthmus, side)).toBeGreaterThan(0);
    // Past its days: no hub, the route goes.
    navy.beachhead.set(REGION.isthmus, { side, until: day + 2 });
    stepTo(runner, afterItaly(day + 4));
    expect(routeFor(navy, "supply", TAG_ID.ITA, REGION.isthmus)).toBeNull();
    expect(seaHubCapacityMilli(navy, REGION.isthmus, side)).toBe(0);
  });

  test("a war closing the canal sends the supply round", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    // Italy holds Kiev (its harbor: the East Sea), a division there.
    land.setController(REGION.kiev, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.kiev, 1);
    const day = ww.day(game.ticks());
    stepTo(runner, afterItaly(day + 2));
    const r = routeFor(navy, "supply", TAG_ID.ITA, REGION.kiev)!;
    // Through the Narrows and the Isthmus canal: 220 km.
    expect(r.km).toBe(PATH_KM.middleToEast);
    expect(r.srs).toEqual([SR.central, SR.eastern]);
    // At war with Turkey, the canal's shore: round by the West Sea.
    war(g, "ITA", "TUR");
    stepTo(runner, afterItaly(day + 3));
    expect(r.km).toBe(PATH_KM.middleToEastCanalClosed);
    expect(r.srs).toEqual([SR.central, SR.approaches, SR.eastern]);
  });
});
