// World War 1936: negotiated peace (owner request "7번", 2026-10-30). A
// peace offer may carry terms — regions ceded with their legal ownership,
// reparations, subjects set free — given by the proposer or demanded of
// the target. These are the terms' rules and the AI's judge as pure
// functions: the engine checks, settles and judges an offer with them, and
// the composer card checks its draft and shows its hint with the same
// ones. Integers only; regions by id, countries by smallID.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_NEG_PEACE_MAX_FREE,
  WW_NEG_PEACE_MAX_REGIONS,
  WW_NEG_PEACE_MAX_VP_PCT,
  WW_NEG_REPARATIONS_DAYS,
  WW_NEG_REPARATIONS_MAX_LEVEL,
  WW_NEG_REPARATIONS_STEP_PCT,
  WW_REPARATIONS_DAYS,
  WwPeaceTerms,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { AGG_PCT, COST_FACTORS, reparationsCost } from "./EndgameRules";
import {
  peaceRegionBlock,
  PeaceSensitivity,
  PeaceTable,
  SensitiveBlock,
} from "./PeaceRules";

// ---- Values (the peace conference's currency, spec §6.3) ----

/** A region the receiving side already controls is worth this percent (the conference's control factor). */
export const NEG_PEACE_CONTROLLED_PCT =
  COST_FACTORS.find(([k]) => k === "controls")?.[1] ?? 50;
/** A subject set free is worth this percent of its land's value (the conference's liberate). */
export const NEG_PEACE_RELEASE_PCT = AGG_PCT.liberate;

// ---- The AI's judge (named thresholds) ----

/**
 * Value per percent of accept chance: this ‰ of the smaller side's land
 * value (base points). 100 percent is 20% of it: a concession of a tenth
 * of the smaller side's land moves the chance by half.
 */
export const AI_NEG_UNIT_PM = 2;
/**
 * A side clearly winning (its white-peace chance 0) needs, on top, this
 * percent of the proposer's land value at its full lead (the proposer at
 * its surrender line, or all of its land held): more than the 40% of the
 * victory points a giver may cede, near the end.
 */
export const AI_NEG_WIN_PCT = 60;
/** The AI proposer aims its terms at this accept chance (percent). */
export const AI_NEG_AIM_PCT = 60;
/** The AI proposer gives at most what its own white-peace chance past this percent is worth. */
export const AI_NEG_GIVE_FROM_PCT = 10;
/** The composer's hint: "high" from this chance (percent)… */
export const NEG_PEACE_HINT_HIGH_PCT = 60;
/** …"medium" from this one; "low" below. */
export const NEG_PEACE_HINT_MEDIUM_PCT = 30;

/** The world the terms read (the engine's state, or the client's views). */
export interface NegPeaceFacts {
  legalOwner(region: number): number;
  controller(region: number): number;
  /** Victory points of the region. */
  vp(region: number): number;
  /** The conference's base(r) (spec §6.3). */
  base(region: number): number;
  /** The country's capital region (its scenario capital; 0: none). */
  capital(id: number): number;
  /** Victory points of the country's legal land. */
  legalVp(id: number): number;
  /** base() of the country's legal land, summed. */
  legalBase(id: number): number;
  /** Civilian factories. */
  civs(id: number): number;
  /** The country's overlord (0: none). */
  overlordOf(id: number): number;
  /** An occupation zone (control without ownership): never ceded. */
  isZone(region: number): boolean;
}

/** No terms (a white peace). */
export function noPeaceTerms(): WwPeaceTerms {
  return { give: [], take: [], pay: 0, demand: 0, free: [] };
}

/** The offer carries any term at all (else it is a white peace). */
export function hasPeaceTerms(t: WwPeaceTerms | null | undefined): boolean {
  return (
    t !== null &&
    t !== undefined &&
    (t.give.length > 0 ||
      t.take.length > 0 ||
      t.pay > 0 ||
      t.demand > 0 ||
      t.free.length > 0)
  );
}

const NO_TABLE: PeaceTable = {
  stake: [],
  base: [],
  losers: [],
  parts: [],
  claims: [],
  conquer: [],
  topple: [],
  settled: [],
};

/**
 * Korea and Taiwan are never ceded or demanded (the owner's sensitivity
 * rule): P5's peaceRegionBlock for a take with no conference — Korea is
 * zone-only (zone_only), Taiwan goes only to a claimant at a conference
 * (claim_only), and the excluded country (JPN) never receives either.
 * Every other region: null.
 */
export function negPeaceRegionBlock(
  s: PeaceSensitivity,
  receiver: number,
  region: number,
): SensitiveBlock | null {
  return peaceRegionBlock(s, NO_TABLE, receiver, receiver, "take", region);
}

const levelOk = (n: number) =>
  Number.isInteger(n) && n >= 0 && n <= WW_NEG_REPARATIONS_MAX_LEVEL;

/**
 * Why `t` can't be offered by `from` to `to` now (null: it can). Bounded
 * counts, levels 0..3 and not both ways, no region twice; a subject set
 * free is one of the two's; each ceded region legally the giver's, no
 * occupation zone, not Korea or Taiwan (their reasons), not the giver's
 * capital, and at most WW_NEG_PEACE_MAX_VP_PCT of the giver's victory
 * points each way.
 */
export function negPeaceTermsBlock(
  f: NegPeaceFacts,
  s: PeaceSensitivity,
  t: WwPeaceTerms,
  from: number,
  to: number,
): WwOrderBlock | null {
  if (
    t.give.length > WW_NEG_PEACE_MAX_REGIONS ||
    t.take.length > WW_NEG_PEACE_MAX_REGIONS ||
    t.free.length > WW_NEG_PEACE_MAX_FREE ||
    !levelOk(t.pay) ||
    !levelOk(t.demand) ||
    (t.pay > 0 && t.demand > 0)
  ) {
    return "peace_bad_terms";
  }
  const seen = new Set<number>();
  for (const r of [...t.give, ...t.take]) {
    if (seen.has(r)) return "peace_bad_terms";
    seen.add(r);
  }
  const freed = new Set<number>();
  for (const x of t.free) {
    const o = f.overlordOf(x);
    if (freed.has(x) || x === from || x === to || (o !== from && o !== to)) {
      return "peace_bad_terms";
    }
    freed.add(x);
  }
  const ways: [readonly number[], number, number][] = [
    [t.give, from, to],
    [t.take, to, from],
  ];
  for (const [regs, giver, receiver] of ways) {
    let vp = 0;
    for (const r of regs) {
      const k = negPeaceRegionBlock(s, receiver, r);
      if (k !== null) return k;
      if (f.legalOwner(r) !== giver || f.isZone(r)) return "peace_bad_terms";
      if (r === f.capital(giver)) return "peace_capital";
      vp += f.vp(r);
    }
    if (vp * 100 > f.legalVp(giver) * WW_NEG_PEACE_MAX_VP_PCT) {
      return "peace_too_much";
    }
  }
  return null;
}

/** Factories a day a reparations level takes of `civs` civilian factories (at least 1 when it has any). */
export function negPeaceRepK(civs: number, level: number): number {
  if (level <= 0 || civs <= 0) return 0;
  return Math.max(
    1,
    Math.floor((civs * level * WW_NEG_REPARATIONS_STEP_PCT) / 100),
  );
}

/** Points `k` factories a day for WW_NEG_REPARATIONS_DAYS are worth (the conference's price, prorated). */
export function negPeaceRepValue(k: number): number {
  if (k <= 0) return 0;
  return Math.floor(
    (reparationsCost(k) * WW_NEG_REPARATIONS_DAYS) / WW_REPARATIONS_DAYS,
  );
}

/** Points region `r` is worth to a receiving side (`side`: its members): less when it already controls it. */
export function negPeaceRegionValue(
  f: NegPeaceFacts,
  r: number,
  side: (id: number) => boolean,
): number {
  const b = f.base(r);
  return side(f.controller(r))
    ? Math.floor((b * NEG_PEACE_CONTROLLED_PCT) / 100)
    : b;
}

/**
 * The terms' worth to the target's side, in points: the regions it gets
 * (less those it controls already), reparations it gets and subjects of
 * the proposer set free, less what it gives the same way.
 */
export function negPeaceValue(
  f: NegPeaceFacts,
  t: WwPeaceTerms,
  from: number,
  to: number,
  fromSide: (id: number) => boolean,
  toSide: (id: number) => boolean,
): number {
  let v = 0;
  for (const r of t.give) v += negPeaceRegionValue(f, r, toSide);
  for (const r of t.take) v -= negPeaceRegionValue(f, r, fromSide);
  v += negPeaceRepValue(negPeaceRepK(f.civs(from), t.pay));
  v -= negPeaceRepValue(negPeaceRepK(f.civs(to), t.demand));
  for (const x of t.free) {
    const w = Math.floor((f.legalBase(x) * NEG_PEACE_RELEASE_PCT) / 100);
    v += f.overlordOf(x) === from ? w : -w;
  }
  return v;
}

/** What the AI target weighs an offer against (the war's state, not the terms). */
export interface NegPeaceJudge {
  /** The white peace's accept chance, percent (0: it refuses one outright). */
  pct: number;
  /** Value per percent of chance, in thousandths of a point. */
  unit: number;
  /** The extra a clearly winning side needs, points. */
  winNeed: number;
}

/** Thousandths of a point per percent: AI_NEG_UNIT_PM of the smaller side's land value (at least 1). */
export function negPeaceUnit(proposerBase: number, targetBase: number): number {
  const stake =
    proposerBase > 0 && targetBase > 0
      ? Math.min(proposerBase, targetBase)
      : Math.max(proposerBase, targetBase);
  return Math.max(1, stake * AI_NEG_UNIT_PM);
}

/** Points worth `pct` percent of chance by `j` (rounded down). */
export function negPeacePctValue(j: NegPeaceJudge, pct: number): number {
  return Math.floor((j.unit * pct) / 1000);
}

/**
 * The extra a side that would refuse a white peace (`pct` 0) needs: its
 * lead (‰: the proposer's way to its surrender line, or the share of its
 * land held) times AI_NEG_WIN_PCT of the proposer's land value. Nothing
 * while a white peace has a chance.
 */
export function negPeaceWinNeed(
  pct: number,
  leadPm: number,
  proposerBase: number,
): number {
  if (pct > 0) return 0;
  const lead = Math.max(0, Math.min(1000, leadPm));
  return Math.floor((proposerBase * lead * AI_NEG_WIN_PCT) / 100_000);
}

/**
 * The value the AI target needs at seeded `roll` (0..99), in thousandths
 * of a point: what its lead asks plus a unit per percent the roll lies
 * past its white-peace chance. A side losing badly (a high chance) needs
 * less than nothing: it gives.
 */
export function negPeaceNeedMilli(j: NegPeaceJudge, roll: number): number {
  return j.winNeed * 1000 + j.unit * (roll + 1 - j.pct);
}

/**
 * The AI's answer: value ≥ need. With no terms (value 0) it is the white
 * peace's rule exactly — accepted when the roll is under its chance.
 */
export function negPeaceAccepts(
  j: NegPeaceJudge,
  value: number,
  roll: number,
): boolean {
  return value * 1000 >= negPeaceNeedMilli(j, roll);
}

/** How many of the 100 rolls accept `value` (percent): the composer's hint. */
export function negPeaceChance(j: NegPeaceJudge, value: number): number {
  const n =
    Math.floor(((value - j.winNeed) * 1000) / Math.max(1, j.unit)) + j.pct;
  return Math.max(0, Math.min(100, n));
}

export type NegPeaceHint = "low" | "medium" | "high";

/** The chance in words. */
export function negPeaceHint(chance: number): NegPeaceHint {
  if (chance >= NEG_PEACE_HINT_HIGH_PCT) return "high";
  if (chance >= NEG_PEACE_HINT_MEDIUM_PCT) return "medium";
  return "low";
}
