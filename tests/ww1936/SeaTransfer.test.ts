// World War 1936 P4 (plan Task 5, lane C): sea moves on convoy voyages
// (spec §10.4, §11.3, plan decision 34) on ww1936sea, every country human.
import { MOVE_NONE, MOVE_SEA } from "@openfront/engine-api/ww1936/LandTypes";
import {
  divisionConvoys,
  interceptLossPm,
  seaTransferBlock,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import {
  damageDivisions,
  divisionWeightCenti,
} from "@openfront/engine/ww1936/land/SeaLift";
import { freeConvoysOf } from "@openfront/engine/ww1936/navy/Convoys";
import { convoysForDivisions } from "@openfront/engine/ww1936/navy/SeaTransfer";
import {
  clientOf,
  CONVOY,
  dayTick,
  fleetAtSea,
  seaGame,
  war,
} from "./convoyUtil";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { order, placeArmy, step, stepTo, withTestPolitics } from "./util";

withTestPolitics();

describe("sea moves (spec §10.4)", () => {
  test("a sea move binds convoys and arrives", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    const fra = g.ce("FRA");
    const a = placeArmy(game, "FRA", REGION.lyon, 1);
    const [div] = a.divisions;
    const row = () => land.divisions.rowOf(div);
    const need = divisionConvoys(divisionWeightCenti(land, div));
    expect(convoysForDivisions(navy, a.divisions)).toBe(need);
    const stock = fra.stock[CONVOY];
    // Lyon to London (Britain is France's ally): both harbors are the West
    // Sea, 0 km — a day at least.
    step(runner, 1, [
      order(clientOf("FRA"), {
        kind: "army_sea",
        army: a.id,
        region: REGION.london,
      }),
    ]);
    const [v] = [...navy.voyages.values()];
    expect(v.bound).toBe(need);
    expect(navy.routes.get(v.route)!.zones).toEqual([ZONE.west]);
    expect(freeConvoysOf(navy, TAG_ID.FRA)).toBe(stock - need);
    expect(land.divisions.mode[row()]).toBe(MOVE_SEA);
    expect(land.divisions.org[row()]).toBe(0);
    step(runner, 6);
    expect(land.divisions.region[row()]).toBe(REGION.lyon);
    expect(land.divisions.mode[row()]).toBe(MOVE_SEA);
    // The seventh tick: landed, the convoys free again.
    step(runner);
    expect(land.divisions.region[row()]).toBe(REGION.london);
    expect(land.divisions.mode[row()]).toBe(MOVE_NONE);
    expect(navy.voyages.size).toBe(0);
    expect(freeConvoysOf(navy, TAG_ID.FRA)).toBe(stock);
    // Too few idle convoys: refused.
    fra.stock[CONVOY] = need - 1;
    expect(
      navy.issue(
        TAG_ID.FRA,
        { kind: "army_sea", army: a.id, region: REGION.lyon },
        game.ticks(),
      ),
    ).toBe("no_convoys");
    // P2's conditions first: Paris is no port.
    const paris = placeArmy(game, "FRA", REGION.paris, 1);
    expect(
      navy.issue(
        TAG_ID.FRA,
        { kind: "army_sea", army: paris.id, region: REGION.london },
        game.ticks(),
      ),
    ).toBe("no_port");
  });

  test("the army card's judge takes the engine's order", () => {
    const ok = {
      fromPort: true,
      toPort: true,
      anyInBattle: false,
      routeKm: 300,
      convoysFree: 9,
      convoysNeed: 9,
    };
    expect(seaTransferBlock(ok)).toBeNull();
    expect(seaTransferBlock({ ...ok, toPort: false })).toBe("no_port");
    expect(seaTransferBlock({ ...ok, anyInBattle: true })).toBe("army_busy");
    expect(seaTransferBlock({ ...ok, routeKm: null })).toBe("no_sea_path");
    expect(seaTransferBlock({ ...ok, convoysFree: 8 })).toBe("no_convoys");
  });

  test("an unescorted crossing is intercepted below 50% supremacy", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    war(g, "ITA", "FRA");
    // Lane E's fuel: Italy has none of its own on the sea map, and a fleet
    // without fuel holds no supremacy.
    g.ce("ITA").fuelMilli = 1_000_000_000;
    // An Italian patrol holds the Western Approaches: France's side 0‰.
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["cl", 1, 2]],
      ZONE.west,
      "patrol",
      SR.approaches,
    );
    navy.setSupremacy(
      SR.approaches,
      new Map([[land.sideOf(TAG_ID.ITA), 1000]]),
    );
    expect(interceptLossPm(0, 1000)).toBe(100);
    const a = placeArmy(game, "FRA", REGION.lyon, 2);
    const rows = () => a.divisions.map((d) => land.divisions.rowOf(d));
    const hp0 = rows().map((r) => land.statsOf(r).hpMilli);
    const day = ww.day(game.ticks()) + 1;
    // Before France's turn (k = 4) the same day: it sails through it.
    stepTo(runner, dayTick(day));
    const stock = g.ce("FRA").stock[CONVOY];
    expect(
      navy.issue(
        TAG_ID.FRA,
        { kind: "army_sea", army: a.id, region: REGION.london },
        game.ticks(),
      ),
    ).toBeNull();
    const [v] = [...navy.voyages.values()];
    const bound = v.bound;
    stepTo(runner, dayTick(day, (TAG_ID.FRA % 7) + 1));
    // Each division lost 10% of its HP in men and equipment.
    rows().forEach((r, i) => {
      const hp = land.statsOf(r).hpMilli;
      expect(hp).toBeLessThan(hp0[i]);
      expect(hp).toBeGreaterThanOrEqual(Math.floor((hp0[i] * 880) / 1000));
    });
    // The convoys lose as much: bound × 10%, the remainder kept.
    const milli = bound * 100;
    const lost = Math.floor(milli / 1000);
    expect(v.bound).toBe(bound - lost);
    expect(g.ce("FRA").stock[CONVOY]).toBe(stock - lost);
    const st = navy.srState[ww.scenario.srIdxOf(SR.approaches)];
    expect(st.raidRest.get(TAG_ID.FRA)).toBe(milli - lost * 1000);
    expect(navy.country(TAG_ID.FRA)!.convoyLoss[day % 30]).toBe(milli);
    // Escorted by our side's supremacy (≥ 50%): no loss.
    navy.setSupremacy(
      SR.approaches,
      new Map([
        [land.sideOf(TAG_ID.FRA), 500],
        [land.sideOf(TAG_ID.ITA), 500],
      ]),
    );
    const hp1 = rows().map((r) => land.statsOf(r).hpMilli);
    stepTo(runner, dayTick(day + 1, 1));
    expect(navy.voyages.size).toBe(0);
    expect(rows().map((r) => land.statsOf(r).hpMilli)).toEqual(hp1);
    expect(
      rows().every((r) => land.divisions.region[r] === REGION.london),
    ).toBe(true);
  });

  test("a division below 10% strength sinks", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    war(g, "ITA", "FRA");
    // Lane E's fuel: Italy has none of its own on the sea map, and a fleet
    // without fuel holds no supremacy.
    g.ce("ITA").fuelMilli = 1_000_000_000;
    navy.setSupremacy(
      SR.approaches,
      new Map([[land.sideOf(TAG_ID.ITA), 1000]]),
    );
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["cl", 1, 2]],
      ZONE.west,
      "patrol",
      SR.approaches,
    );
    const a = placeArmy(game, "FRA", REGION.lyon, 2);
    const [weak, strong] = a.divisions;
    const row = (d: number) => land.divisions.rowOf(d);
    // No equipment to reinforce it before it sails (P2 Sustain skips a
    // division at sea): worn down to just above 10%, one more tenth sinks
    // it.
    const fra = g.ce("FRA");
    const convoys = fra.stock[CONVOY];
    fra.stock.fill(0);
    fra.stock[CONVOY] = convoys;
    const day = ww.day(game.ticks()) + 1;
    stepTo(runner, dayTick(day));
    for (let i = 0; i < 400 && land.strengthOf(row(weak)) >= 106; i++) {
      damageDivisions(land, [weak], 20);
    }
    expect(land.strengthOf(row(weak))).toBeGreaterThanOrEqual(100);
    expect(land.strengthOf(row(weak))).toBeLessThan(106);
    expect(
      navy.issue(
        TAG_ID.FRA,
        { kind: "army_sea", army: a.id, region: REGION.london },
        game.ticks(),
      ),
    ).toBeNull();
    stepTo(runner, dayTick(day, (TAG_ID.FRA % 7) + 1));
    expect(row(weak)).toBe(-1);
    expect(row(strong)).toBeGreaterThanOrEqual(0);
    const [v] = [...navy.voyages.values()];
    expect(v.divisions).toEqual([strong]);
    stepTo(runner, dayTick(day + 1, 1));
    expect(land.divisions.region[row(strong)]).toBe(REGION.london);
  });
});
