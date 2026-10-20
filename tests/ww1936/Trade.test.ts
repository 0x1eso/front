import {
  GameUpdateType,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  RESOURCE_IDS,
  ResourceId,
  WW_MAX_TRADES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  freeCivMilli,
  TradeGraph,
  tradeRouteOk,
} from "@openfront/engine-lib/ww1936/EconomyRules";
import type { Player } from "@openfront/engine/game/Game";
import { GameRunner } from "@openfront/engine/GameRunner";
import {
  closeTrade,
  exportRoom,
  openTrade,
  partnerJudge,
  tradePartnerBlock,
  tradePartners,
} from "@openfront/engine/ww1936/economy/Trade";
import type {
  CountryEconomy,
  WwEconomy,
} from "@openfront/engine/ww1936/economy/WwEconomy";
import type { WorldWar } from "@openfront/engine/ww1936/WorldWar";
import { byTag, stamped, step, stepTo, wwRunnerCapture } from "./util";

// Every country is human: no AI economy (Task 6) opens deals that would
// share these sellers' room or these buyers' factories (pre-flight S3).
const TAGS = ["DEU", "ITA", "GBR", "FRA", "SUN", "POL"] as const;
const clientOf = (tag: CountryTag) =>
  `HUMAN00${TAGS.indexOf(tag as (typeof TAGS)[number]) + 1}`;

interface Game1936 {
  runner: GameRunner;
  updates: GameUpdateViewData[];
  ww: WorldWar;
  econ: WwEconomy;
  p: (tag: CountryTag) => Player;
  id: (tag: CountryTag) => number;
  ce: (tag: CountryTag) => CountryEconomy;
  /** Opens (or grows) a deal: `buyer` buys `res` from `seller`. */
  buy: (
    buyer: CountryTag,
    seller: CountryTag,
    res: ResourceId,
    civs?: number,
  ) => ReturnType<typeof openTrade>;
  /** The closing notices sent so far. */
  notices: () => { to: number | null; params: unknown }[];
}

async function game(): Promise<Game1936> {
  const { runner, updates } = await wwRunnerCapture(
    {},
    TAGS.map((country) => ({ clientID: clientOf(country), country })),
  );
  const g = runner.game;
  const ww = g.worldWar()!;
  const econ = ww.economy;
  const p = (tag: CountryTag) => byTag(g, tag);
  const id = (tag: CountryTag) => p(tag).smallID();
  const ce = (tag: CountryTag) => econ.country(id(tag))!;
  return {
    runner,
    updates,
    ww,
    econ,
    p,
    id,
    ce,
    buy: (buyer, seller, res, civs = 1) =>
      openTrade(econ, ce(buyer), id(seller), RESOURCE_IDS.indexOf(res), civs),
    notices: () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
        .filter((e) => e.message === "events_display.ww1936_trade_closed")
        .map((e) => ({ to: e.playerID, params: e.params })),
  };
}

const dayStart = (d: number) => dayStartTick(d, WW_PREP_TICKS);
/** Runs through day `d`: its common check and every country's step. */
const throughDay = (runner: GameRunner, d: number) =>
  stepTo(runner, dayStart(d + 1));
const graphOf = (econ: WwEconomy): TradeGraph => ({
  atWar: (a, b) => econ.ww.isAtWar(a, b),
  sameFaction: (a, b) => econ.ww.sameFaction(a, b),
  neighbours: (c) => econ.countryNeighbours(c),
  seaZones: (c) => econ.countrySeaZones(c),
});
const dealsOf = (econ: WwEconomy) =>
  econ.trades().map((t) => [t.buyer, t.seller, RESOURCE_IDS[t.res], t.civs]);

describe("trade (spec §7.4–§7.5)", () => {
  test("faction members trade anywhere", async () => {
    const { runner, econ, id, buy, ww } = await game();
    expect(ww.sameFaction(id("DEU"), id("ITA"))).toBe(true);
    expect(tradePartnerBlock(econ, id("ITA"), id("DEU"))).toBeNull();
    // Munich's steel: Germany may sell 10 a day under limited exports.
    expect(exportRoom(econ, id("DEU"), RESOURCE_IDS.indexOf("steel"))).toBe(10);
    expect(buy("ITA", "DEU", "steel")).toBeNull();
    throughDay(runner, 3);
    expect(dealsOf(econ)).toEqual([[id("ITA"), id("DEU"), "steel", 1]]);
  });

  test("the screens' export room is live, in the preparation minute too", async () => {
    const { runner, updates, econ, id, p } = await game();
    const STEEL = RESOURCE_IDS.indexOf("steel");
    const deu = id("DEU");
    /** Germany's export room in the last update that carried its summary. */
    const shown = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
        .flatMap((u) => u.data.countries)
        .filter((c) => c.smallID === deu)

        .slice(-1)[0].exportRoom;
    const live = () =>
      RESOURCE_IDS.map((_, k) => Math.max(0, exportRoom(econ, deu, k)));
    // The start's summaries go out with the clock's first tick.
    step(runner, 2);
    expect(shown()[STEEL]).toBe(10);
    expect(shown()).toEqual(live());
    // Italy buys in the preparation minute: no day has run since. An
    // order runs after the tick's clock, so its summaries go out with the
    // next tick's.
    const order = (client: string, order: WwOrder) => {
      step(runner, 1, [stamped(client, { type: "ww_order", order })]);
      step(runner);
    };
    order(clientOf("ITA"), {
      kind: "open_trade",
      seller: p("DEU").id(),
      resource: "steel",
      civs: 1,
    });
    expect(runner.game.ticks()).toBeLessThan(WW_PREP_TICKS);
    expect(econ.trades()).toHaveLength(1);
    expect(shown()[STEEL]).toBe(2);
    expect(shown()).toEqual(live());
    // A closed economy sells nothing: the deal waits for the day's check,
    // the screens show no room at once.
    order(clientOf("DEU"), {
      kind: "set_law",
      law: "trade",
      value: "closed_economy",
    });
    expect(exportRoom(econ, deu, STEEL)).toBeLessThan(0);
    expect(shown()[STEEL]).toBe(0);
    expect(shown()).toEqual(live());
  });

  test("a human's details list the partners the engine takes", async () => {
    const { runner, updates, econ, ww, id } = await game();
    const deu = id("DEU");
    const lastDetail = (smallID: number) =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.WwEconomy])
        .flatMap((u) => u.data.details)
        .filter((d) => d.smallID === smallID)

        .slice(-1)[0];
    step(runner, 2);
    for (const tag of TAGS) {
      const d = lastDetail(id(tag));
      expect(d.tradePartners).toEqual(tradePartners(econ, id(tag)));
      const judge = partnerJudge(econ, id(tag));
      for (const c of econ.countries()) {
        expect(d.tradePartners.includes(c.smallID)).toBe(
          judge(c.smallID) === null,
        );
      }
    }
    expect(lastDetail(deu).tradePartners).toContain(id("POL"));
    // A war with Poland cuts it, and the Soviet Union behind it, from the
    // next day's details.
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu, id("POL"), runner.game.ticks());
    throughDay(runner, 1);
    const now = lastDetail(deu).tradePartners;
    expect(now).toEqual(tradePartners(econ, deu));
    expect(now).not.toContain(id("POL"));
    expect(now).not.toContain(id("SUN"));
  });

  test("a land route runs through countries at peace", async () => {
    const { runner, econ, ww, id, ce, buy, notices } = await game();
    const deu = id("DEU");
    const g = graphOf(econ);
    // A partner by land only: no border, no faction, no shared sea.
    const seller = econ
      .countries()
      .map((c) => c.smallID)
      .find(
        (s) =>
          s !== deu &&
          !econ.countryNeighbours(deu).includes(s) &&
          !ww.sameFaction(deu, s) &&
          ![...econ.countrySeaZones(s)].some((z) =>
            econ.countrySeaZones(deu).has(z),
          ) &&
          tradeRouteOk(g, deu, s),
      );
    expect(seller).toBe(id("SUN"));
    // The way's only middle country: a war with it cuts the route.
    const middle = econ.countryNeighbours(deu).filter(
      (m) =>
        !tradeRouteOk(
          {
            ...g,
            atWar: (a, b) =>
              g.atWar(a, b) || (a === deu && b === m) || (a === m && b === deu),
          },
          deu,
          seller!,
        ),
    );
    expect(middle).toEqual([id("POL")]);
    // The Soviet Union opens for export (pre-flight S10).
    ce("SUN").laws.trade = "export_focus";
    expect(buy("DEU", "SUN", "steel")).toBeNull();
    throughDay(runner, 1);
    expect(econ.trades()).toHaveLength(1);
    expect(ce("DEU").totals.imported[RESOURCE_IDS.indexOf("steel")]).toBe(8);
    ww.setWar(deu, id("POL"), runner.game.ticks());
    throughDay(runner, 2);
    expect(econ.trades()).toEqual([]);
    expect(notices()).toEqual([
      { to: deu, params: { sellerTag: "SUN", resource: "steel" } },
    ]);
  });

  test("a shared sea zone is enough", async () => {
    const { runner, econ, ww, id, buy } = await game();
    const [ita, gbr] = [id("ITA"), id("GBR")];
    expect(ww.sameFaction(ita, gbr)).toBe(false);
    expect(econ.countryNeighbours(gbr)).toEqual([]);
    const shared = [...econ.countrySeaZones(gbr)].filter((z) =>
      econ.countrySeaZones(ita).has(z),
    );
    expect(shared.length).toBeGreaterThan(0);
    // Without the sea there is no way at all.
    const g = graphOf(econ);
    expect(tradeRouteOk(g, ita, gbr)).toBe(true);
    expect(tradeRouteOk({ ...g, seaZones: () => new Set() }, ita, gbr)).toBe(
      false,
    );
    expect(buy("ITA", "GBR", "tungsten")).toBeNull();
    throughDay(runner, 2);
    expect(dealsOf(econ)).toEqual([[ita, gbr, "tungsten", 1]]);
  });

  test("war and embargo close a deal", async () => {
    const { runner, econ, ww, id, buy, notices } = await game();
    const [ita, gbr] = [id("ITA"), id("GBR")];
    expect(buy("ITA", "GBR", "tungsten")).toBeNull();
    throughDay(runner, 0);
    ww.setWar(ita, gbr, runner.game.ticks());
    expect(econ.trades()).toHaveLength(1);
    throughDay(runner, 1);
    expect(econ.trades()).toEqual([]);
    expect(notices()).toEqual([
      { to: ita, params: { sellerTag: "GBR", resource: "tungsten" } },
    ]);

    // An embargo by the buyer does nothing; one by the seller closes it.
    const second = await game();
    expect(second.buy("ITA", "GBR", "rubber")).toBeNull();
    throughDay(second.runner, 0);
    second.p("ITA").addEmbargo(second.p("GBR"), false);
    throughDay(second.runner, 1);
    expect(second.econ.trades()).toHaveLength(1);
    second.p("GBR").addEmbargo(second.p("ITA"), false);
    throughDay(second.runner, 2);
    expect(second.econ.trades()).toEqual([]);
    expect(second.notices()).toEqual([
      { to: ita, params: { sellerTag: "GBR", resource: "rubber" } },
    ]);
  });

  test("the seller's room shrinks: newest deals close first", async () => {
    const { runner, econ, ww, id, ce, p, buy, notices } = await game();
    const sun = ce("SUN");
    const STEEL = RESOURCE_IDS.indexOf("steel");
    // Moscow 10 and Kiev 30 steel at infrastructure 3 give 36; free trade
    // sells 80%: 28 a day, three deals of 8.
    sun.laws.trade = "free_trade";
    expect(exportRoom(econ, sun.smallID, STEEL)).toBe(28);
    for (const buyer of ["DEU", "ITA", "POL"] as const) {
      expect(buy(buyer, "SUN", "steel")).toBeNull();
    }
    expect(exportRoom(econ, sun.smallID, STEEL)).toBe(4);
    throughDay(runner, 0);
    expect(econ.trades()).toHaveLength(3);
    // Germany takes Moscow: the next day it is occupied, the Soviet step
    // finds only Kiev's 27 (21 for sale), and the day after the newest
    // deal closes.
    const moscow = ww.scenario.landRegions.find((r) => r.name === "Moscow")!;
    p("DEU").conquer(ww.scenario.vpTile(moscow));
    throughDay(runner, 1);
    expect(econ.controllerOf(moscow.id)).toBe(id("DEU"));
    expect(sun.totals.produced[STEEL]).toBe(27);
    expect(econ.trades()).toHaveLength(3);
    throughDay(runner, 2);
    expect(dealsOf(econ)).toEqual([
      [id("DEU"), sun.smallID, "steel", 1],
      [id("ITA"), sun.smallID, "steel", 1],
    ]);
    expect(notices()).toEqual([
      { to: id("POL"), params: { sellerTag: "SUN", resource: "steel" } },
    ]);
  });

  test("the buyer cannot pay: newest close first", async () => {
    const { runner, econ, id, ce, buy, notices } = await game();
    const ita = ce("ITA");
    // Italy: 4 civilian factories less 25% consumer goods of 7 → 2 to pay.
    expect(buy("ITA", "GBR", "tungsten")).toBeNull();
    expect(buy("ITA", "DEU", "steel")).toBeNull();
    throughDay(runner, 0);
    expect(econ.trades()).toHaveLength(2);
    expect(ita.totals.paidCivs).toBe(2);
    // A civilian economy takes 35% for consumer goods: one factory left.
    ita.laws.economy = "civilian";
    throughDay(runner, 1);
    expect(ita.totals.cgMilli).toBe(2450);
    expect(econ.trades()).toHaveLength(2);
    throughDay(runner, 2);
    expect(dealsOf(econ)).toEqual([[id("ITA"), id("GBR"), "tungsten", 1]]);
    expect(notices()).toEqual([
      { to: id("ITA"), params: { sellerTag: "DEU", resource: "steel" } },
    ]);
  });

  test("buying moves civs and resources", async () => {
    const { runner, econ, p, ce } = await game();
    const ita = ce("ITA");
    const gbr = ce("GBR");
    const TUNGSTEN = RESOURCE_IDS.indexOf("tungsten");
    throughDay(runner, 0);
    const itaFree = ita.totals.freeCivMilli;
    const gbrFree = gbr.totals.freeCivMilli;
    step(runner, 1, [
      stamped(clientOf("ITA"), {
        type: "ww_order",
        order: {
          kind: "open_trade",
          seller: p("GBR").id(),
          resource: "tungsten",
          civs: 1,
        },
      }),
    ]);
    expect(econ.trades()).toHaveLength(1);
    throughDay(runner, 1);
    expect(ita.totals.paidCivs).toBe(1);
    expect(ita.totals.imported[TUNGSTEN]).toBe(8);
    expect(gbr.totals.receivedCivs).toBe(1);
    expect(gbr.totals.exported[TUNGSTEN]).toBe(8);
    expect(ita.totals.freeCivMilli).toBe(itaFree - 1000);
    expect(gbr.totals.freeCivMilli).toBe(gbrFree + 1000);
    expect(ita.totals.freeCivMilli).toBe(
      freeCivMilli(ita.totals.civ, ita.totals.cgMilli, 1, 0),
    );
    // The buyer closes it; the next day nothing moves.
    const [deal] = econ.trades();
    expect(closeTrade(econ, gbr, deal.id)).toBe("bad_index");
    expect(closeTrade(econ, ita, deal.id + 1)).toBe("bad_index");
    expect(closeTrade(econ, ita, deal.id)).toBeNull();
    throughDay(runner, 2);
    expect(ita.totals.imported[TUNGSTEN]).toBe(0);
    expect(gbr.totals.exported[TUNGSTEN]).toBe(0);
    expect(gbr.totals.receivedCivs).toBe(0);
  });

  test("a second order grows the deal", async () => {
    const { econ, id, ce, buy } = await game();
    // Export focus: half of the Soviet 36 steel, two deals' worth.
    ce("SUN").laws.trade = "export_focus";
    expect(buy("DEU", "SUN", "steel")).toBeNull();
    expect(buy("DEU", "SUN", "steel")).toBeNull();
    expect(dealsOf(econ)).toEqual([[id("DEU"), id("SUN"), "steel", 2]]);
    expect(buy("DEU", "SUN", "steel")).toBe("no_room");
    expect(econ.trades()[0].civs).toBe(2);
  });

  test("no deal with oneself, the dead or beyond room", async () => {
    const { econ, ww, id, p, buy, runner } = await game();
    expect(buy("DEU", "DEU", "steel")).toBe("no_partner");
    // London's 19 tungsten under free trade: 15 for sale, one factory's 8.
    expect(buy("ITA", "GBR", "tungsten", 2)).toBe("no_room");
    expect(buy("ITA", "GBR", "tungsten", 0)).toBe("no_civs");
    // Poland pays one civilian factory at most.
    expect(buy("POL", "GBR", "rubber")).toBeNull();
    expect(buy("POL", "GBR", "steel")).toBe("no_civs");
    // A capitulated seller, then a dead one.
    ww.addCapitulation(id("FRA"), id("DEU"), runner.game.ticks());
    expect(tradePartnerBlock(econ, id("ITA"), id("FRA"))).toBe("no_partner");
    expect(buy("ITA", "FRA", "steel")).toBe("no_partner");
    const pol = p("POL");
    for (const t of Array.from(pol.tiles())) p("DEU").conquer(t);
    expect(pol.isAlive()).toBe(false);
    expect(buy("ITA", "POL", "steel")).toBe("no_partner");
    // Twenty deals (empty ones here): no new one, but an open one may
    // still grow.
    for (let i = 0; i < WW_MAX_TRADES; i++) {
      econ.addTrade(id("ITA"), id("GBR"), i % RESOURCE_IDS.length, 0);
    }
    expect(buy("ITA", "DEU", "steel")).toBe("trades_full");
    expect(buy("ITA", "GBR", "oil")).toBe("no_room");
    expect(buy("ITA", "GBR", "tungsten")).toBeNull();
    expect(econ.trades()).toHaveLength(WW_MAX_TRADES + 1);
  });

  test("the day's check judges partners as tradePartnerBlock does", async () => {
    const { runner, econ, ww, id, p } = await game();
    const ids = econ.countries().map((c) => c.smallID);
    const same = () => {
      for (const b of ids) {
        const judge = partnerJudge(econ, b);
        for (const s of ids) {
          expect(judge(s)).toBe(tradePartnerBlock(econ, b, s));
        }
        expect(tradePartners(econ, b)).toEqual(
          ids.filter((s) => tradePartnerBlock(econ, b, s) === null),
        );
      }
    };
    same();
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(id("DEU"), id("POL"), runner.game.ticks());
    same();
    ww.setWar(id("ITA"), id("FRA"), runner.game.ticks());
    p("GBR").addEmbargo(p("ITA"), false);
    same();
    ww.addCapitulation(id("POL"), id("DEU"), runner.game.ticks());
    same();
  });
});

describe("trade routes (tradeRouteOk, spec §7.4)", () => {
  // Countries 1..5; a line of land borders 1–2–3–4, 5 alone.
  const graph = (over: Partial<TradeGraph> = {}): TradeGraph => ({
    atWar: () => false,
    sameFaction: () => false,
    neighbours: (c) =>
      ({ 1: [2], 2: [1, 3], 3: [2, 4], 4: [3] })[c as 1 | 2 | 3 | 4] ?? [],
    seaZones: () => new Set(),
    ...over,
  });
  const pair = (a: number, b: number) => (x: number, y: number) =>
    (x === a && y === b) || (x === b && y === a);

  test("faction members need no way", () => {
    expect(tradeRouteOk(graph(), 1, 5)).toBe(false);
    expect(tradeRouteOk(graph({ sameFaction: pair(1, 5) }), 1, 5)).toBe(true);
  });

  test("a shared sea zone", () => {
    const zones = (z: Record<number, number[]>) => (c: number) =>
      new Set(z[c] ?? []);
    expect(
      tradeRouteOk(
        graph({ seaZones: zones({ 1: [40001], 5: [40001] }) }),
        1,
        5,
      ),
    ).toBe(true);
    expect(
      tradeRouteOk(
        graph({ seaZones: zones({ 1: [40001], 5: [40002] }) }),
        1,
        5,
      ),
    ).toBe(false);
  });

  test("land through countries at peace", () => {
    expect(tradeRouteOk(graph(), 1, 4)).toBe(true);
    // A war between other countries does not cut the buyer's way.
    expect(tradeRouteOk(graph({ atWar: pair(2, 3) }), 1, 4)).toBe(true);
    expect(tradeRouteOk(graph(), 1, 1)).toBe(false);
  });

  test("a middle country at war with the buyer cuts the way", () => {
    expect(tradeRouteOk(graph({ atWar: pair(1, 3) }), 1, 4)).toBe(false);
    // Its direct neighbour is still reached.
    expect(tradeRouteOk(graph({ atWar: pair(1, 2) }), 1, 2)).toBe(false);
    expect(tradeRouteOk(graph({ atWar: pair(1, 3) }), 1, 2)).toBe(true);
    // No deal with an enemy, whatever the faction or the sea.
    expect(
      tradeRouteOk(graph({ atWar: pair(1, 2), sameFaction: pair(1, 2) }), 1, 2),
    ).toBe(false);
  });
});
