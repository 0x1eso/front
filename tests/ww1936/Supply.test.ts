// World War 1936 P2 Task 5: supply hubs, the side's supply, division rates
// and encirclement (P2 spec §11) on the test map v3, and the daily cost on
// the real world1936 map (pre-flight S1). Germany is human (no AI land
// war); the numbers come from the SupplyRules formulas and the map table.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_DAY_SPLIT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { MOVE_RAIL } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  HUB_BUILT,
  HUB_CAPITAL,
  HUB_CITY,
  HUB_SEA,
  hubCapacityMilli,
  localSupplyMilli,
  regionSupplyMilli,
  supplyEdgeCost,
  supplyFrom,
  supplyRatePm,
  supplyUseMilli,
} from "@openfront/engine-lib/ww1936/SupplyRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import { dailySupply, liveHubs } from "@openfront/engine/ww1936/land/Supply";
import type { WwLand } from "@openfront/engine/ww1936/land/WwLand";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "path";
import { fileURLToPath } from "url";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import {
  byTag,
  clearLand,
  HUMAN,
  land,
  placeArmy,
  stepTo,
  takeRegion,
  wwGameStart,
  wwRunner,
  wwRunnerCapture,
} from "./util";

const BERLIN = 3;
const MUNICH = 4;
const ROME = 5;
const WARSAW = 6;
const KRAKOW = 7;
const KIEV = 9;
const PARIS = 1;

/** A game with a human Germany, just past the preparation minute. */
async function germany(): Promise<{ runner: GameRunner; g: Game; l: WwLand }> {
  const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
  stepTo(runner, WW_PREP_TICKS + 1);
  return { runner, g: runner.game, l: land(runner.game) };
}

const id = (g: Game, tag: Parameters<typeof byTag>[1]) =>
  byTag(g, tag).smallID();

/** The weather's supply % applied to a region's hub share and local share. */
function regionSupply(l: WwLand, r: number, hub: number, core: boolean) {
  const sc = l.scenario;
  const w = weatherAt(l.day(), sc.latC(r), sc.landOf(r), sc.wcell(r));
  return regionSupplyMilli(hub, localSupplyMilli(core, l.econ.infra[r]), w);
}

/** Supply cost ×100 of the edge a → b for the side, from the map table. */
function cost(l: WwLand, a: number, b: number): number {
  const sc = l.scenario;
  return supplyEdgeCost(
    sc.edge(sc.edgeBetween(a, b)).km,
    l.econ.rail[a],
    l.econ.rail[b],
    sc.landOf(b),
    l.econ.infra[b],
  );
}

/** A division's daily use as the supply step counts it. */
function useOf(l: WwLand, row: number): number {
  const s = l.baseStatsOf(row);
  const army = l.armies.get(l.divisions.army[row])!;
  const gen =
    army.general === 0
      ? null
      : l.country(army.owner)!.generals.find((x) => x.id === army.general)!;
  return supplyUseMilli(s.supplyMilli, gen?.log ?? 0, false, false, 0);
}

describe("supply (P2 spec §11)", () => {
  test("Berlin's capital hub gives 65", async () => {
    const { g, l } = await germany();
    const side = l.sideOf(id(g, "DEU"));
    dailySupply(l, side);
    // Berlin: rail 3, so 50 + 5 × 3 = 65; its own share is core 2 × infra 5.
    expect(l.econ.rail[BERLIN]).toBe(3);
    expect(hubCapacityMilli(HUB_CAPITAL, 3)).toBe(65_000);
    expect(localSupplyMilli(true, l.econ.infra[BERLIN])).toBe(10_000);
    expect(l.supplyMilli[BERLIN]).toBe(regionSupply(l, BERLIN, 65_000, true));
    expect(l.supplyMilli[BERLIN]).toBeGreaterThan(0);
    expect(l.encircled[BERLIN]).toBe(0);
    // The side's hubs: the capitals of Germany and Italy (Axis); no port.
    expect(liveHubs(l, side)).toEqual([
      { region: BERLIN, kind: HUB_CAPITAL, cap: 65_000 },
      {
        region: ROME,
        kind: HUB_CAPITAL,
        cap: hubCapacityMilli(HUB_CAPITAL, 1),
      },
    ]);
    // Munich: Berlin's share over the rail (140 km / (2 + 2)).
    expect(cost(l, BERLIN, MUNICH)).toBe(3_500);
    expect(l.supplyMilli[MUNICH]).toBe(
      regionSupply(l, MUNICH, supplyFrom(65_000, 3_500), true),
    );
  });

  test("a city hub needs rail to the capital", async () => {
    const { g, l } = await germany();
    const side = l.sideOf(id(g, "DEU"));
    // A built hub in Munich, on the Berlin–Munich railway: alive.
    l.econ.hub[MUNICH] = 1;
    expect(liveHubs(l, side)).toContainEqual({
      region: MUNICH,
      kind: HUB_BUILT,
      cap: hubCapacityMilli(HUB_BUILT, 2),
    });
    // Without Munich's rail it is cut from the capital: no hub.
    l.econ.rail[MUNICH] = 0;
    expect(liveHubs(l, side).some((h) => h.region === MUNICH)).toBe(false);
    // A taken city of 10 victory points or more (Warsaw, 21) is a hub while
    // its railway reaches Berlin.
    takeRegion(g, WARSAW, "DEU");
    expect(liveHubs(l, side)).toContainEqual({
      region: WARSAW,
      kind: HUB_CITY,
      cap: hubCapacityMilli(HUB_CITY, 1),
    });
    l.econ.rail[WARSAW] = 0;
    expect(liveHubs(l, side).some((h) => h.region === WARSAW)).toBe(false);
  });

  test("supply falls with distance", async () => {
    const { g, l } = await germany();
    takeRegion(g, WARSAW, "DEU");
    takeRegion(g, KRAKOW, "DEU");
    dailySupply(l, l.sideOf(id(g, "DEU")));
    // Warsaw: Berlin over the rail (163 km / (2 + 1)); not a German core.
    const toWarsaw = cost(l, BERLIN, WARSAW);
    expect(toWarsaw).toBe(5_433);
    expect(l.supplyMilli[WARSAW]).toBe(
      regionSupply(l, WARSAW, supplyFrom(65_000, toWarsaw), false),
    );
    // Krakow (rail 0, hills): no railway in, so every way is slow; its best
    // hub is Berlin's over Munich's railway (Task 11's doubled road reach;
    // before it, Rome's 165 km: the Axis shares hubs).
    const viaMunich = supplyFrom(
      65_000,
      cost(l, BERLIN, MUNICH) + cost(l, MUNICH, KRAKOW),
    );
    const fromRome = supplyFrom(
      hubCapacityMilli(HUB_CAPITAL, 1),
      cost(l, ROME, KRAKOW),
    );
    const viaWarsaw = supplyFrom(65_000, toWarsaw + cost(l, WARSAW, KRAKOW));
    const warsawHub = supplyFrom(
      hubCapacityMilli(HUB_CITY, 1),
      cost(l, WARSAW, KRAKOW),
    );
    const best = Math.max(viaMunich, fromRome, viaWarsaw, warsawHub);
    expect(best).toBe(viaMunich);
    expect(l.supplyMilli[KRAKOW]).toBe(regionSupply(l, KRAKOW, best, false));
    expect(l.supplyMilli[KRAKOW]).toBeLessThan(l.supplyMilli[WARSAW]);
  });

  test("cut off means encircled", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    const l = land(g);
    // Kiev to Germany: its neighbours are Polish Krakow and Soviet Moscow,
    // so no Axis hub reaches it (and it is no port).
    takeRegion(g, KIEV, "DEU");
    const a = placeArmy(g, "DEU", KIEV, 2);
    const rows = () => a.divisions.map((d) => l.divisions.rowOf(d));
    const finishDay = (d: number) =>
      stepTo(runner, dayStartTick(d, WW_PREP_TICKS) + WW_DAY_SPLIT);
    finishDay(0);
    expect(l.encircled[KIEV]).toBe(1);
    expect(l.supplyMilli[KIEV]).toBe(0);
    for (const r of rows()) {
      expect(l.divisions.supply[r]).toBe(0);
      expect(l.divisions.encircled[r]).toBe(1);
    }
    expect(l.encircled[BERLIN]).toBe(0);
    // The army hears it once, not every day it stays cut off.
    finishDay(3);
    const notes = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message === "events_display.ww1936_encircled");
    expect(notes).toHaveLength(1);
    expect(notes[0].params).toEqual({ army: a.nameNo });
    expect(notes[0].playerID).toBe(id(g, "DEU"));
    // Kiev back in reach (Krakow German too): no longer encircled.
    takeRegion(g, KRAKOW, "DEU");
    dailySupply(l, l.sideOf(id(g, "DEU")));
    expect(l.encircled[KIEV]).toBe(0);
    for (const r of rows()) expect(l.divisions.encircled[r]).toBe(0);
  });

  test("allies share hubs", async () => {
    const runner = await wwRunner({}, [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "FRA" },
    ]);
    stepTo(runner, WW_PREP_TICKS + 1);
    const g = runner.game;
    const l = land(g);
    clearLand(g);
    // A British division in Paris eats from the French hubs like the French.
    const uk = placeArmy(g, "GBR", PARIS, 1);
    const fr = placeArmy(g, "FRA", PARIS, 2);
    const side = l.sideOf(id(g, "GBR"));
    expect(l.sideOf(id(g, "FRA"))).toBe(side);
    dailySupply(l, side);
    const rows = [...uk.divisions, ...fr.divisions].map((d) =>
      l.divisions.rowOf(d),
    );
    const use = rows.reduce((n, r) => n + useOf(l, r), 0);
    expect(l.useMilli[PARIS]).toBe(use);
    const paris = regionSupply(
      l,
      PARIS,
      hubCapacityMilli(HUB_CAPITAL, l.econ.rail[PARIS]),
      true,
    );
    expect(l.supplyMilli[PARIS]).toBe(paris);
    const rate = supplyRatePm(paris, use);
    for (const r of rows) {
      expect(l.divisions.supply[r]).toBe(rate);
      expect(l.divisions.encircled[r]).toBe(0);
    }
    // P4 spec §10.3 (lane C): a port is a sea hub only off the side's rail
    // net and with convoys shipping to it — London is a capital, Lyon has
    // no supply route: no sea hub, not P2's fixed HUB_SEA.
    expect(liveHubs(l, side).filter((h) => h.kind === HUB_SEA)).toEqual([]);
  });

  test("division rate = region supply / use", async () => {
    const { g, l } = await germany();
    takeRegion(g, WARSAW, "DEU");
    takeRegion(g, KRAKOW, "DEU");
    clearLand(g);
    // Forty divisions in Krakow use more than it gets.
    const a = placeArmy(g, "DEU", KRAKOW, 30);
    const a2 = placeArmy(g, "DEU", KRAKOW, 10);
    const rows = [...a.divisions, ...a2.divisions].map((d) =>
      l.divisions.rowOf(d),
    );
    // One of them on a train: it eats there but adds no use (pre-flight S2).
    l.divisions.mode[rows[39]] = MOVE_RAIL;
    // One in Soviet Kiev, a region the side does not hold: nothing.
    const b = placeArmy(g, "DEU", BERLIN, 1);
    const lost = l.divisions.rowOf(b.divisions[0]);
    l.setDivisionRegion(lost, KIEV);
    dailySupply(l, l.sideOf(id(g, "DEU")));
    const use = rows.slice(0, 39).reduce((n, r) => n + useOf(l, r), 0);
    expect(l.useMilli[KRAKOW]).toBe(use);
    expect(use).toBeGreaterThan(l.supplyMilli[KRAKOW]);
    const rate = Math.floor((l.supplyMilli[KRAKOW] * 1000) / use);
    expect(rate).toBeLessThan(1000);
    for (const r of rows) expect(l.divisions.supply[r]).toBe(rate);
    expect(l.divisions.supply[lost]).toBe(0);
    expect(l.divisions.encircled[lost]).toBe(0);
    // Room to spare: full rate.
    expect(l.useMilli[BERLIN]).toBe(0);
    expect(supplyRatePm(l.supplyMilli[BERLIN], 0)).toBe(1000);
  });

  test("the hubs' runs kept between days give the same numbers", async () => {
    const { g, l } = await germany();
    const side = l.sideOf(id(g, "DEU"));
    takeRegion(g, WARSAW, "DEU");
    dailySupply(l, side);
    const first = Array.from(l.supplyMilli);
    // Nothing changed: the kept runs give the same supply.
    dailySupply(l, side);
    expect(Array.from(l.supplyMilli)).toEqual(first);
    // Warsaw's rail goes: the runs that read it run again, as a new game
    // with that rail would compute.
    l.econ.rail[WARSAW] = 0;
    dailySupply(l, side);
    const after = Array.from(l.supplyMilli);
    expect(after[WARSAW]).toBeLessThan(first[WARSAW]);
    const fresh = await germany();
    takeRegion(fresh.g, WARSAW, "DEU");
    fresh.l.econ.rail[WARSAW] = 0;
    dailySupply(fresh.l, side);
    for (const r of l.scenario.landRegions) {
      if (l.sideOf(l.controller[r.id]) !== side) continue;
      expect(fresh.l.supplyMilli[r.id], `region ${r.id}`).toBe(after[r.id]);
    }
  });
});

describe("supply's cost on world1936 (pre-flight S1)", () => {
  test("a day's supply of every side stays inside the tick budget", async () => {
    const files = await loadMapFiles(
      new NodeGameMapLoader(
        path.resolve(
          path.dirname(fileURLToPath(import.meta.url)),
          "../../resources/maps",
        ),
      ),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      files,
      () => {},
    );
    stepTo(runner, dayStartTick(1, WW_PREP_TICKS));
    const l = land(runner.game);
    const econ = l.econ;
    // The worst tick of a day: every side whose turn it is, with every
    // hub's run done again (all infrastructure changed), best of five.
    const byTick = new Array<number>(WW_DAY_SPLIT).fill(Infinity);
    const infra = Uint8Array.from(econ.infra);
    for (let pass = 0; pass < 5; pass++) {
      for (let i = 0; i < econ.infra.length; i++) {
        econ.infra[i] = (infra[i] + 1 + pass) % 6;
      }
      const ms = new Array<number>(WW_DAY_SPLIT).fill(0);
      for (const s of l.sideList()) {
        const t0 = performance.now();
        dailySupply(l, s.key);
        ms[s.rep % WW_DAY_SPLIT] += performance.now() - t0;
      }
      ms.forEach((m, k) => (byTick[k] = Math.min(byTick[k], m)));
    }
    econ.infra.set(infra);
    const worst = Math.max(...byTick);
    console.log(
      `world1936 supply: ${l.sideList().length} sides, worst tick ${worst.toFixed(2)} ms`,
    );
    // Pre-flight S1: ≤ 6 ms p99 a tick for the whole land war.
    expect(worst).toBeLessThan(6);
  }, 60_000);
});
