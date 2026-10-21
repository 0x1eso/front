// World War 1936 P4 (plan Task 3, lane N1): fleet orders — missions and
// range, split, merge, the fleet cap, admirals (spec §7.2, §7.4, §8.1,
// §8.3), on ww1936sea with human countries.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  ENGAGE_RULES,
  FLEET_MISSIONS,
  FLEET_STATES,
  WW_MAX_FLEETS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { ADMIRALS } from "@openfront/engine-lib/ww1936/Admirals";
import { fleetMissionBlock } from "@openfront/engine-lib/ww1936/NavalRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { HUMAN, step, stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;

async function game(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  return runner;
}

function navyOf(runner: GameRunner) {
  return runner.game.worldWar()!.navy;
}

function issue(runner: GameRunner, who: number, o: WwOrder) {
  return navyOf(runner).issue(who, o, runner.game.ticks());
}

describe("fleet orders (spec §7.2, §8.1, §8.3)", () => {
  it("a mission out of range is refused", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    // One destroyer (range 3,500 km) based in Kiev (harbor 40003): the
    // Western Approaches are 240 km away over the date line.
    const id = navy.createFleet(GBR, REGION.kiev, [["dd", 1, 1]]);
    expect(navy.fleetRangeKm(navy.fleets.get(id)!)).toBe(3500);
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "patrol",
        sr: SR.approaches,
      }),
    ).toBeNull();
    const f = navy.fleets.get(id)!;
    expect(FLEET_MISSIONS[f.mission]).toBe("patrol");
    expect(f.missionSr).toBe(SR.approaches);
    expect(f.dest).toBe(ZONE.west);
    expect(f.path).toEqual([ZONE.west]);
    // Every sea region of the test map is within 3,500 km: the judge itself.
    const ask = {
      mission: "patrol" as const,
      srKind: "sea" as const,
      km: 3600,
      rangeKm: 3500,
      inBattle: false,
    };
    expect(fleetMissionBlock(ask)).toBe("out_of_range");
    expect(fleetMissionBlock({ ...ask, km: 3500 })).toBeNull();
    expect(fleetMissionBlock({ ...ask, km: null })).toBe("no_sea_path");
    expect(fleetMissionBlock({ ...ask, srKind: "land" })).toBe("bad_zone");
    expect(fleetMissionBlock({ ...ask, srKind: null })).toBe("bad_zone");
    expect(fleetMissionBlock({ ...ask, inBattle: true })).toBe("fleet_busy");
    expect(fleetMissionBlock({ ...ask, mission: "hold", km: null })).toBeNull();
    // A land region is no mission region; training needs an own coast.
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "patrol",
        sr: SR.westLand,
      }),
    ).toBe("bad_zone");
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "training",
        sr: SR.eastern,
      }),
    ).toBe("bad_zone");
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "training",
        sr: SR.central,
      }),
    ).toBeNull();
    // A mission sets the mission's engagement rule (spec §8.1 table).
    expect(ENGAGE_RULES[navy.fleets.get(id)!.engage]).toBe("avoid");
  });

  it("a strike force waits in its home port", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [
      ["bb", 1, 2],
      ["dd", 1, 6],
    ]);
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: id,
        mission: "strike",
        sr: SR.approaches,
      }),
    ).toBeNull();
    const f = navy.fleets.get(id)!;
    expect([f.docked, f.dest, f.path]).toEqual([REGION.london, 0, []]);
    expect(FLEET_STATES[f.state]).toBe("docked");
    expect(ENGAGE_RULES[f.engage]).toBe("always");
  });

  it("split by class takes the weakest first", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [
      ["dd", 1, 4],
      ["cl", 1, 1],
    ]);
    const f = navy.fleets.get(id)!;
    const [d1, d2, d3, d4, cl] = f.ships;
    const t = navy.ships;
    t.hp[t.rowOf(d2)] -= 5000;
    t.hp[t.rowOf(d4)] -= 9000;
    t.hp[t.rowOf(d3)] -= 5000;
    f.nameIdx = 3;
    expect(
      issue(runner, GBR, { kind: "fleet_engage", fleet: id, rule: "always" }),
    ).toBeNull();
    const order = (counts: [string, number][], ships: number[] = []) =>
      issue(runner, GBR, {
        kind: "fleet_split",
        fleet: id,
        counts: counts as [never, number][],
        ships,
      });
    // None, all, too many of a class, a ship not in the fleet.
    expect(order([])).toBe("bad_index");
    expect(order([], [d1, d2, d3, d4, cl])).toBe("bad_index");
    expect(order([["dd", 5]])).toBe("bad_index");
    expect(order([], [d1, 999])).toBe("bad_index");
    expect(
      order([
        ["dd", 1],
        ["dd", 1],
      ]),
    ).toBe("bad_index");
    expect(order([["dd", 2]])).toBeNull();
    // d4 (lowest), then d2 and d3 tie: the smaller id.
    expect(f.ships).toEqual([d1, d3, cl]);
    const nf = navy.fleetsOf(GBR).find((x) => x.id !== id)!;
    expect(nf.ships).toEqual([d2, d4]);
    expect([nf.docked, nf.home, nf.zone]).toEqual([
      REGION.london,
      REGION.london,
      ZONE.west,
    ]);
    expect(FLEET_MISSIONS[nf.mission]).toBe("hold");
    expect(t.fleet[t.rowOf(d2)]).toBe(nf.id);
    // The new fleet keeps the parent's rule and name (its own number).
    expect([nf.engage, nf.nameIdx]).toEqual([f.engage, f.nameIdx]);
    expect(nf.num).not.toBe(f.num);
    // By ship list, at sea: the new fleet holds in the same zone.
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.west }),
    ).toBeNull();
    expect(f.docked).toBe(0);
    expect(order([], [cl])).toBeNull();
    const sea = navy.fleetsOf(GBR).find((x) => x.ships[0] === cl)!;
    expect([sea.docked, sea.zone]).toEqual([0, ZONE.west]);
    expect(FLEET_STATES[sea.state]).toBe("on_station");
  });

  it("merge needs the same zone or port", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const a = navy.createFleet(GBR, REGION.london, [["dd", 1, 30]]);
    const b = navy.createFleet(GBR, REGION.london, [["cl", 1, 2]]);
    const c = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    const d = navy.createFleet(GBR, REGION.london, [["dd", 1, 31]]);
    const ita = navy.createFleet(TAG_ID.ITA, REGION.rome, [["dd", 1, 1]]);
    const merge = (fleet: number, into: number) =>
      issue(runner, GBR, { kind: "fleet_merge", fleet, into });
    expect(merge(a, ita)).toBe("no_fleet");
    expect(merge(a, a)).toBe("bad_index");
    expect(merge(c, b)).toBe("not_adjacent");
    expect(merge(a, d)).toBe("fleet_full");
    const bShips = [...navy.fleets.get(b)!.ships];
    expect(merge(b, a)).toBeNull();
    expect(navy.fleets.has(b)).toBe(false);
    const fa = navy.fleets.get(a)!;
    expect(fa.ships).toHaveLength(32);
    expect([...fa.ships].sort((x, y) => x - y)).toEqual(fa.ships);
    for (const s of bShips)
      expect(navy.ships.fleet[navy.ships.rowOf(s)]).toBe(a);
    // At sea in the same zone; a docked fleet and one at sea in its harbor zone are not.
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: c, zone: ZONE.middle }),
    ).toBeNull();
    const e = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    expect(merge(e, c)).toBe("not_adjacent");
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: e, zone: ZONE.middle }),
    ).toBeNull();
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: c,
        mission: "patrol",
        sr: SR.central,
      }),
    ).toBeNull();
    expect(merge(e, c)).toBeNull();
    // The merged fleet keeps `into`'s mission.
    expect(FLEET_MISSIONS[navy.fleets.get(c)!.mission]).toBe("patrol");
    expect(navy.fleets.get(c)!.ships).toHaveLength(2);
    // A fleet part-way along an edge is between zones: no merge.
    const g = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: g, zone: ZONE.middle }),
    ).toBeNull();
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: c, zone: ZONE.west }),
    ).toBeNull();
    step(runner);
    expect([navy.fleets.get(c)!.zone, navy.fleets.get(c)!.edge >= 0]).toEqual([
      ZONE.middle,
      true,
    ]);
    expect(merge(g, c)).toBe("not_adjacent");
    expect(merge(c, g)).toBe("not_adjacent");
  });

  it("too many fleets", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    for (let i = 0; i < WW_MAX_FLEETS - 1; i++) {
      navy.createFleet(GBR, REGION.london, [["dd", 1, 1]]);
    }
    const id = navy.createFleet(GBR, REGION.london, [["dd", 1, 2]]);
    expect(navy.fleetsOf(GBR)).toHaveLength(WW_MAX_FLEETS);
    expect(
      issue(runner, GBR, {
        kind: "fleet_split",
        fleet: id,
        counts: [["dd", 1]],
        ships: [],
      }),
    ).toBe("too_many_fleets");
    navy.removeShip(navy.fleetsOf(GBR)[0].ships[0], false, runner.game.ticks());
    expect(
      issue(runner, GBR, {
        kind: "fleet_split",
        fleet: id,
        counts: [["dd", 1]],
        ships: [],
      }),
    ).toBeNull();
    expect(navy.fleetsOf(GBR)).toHaveLength(WW_MAX_FLEETS);
  });

  it("admiral assignment moves an admiral between fleets", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const ids = (pred: (i: number) => boolean) =>
      ADMIRALS.map((a, i) => ({ a, id: i + 1 })).filter(
        ({ a, id }) => a.tag === "GBR" && pred(id),
      );
    // A British admiral serving in 1936, one from 1939, an Italian one.
    const now = ids((id) => ADMIRALS[id - 1].from === undefined)[0].id;
    const later = ids((id) => (ADMIRALS[id - 1].from ?? "") >= "1939")[0].id;
    const italian =
      ADMIRALS.findIndex((a) => a.tag === "ITA" && a.from === undefined) + 1;
    expect(navy.admirals.get(now)?.owner).toBe(GBR);
    const a = navy.createFleet(GBR, REGION.london, [["dd", 1, 1]]);
    const b = navy.createFleet(GBR, REGION.malta, [["dd", 1, 1]]);
    const assign = (fleet: number, admiral: number) =>
      issue(runner, GBR, { kind: "fleet_admiral", fleet, admiral });
    expect(assign(a, now)).toBeNull();
    expect(navy.fleets.get(a)!.admiral).toBe(now);
    expect(navy.admirals.get(now)!.fleet).toBe(a);
    expect(assign(b, now)).toBeNull();
    expect(navy.fleets.get(a)!.admiral).toBe(0);
    expect(navy.fleets.get(b)!.admiral).toBe(now);
    expect(navy.admirals.get(now)!.fleet).toBe(b);
    expect(assign(a, later)).toBe("admiral_unavailable");
    expect(assign(a, italian)).toBe("admiral_unavailable");
    expect(assign(a, 12345)).toBe("admiral_unavailable");
    expect(assign(b, 0)).toBeNull();
    expect(navy.fleets.get(b)!.admiral).toBe(0);
    expect(navy.admirals.get(now)!.fleet).toBe(0);
    // An empty fleet's admiral is free again (merge empties `a`).
    expect(assign(a, now)).toBeNull();
    const c = navy.createFleet(GBR, REGION.london, [["dd", 1, 1]]);
    expect(
      issue(runner, GBR, { kind: "fleet_merge", fleet: a, into: c }),
    ).toBeNull();
    expect(navy.admirals.get(now)!.fleet).toBe(0);
  });

  it("rules, return threshold and auto are values, even in a battle", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [["dd", 1, 2]]);
    const f = navy.fleets.get(id)!;
    navy.addBattle({
      zone: ZONE.west,
      sides: [GBR, TAG_ID.ITA],
      fleets: [[id], []],
      round: 0,
      startHp: [0, 0],
      startOrg: [0, 0],
      retreating: [false, false],
      sunk: [
        [0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0],
      ],
      sunkNamed: [],
      startTick: runner.game.ticks(),
    });
    expect(
      issue(runner, GBR, { kind: "fleet_engage", fleet: id, rule: "avoid" }),
    ).toBeNull();
    expect(
      issue(runner, GBR, { kind: "fleet_return_at", fleet: id, pct: 70 }),
    ).toBeNull();
    expect(
      issue(runner, GBR, { kind: "fleet_auto", fleet: id, on: true }),
    ).toBeNull();
    expect([ENGAGE_RULES[f.engage], f.returnAtPct, f.auto]).toEqual([
      "avoid",
      70,
      true,
    ]);
    expect(issue(runner, GBR, { kind: "fleet_return", fleet: id })).toBe(
      "fleet_busy",
    );
    expect(
      issue(runner, GBR, { kind: "fleet_move", fleet: id, zone: ZONE.east }),
    ).toBe("fleet_busy");
    expect(issue(runner, TAG_ID.ITA, { kind: "fleet_return", fleet: id })).toBe(
      "no_fleet",
    );
  });

  it("a new home base: a working base of the side, a mission out of range holds", async () => {
    const runner = await game();
    const navy = navyOf(runner);
    const id = navy.createFleet(GBR, REGION.london, [["dd", 1, 1]]);
    const base = (port: number) =>
      issue(runner, GBR, { kind: "fleet_base", fleet: id, port });
    expect(base(REGION.rome)).toBe("no_naval_base");
    expect(base(REGION.paris)).toBe("no_naval_base");
    expect(base(REGION.malta)).toBeNull();
    const f = navy.fleets.get(id)!;
    expect(f.home).toBe(REGION.malta);
    // Docked in London: it sails to its new home.
    expect(FLEET_STATES[f.state]).toBe("returning");
    expect(f.path).toEqual([ZONE.middle]);
  });
});
