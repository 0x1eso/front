// World War 1936 P6 lane S (plan Task 6 Step 6, spec §9.5–§9.6): the
// atomic bomb on ww1936deep. Britain and Germany are humans at war;
// British strategic bombers fly over the land zone West (Berlin's) from
// London. The zone's drop step is called directly with the day it runs.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  BUILDING_IDS,
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { P_NUKE_INTERCEPT } from "@openfront/engine-lib/ww1936/DepthRules";
import { effectiveSurrenderPct } from "@openfront/engine-lib/ww1936/PoliticsRules";
import {
  nukeDropBlock,
  nukeInterceptPm,
  nukeOutcome,
} from "@openfront/engine-lib/ww1936/ProjectRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { Game } from "@openfront/engine/game/Game";
import {
  applyNuke,
  nukeCutPp,
  processNukeQueue,
} from "@openfront/engine/ww1936/depth/Atomic";
import {
  damageOf,
  drawPlanes,
} from "@openfront/engine/ww1936/economy/Buildings";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { vi } from "vitest";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  byTag,
  clearLand,
  HUMAN,
  placeArmy,
  warAfterPrep,
  wwRunner,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const BERLIN = DEEP.region.berlin;
const MUNICH = DEEP.region.munich;
const LONDON = DEEP.region.london;
const WEST = DEEP.sr.westLand;
const STRAT = AIR_TYPES.indexOf("strat_bomber");
const M_STRAT = AIR_MISSIONS.indexOf("strategic_bombing");
const ATOMIC_KEY = equipKey("atomic_bomb", 1);

function stockUp(g: Game, tag: "DEU" | "GBR"): void {
  const ww = g.worldWar()!;
  const ce = ww.economy.country(byTag(g, tag).smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Britain at war with Germany, `bombs` in stock, `bombers` strategic bombers over the zone West. */
async function atomicWar(
  bombs: number,
  bombers: number,
  config: { ww1936Nukes?: boolean } = {},
) {
  const runner = await wwRunner(
    config,
    [
      { clientID: HUMAN, country: "GBR" },
      { clientID: "HUMAN002", country: "DEU" },
    ],
    DEEP.map,
  );
  warAfterPrep(runner, HUMAN, "DEU");
  const g = runner.game;
  const ww = g.worldWar()!;
  const gbr = DEEP.tag.GBR;
  const deu = DEEP.tag.DEU;
  expect(ww.land.isEnemy(gbr, deu)).toBe(true);
  const ce = ww.economy.country(gbr)!;
  ce.stock[ATOMIC_KEY] = bombs;
  ce.stock[equipKey("strat_bomber", 1)] = bombers;
  ww.air.addDeployment({
    owner: gbr,
    sr: WEST,
    type: STRAT,
    mission: M_STRAT,
    counts: drawPlanes(ce, "strat_bomber", bombers),
    target: bombers,
    base: LONDON,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
  // No enemy fighters over the zone unless a test says so.
  ww.air.zoneState[ww.scenario.srIdxOf(WEST)].enemySup = new Map();
  return { runner, g, ww, d: ww.depth, gbr, deu, ce };
}

function strategicBombers(g: Game, owner: number): number {
  const air = g.worldWar()!.air;
  let n = 0;
  for (const dep of air.deploymentsOf(owner)) {
    if (dep.type === STRAT) for (const c of dep.counts) n += c;
  }
  return n;
}

describe("World War 1936 P6: the atomic bomb (spec §9.5)", () => {
  it("the drop judge: no-strike first, the lobby key, a bomb, the war, the carrier", () => {
    const ok = {
      stock: 1,
      atWar: true,
      bombersInZone: 10,
      nukesOn: true,
      rocket: false,
      ballisticDone: false,
      rocketKm: -1,
      ballisticStock: 0,
      noStrike: false,
    };
    expect(nukeDropBlock(ok)).toBe(null);
    expect(nukeDropBlock({ ...ok, noStrike: true, nukesOn: false })).toBe(
      "no_strike_region",
    );
    expect(nukeDropBlock({ ...ok, nukesOn: false })).toBe("nuke_conditions");
    expect(nukeDropBlock({ ...ok, stock: 0 })).toBe("no_atomic");
    expect(nukeDropBlock({ ...ok, atWar: false })).toBe("nuke_conditions");
    expect(nukeDropBlock({ ...ok, bombersInZone: 9 })).toBe("nuke_conditions");
    const rocket = {
      ...ok,
      bombersInZone: 0,
      rocket: true,
      ballisticDone: true,
      ballisticStock: 1,
      rocketKm: 320,
    };
    expect(nukeDropBlock(rocket)).toBe(null);
    expect(nukeDropBlock({ ...rocket, rocketKm: 321 })).toBe(
      "out_of_rocket_range",
    );
    expect(nukeDropBlock({ ...rocket, rocketKm: -1 })).toBe("nuke_conditions");
    expect(nukeDropBlock({ ...rocket, ballisticStock: 0 })).toBe(
      "nuke_conditions",
    );
  });

  it("nuke drop damages buildings and divisions and lowers surrender threshold", async () => {
    const { runner, g, ww, d, gbr, deu, ce } = await atomicWar(2, 10);
    clearLand(g);
    stockUp(g, "DEU");
    const inBerlin = placeArmy(g, "DEU", BERLIN, 2).divisions;
    const nextDoor = placeArmy(g, "DEU", MUNICH, 1).divisions;
    const t = ww.land.divisions;
    const men = (id: number) => t.men[t.rowOf(id)];
    const menBefore = [...inBerlin, ...nextDoor].map(men);
    const econ = ww.economy;
    const counts = BUILDING_IDS.map((b) => econ.buildingArray(b)[BERLIN]);
    const out = nukeOutcome(counts[0], counts[1], counts[2], 0);
    const pc = ww.politics.country(deu)!;
    const wsBefore = pc.wsBaseBp;
    const surrenderBefore = ww.politics.surrenderPct(deu);
    const tensionBefore = ww.politics.wtBp;
    const news = vi.spyOn(d, "news");
    const fx = vi.spyOn(d, "addFx");
    // The order: the bomb leaves the stock, the drop waits for the zone's day.
    expect(
      d.issue(gbr, { kind: "nuke_drop", region: BERLIN, rocket: false }, 1),
    ).toBe(null);
    expect(ce.stock[ATOMIC_KEY]).toBe(1);
    expect(d.nukeQueue).toEqual([
      {
        owner: gbr,
        region: BERLIN,
        zone: WEST,
        rocket: false,
        day: ww.day(g.ticks()),
      },
    ]);
    const day = ww.day(g.ticks());
    processNukeQueue(d, WEST, day, g.ticks());
    expect(d.nukeQueue).toEqual([]);
    // Buildings: a quarter of the factories gone, every other one 80% stopped.
    expect(out.destroy.civ).toBeGreaterThan(0);
    BUILDING_IDS.forEach((b, i) => {
      if (b === "dam") return;
      const left =
        counts[i] -
        (b === "civ"
          ? out.destroy.civ
          : b === "mil"
            ? out.destroy.mil
            : b === "dock"
              ? out.destroy.dock
              : 0);
      expect(econ.buildingArray(b)[BERLIN], b).toBe(left);
      expect(damageOf(econ, BERLIN, b), b).toBe(left * 800);
    });
    // Divisions: 60% in Berlin with no organisation left, 15% next door.
    inBerlin.forEach((id, i) => {
      expect(
        Math.abs(men(id) - Math.round(menBefore[i] * 0.4)),
      ).toBeLessThanOrEqual(1);
      expect(t.org[t.rowOf(id)]).toBe(0);
    });
    nextDoor.forEach((id, i) => {
      const before = menBefore[inBerlin.length + i];
      expect(Math.abs(men(id) - Math.round(before * 0.85))).toBeLessThanOrEqual(
        1,
      );
      expect(t.org[t.rowOf(id)]).toBeGreaterThan(0);
    });
    // War support, the surrender line, tension, the nuked year.
    expect(pc.wsBaseBp).toBe(Math.max(0, wsBefore - 1_500));
    expect(nukeCutPp(d, deu)).toBe(10);
    expect(ww.politics.surrenderPct(deu)).toBe(surrenderBefore - 10);
    expect(ww.politics.wtBp).toBe(tensionBefore + 1_000);
    expect(d.nuked.get(BERLIN)).toBe(day + 365);
    // Facts only: the dropper and the region.
    expect(news).toHaveBeenCalledWith("news_nuke_dropped", {
      countryTag: "GBR",
      region: BERLIN,
    });
    expect(fx).toHaveBeenCalledWith({
      kind: "nuke",
      region: BERLIN,
      from: LONDON,
      owner: gbr,
      tick: g.ticks(),
    });
    void runner;
  }, 60_000);

  it("nuke drop changes no tile ownership or terrain", async () => {
    const { g, d, gbr } = await atomicWar(1, 10);
    const map = g.map();
    const before: number[] = [];
    map.forEachTile((t) =>
      before.push(
        map.ownerID(t),
        map.terrainByte(t),
        map.hasFallout(t) ? 1 : 0,
        map.isLand(t) ? 1 : 0,
      ),
    );
    applyNuke(d, gbr, BERLIN, g.ticks());
    expect(d.nuked.has(BERLIN)).toBe(true);
    const after: number[] = [];
    map.forEachTile((t) =>
      after.push(
        map.ownerID(t),
        map.terrainByte(t),
        map.hasFallout(t) ? 1 : 0,
        map.isLand(t) ? 1 : 0,
      ),
    );
    expect(after).toEqual(before);
    expect(g.worldWar()!.land.controller[BERLIN]).toBe(DEEP.tag.DEU);
  }, 60_000);

  it("nuke interception by enemy air superiority uses wwRoll", async () => {
    const { g, ww, d, gbr, ce } = await atomicWar(2, 20);
    // Germany's fighters hold the zone: 35% at the most.
    const side = ww.land.sideOf(gbr);
    ww.air.zoneState[ww.scenario.srIdxOf(WEST)].enemySup = new Map([
      [side, 1000],
    ]);
    const pm = nukeInterceptPm(1000);
    expect(pm).toBe(350);
    const seed = ww.politics.seed;
    const today = ww.day(g.ticks());
    const roll = (day: number) =>
      wwRoll(seed, P_NUKE_INTERCEPT, gbr, day, BERLIN) % 1_000_000;
    let hitDay = today;
    while (roll(hitDay) < pm * 1000) hitDay++;
    let lostDay = today;
    while (roll(lostDay) >= pm * 1000) lostDay++;
    const msg = vi.spyOn(d, "message");
    const fx = vi.spyOn(d, "addFx");
    // Intercepted: the bomb and 10 bombers lost, both told, Berlin untouched.
    d.issue(gbr, { kind: "nuke_drop", region: BERLIN, rocket: false }, 1);
    processNukeQueue(d, WEST, lostDay, g.ticks());
    expect(ce.stock[ATOMIC_KEY]).toBe(1);
    expect(strategicBombers(g, gbr)).toBe(10);
    expect(d.nuked.has(BERLIN)).toBe(false);
    expect(damageOf(ww.economy, BERLIN, "civ")).toBe(0);
    expect(msg.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      [gbr, "ww1936_nuke_intercepted"],
      [DEEP.tag.DEU, "ww1936_nuke_intercepted"],
    ]);
    expect(fx.mock.calls[0][0]).toMatchObject({ kind: "nuke_intercepted" });
    // The same zone on a day the roll lets it through: Berlin is hit.
    d.issue(gbr, { kind: "nuke_drop", region: BERLIN, rocket: false }, 1);
    processNukeQueue(d, WEST, hitDay, g.ticks());
    expect(ce.stock[ATOMIC_KEY]).toBe(0);
    expect(d.nuked.has(BERLIN)).toBe(true);
    expect(damageOf(ww.economy, BERLIN, "civ")).toBeGreaterThan(0);
    // A drop whose war ended is lost without a word.
    ce.stock[ATOMIC_KEY] = 1;
    d.issue(gbr, { kind: "nuke_drop", region: MUNICH, rocket: false }, 1);
    ww.endWar(gbr, DEEP.tag.DEU);
    msg.mockClear();
    processNukeQueue(d, WEST, hitDay, g.ticks());
    expect(d.nuked.has(MUNICH)).toBe(false);
    expect(ce.stock[ATOMIC_KEY]).toBe(0);
    expect(msg).not.toHaveBeenCalled();
  }, 60_000);

  it("the third nuke still lowers the threshold but the fourth does not", async () => {
    const { g, ww, d, gbr, deu } = await atomicWar(0, 10);
    const pc = ww.politics.country(deu)!;
    const line = (k: number) =>
      effectiveSurrenderPct(
        COUNTRIES.DEU.surrenderPct,
        pc.stabBp,
        pc.wsBp,
        pc.stats.surrenderPp - Math.min(30, 10 * k),
      );
    const seen = [ww.politics.surrenderPct(deu)];
    const cuts: number[] = [];
    expect(seen[0]).toBe(line(0));
    for (const r of [BERLIN, MUNICH, BERLIN, MUNICH]) {
      applyNuke(d, gbr, r, g.ticks());
      seen.push(ww.politics.surrenderPct(deu));
      cuts.push(nukeCutPp(d, deu));
    }
    expect(d.country(deu)!.proj.nukedCount).toBe(4);
    expect(cuts).toEqual([10, 20, 30, 30]);
    expect(seen).toEqual([0, 1, 2, 3, 4].map(line));
    expect(seen[3]).toBeLessThan(seen[2]);
    expect(seen[4]).toBe(seen[3]);
  }, 60_000);

  it("nuke_drop is refused with the lobby's atomic bomb off", async () => {
    const { g, d, gbr, ce } = await atomicWar(1, 10, { ww1936Nukes: false });
    expect(d.nukesOn()).toBe(false);
    expect(
      d.issue(gbr, { kind: "nuke_drop", region: BERLIN, rocket: false }, 1),
    ).toBe("nuke_conditions");
    expect(ce.stock[ATOMIC_KEY]).toBe(1);
    expect(d.nukeQueue).toEqual([]);
    expect(d.nuked.size).toBe(0);
    void g;
  }, 60_000);
});

