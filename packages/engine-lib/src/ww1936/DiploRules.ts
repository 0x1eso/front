// World War 1936 diplomacy D3 (ww161 Design B §3; ww162 lane L2): the deal
// table's rules as pure functions. The engine checks, values and judges an
// offer with them (endgame/Deals.ts), and the composer greys an item and
// fills its "상대가 받아들일 가능성" bar with the same ones. Facts come in
// through DealFacts (the engine reads its state; the client its views).
// One currency, "value points": a region is worth the conference's base
// value, equipment its production cost (WW_DEAL_IC_PER_POINT industry a
// point). Integers only; regions by id, countries by smallID.
import {
  type DealItem,
  WW_PROMISE_BORDER_VP,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  EQUIP_KEYS,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { NON_TRANSFERABLE } from "./DepthRules";
import { unitCostMilli } from "./Equipment";
import { WW_PROMISE_ALLY_PTS, WW_PROMISE_WANTED_X } from "./PromiseRules";

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

// ---- One item's value (the engine's judge and the composer's bar) ----

/**
 * What an item's value reads. The engine answers from its state; the
 * client from its views and the dealJudge row (DiploTypes.WwDealJudgeRow),
 * which carries the parts only the engine can price (the `*Pts` ones and
 * joinPts/hasArmy). Countries by smallID.
 */
export interface DealValueFacts {
  legalOwner(region: number): number;
  /** The conference's base value of a region (EndgameRules.regionBaseValue). */
  regionBase(region: number): number;
  vp(region: number): number;
  neighbours(region: number): readonly number[];
  /** The regions of content group `group`. */
  groupRegions(group: string): readonly number[];
  hasCore(id: number, region: number): boolean;
  /** `region` lies in one of `id`'s claim groups. */
  claims(id: number, region: number): boolean;
  /** A region between these two moves as a wartime deal (wartimeDeal). */
  wartime(giver: number, taker: number): boolean;
  /** In peacetime `judge` cedes non-core land to `taker` at all. */
  cedesTo(judge: number, taker: number): boolean;
  /** Access through `giver`, to `judge` that gets it. */
  accessGetPts(judge: number, giver: number): number;
  /** `judge` opening its land to `taker`. */
  accessGivePts(judge: number, taker: number): number;
  /** A pact with `other`, to `judge`. */
  napPts(judge: number, other: number): number;
  /** A guarantee between `judge` and `other` (`gets`: `other` guarantees `judge`). */
  guaranteePts(judge: number, other: number, gets: boolean): number;
  /** A licence of `item` from `giver` to `taker`, to `judge` (one of the two). */
  licencePts(
    giver: number,
    taker: number,
    item: Extract<DealItem, { kind: "licence" }>,
    judge: number,
  ): number;
  /** `id` has an army (an ally worth having). */
  hasArmy(id: number): boolean;
  /** `joiner` joining war `war` on `side`'s side, to the joiner: −WW_PROMISE_JOIN_PTS or WW_DEAL_VETO. */
  joinPts(joiner: number, war: number, side: number): number;
}

/** The regions of `group` that are `target`'s by law now, ascending. */
export function promisedRegionsOf(
  v: Pick<DealValueFacts, "groupRegions" | "legalOwner">,
  target: number,
  group: string,
): number[] {
  return v
    .groupRegions(group)
    .filter((r) => v.legalOwner(r) === target)
    .sort((a, b) => a - b);
}

/**
 * How much `id` wants `regions` (a promised group): 2 when one is its core
 * or claim, 1 when the group borders its land and holds
 * WW_PROMISE_BORDER_VP victory points or more, else 0.
 */
export function promiseWantOf(
  v: Pick<
    DealValueFacts,
    "hasCore" | "claims" | "vp" | "neighbours" | "legalOwner"
  >,
  id: number,
  regions: readonly number[],
): 0 | 1 | 2 {
  if (regions.some((r) => v.hasCore(id, r) || v.claims(id, r))) return 2;
  let vp = 0;
  let borders = false;
  for (const r of regions) {
    vp += v.vp(r);
    if (!borders) borders = v.neighbours(r).some((n) => v.legalOwner(n) === id);
  }
  return borders && vp >= WW_PROMISE_BORDER_VP ? 1 : 0;
}

/**
 * `item`'s value points to `judge` (its giver or its taker): positive is
 * good for it, WW_DEAL_VETO an item it never gives.
 *
 * A region, to its taker: its base, × WW_DEAL_WANTED_REGION_X when its core
 * or claim. To its giver: in peacetime never, unless it cedes to the taker
 * and it is no core; land it only holds costs its base (half when owed to
 * the taker); its own land × WW_DEAL_OWN_REGION_X, a core ×
 * WW_DEAL_CORE_REGION_X. Equipment and lend-lease cost what they cost.
 * A promise, to its receiver: the group's base × WW_PROMISE_WANTED_X when
 * its core or claim, × 1 when it only borders it, else nothing; to the
 * promiser never its core, its claim at twice the base, else half. Joining a
 * war: to the side joined WW_PROMISE_ALLY_PTS when the joiner has an army;
 * to the joiner, joinPts.
 */
export function dealItemPoints(
  v: DealValueFacts,
  giver: number,
  taker: number,
  item: DealItem,
  judge: number,
): number {
  const gets = judge === taker;
  const other = gets ? giver : taker;
  switch (item.kind) {
    case "region": {
      const r = item.region;
      const base = Math.max(1, v.regionBase(r));
      const wanted = (id: number) => v.hasCore(id, r) || v.claims(id, r);
      if (gets) return wanted(judge) ? base * WW_DEAL_WANTED_REGION_X : base;
      if (
        !v.wartime(giver, taker) &&
        (v.hasCore(judge, r) || !v.cedesTo(judge, taker))
      ) {
        return WW_DEAL_VETO;
      }
      const legal = v.legalOwner(r);
      if (legal !== judge) {
        return -(wanted(taker) || legal === taker
          ? Math.floor(base / 2)
          : base);
      }
      return -(v.hasCore(judge, r)
        ? base * WW_DEAL_CORE_REGION_X
        : base * WW_DEAL_OWN_REGION_X);
    }
    case "equipment": {
      const p = dealCostPoints(equipKeyCostMilli(item.key), item.count);
      return gets ? p : -p;
    }
    case "lend_lease": {
      const p = dealCostPoints(
        lendLeaseCostMilli(item.item, item.gen),
        item.perMonth * item.months,
      );
      return gets ? p : -p;
    }
    case "licence":
      return v.licencePts(giver, taker, item, judge);
    case "access":
      return gets
        ? v.accessGetPts(judge, giver)
        : v.accessGivePts(judge, taker);
    case "nap":
      return v.napPts(judge, other);
    case "guarantee":
      return v.guaranteePts(judge, other, gets);
    case "promise": {
      const regions = promisedRegionsOf(v, item.target, item.group);
      let base = 0;
      for (const r of regions) base += Math.max(1, v.regionBase(r));
      if (gets) {
        const want = promiseWantOf(v, judge, regions);
        return want === 2 ? base * WW_PROMISE_WANTED_X : want === 1 ? base : 0;
      }
      if (regions.some((r) => v.hasCore(judge, r))) return WW_DEAL_VETO;
      if (regions.some((r) => v.claims(judge, r))) {
        return -base * WW_DEAL_WANTED_REGION_X;
      }
      return -Math.floor(base / 2);
    }
    case "join_war":
      if (gets) return v.hasArmy(giver) ? WW_PROMISE_ALLY_PTS : 0;
      return v.joinPts(giver, item.war, taker);
  }
}

/** The deal's value points to its target `to`: what it gets less what it gives (a veto sinks it). */
export function dealNetPoints(
  v: DealValueFacts,
  from: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
): number {
  let net = 0;
  for (const [g, t, list] of [
    [from, to, give],
    [to, from, take],
  ] as const) {
    for (const i of list) {
      const p = dealItemPoints(v, g, t, i, to);
      if (p <= WW_DEAL_VETO) return WW_DEAL_VETO;
      net += p;
    }
  }
  return Math.max(WW_DEAL_VETO, net);
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
