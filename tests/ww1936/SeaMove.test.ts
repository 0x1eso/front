// World War 1936 P4 (plan Task 3, lane N1): fleet movement over the sea
// graph (spec §3.3, §7.3, §8.3, §2.2's preparation minute) on ww1936sea
// with human countries: the date line, closed canals and straits, lakes,
// a lost home port, the return threshold.
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  FLEET_MISSIONS,
  FLEET_STATES,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { tickMilliKm } from "@openfront/engine-lib/ww1936/NavalRules";
import { createGameRunner, GameRunner } from "@openfront/engine/GameRunner";
import type { Fleet } from "@openfront/engine/ww1936/navy/WwNavy";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import { PATH_KM, REGION, SEA, SEA_KM, SR, TAG_ID, ZONE } from "./seaFixture";
import {
  HUMAN,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  wwGameStart,
  wwRunner,
} from "./util";

withTestPolitics();

const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;

const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;
const state = (f: Fleet) => FLEET_STATES[f.state];

async function game(prep = false): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  if (!prep) stepTo(runner, WW_PREP_TICKS + 1);
  return runner;
}

function issue(runner: GameRunner, who: number, o: WwOrder) {
  return navyOf(runner).issue(who, o, runner.game.ticks());
}

function war(runner: GameRunner, a: number, b: number): void {
  runner.game.worldWar()!.setWar(a, b, runner.game.ticks());
}

/** Steps until `pred` holds (at most `max` ticks); returns the ticks taken. */
function stepUntil(runner: GameRunner, pred: () => boolean, max = 200): number {
  for (let i = 1; i <= max; i++) {
    step(runner);
    if (pred()) return i;
  }
  throw new Error("never happened");
}

describe("fleet movement (spec §7.3)", () => {
  it("a fleet crosses the date line", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [["dd", 1, 4]]);
    const f = navy.fleets.get(id)!;
    expect(navy.fleetSpeedCentiKn(f)).toBe(3400);
    expect(tickMilliKm(3400)).toBe(115_168);
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBeNull();
    // [40001, 40003] over the date line: the zone ahead.
    expect(f.path).toEqual([ZONE.east]);
    expect(FLEET_MISSIONS[f.mission]).toBe("hold");
    step(runner);
    expect([f.zone, f.docked, f.prog, f.need]).toEqual([
      ZONE.west,
      0,
      115_168,
      SEA_KM.westEastDateline * 1000,
    ]);
    step(runner);
    expect([f.zone, f.prog]).toEqual([ZONE.west, 230_336]);
    step(runner);
    // The third tick: 345,504 ≥ 240,000 — there, the rest dropped.
    expect([f.zone, f.prog, f.path]).toEqual([ZONE.east, 0, []]);
    expect(state(f)).toBe("on_station");
    expect(navy.fleetsIn(ZONE.east)).toEqual([id]);
    expect(f.lastSr).toBe(SR.eastern);
    const ww = runner.game.worldWar()!;
    expect(f.seaDay).toBe(ww.day(runner.game.ticks() - 1));
  });

  it("a closed canal sends the fleet round", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    war(runner, GBR, TAG_ID.TUR);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBeNull();
    // [40002, 40001, 40003]: 300 + 240 = 540 km instead of 220 through the canal.
    expect(f.path).toEqual([ZONE.west, ZONE.east]);
    expect(navy.pathFor(f, [ZONE.east])!.km).toBe(
      PATH_KM.middleToEastCanalClosed,
    );
    // 300 km: 3 ticks; 240 km: 3 more.
    expect(stepUntil(runner, () => f.zone === ZONE.east)).toBe(6);
  });

  it("a strait closes when its shore is hostile", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    war(runner, GBR, TAG_ID.POL);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.narrows }),
    ).toBeNull();
    // The Narrows' shore (Krakow) is Polish: round by the date line, 600 km.
    expect(f.path).toEqual([ZONE.west, ZONE.east, ZONE.narrows]);
    expect(navy.pathFor(f, [ZONE.narrows])!.km).toBe(
      PATH_KM.middleToNarrowsStraitClosed,
    );
    // Strait and canal both closed: no way, and the order says why.
    war(runner, GBR, TAG_ID.TUR);
    const g = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: g, zone: ZONE.narrows }),
    ).toBe("canal_closed");
    expect(navy.fleets.get(g)!.path).toEqual([]);
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: g, zone: 49999 }),
    ).toBe("bad_zone");
  });

  it("a canal closing on the way: the fleet finds its way again", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBeNull();
    expect(f.path).toEqual([ZONE.narrows, ZONE.east]);
    stepUntil(runner, () => f.zone === ZONE.narrows);
    // Turkey at war before the fleet enters the canal's edge.
    war(runner, GBR, TAG_ID.TUR);
    step(runner);
    expect(f.path).toEqual([ZONE.middle, ZONE.west, ZONE.east]);
    expect(f.zone).toBe(ZONE.narrows);
    stepUntil(runner, () => f.zone === ZONE.east);
    expect(state(f)).toBe("on_station");
  });

  it("no fleet enters a lake", async () => {
    // The scenario with the Narrows as a lake (a copy, in this test only).
    class LakeLoader extends TestDataMapLoader {
      getMapData() {
        const d = super.getMapData();
        return {
          ...d,
          file: async (name: string) => {
            const b = await d.file(name);
            if (name !== "scenario.json") return b;
            const j = JSON.parse(new TextDecoder().decode(b));
            j.seaZones.find((z: { id: number }) => z.id === ZONE.narrows).lake =
              true;
            return new TextEncoder().encode(JSON.stringify(j));
          },
        };
      }
    }
    const runner = await createGameRunner(
      wwGameStart({}, HUMANS),
      undefined,
      await loadMapFiles(
        new LakeLoader(SEA.map),
        GameMapType.World1936,
        GameMapSize.Normal,
      ),
      () => {},
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    const navy = navyOf(runner);
    expect(navy.scenario.isLake(ZONE.narrows)).toBe(true);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.narrows }),
    ).toBe("lake");
    // The way east goes round the lake.
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBeNull();
    expect(navy.fleets.get(id)!.path).toEqual([ZONE.west, ZONE.east]);
  });

  it("home port lost → the nearest friendly base becomes home", async () => {
    const runner = await game();
    const g = runner.game;
    const navy = navyOf(runner);
    war(runner, GBR, TAG_ID.ITA);
    // At sea off Malta, on patrol in the Eastern Waters (220 km from Malta,
    // 240 from London: in range from both).
    const sea = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: sea,
        mission: "patrol",
        sr: SR.eastern,
      }),
    ).toBeNull();
    const fs = navy.fleets.get(sea)!;
    // Docked in Malta when it falls.
    const docked = navy.createFleet(GBR, REGION.malta, [["cl", 1, 1]]);
    const fd = navy.fleets.get(docked)!;
    step(runner);
    expect(fs.docked).toBe(0);
    // France is on Britain's side: Lyon (40001, like London) is a base of
    // the side, and the smaller region id breaks the tie.
    const land = g.worldWar()!.land;
    expect(land.sameSide(GBR, TAG_ID.FRA)).toBe(true);
    takeRegion(g, REGION.malta, "ITA");
    // The docked fleet puts to sea toward Lyon that tick (spec §7.1) …
    expect([fd.home, fd.docked, state(fd)]).toEqual([
      REGION.lyon,
      0,
      "returning",
    ]);
    // … and docks there: 300 km at 32 knots.
    expect(stepUntil(runner, () => fd.docked === REGION.lyon)).toBe(3);
    expect(state(fd)).toBe("docked");
    // The fleet at sea takes the same base on Britain's day; the patrol stays.
    stepUntil(runner, () => fs.home === REGION.lyon, 20);
    expect(FLEET_MISSIONS[fs.mission]).toBe("patrol");
    // London alone left (Lyon falls too): the next day it is London.
    takeRegion(g, REGION.lyon, "ITA");
    stepUntil(runner, () => fs.home === REGION.london, 20);
  });

  it("a mission fleet below its return threshold goes home to be repaired", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "patrol",
        sr: SR.central,
      }),
    ).toBeNull();
    // Malta's harbor zone is in the region: on station at once.
    expect([f.docked, f.zone, state(f)]).toEqual([
      0,
      ZONE.middle,
      "on_station",
    ]);
    const t = navy.ships;
    for (const s of f.ships)
      t.hp[t.rowOf(s)] = Math.floor(t.hp[t.rowOf(s)] * 0.4);
    stepUntil(runner, () => f.docked === REGION.malta, 20);
    expect(state(f)).toBe("repairing");
    expect(FLEET_MISSIONS[f.mission]).toBe("patrol");
  });

  it("a mission fleet sails to its station; fleet_return brings it home to hold", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "patrol",
        sr: SR.central,
      }),
    ).toBeNull();
    expect([f.dest, f.path, state(f)]).toEqual([
      ZONE.middle,
      [ZONE.middle],
      "moving",
    ]);
    stepUntil(runner, () => state(f) === "on_station");
    expect(f.zone).toBe(ZONE.middle);
    expect(issue(runner, GBR, { kind: "fleet_return", fleet: id })).toBeNull();
    expect(state(f)).toBe("returning");
    stepUntil(runner, () => f.docked === REGION.london);
    expect([state(f), FLEET_MISSIONS[f.mission]]).toEqual(["docked", "hold"]);
  });
});

describe("the preparation minute (spec §2.2)", () => {
  it("the preparation minute keeps fleets in home waters", async () => {
    const runner = await game(true);
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.malta, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBeNull();
    // The Narrows are Central Waters (Malta's); the Eastern Waters are not British.
    stepTo(runner, WW_PREP_TICKS - 1);
    expect([f.zone, f.path, f.edge]).toEqual([ZONE.narrows, [ZONE.east], -1]);
    // The war's clock starts: on it goes.
    stepUntil(runner, () => f.zone === ZONE.east, 10);
    expect(runner.game.ticks()).toBeGreaterThan(WW_PREP_TICKS);
  });
});
