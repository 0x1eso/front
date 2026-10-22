// World War 1936 P4 (plan Task 9 Step 8): fuel (P4 spec §15) on the test
// map ww1936sea, the Soviet Union played by a human (Kiev's oil, a
// level-2 naval base at Kiev).
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import {
  fleetFuelSpeedPm,
  fuelCap,
  fuelCombatBp,
  fuelGain,
  landFuelSpeedPm,
} from "@openfront/engine-lib/ww1936/FuelRules";
import type { GameRunner } from "@openfront/engine/GameRunner";
import {
  fleetFuelDay,
  fuelCapOf,
  noteFleetFuel,
  noteFuelUse,
} from "@openfront/engine/ww1936/economy/Fuel";
import type { CountryEconomy } from "@openfront/engine/ww1936/economy/WwEconomy";
import { stepFleets } from "@openfront/engine/ww1936/navy/SeaMove";
import { REGION, SEA, TAG_ID } from "./seaFixture";
import { HUMAN, land, stepTo, withTestPolitics, wwRunnerCapture } from "./util";

withTestPolitics();

const SUN = TAG_ID.SUN;

async function soviets() {
  const { runner, updates } = await wwRunnerCapture(
    {},
    [{ clientID: HUMAN, country: "SUN" }],
    SEA.map,
  );
  const ww = runner.game.worldWar()!;
  return { runner, updates, ww, ce: ww.economy.country(SUN)! };
}

/** The tick of the Soviet economy turn of day `d`. */
function turnTick(d: number): number {
  return dayStartTick(d, WW_PREP_TICKS) + (SUN % 7);
}

function oilOf(ce: CountryEconomy): number {
  const t = ce.totals;
  return Math.max(0, t.produced[0] - t.exported[0] + t.imported[0]);
}

function settleAt(runner: GameRunner, d: number): void {
  stepTo(runner, turnTick(d) + 1);
}

describe("World War 1936 P4: fuel (spec §15)", () => {
  test("fuel gain, cap and settlement", async () => {
    const { runner, ww, ce } = await soviets();
    stepTo(runner, turnTick(0));
    // Kiev's oil: 8 at infrastructure 3.
    expect(oilOf(ce)).toBeGreaterThan(0);
    const before = ce.fuelMilli;
    noteFuelUse(ce, 3000, 0);
    noteFuelUse(ce, 2000, 1);
    noteFuelUse(ce, 1000, 2);
    const need = ce.fuelLedgerMilli;
    expect(ce.fuelLedgerKinds).toEqual([3000, 2000, 1000]);
    settleAt(runner, 0);
    const gain = fuelGain(oilOf(ce), ce.stats);
    const cap = fuelCapOf(ww.economy, ce);
    expect(cap).toBe(fuelCap(oilOf(ce), 0, ce.stats));
    expect(ce.fuelGainMilli).toBe(gain);
    expect(ce.fuelMilli).toBe(Math.min(cap, before + gain) - need);
    expect(ce.fuelRatioPm).toBe(1000);
    expect(ce.fuelUseMilli).toEqual([3000, 2000, 1000]);
    expect(ce.fuelLedgerMilli).toBe(0);
    expect(ce.fuelLedgerKinds).toEqual([0, 0, 0]);
    // What overflows the capacity is lost.
    ce.fuelMilli = cap + 50_000;
    settleAt(runner, 1);
    const used = ce.fuelUseMilli.reduce((a, b) => a + b, 0);
    expect(ce.fuelMilli).toBe(fuelCapOf(ww.economy, ce) - used);
    // A fuel silo raises it by 10,000 (at fuelCapPct).
    ww.economy.addBuilding(REGION.kiev, "fuel_silo", 1);
    expect(fuelCapOf(ww.economy, ce)).toBe(fuelCap(oilOf(ce), 1, ce.stats));
    expect(fuelCapOf(ww.economy, ce) - cap).toBe(
      Math.floor((10_000_000 * (100 + ce.stats.fuelCapPct)) / 100),
    );
  });

  test("synthetic refineries add oil after the infrastructure factor", async () => {
    const { runner, ww, ce } = await soviets();
    settleAt(runner, 0);
    const oil = ce.totals.produced[0];
    // P4 Task 15 (HOI4's Buna): as much rubber again.
    const RUBBER = 2;
    const rubber = ce.totals.produced[RUBBER];
    ww.economy.addBuilding(REGION.kiev, "synthetic_refinery", 2);
    settleAt(runner, 1);
    expect(ce.totals.produced[0]).toBe(oil + 2);
    expect(ce.totals.produced[RUBBER]).toBe(rubber + 2);
    ce.addTech("synthetic_oil_2");
    settleAt(runner, 2);
    expect(ce.totals.produced[0]).toBe(oil + 4);
    expect(ce.totals.produced[RUBBER]).toBe(rubber + 4);
    expect(ce.fuelGainMilli).toBe(fuelGain(oilOf(ce), ce.stats));
  });

  test("a shortage ratio slows tanks and fleets the next day", async () => {
    const { runner, updates, ww, ce } = await soviets();
    const navy = ww.navy;
    const f = navy.fleets.get(
      navy.createFleet(SUN, REGION.kiev, [["dd", 1, 2]]),
    )!;
    const full = navy.fleetSpeedCentiKn(f);
    expect(full).toBeGreaterThan(0);
    stepTo(runner, turnTick(1));
    // Twice what the stock can hold today: half of the need is covered.
    const have = Math.min(
      fuelCapOf(ww.economy, ce),
      ce.fuelMilli + fuelGain(oilOf(ce), ce.stats),
    );
    expect(have).toBeGreaterThan(0);
    noteFuelUse(ce, 2 * have - ce.fuelLedgerMilli, 0);
    expect(land(runner.game).hooks.fuelFactorPm(SUN)).toBe(1000);
    settleAt(runner, 1);
    expect(ce.fuelRatioPm).toBe(500);
    expect(ce.fuelMilli).toBe(0);
    // Read until the next settlement: fleets at 750‰, tanks at 650‰ and
    // a division half fuel battalions loses 1,250 bp.
    expect(fleetFuelSpeedPm(500)).toBe(750);
    expect(navy.fleetSpeedCentiKn(f)).toBe(Math.floor((full * 750) / 1000));
    expect(land(runner.game).hooks.fuelFactorPm(SUN)).toBe(500);
    expect(landFuelSpeedPm(500)).toBe(650);
    expect(fuelCombatBp(500, 500)).toBe(-1250);
    // The owner hears of it once in 30 days.
    const short = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
        .filter((m) => m.message === "events_display.ww1936_fuel_shortage");
    expect(short()).toHaveLength(1);
    expect(short()[0].params).toEqual({ pct: 50 });
    stepTo(runner, turnTick(2));
    noteFuelUse(ce, ce.fuelMilli + fuelGain(oilOf(ce), ce.stats) + 1000, 0);
    settleAt(runner, 2);
    expect(ce.fuelRatioPm).toBeLessThan(1000);
    expect(short()).toHaveLength(1);
    // Enough again: the next day runs at full speed.
    settleAt(runner, 3);
    expect(ce.fuelRatioPm).toBe(1000);
    expect(navy.fleetSpeedCentiKn(f)).toBe(full);
  });

  test("ships at sea write the navy's ledger", async () => {
    const { runner, ww, ce } = await soviets();
    const navy = ww.navy;
    const f = navy.fleets.get(
      navy.createFleet(SUN, REGION.kiev, [["dd", 1, 2]]),
    )!;
    const perDay = f.ships
      .map((id) => navy.shipStatsOf(navy.ships.rowOf(id)).fuelPerDayMilli)
      .reduce((a, b) => a + b, 0);
    expect(perDay).toBeGreaterThan(0);
    stepTo(runner, turnTick(3));
    const ledger = ce.fuelLedgerMilli;
    // Docked the whole time: nothing.
    noteFleetFuel(navy, SUN, 3);
    expect(ce.fuelLedgerMilli).toBe(ledger);
    // A tick at sea since the last turn (seaDay: this turn's day): a day
    // of fuel, at fuelUsePct.
    f.seaDay = 3;
    noteFleetFuel(navy, SUN, 3);
    const day = Math.floor((perDay * (100 + ce.stats.fuelUsePct)) / 100);
    expect(ce.fuelLedgerMilli).toBe(ledger + day);
    expect(ce.fuelLedgerKinds[1]).toBe(day);
    // Billed by yesterday's turn already.
    f.seaDay = 2;
    noteFleetFuel(navy, SUN, 3);
    expect(ce.fuelLedgerMilli).toBe(ledger + day);
  });

  // Task 15 (the T15 carry list): a trip that ends before the turn after
  // it used to be billed by both turns ("yesterday or today").
  test("a short trip across a turn is billed once", async () => {
    const { runner, ww, ce } = await soviets();
    const navy = ww.navy;
    const f = navy.fleets.get(
      navy.createFleet(SUN, REGION.kiev, [["dd", 1, 2]]),
    )!;
    const perDay = f.ships
      .map((id) => navy.shipStatsOf(navy.ships.rowOf(id)).fuelPerDayMilli)
      .reduce((a, b) => a + b, 0);
    const day = Math.floor((perDay * (100 + ce.stats.fuelUsePct)) / 100);
    // Ticks at sea before turn 3 bill turn 3; from turn 3 on, turn 4.
    expect(fleetFuelDay(navy, SUN, 3, turnTick(3) - 1)).toBe(3);
    expect(fleetFuelDay(navy, SUN, 3, turnTick(3))).toBe(4);
    stepTo(runner, turnTick(3) - 1);
    // Out for the tick before turn 3, docked again at the turn.
    f.docked = 0;
    stepFleets(navy, runner.game.ticks());
    expect(f.seaDay).toBe(3);
    f.docked = REGION.kiev;
    const billed: number[] = [];
    for (const d of [3, 4]) {
      stepTo(runner, turnTick(d));
      const before = ce.fuelLedgerKinds[1];
      noteFleetFuel(navy, SUN, d);
      billed.push(ce.fuelLedgerKinds[1] - before);
    }
    expect(billed).toEqual([day, 0]);
  });
});
