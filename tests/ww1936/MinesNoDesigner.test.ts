// w77: mines with the designer off. No ship has a design to carry the
// mine-layer or minesweeper module, so mine_warfare_1 opens the work by
// class (SeaAirRules.mineRoleFlags): destroyers, light cruisers and
// submarines lay, destroyers and light cruisers sweep. One rule for the
// engine, the AI and the fleet card's chips.
import {
  DS_MINE_LAYER,
  DS_MINESWEEP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import {
  FLEET_MISSIONS,
  SHIP_CLASSES,
  type ShipClass,
} from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  MINE_LAY_PER_DAY,
  MINE_SWEEP_PER_DAY,
  mineRoleFlags,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  AI_MINE_SHIPS,
  aiSeaAirDay,
  homeSeaRegions,
} from "@openfront/engine/ww1936/depth/AiSeaAir";
import {
  ownMinesMilli,
  seaRegionDay,
  shipMineFlags,
} from "@openfront/engine/ww1936/depth/Mines";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { DEEP } from "./deepFixture";
import { depthFixture } from "./depthFixture";
import { stepTo, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(depthFixture()));
afterEach(() => usePoliticsContent(null));

const GBR = DEEP.tag.GBR;
const ITA = DEEP.tag.ITA;
const CENTRAL = DEEP.sr.central;
const ALL: ShipClass[] = [...SHIP_CLASSES];

describe("mineRoleFlags: the one judgement", () => {
  it("designer on: the design's flags, whatever the class and tech", () => {
    for (const cls of ALL) {
      expect(mineRoleFlags(cls, 0, true, true)).toBe(0);
      expect(mineRoleFlags(cls, DS_MINE_LAYER, true, false)).toBe(
        DS_MINE_LAYER,
      );
      expect(mineRoleFlags(cls, DS_MINESWEEP, true, false)).toBe(DS_MINESWEEP);
    }
  });

  it("designer off: nothing without mine_warfare_1", () => {
    for (const cls of ALL) {
      expect(mineRoleFlags(cls, 0, false, false)).toBe(0);
    }
  });

  it("designer off with mine_warfare_1: dd, cl, ss lay; dd, cl sweep", () => {
    const lay = ALL.filter(
      (c) => (mineRoleFlags(c, 0, false, true) & DS_MINE_LAYER) !== 0,
    );
    const sweep = ALL.filter(
      (c) => (mineRoleFlags(c, 0, false, true) & DS_MINESWEEP) !== 0,
    );
    expect(lay).toEqual(["dd", "cl", "ss"]);
    expect(sweep).toEqual(["dd", "cl"]);
    // The rates stay the class tables'.
    expect(MINE_LAY_PER_DAY.dd).toBe(2_000);
    expect(MINE_SWEEP_PER_DAY.cl).toBe(2_000);
  });
});

async function atWar(
  humans: { clientID: string; country: "GBR" | "ITA" }[],
): Promise<GameRunner> {
  const runner = await wwRunner({ ww1936Designer: false }, humans, DEEP.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

function fleet(
  runner: GameRunner,
  owner: number,
  port: number,
  comp: ["dd" | "cl" | "ss" | "bb", number, number][],
): number {
  return runner.game.worldWar()!.navy.createFleet(owner, port, comp);
}

function mission(
  runner: GameRunner,
  owner: number,
  id: number,
  m: "lay_mines" | "sweep_mines",
): void {
  const navy = runner.game.worldWar()!.navy;
  expect(
    navy.issue(
      owner,
      { kind: "fleet_mission", fleet: id, mission: m, sr: CENTRAL },
      runner.game.ticks(),
    ),
  ).toBeNull();
}

const BOTH = [
  { clientID: "HUMANGBR", country: "GBR" as const },
  { clientID: "HUMANITA", country: "ITA" as const },
];

describe("mines in a game with the designer off", () => {
  it("lays and sweeps only after mine_warfare_1, by class, at the class rates", async () => {
    const runner = await atWar(BOTH);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    const layers = fleet(runner, ITA, DEEP.region.rome, [
      ["dd", 1, 2],
      ["ss", 1, 1],
      ["bb", 1, 1],
    ]);
    mission(runner, ITA, layers, "lay_mines");
    // No tech yet: no ship may.
    seaRegionDay(d, CENTRAL, day);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(0);
    const navy = ww.navy;
    for (const sid of navy.fleets.get(layers)!.ships) {
      expect(shipMineFlags(d, navy.ships.rowOf(sid))).toBe(0);
    }
    ww.economy.country(ITA)!.addTech("mine_warfare_1");
    seaRegionDay(d, CENTRAL, day + 1);
    // Two destroyers 2000 each, the submarine 3000, the battleship none.
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(2 * 2_000 + 3_000);
    // Magnetic mines: +50 % of the day's laying.
    ww.economy.country(ITA)!.addTech("mine_warfare_2");
    const before = ownMinesMilli(d, CENTRAL, ITA);
    seaRegionDay(d, CENTRAL, day + 2);
    const decayed = before - Math.floor((before * 5) / 1000);
    expect(ownMinesMilli(d, CENTRAL, ITA)).toBe(
      decayed + Math.floor((2 * 2_000 * 3) / 2) + Math.floor((3_000 * 3) / 2),
    );
  });

  it("sweeps with destroyers and light cruisers, not submarines", async () => {
    const runner = await atWar(BOTH);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const day = ww.day(runner.game.ticks());
    ww.economy.country(GBR)!.addTech("mine_warfare_1");
    const sweepers = fleet(runner, GBR, DEEP.region.malta, [
      ["dd", 1, 2],
      ["ss", 1, 1],
    ]);
    mission(runner, GBR, sweepers, "sweep_mines");
    d.sea.mines = [[CENTRAL, ww.land.sideOf(ITA), 1_000_000]];
    d.reindexSparse();
    seaRegionDay(d, CENTRAL, day);
    // Decay, then two destroyers at 3000 a day; the submarine sweeps nothing.
    expect(d.sea.mines.find((m) => m[1] === ww.land.sideOf(ITA))![2]).toBe(
      1_000_000 - 5_000 - 2 * 3_000,
    );
  });

  it("the AI lays with a few idle ships and leaves fleets on missions alone", async () => {
    const runner = await atWar([]);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const navy = ww.navy;
    const day = ww.day(runner.game.ticks());
    // Britain (a mining country) with eight idle destroyers and a patrolling fleet.
    ww.economy.country(GBR)!.addTech("mine_warfare_1");
    const idle = fleet(runner, GBR, DEEP.region.london, [["dd", 1, 8]]);
    const busy = fleet(runner, GBR, DEEP.region.malta, [["dd", 1, 4]]);
    const busyMission = navy.fleets.get(busy)!;
    expect(
      navy.issue(
        GBR,
        { kind: "fleet_mission", fleet: busy, mission: "patrol", sr: CENTRAL },
        runner.game.ticks(),
      ),
    ).toBeNull();
    const patrol = busyMission.mission;
    expect(homeSeaRegions(d, GBR).length).toBe(2);
    aiSeaAirDay(d, GBR, day);
    const minesF = navy
      .fleetsOf(GBR)
      .filter((f) => f.mission === FLEET_MISSIONS.indexOf("lay_mines"));
    expect(minesF.length).toBeGreaterThan(0);
    for (const f of minesF) {
      expect(f.ships.length).toBeLessThanOrEqual(AI_MINE_SHIPS);
    }
    // The patrolling fleet kept its mission and all its ships.
    expect(navy.fleets.get(busy)!.mission).toBe(patrol);
    expect(navy.fleets.get(busy)!.ships.length).toBe(4);
    // The idle fleet still holds most of its destroyers.
    const rest = navy.fleets.get(idle)?.ships.length ?? 0;
    expect(rest).toBeGreaterThanOrEqual(8 - AI_MINE_SHIPS * 2);
  });

  it("the AI without the tech lays nothing", async () => {
    const runner = await atWar([]);
    const ww = runner.game.worldWar()!;
    const d = ww.depth;
    const navy = ww.navy;
    const day = ww.day(runner.game.ticks());
    fleet(runner, GBR, DEEP.region.london, [["dd", 1, 4]]);
    aiSeaAirDay(d, GBR, day);
    expect(
      navy
        .fleetsOf(GBR)
        .some((f) => f.mission === FLEET_MISSIONS.indexOf("lay_mines")),
    ).toBe(false);
  });
});
