// World War 1936: negotiated peace's pure rules (engine-lib NegPeaceRules)
// — the terms' checks, their value in conference points, and the AI judge
// (a white peace keeps the white peace's odds exactly).
import {
  WW_NEG_PEACE_MAX_REGIONS,
  WwPeaceTerms,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  hasPeaceTerms,
  NEG_PEACE_CONTROLLED_PCT,
  NEG_PEACE_RELEASE_PCT,
  negPeaceAccepts,
  negPeaceChance,
  NegPeaceFacts,
  negPeaceHint,
  NegPeaceJudge,
  negPeaceRepK,
  negPeaceRepValue,
  negPeaceTermsBlock,
  negPeaceUnit,
  negPeaceValue,
  negPeaceWinNeed,
  noPeaceTerms,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import { peaceSensitivity } from "@openfront/engine-lib/ww1936/PeaceRules";

// Countries: 1 the proposer, 2 the target, 3 Japan (excluded), 4 China, 5
// a subject of 1. Regions: 1 the proposer's capital, 2..4 its others, 10
// the target's capital, 11..12 its others, 20 Korea, 21 Taiwan, 30 a zone.
const P = 1;
const T = 2;
const JPN = 3;
const CHN = 4;
const SUB = 5;
const OWNER: Record<number, number> = {
  1: P,
  2: P,
  3: P,
  4: P,
  10: T,
  11: T,
  12: T,
  20: P,
  21: P,
  30: P,
  40: SUB,
};
const VP: Record<number, number> = { 1: 10, 2: 3, 3: 2, 4: 0, 10: 10, 11: 5 };
const CTRL: Record<number, number> = { 3: T, 12: P };

function facts(over: Partial<NegPeaceFacts> = {}): NegPeaceFacts {
  const owned = (id: number) =>
    Object.keys(OWNER)
      .map(Number)
      .filter((r) => OWNER[r] === id);
  return {
    legalOwner: (r) => OWNER[r] ?? 0,
    controller: (r) => CTRL[r] ?? OWNER[r] ?? 0,
    vp: (r) => VP[r] ?? 0,
    base: (r) => 4 + 2 * (VP[r] ?? 0),
    capital: (id) => (id === P ? 1 : id === T ? 10 : 0),
    legalVp: (id) => owned(id).reduce((n, r) => n + (VP[r] ?? 0), 0),
    legalBase: (id) => owned(id).reduce((n, r) => n + 4 + 2 * (VP[r] ?? 0), 0),
    civs: (id) => (id === P ? 20 : id === T ? 10 : 0),
    overlordOf: (id) => (id === SUB ? P : 0),
    isZone: (r) => r === 30,
    ...over,
  };
}

const SENS = peaceSensitivity(
  (g) => (g === "korea_north" ? [20] : g === "taiwan" ? [21] : []),
  JPN,
  0,
  [CHN],
);
const t = (x: Partial<WwPeaceTerms>): WwPeaceTerms => ({
  ...noPeaceTerms(),
  ...x,
});

describe("negotiated peace rules", () => {
  it("knows a white peace from terms", () => {
    expect(hasPeaceTerms(noPeaceTerms())).toBe(false);
    expect(hasPeaceTerms(undefined)).toBe(false);
    expect(hasPeaceTerms(t({ pay: 1 }))).toBe(true);
    expect(hasPeaceTerms(t({ free: [SUB] }))).toBe(true);
  });

  it("checks the terms: ownership, capital, 40%, zones, levels, subjects, Korea and Taiwan", () => {
    const f = facts();
    const block = (x: Partial<WwPeaceTerms>, from = P, to = T) =>
      negPeaceTermsBlock(f, SENS, t(x), from, to);
    expect(block({ give: [2], take: [11], pay: 3 })).toBeNull();
    expect(block({ give: [1] })).toBe("peace_capital");
    expect(block({ take: [10] })).toBe("peace_capital");
    expect(block({ give: [11] })).toBe("peace_bad_terms");
    expect(block({ give: [30] })).toBe("peace_bad_terms");
    expect(block({ give: [2, 2] })).toBe("peace_bad_terms");
    expect(block({ pay: 1, demand: 1 })).toBe("peace_bad_terms");
    expect(block({ pay: 4 })).toBe("peace_bad_terms");
    expect(
      block({
        give: Array.from(
          { length: WW_NEG_PEACE_MAX_REGIONS + 1 },
          (_, i) => 100 + i,
        ),
      }),
    ).toBe("peace_bad_terms");
    // The proposer's 15 victory points: 40% is 6, so 5 is fine.
    expect(block({ give: [2, 3, 4] })).toBeNull();
    // The target's 15: 11 (5) is a third, fine.
    expect(block({ take: [11, 12] })).toBeNull();
    // Region 2 at 9 of 21: over 40%.
    const big9 = (r: number) => (r === 2 ? 9 : (VP[r] ?? 0));
    const big = facts({
      vp: big9,
      legalVp: (id) => (id === P ? 21 : 15),
    });
    expect(negPeaceTermsBlock(big, SENS, t({ give: [2] }), P, T)).toBe(
      "peace_too_much",
    );
    // A subject of one of the two only.
    expect(block({ free: [SUB] })).toBeNull();
    expect(block({ free: [T] })).toBe("peace_bad_terms");
    expect(block({ free: [JPN] })).toBe("peace_bad_terms");
    // Korea: zone-only, whoever receives it; Taiwan: never by a peace,
    // even to its claimant China, never to Japan.
    expect(block({ give: [20] })).toBe("zone_only");
    expect(block({ give: [20] }, P, CHN)).toBe("zone_only");
    expect(block({ give: [21] })).toBe("claim_only");
    expect(block({ give: [21] }, P, CHN)).toBe("claim_only");
    expect(block({ give: [21] }, P, JPN)).toBe("claim_only");
  });

  it("values the terms in conference points: less for land already held, reparations prorated", () => {
    const f = facts();
    const fromSide = (id: number) => id === P;
    const toSide = (id: number) => id === T;
    const v = (x: Partial<WwPeaceTerms>) =>
      negPeaceValue(f, t(x), P, T, fromSide, toSide);
    // Region 2 (base 10) to the target; region 3 (base 8) it holds already.
    expect(v({ give: [2] })).toBe(10);
    expect(v({ give: [3] })).toBe(
      Math.floor((8 * NEG_PEACE_CONTROLLED_PCT) / 100),
    );
    // The target gives 11 (base 14), and 12 (base 4) the proposer holds.
    expect(v({ take: [11] })).toBe(-14);
    expect(v({ take: [12] })).toBe(-2);
    // 30% of 20 factories: 6 a day for a year, half the conference's
    // two-year price (12 × 6).
    expect(negPeaceRepK(20, 3)).toBe(6);
    expect(negPeaceRepK(20, 0)).toBe(0);
    expect(negPeaceRepK(2, 1)).toBe(1);
    expect(negPeaceRepK(0, 3)).toBe(0);
    expect(negPeaceRepValue(6)).toBe(36);
    expect(v({ pay: 3 })).toBe(36);
    expect(v({ demand: 1 })).toBe(-negPeaceRepValue(negPeaceRepK(10, 1)));
    // A subject of the proposer set free.
    expect(v({ free: [SUB] })).toBe(
      Math.floor((f.legalBase(SUB) * NEG_PEACE_RELEASE_PCT) / 100),
    );
  });

  it("a white peace keeps the white peace's odds; terms move them by value", () => {
    for (const pct of [0, 1, 15, 50, 85]) {
      const j: NegPeaceJudge = { pct, unit: 250, winNeed: 0 };
      for (let roll = 0; roll < 100; roll++) {
        expect(negPeaceAccepts(j, 0, roll)).toBe(roll < pct);
      }
      for (const value of [-30, -5, 0, 3, 10, 40]) {
        let yes = 0;
        for (let roll = 0; roll < 100; roll++) {
          if (negPeaceAccepts(j, value, roll)) yes++;
        }
        expect(negPeaceChance(j, value)).toBe(yes);
      }
    }
    // A clearly winning side (chance 0) needs its lead's share on top.
    expect(negPeaceWinNeed(10, 900, 200)).toBe(0);
    expect(negPeaceWinNeed(0, 500, 200)).toBe(60);
    expect(negPeaceWinNeed(0, 2000, 200)).toBe(120);
    const win: NegPeaceJudge = { pct: 0, unit: 250, winNeed: 60 };
    expect(negPeaceChance(win, 59)).toBe(0);
    expect(negPeaceChance(win, 60)).toBe(0);
    expect(negPeaceChance(win, 70)).toBe(40);
    // The unit: the smaller side's value.
    expect(negPeaceUnit(100, 400)).toBe(200);
    expect(negPeaceUnit(0, 400)).toBe(800);
    expect(negPeaceUnit(0, 0)).toBe(1);
    expect(negPeaceHint(70)).toBe("high");
    expect(negPeaceHint(30)).toBe("medium");
    expect(negPeaceHint(29)).toBe("low");
  });
});
