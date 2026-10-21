// World War 1936 P4 (plan Task 9 Step 8, plan decision 37): the land
// war's fuel ledger (P4 spec §15.3) on the test map ww1936sea, Germany
// played by a human (its 1936 armored template: 4 light tanks, 2
// motorized, 1 motorized artillery).
import { MOVE_RAIL, MOVE_WALK } from "@openfront/engine-api/ww1936/LandTypes";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  LAND_FUEL_PER_HOUR_MILLI,
  landFuelTickMilli,
} from "@openfront/engine-lib/ww1936/FuelRules";
import { noteLandFuel } from "@openfront/engine/ww1936/land/LandFuel";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import {
  clearLand,
  HUMAN,
  land,
  placeArmy,
  step,
  stepTo,
  withTestPolitics,
  wwRunner,
} from "./util";

withTestPolitics();

const DEU = TAG_ID.DEU;
const ARMORED = 2;

describe("World War 1936 P4: the land fuel ledger (spec §15.3)", () => {
  test("moving motorized battalions write the ledger; rail does not", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      SEA.map,
    );
    const g = runner.game;
    const l = land(g);
    const ce = l.econ.country(DEU)!;
    // The preparation minute burns nothing.
    step(runner, 5);
    clearLand(g);
    const tanks = placeArmy(g, "DEU", REGION.berlin, 2, ARMORED);
    expect(
      l.issue(DEU, {
        kind: "army_move",
        army: tanks.id,
        region: REGION.munich,
      }),
    ).toBeNull();
    step(runner);
    const r0 = l.divisions.rowOf(tanks.divisions[0]);
    expect(l.divisions.mode[r0]).toBe(MOVE_WALK);
    let before = ce.fuelLedgerMilli;
    noteLandFuel(l, g.ticks());
    expect(ce.fuelLedgerMilli).toBe(before);

    stepTo(runner, WW_PREP_TICKS + 1);
    clearLand(g);
    const a = placeArmy(g, "DEU", REGION.berlin, 2, ARMORED);
    const b = placeArmy(g, "DEU", REGION.berlin, 1, 1);
    // 4 × 250 + 2 × 125 + 125 = 1,375 milli an hour → 2,514 a tick.
    const r = l.divisions.rowOf(a.divisions[0]);
    const hour = l.baseStatsOf(r).fuelHourMilli;
    expect(hour).toBe(
      4 * LAND_FUEL_PER_HOUR_MILLI.light_armor! +
        2 * LAND_FUEL_PER_HOUR_MILLI.motorized! +
        LAND_FUEL_PER_HOUR_MILLI.mot_artillery!,
    );
    const tick = landFuelTickMilli(hour);
    expect(tick).toBe(2514);
    // Standing still: nothing.
    before = ce.fuelLedgerMilli;
    noteLandFuel(l, g.ticks());
    expect(ce.fuelLedgerMilli).toBe(before);
    // Walking: both armored divisions; the infantry walking beside them
    // has no fuel battalion.
    for (const army of [a, b]) {
      expect(
        l.issue(DEU, {
          kind: "army_move",
          army: army.id,
          region: REGION.munich,
        }),
      ).toBeNull();
    }
    step(runner);
    expect(l.divisions.mode[l.divisions.rowOf(a.divisions[0])]).toBe(MOVE_WALK);
    before = ce.fuelLedgerMilli;
    const kinds = [...ce.fuelLedgerKinds];
    noteLandFuel(l, g.ticks());
    expect(ce.fuelLedgerMilli).toBe(before + 2 * tick);
    expect(ce.fuelLedgerKinds).toEqual([
      kinds[0] + 2 * tick,
      kinds[1],
      kinds[2],
    ]);
    // The game's own tick writes the same (on a tick that is not
    // Germany's economy turn, which would settle the ledger first).
    const ww = g.worldWar()!;
    const k = () => g.ticks() - dayStartTick(ww.day(g.ticks()), WW_PREP_TICKS);
    if (k() === DEU % 7) step(runner);
    before = ce.fuelLedgerMilli;
    step(runner);
    for (const id of a.divisions) {
      expect(l.divisions.mode[l.divisions.rowOf(id)]).toBe(MOVE_WALK);
    }
    expect(ce.fuelLedgerMilli).toBe(before + 2 * tick);
    // In a battle (front line or reserve) it burns too, standing still.
    clearLand(g);
    const c = placeArmy(g, "DEU", REGION.berlin, 1, ARMORED);
    const rc = l.divisions.rowOf(c.divisions[0]);
    l.divisions.battle[rc] = REGION.warsaw;
    before = ce.fuelLedgerMilli;
    noteLandFuel(l, g.ticks());
    expect(ce.fuelLedgerMilli).toBe(before + tick);
    l.divisions.battle[rc] = 0;
    // By rail: nothing.
    expect(
      l.issue(DEU, { kind: "army_rail", army: c.id, region: REGION.munich }),
    ).toBeNull();
    step(runner);
    expect(l.divisions.mode[l.divisions.rowOf(c.divisions[0])]).toBe(MOVE_RAIL);
    before = ce.fuelLedgerMilli;
    noteLandFuel(l, g.ticks());
    expect(ce.fuelLedgerMilli).toBe(before);
  });
});
