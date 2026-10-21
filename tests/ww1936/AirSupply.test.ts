// World War 1936 P4 (plan Task 8 Step 7): air supply (P4 spec §14.10) on
// ww1936sea. Germany and Poland are humans at war from 1936-06-01 (a
// clear day in Krakow, the zone East's center). German divisions hold
// Kiev, cut off (its naval base wrecked, so no sea hub), and Warsaw, next
// to Berlin but short of supply (heavy users: supplyUsePct +400). German transports fly from Berlin. The
// zone's day is called directly, then P2's supply day of the side.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  equipKey,
  EQUIPMENT_TYPES,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { rangeEffPm } from "@openfront/engine-lib/ww1936/AirRules";
import { dayOfDate, dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game } from "@openfront/engine/game/Game";
import {
  airMissionEffects,
  airSupplyAt,
} from "@openfront/engine/ww1936/air/AirEffects";
import {
  damageBuilding,
  drawPlanes,
} from "@openfront/engine/ww1936/economy/Buildings";
import { dailySupply } from "@openfront/engine/ww1936/land/Supply";
import { REGION, SEA, SR } from "./seaFixture";
import {
  byTag,
  clearLand,
  dropPact,
  HUMAN,
  land,
  placeArmy,
  stamped,
  step,
  stepTo,
  takeRegion,
  withTestPolitics,
  WwHuman,
  wwRunner,
} from "./util";

withTestPolitics();

const DEU_POL: WwHuman[] = [
  { clientID: HUMAN, country: "DEU" },
  { clientID: "HUMAN002", country: "POL" },
];
const JUNE_1 = dayOfDate("1936-06-01");

function stockUp(g: Game): void {
  const ce = land(g).econ.country(byTag(g, "DEU").smallID())!;
  for (const t of EQUIPMENT_TYPES) ce.stock[equipKey(t, 1)] += 100_000;
  ce.manpower += 1_000_000;
}

/** `n` German transports on air supply over the zone East from Berlin. */
function deployTransports(g: Game, n: number): void {
  const ww = g.worldWar()!;
  const deu = byTag(g, "DEU").smallID();
  const ce = ww.economy.country(deu)!;
  ce.stock[equipKey("transport_plane", 1)] = n;
  ww.air.addDeployment({
    owner: deu,
    sr: SR.eastLand,
    type: AIR_TYPES.indexOf("transport_plane"),
    mission: AIR_MISSIONS.indexOf("air_supply"),
    counts: drawPlanes(ce, "transport_plane", n),
    target: n,
    base: REGION.berlin,
    lossRest: 0,
    auto: false,
    volunteerFor: 0,
  });
}

describe("World War 1936 P4: air supply (spec §14.10)", () => {
  test("100 transports give 2.0 supply to an encircled region first", async () => {
    const runner = await wwRunner({}, DEU_POL, SEA.map);
    const g = runner.game;
    dropPact(g, "DEU", "POL");
    stepTo(runner, dayStartTick(JUNE_1, WW_PREP_TICKS));
    step(runner, 2, [
      stamped(HUMAN, { type: "declare_war", target: byTag(g, "POL").id() }),
    ]);
    clearLand(g);
    stockUp(g);
    const ww = g.worldWar()!;
    const l = ww.land;
    const air = ww.air;
    const deu = byTag(g, "DEU").smallID();
    const side = l.sideOf(deu);
    expect(l.weatherOn(REGION.krakow, l.day())).toBe("clear");
    // Kiev German and cut off (no port left); Warsaw German, next to Berlin.
    takeRegion(g, REGION.kiev, "DEU");
    takeRegion(g, REGION.warsaw, "DEU");
    damageBuilding(ww.economy, REGION.kiev, "naval_base", 2000);
    // Heavy users (× 5 supply): one division in Kiev, 24 in Warsaw.
    ww.economy.country(deu)!.stats.supplyUsePct = 400;
    placeArmy(g, "DEU", REGION.kiev, 1);
    placeArmy(g, "DEU", REGION.warsaw, 12);
    placeArmy(g, "DEU", REGION.warsaw, 12);
    dailySupply(l, side);
    expect(l.encircled[REGION.kiev]).toBe(1);
    expect(l.encircled[REGION.warsaw]).toBe(0);
    expect(l.supplyMilli[REGION.kiev]).toBe(0);
    const kievUse = l.useMilli[REGION.kiev];
    expect(kievUse).toBeGreaterThan(2000);
    expect(kievUse).toBeLessThan(8000);
    // Warsaw is short as well, but holds more of what it needs.
    expect(l.supplyMilli[REGION.warsaw]).toBeLessThan(
      l.useMilli[REGION.warsaw],
    );
    // 100 transports, every sortie flying: 100 × 0.02 = 2.0 a day.
    expect(rangeEffPm(ww.scenario.srKm(REGION.berlin, SR.eastLand), 1100)).toBe(
      1000,
    );
    air.setAirSup(SR.eastLand, new Map([[side, 1000]]));
    deployTransports(g, 100);
    airMissionEffects(air, SR.eastLand, l.day());
    expect(airSupplyAt(air, REGION.kiev, side)).toBe(2000);
    expect(airSupplyAt(air, REGION.warsaw, side)).toBe(0);
    expect(
      airSupplyAt(air, REGION.kiev, l.sideOf(byTag(g, "POL").smallID())),
    ).toBe(0);
    // P2's supply day adds it: the region stays encircled, now with 2.0.
    dailySupply(l, side);
    expect(l.encircled[REGION.kiev]).toBe(1);
    expect(l.supplyMilli[REGION.kiev]).toBe(2000);
    // With 400 transports Kiev gets what it lacks, Warsaw the rest.
    const z = air.zoneState[ww.scenario.srIdxOf(SR.eastLand)];
    expect(z.airSupply).toEqual([[REGION.kiev, side, 2000]]);
    for (const id of [...air.deploymentsIn(SR.eastLand)]) {
      air.removeDeployment(id, true);
    }
    deployTransports(g, 400);
    const warsawShort =
      l.useMilli[REGION.warsaw] - l.supplyMilli[REGION.warsaw];
    airMissionEffects(air, SR.eastLand, l.day());
    expect(airSupplyAt(air, REGION.kiev, side)).toBe(kievUse);
    expect(airSupplyAt(air, REGION.warsaw, side)).toBe(
      Math.min(warsawShort, 8000 - kievUse),
    );
    expect(airSupplyAt(air, REGION.warsaw, side)).toBeGreaterThan(0);
  }, 60_000);
});
