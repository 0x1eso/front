// World War 1936 P4 (plan Task 8 Step 7): naval and port strikes (P4 spec
// §14.9, §14.4) on ww1936sea. Britain and Italy are humans at war; 100
// British naval bombers (1936) fly from London over Central Waters (1002)
// on a clear day there, against an Italian battleship and two destroyers
// out of Rome (made with the test helper createFleet; put to sea by hand:
// lane N1 moves fleets). The zone's day is called directly.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import { equipKey } from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_SPOT_FULL_PM } from "@openfront/engine-api/ww1936/NavyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { rangeEffPm } from "@openfront/engine-lib/ww1936/AirRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  orgDamageMilli,
  shotDamageMilli,
  visFactorPm,
} from "@openfront/engine-lib/ww1936/NavalRules";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import {
  airMissionEffects,
  WW_NAVAL_STRIKE_HIT_PM,
  WW_PORT_STRIKE_HIT_PM,
} from "@openfront/engine/ww1936/air/AirEffects";
import { apportion } from "@openfront/engine/ww1936/air/Bombing";
import type { Deployment } from "@openfront/engine/ww1936/air/WwAir";
import { drawPlanes } from "@openfront/engine/ww1936/economy/Buildings";
import { REGION, SEA, SR, ZONE } from "./seaFixture";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  withTestPolitics,
  WwHuman,
  wwRunner,
} from "./util";

withTestPolitics();

const GBR_ITA: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "ITA" },
];

/** Britain at war with Italy on the first clear day over Central Waters from 1936-06-01. */
async function seaWar() {
  const runner = await wwRunner({}, GBR_ITA, SEA.map);
  const g = runner.game;
  const ww = g.worldWar()!;
  const sc = ww.scenario;
  expect(sc.zoneCenter(ZONE.middle)).toBe(sc.sr(SR.central)!.center);
  let day = dayOfDate("1936-06-01");
  while (
    weatherAt(
      day,
      sc.zoneLatC(ZONE.middle),
      "plains",
      sc.zoneWcell(ZONE.middle),
    ) !== "clear"
  ) {
    day++;
  }
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "ITA").id() }),
  ]);
  const gbr = byTag(g, "GBR").smallID();
  const ita = byTag(g, "ITA").smallID();
  expect(ww.land.isEnemy(gbr, ita)).toBe(true);
  // Our superiority over the zone (A1's state): every sortie flies.
  ww.air.setAirSup(SR.central, new Map([[ww.land.sideOf(gbr), 1000]]));
  // An Italian battleship and two destroyers (1922 models) in Rome.
  const fleet = ww.navy.createFleet(ita, REGION.rome, [
    ["bb", 1, 1],
    ["dd", 1, 2],
  ]);
  return { g, ww, navy: ww.navy, air: ww.air, gbr, ita, fleet };
}

/** 100 British naval bombers (1936) from London on `mission` over Central Waters. */
function deployNavalBombers(
  g: Game,
  mission: "naval_strike" | "port_strike",
): Deployment {
  const ww = g.worldWar()!;
  const gbr = byTag(g, "GBR").smallID();
  const ce = ww.economy.country(gbr)!;
  ce.stock[equipKey("naval_bomber", 1)] = 100;
  return ww.air.addDeployment({
    owner: gbr,
    sr: SR.central,
    type: AIR_TYPES.indexOf("naval_bomber"),
    mission: AIR_MISSIONS.indexOf(mission),
    counts: drawPlanes(ce, "naval_bomber", 100),
    target: 100,
    base: REGION.london,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

/** Each ship's HP and org now, by ship id. */
function shipState(g: Game, ids: readonly number[]): [number, number][] {
  const t = g.worldWar()!.navy.ships;
  return ids.map((id) => {
    const r = t.rowOf(id);
    return r < 0 ? [0, 0] : [t.hp[r], t.org[r]];
  });
}

/**
 * What the strike should do to [bb, dd, dd] at full HP: half of 1,200
 * attack points on the battleship (the most visible), half by visibility
 * (30 : 12 : 12), each capped at what the ship has left.
 */
function expectedDamage(
  g: Game,
  ids: readonly number[],
  hitPm: number,
): number[] {
  const navy = g.worldWar()!.navy;
  const stats = ids.map((id) => navy.shipStatsOf(navy.ships.rowOf(id)));
  const attack = 100 * 1200;
  const half = attack / 2;
  const dmg = stats.map(() => 0);
  dmg[0] = Math.min(
    stats[0].hpMilli,
    shotDamageMilli(
      half,
      0,
      hitPm,
      visFactorPm(stats[0].vis, false),
      1000,
      1000,
      1000,
    ),
  );
  const shares = apportion(
    1000,
    stats.map((s) => s.vis),
  );
  stats.forEach((s, i) => {
    const room = s.hpMilli - dmg[i];
    dmg[i] += Math.min(
      room,
      shotDamageMilli(
        attack - half,
        0,
        hitPm,
        visFactorPm(s.vis, false),
        1000,
        1000,
        shares[i],
      ),
    );
  });
  return dmg;
}

describe("World War 1936 P4: naval and port strikes (spec §14.9)", () => {
  test("naval bombers hit a spotted fleet; half focused on the most visible ship", async () => {
    const { g, ww, navy, air, gbr, fleet } = await seaWar();
    const f = navy.fleets.get(fleet)!;
    f.docked = 0;
    expect(navy.fleetZoneSr(f)).toBe(SR.central);
    navy.setSpotPm(SR.central, ww.land.sideOf(gbr), fleet, WW_SPOT_FULL_PM);
    // London → Central Waters 200 km, range 800: every sortie flies.
    expect(rangeEffPm(ww.scenario.srKm(REGION.london, SR.central), 800)).toBe(
      1000,
    );
    const d = deployNavalBombers(g, "naval_strike");
    const ids = [...f.ships];
    const stats = ids.map((id) => navy.shipStatsOf(navy.ships.rowOf(id)));
    expect(stats.map((s) => s.vis)).toEqual([30, 12, 12]);
    const before = shipState(g, ids);
    const want = expectedDamage(g, ids, WW_NAVAL_STRIKE_HIT_PM);
    // The battleship takes the focused half and its share of the rest.
    expect(want).toEqual([90_000 + 50_040, 7_992, 7_992]);
    airMissionEffects(air, SR.central, ww.land.day());
    const after = shipState(g, ids);
    ids.forEach((_, i) => {
      expect(before[i][0] - after[i][0]).toBe(want[i]);
      expect(before[i][1] - after[i][1]).toBe(
        Math.min(
          before[i][1],
          orgDamageMilli(want[i], stats[i].orgMilli, stats[i].hpMilli),
        ),
      );
    });
    const z = air.zoneState[ww.scenario.srIdxOf(SR.central)];
    expect(z.result.get(gbr)?.[4]).toBe(want[0] + want[1] + want[2]);
    // The fleet's anti-air: (8 + 3 + 3) × 0.3 = 4.2 planes a day.
    expect(d.counts).toEqual([96, 0, 0]);
    expect(d.lossRest).toBe(200);
    expect(air.planesLostTotal).toBe(4);
  }, 60_000);

  test("unspotted fleets are safe", async () => {
    const { g, ww, navy, air, fleet } = await seaWar();
    const f = navy.fleets.get(fleet)!;
    f.docked = 0;
    const d = deployNavalBombers(g, "naval_strike");
    const ids = [...f.ships];
    const before = shipState(g, ids);
    airMissionEffects(air, SR.central, ww.land.day());
    expect(shipState(g, ids)).toEqual(before);
    expect(d.counts).toEqual([100, 0, 0]);
    expect(d.lossRest).toBe(0);
    // A docked fleet is no naval strike's target either (that is a port strike).
    f.docked = REGION.rome;
    navy.setSpotPm(
      SR.central,
      ww.land.sideOf(byTag(g, "GBR").smallID()),
      fleet,
      WW_SPOT_FULL_PM,
    );
    airMissionEffects(air, SR.central, ww.land.day());
    expect(shipState(g, ids)).toEqual(before);
  }, 60_000);

  test("a port strike hits docked ships at 150‰", async () => {
    const { g, ww, navy, air, gbr, fleet } = await seaWar();
    const f = navy.fleets.get(fleet)!;
    expect(f.docked).toBe(REGION.rome);
    expect(ww.scenario.harborOf(REGION.rome)).toBe(ZONE.middle);
    const d = deployNavalBombers(g, "port_strike");
    const ids = [...f.ships];
    const before = shipState(g, ids);
    const want = expectedDamage(g, ids, WW_PORT_STRIKE_HIT_PM);
    // 135 HP focused and the rest of its 150 from the spread: sunk.
    expect(want[0]).toBe(150_000);
    airMissionEffects(air, SR.central, ww.land.day());
    const after = shipState(g, ids);
    expect(navy.ships.rowOf(ids[0])).toBe(-1);
    expect(before[1][0] - after[1][0]).toBe(want[1]);
    expect(before[2][0] - after[2][0]).toBe(want[2]);
    expect(want[1]).toBe(11_988);
    const day = ww.land.day();
    expect(air.country(gbr)!.tally[3][day % 30]).toBe(1);
    // Docked ships' anti-air (× 0.5) and Rome's guns (none): 7 planes.
    expect(d.counts).toEqual([93, 0, 0]);
    expect(d.lossRest).toBe(0);
  }, 60_000);
});
