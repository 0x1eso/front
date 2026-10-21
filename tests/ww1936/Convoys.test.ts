// World War 1936 P4 (plan Task 5, lane C): the convoys' whole number and
// their allocation (spec §10.1, plan decisions 20–21) on ww1936sea.
import { RESOURCE_IDS } from "@openfront/engine-api/ww1936/EconomyTypes";
import { snapshotGame } from "@openfront/engine/snapshot/GameSnapshot";
import { openTrade } from "@openfront/engine/ww1936/economy/Trade";
import { freeConvoysOf, routeFor } from "@openfront/engine/ww1936/navy/Convoys";
import { convoysForDivisions } from "@openfront/engine/ww1936/navy/SeaTransfer";
import {
  applyEffects,
  makeCtx,
} from "@openfront/engine/ww1936/politics/Dispatch";
import { diffGraphs, diffSnapshots } from "../util/Snapshot";
import {
  clientOf,
  CONVOY,
  dayTick,
  fleetAtSea,
  seaGame,
  setNavalBase,
  TAGS,
  war,
} from "./convoyUtil";
import { REGION, SEA, SEA_KM, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  gameHash,
  placeArmy,
  step,
  stepTo,
  withTestPolitics,
  wwRestore,
} from "./util";

withTestPolitics();

const STEEL = RESOURCE_IDS.indexOf("steel");
const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
const COUNTRIES = Object.values(TAG_ID);

describe("convoys (spec §10.1)", () => {
  test("convoys are conserved", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    war(g, "ITA", "GBR");
    war(g, "ITA", "FRA");
    // A sea trade through the Western Approaches: Britain buys Soviet
    // steel (London → Kiev over the date line).
    g.ce("SUN").laws.trade = "export_focus";
    expect(openTrade(ww.economy, g.ce("GBR"), TAG_ID.SUN, STEEL, 1)).toBeNull();
    // Overseas supply: Italy holds Malta with a division there.
    land.setController(REGION.malta, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.malta, 1);
    // Italian raiders and an Italian hold on the Western Approaches.
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["ss", 2, 30]],
      ZONE.west,
      "raid",
      SR.approaches,
    );
    navy.setSupremacy(
      SR.approaches,
      new Map([[land.sideOf(TAG_ID.ITA), 1000]]),
    );
    // French divisions shuttle Lyon ⇄ London through it, intercepted.
    const fra = placeArmy(game, "FRA", REGION.lyon, 2);
    const stock = () =>
      COUNTRIES.reduce((n, id) => n + ww.economy.country(id)!.stock[CONVOY], 0);
    const start = stock();
    const sunk0 = navy.convoysSunkTotal;
    let given = 0;
    let voyages = 0;
    const end = dayTick(60);
    while (game.ticks() < end) {
      if (game.ticks() === dayTick(30)) {
        // P3's convoys effect: the only other way into the stock.
        applyEffects(makeCtx(ww.politics, TAG_ID.GBR, 0, 0, game.ticks()), [
          { kind: "convoys", amount: 10 },
        ]);
        given += 10;
      }
      const a = land.armies.get(fra.id);
      if (
        a !== undefined &&
        ![...navy.voyages.values()].some((v) => v.army === a.id)
      ) {
        const here = land.armyRegion(a);
        const to = here === REGION.lyon ? REGION.london : REGION.lyon;
        if (
          navy.issue(
            TAG_ID.FRA,
            { kind: "army_sea", army: a.id, region: to },
            game.ticks(),
          ) === null
        ) {
          voyages++;
        }
      }
      step(runner);
      for (const id of COUNTRIES) {
        const ce = ww.economy.country(id)!;
        let bound = 0;
        let got = 0;
        for (const v of navy.voyages.values())
          if (v.owner === id) bound += v.bound;
        for (const r of navy.routes.values()) if (r.owner === id) got += r.got;
        // stock = Σ bound + Σ got + free, free never below 0.
        expect(bound + got + freeConvoysOf(navy, id)).toBe(ce.stock[CONVOY]);
      }
      // The stock changes by losses and effects only (no naval lines here).
      expect(stock()).toBe(start + given - (navy.convoysSunkTotal - sunk0));
    }
    // Every way was taken: trade and supply routes, voyages, losses.
    expect(voyages).toBeGreaterThan(2);
    expect(navy.convoysSunkTotal - sunk0).toBeGreaterThan(0);
    expect(given).toBe(10);
    expect(routeFor(navy, "supply", TAG_ID.ITA, REGION.malta)?.got).toBe(1);
  }, 120_000);

  test("allocation goes voyage → supply → trade", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    const ita = g.ce("ITA");
    // Malta Italy's, a division there (the supply hub's demand), another
    // army in Rome to sail there; Britain's only port is London. Italy's
    // by law too: held from Britain at peace, P5 spec §5.3 (lane X) would
    // hand it back, and a war would close the trade with Britain.
    ww.politics.setLegalOwner(REGION.malta, TAG_ID.ITA);
    land.setController(REGION.malta, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.malta, 1);
    const army = placeArmy(game, "ITA", REGION.rome, 1);
    stepTo(runner, dayTick(3));
    const supply = routeFor(navy, "supply", TAG_ID.ITA, REGION.malta)!;
    expect(supply.km).toBe(0);
    expect(supply.need).toBe(1);
    // A sea trade: Rome → London, 300 km, 8 units: one convoy.
    expect(openTrade(ww.economy, ita, TAG_ID.GBR, TUNGSTEN, 1)).toBeNull();
    const tr = ww.economy.trades().find((t) => t.buyer === TAG_ID.ITA)!;
    const trade = routeFor(navy, "trade", TAG_ID.ITA, tr.id)!;
    expect(trade.km).toBe(SEA_KM.westMiddle);
    expect(trade.need).toBe(1);
    // Day 4, before Italy's turn (k = 2): the army sails, binding its convoys.
    stepTo(runner, dayTick(4));
    const need = convoysForDivisions(navy, army.divisions);
    expect(
      navy.issue(
        TAG_ID.ITA,
        { kind: "army_sea", army: army.id, region: REGION.malta },
        game.ticks(),
      ),
    ).toBeNull();
    const [v] = [...navy.voyages.values()];
    expect(v.bound).toBe(need);
    // One convoy over the voyage's: the supply hub takes it, not the trade.
    ita.stock[CONVOY] = need + 1;
    stepTo(runner, dayTick(4, (TAG_ID.ITA % 7) + 1));
    expect(navy.voyages.get(v.id)?.bound).toBe(need);
    expect([supply.got, trade.got]).toEqual([1, 0]);
    expect(freeConvoysOf(navy, TAG_ID.ITA)).toBe(0);
    // Two: both.
    ita.stock[CONVOY] = need + 2;
    stepTo(runner, dayTick(5, (TAG_ID.ITA % 7) + 1));
    expect([supply.got, trade.got]).toEqual([1, 1]);
    // Landed: the voyage's convoys are free. A naval base lost at Malta:
    // no hub, the route goes and frees its convoy too.
    expect(navy.voyages.size).toBe(0);
    setNavalBase(ww, REGION.malta, 0);
    stepTo(runner, dayTick(6, (TAG_ID.ITA % 7) + 1));
    expect(routeFor(navy, "supply", TAG_ID.ITA, REGION.malta)).toBeNull();
    expect(trade.got).toBe(1);
    expect(freeConvoysOf(navy, TAG_ID.ITA)).toBe(need + 1);
  }, 60_000);

  test("a convoys effect below 0 never leaves more bound than the stock", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    const ita = g.ce("ITA");
    // Italy's by law (see above: a trade with Britain follows).
    ww.politics.setLegalOwner(REGION.malta, TAG_ID.ITA);
    land.setController(REGION.malta, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.malta, 1);
    const army = placeArmy(game, "ITA", REGION.rome, 1);
    stepTo(runner, dayTick(3));
    expect(openTrade(ww.economy, ita, TAG_ID.GBR, TUNGSTEN, 1)).toBeNull();
    expect(
      navy.issue(
        TAG_ID.ITA,
        { kind: "army_sea", army: army.id, region: REGION.malta },
        game.ticks(),
      ),
    ).toBeNull();
    const held = () => {
      let n = 0;
      for (const v of navy.voyages.values())
        if (v.owner === TAG_ID.ITA) n += v.bound;
      for (const r of navy.routes.values())
        if (r.owner === TAG_ID.ITA) n += r.got;
      return n;
    };
    const [v] = [...navy.voyages.values()];
    expect(held()).toBe(v.bound + 2);
    // P3's effect takes all but one: trades give way first, then supply,
    // then the voyage.
    applyEffects(makeCtx(ww.politics, TAG_ID.ITA, 0, 0, game.ticks()), [
      { kind: "convoys", amount: -(ita.stock[CONVOY] - 1) },
    ]);
    expect(ita.stock[CONVOY]).toBe(1);
    expect(held()).toBe(1);
    expect(held() + freeConvoysOf(navy, TAG_ID.ITA)).toBe(ita.stock[CONVOY]);
    for (let i = 0; i < 30; i++) {
      step(runner);
      expect(held()).toBeLessThanOrEqual(ita.stock[CONVOY]);
      expect(held() + freeConvoysOf(navy, TAG_ID.ITA)).toBe(ita.stock[CONVOY]);
    }
  });

  test("a restored game goes on exactly: routes, voyages, losses", async () => {
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const land = ww.land;
    const game = runner.game;
    war(g, "ITA", "GBR");
    war(g, "ITA", "FRA");
    g.ce("SUN").laws.trade = "export_focus";
    expect(openTrade(ww.economy, g.ce("GBR"), TAG_ID.SUN, STEEL, 1)).toBeNull();
    land.setController(REGION.malta, TAG_ID.ITA, game.ticks());
    placeArmy(game, "ITA", REGION.malta, 1);
    fleetAtSea(
      navy,
      TAG_ID.ITA,
      REGION.rome,
      [["ss", 2, 30]],
      ZONE.west,
      "raid",
      SR.approaches,
    );
    navy.setSupremacy(
      SR.approaches,
      new Map([[land.sideOf(TAG_ID.ITA), 1000]]),
    );
    const fra = placeArmy(game, "FRA", REGION.lyon, 2);
    stepTo(runner, dayTick(5, 1));
    expect(
      navy.issue(
        TAG_ID.FRA,
        { kind: "army_sea", army: fra.id, region: REGION.london },
        game.ticks(),
      ),
    ).toBeNull();
    step(runner, 2);
    // Mid-voyage, with trade and supply routes and raid remainders.
    expect(navy.voyages.size).toBe(1);
    expect(navy.routes.size).toBeGreaterThanOrEqual(3);
    const humans = TAGS.map((country) => ({
      clientID: clientOf(country),
      country,
    }));
    const b = await wwRestore(runner, humans, SEA.map);
    expect(diffGraphs(game, b.game)).toEqual([]);
    for (let i = 0; i < 40; i++) {
      step(runner);
      step(b);
      expect(gameHash(b)).toBe(gameHash(runner));
    }
    expect(diffSnapshots(snapshotGame(game), snapshotGame(b.game))).toEqual([]);
    expect(b.game.worldWar()!.navy.voyages.size).toBe(0);
  }, 120_000);
});
