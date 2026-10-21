// World War 1936 P4 (plan Task 5, lane C): convoy raiding, escorts and ASW
// (spec §10.6) on ww1936sea, every country human.
import { CONVOY_USES } from "@openfront/engine-api/ww1936/NavyTypes";
import {
  aswDamageMilli,
  convoyLossRatePm,
  convoySinkMilli,
  escortPowerCenti,
  raidPowerCenti,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { shipStats } from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";
import { noteKills } from "@openfront/engine/ww1936/endgame/Wars";
import { routeFor } from "@openfront/engine/ww1936/navy/Convoys";
import {
  convoyLossPmOf,
  convoyWar,
} from "@openfront/engine/ww1936/navy/ConvoyWar";
import type { SeaRoute, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { vi } from "vitest";
import {
  CONVOY,
  dayTick,
  fleetAtSea,
  messages,
  type SeaGame,
  seaGame,
  war,
} from "./convoyUtil";
import { REGION, SR, TAG_ID, ZONE } from "./seaFixture";
import { placeArmy, step, stepTo, withTestPolitics } from "./util";

withTestPolitics();

// P5 (pre-flight §0-10): the war score hears of every convoy sunk.
vi.mock("@openfront/engine/ww1936/endgame/Wars", async (original) => {
  const real =
    await original<typeof import("@openfront/engine/ww1936/endgame/Wars")>();
  return { ...real, noteKills: vi.fn(real.noteKills) };
});

/** A British trade route through the Western Approaches carrying `got` convoys. */
function britishRoute(navy: WwNavy, got: number, day: number): SeaRoute {
  const r: SeaRoute = {
    id: navy.nextRouteId++,
    use: CONVOY_USES.indexOf("trade"),
    owner: TAG_ID.GBR,
    ref: 999,
    zones: [ZONE.west],
    km: 0,
    srs: [SR.approaches],
    need: got,
    got,
    nextDay: day + 7,
  };
  navy.routes.set(r.id, r);
  return r;
}

/** Italian submarines raiding the Western Approaches: 30 of the 1936 type. */
async function raiders(): Promise<{ g: SeaGame; day: number; idx: number }> {
  const g = await seaGame();
  war(g, "ITA", "GBR");
  // Lane E's fuel: Italy has none of its own on the sea map, and raiders
  // without fuel raid nothing once its day has run.
  g.ce("ITA").fuelMilli = 1_000_000_000;
  fleetAtSea(
    g.navy,
    TAG_ID.ITA,
    REGION.rome,
    [["ss", 2, 30]],
    ZONE.west,
    "raid",
    SR.approaches,
  );
  return {
    g,
    day: g.ww.day(g.runner.game.ticks()),
    idx: g.ww.scenario.srIdxOf(SR.approaches),
  };
}

describe("convoy war (spec §10.6)", () => {
  test("raiders sink convoys by the formula", async () => {
    const { g, day, idx } = await raiders();
    const { navy, ww } = g;
    const ita = g.ce("ITA");
    // 30 submarines × torpedo 25: raid 75,000 centi.
    expect(shipStats("ss", 2, emptyStats(), new Set()).torpedo).toBe(2500);
    expect(raidPowerCenti(30 * 2500, 0, 0, emptyStats(), new Set(), 1000)).toBe(
      75_000,
    );
    const raid = raidPowerCenti(
      30 * 2500,
      0,
      0,
      ita.stats,
      ita.researched,
      ita.fuelRatioPm,
    );
    expect(raid).toBe(75_000);
    britishRoute(navy, 30, day);
    const stock = g.ce("GBR").stock[CONVOY];
    // Area 3: the cap, 30‰ a day of 30 convoys = 900 milli.
    expect(ww.scenario.sr(SR.approaches)!.area).toBe(3);
    convoyWar(navy, SR.approaches, day);
    const st = navy.srState[idx];
    expect(convoySinkMilli(30, raid, 0, 3)).toBe(900);
    expect(st.lossYesterday.get(TAG_ID.GBR)).toBe(900);
    expect(st.raidRest.get(TAG_ID.GBR)).toBe(900);
    expect(g.ce("GBR").stock[CONVOY]).toBe(stock);
    expect(st.raidedYesterday).toEqual(
      navy.fleetsOf(TAG_ID.ITA).map((f) => f.id),
    );
    // P5's loss rate, by side.
    expect(convoyLossRatePm(raid, 0, 3)).toBe(30);
    expect(convoyLossPmOf(navy, TAG_ID.GBR, SR.approaches)).toBe(30);
    // The next day: 1,800 milli — one convoy goes, 800 stay.
    vi.mocked(noteKills).mockClear();
    convoyWar(navy, SR.approaches, day + 1);
    expect(g.ce("GBR").stock[CONVOY]).toBe(stock - 1);
    // Italy sank it (the war score, lane W).
    expect(vi.mocked(noteKills).mock.calls.map((c) => c.slice(1))).toEqual([
      [TAG_ID.ITA, TAG_ID.GBR, "convoy", 1],
    ]);
    expect(st.raidRest.get(TAG_ID.GBR)).toBe(800);
    const [r] = [...navy.routes.values()];
    expect(r.got).toBe(29);
  });

  test("escorts cut the loss", async () => {
    const { g, day, idx } = await raiders();
    const { navy } = g;
    const ita = g.ce("ITA");
    const gbr = g.ce("GBR");
    // 40 British destroyers escorting there.
    fleetAtSea(
      navy,
      TAG_ID.GBR,
      REGION.london,
      [["dd", 1, 40]],
      ZONE.west,
      "escort",
      SR.approaches,
    );
    const dd = navy.statsFor(TAG_ID.GBR, "dd", 1);
    const escort = escortPowerCenti(
      40 * (dd.depth * 2 + dd.light),
      0,
      0,
      0,
      gbr.stats,
    );
    expect(escort).toBeGreaterThan(0);
    const raid = raidPowerCenti(
      30 * 2500,
      0,
      0,
      ita.stats,
      ita.researched,
      ita.fuelRatioPm,
    );
    britishRoute(navy, 30, day);
    convoyWar(navy, SR.approaches, day);
    const sink = convoySinkMilli(30, raid, escort, 3);
    expect(sink).toBeLessThan(900);
    expect(navy.srState[idx].lossYesterday.get(TAG_ID.GBR)).toBe(sink);
    expect(convoyLossPmOf(navy, TAG_ID.GBR, SR.approaches)).toBe(
      convoyLossRatePm(raid, escort, 3),
    );
  });

  test("escorts damage spotted submarines", async () => {
    const { g, day } = await raiders();
    const { navy, ww } = g;
    const gbrSide = ww.land.sideOf(TAG_ID.GBR);
    fleetAtSea(
      navy,
      TAG_ID.GBR,
      REGION.london,
      [["dd", 1, 40]],
      ZONE.west,
      "escort",
      SR.approaches,
    );
    const dd = navy.statsFor(TAG_ID.GBR, "dd", 1);
    const escort = escortPowerCenti(
      40 * (dd.depth * 2 + dd.light),
      0,
      0,
      0,
      g.ce("GBR").stats,
    );
    britishRoute(navy, 30, day);
    const [subs] = navy.fleetsOf(TAG_ID.ITA);
    const ids = [...subs.ships];
    const maxHp = shipStats(
      "ss",
      2,
      g.ce("ITA").stats,
      g.ce("ITA").researched,
    ).hpMilli;
    // HP lost by the submarines, a sunk one all of it.
    const hurt = () =>
      ids.reduce((n, id) => {
        const r = navy.ships.rowOf(id);
        return n + (r < 0 ? maxHp : maxHp - navy.ships.hp[r]);
      }, 0);
    // Not spotted: no harm.
    convoyWar(navy, SR.approaches, day);
    expect(hurt()).toBe(0);
    // Spotted (1000‰): escort × 20‰, the most damaged first, the rest to
    // the next; at 0 HP it sinks.
    navy.setSpotPm(SR.approaches, gbrSide, subs.id, 1000);
    convoyWar(navy, SR.approaches, day + 1);
    const dmg = aswDamageMilli(escort, 1000);
    expect(dmg).toBeGreaterThan(0);
    expect(hurt()).toBe(dmg);
    const sunk = Math.floor(dmg / maxHp);
    expect(ids.filter((id) => navy.ships.rowOf(id) < 0)).toEqual(
      ids.slice(0, sunk),
    );
    const next = navy.ships.rowOf(ids[sunk]);
    expect(maxHp - navy.ships.hp[next]).toBe(dmg - sunk * maxHp);
  });

  test("on the clock: a real supply route, raiders and escorts sent by order, real spotting", async () => {
    // Lanes C, N1 and N2 together, nothing hand-set but the board: a
    // British division on Malta (supplied over the Western Approaches and
    // the Central Waters), Italian submarines ordered to raid the Central
    // Waters, later British destroyers ordered to escort there. Italy's
    // start ships are taken off (a surface battle is N2's test) and Italy
    // gets fuel (none of its own on the sea map: E's fuel would keep the
    // submarines in port).
    const g = await seaGame();
    const { ww, navy, runner } = g;
    const game = runner.game;
    war(g, "ITA", "GBR");
    for (const f of navy.fleetsOf(TAG_ID.ITA)) {
      for (const id of [...f.ships]) navy.removeShip(id, false, game.ticks());
    }
    g.ce("ITA").fuelMilli = 1_000_000_000;
    placeArmy(game, "GBR", REGION.malta, 1);
    const order = (who: number, fleet: number, mission: "raid" | "escort") =>
      navy.issue(
        who,
        { kind: "fleet_mission", fleet, mission, sr: SR.central },
        game.ticks(),
      );
    const subs = navy.createFleet(TAG_ID.ITA, REGION.rome, [["ss", 2, 30]]);
    expect(order(TAG_ID.ITA, subs, "raid")).toBeNull();
    const idx = ww.scenario.srIdxOf(SR.central);
    const day0 = ww.day(game.ticks());
    const days = (from: number, to: number, each: () => void) => {
      for (let d = from; d <= to; d++) {
        stepTo(runner, dayTick(d, 6));
        each();
      }
    };
    // Raiders alone: Malta's supply convoys go down in the Central Waters.
    let lost = 0;
    days(day0 + 1, day0 + 10, () => {
      lost += navy.srState[idx].lossYesterday.get(TAG_ID.GBR) ?? 0;
    });
    const r = routeFor(navy, "supply", TAG_ID.GBR, REGION.malta)!;
    expect(r.srs).toContain(SR.central);
    expect(lost).toBeGreaterThan(0);
    expect(navy.srState[idx].raidedYesterday).toContain(subs);
    // Escorts sent there: they spot the raiders and hurt them (ASW or a
    // battle with them).
    const escorts = navy.createFleet(TAG_ID.GBR, REGION.london, [
      ["dd", 1, 40],
    ]);
    expect(order(TAG_ID.GBR, escorts, "escort")).toBeNull();
    const ids = [...navy.fleets.get(subs)!.ships];
    const hpOf = () =>
      ids.reduce((n, id) => {
        const row = navy.ships.rowOf(id);
        return n + (row < 0 ? 0 : navy.ships.hp[row]);
      }, 0);
    const hp0 = hpOf();
    const gbrSide = ww.land.sideOf(TAG_ID.GBR);
    let spotted = false;
    days(day0 + 11, day0 + 25, () => {
      spotted ||= navy.spotted(gbrSide, subs);
    });
    expect(spotted).toBe(true);
    expect(hpOf()).toBeLessThan(hp0);
  }, 120_000);

  test("the loss ring and messages", async () => {
    const { g, day } = await raiders();
    const { navy, runner, updates } = g;
    const d = day + 1;
    // The Western Approaches' day is k = 2 (its srIdx % 7), Britain's k = 3.
    expect(g.ww.scenario.srIdxOf(SR.approaches) % 7).toBe(2);
    stepTo(runner, dayTick(d, 2));
    britishRoute(navy, 35, d);
    const stock = g.ce("GBR").stock[CONVOY];
    step(runner, 2);
    // 35 × 30‰ = 1,050 milli: one convoy lost, in the 30-day ring.
    expect(g.ce("GBR").stock[CONVOY]).toBe(stock - 1);
    expect(navy.country(TAG_ID.GBR)!.convoyLoss[d % 30]).toBe(1050);
    step(runner);
    expect(
      messages(updates, "events_display.ww1936_convoys_lost"),
    ).toContainEqual({
      to: TAG_ID.GBR,
      params: { n: 1, srs: `${SR.approaches}` },
    });
    expect(
      messages(updates, "events_display.ww1936_convoys_sunk"),
    ).toContainEqual({
      to: TAG_ID.ITA,
      params: { n: 1, srs: `${SR.approaches}` },
    });
    // The seeded route had no deal behind it: Britain's day dropped it.
    expect(navy.routes.size).toBe(0);
  });
});
