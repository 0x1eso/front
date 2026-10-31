// World War 1936: peace on the current line's pure rules (engine-lib
// LinePeaceRules) — which regions change hands (no 12-region or 40% cap;
// capitals, occupation zones, Korea and Taiwan but to China stay out; no
// country erased) and the line's worth to a side (losses counted less near
// the surrender line).
import {
  WW_NEG_PEACE_MAX_REGIONS,
  WW_NEG_PEACE_MAX_VP_PCT,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  AI_LINE_RELIEF_PCT,
  LinePeaceFacts,
  linePeaceMoves,
  linePeaceReliefPm,
  linePeaceSplit,
  linePeaceValue,
  lineRegionValue,
} from "@openfront/engine-lib/ww1936/LinePeaceRules";
import { NEG_PEACE_CONTROLLED_PCT } from "@openfront/engine-lib/ww1936/NegPeaceRules";

// Countries: 1, 2 and 4 (China, the Taiwan claimant) on side A, 3 (Japan,
// excluded) and 5 on side B, 6 a third country.
const [A1, A2, JPN, CHN, B5, OUT] = [1, 2, 3, 4, 5, 6];
// Regions: 1..20 A1's land (1 its capital), 30..31 B5's (30 its capital),
// 40..41 A2's (40 its capital), 50 Korea (Japan's), 51..52 Taiwan
// (Japan's), 60 a zone of A1's land, 70..71 OUT's.
const REGIONS = [
  ...Array.from({ length: 20 }, (_, i) => i + 1),
  30,
  31,
  40,
  41,
  50,
  51,
  52,
  60,
  70,
  71,
];
const OWNER: Record<number, number> = {
  30: B5,
  31: B5,
  40: A2,
  41: A2,
  50: JPN,
  51: JPN,
  52: JPN,
  60: A1,
  70: OUT,
  71: OUT,
};
const ownerOf = (r: number) => OWNER[r] ?? (r <= 20 ? A1 : 0);
const VP: Record<number, number> = { 1: 20, 30: 10, 31: 4, 40: 8, 41: 2 };
const vpOf = (r: number) => VP[r] ?? (r <= 20 ? 1 : 0);
const baseOf = (r: number) => 4 + 2 * vpOf(r);

function facts(ctrl: Record<number, number>): LinePeaceFacts {
  return {
    regions: REGIONS,
    legalOwner: ownerOf,
    controller: (r) => ctrl[r] ?? ownerOf(r),
    vp: vpOf,
    base: baseOf,
    capital: (id) => (id === A1 ? 1 : id === B5 ? 30 : id === A2 ? 40 : 0),
    capitals: (id) =>
      id === A1 ? [1] : id === B5 ? [30] : id === A2 ? [40] : [],
    legalVp: () => 0,
    legalBase: () => 0,
    civs: () => 0,
    overlordOf: () => 0,
    isZone: (r) => r === 60,
  };
}

const SIDE_A = new Set([A1, A2, CHN]);
const SIDE_B = new Set([JPN, B5]);

describe("World War 1936: the line's pure rules", () => {
  it("every occupied region across the two sides goes to its occupier — no 12-region or 40% cap", () => {
    // B5 holds seventeen of A1's regions (2..18): 17 of A1's 39 points.
    const ctrl: Record<number, number> = {};
    for (let r = 2; r <= 18; r++) ctrl[r] = B5;
    ctrl[31] = A2;
    const moves = linePeaceMoves(facts(ctrl), SIDE_A, SIDE_B);
    expect(moves.length).toBeGreaterThan(WW_NEG_PEACE_MAX_REGIONS);
    expect(moves).toEqual([
      ...Array.from({ length: 17 }, (_, i) => [i + 2, A1, B5]),
      [31, B5, A2],
    ]);
    // More than the negotiated peace's share of A1's points.
    const lost = moves.filter((m) => m[1] === A1).length;
    expect(lost * 100).toBeGreaterThan((20 + 19) * WW_NEG_PEACE_MAX_VP_PCT);
  });

  it("capitals, zones and other countries' land stay out", () => {
    const ctrl = { 1: B5, 2: B5, 30: A1, 60: B5, 70: A1, 41: A1 };
    // A1's capital (1), B5's capital (30), the zone (60), OUT's land (70)
    // and A2's region held by its own ally (41) don't move.
    expect(linePeaceMoves(facts(ctrl), SIDE_A, SIDE_B)).toEqual([[2, A1, B5]]);
  });

  it("Korea and Taiwan regions move like any other", () => {
    const ctrl = { 50: A1, 51: A2, 52: CHN };
    // Japan keeps its best region (the smallest id on a tie); the rest go.
    expect(linePeaceMoves(facts(ctrl), SIDE_A, SIDE_B)).toEqual([
      [51, JPN, A2],
      [52, JPN, CHN],
    ]);
  });

  it("no country is erased: one left with nothing keeps its most valuable region", () => {
    // A2's capital is held by OUT (outside the peace) and B5 holds its
    // other region: A2 keeps that one.
    expect(linePeaceMoves(facts({ 40: OUT, 41: B5 }), SIDE_A, SIDE_B)).toEqual(
      [],
    );
    // Its capital held by B5 comes back: then the other may go.
    expect(linePeaceMoves(facts({ 40: B5, 41: B5 }), SIDE_A, SIDE_B)).toEqual([
      [41, A2, B5],
    ]);
    // A country with no capital keeps the best of what goes (points,
    // then base, then the smaller id).
    const f = facts({ 30: A1, 31: A1 });
    const noCapital: LinePeaceFacts = { ...f, capitals: () => [] };
    expect(linePeaceMoves(noCapital, SIDE_A, SIDE_B)).toEqual([[31, B5, A1]]);
  });

  it("the line's worth: gains less losses at the control factor, losses counted less near the surrender line", () => {
    const f = facts({ 2: B5, 3: B5, 31: A1 });
    const moves = linePeaceMoves(f, SIDE_A, SIDE_B);
    const v = (r: number) =>
      Math.floor((baseOf(r) * NEG_PEACE_CONTROLLED_PCT) / 100);
    expect(lineRegionValue(f, 31)).toBe(v(31));
    const inA = (x: number) => SIDE_A.has(x);
    const inB = (x: number) => SIDE_B.has(x);
    expect(linePeaceValue(f, moves, inA, 0)).toBe(v(31) - v(2) - v(3));
    expect(linePeaceValue(f, moves, inB, 0)).toBe(v(2) + v(3) - v(31));
    // Half way to its surrender line A counts half of its losses (at its
    // line none); its gains count in full.
    expect(linePeaceReliefPm(500)).toBe(5 * AI_LINE_RELIEF_PCT);
    expect(linePeaceReliefPm(2000)).toBe(1000);
    expect(linePeaceValue(f, moves, inA, 500)).toBe(
      v(31) - Math.floor(((v(2) + v(3)) * 500) / 1000),
    );
    expect(linePeaceValue(f, moves, inA, 1000)).toBe(v(31));
    // The split as the screens read it.
    expect(linePeaceSplit(f, moves, inA)).toEqual({
      gain: [31],
      lose: [2, 3],
      gainVp: 4,
      loseVp: 2,
    });
  });
});
