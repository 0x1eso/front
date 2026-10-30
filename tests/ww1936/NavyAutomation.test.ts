// World War 1936: the fifth automation switch, navy (owner request
// 2026-10-30), on ww1936deep — a human Britain (and a human Italy, so no
// other AI moves those two navies). While it is on, P4's navy AI plans
// every British fleet on the AI's own days (sea regions, missions, rules,
// the return threshold that brings a damaged fleet home) and the depth AI
// lays and sweeps its mines; never an invasion, nor the fleets supporting
// one under way; never a war. A manual fleet order hands it back with a
// notice.
import { Difficulty } from "@openfront/engine-api/game/GameTypes";
import type { GameUpdateViewData } from "@openfront/engine-api/game/GameUpdates";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import type { DesignDef } from "@openfront/engine-api/ww1936/DepthTypes";
import {
  equipKey,
  WW_DAY_SPLIT,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { GROUND_EQUIPMENT } from "@openfront/engine-api/ww1936/LandTypes";
import {
  FLEET_MISSIONS,
  INVASION_STATES,
  SHIP_CLASSES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  WW_PREP_TICKS,
  wwAutoBit,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { AUTO_ORDER_DOMAIN } from "@openfront/engine/ww1936/Automation";
import {
  aiSeaMines,
  homeSeaRegions,
} from "@openfront/engine/ww1936/depth/AiSeaAir";
import type { WwDepth } from "@openfront/engine/ww1936/depth/WwDepth";
import {
  AI_MAIN_RETURN_PCT,
  aiNavy,
  aiNavyDue,
  invasionBoundFleets,
  invasionRouteSrs,
} from "@openfront/engine/ww1936/navy/AiNavy";
import type { Fleet, WwNavy } from "@openfront/engine/ww1936/navy/WwNavy";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import {
  byTag,
  gameHash,
  HUMAN,
  land,
  order,
  placeArmy,
  step,
  stepTo,
  wwRestore,
  wwRunnerCapture,
} from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const mission = (f: Fleet) => FLEET_MISSIONS[f.mission];
const LAY = FLEET_MISSIONS.indexOf("lay_mines");

/** Steps until every country has had day `d`'s step. */
function finishDay(runner: GameRunner, d: number): void {
  const ww = runner.game.worldWar()!;
  stepTo(runner, dayStartTick(d, ww.prepEndTick()) + WW_DAY_SPLIT);
}
const today = (g: Game) => g.worldWar()!.day(g.ticks());

function setNavy(runner: GameRunner, on: boolean): void {
  step(runner, 1, [order(HUMAN, { kind: "auto_set", domain: "navy", on })]);
}

const notices = (updates: GameUpdateViewData[], key: string) =>
  updates
    .flatMap((u) => u.updates[GameUpdateType.DisplayEvent] ?? [])
    .filter((m) => m.message === `events_display.${key}`);

/**
 * Britain past the preparation minute (at war with Italy unless `war` is
 * false), with a battle fleet and a patrol docked in London (the map
 * starts with no navy).
 */
async function britain(war = true, difficulty = Difficulty.Medium) {
  const { runner, updates } = await wwRunnerCapture(
    { historicalAi: false, difficulty },
    HUMANS,
    DEEP.map,
  );
  const g = runner.game;
  stepTo(runner, WW_PREP_TICKS + 1);
  const ww = g.worldWar()!;
  if (war) ww.setWar(GBR, ITA, g.ticks());
  const navy = ww.navy;
  const main = navy.fleets.get(
    navy.createFleet(GBR, DEEP.region.london, [
      ["bb", 2, 1],
      ["dd", 1, 3],
    ]),
  )!;
  const patrol = navy.fleets.get(
    navy.createFleet(GBR, DEEP.region.london, [
      ["cl", 2, 2],
      ["dd", 1, 2],
    ]),
  )!;
  return { runner, updates, g, ww, navy, main, patrol };
}

/** What the AI could change of a fleet. */
const orders = (f: Fleet) => ({
  mission: f.mission,
  missionSr: f.missionSr,
  engage: f.engage,
  returnAtPct: f.returnAtPct,
  dest: f.dest,
  home: f.home,
  ships: [...f.ships],
});

function stockUp(g: Game, tag: CountryTag): void {
  const ce = land(g).econ.country(byTag(g, tag).smallID())!;
  for (const t of GROUND_EQUIPMENT) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** Ship design slot 1 of `id`: a destroyer with `module` in its special slot. */
function ddDesign(d: WwDepth, id: number, module: string): void {
  const def: DesignDef = {
    kind: "ship",
    base: "dd_1",
    modules: ["", "", "", module],
    name: "Test DD",
  };
  d.country(id)!.des.ship[0] = {
    def: def as never,
    origin: "own",
    from: 0,
    fromSlot: 0,
    obsolete: false,
    savedDay: 0,
  };
  d.markDesign(id, "ship", 1);
}

/** `n` of the fleet's destroyers built to design slot 1 (mine layers). */
function designDds(navy: WwNavy, f: Fleet, n: number): void {
  const t = navy.ships;
  let k = 0;
  for (const sid of f.ships) {
    const r = t.rowOf(sid);
    if (SHIP_CLASSES[t.cls[r]] === "dd" && k < n) {
      t.design[r] = 1;
      k++;
    }
  }
}

/** A British easy invasion of Rome from London, and `f` supporting it on its route. */
function invasionWithSupport(
  g: Game,
  navy: WwNavy,
  f: Fleet,
): { army: number; sr: number } {
  stockUp(g, "GBR");
  const a = placeArmy(g, "GBR", DEEP.region.london, 1);
  expect(
    navy.issue(
      GBR,
      { kind: "army_invade", army: a.id, target: DEEP.region.rome },
      g.ticks(),
    ),
  ).toBeNull();
  const route = [...invasionRouteSrs(navy, GBR)].sort((x, y) => x - y);
  expect(route.length).toBeGreaterThan(0);
  const sr = route[route.length - 1];
  expect(
    navy.issue(
      GBR,
      { kind: "fleet_mission", fleet: f.id, mission: "invasion_support", sr },
      g.ticks(),
    ),
  ).toBeNull();
  return { army: a.id, sr };
}

describe("World War 1936 automation: the navy switch", () => {
  it("a fleet order is the navy's; naval lines stay production's, the invasion and admirals the human's", () => {
    for (const k of [
      "fleet_mission",
      "fleet_move",
      "fleet_return",
      "fleet_base",
      "fleet_engage",
      "fleet_return_at",
      "fleet_split",
      "fleet_merge",
      "fleet_port_strike",
    ] as const) {
      expect(AUTO_ORDER_DOMAIN[k], k).toBe("navy");
    }
    expect(AUTO_ORDER_DOMAIN.naval_line_add).toBe("production");
    for (const k of [
      "army_invade",
      "invasion_execute",
      "invasion_cancel",
      "army_sea",
      "fleet_admiral",
      "fleet_auto",
      "carrier_mix",
      "appoint_admiral",
    ] as const) {
      expect(AUTO_ORDER_DOMAIN[k], k).toBeUndefined();
    }
  });

  it("on: the navy AI plans the human's fleets on its own days; off: nothing moves them", async () => {
    const { runner, g, ww, main, patrol } = await britain();
    const d0 = today(g);
    // Off (the default): the fleets wait in London as created.
    finishDay(runner, d0 + 4);
    expect([mission(main), mission(patrol)]).toEqual(["hold", "hold"]);
    expect(main.returnAtPct).toBe(50);
    setNavy(runner, true);
    expect(ww.autoOn(GBR, "navy")).toBe(true);
    // At war the AI plans every second day (the country's parity).
    finishDay(runner, d0 + 8);
    // The battle fleet takes its sea; home at 70% like the AI's own.
    expect(mission(main)).not.toBe("hold");
    expect(main.returnAtPct).toBe(AI_MAIN_RETURN_PCT);
    expect(main.missionSr).toBeGreaterThan(0);
    // Off: the human calls the fleets home, and they stay there.
    setNavy(runner, false);
    for (const f of [main, patrol]) {
      if (mission(f) !== "hold" || f.docked === 0) {
        step(runner, 1, [order(HUMAN, { kind: "fleet_return", fleet: f.id })]);
      }
    }
    const left = [orders(main), orders(patrol)];
    finishDay(runner, d0 + 30);
    expect([orders(main), orders(patrol)]).toEqual(left);
    expect([mission(main), mission(patrol)]).toEqual(["hold", "hold"]);
  }, 120_000);

  it("a manual fleet order switches it off, with a notice, and applies", async () => {
    const { runner, updates, ww, patrol } = await britain();
    setNavy(runner, true);
    step(runner, 1, [
      order(HUMAN, {
        kind: "fleet_mission",
        fleet: patrol.id,
        mission: "patrol",
        sr: DEEP.sr.central,
      }),
    ]);
    expect(ww.autoOn(GBR, "navy")).toBe(false);
    expect(notices(updates, "ww1936_auto_off_navy")).toHaveLength(1);
    expect([mission(patrol), patrol.missionSr]).toEqual([
      "patrol",
      DEEP.sr.central,
    ]);
    // Off already: another fleet order says nothing more.
    step(runner, 1, [
      order(HUMAN, { kind: "fleet_engage", fleet: patrol.id, rule: "avoid" }),
    ]);
    expect(notices(updates, "ww1936_auto_off_navy")).toHaveLength(1);
    // Not a deployment: the fleet's own auto switch leaves the navy's on.
    setNavy(runner, true);
    step(runner, 1, [
      order(HUMAN, { kind: "fleet_auto", fleet: patrol.id, on: true }),
    ]);
    expect(ww.autoMask(GBR)).toBe(wwAutoBit("navy"));
  }, 120_000);

  it("the fleets supporting an invasion under way are the invasion's: the AI leaves them and the invasion be", async () => {
    const { runner, g, ww, navy, main, patrol } = await britain();
    const { army } = invasionWithSupport(g, navy, main);
    expect([...invasionBoundFleets(navy, GBR)]).toEqual([main.id]);
    const inv = navy.invasions.get(army)!;
    const invBefore = { ...inv };
    const mainBefore = orders(main);
    setNavy(runner, true);
    // Three days (at least one of the AI's): the invasion still prepares.
    const d0 = today(g);
    finishDay(runner, d0 + 3);
    expect(INVASION_STATES[inv.state]).toBe("preparing");
    expect(navy.invasions.get(army)).toBe(inv);
    expect([inv.army, inv.owner, inv.target, inv.from, inv.easy]).toEqual([
      invBefore.army,
      invBefore.owner,
      invBefore.target,
      invBefore.from,
      invBefore.easy,
    ]);
    // The supporting fleet is as the human left it...
    expect(orders(main)).toEqual(mainBefore);
    // ...while the AI did plan the others.
    expect(mission(patrol)).not.toBe("hold");
    expect(ww.autoOn(GBR, "navy")).toBe(true);
    // Nor do the mine fleets take its ships (the depth AI's half).
    const d = ww.depth;
    ddDesign(d, GBR, "mine_layer");
    designDds(navy, main, 2);
    const ships = [...main.ships];
    aiSeaMines(d, GBR, today(g));
    expect(main.ships).toEqual(ships);
    expect(navy.fleetsOf(GBR).some((f) => f.mission === LAY)).toBe(false);
    // Once the invasion is gone, the fleet is the AI's again.
    navy.invasions.delete(army);
    expect(invasionBoundFleets(navy, GBR).size).toBe(0);
  }, 120_000);

  it("the mines: the depth AI lays the human's in its home waters while on, not when off", async () => {
    const { runner, g, ww, navy, main } = await britain();
    const d = ww.depth;
    ddDesign(d, GBR, "mine_layer");
    designDds(navy, main, 2);
    const laying = () => navy.fleetsOf(GBR).filter((f) => f.mission === LAY);
    const d0 = today(g);
    finishDay(runner, d0 + 2);
    expect(laying()).toEqual([]);
    setNavy(runner, true);
    finishDay(runner, d0 + 4);
    const home = homeSeaRegions(d, GBR);
    expect(laying().length).toBeGreaterThan(0);
    for (const f of laying()) {
      expect(home).toContain(f.missionSr);
      for (const sid of f.ships) {
        expect(navy.ships.design[navy.ships.rowOf(sid)]).toBe(1);
      }
    }
  }, 120_000);

  it("never declares war, joins a faction or spends political power", async () => {
    const on = await britain(false);
    const off = await britain(false);
    setNavy(on.runner, true);
    step(off.runner, 1);
    const d0 = today(on.g);
    for (let d = d0; d <= d0 + 30; d++) {
      finishDay(on.runner, d);
      finishDay(off.runner, d);
    }
    expect(on.ww.autoMask(GBR)).toBe(wwAutoBit("navy"));
    // The AI did run the navy (at peace one patrol trains at home)...
    expect(mission(on.patrol)).toBe("training");
    expect(mission(off.patrol)).toBe("hold");
    expect(gameHash(on.runner)).not.toBe(gameHash(off.runner));
    // ...and nothing else.
    expect(on.ww.enemiesOf(GBR)).toEqual(off.ww.enemiesOf(GBR));
    expect(on.ww.enemiesOf(GBR)).toEqual([]);
    expect(on.ww.factionOf(GBR)).toBe(off.ww.factionOf(GBR));
    const p = (x: typeof on) => x.ww.politics.country(GBR)!;
    expect(p(on).ppMilli).toBe(p(off).ppMilli);
    expect(on.ww.economy.country(GBR)!.navalLines).toEqual(
      off.ww.economy.country(GBR)!.navalLines,
    );
    expect(on.navy.invasions.size).toBe(0);
  }, 240_000);

  it("no difficulty handicap: on Easy a human's navy plans on the normal days", async () => {
    const { g, ww, navy, main } = await britain(true, Difficulty.Easy);
    expect(ww.aiLevel).toBe("easy");
    ww.setAuto(GBR, "navy", true);
    // A day the AI's Easy cadence skips but the normal one plans.
    let d = today(g) + 1;
    while (
      !aiNavyDue(GBR, d, true, "normal") ||
      aiNavyDue(GBR, d, true, "easy")
    ) {
      d++;
    }
    aiNavy(navy, GBR, d);
    expect(mission(main)).not.toBe("hold");
  }, 120_000);

  it("snapshot and restore with the navy switch on stay in lockstep", async () => {
    const { runner, g, main } = await britain();
    setNavy(runner, true);
    const restored = await wwRestore(runner, HUMANS, DEEP.map);
    const ww2 = restored.game.worldWar()!;
    expect(ww2.autoMask(GBR)).toBe(wwAutoBit("navy"));
    expect(ww2.data().auto).toEqual([
      { smallID: GBR, mask: wwAutoBit("navy") },
    ]);
    expect(gameHash(restored)).toBe(gameHash(runner));
    // Six days, tick by tick: the AI's fleet days for the human.
    const end = g.ticks() + 6 * 30;
    while (g.ticks() < end) {
      step(runner);
      step(restored);
      expect(gameHash(restored)).toBe(gameHash(runner));
    }
    expect(mission(main)).not.toBe("hold");
    const main2 = ww2.navy.fleets.get(main.id)!;
    expect(orders(main2)).toEqual(orders(main));
  }, 240_000);
});
