// World War 1936 P4 (plan Task 1 Step 25): ship numbers (spec §4.1–§4.3).
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  lineUnitCost,
  shipGenTech,
  shipStats,
} from "@openfront/engine-lib/ww1936/ShipStats";
import { emptyStats } from "@openfront/engine-lib/ww1936/Stats";

const Z = emptyStats();
const none = new Set<never>();
/** The stats a doctrine tech feeds (its bonuses are stat keys: P6 pre-flight). */
/** A doctrine's stat keys (P6 pre-flight §0-5: the old tech's values). */
const doc = (s: Partial<WwStats>): WwStats => ({ ...Z, ...s });

describe("ship stats", () => {
  it("generations (spec §4.2)", () => {
    const bb2 = shipStats("bb", 2, Z, none);
    expect(bb2.hpMilli).toBe(165_000);
    expect(bb2.heavy).toBe(6250);
    expect(bb2.heavyPierce).toBe(9200);
    expect(bb2.armor).toBe(5750);
    expect(bb2.speedCentiKn).toBe(2800);
    expect(bb2.cost).toBe(15_000);
    expect(shipStats("dd", 2, Z, none).cost).toBe(1440);
    expect(shipStats("ss", 2, Z, none).cost).toBe(1080);
    expect(shipStats("ss", 1, Z, none).vis).toBe(6);
    expect(shipStats("ss", 4, Z, none).vis).toBe(3);
    expect(shipStats("cv", 2, Z, none).deck).toBe(60);
  });

  it("equipment techs read by id (plan decision 23), doctrines as stat keys", () => {
    // A doctrine tech alone changes nothing; its stat keys do (P6 pre-flight).
    expect(
      shipStats("ss", 1, Z, new Set(["trade_interdiction_1"] as const)).vis,
    ).toBe(6);
    expect(
      shipStats(
        "ss",
        1,
        doc({ convoyRaidPct: 15, subTorpedoPct: 15, subVisibilityPct: -10 }),
        none,
      ).vis,
    ).toBe(5);
    expect(
      shipStats("cv", 2, doc({ carrierStrikePct: 20, deckPct: 10 }), none).deck,
    ).toBe(66);
    expect(
      shipStats(
        "ss",
        2,
        doc({ convoyRaidPct: 15, surfaceRaidPct: 50, subOrg: 10 }),
        none,
      ).orgMilli,
    ).toBe(shipStats("ss", 2, Z, none).orgMilli + 10_000);
    const dd = shipStats("dd", 1, Z, new Set(["sonar_1"] as const));
    expect(dd.subDetect).toBe(32);
    expect(dd.depth).toBe(1150);
    expect(
      shipStats("bb", 1, doc({ screeningPct: 15, capitalHpPct: 10 }), none)
        .hpMilli,
    ).toBe(165_000);
    expect(
      shipStats("cl", 1, doc({ screeningPct: 15, capitalHpPct: 10 }), none)
        .hpMilli,
    ).toBe(shipStats("cl", 1, Z, none).hpMilli);
    expect(
      shipStats("dd", 1, Z, new Set(["naval_radar_1"] as const)).surfDetect,
    ).toBe(30);
  });

  it("naval line costs and generation techs", () => {
    expect(lineUnitCost("convoy", 1)).toBe(60);
    expect(lineUnitCost("bb", 2)).toBe(15_000);
    expect(shipGenTech("dd", 1)).toBeNull();
    expect(shipGenTech("cv", 3)).toBe("cv_3");
  });
});
