// World War 1936 diplomacy D3 (ww161 Design B §3; lane L2): the deal table —
// an offer's life (send, AI answer, card deadline, accept, lapse), its items
// (DealItemSchema; promise and join_war are Promises.ts's), the AI's value
// points and its few offers, the ally-to-ally transfer, and the `diplomacy`
// auto switch for deals. The rules themselves are engine-lib DiploRules
// (the composer greys and judges with the same ones); this file reads the
// state for them and makes an accepted deal happen through the existing
// primitives (regions as negotiated peace cedes them, lend-lease and
// licences through their own exported functions, the treaties').
//
// A human target's card is the one answer card it shares with peace offers
// and ultimatums, shown one at a time in id order: a deal waiting behind
// another card keeps deadlineTick −1 and gets its full window once it is in
// front. A gift (nothing asked back) applies at once, with no card.
// Integers only; countries, regions and offers by id.
import type { DiploOrder } from "@openfront/engine-api/Schemas";
import {
  type DealItem,
  DIPLO_COOLDOWN_KINDS,
  DIPLO_NOTICES,
  noticeId,
  WW_DEAL_AI_TO_HUMAN_DAYS,
  WW_DEAL_CARD_TICKS,
  WW_DEAL_CEDE_OPINION,
  WW_DEAL_PP,
  WW_DEAL_REFUSAL_DAYS,
  type WwDealJudgeRow,
} from "@openfront/engine-api/ww1936/DiploTypes";
import {
  EQUIP_KEYS,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LendLeaseItem,
  WW_LL_LAND_DAYS,
  WW_LL_SEA_KM_PER_DAY,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  accessGivePoints,
  dealAccepts,
  dealCostPoints,
  dealEquipBlock,
  type DealFacts,
  dealMargin,
  type DealMood,
  dealRegionBlock,
  dealShapeBlock,
  dealTreatyBlock,
  equipKeyCostMilli,
  guaranteePoints,
  isGift,
  lendLeaseCostMilli,
  licencePoints,
  napPoints,
  wartimeDeal,
  WW_DEAL_ACCESS_NEED_PTS,
  WW_DEAL_CORE_REGION_X,
  WW_DEAL_IC_PER_POINT,
  WW_DEAL_LICENCE_GIVE_PTS,
  WW_DEAL_LICENCE_REFUSE_PTS,
  WW_DEAL_OWN_REGION_X,
  WW_DEAL_ROLL_BAND,
  WW_DEAL_VETO,
  WW_DEAL_WANTED_REGION_X,
} from "@openfront/engine-lib/ww1936/DiploRules";
import {
  lendLeaseSeaDays,
  llLimitBlock,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
import { guaranteeGate } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  aiAcceptsLicence,
  grantLicence,
  keyYear,
  licenceRequestBlock,
  lineNewestYear,
} from "../depth/Licences";
import { drawEquip } from "../economy/Stock";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { convoyPath, portZonesOf, srsOf } from "../navy/Convoys";
import { aiAcceptScore } from "../politics/AiPolitics";
import { isMajor } from "../politics/Factions";
import { payPp } from "../politics/PayPp";
import { ruleValue } from "../politics/Spirits";
import {
  addAccess,
  addGuarantee,
  addNap,
  opinionOf,
} from "../politics/Treaties";
import { landRegained } from "./Activate";
import { regionBase } from "./Conference";
import {
  diploCooldownUntil,
  setDiploCooldown,
  type StoredDeal,
} from "./DiploState";
import {
  addContract,
  aidRuleBlocks,
  contractsOf,
  hasNoLendLease,
  landRoute,
  llOrderBlock,
  markAid,
  removeContract,
  sameSideWar,
  validId,
} from "./LendLease";
import {
  applyPromiseItem,
  promiseDealBlock,
  promiseItemBlock,
  promiseItemValue,
} from "./Promises";
import { countryParams } from "./Wars";
import type { WwEndgame } from "./WwEndgame";

/** A deal's lend-lease month (LendLease's: perMonth over 30 days). */
export const WW_DEAL_MONTH_DAYS = 30;
/** An AI looks for its own offers this often (staggered by smallID). */
export const WW_DEAL_AI_CHECK_DAYS = 30;
/** An AI offers the same country a deal at most this often. */
export const WW_DEAL_AI_PAIR_DAYS = 90;
/** An AI buying access pays with at most this share of a stock (percent)… */
export const WW_DEAL_AI_STOCK_PCT = 20;
/** …and only from a giver whose plain-ask score is at least this (lower: hopeless). */
export const WW_DEAL_AI_ACCESS_MIN_SCORE = 0;
/** The most regions a side leader hands one ally at a time. */
export const WW_DEAL_AI_TRANSFER_MAX = 6;
/** The plain access ask's accept score (AiPolitics.AI_ACCEPT_SCORE). */
const AI_ACCESS_SCORE = 50;
const P_DEAL = idHash("deal");
const DEAL_LL_KIND = DIPLO_COOLDOWN_KINDS.indexOf("deal_lend_lease");

// ---- Facts ----

/** The capital region of `id` (0: none). */
function capitalOf(eg: WwEndgame, id: number): number {
  const sc = eg.ww.scenario;
  const tag = sc.tagOfSmallId(id);
  const tile = tag === undefined ? null : sc.capitalTileOrNull(tag);
  return tile === null ? 0 : sc.regionAt(tile);
}

/** The state as DiploRules reads it. */
export function dealFacts(eg: WwEndgame): DealFacts {
  const ww = eg.ww;
  const pol = ww.politics;
  return {
    legalOwner: (r) => pol.legalOwner[r] ?? 0,
    controller: (r) => ww.land.controller[r] ?? 0,
    capital: (id) => capitalOf(eg, id),
    isZone: (r) => eg.isZone(r),
    atWar: (a, b) => ww.isAtWar(a, b),
    hasWar: (id) => ww.hasWar(id),
    sameSide: (a, b) => sameSideWar(eg, a, b) > 0,
    sameFaction: (a, b) => ww.sameFaction(a, b),
    hasAccess: (by, from) => pol.hasAccess(by, from),
    hasNap: (a, b) => pol.isAtWarBlockedByNap(a, b),
    guarantees: (by, to) =>
      pol.guarantees.some((g) => g.by === by && g.to === to),
  };
}

/** `region` lies in one of `id`'s claim groups (content CLAIMS). */
export function claimsRegion(
  eg: WwEndgame,
  id: number,
  region: number,
): boolean {
  const pol = eg.ww.politics;
  const tag = pol.tagOf(id);
  for (const row of pol.content.claims) {
    if (row.tag !== tag) continue;
    for (const g of row.groups) {
      if (pol.content.groupIdx.get(g)?.regions.includes(region)) return true;
    }
  }
  return false;
}

const wanted = (eg: WwEndgame, id: number, r: number): boolean =>
  eg.hasCore(id, r) || claimsRegion(eg, id, r);

/** `id`'s faction leader (0: none, or itself). */
function factionLeaderOf(eg: WwEndgame, id: number): number {
  const pol = eg.ww.politics;
  const f = pol.faction(pol.factionIdx(id));
  return f === null || f.leader === id ? 0 : f.leader;
}

/** Whom `id` means to fight: its war goals, its justification, its enemies. */
function plannedTargets(eg: WwEndgame, id: number): number[] {
  const c = eg.ww.politics.country(id);
  if (c === null) return [];
  const out = new Set<number>(c.warGoals.map((g) => g.on));
  if (c.justification !== null) out.add(c.justification.on);
  for (const t of eg.ww.enemiesOf(id)) out.add(t);
  return [...out].sort((a, b) => a - b);
}

function justifiedAgainst(eg: WwEndgame, id: number): boolean {
  return eg.ww.politics.list().some((c) => c.justification?.on === id);
}

// ---- Items: checks ----

/** The harbours goods for `to` may land in: its own, an exile's host's (LendLease's rule). */
function receivingPorts(eg: WwEndgame, to: number): readonly number[] {
  const navy = eg.ww.navy;
  const own = portZonesOf(navy, to);
  if (own.length > 0) return own;
  const host = eg.exileHost(to);
  return host > 0 ? portZonesOf(navy, host) : own;
}

/** How an equipment lump goes: by land in WW_LL_LAND_DAYS, by convoy, or not at all. */
function lumpRoute(
  eg: WwEndgame,
  from: number,
  to: number,
): { days: number; srs: number[]; sea: boolean } | null {
  if (landRoute(eg, from, to)) {
    return { days: WW_LL_LAND_DAYS, srs: [], sea: false };
  }
  const navy = eg.ww.navy;
  const p = convoyPath(
    navy,
    from,
    portZonesOf(navy, from),
    receivingPorts(eg, to),
  );
  if (p === null) return null;
  return {
    days: lendLeaseSeaDays(p.km, WW_LL_SEA_KM_PER_DAY),
    srs: srsOf(eg.ww.scenario, p.zones),
    sea: true,
  };
}

/** LendLease's item check: fuel at gen 0; equipment at gen 0 (every one) or a real generation. */
function llItemOk(item: string, gen: number): boolean {
  if (item === "fuel") return gen === 0;
  return gen === 0 || EQUIP_KEYS.some(([t, g]) => t === item && g === gen);
}

/** Why `giver` may not give `item` to `taker` today (null: it may). */
export function dealItemBlock(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: DealItem,
  day: number,
  f: DealFacts = dealFacts(eg),
): WwOrderBlock | null {
  const ww = eg.ww;
  const pol = ww.politics;
  switch (item.kind) {
    case "region":
      return dealRegionBlock(f, giver, taker, item.region);
    case "equipment": {
      if (ww.isAtWar(giver, taker)) return "deal_bad_item";
      if (hasNoLendLease(pol, giver) || aidRuleBlocks(pol, giver, taker)) {
        return "ll_conditions";
      }
      const ce = ww.economy.country(giver);
      const b = dealEquipBlock(item.key, item.count, ce?.stock[item.key] ?? 0);
      if (b !== null) return b;
      return lumpRoute(eg, giver, taker) === null ? "no_sea_path" : null;
    }
    case "lend_lease":
      if (!llItemOk(item.item, item.gen)) return "deal_bad_item";
      return (
        llOrderBlock(eg, giver, taker, day) ??
        llLimitBlock(contractsOf(eg, giver).length)
      );
    case "licence":
      return licenceRequestBlock(
        ww.depth,
        taker,
        giver,
        item.key,
        item.ship ?? 0,
      );
    case "access":
    case "nap":
      return dealTreatyBlock(f, item.kind, giver, taker);
    case "guarantee": {
      const b = dealTreatyBlock(f, "guarantee", giver, taker);
      if (b !== null) return b;
      const c = pol.country(giver);
      if (c === null) return "dead";
      // Treaties' own guarantee rule: not on one it aims at; a democracy's gate.
      if (pol.hasWarGoal(giver, taker) || c.justification?.on === taker) {
        return "deal_bad_item";
      }
      const gate = ruleValue(pol, giver, "guaranteeGatePct") ?? 25;
      return guaranteeGate(
        c.ruling,
        pol.wtBp,
        justifiedAgainst(eg, taker),
        gate,
      )
        ? null
        : "tension_gate";
    }
    case "promise":
    case "join_war":
      return promiseItemBlock(eg, giver, taker, item, day);
  }
}

/** Why `from` may not offer `to` these items today (the shape, then every item; null: it may). */
export function dealBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
  day: number,
): WwOrderBlock | null {
  const shape = dealShapeBlock(give, take);
  if (shape !== null) return shape;
  const f = dealFacts(eg);
  for (const i of give) {
    const b = dealItemBlock(eg, from, to, i, day, f);
    if (b !== null) return b;
  }
  for (const i of take) {
    const b = dealItemBlock(eg, to, from, i, day, f);
    if (b !== null) return b;
  }
  // L3: a promise goes to one that joins the war in the deal, or fights it already.
  return promiseDealBlock(eg, from, to, give, take);
}

// ---- Items: the AI's value points ----

/** In peacetime the AI `judge` cedes land to `taker` at all: its overlord, or its faction leader at WW_DEAL_CEDE_OPINION. */
function aiCedesTo(eg: WwEndgame, judge: number, taker: number): boolean {
  if (eg.subjectOf(judge)?.overlord === taker) return true;
  return (
    factionLeaderOf(eg, judge) === taker &&
    opinionOf(eg.ww.politics, judge, taker) >= WW_DEAL_CEDE_OPINION
  );
}

/** The AI `judge` would cede `region` to `taker` in peacetime (never its core). */
export function aiCedes(
  eg: WwEndgame,
  judge: number,
  taker: number,
  region: number,
): boolean {
  return !eg.hasCore(judge, region) && aiCedesTo(eg, judge, taker);
}

/** Access through `giver` is worth something to `taker`: it means to fight a neighbour of `giver` it does not border. */
function accessNeeded(eg: WwEndgame, taker: number, giver: number): boolean {
  const econ = eg.ww.economy;
  const mine = econ.countryNeighbours(taker);
  const theirs = econ.countryNeighbours(giver);
  return plannedTargets(eg, taker).some(
    (t) => t !== giver && theirs.includes(t) && !mine.includes(t),
  );
}

/** Region base values, per tick (the conference's base: DiploRules' region worth). */
const BASES = new WeakMap<
  WwEndgame,
  { tick: number; m: Map<number, number> }
>();
function regionBaseOf(eg: WwEndgame, r: number): number {
  const tick = eg.mg.ticks();
  let c = BASES.get(eg);
  if (c === undefined || c.tick !== tick) {
    c = { tick, m: new Map() };
    BASES.set(eg, c);
  }
  let v = c.m.get(r);
  if (v === undefined) {
    v = regionBase(eg, r);
    c.m.set(r, v);
  }
  return v;
}

/**
 * `item`'s value points to `judge` (the giver or the taker): positive is
 * good for it, WW_DEAL_VETO an item it never gives.
 */
export function dealItemValue(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: DealItem,
  judge: number,
): number {
  const gets = judge === taker;
  const ww = eg.ww;
  const pol = ww.politics;
  const other = gets ? giver : taker;
  switch (item.kind) {
    case "region": {
      const r = item.region;
      const base = Math.max(1, regionBaseOf(eg, r));
      if (gets) {
        return wanted(eg, judge, r) ? base * WW_DEAL_WANTED_REGION_X : base;
      }
      if (
        !wartimeDeal(dealFacts(eg), giver, taker) &&
        !aiCedes(eg, judge, taker, r)
      ) {
        return WW_DEAL_VETO;
      }
      const legal = pol.legalOwner[r] ?? 0;
      if (legal !== judge) {
        // Land it only holds: the ally it belongs to is owed it.
        return -(wanted(eg, taker, r) || legal === taker
          ? Math.floor(base / 2)
          : base);
      }
      return -(eg.hasCore(judge, r)
        ? base * WW_DEAL_CORE_REGION_X
        : base * WW_DEAL_OWN_REGION_X);
    }
    case "equipment": {
      const v = dealCostPoints(equipKeyCostMilli(item.key), item.count);
      return gets ? v : -v;
    }
    case "lend_lease": {
      const v = dealCostPoints(
        lendLeaseCostMilli(item.item, item.gen),
        item.perMonth * item.months,
      );
      return gets ? v : -v;
    }
    case "licence": {
      if (!gets) {
        return aiAcceptsLicence(ww.depth, judge, taker)
          ? -WW_DEAL_LICENCE_GIVE_PTS
          : -WW_DEAL_LICENCE_REFUSE_PTS;
      }
      const gap =
        (item.ship ?? 0) > 0 || EQUIP_KEYS[item.key] === undefined
          ? 0
          : keyYear(ww.depth, giver, item.key) -
            lineNewestYear(ww.depth, taker, item.key);
      return licencePoints(gap);
    }
    case "access":
      if (gets) {
        return accessNeeded(eg, judge, giver) ? WW_DEAL_ACCESS_NEED_PTS : 0;
      }
      return accessGivePoints(aiAcceptScore(pol, "access", taker, judge));
    case "nap":
      return napPoints(aiAcceptScore(pol, "nap", other, judge));
    case "guarantee":
      return guaranteePoints(
        gets,
        isMajor(pol, other),
        pol.country(judge)?.ruling === pol.country(other)?.ruling,
      );
    case "promise":
    case "join_war":
      return promiseItemValue(eg, giver, taker, item, judge);
  }
}

/** The deal's value points to its target `to` (what it gets less what it gives; a veto sinks it). */
export function dealNet(
  eg: WwEndgame,
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
      const v = dealItemValue(eg, g, t, i, to);
      if (v <= WW_DEAL_VETO) return WW_DEAL_VETO;
      net += v;
    }
  }
  return Math.max(WW_DEAL_VETO, net);
}

/** The AI `judge`'s mood toward `proposer`. */
export function dealMoodOf(
  eg: WwEndgame,
  judge: number,
  proposer: number,
): DealMood {
  const pol = eg.ww.politics;
  return {
    opinion: opinionOf(pol, judge, proposer),
    sameIdeology: pol.country(judge)?.ruling === pol.country(proposer)?.ruling,
    leader:
      eg.subjectOf(judge)?.overlord === proposer ||
      factionLeaderOf(eg, judge) === proposer,
  };
}

/** The offer's seeded roll, 0..99. */
export function dealRoll(eg: WwEndgame, o: StoredDeal): number {
  return (wwRoll(eg.ww.politics.seed, P_DEAL, o.id, o.from, o.to) >>> 8) % 100;
}

/** The AI target's answer: the value it gets against its margin, near-even by the roll. */
export function aiAcceptsDeal(eg: WwEndgame, o: StoredDeal): boolean {
  return dealAccepts(
    dealNet(eg, o.from, o.to, o.give, o.take),
    dealMargin(dealMoodOf(eg, o.to, o.from)),
    isGift(o.give, o.take),
    dealRoll(eg, o),
  );
}

// ---- Items: an accepted deal happens ----

/**
 * A region changes hands: the legal owner too when the giver owned it
 * (then no core comes with it, as a conference take), and control. In
 * peacetime the giver's divisions there go home; allies at war stay.
 */
function applyRegion(
  eg: WwEndgame,
  giver: number,
  taker: number,
  r: number,
  wartime: boolean,
  tick: number,
): void {
  const pol = eg.ww.politics;
  const land = eg.ww.land;
  const legal = pol.legalOwner[r] ?? 0;
  if (legal === giver) pol.setLegalOwner(r, taker);
  transferRegionPeaceful(land, r, taker, tick);
  if (!wartime) evictDivisions(land, r, giver);
  // An exile handed its own land back holds land again.
  if (legal === taker && eg.exileHost(taker) > 0) {
    landRegained(eg, taker, tick);
  }
  pol.markCountry(giver);
  pol.markCountry(taker);
  pol.markGlobal();
}

/** The equipment lump: out of the giver's stock now, in by the lend-lease route (no contract, no convoys allotted). */
function applyEquipment(
  eg: WwEndgame,
  giver: number,
  taker: number,
  key: number,
  count: number,
  day: number,
): void {
  const ce = eg.ww.economy.country(giver);
  const k = EQUIP_KEYS[key];
  const route = lumpRoute(eg, giver, taker);
  if (ce === null || k === undefined || route === null) return;
  const n = drawEquip(ce, key, count);
  if (n <= 0) return;
  eg.inTransit.push({
    // No contract (their ids start at 1).
    contract: 0,
    from: giver,
    to: taker,
    item: k[0],
    gen: k[1],
    countMilli: n * 1000,
    arriveDay: day + route.days,
    srs: [...route.srs],
    sea: route.sea,
    costMilli: unitCostMilli(k[0], k[1]),
  });
  eg.ww.economy.markCountryDirty(giver);
  markAid(eg, giver, taker);
}

function applyItem(
  eg: WwEndgame,
  giver: number,
  taker: number,
  item: DealItem,
  deal: number,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const day = Math.max(0, ww.day(tick));
  switch (item.kind) {
    case "region": {
      const wartime = wartimeDeal(dealFacts(eg), giver, taker);
      applyRegion(eg, giver, taker, item.region, wartime, tick);
      return;
    }
    case "equipment":
      applyEquipment(eg, giver, taker, item.key, item.count, day);
      return;
    case "lend_lease": {
      // Its own contract (not grown into a running one), ended after its
      // months by stepDeals.
      const c = addContract(
        eg,
        giver,
        taker,
        item.item as LendLeaseItem,
        item.gen,
        item.perMonth,
        day,
        null,
      );
      setDiploCooldown(
        eg,
        giver,
        c.id,
        "deal_lend_lease",
        day + item.months * WW_DEAL_MONTH_DAYS + 1,
      );
      return;
    }
    case "licence":
      grantLicence(ww.depth, giver, taker, item.key, item.ship ?? 0, day);
      return;
    case "access":
      addAccess(pol, taker, giver);
      return;
    case "nap":
      addNap(pol, giver, taker, day);
      return;
    case "guarantee":
      addGuarantee(pol, giver, taker, day);
      return;
    case "promise":
    case "join_war":
      applyPromiseItem(eg, giver, taker, item, deal, tick);
      return;
  }
}

/** Every item of an accepted deal, joining a war last (it changes the sides the others were checked on). */
export function applyDeal(
  eg: WwEndgame,
  id: number,
  from: number,
  to: number,
  give: readonly DealItem[],
  take: readonly DealItem[],
  tick: number,
): void {
  const all: [number, number, DealItem][] = [
    ...give.map((i): [number, number, DealItem] => [from, to, i]),
    ...take.map((i): [number, number, DealItem] => [to, from, i]),
  ];
  for (const [g, t, i] of all) {
    if (i.kind !== "join_war") applyItem(eg, g, t, i, id, tick);
  }
  for (const [g, t, i] of all) {
    if (i.kind === "join_war") applyItem(eg, g, t, i, id, tick);
  }
}

/** A deal's lend-lease contract that ran its months ends (its timer goes the next day). */
function endDealLendLease(eg: WwEndgame, day: number): void {
  for (const c of eg.diploCooldowns) {
    if (c[3] !== DEAL_LL_KIND || c[2] - 1 > day) continue;
    if (eg.lendLease.some((x) => x.id === c[1])) removeContract(eg, c[1]);
  }
}

// ---- An offer's life ----

const cardTicks = (eg: WwEndgame): number =>
  wwRealTicks(eg.mg.config().gameConfig(), WW_DEAL_CARD_TICKS);

/** The human `to`'s card in front: the lowest id among the offers waiting for it (peace, deals, ultimatums). */
function frontId(eg: WwEndgame, to: number): number {
  let id = Number.MAX_SAFE_INTEGER;
  for (const o of eg.peaceOffers) if (o.to === to && o.id < id) id = o.id;
  for (const o of eg.deals) if (o.to === to && o.id < id) id = o.id;
  for (const o of eg.ultimatums) if (o.to === to && o.id < id) id = o.id;
  return id;
}

const pendingPair = (eg: WwEndgame, a: number, b: number): boolean =>
  eg.deals.some(
    (o) => (o.from === a && o.to === b) || (o.from === b && o.to === a),
  );

/**
 * deal_offer from `from`: checked (both play, one pending deal a pair, the
 * wait after a refusal, the items), 10 political power, then pending — or,
 * a gift, done at once.
 */
export function offerDeal(
  eg: WwEndgame,
  from: number,
  order: Extract<DiploOrder, { kind: "deal_offer" }>,
  tick: number,
): WwOrderBlock | null {
  const ww = eg.ww;
  const day = ww.day(tick);
  if (ww.inPrep(tick) || day < 0) return "deal_cooldown";
  const to = order.to;
  if (!eg.isActor(from)) return "dead";
  if (to === from || !validId(eg, to) || !eg.isActor(to)) return "bad_target";
  if (pendingPair(eg, from, to)) return "deal_pending";
  if (diploCooldownUntil(eg, from, to, "deal_refused") > day) {
    return "deal_cooldown";
  }
  const block = dealBlock(eg, from, to, order.give, order.take, day);
  if (block !== null) return block;
  const pol = ww.politics;
  if (!payPp(pol, from, WW_DEAL_PP)) return "no_pp";
  pol.markCountry(from);
  const give = order.give.map((i) => ({ ...i }));
  const take = order.take.map((i) => ({ ...i }));
  const id = eg.nextOfferId++;
  if (isGift(give, take)) {
    applyDeal(eg, id, from, to, give, take, tick);
    eg.message(
      to,
      noticeId(DIPLO_NOTICES.dealGift),
      countryParams(eg, { country: from }),
    );
    eg.message(
      from,
      noticeId(DIPLO_NOTICES.dealAccepted),
      countryParams(eg, { target: to }),
    );
    return null;
  }
  const human = eg.isHumanControlled(to);
  eg.deals.push({
    id,
    from,
    to,
    give,
    take,
    sentTick: tick,
    // An AI answers on the next tick; a human's card waits its turn.
    deadlineTick: !human
      ? tick
      : frontId(eg, to) > id
        ? tick + cardTicks(eg)
        : -1,
  });
  eg.deals.sort((a, b) => a.id - b.id);
  eg.dirtyDiplo = true;
  return null;
}

/** deal_reply by `by` to pending deal `offer` (WwEndgame.issue routes an ultimatum's id to Ultimatum.ts). */
export function replyDeal(
  eg: WwEndgame,
  by: number,
  offer: number,
  accept: boolean,
  tick: number,
): WwOrderBlock | null {
  const o = eg.deals.find((x) => x.id === offer && x.to === by);
  if (o === undefined) return "deal_no_offer";
  return resolveDeal(eg, o, accept, tick);
}

const stands = (eg: WwEndgame, o: StoredDeal): boolean =>
  eg.isActor(o.from) && eg.isActor(o.to);

/**
 * Settles a pending deal. One whose parties stopped playing, or accepted
 * with an item no longer valid, lapses ("deal_lapsed" to the one who
 * accepted); a refusal starts the proposer's wait; an accepted deal
 * happens. The proposer hears each.
 */
function resolveDeal(
  eg: WwEndgame,
  o: StoredDeal,
  accept: boolean,
  tick: number,
): WwOrderBlock | null {
  eg.deals = eg.deals.filter((x) => x !== o);
  eg.dirtyDiplo = true;
  const day = Math.max(0, eg.ww.day(tick));
  const names = countryParams(eg, { target: o.to });
  if (
    !stands(eg, o) ||
    (accept && dealBlock(eg, o.from, o.to, o.give, o.take, day) !== null)
  ) {
    eg.message(o.from, noticeId(DIPLO_NOTICES.dealLapsed), names);
    return accept ? "deal_lapsed" : null;
  }
  if (!accept) {
    setDiploCooldown(
      eg,
      o.from,
      o.to,
      "deal_refused",
      day + WW_DEAL_REFUSAL_DAYS,
    );
    eg.message(o.from, noticeId(DIPLO_NOTICES.dealRefused), {
      ...names,
      days: WW_DEAL_REFUSAL_DAYS,
    });
    return null;
  }
  applyDeal(eg, o.id, o.from, o.to, o.give, o.take, tick);
  eg.message(o.from, noticeId(DIPLO_NOTICES.dealAccepted), names);
  return null;
}

/**
 * Every tick (WwEndgame.tick), in id order: a deal whose parties stopped
 * playing lapses; an AI target answers; a human with the `diplomacy` auto
 * switch on has its AI answer for it; a human card comes to the front (its
 * window starts) or runs out (refused). Deals' lend-lease that ran its
 * months ends.
 */
export function stepDeals(eg: WwEndgame, tick: number): void {
  endDealLendLease(eg, eg.ww.day(tick));
  if (eg.deals.length === 0) return;
  for (const o of [...eg.deals]) {
    if (!eg.deals.includes(o)) continue;
    if (!stands(eg, o)) resolveDeal(eg, o, false, tick);
    else if (!eg.isHumanControlled(o.to) || eg.ww.autoOn(o.to, "diplomacy")) {
      resolveDeal(eg, o, aiAcceptsDeal(eg, o), tick);
    } else if (o.deadlineTick < 0) {
      if (frontId(eg, o.to) === o.id) {
        o.deadlineTick = tick + cardTicks(eg);
        eg.dirtyDiplo = true;
      }
    } else if (tick >= o.deadlineTick) resolveDeal(eg, o, false, tick);
  }
}

// ---- The AI's own offers ----

/**
 * Daily for an AI country (staggered by smallID), once every
 * WW_DEAL_AI_CHECK_DAYS: a side leader hands occupied land to the ally
 * whose core or claim it is; a country that plain access would not get
 * offers equipment for it. (Promises are Promises.ts's; lend-lease
 * requests stay the aid AI's.)
 */
export function aiDealDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (day < 0 || (day + id) % WW_DEAL_AI_CHECK_DAYS !== 0) return;
  if (!eg.isActor(id)) return;
  aiAllyTransfer(eg, id, tick);
  aiBuyAccess(eg, id, day, tick);
}

/**
 * A side leader's gift to each ally (Transylvania to Hungary): enemy land
 * it holds that is the ally's core (else claim) and not its own core,
 * most victory points first, WW_DEAL_AI_TRANSFER_MAX at a time.
 */
function aiAllyTransfer(eg: WwEndgame, id: number, tick: number): void {
  const ww = eg.ww;
  const ctl = ww.land.controller;
  const legal = ww.politics.legalOwner;
  const f = dealFacts(eg);
  const byAlly = new Map<number, number[]>();
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null) continue;
    const s = eg.sideIndex(w, id);
    if (s === -1 || w.sides[s].leader !== id) continue;
    const allies = w.sides[s].members
      .filter((m) => m.id !== id && m.state === "active" && eg.isActor(m.id))
      .map((m) => m.id)
      .sort((a, b) => a - b);
    if (allies.length === 0) continue;
    const enemies = new Set(w.sides[1 - s].members.map((m) => m.id));
    for (const r of ww.scenario.landRegions) {
      if ((ctl[r.id] ?? 0) !== id || !enemies.has(legal[r.id] ?? 0)) continue;
      if (eg.hasCore(id, r.id)) continue;
      const to =
        allies.find((a) => eg.hasCore(a, r.id)) ??
        allies.find((a) => claimsRegion(eg, a, r.id));
      if (to === undefined || dealRegionBlock(f, id, to, r.id) !== null) {
        continue;
      }
      const list = byAlly.get(to) ?? [];
      if (!list.includes(r.id)) list.push(r.id);
      byAlly.set(to, list);
    }
  }
  const sc = ww.scenario;
  const vp = (r: number) => sc.region(r)?.vp ?? 0;
  for (const to of [...byAlly.keys()].sort((a, b) => a - b)) {
    const regions = byAlly
      .get(to)!
      .sort((a, b) => vp(b) - vp(a) || a - b)
      .slice(0, WW_DEAL_AI_TRANSFER_MAX);
    const c = ww.politics.country(id);
    if (c === null || c.ppMilli < WW_DEAL_PP * 1000) return;
    offerDeal(
      eg,
      id,
      {
        kind: "deal_offer",
        to,
        give: regions.map((region) => ({ kind: "region" as const, region })),
        take: [],
      },
      tick,
    );
  }
}

/**
 * Access the plain ask would not get (its score under the ask's 50, but
 * not hopeless), through a neighbour bordering a country it means to
 * fight and does not border: bought with a lump of its oldest infantry
 * equipment, sized to clear the giver's margin. One offer a check at most,
 * a pair every WW_DEAL_AI_PAIR_DAYS; a human gets one AI offer in its
 * queue at a time, and one from each AI every WW_DEAL_AI_TO_HUMAN_DAYS.
 */
function aiBuyAccess(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(id);
  if (c === null || c.ppMilli < WW_DEAL_PP * 1000) return;
  if (eg.deals.some((o) => o.from === id)) return;
  const econ = ww.economy;
  const ce = econ.country(id);
  if (ce === null) return;
  const mine = [...econ.countryNeighbours(id)].sort((a, b) => a - b);
  for (const t of plannedTargets(eg, id)) {
    if (!pol.living(t) || mine.includes(t)) continue;
    for (const x of mine) {
      if (x === t || !eg.isActor(x) || pol.hasAccess(id, x)) continue;
      if (pol.sameFaction(id, x) || ww.isAtWar(id, x)) continue;
      if (!econ.countryNeighbours(x).includes(t)) continue;
      const score = aiAcceptScore(pol, "access", id, x);
      if (score >= AI_ACCESS_SCORE || score < WW_DEAL_AI_ACCESS_MIN_SCORE) {
        continue;
      }
      if (diploCooldownUntil(eg, id, x, "ai_deal") > day) continue;
      if (diploCooldownUntil(eg, id, x, "deal_refused") > day) continue;
      if (pendingPair(eg, id, x)) continue;
      const human = eg.isHumanControlled(x);
      if (
        human &&
        (diploCooldownUntil(eg, id, 0, "ai_deal") > day ||
          eg.deals.some((o) => o.to === x && !eg.isHumanControlled(o.from)))
      ) {
        continue;
      }
      // What x wants: its margin, what opening its land costs it, the band.
      const need =
        dealMargin(dealMoodOf(eg, x, id)) -
        accessGivePoints(score) +
        WW_DEAL_ROLL_BAND;
      const lump = oldestLump(ce.stock, need);
      if (lump === null) continue;
      const r = offerDeal(
        eg,
        id,
        {
          kind: "deal_offer",
          to: x,
          give: [{ kind: "equipment", key: lump[0], count: lump[1] }],
          take: [{ kind: "access" }],
        },
        tick,
      );
      if (r !== null) continue;
      setDiploCooldown(eg, id, x, "ai_deal", day + WW_DEAL_AI_PAIR_DAYS);
      if (human) {
        setDiploCooldown(eg, id, 0, "ai_deal", day + WW_DEAL_AI_TO_HUMAN_DAYS);
      }
      return;
    }
  }
}

/** [key, count] of the oldest infantry equipment worth `need` points within WW_DEAL_AI_STOCK_PCT of its stock (null: none). */
function oldestLump(
  stock: ArrayLike<number>,
  need: number,
): [number, number] | null {
  for (let k = 0; k < EQUIP_KEYS.length; k++) {
    if (EQUIP_KEYS[k][0] !== "infantry_equipment") continue;
    const cost = equipKeyCostMilli(k);
    if (cost <= 0) continue;
    const count = Math.max(
      1,
      Math.ceil((need * WW_DEAL_IC_PER_POINT * 1000) / cost),
    );
    if (count * 100 <= (stock[k] ?? 0) * WW_DEAL_AI_STOCK_PCT) {
      return [k, count];
    }
  }
  return null;
}

// ---- Screens ----

/**
 * The composer's hint rows, once a day: for each human country and each
 * AI country it could offer, the margin the AI wants and its value of the
 * items only the engine can price (DiploTypes.WwDealJudgeRow). Null when
 * unchanged since sent (read-only: screens only).
 */
export function dealJudgeData(
  eg: WwEndgame,
  first: boolean,
): WwDealJudgeRow[] | null {
  const day = eg.lastCommonDay;
  if (!first && day === eg.dealJudgeDay) return null;
  eg.dealJudgeDay = day;
  const rows: WwDealJudgeRow[] = [];
  if (day >= 0) {
    const ww = eg.ww;
    const pol = ww.politics;
    const humans = [...eg.humanOf.keys()]
      .filter((h) => eg.isActor(h))
      .sort((a, b) => a - b);
    for (const h of humans) {
      for (let t = 1; t < eg.size; t++) {
        if (t === h || !eg.isActor(t) || eg.isHumanControlled(t)) continue;
        const same = pol.country(t)?.ruling === pol.country(h)?.ruling;
        rows.push({
          from: h,
          to: t,
          margin: dealMargin(dealMoodOf(eg, t, h)),
          access: accessNeeded(eg, t, h) ? WW_DEAL_ACCESS_NEED_PTS : 0,
          accessGive: accessGivePoints(aiAcceptScore(pol, "access", h, t)),
          nap: napPoints(aiAcceptScore(pol, "nap", h, t)),
          guarantee: guaranteePoints(true, isMajor(pol, h), same),
          guaranteeGive: guaranteePoints(false, isMajor(pol, h), same),
          licence: aiAcceptsLicence(ww.depth, t, h)
            ? -WW_DEAL_LICENCE_GIVE_PTS
            : -WW_DEAL_LICENCE_REFUSE_PTS,
          cede: aiCedesTo(eg, t, h),
        });
      }
    }
  }
  const json = JSON.stringify(rows);
  if (!first && json === eg.dealJudgeSent) return null;
  eg.dealJudgeSent = json;
  return rows;
}
