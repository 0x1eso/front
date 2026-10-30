// World War 1936 P4 (plan Task 8 Step 7): strategic bombing (P4 spec
// §14.8) on ww1936sea. Britain and Germany are humans at war; British
// strategic bombers fly from London over the land zone West (1) on a clear
// day there, with Munich and Rome handed to Britain so Berlin is the only
// enemy region of the zone. The zone's day is called directly (airMissionEffects).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  BuildingId,
  equipKey,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  bombDamageMilli,
  rangeEffPm,
} from "@openfront/engine-lib/ww1936/AirRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { weatherAt } from "@openfront/engine-lib/ww1936/Weather";
import type { Game } from "@openfront/engine/game/Game";
import { airMissionEffects } from "@openfront/engine/ww1936/air/AirEffects";
import {
  bombableRegions,
  bombFatigueBp,
} from "@openfront/engine/ww1936/air/Bombing";
import {
  damageOf,
  drawPlanes,
  effectiveBuildings,
} from "@openfront/engine/ww1936/economy/Buildings";
import { computeStability } from "@openfront/engine/ww1936/politics/Stability";
import { vi } from "vitest";
import { REGION, SEA, SR } from "./seaFixture";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  WwHuman,
  wwRunnerCapture,
} from "./util";

withTestPolitics();

const GBR_DEU: WwHuman[] = [
  { clientID: HUMAN, country: "GBR" },
  { clientID: "HUMAN002", country: "DEU" },
];
const STRAT = AIR_TYPES.indexOf("strat_bomber");
const M_STRAT = AIR_MISSIONS.indexOf("strategic_bombing");
/** The buildings the bombing weighs (spec §14.8). */
const BOMBED: readonly BuildingId[] = [
  "civ",
  "mil",
  "dock",
  "infra",
  "naval_base",
  "air_base",
  "anti_air",
  "radar",
  "synthetic_refinery",
];

/** Britain at war with Germany on the first clear day in the zone West from 1936-06-01; Munich and Rome British. */
async function bombingWar() {
  const { runner, updates } = await wwRunnerCapture({}, GBR_DEU, SEA.map);
  const g = runner.game;
  const ww = g.worldWar()!;
  const sc = ww.scenario;
  // The zone West's center region is Munich.
  expect(sc.regionAt(sc.sr(SR.westLand)!.center)).toBe(REGION.munich);
  let day = dayOfDate("1936-06-01");
  while (
    weatherAt(
      day,
      sc.latC(REGION.munich),
      sc.landOf(REGION.munich),
      sc.wcell(REGION.munich),
    ) !== "clear"
  ) {
    day++;
  }
  stepTo(runner, dayStartTick(day, WW_PREP_TICKS));
  step(runner, 2, [
    stamped(HUMAN, { type: "declare_war", target: byTag(g, "DEU").id() }),
  ]);
  const gbr = byTag(g, "GBR").smallID();
  const deu = byTag(g, "DEU").smallID();
  expect(ww.land.isEnemy(gbr, deu)).toBe(true);
  // Italy fights on Germany's side: Munich and Rome go to Britain, so
  // Berlin is the zone's only enemy region.
  takeRegion(g, REGION.munich, "GBR");
  takeRegion(g, REGION.rome, "GBR");
  expect(bombableRegions(ww.air, SR.westLand)).toEqual([1, 2, 3, 4, 5, 10]);
  // Our superiority over the zone (A1's state): every sortie flies.
  ww.air.setAirSup(SR.westLand, new Map([[ww.land.sideOf(gbr), 1000]]));
  return { runner, updates, g, ww, air: ww.air, gbr, deu };
}

/** `n` British strategic bombers (1936) bombing the zone West from London. */
function deployBombers(g: Game, n: number): void {
  const ww = g.worldWar()!;
  const gbr = byTag(g, "GBR").smallID();
  const ce = ww.economy.country(gbr)!;
  ce.stock[equipKey("strat_bomber", 1)] = n;
  ww.air.addDeployment({
    owner: gbr,
    sr: SR.westLand,
    type: STRAT,
    mission: M_STRAT,
    counts: drawPlanes(ce, "strat_bomber", n),
    target: n,
    base: REGION.london,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

function berlinWorking(g: Game): number {
  const econ = g.worldWar()!.economy;
  return BOMBED.reduce(
    (s, b) => s + effectiveBuildings(econ, REGION.berlin, b),
    0,
  );
}

function berlinDamage(g: Game): number {
  const econ = g.worldWar()!.economy;
  return BOMBED.reduce((s, b) => s + damageOf(econ, REGION.berlin, b), 0);
}

describe("World War 1936 P4: strategic bombing (spec §14.8)", () => {
  test("4,000 bomb points stop one building", async () => {
    const { runner, updates, g, ww, air, gbr, deu } = await bombingWar();
    // London → the zone's center within the bombers' range: every sortie.
    expect(rangeEffPm(ww.scenario.srKm(REGION.london, SR.westLand), 1500)).toBe(
      1000,
    );
    expect(ww.economy.country(gbr)!.fuelRatioPm).toBe(1000);
    // 295 sorties × 12 × 113% = 4,000.2 points.
    ww.economy.country(gbr)!.stats.stratBombPct = 13;
    deployBombers(g, 295);
    const taken = ww.economy.country(deu)!.stats.bombDamageTakenPct;
    expect(taken).toBe(0);
    const working = berlinWorking(g);
    const day = ww.land.day();
    airMissionEffects(air, SR.westLand, day);
    expect(bombDamageMilli(4000, 0, taken)).toBe(1000);
    expect(berlinDamage(g)).toBe(1000);
    // One whole building: the first of the heaviest (civilian factories).
    expect(berlinWorking(g)).toBe(working - 1);
    expect(effectiveBuildings(ww.economy, REGION.berlin, "civ")).toBe(4);
    expect(air.bombPointsTotal).toBe(4000);
    expect(air.country(deu)!.bombTaken[day % 30]).toBe(4000);
    expect(air.country(gbr)!.tally[2][day % 30]).toBe(4000);
    const z = air.zoneState[ww.scenario.srIdxOf(SR.westLand)];
    expect(z.result.get(gbr)?.[3]).toBe(4000);
    // Nobody else's region was touched.
    for (const r of [1, 2, 4, 5, 10]) {
      expect(BOMBED.every((b) => damageOf(ww.economy, r, b) === 0)).toBe(true);
    }
    // The victim hears it (the day's flush): Britain bombed Berlin, one factory.
    const say = vi.spyOn(air, "message");
    air.raids.flush(air, day);
    expect(say.mock.calls).toEqual([
      [
        deu,
        "events_display.ww1936_air_raid",
        {
          attacker: gbr,
          others: 0,
          region: REGION.berlin,
          more: 0,
          kind: 1,
          f: 1,
          s: 0,
        },
      ],
    ]);
    step(runner);
    // The victim's screens hatch Berlin: its air detail lists the region
    // with the damage outstanding.
    const details = updates
      .flatMap((u) => u.updates[GameUpdateType.WwAir] ?? [])
      .flatMap((x) => x.data.details)
      .filter((d) => d.smallID === deu);
    const detail = details[details.length - 1];
    expect(detail.bombedRegions).toEqual([[REGION.berlin, 1000]]);
  }, 60_000);

  test("AA cuts at most 40%", async () => {
    const { g, ww, air, deu } = await bombingWar();
    // Five levels of anti-air: 5 × 8% = 40%, the cap (a sixth would not cut more).
    ww.economy.addBuilding(REGION.berlin, "anti_air", 5);
    expect(bombDamageMilli(4000, 5, 0)).toBe(600);
    expect(bombDamageMilli(4000, 6, 0)).toBe(600);
    // 500 sorties × 12 = 6,000 points.
    deployBombers(g, 500);
    const day = ww.land.day();
    airMissionEffects(air, SR.westLand, day);
    expect(berlinDamage(g)).toBe(bombDamageMilli(6000, 5, 0));
    expect(berlinDamage(g)).toBe(900);
    // The war support ring counts the points after anti-air.
    expect(air.country(deu)!.bombTaken[day % 30]).toBe(3600);
  }, 60_000);

  test("damage never exceeds the buildings", async () => {
    const { g, ww, air } = await bombingWar();
    deployBombers(g, 5000);
    const day = ww.land.day();
    airMissionEffects(air, SR.westLand, day);
    airMissionEffects(air, SR.westLand, day);
    const econ = ww.economy;
    for (const b of BOMBED) {
      const count = econ.buildingArray(b)[REGION.berlin];
      expect(damageOf(econ, REGION.berlin, b)).toBe(count * 1000);
      expect(effectiveBuildings(econ, REGION.berlin, b)).toBe(0);
    }
    expect(berlinWorking(g)).toBe(0);
  }, 60_000);

  test("bombing fatigue lowers war support", async () => {
    const { g, ww, air, deu } = await bombingWar();
    const before = computeStability(ww.politics, deu).wsBp;
    expect(bombFatigueBp(air, deu)).toBe(0);
    // 500 sorties × 12 = 6,000 points, no anti-air: −6,000 / 400 = −15 bp.
    deployBombers(g, 500);
    airMissionEffects(air, SR.westLand, ww.land.day());
    expect(bombFatigueBp(air, deu)).toBe(-15);
    expect(computeStability(ww.politics, deu).wsBp).toBe(before - 15);
    // At most −15%.
    air.country(deu)!.bombTaken.fill(100_000);
    expect(bombFatigueBp(air, deu)).toBe(-1500);
  }, 60_000);

  test("air-raid notices: aggregated, throttled, humans only", async () => {
    const { g, ww, air, gbr, deu } = await bombingWar();
    const say = vi.spyOn(air, "message");
    const fra = byTag(g, "FRA").smallID();
    // Two regions hit on one day: one notice, the heavier region first.
    air.raids.note(air, deu, gbr, REGION.berlin, 2, 0, 2000);
    air.raids.note(air, deu, gbr, REGION.munich, 1, 0, 1000);
    // An AI victim gets nothing, and keeps nothing.
    air.raids.note(air, fra, gbr, REGION.berlin, 3, 0, 3000);
    air.raids.flush(air, 100);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][0]).toBe(deu);
    expect(say.mock.calls[0][2]).toMatchObject({
      attacker: gbr,
      region: REGION.berlin,
      more: 1,
      f: 3,
      kind: 1,
    });
    // The same attacker on days 101 and 102: nothing; day 103: the totals since.
    for (const day of [101, 102]) {
      air.raids.note(air, deu, gbr, REGION.berlin, 1, 0, 1000);
      air.raids.flush(air, day);
    }
    expect(say).toHaveBeenCalledTimes(1);
    air.raids.note(air, deu, gbr, REGION.berlin, 1, 0, 1000);
    air.raids.flush(air, 103);
    expect(say).toHaveBeenCalledTimes(2);
    expect(say.mock.calls[1][2]).toMatchObject({ f: 3, more: 0 });
    // Ships damaged by a port strike read the same way.
    air.raids.note(air, deu, gbr, REGION.berlin, 0, 2, 500);
    air.raids.flush(air, 106);
    expect(say.mock.calls[2][2]).toMatchObject({ kind: 2, s: 2 });
    expect(ww.isHumanControlled(fra)).toBe(false);
  }, 60_000);
});
