// World War 1936 diplomacy D3 (ww161 Design B §3; ww162 lane L2): the deal
// table's rules as pure functions. The engine checks, values and judges an
// offer with them (endgame/Deals.ts), and the composer greys an item and
// fills its "상대가 받아들일 가능성" bar with the same ones. Facts come in
// through DealFacts (the engine reads its state; the client its views).
// One currency, "value points": a region is worth the conference's base
// value, equipment its production cost (WW_DEAL_IC_PER_POINT industry a
// point). Integers only; regions by id, countries by smallID.
import type { DealItem } from "@openfront/engine-api/ww1936/DiploTypes";
import {
  EQUIP_KEYS,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { NON_TRANSFERABLE } from "./DepthRules";
import { unitCostMilli } from "./Equipment";

// ---- Value points (named; L7 tunes them) ----

/** Industry (whole units of production cost) one value point stands for. */
export const WW_DEAL_IC_PER_POINT = 50;
/** One unit of fuel's worth, milli-industry (fuel has no production cost). */
export const WW_DEAL_FUEL_COST_MILLI = 100;
/** A region the judge gives away that it owns: this × its base value… */
export const WW_DEAL_OWN_REGION_X = 2;
/** …and one it has a core on: this ×. */
export const WW_DEAL_CORE_REGION_X = 3;
/** A region the judge gets that is its core or claim: this × its base value. */
export const WW_DEAL_WANTED_REGION_X = 2;
/** A licence: this much… */
export const WW_DEAL_LICENCE_PTS = 2;
/** …plus this much a year the design is ahead of the taker's own line. */
export const WW_DEAL_LICENCE_YEAR_PTS = 3;
/** What the licensor gives up: little, unless it would not license the taker at all. */
export const WW_DEAL_LICENCE_GIVE_PTS = 2;
export const WW_DEAL_LICENCE_REFUSE_PTS = 20;
/** Access through the giver to a country the taker fights or aims at. */
export const WW_DEAL_ACCESS_NEED_PTS = 12;
/** Opening one's land always costs at least this little. */
export const WW_DEAL_ACCESS_MINUS = 2;
/** The plain ask's accept score (AiPolitics.AI_ACCEPT_SCORE): 0 points there. */
export const WW_DEAL_SCORE_ZERO = 50;
/** A treaty's accept score above (below) that zero, per point. */
export const WW_DEAL_ACCESS_SCORE_DIV = 10;
export const WW_DEAL_NAP_SCORE_DIV = 5;
/** A guarantee got from a major, from anyone else; one given (the same ideology, other). */
export const WW_DEAL_GUARANTEE_MAJOR_PTS = 8;
export const WW_DEAL_GUARANTEE_PTS = 3;
export const WW_DEAL_GUARANTEE_GIVE_SAME_PTS = 2;
export const WW_DEAL_GUARANTEE_GIVE_PTS = 6;
/** An item the judge would never give, whatever it gets (a veto). */
export const WW_DEAL_VETO = -1_000_000;

// ---- The judge's margin and roll ----

/** The value an AI wants on top of an even deal… */
export const WW_DEAL_MARGIN_BASE = 5;
/** …plus a point for every this much opinion under 0… */
export const WW_DEAL_MARGIN_OPINION_DIV = 10;
/** …plus this with another ideology… */
export const WW_DEAL_MARGIN_IDEOLOGY = 5;
/** …less this toward its faction leader or overlord (never under 0). */
export const WW_DEAL_MARGIN_LEADER = 5;
/** Within this many points of the margin a seeded roll decides. */
export const WW_DEAL_ROLL_BAND = 4;

/** The judge's mood toward the proposer. */
export interface DealMood {
  /** The judge's opinion of the proposer, −100..100. */
  opinion: number;
  sameIdeology: boolean;
  /** The proposer is the judge's faction leader or overlord. */
  leader: boolean;
}

/** The value points the judge wants on top of an even deal (≥ 0). */
export function dealMargin(m: DealMood): number {
  let v = WW_DEAL_MARGIN_BASE;
  if (m.opinion < 0) v += Math.ceil(-m.opinion / WW_DEAL_MARGIN_OPINION_DIV);
  if (!m.sameIdeology) v += WW_DEAL_MARGIN_IDEOLOGY;
  if (m.leader) v -= WW_DEAL_MARGIN_LEADER;
  return Math.max(0, v);
}

/**
 * A gift: the receiver gives nothing and is bound to nothing (a pact binds
 * both, so a deal with one is no gift). It applies at once, with no card.
 */
export function isGift(
  give: readonly DealItem[],
  take: readonly DealItem[],
): boolean {
  return (
    take.length === 0 && give.length > 0 && !give.some((i) => i.kind === "nap")
  );
}

/**
 * The judge's chance to accept, percent: a gift whenever it is worth
 * nothing less than 0; otherwise 100 from WW_DEAL_ROLL_BAND over the
 * margin, 0 under −WW_DEAL_ROLL_BAND, linear between. A veto is 0.
 */
export function dealAcceptPct(
  net: number,
  margin: number,
  gift: boolean,
): number {
  if (net <= WW_DEAL_VETO / 2) return 0;
  if (gift) return net >= 0 ? 100 : 0;
  const d = net - margin;
  if (d >= WW_DEAL_ROLL_BAND) return 100;
  if (d < -WW_DEAL_ROLL_BAND) return 0;
  return Math.max(
    0,
    Math.min(100, 50 + Math.floor((d * 50) / WW_DEAL_ROLL_BAND)),
  );
}

/** The judge's answer at its seeded `roll` (0..99). */
export function dealAccepts(
  net: number,
  margin: number,
  gift: boolean,
  roll: number,
): boolean {
  return roll < dealAcceptPct(net, margin, gift);
}

// ---- Item values (positive: good for the judge) ----

/** `count` units at `costMilli` each, in points (rounded down). */
export function dealCostPoints(costMilli: number, count: number): number {
  return Math.floor((costMilli * count) / (1000 * WW_DEAL_IC_PER_POINT));
}

/** One unit's production cost of an EQUIP_KEYS item, milli (0: no such key). */
export function equipKeyCostMilli(key: number): number {
  const k = EQUIP_KEYS[key];
  return k === undefined ? 0 : unitCostMilli(k[0], k[1]);
}

/** A lend-lease item's unit cost, milli (fuel: WW_DEAL_FUEL_COST_MILLI; gen 0: gen 1's). */
export function lendLeaseCostMilli(item: string, gen: number): number {
  if (item === "fuel") return WW_DEAL_FUEL_COST_MILLI;
  const k = EQUIP_KEYS.findIndex(
    ([t, g]) => t === item && g === Math.max(1, gen),
  );
  return k < 0 ? 0 : equipKeyCostMilli(k);
}

/** A licence for a design `gapYears` ahead of the taker's own line, to the taker. */
export function licencePoints(gapYears: number): number {
  return WW_DEAL_LICENCE_PTS + Math.max(0, gapYears) * WW_DEAL_LICENCE_YEAR_PTS;
}

/** Giving access, to the giver, from its accept score for the plain ask (at most −WW_DEAL_ACCESS_MINUS). */
export function accessGivePoints(score: number): number {
  return (
    Math.min(
      0,
      Math.floor((score - WW_DEAL_SCORE_ZERO) / WW_DEAL_ACCESS_SCORE_DIV),
    ) - WW_DEAL_ACCESS_MINUS
  );
}

/** A pact, to either side, from its accept score for the plain ask. */
export function napPoints(score: number): number {
  return Math.floor((score - WW_DEAL_SCORE_ZERO) / WW_DEAL_NAP_SCORE_DIV);
}

/** A guarantee: got (from a major or not), or given (to the same ideology or not). */
export function guaranteePoints(
  judgeGets: boolean,
  otherMajor: boolean,
  sameIdeology: boolean,
): number {
  if (judgeGets) {
    return otherMajor ? WW_DEAL_GUARANTEE_MAJOR_PTS : WW_DEAL_GUARANTEE_PTS;
  }
  return -(sameIdeology
    ? WW_DEAL_GUARANTEE_GIVE_SAME_PTS
    : WW_DEAL_GUARANTEE_GIVE_PTS);
}

// ---- Facts and checks ----

/** The state the region and treaty checks read. */
export interface DealFacts {
  legalOwner(region: number): number;
  controller(region: number): number;
  /** The region of `id`'s capital (0: none). */
  capital(id: number): number;
  isZone(region: number): boolean;
  atWar(a: number, b: number): boolean;
  hasWar(id: number): boolean;
  /** `a` and `b` fight on one side of an ongoing war. */
  sameSide(a: number, b: number): boolean;
  sameFaction(a: number, b: number): boolean;
  /** `by`'s armies may enter `from`'s land. */
  hasAccess(by: number, from: number): boolean;
  hasNap(a: number, b: number): boolean;
  guarantees(by: number, to: number): boolean;
}

/**
 * A region moves in wartime: the two fight on one side of a war, or one
 * of them is at war at all (then only between one side's members).
 */
export function wartimeDeal(
  f: DealFacts,
  giver: number,
  taker: number,
): boolean {
  return f.sameSide(giver, taker) || f.hasWar(giver) || f.hasWar(taker);
}

/**
 * Why `giver` may not give `region` to `taker` (null: it may). Never the
 * capital of its legal owner nor an occupation zone. In peacetime: legal
 * land the giver holds itself, between anyone. In wartime, only between
 * one side's members: land the giver holds that is its own, the taker's,
 * or an enemy's of the taker (the ally-to-ally transfer — control moves,
 * and the receiver holds it at the conference).
 */
export function dealRegionBlock(
  f: DealFacts,
  giver: number,
  taker: number,
  region: number,
): WwOrderBlock | null {
  const legal = f.legalOwner(region);
  if (region <= 0 || legal <= 0 || f.isZone(region)) return "deal_bad_item";
  if (f.controller(region) !== giver) return "deal_bad_item";
  if (f.capital(legal) === region) return "peace_capital";
  if (!wartimeDeal(f, giver, taker)) {
    return legal === giver ? null : "deal_bad_item";
  }
  if (!f.sameSide(giver, taker)) return "deal_bad_item";
  if (legal === giver || legal === taker) return null;
  return f.atWar(taker, legal) ? null : "deal_bad_item";
}

/** Why `giver` may not give `taker` access, a pact or a guarantee (null: it may; the guarantee's gate is the engine's). */
export function dealTreatyBlock(
  f: DealFacts,
  kind: "access" | "nap" | "guarantee",
  giver: number,
  taker: number,
): WwOrderBlock | null {
  if (f.atWar(giver, taker)) return "deal_bad_item";
  switch (kind) {
    case "access":
      if (f.hasAccess(taker, giver)) return "treaty_exists";
      return f.sameFaction(giver, taker) ? "treaty_exists" : null;
    case "nap":
      return f.hasNap(giver, taker) ? "treaty_exists" : null;
    case "guarantee":
      if (f.guarantees(giver, taker)) return "treaty_exists";
      return f.sameFaction(giver, taker) ? "deal_bad_item" : null;
  }
}

/** Why an equipment lump of `count` of EQUIP_KEYS `key` can't go from a stock of `stock` (null: it can). */
export function dealEquipBlock(
  key: number,
  count: number,
  stock: number,
): WwOrderBlock | null {
  const k = EQUIP_KEYS[key];
  if (k === undefined || NON_TRANSFERABLE.includes(k[0])) {
    return "deal_bad_item";
  }
  return count <= 0 || stock < count ? "deal_bad_item" : null;
}

/** Two items that may not both stand in one deal: the same item, or the same region (or a pact) either way. */
function itemKey(i: DealItem): string {
  switch (i.kind) {
    case "region":
      return `region:${i.region}`;
    case "nap":
      return "nap";
    case "equipment":
      return `equipment:${i.key}`;
    case "lend_lease":
      return `lend_lease:${i.item}:${i.gen}`;
    case "licence":
      return `licence:${i.key}:${i.ship ?? 0}`;
    case "access":
    case "guarantee":
      return i.kind;
    case "promise":
      return `promise:${i.target}:${i.group}`;
    case "join_war":
      return `join_war:${i.war}:${i.target}`;
  }
}

/**
 * The deal's shape (null: fine): not empty; no item twice in one list; a
 * region in only one list; a pact once. (The lists' lengths are the
 * schema's.)
 */
export function dealShapeBlock(
  give: readonly DealItem[],
  take: readonly DealItem[],
): WwOrderBlock | null {
  if (give.length + take.length === 0) return "deal_empty";
  const shared = new Set<string>();
  for (const list of [give, take]) {
    const seen = new Set<string>();
    for (const i of list) {
      const k = itemKey(i);
      if (seen.has(k)) return "deal_bad_item";
      seen.add(k);
      if (i.kind === "region" || i.kind === "nap") {
        if (shared.has(k)) return "deal_bad_item";
        shared.add(k);
      }
    }
  }
  return null;
}
