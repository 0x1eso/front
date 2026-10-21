// World War 1936 P4 (plan Task 1 Step 25): convoy formulas (spec §10).
import type { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  aswDamageMilli,
  convoyLossRatePm,
  convoysForSupply,
  convoysForTrade,
  convoySinkMilli,
  divisionConvoys,
  escortCutPm,
  interceptLossPm,
  raidPowerCenti,
  routeEffPm,
  seaHubCapacity,
} from "@openfront/engine-lib/ww1936/ConvoyRules";
import { emptyStats, techStats } from "@openfront/engine-lib/ww1936/Stats";
import { techTotals } from "@openfront/engine-lib/ww1936/WwTechs";

const Z = emptyStats();
const none = new Set<never>();
/** The stats a doctrine tech feeds (its bonuses are stat keys: P6 pre-flight). */
const doc = (...ids: WwTechId[]) => techStats(techTotals(new Set(ids)));

describe("convoy rules", () => {
  it("convoys needed", () => {
    expect(convoysForTrade(16, 8000)).toBe(26);
    // Spec §10.3: Italy → Tripoli.
    expect(convoysForSupply(24_000, 900)).toBe(44);
    expect(divisionConvoys(450)).toBe(9);
    expect(divisionConvoys(600)).toBe(12);
  });

  it("sea-hub capacity and route efficiency", () => {
    expect(seaHubCapacity(6, 1000, 900, 1000)).toBe(16_000);
    expect(seaHubCapacity(6, 10, 900, 1000)).toBe(5555);
    expect(seaHubCapacity(6, 10, 900, 500)).toBe(2777);
    expect(routeEffPm([1000])).toBe(500);
    expect(routeEffPm([])).toBe(1000);
    expect(routeEffPm([200, 600])).toBe(700);
  });

  it("losses, escorts and anti-submarine warfare", () => {
    expect(convoyLossRatePm(75_000, 0, 90)).toBe(30);
    expect(convoyLossRatePm(75_000, 125_000, 90)).toBe(11);
    expect(convoySinkMilli(300, 75_000, 0, 90)).toBe(9000);
    expect(convoySinkMilli(300, 75_000, 125_000, 90)).toBe(3375);
    expect(escortCutPm(5, 0)).toBe(0);
    expect(escortCutPm(1, 1_000_000)).toBe(850);
    // Task 15: WW_ASW_K_PM 10 (was 20).
    expect(aswDamageMilli(125_000, 1000)).toBe(12_500);
    expect(aswDamageMilli(125_000, 400)).toBe(5_000);
    expect(interceptLossPm(0, 1)).toBe(100);
    expect(interceptLossPm(250, 1)).toBe(50);
    expect(interceptLossPm(500, 1)).toBe(0);
    expect(interceptLossPm(0, 0)).toBe(0);
  });

  it("raid power", () => {
    expect(raidPowerCenti(75_000, 0, 0, Z, none, 1000)).toBe(75_000);
    // The doctrine's raid bonus is its convoyRaidPct, counted once.
    const ti1 = doc("trade_interdiction_1");
    expect(raidPowerCenti(75_000, 0, 0, ti1, none, 1000)).toBe(86_250);
    expect(raidPowerCenti(75_000, 0, 0, Z, none, 500)).toBe(37_500);
    expect(raidPowerCenti(0, 10_000, 0, Z, none, 1000)).toBe(5000);
    // trade_interdiction_2 alone: surface ×1.5, convoy raid +15%.
    const ti2 = doc("trade_interdiction_2");
    expect(raidPowerCenti(0, 10_000, 0, ti2, none, 1000)).toBe(8625);
    const ti2Only = { ...Z, surfaceRaidPct: 50 };
    expect(raidPowerCenti(0, 10_000, 0, ti2Only, none, 1000)).toBe(7500);
  });
});
