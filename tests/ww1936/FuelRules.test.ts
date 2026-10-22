// World War 1936 P4 (plan Task 1 Step 25): fuel (spec §15).
import {
  fleetFuelSpeedPm,
  fuelCap,
  fuelCombatBp,
  fuelGain,
  fuelRatioPm,
  landFuelSpeedPm,
  landFuelTickMilli,
  startFuelMilli,
} from "@openfront/engine-lib/ww1936/FuelRules";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";

const Z = emptyStats();

describe("fuel rules", () => {
  it("gain, capacity, ratio", () => {
    expect(fuelGain(15, Z)).toBe(360_000);
    expect(fuelCap(15, 0, Z)).toBe(57_500_000);
    // Spec §15.2: Japan with six silos.
    expect(fuelCap(1, 6, Z)).toBe(82_500_000);
    expect(fuelRatioPm(0, 0)).toBe(1000);
    expect(fuelRatioPm(500, 1000)).toBe(500);
    expect(startFuelMilli(360_000, 57_500_000)).toBe(32_400_000);
    // Task 15: at least half the capacity (an importer: Italy, no oil).
    expect(startFuelMilli(0, 20_000_000)).toBe(10_000_000);
    expect(startFuelMilli(72_000, 27_500_000)).toBe(13_750_000);
    expect(startFuelMilli(3_000_000, 100_000_000)).toBe(100_000_000);
  });

  it("the land, naval and combat factors", () => {
    expect(landFuelTickMilli(375)).toBe(685);
    expect(landFuelSpeedPm(0)).toBe(300);
    expect(landFuelSpeedPm(1000)).toBe(1000);
    expect(fleetFuelSpeedPm(0)).toBe(500);
    expect(fuelCombatBp(0, 1000)).toBe(-5000);
    expect(fuelCombatBp(500, 500)).toBe(-1250);
    expect(fuelCombatBp(1000, 1000)).toBe(0);
  });
});
