// World War 1936 P6 (spec §3, plan Task 1 Step 21): mastery levels and
// growth, grand doctrines, the pick refusals.
import {
  GRAND_DOCTRINES,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addMastery,
  doctrinePickBlock,
  doctrineStats,
  GRAND_DOCTRINE_STATS,
  landCombatShare,
  masteryGain,
  masteryLevel,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import {
  RETIRED_DOCTRINE_TECHS,
  retiredTechEffects,
} from "@openfront/engine-lib/ww1936/WwTechs";

const NONE = new Array<number>(9).fill(-1);

/** The retired techs' own effects (WwTechs keeps them for the grand doctrines). */
const BASE_EFFECTS: Record<string, object> = Object.fromEntries(
  RETIRED_DOCTRINE_TECHS.map((t) => [t, retiredTechEffects(t)]),
);

describe("doctrine rules", () => {
  it("level thresholds", () => {
    expect(masteryLevel(99_999)).toBe(0);
    expect(masteryLevel(100_000)).toBe(1);
    expect(masteryLevel(1_499_999)).toBe(4);
    expect(masteryLevel(1_500_000)).toBe(5);
    expect(addMastery(1_499_000, 5_000)).toBe(1_500_000);
    expect(addMastery(100, -500)).toBe(0);
  });

  it("a day's gain: base, combat share, cap, speed", () => {
    expect(masteryGain([0, 0, 0], 0)).toEqual([300, 300, 300]);
    expect(masteryGain([2_000_000, 0, 0], 0)[0]).toBe(1_200);
    expect(masteryGain([0, 0, 0], 10)[0]).toBe(330);
    expect(landCombatShare(2, 0, 0)).toEqual([20_000, 0, 0]);
    expect(landCombatShare(0, 0, 0)).toEqual([0, 0, 0]);
  });

  it("a grand doctrine completes at six track levels", () => {
    const mobile = GRAND_DOCTRINES.indexOf("gd_mobile");
    const choice = { gd: [mobile, -1, -1], sub: NONE };
    const [base, complete] = GRAND_DOCTRINE_STATS.gd_mobile;
    expect(doctrineStats(choice, [2, 2, 1, 0, 0, 0, 0, 0, 0])).toEqual(base);
    expect(doctrineStats(choice, [2, 2, 2, 0, 0, 0, 0, 0, 0])).toEqual({
      ...base,
      ...complete,
    });
  });

  it("each grand doctrine carries its two retired techs' effects (spec §3.2, review L1)", () => {
    for (const g of GRAND_DOCTRINES) {
      const school = g.slice("gd_".length);
      const [base, complete] = GRAND_DOCTRINE_STATS[g];
      expect(base, g).toEqual(BASE_EFFECTS[`${school}_1`]);
      expect(complete, g).toEqual(BASE_EFFECTS[`${school}_2`]);
      // Every key is one a P2–P4 reader reads (the pre-P6 tech keys).
      for (const k of [...Object.keys(base), ...Object.keys(complete)]) {
        expect(WW_STAT_KEYS, `${g} ${k}`).toContain(k);
      }
    }
    // The naval and air keys the P4 readers read (pre-flight §0-5).
    expect(GRAND_DOCTRINE_STATS.gd_fleet_in_being[1]).toEqual({
      screeningPct: 15,
      capitalHpPct: 10,
    });
    expect(GRAND_DOCTRINE_STATS.gd_trade_interdiction).toEqual([
      { convoyRaidPct: 15, subTorpedoPct: 15, subVisibilityPct: -10 },
      { convoyRaidPct: 15, surfaceRaidPct: 50, subOrg: 10 },
    ]);
    expect(GRAND_DOCTRINE_STATS.gd_base_strike).toEqual([
      { carrierStrikePct: 20, deckPct: 10 },
      { navalBomberPct: 15, carrierRoundsCut: 1 },
    ]);
    expect(GRAND_DOCTRINE_STATS.gd_strategic_destruction[1]).toEqual({
      stratBombPct: 15,
      heavyDefensePct: 15,
    });
    expect(GRAND_DOCTRINE_STATS.gd_battlefield_support[0]).toEqual({
      casPct: 15,
      supPenaltyPp: 5,
    });
    expect(GRAND_DOCTRINE_STATS.gd_operational_integrity[1]).toEqual({
      airLossCutPct: 15,
      airNavalPct: 10,
    });
  });

  it("no grand doctrine, no sub-doctrine reward", () => {
    const sub = [...NONE];
    sub[0] = SUBDOCTRINES.indexOf("inf_elastic");
    expect(
      doctrineStats({ gd: [-1, -1, -1], sub }, new Array(9).fill(5)),
    ).toEqual({});
  });

  it("the pick refusals: lock, experience, another domain", () => {
    const fire = GRAND_DOCTRINES.indexOf("gd_firepower");
    const mobile = GRAND_DOCTRINES.indexOf("gd_mobile");
    const fleet = GRAND_DOCTRINES.indexOf("gd_fleet_in_being");
    const pick = (o: object) =>
      doctrinePickBlock({
        domain: 0,
        gd: fire,
        current: -1,
        lockUntil: -1,
        day: 10,
        xp: 0,
        ...o,
      });
    expect(pick({})).toBeNull();
    expect(pick({ gd: fleet })).toBe("bad_index");
    expect(pick({ current: fire })).toBe("bad_index");
    expect(pick({ current: mobile, lockUntil: 20 })).toBe("doctrine_locked");
    expect(pick({ current: mobile, xp: 99 })).toBe("no_xp");
    expect(pick({ current: mobile, xp: 100 })).toBeNull();
    const elastic = SUBDOCTRINES.indexOf("inf_elastic");
    const assault = SUBDOCTRINES.indexOf("inf_assault");
    expect(pick({ track: 0, sub: elastic, currentSub: -1 })).toBeNull();
    expect(pick({ track: 1, sub: elastic })).toBe("bad_index");
    expect(pick({ track: 0, sub: assault, currentSub: elastic, xp: 24 })).toBe(
      "no_xp",
    );
  });
});
