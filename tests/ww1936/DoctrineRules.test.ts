// World War 1936 P6 (spec §3, plan Task 1 Step 21): the grand doctrines'
// stat table.
import { GRAND_DOCTRINES } from "@openfront/engine-api/ww1936/DepthTypes";
import { WW_STAT_KEYS } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { GRAND_DOCTRINE_STATS } from "@openfront/engine-lib/ww1936/DoctrineRules";
import {
  RETIRED_DOCTRINE_TECHS,
  retiredTechEffects,
} from "@openfront/engine-lib/ww1936/WwTechs";

/** The retired techs' own effects (WwTechs keeps them for the grand doctrines). */
const BASE_EFFECTS: Record<string, object> = Object.fromEntries(
  RETIRED_DOCTRINE_TECHS.map((t) => [t, retiredTechEffects(t)]),
);

describe("doctrine rules", () => {
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
});
