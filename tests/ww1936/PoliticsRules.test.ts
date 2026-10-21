// World War 1936 P3 (spec §4–§7, §14, §16; plan decision 11): the pure
// rules the engine and the screens share.
import {
  LAW_VALUES,
  LawValue,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_COM,
  IDEO_DEM,
  IDEO_FAS,
  IDEO_NEU,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addPopularity,
  addPpCapped,
  costWith,
  dailyPpMilli,
  effectiveSurrenderPct,
  factionGate,
  guaranteeGate,
  justifyCost,
  justifyDays,
  justifyGate,
  JustifyGateCtx,
  largestOther,
  LAW_PP,
  lawBlock,
  lawCost,
  rulingPartyBp,
  stabilityEffects,
  tensionFor,
  warSupportEffects,
  wearinessBp,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { P_RAND, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { emptyStats, sumStats } from "@openfront/engine-lib/ww1936/Stats";

const sum = (p: number[]) => p.reduce((a, b) => a + b, 0);

describe("political power (spec §4)", () => {
  it("daily PP is 2.00 at no modifier and follows ppGainPct and ppMilli", () => {
    expect(dailyPpMilli(emptyStats())).toBe(2000);
    expect(dailyPpMilli(sumStats([{ ppGainPct: 15 }]))).toBe(2300);
    expect(dailyPpMilli(sumStats([{ ppGainPct: -25, ppMilli: 100 }]))).toBe(
      1600,
    );
    expect(dailyPpMilli(sumStats([{ ppGainPct: 300 }]))).toBe(8000);
  });

  it("PP stops at the cap and only effects make it negative", () => {
    expect(addPpCapped(1_000_000, 2000)).toBe(1_002_000);
    expect(addPpCapped(1_499_000, 2000)).toBe(1_500_000);
    expect(addPpCapped(1_500_000, 2000)).toBe(1_500_000);
    // Above the cap (an effect gave it) nothing more comes, nothing is lost.
    expect(addPpCapped(1_600_000, 2000)).toBe(1_600_000);
    expect(addPpCapped(-30_000, 2000)).toBe(-28_000);
  });

  it("costs are floor(base × (100 + pct) / 100), never below 0", () => {
    expect(costWith(25, 0)).toBe(25);
    expect(costWith(25, -50)).toBe(12);
    expect(costWith(150, 50)).toBe(225);
    expect(costWith(50, -200)).toBe(0);
  });
});

describe("popularity (spec §5.2)", () => {
  it("popularity always sums to 10000 (10,000 random adds)", () => {
    let pop = [1500, 1000, 2000, 5500];
    for (let n = 0; n < 10_000; n++) {
      const r = wwRoll(1937, P_RAND, n);
      const i = r % 4;
      const delta = ((r >>> 8) % 4001) - 2000;
      addPopularity(pop, i, delta);
      expect(sum(pop)).toBe(10_000);
      expect(pop.every((p) => p >= 0)).toBe(true);
      if (n % 1000 === 999) pop = [2500, 2500, 2500, 2500];
    }
  });

  it("adding takes from the others in proportion", () => {
    const pop = [1000, 2000, 3000, 4000];
    addPopularity(pop, 0, 900);
    // 900 out of the others' 9000: 200, 300, 400.
    expect(pop).toEqual([1900, 1800, 2700, 3600]);
    addPopularity(pop, 0, -900);
    expect(pop).toEqual([1000, 2000, 3000, 4000]);
  });

  it("the remainder goes to the largest other and stops at zero", () => {
    const pop = [1000, 3000, 3000, 3000];
    addPopularity(pop, 0, 100); // 33 each, 1 left: the first of the tied largest.
    expect(pop).toEqual([1100, 2966, 2967, 2967]);
    const low = [0, 9997, 1, 2];
    addPopularity(low, 1, -9997);
    expect(sum(low)).toBe(10_000);
    expect(low[1]).toBe(0);
    const tiny = [9998, 0, 1, 1];
    addPopularity(tiny, 0, 2); // takes the rest from those that still have some
    expect(tiny).toEqual([10_000, 0, 0, 0]);
    // Clamped to what there is.
    const full = [9000, 1000, 0, 0];
    addPopularity(full, 0, 5000);
    expect(full).toEqual([10_000, 0, 0, 0]);
  });

  it("a full ideology losing support gives it to neutral (democratic when neutral)", () => {
    const a = [10_000, 0, 0, 0];
    addPopularity(a, IDEO_DEM, -3000);
    expect(a).toEqual([7000, 0, 0, 3000]);
    const b = [0, 0, 0, 10_000];
    addPopularity(b, IDEO_NEU, -2500);
    expect(b).toEqual([2500, 0, 0, 7500]);
  });

  it("the largest other ideology, ties to the lower index", () => {
    expect(largestOther([5000, 2000, 2000, 1000], IDEO_DEM)).toBe(IDEO_COM);
    expect(largestOther([5000, 2000, 3000, 0], IDEO_FAS)).toBe(IDEO_DEM);
    expect(rulingPartyBp(10_000)).toBe(1000);
    expect(rulingPartyBp(3000)).toBe(-400);
  });
});

describe("stability and war support (spec §6)", () => {
  it("stability effects at 0, 30, 50, 100%", () => {
    expect(stabilityEffects(0)).toEqual({
      ppGainPct: -25,
      outputPct: -20,
      constructionPct: -20,
    });
    expect(stabilityEffects(3000)).toEqual({
      ppGainPct: -10,
      outputPct: -8,
      constructionPct: -8,
    });
    expect(stabilityEffects(5000)).toEqual({ ppGainPct: 0, outputPct: 0 });
    expect(stabilityEffects(10_000)).toEqual({ ppGainPct: 15, outputPct: 10 });
  });

  it("war support effects at 0, 50, 100%", () => {
    expect(warSupportEffects(0)).toEqual({
      recoveryPct: -25,
      recruitablePct: -10,
    });
    expect(warSupportEffects(5000)).toEqual({ recoveryPct: 0 });
    expect(warSupportEffects(10_000)).toEqual({ recoveryPct: 10 });
  });

  it("surrender line moves at most ±15 points and stays in 50..98 (a base under 60: 10 under it)", () => {
    expect(effectiveSurrenderPct(80, 5000, 5000, 0)).toBe(80);
    expect(effectiveSurrenderPct(80, 10_000, 10_000, 0)).toBe(95);
    expect(effectiveSurrenderPct(80, 0, 0, 0)).toBe(65);
    expect(effectiveSurrenderPct(90, 10_000, 10_000, 0)).toBe(98);
    expect(effectiveSurrenderPct(90, 10_000, 10_000, 5)).toBe(98);
    expect(effectiveSurrenderPct(60, 0, 0, -10)).toBe(50);
    // P2 Task 11: a colonial empire's low base line (France 31) moves the
    // same, its floor ten points under it.
    expect(effectiveSurrenderPct(31, 5000, 5000, 0)).toBe(31);
    expect(effectiveSurrenderPct(31, 10_000, 10_000, 0)).toBe(46);
    expect(effectiveSurrenderPct(31, 0, 0, 0)).toBe(21);
    // Steps: 5%p of war support a point, 10%p of stability a point.
    expect(effectiveSurrenderPct(80, 5000, 5499, 0)).toBe(80);
    expect(effectiveSurrenderPct(80, 5000, 5500, 0)).toBe(81);
    expect(effectiveSurrenderPct(80, 4999, 5000, 0)).toBe(79);
  });

  it("war weariness: casualties of the core people, then lost points", () => {
    expect(wearinessBp(0, 1000, 0)).toBe(0);
    // 1% of the core people dead: −4%.
    expect(wearinessBp(10, 1000, 0)).toBe(-400);
    expect(wearinessBp(1000, 1000, 0)).toBe(-3000);
    expect(wearinessBp(0, 0, 50)).toBe(-1000);
  });
});

// ---- Laws (spec §7.2), the table restated from the spec ----

interface LawRule {
  /** War support needed, bp; 0 none. */
  ws: number;
  /** A democracy's tension at peace, bp; 0 none. */
  wt: number;
  /** "War support or at war": the gates vanish at war. */
  orWar: boolean;
  /** "At war and …". */
  needWar: boolean;
}
const NONE: LawRule = { ws: 0, wt: 0, orWar: false, needWar: false };
const TABLE: Record<LawValue, LawRule> = {
  civilian: NONE,
  early_mobilization: NONE,
  partial_mobilization: { ws: 3000, wt: 2500, orWar: true, needWar: false },
  war_economy: { ws: 5000, wt: 5000, orWar: true, needWar: false },
  total_mobilization: { ws: 7000, wt: 0, orWar: false, needWar: true },
  free_trade: NONE,
  export_focus: NONE,
  limited_exports: NONE,
  closed_economy: NONE,
  disarmed: NONE,
  volunteer: NONE,
  limited: NONE,
  extensive: { ws: 3000, wt: 2500, orWar: false, needWar: false },
  service: { ws: 5000, wt: 5000, orWar: false, needWar: false },
  all_adults: { ws: 7000, wt: 0, orWar: false, needWar: true },
  scraping: { ws: 8000, wt: 0, orWar: false, needWar: true },
};

function expected(
  v: LawValue,
  war: boolean,
  ruling: number,
  wsBp: number,
  wtBp: number,
): string | null {
  const r = TABLE[v];
  if (r.needWar && !war) return "law_condition";
  if (!(r.orWar && war)) {
    if (wsBp < r.ws) return "law_ws";
    if (ruling === IDEO_DEM && !war && wtBp < r.wt) return "law_tension";
  }
  const red = ruling === IDEO_COM || ruling === IDEO_FAS;
  if (v === "free_trade" && red) return "law_ideology";
  if (v === "closed_economy" && !red && !war) return "law_ideology";
  return null;
}

const CASES: [LawValue, boolean, number, number, number][] = [];
for (const v of LAW_VALUES) {
  const r = TABLE[v];
  for (const war of [false, true]) {
    for (const ruling of [IDEO_DEM, IDEO_COM, IDEO_FAS, IDEO_NEU]) {
      for (const ws of r.ws > 0 ? [r.ws - 1, r.ws] : [0]) {
        for (const wt of r.wt > 0 ? [r.wt - 1, r.wt] : [0]) {
          CASES.push([v, war, ruling, ws, wt]);
        }
      }
    }
  }
}

describe("laws (spec §7.2)", () => {
  it.each(CASES)(
    "the law table blocks exactly as spec §7.2: %s at war %s, ruling %i, ws %i, wt %i",
    (v, war, ruling, wsBp, wtBp) => {
      const ctx = {
        wsBp,
        wtBp,
        ruling,
        atWar: war,
        ppMilli: 1_000_000,
        costMilli: 150_000,
      };
      expect(lawBlock(v, ctx)).toBe(expected(v, war, ruling, wsBp, wtBp));
    },
  );

  it("then the cost: short or negative PP is no_pp", () => {
    const ctx = {
      wsBp: 10_000,
      wtBp: 10_000,
      ruling: IDEO_NEU,
      atWar: false,
      ppMilli: 74_999,
      costMilli: 75_000,
    };
    expect(lawBlock("early_mobilization", ctx)).toBe("no_pp");
    expect(
      lawBlock("early_mobilization", { ...ctx, ppMilli: 75_000 }),
    ).toBeNull();
    expect(lawBlock("civilian", { ...ctx, ppMilli: -1, costMilli: 0 })).toBe(
      "no_pp",
    );
    // A condition comes first.
    expect(lawBlock("total_mobilization", ctx)).toBe("law_condition");
  });

  it("law cost uses lawCostPct and conscriptionCostPct", () => {
    expect(Object.keys(LAW_PP).sort()).toEqual([...LAW_VALUES].sort());
    expect(lawCost("war_economy", emptyStats())).toBe(150);
    expect(lawCost("war_economy", sumStats([{ lawCostPct: -20 }]))).toBe(120);
    // The British spirit: conscription laws +50% (plan decision 10).
    const s = sumStats([{ conscriptionCostPct: 50 }]);
    expect(lawCost("extensive", s)).toBe(150);
    expect(lawCost("war_economy", s)).toBe(150);
    expect(
      lawCost(
        "service",
        sumStats([{ lawCostPct: -10, conscriptionCostPct: 50 }]),
      ),
    ).toBe(175);
  });
});

describe("war goals and tension (spec §14)", () => {
  it("justification costs 50 or 75 and takes 100 days with modifiers, at least 10", () => {
    expect(justifyCost(false, emptyStats())).toBe(50);
    expect(justifyCost(true, emptyStats())).toBe(75);
    // A democracy's +50%.
    expect(justifyCost(true, sumStats([{ justifyCostPct: 50 }]))).toBe(112);
    expect(justifyDays(emptyStats(), 0, 0)).toBe(100);
    expect(justifyDays(sumStats([{ justifyTimePct: -10 }]), 0, 0)).toBe(90);
    expect(justifyDays(emptyStats(), 20, 2)).toBe(170);
    expect(justifyDays(sumStats([{ justifyTimePct: -200 }]), 0, 0)).toBe(10);
  });

  it("tension values follow the table, claims halve them", () => {
    const s = emptyStats();
    expect(tensionFor("justified", true, s)).toBe(400);
    expect(tensionFor("justified", false, s)).toBe(200);
    expect(tensionFor("declare_goal", true, s)).toBe(500);
    expect(tensionFor("declare_goal", false, s)).toBe(200);
    expect(tensionFor("declare_no_goal", true, s)).toBe(1400);
    expect(tensionFor("declare_no_goal", false, s)).toBe(800);
    expect(tensionFor("capitulation", true, s)).toBe(200);
    expect(tensionFor("declare_goal", true, s, "claim")).toBe(250);
    expect(tensionFor("capitulation", true, s, "claim")).toBe(200);
    expect(tensionFor("justified", true, sumStats([{ tensionPct: -10 }]))).toBe(
      360,
    );
    expect(
      tensionFor("justified", true, sumStats([{ tensionPct: -200 }])),
    ).toBe(0);
  });

  it("justify, guarantee and faction gates by government and tension", () => {
    const base: JustifyGateCtx = {
      ruling: IDEO_FAS,
      wtBp: 0,
      targetThreatBp: 0,
      targetInEnemyFaction: false,
      atWarWith: false,
      sameFaction: false,
      nap: false,
      iGuarantee: false,
      noJustifyRule: false,
      busy: false,
    };
    expect(justifyGate(base)).toBeNull();
    expect(justifyGate({ ...base, busy: true })).toBe("justify_busy");
    for (const k of [
      "atWarWith",
      "sameFaction",
      "nap",
      "iGuarantee",
      "noJustifyRule",
    ] as const) {
      expect(justifyGate({ ...base, [k]: true }), k).toBe("justify_blocked");
    }
    const dem = { ...base, ruling: IDEO_DEM };
    expect(justifyGate({ ...dem, wtBp: 7999 })).toBe("tension_gate");
    expect(justifyGate({ ...dem, wtBp: 8000 })).toBeNull();
    expect(justifyGate({ ...dem, wtBp: 5000, targetThreatBp: 499 })).toBe(
      "tension_gate",
    );
    expect(justifyGate({ ...dem, wtBp: 5000, targetThreatBp: 500 })).toBeNull();
    expect(justifyGate({ ...dem, targetInEnemyFaction: true })).toBeNull();
    const neu = { ...base, ruling: IDEO_NEU };
    expect(justifyGate({ ...neu, wtBp: 2499 })).toBe("tension_gate");
    expect(justifyGate({ ...neu, wtBp: 2500 })).toBeNull();
    expect(justifyGate({ ...base, ruling: IDEO_COM })).toBeNull();

    expect(guaranteeGate(IDEO_FAS, 0, false)).toBe(true);
    expect(guaranteeGate(IDEO_DEM, 2499, false)).toBe(false);
    expect(guaranteeGate(IDEO_DEM, 2500, false)).toBe(true);
    expect(guaranteeGate(IDEO_DEM, 0, true)).toBe(true);
    expect(guaranteeGate(IDEO_DEM, 1500, false, 15)).toBe(true);

    expect(factionGate(IDEO_COM, 0)).toBe(true);
    expect(factionGate(IDEO_DEM, 3999)).toBe(false);
    expect(factionGate(IDEO_NEU, 4000)).toBe(true);
    expect(factionGate(IDEO_DEM, 2000, 20)).toBe(true);
    expect(factionGate(IDEO_DEM, 0, 60)).toBe(true);
  });
});
