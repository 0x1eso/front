// World War 1936 P4 (plan Task 3, lane N1): spotting (spec §8.4) on
// ww1936sea: Britain against Italy, both human, in the Central Waters
// (zones 40002 + 40004, area 3).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { ADMIRALS } from "@openfront/engine-lib/ww1936/Admirals";
import { fleetVis, spotGainPm } from "@openfront/engine-lib/ww1936/NavalRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import { fleetVisOf, spotRegion } from "@openfront/engine/ww1936/navy/Spotting";
import { REGION, SEA, SR, TAG_ID, ZONE } from "./seaFixture";
import { HUMAN, step, stepTo, withTestPolitics, wwRunner } from "./util";

withTestPolitics();

const HUMANS = [
  { clientID: HUMAN, country: "GBR" as const },
  { clientID: "HUMAN002", country: "ITA" as const },
];
const GBR = TAG_ID.GBR;
const ITA = TAG_ID.ITA;

async function atWar(): Promise<GameRunner> {
  const runner = await wwRunner({}, HUMANS, SEA.map);
  stepTo(runner, WW_PREP_TICKS + 1);
  runner.game.worldWar()!.setWar(GBR, ITA, runner.game.ticks());
  return runner;
}

const navyOf = (r: GameRunner) => r.game.worldWar()!.navy;

function issue(runner: GameRunner, who: number, o: WwOrder) {
  return navyOf(runner).issue(who, o, runner.game.ticks());
}

/** A fleet on patrol in `sr` from `port` (Malta: on station at once). */
function patrol(
  runner: GameRunner,
  owner: number,
  port: number,
  comp: Parameters<ReturnType<typeof navyOf>["createFleet"]>[2],
  sr: number = SR.central,
): number {
  const id = navyOf(runner).createFleet(owner, port, comp);
  expect(
    issue(runner, owner, {
      kind: "fleet_mission",
      fleet: id,
      mission: "patrol",
      sr,
    }),
  ).toBeNull();
  return id;
}

/** A fleet holding at sea in `zone`'s harbor port's zone (Rome: 40002). */
function atSea(
  runner: GameRunner,
  owner: number,
  port: number,
  comp: Parameters<ReturnType<typeof navyOf>["createFleet"]>[2],
): number {
  const navy = navyOf(runner);
  const id = navy.createFleet(owner, port, comp);
  const zone = navy.scenario.harborOf(port);
  expect(
    issue(runner, owner, { kind: "fleet_move", fleet: id, zone }),
  ).toBeNull();
  expect(navy.fleets.get(id)!.docked).toBe(0);
  return id;
}

function spotsOf(
  runner: GameRunner,
  sr: number,
): Map<number, Map<number, number>> {
  const navy = navyOf(runner);
  return navy.srState[navy.scenario.srIdxOf(sr)].spot;
}

const day = (r: GameRunner) => r.game.worldWar()!.day(r.game.ticks());

describe("spotting (spec §8.4)", () => {
  it("a patrol spots per the formula", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const ww = runner.game.worldWar()!;
    const side = ww.land.sideOf(GBR);
    patrol(runner, GBR, REGION.malta, [
      ["dd", 1, 4],
      ["cl", 1, 2],
    ]);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    // search = 4 × 25 + 2 × 30 = 160; vis = 30 + 2 × 5 = 40; area 3.
    expect(fleetVisOf(navy, navy.fleets.get(ita)!)).toEqual({
      vis: 40,
      subsOnly: false,
    });
    expect(fleetVis(30, 6, false)).toBe(40);
    expect(navy.scenario.sr(SR.central)!.area).toBe(3);
    expect(spotGainPm(160, 40, 3)).toBe(2133);
    // The region's first day spots it: area 3 is a small region (the real
    // map's are 15–200, spec §8.4's three days in the North Sea).
    const i = navy.scenario.srIdxOf(SR.central);
    const last = navy.srState[i].lastDay;
    while (navy.srState[i].lastDay === last) step(runner);
    expect(navy.spotPm(side, ita)).toBe(1000);
    expect(navy.spotted(side, ita)).toBe(true);
    // Italy holds (search 0): it spots nothing.
    expect(
      spotsOf(runner, SR.central).get(ww.land.sideOf(ITA)),
    ).toBeUndefined();
  });

  it("one destroyer: 25 × 40 / 3 a day, up to 1000", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 1]]);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const seen: number[] = [];
    for (let d = 0; d < 4; d++) {
      spotRegion(navy, SR.central, day(runner));
      seen.push(navy.spotPm(side, ita));
    }
    expect(seen).toEqual([333, 666, 999, 1000]);
  });

  it("the admiral's search bonus, exactly", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const dd = patrol(runner, GBR, REGION.malta, [["dd", 1, 1]]);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const adm = ADMIRALS.findIndex(
      (a) => a.tag === "GBR" && a.man === 4 && a.from === undefined,
    );
    expect(adm).toBeGreaterThanOrEqual(0);
    const traits = ADMIRALS[adm].traits;
    expect(
      issue(runner, GBR, {
        kind: "fleet_admiral",
        fleet: dd,
        admiral: adm + 1,
      }),
    ).toBeNull();
    const pct = 100 + 4 * 5 + (traits.includes("spotter") ? 20 : 0);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(
      spotGainPm(Math.floor((25 * pct) / 100), 40, 3),
    );
  });

  it("spotting decays by 300 without search", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const dd = patrol(runner, GBR, REGION.malta, [["dd", 1, 1]]);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(333);
    // Holding: no search.
    expect(
      issue(runner, GBR, {
        kind: "fleet_mission",
        fleet: dd,
        mission: "hold",
        sr: SR.central,
      }),
    ).toBeNull();
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(33);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(0);
    expect(spotsOf(runner, SR.central).has(side)).toBe(false);
  });

  it("leaving the region resets spotting", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 1]]);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    spotRegion(navy, SR.central, day(runner));
    expect(spotsOf(runner, SR.central).get(side)?.get(ita)).toBe(333);
    expect(
      issue(runner, ITA, { kind: "fleet_move", fleet: ita, zone: ZONE.west }),
    ).toBeNull();
    const f = navy.fleets.get(ita)!;
    while (f.zone !== ZONE.west) step(runner);
    expect(f.lastSr).toBe(SR.approaches);
    expect(spotsOf(runner, SR.central).get(side)?.get(ita)).toBeUndefined();
  });

  it("a fleet in port is not spotted", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 4]]);
    const ita = navy.createFleet(ITA, REGION.rome, [["bb", 1, 2]]);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(0);
  });

  it("submarines are found only by sub detection", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const ss = atSea(runner, ITA, REGION.rome, [["ss", 1, 4]]);
    // Submerged visibility 6 + 1 per extra submarine.
    expect(fleetVisOf(navy, navy.fleets.get(ss)!)).toEqual({
      vis: 9,
      subsOnly: true,
    });
    // Battleships have no sonar: nothing.
    patrol(runner, GBR, REGION.malta, [["bb", 1, 2]]);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ss)).toBe(0);
    // Destroyers' sub detection (25 each, × 1.3 with Britain's 1936
    // sonar_1): 4 × 32 × 9 / 3 = 384.
    const sonar = navy.statsFor(GBR, "dd", 1).subDetect;
    expect(sonar).toBe(32);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 4]]);
    spotRegion(navy, SR.central, day(runner));
    const first = spotGainPm(4 * sonar, 9, 3);
    expect(navy.spotPm(side, ss)).toBe(first);
    // Naval patrol planes: 1 a plane against submarines (A1's milli-sorties).
    const i = navy.scenario.srIdxOf(SR.central);
    runner.game.worldWar()!.air.zoneState[i].navalAsw.set(GBR, 30_000);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ss)).toBe(
      first + spotGainPm(4 * sonar + 30, 9, 3),
    );
  });

  it("naval patrol planes spot on their own", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const i = navy.scenario.srIdxOf(SR.central);
    // 20 naval bombers on patrol (× 3) at full sortie efficiency.
    runner.game.worldWar()!.air.zoneState[i].navalSearch.set(GBR, 60_000);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(spotGainPm(60, 40, 3));
  });

  it("a raider that sank convoys yesterday gets +300", async () => {
    const runner = await atWar();
    const navy = navyOf(runner);
    const side = navy.sideOf(GBR);
    const ita = atSea(runner, ITA, REGION.rome, [
      ["bb", 1, 2],
      ["dd", 1, 4],
    ]);
    const st = navy.srState[navy.scenario.srIdxOf(SR.central)];
    // No search of Britain's there: the raid alone reveals it to the
    // side whose convoys it sank (lane C writes both lists).
    st.raidedYesterday = [ita];
    st.lossYesterday.set(GBR, 2000);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(300);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 1]]);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(300 + 333 + 300);
    st.raidedYesterday = [];
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(side, ita)).toBe(1000);
  });

  it("at peace nobody is spotted", async () => {
    const runner = await wwRunner({}, HUMANS, SEA.map);
    stepTo(runner, WW_PREP_TICKS + 1);
    const navy = navyOf(runner);
    patrol(runner, GBR, REGION.malta, [["dd", 1, 4]]);
    const ita = atSea(runner, ITA, REGION.rome, [["bb", 1, 2]]);
    spotRegion(navy, SR.central, day(runner));
    expect(navy.spotPm(navy.sideOf(GBR), ita)).toBe(0);
    expect(spotsOf(runner, SR.central).size).toBe(0);
  });
});
