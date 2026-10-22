// World War 1936 P6 (spec §6, §7, §13, §16, plan Task 1 Step 21): MIOs,
// the market, energy, congress, balance of power, harbours, the helpers.
import {
  bytesOfHex,
  hexOf,
  P_ACE_DEATH,
  P_ACE_SPAWN,
  P_INTEL_CAPTURE,
  P_INTEL_INFIL,
  P_INTEL_OP,
  P_NUKE_INTERCEPT,
  P_RAID,
} from "@openfront/engine-lib/ww1936/DepthRules";
import {
  coalWanted,
  energyPenaltyPct,
  energyRatioPm,
  energySupply,
} from "@openfront/engine-lib/ww1936/EnergyRules";
import {
  marketCivs,
  marketDiscountPct,
  marketPriceMilli,
} from "@openfront/engine-lib/ww1936/MarketRules";
import {
  bopBand,
  congressStep,
  congressTargetBp,
} from "@openfront/engine-lib/ww1936/MechRules";
import {
  mioPoints,
  mioSize,
  mioStats,
  mioTraitBlock,
} from "@openfront/engine-lib/ww1936/MioRules";
import { harborLevelMilli } from "@openfront/engine-lib/ww1936/WorldRules";

describe("depth rules", () => {
  it("MIO size thresholds", () => {
    expect(mioSize(599_999)).toBe(0);
    expect(mioSize(600_000)).toBe(1);
    expect(mioSize(33_000_000)).toBe(10);
    expect(mioPoints(3, 0b1, 0)).toBe(3);
    expect(mioPoints(3, 0b11, 0)).toBe(2);
  });

  it("MIO traits: rows need the row above; p3 and q3 exclude each other", () => {
    expect(mioTraitBlock(0, 1, 2)).toBe("prereq");
    expect(mioTraitBlock(0b1, 1, 2)).toBeNull();
    expect(mioTraitBlock(0b1, 0, 2)).toBe("bad_index");
    expect(mioTraitBlock(0b1, 1, 0)).toBe("no_slot");
    expect(mioTraitBlock(0b111111 & ~0b100, 2, 2)).toBe("prereq");
  });

  it("MIO trait stats", () => {
    expect(mioStats(2, 0b1)).toEqual({ mioCostPct_armor: -5 });
    expect(mioStats(2, 1 << 6)).toEqual({ armorBrkPct: 5 });
    expect(mioStats(0, 0b100)).toEqual({
      mioCostPct_infantry: -10,
      mioRelPp_infantry: -5,
    });
  });

  it("market prices and factories", () => {
    expect([1, 2, 5].map(marketDiscountPct)).toEqual([100, 75, 50]);
    expect(marketPriceMilli(30_000, 0, 150)).toBe(4_500_000);
    expect(marketCivs(4_500_000)).toBe(30);
  });

  it("energy", () => {
    expect(energySupply(0, 3, 0, 0, 0)).toBe(6);
    expect(energyRatioPm(7, 6)).toBe(857);
    expect(energyPenaltyPct(857)).toBe(-7);
    expect(energyRatioPm(0, 0)).toBe(1000);
    expect(energyPenaltyPct(1000)).toBe(0);
    expect(coalWanted(10, 2, 0, 0, 0, 1)).toBe(2 + 2);
  });

  it("congress drift and the balance-of-power bands", () => {
    expect(congressStep(3_000, 5_000)).toBe(3_020);
    expect(congressStep(3_000, 2_990)).toBe(2_990);
    expect(congressTargetBp(0, false)).toBe(2_000);
    expect(congressTargetBp(20_000, true)).toBe(10_000);
    expect([-600, -599, -200, 200, 201, 600].map(bopBand)).toEqual([
      0, 1, 2, 2, 3, 4,
    ]);
  });

  it("the floating harbour's level", () => {
    expect(harborLevelMilli(60)).toBe(5_000);
    expect(harborLevelMilli(90)).toBe(2_500);
    expect(harborLevelMilli(120)).toBe(0);
  });

  it("hex round trip and seven distinct roll purposes", () => {
    const a = Uint8Array.from([0, 1, 15, 16, 200, 255]);
    const b = new Uint8Array(6);
    bytesOfHex(hexOf(a), b);
    expect([...b]).toEqual([...a]);
    const p = [
      P_INTEL_CAPTURE,
      P_INTEL_OP,
      P_INTEL_INFIL,
      P_NUKE_INTERCEPT,
      P_RAID,
      P_ACE_SPAWN,
      P_ACE_DEATH,
    ];
    expect(new Set(p).size).toBe(7);
  });
});
