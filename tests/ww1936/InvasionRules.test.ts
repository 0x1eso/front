// World War 1936 P4 (plan Task 1 Step 25): invasion rules (spec §11).
import {
  amphibiousMods,
  InvasionAsk,
  invasionBlock,
  invasionCapacity,
  invasionPrepDays,
  shoreBombardBp,
} from "@openfront/engine-lib/ww1936/InvasionRules";
import { emptyStats, sumStats } from "@openfront/engine-lib/ww1936/Stats";

const Z = emptyStats();
const none = new Set<never>();
const lc1 = new Set(["landing_craft_1"] as const);
const lc12 = new Set(["landing_craft_1", "landing_craft_2"] as const);

describe("invasion rules", () => {
  it("capacity", () => {
    expect(invasionCapacity(Z, none)).toBe(10);
    expect(invasionCapacity(Z, lc1)).toBe(15);
    expect(invasionCapacity(Z, lc12)).toBe(20);
    expect(invasionCapacity(sumStats([{ invasionCapacity: 3 }]), none)).toBe(
      13,
    );
  });

  it("preparation", () => {
    expect(invasionPrepDays(Z, none, false, false)).toBe(60);
    expect(invasionPrepDays(Z, none, true, false)).toBe(30);
    expect(invasionPrepDays(Z, lc1, false, false)).toBe(48);
    expect(invasionPrepDays(Z, lc12, false, false)).toBe(36);
    expect(invasionPrepDays(Z, none, false, true)).toBe(48);
    expect(invasionPrepDays(Z, lc12, false, true)).toBe(24);
    expect(invasionPrepDays(Z, lc1, true, false)).toBe(24);
    expect(
      invasionPrepDays(
        sumStats([{ invasionPrepPct: -90 }]),
        none,
        false,
        false,
      ),
    ).toBe(6);
  });

  it("the landing's battle lines", () => {
    expect(amphibiousMods(false, 0, false, none).attackBp).toBe(-7000);
    expect(amphibiousMods(true, 0, false, none).attackBp).toBe(-3500);
    expect(amphibiousMods(false, 2, false, none).attackBp).toBe(-10_000);
    expect(amphibiousMods(false, 2, true, none).attackBp).toBe(-9250);
    expect(
      amphibiousMods(false, 0, false, new Set(["landing_craft_2"] as const))
        .attackBp,
    ).toBe(-6000);
    expect(shoreBombardBp(22_000, Z)).toBe(-2200);
    expect(shoreBombardBp(100_000, Z)).toBe(-2500);
    expect(shoreBombardBp(22_000, sumStats([{ shoreBombardPct: 25 }]))).toBe(
      -2500,
    );
    expect(shoreBombardBp(0, Z)).toBe(0);
  });

  it("the order's refusals, in order", () => {
    const ok: InvasionAsk = {
      divisions: 10,
      capacity: 10,
      allInOnePort: true,
      anyInBattle: false,
      targetCoastal: true,
      targetEnemy: true,
      routeKm: 600,
      convoysFree: 0,
      convoysNeed: 90,
    };
    expect(invasionBlock(ok)).toBeNull();
    expect(
      invasionBlock({ ...ok, allInOnePort: false, anyInBattle: true }),
    ).toBe("not_in_port");
    expect(
      invasionBlock({ ...ok, anyInBattle: true, targetCoastal: false }),
    ).toBe("army_busy");
    expect(
      invasionBlock({ ...ok, targetCoastal: false, targetEnemy: false }),
    ).toBe("not_coastal");
    expect(invasionBlock({ ...ok, targetEnemy: false, routeKm: null })).toBe(
      "not_at_war",
    );
    expect(invasionBlock({ ...ok, routeKm: 8001, divisions: 11 })).toBe(
      "no_sea_path",
    );
    expect(invasionBlock({ ...ok, routeKm: null })).toBe("no_sea_path");
    expect(invasionBlock({ ...ok, divisions: 11 })).toBe("invasion_too_large");
  });
});
