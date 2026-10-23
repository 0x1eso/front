// World War 1936 P5 lane A (plan Task 6; spec §13, §16.4): lend-lease
// contracts, their daily draw, the land and sea transport, arrivals, the
// aid orders and the aid effects. Volunteers and ship transfers are
// Volunteers.ts's; the aid AI is AiAid.ts's.
//
// State (WwEndgame): a contract's `blocked` is null while it runs, the
// llBlock reason or "no_route" while it waits, "requested" while the
// giver's gen_diplo_lend_lease card is open. `route`: 0 none yet, 1 land,
// 2 sea (its SeaRoute is P4's, use lend_lease, ref = contract id). An
// InTransit's `costMilli` is the production cost of one unit (milli).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import {
  EQUIP_KEYS,
  equipKey,
  EQUIPMENT_GENS,
  type EquipmentType,
  type WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  type LendLeaseItem,
  WW_LL_LAND_DAYS,
  WW_LL_SEA_KM_PER_DAY,
  WW_LL_TENSION_DEMOCRACY_PCT,
  WW_LL_TENSION_RECEIVER_PCT,
  type WwAidView,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { CONVOY_USES } from "@openfront/engine-api/ww1936/NavyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import {
  IDEO_DEM,
  type SpiritRule,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  defaultLendLeasePerMonth,
  lendLeaseConvoys,
  lendLeaseSeaDays,
  llBlock,
  type LlIn,
  llLimitBlock,
} from "@openfront/engine-lib/ww1936/EndgameRules";
import { unitCostMilli } from "@openfront/engine-lib/ww1936/Equipment";
import { congressBlock } from "../depth/Congress";
import { receiveKey } from "../depth/DesignCopy";
import { fuelCapOf } from "../economy/Fuel";
import { drawEquip, returnEquip } from "../economy/Stock";
import type { CountryEconomy } from "../economy/WwEconomy";
import {
  convoyPath,
  dropRoute,
  findRoute,
  freeConvoysOf,
  portZonesOf,
  putRoute,
} from "../navy/Convoys";
import { type EffectCtx, resolveSelector } from "../politics/Dispatch";
import type { WwPolitics } from "../politics/WwPolitics";
import {
  applyVolunteersEffect,
  dailyVolunteers,
  recallVolunteers,
  scuttleFleet,
  sendAirVolunteers,
  sendVolunteers,
  shipsByWeight,
  transferShips,
} from "./Volunteers";
import { addWarScore } from "./Wars";
import {
  type InTransit,
  type LendLease,
  NOTE_LL,
  type WwEndgame,
} from "./WwEndgame";

export const USE_LEND_LEASE = CONVOY_USES.indexOf("lend_lease");
export const LL_REQUESTED = "requested";
export const LL_NO_ROUTE = "no_route";
export const ROUTE_NONE = 0;
export const ROUTE_LAND = 1;
export const ROUTE_SEA = 2;
export const EVENT_LL = "gen_diplo_lend_lease";
/** The order's perMonth ceiling (Schemas): also the default contract's cap (pre-flight §A A). */
export const LL_MAX_PER_MONTH = 100_000;
/** A request the giver never answered goes after this many days. */
const REQUEST_DAYS = 30;
/** A month of the contract's counters (spec §13.1: perMonth / 30 a day). */
const MONTH_DAYS = 30;

// ---- Conditions (spec §13.2, §19.1) ----

function rulesOf(pol: WwPolitics, id: number): SpiritRule[] {
  const c = pol.country(id);
  if (c === null) return [];
  const out: SpiritRule[] = [];
  for (const s of c.spirits) {
    for (const r of pol.content.spiritIdx.get(s.id)?.rules ?? []) out.push(r);
  }
  return out;
}

/** Spec §13.2: the sender's spirit forbids lend-lease (usa_isolation). */
export function hasNoLendLease(pol: WwPolitics, id: number): boolean {
  return rulesOf(pol, id).includes("no_lend_lease");
}

/** Spec §19.1 non-intervention: a spirit of `from` names `to` in {noAidTo}. */
export function aidRuleBlocks(
  pol: WwPolitics,
  from: number,
  to: number,
): boolean {
  if (pol.country(to) === null) return false;
  const tag = pol.tagOf(to);
  return rulesOf(pol, from).some(
    (r) => typeof r === "object" && "noAidTo" in r && r.noAidTo.includes(tag),
  );
}

/** World tension, whole percent. */
export function tensionPct(eg: WwEndgame): number {
  return Math.floor(eg.ww.politics.wtBp / 100);
}

export function validId(eg: WwEndgame, id: number): boolean {
  return Number.isInteger(id) && id > 0 && id < eg.size;
}

/** Spec §13.2's inputs for `from` → `to` today. */
export function llIn(
  eg: WwEndgame,
  from: number,
  to: number,
  day: number,
): LlIn {
  const ww = eg.ww;
  const pol = ww.politics;
  const c = pol.country(from);
  return {
    self: from === to,
    atWarWithEachOther: ww.isAtWar(from, to),
    bothActors: validId(eg, to) && eg.isActor(from) && eg.isActor(to),
    receiverAtWar: ww.hasWar(to),
    tensionPct: tensionPct(eg),
    senderDemocracy: c !== null && c.ruling === IDEO_DEM,
    senderLendLeaseFlag: c !== null && c.hasFlag("lend_lease", day),
    senderNoLendLeaseRule:
      hasNoLendLease(pol, from) || aidRuleBlocks(pol, from, to),
  };
}

/**
 * A lend-lease order's refusal (P6 spec §13.1, T1b): W3's US congress
 * first — the United States needs 50% support or its `lend_lease` flag
 * (the same "ll_conditions" answer, as the congress's law and faction
 * checks reuse their own blocks) — then P5's llBlock.
 */
export function llOrderBlock(
  eg: WwEndgame,
  from: number,
  to: number,
  day: number,
): WwOrderBlock | null {
  if (congressBlock(eg.ww.depth, from, "lend_lease")) return "ll_conditions";
  return llBlock(llIn(eg, from, to, day));
}

// ---- Contracts ----

export function contractsOf(eg: WwEndgame, from: number): LendLease[] {
  return eg.lendLease.filter((c) => c.from === from);
}

export function markAid(eg: WwEndgame, ...ids: number[]): void {
  for (const id of ids) if (id > 0) eg.dirtyAid.add(id);
}

/** A new contract, last in id order (the schema's field order). */
export function addContract(
  eg: WwEndgame,
  from: number,
  to: number,
  item: LendLeaseItem,
  gen: number,
  perMonth: number,
  day: number,
  blocked: string | null,
): LendLease {
  const c: LendLease = {
    id: eg.nextLlId++,
    from,
    to,
    item,
    gen,
    perMonth,
    sentMilli: 0,
    startDay: day,
    blocked,
    monthStart: day,
    sentMonth: 0,
    arrivedMonth: 0,
    route: ROUTE_NONE,
  };
  eg.lendLease.push(c);
  markAid(eg, from, to);
  return c;
}

/** Ends a contract (what is on its way still goes, spec §13.1) and its sea route. */
export function removeContract(eg: WwEndgame, id: number): void {
  const i = eg.lendLease.findIndex((c) => c.id === id);
  if (i < 0) return;
  const [c] = eg.lendLease.splice(i, 1);
  const r = findRoute(eg.ww.navy, USE_LEND_LEASE, c.from, c.id);
  if (r !== null) dropRoute(eg.ww.navy, r.id);
  markAid(eg, c.from, c.to);
}

/**
 * A running contract of (from, to, item, gen) gets `perMonth` more (or,
 * `replace`, exactly `perMonth`); else a new one when the sender has room
 * (llLimitBlock). Null when it has no room.
 */
export function upsertContract(
  eg: WwEndgame,
  from: number,
  to: number,
  item: LendLeaseItem,
  gen: number,
  perMonth: number,
  day: number,
  replace: boolean,
): LendLease | null {
  const same = eg.lendLease.find(
    (c) =>
      c.from === from &&
      c.to === to &&
      c.item === item &&
      c.gen === gen &&
      c.blocked !== LL_REQUESTED,
  );
  if (same !== undefined) {
    const v = replace ? perMonth : same.perMonth + perMonth;
    const next = Math.max(1, Math.min(LL_MAX_PER_MONTH, v));
    if (next !== same.perMonth) {
      same.perMonth = next;
      markAid(eg, from, to);
    }
    // An order or an effect makes it theirs: the aid AI sizes it no more.
    delete same.ai;
    return same;
  }
  if (llLimitBlock(contractsOf(eg, from).length) !== null) return null;
  return addContract(
    eg,
    from,
    to,
    item,
    gen,
    Math.max(1, Math.min(LL_MAX_PER_MONTH, perMonth)),
    day,
    null,
  );
}

function itemOk(item: LendLeaseItem, gen: number): boolean {
  if (item === "fuel") return gen === 0;
  return gen === 0 || equipKey(item, gen) >= 0;
}

/** The stock keys a contract draws from: its generation, or every one oldest first. */
export function itemKeys(item: EquipmentType, gen: number): number[] {
  if (gen > 0) return [equipKey(item, gen)];
  const out: number[] = [];
  for (let g = 1; g <= EQUIPMENT_GENS[item]; g++) out.push(equipKey(item, g));
  return out;
}

/** Spec §13.3 "하루 보내는 생산 비용": a day of the contract, industry (gen 1's cost for gen 0; fuel costs none). */
function dailyCost(c: LendLease): number {
  if (c.item === "fuel") return 0;
  const cost = unitCostMilli(c.item as EquipmentType, Math.max(1, c.gen));
  return Math.ceil((c.perMonth * cost) / (MONTH_DAYS * 1000));
}

// ---- Orders ----

/** lend_lease, _cancel, _request, volunteers_send, _recall, air_volunteers, ships_transfer. */
export function issueAid(
  eg: WwEndgame,
  smallID: number,
  order: WwOrder,
  tick: number,
): WwOrderBlock | null {
  const day = Math.max(0, eg.ww.day(tick));
  const land = eg.ww.land;
  switch (order.kind) {
    case "lend_lease":
      return openLendLease(
        eg,
        smallID,
        order.to,
        order.item,
        order.gen,
        order.perMonth,
        day,
      );
    case "lend_lease_cancel": {
      const c = eg.lendLease.find((x) => x.id === order.id);
      if (c === undefined || c.from !== smallID) return "bad_index";
      removeContract(eg, c.id);
      return null;
    }
    case "lend_lease_request":
      return requestLendLease(
        eg,
        smallID,
        order.from,
        order.item,
        order.perMonth,
        day,
      );
    case "volunteers_send": {
      const a = land.armies.get(order.army);
      if (a === undefined || a.owner !== smallID) return "bad_index";
      return sendVolunteers(eg, order.army, order.to, tick);
    }
    case "volunteers_recall": {
      const a = land.armies.get(order.army);
      if (a === undefined || a.owner !== smallID) return "not_volunteer";
      return recallVolunteers(eg, order.army, tick);
    }
    case "air_volunteers":
      return sendAirVolunteers(
        eg,
        smallID,
        order.to,
        order.zone,
        order.plane,
        order.count,
        tick,
      );
    case "ships_transfer":
      return transferShips(eg, smallID, order.to, order.ships, tick);
    default:
      return "bad_index";
  }
}

/** Spec §13.1 lend_lease: a contract now (a second one of the same kind grows the first). */
export function openLendLease(
  eg: WwEndgame,
  from: number,
  to: number,
  item: LendLeaseItem,
  gen: number,
  perMonth: number,
  day: number,
): WwOrderBlock | null {
  if (!validId(eg, to) || !itemOk(item, gen)) return "bad_index";
  const block = llOrderBlock(eg, from, to, day);
  if (block !== null) return block;
  return upsertContract(eg, from, to, item, gen, perMonth, day, false) === null
    ? "ll_limit"
    : null;
}

/**
 * Spec §13.4: `requester` asks `giver`. The contract waits as "requested"
 * (the event's options carry no values); gen_diplo_lend_lease goes to the
 * giver (from = the requester) and its option decides (aidEventOption).
 */
export function requestLendLease(
  eg: WwEndgame,
  requester: number,
  giver: number,
  item: LendLeaseItem,
  perMonth: number,
  day: number,
): WwOrderBlock | null {
  if (!validId(eg, giver) || !itemOk(item, 0)) return "bad_index";
  const block =
    llOrderBlock(eg, giver, requester, day) ??
    llLimitBlock(contractsOf(eg, giver).length);
  if (block !== null) return block;
  addContract(
    eg,
    giver,
    requester,
    item,
    0,
    Math.max(1, Math.min(LL_MAX_PER_MONTH, perMonth)),
    day,
    LL_REQUESTED,
  );
  eg.ww.politics.queueEvent(EVENT_LL, giver, requester, 0, 0);
  return null;
}

/** The giver's oldest open request from `requester` (gen_diplo_lend_lease answers it). */
export function pendingRequest(
  eg: WwEndgame,
  giver: number,
  requester: number,
): LendLease | null {
  return (
    eg.lendLease.find(
      (c) =>
        c.from === giver && c.to === requester && c.blocked === LL_REQUESTED,
    ) ?? null
  );
}

/**
 * P3 events (plan decision 38): after an applied option. gen_diplo_lend_lease
 * a opens the pending request (pre-flight §A A: with none — a content-fired
 * event — the default contract: the giver's oldest generation of infantry
 * equipment in stock, 10% of it a month); b drops it.
 */
export function aidEventOption(
  eg: WwEndgame,
  eventId: string,
  optionId: string,
  self: number,
  from: number,
  tick: number,
): void {
  if (eventId !== EVENT_LL) return;
  const day = Math.max(0, eg.ww.day(tick));
  const c = pendingRequest(eg, self, from);
  if (optionId !== "a") {
    if (c !== null) removeContract(eg, c.id);
    return;
  }
  if (c !== null) {
    c.blocked = null;
    c.startDay = day;
    c.monthStart = day;
    markAid(eg, c.from, c.to);
    return;
  }
  if (!validId(eg, from) || from === self) return;
  const ce = eg.ww.economy.country(self);
  if (ce === null) return;
  for (let g = 1; g <= EQUIPMENT_GENS.infantry_equipment; g++) {
    const stock = ce.stock[equipKey("infantry_equipment", g)];
    if (stock <= 0) continue;
    const per = defaultLendLeasePerMonth(stock, LL_MAX_PER_MONTH);
    upsertContract(eg, self, from, "infantry_equipment", g, per, day, false);
    return;
  }
}

// ---- The daily draw (spec §13.1–§13.3) ----

/** P1's land neighbours (spec §7.4): S reaches T through countries at war with neither. */
export function landRoute(eg: WwEndgame, from: number, to: number): boolean {
  const econ = eg.ww.economy;
  const ww = eg.ww;
  const seen = new Set<number>([from]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const n of econ.countryNeighbours(queue[i])) {
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      if (!ww.isAtWar(n, from) && !ww.isAtWar(n, to)) queue.push(n);
    }
  }
  return false;
}

/** The harbors goods for `to` may land in: its own ports, an exile's host's. */
function receivingPorts(eg: WwEndgame, to: number): readonly number[] {
  const navy = eg.ww.navy;
  const own = portZonesOf(navy, to);
  if (own.length > 0) return own;
  const host = eg.exileHost(to);
  return host > 0 ? portZonesOf(navy, host) : own;
}

/** The sender's contracts of today (spec §13.1–§13.3), in id order. */
export function stepLendLease(
  eg: WwEndgame,
  sender: number,
  day: number,
): void {
  const pol = eg.ww.politics;
  for (const c of contractsOf(eg, sender)) {
    if (c.blocked === LL_REQUESTED) {
      if (day - c.startDay > REQUEST_DAYS) removeContract(eg, c.id);
      continue;
    }
    if (!validId(eg, c.to) || !pol.living(c.to)) {
      removeContract(eg, c.id);
      continue;
    }
    if (day - c.monthStart >= MONTH_DAYS) {
      c.monthStart = day;
      c.sentMonth = 0;
      c.arrivedMonth = 0;
      markAid(eg, c.from, c.to);
    }
    stepContract(eg, c, day);
  }
}

/** Why a contract stopped (review fix round): one message key per reason (LL_STOP_KEY). */
export const LL_STOP_REASONS = [
  "at_war",
  "ll_conditions",
  "ll_peace",
  "ll_rule",
  "ll_tension",
  "no_route",
] as const;
export type LlStopReason = (typeof LL_STOP_REASONS)[number];
/** The message of each (full keys, so the translation check sees them). */
const LL_STOP_KEY: Readonly<Record<LlStopReason, string>> = {
  at_war: "events_display.ww1936_ll_stopped_at_war",
  ll_conditions: "events_display.ww1936_ll_stopped_ll_conditions",
  ll_peace: "events_display.ww1936_ll_stopped_ll_peace",
  ll_rule: "events_display.ww1936_ll_stopped_ll_rule",
  ll_tension: "events_display.ww1936_ll_stopped_ll_tension",
  no_route: "events_display.ww1936_ll_stopped_no_route",
};
const EVENTS_DISPLAY = "events_display.";

/** The reason llBlock refused (its own order of checks); null when it did not. */
export function llStopReason(i: LlIn): LlStopReason | null {
  if (llBlock(i) === null) return null;
  if (i.atWarWithEachOther) return "at_war";
  if (i.self || !i.bothActors) return "ll_conditions";
  if (!i.receiverAtWar && i.tensionPct < WW_LL_TENSION_RECEIVER_PCT) {
    return "ll_peace";
  }
  if (i.senderNoLendLeaseRule) return "ll_rule";
  if (i.senderDemocracy && !i.senderLendLeaseFlag) return "ll_tension";
  return "ll_conditions";
}

function setBlocked(
  eg: WwEndgame,
  c: LendLease,
  b: string | null,
  why: LlStopReason,
): void {
  if (c.blocked === b) return;
  c.blocked = b;
  markAid(eg, c.from, c.to);
  if (b === null) return;
  const params: Record<string, number> = {};
  if (why === "ll_peace") params.need = WW_LL_TENSION_RECEIVER_PCT;
  if (why === "ll_tension") {
    params.need = WW_LL_TENSION_DEMOCRACY_PCT;
    params.now = tensionPct(eg);
  }
  eg.message(c.from, LL_STOP_KEY[why].slice(EVENTS_DISPLAY.length), params);
}

function stepContract(eg: WwEndgame, c: LendLease, day: number): void {
  const navy = eg.ww.navy;
  const S = c.from;
  const li = llIn(eg, S, c.to, day);
  const block = llBlock(li);
  const live = findRoute(navy, USE_LEND_LEASE, S, c.id);
  let route = ROUTE_NONE;
  let km = 0;
  let srs: number[] = [];
  let share: [number, number] | null = null;
  if (block === null) {
    if (landRoute(eg, S, c.to)) {
      route = ROUTE_LAND;
    } else {
      const p = convoyPath(
        navy,
        S,
        portZonesOf(navy, S),
        receivingPorts(eg, c.to),
      );
      if (p !== null) {
        route = ROUTE_SEA;
        const r = putRoute(navy, USE_LEND_LEASE, S, c.id, p, day);
        // P4's allocation keeps the need its owner sets (Convoys.ts).
        r.need = lendLeaseConvoys(dailyCost(c), r.km);
        // A new route takes free convoys at once (P4 openSeaTrade's way).
        if (r.got === 0 && r.need > 0) {
          r.got = Math.min(r.need, freeConvoysOf(navy, S));
        }
        km = r.km;
        srs = [...r.srs];
        share = [Math.min(r.got, r.need), r.need];
      }
    }
  }
  if (route !== ROUTE_SEA && live !== null) dropRoute(navy, live.id);
  if (c.route !== route) {
    c.route = route;
    markAid(eg, c.from, c.to);
  }
  setBlocked(
    eg,
    c,
    block ?? (route === ROUTE_NONE ? LL_NO_ROUTE : null),
    llStopReason(li) ?? LL_NO_ROUTE,
  );
  if (c.blocked !== null) return;
  // Spec §13.1: a month's worth over 30 days; a convoy shortage carries
  // over at most a month (P5 lane A), a stock shortage never.
  c.sentMilli = Math.min(
    c.perMonth * 1000,
    c.sentMilli + Math.floor((c.perMonth * 1000) / MONTH_DAYS),
  );
  let want = Math.floor(c.sentMilli / 1000);
  if (share !== null && share[1] > 0) {
    want = Math.floor((want * share[0]) / share[1]);
  }
  if (want <= 0) return;
  c.sentMilli -= want * 1000;
  const arriveDay =
    day +
    (route === ROUTE_SEA
      ? lendLeaseSeaDays(km, WW_LL_SEA_KM_PER_DAY)
      : WW_LL_LAND_DAYS);
  const ce = eg.ww.economy.country(S);
  if (ce === null) return;
  const sea = route === ROUTE_SEA;
  if (c.item === "fuel") {
    const n = Math.min(want, Math.floor(ce.fuelMilli / 1000));
    if (n <= 0) return;
    ce.fuelMilli -= n * 1000;
    ship(eg, c, 0, n, arriveDay, srs, sea, 0);
    return;
  }
  const item = c.item as EquipmentType;
  // P4 decision 20: convoys bound to voyages and routes never leave.
  let left = item === "convoy" ? Math.min(want, freeConvoysOf(navy, S)) : want;
  for (const key of itemKeys(item, c.gen)) {
    if (left <= 0) break;
    const n = drawEquip(ce, key, left);
    if (n <= 0) continue;
    left -= n;
    const gen = EQUIP_KEYS[key][1];
    ship(eg, c, gen, n, arriveDay, srs, sea, unitCostMilli(item, gen));
  }
}

function ship(
  eg: WwEndgame,
  c: LendLease,
  gen: number,
  n: number,
  arriveDay: number,
  srs: number[],
  sea: boolean,
  costMilli: number,
): void {
  eg.inTransit.push({
    contract: c.id,
    from: c.from,
    to: c.to,
    item: c.item,
    gen,
    countMilli: n * 1000,
    arriveDay,
    // T23 determinism lane: each shipment its own copy (a contract ships
    // several generations the same day; a shared array is an alias a
    // restored game does not have).
    srs: [...srs],
    sea,
    costMilli,
  });
  c.sentMonth += n;
  eg.ww.economy.markCountryDirty(c.from);
  markAid(eg, c.from, c.to);
}

// ---- Transport and arrival (spec §13.3, §4.5) ----

/** The smallest ongoing war with `a` and `b` members of one side (spec §4.5); 0: none. */
export function sameSideWar(eg: WwEndgame, a: number, b: number): number {
  for (const w of eg.wars) {
    if (w.ended !== null) continue;
    const sa = eg.sideIndex(w, a);
    if (sa >= 0 && sa === eg.sideIndex(w, b)) return w.id;
  }
  return 0;
}

function addStock(
  eg: WwEndgame,
  ce: CountryEconomy,
  item: string,
  gen: number,
  n: number,
): void {
  if (n <= 0) return;
  if (item === "fuel") {
    const cap = fuelCapOf(eg.ww.economy, ce);
    ce.fuelMilli = Math.max(
      ce.fuelMilli,
      Math.min(cap, ce.fuelMilli + n * 1000),
    );
  } else {
    returnEquip(ce, equipKey(item as EquipmentType, gen), n);
  }
  eg.ww.economy.markCountryDirty(ce.smallID);
}

/**
 * The common day (spec §13.3): sea shipments lose the raiding rate of
 * every sea region on their way; what is due arrives. A receiver that no
 * longer plays sends it back to the sender. Then the volunteers' day
 * (Volunteers.dailyVolunteers: their returns, spec §12.3).
 */
export function deliverLendLease(eg: WwEndgame, day: number): void {
  const econ = eg.ww.economy;
  const navy = eg.ww.navy;
  const sc = eg.ww.scenario;
  const keep: InTransit[] = [];
  for (const t of eg.inTransit) {
    if (!eg.isActor(t.to)) {
      const back = econ.country(t.from);
      if (back !== null && eg.isActor(t.from)) {
        addStock(eg, back, t.item, t.gen, Math.floor(t.countMilli / 1000));
      }
      markAid(eg, t.from, t.to);
      continue;
    }
    if (t.sea) {
      for (const sr of t.srs) {
        const i = sc.srIdxOf(sr);
        if (i < 0) continue;
        const pm = navy.lossRatePm(i, t.from);
        if (pm <= 0) continue;
        t.countMilli -= Math.floor((t.countMilli * pm) / 1000);
        markAid(eg, t.to);
      }
    }
    if (day >= t.arriveDay) arrive(eg, t);
    else keep.push(t);
  }
  eg.inTransit = keep;
  dailyVolunteers(eg, day);
}

function arrive(eg: WwEndgame, t: InTransit): void {
  markAid(eg, t.from, t.to);
  const ce = eg.ww.economy.country(t.to);
  const n = Math.floor(t.countMilli / 1000);
  if (ce === null || n <= 0) return;
  // P6 (T1b, spec §5.6, §26): a design key is the sender's; the receiver
  // gets its own copy's slot ("received"), or the nearest static
  // equipment when no slot is free (−1: the sender no longer has it, lost).
  const key =
    t.item === "fuel"
      ? -1
      : receiveKey(
          eg.ww.depth,
          t.from,
          equipKey(t.item as EquipmentType, t.gen),
          t.to,
          "received",
        );
  if (t.item === "fuel") {
    addStock(eg, ce, t.item, t.gen, n);
  } else if (key >= 0) {
    returnEquip(ce, key, n);
    eg.ww.economy.markCountryDirty(ce.smallID);
  }
  const cost = Math.floor((n * t.costMilli) / 1000);
  const war = sameSideWar(eg, t.from, t.to);
  if (war > 0 && cost >= 50) {
    addWarScore(eg, war, t.from, Math.floor(cost / 50) * 1000);
  }
  // Spec §9.2: the overlord's equipment lowers the subject's autonomy (S reads it).
  const si = eg.subjectIdx.get(t.to);
  if (si !== undefined && eg.subjects[si].overlord === t.from) {
    eg.subjects[si].llToday += cost;
  }
  if (t.item === "fuel" || key >= 0) eg.note(t.to, NOTE_LL, t.from, key, n);
  const c = eg.lendLease.find((x) => x.id === t.contract);
  if (c !== undefined) c.arrivedMonth += n;
}

// ---- Volunteers' rule for P2 (spec §12.2) ----

/**
 * Where a volunteer army may go: regions its host or the host's side
 * controls, and regions of the host's enemies (to attack and take).
 */
export function volunteerCanEnter(
  eg: WwEndgame,
  army: number,
  region: number,
): boolean {
  const land = eg.ww.land;
  const a = land.armies.get(army);
  if (a === undefined || a.volunteerFor <= 0) return false;
  const host = a.volunteerFor;
  const c = land.controller[region] ?? 0;
  if (c === 0 || eg.isDmz(region, host)) return false;
  return land.sameSide(host, c) || land.isEnemy(host, c);
}

// ---- Effects (spec §16.4) ----

/** lend_lease / volunteers / transfer_ships / scuttle_fleet / embargo / end_embargo. */
export function applyAidEffect(ctx: EffectCtx, e: Effect, actor: number): void {
  const eg = ctx.pol.ww.endgame;
  switch (e.kind) {
    case "lend_lease": {
      // The contract now; the daily draw judges the conditions (spec §16.4).
      const to = resolveSelector(ctx, e.to);
      if (!validId(eg, to) || to === actor) return;
      const gen = e.gen ?? 0;
      if (!itemOk(e.item, gen)) return;
      upsertContract(
        eg,
        actor,
        to,
        e.item,
        gen,
        e.perMonth,
        Math.max(0, ctx.day),
        true,
      );
      return;
    }
    case "volunteers": {
      const to = resolveSelector(ctx, e.to);
      if (!validId(eg, to) || to === actor) return;
      applyVolunteersEffect(
        eg,
        actor,
        to,
        e.divisions ?? 0,
        e.planes ?? 0,
        ctx.tick,
      );
      return;
    }
    case "transfer_ships": {
      const to = resolveSelector(ctx, e.to);
      if (!validId(eg, to) || to === actor) return;
      for (const id of shipsByWeight(eg, actor, e.pct)) {
        eg.ww.navy.transferShip(id, to);
      }
      return;
    }
    case "scuttle_fleet":
      scuttleFleet(eg, actor, e.pct, ctx.tick);
      return;
    case "embargo":
    case "end_embargo": {
      // P1 §7.4's embargo is the player's (Trade.partnerJudge reads the
      // seller's hasEmbargoAgainst): the actor stops selling to `on`.
      const on = resolveSelector(ctx, e.on);
      if (!validId(eg, on) || on === actor) return;
      const me = eg.mg.playerBySmallID(actor);
      const them = eg.mg.playerBySmallID(on);
      if (!me.isPlayer() || !them.isPlayer()) return;
      if (e.kind === "embargo") me.addEmbargo(them, false);
      else if (me.hasEmbargoAgainst(them)) me.stopEmbargo(them);
      eg.ww.economy.markCountryDirty(actor);
      return;
    }
    default:
      return;
  }
}

// ---- Screens (spec §21.4) ----

/** The aid tab of `id`: its contracts, what comes in, its volunteers. */
export function aidView(eg: WwEndgame, id: number): WwAidView {
  const divisions = (army: number) =>
    eg.ww.land.armies.get(army)?.divisions.length ?? 0;
  return {
    smallID: id,
    contracts: eg.lendLease
      .filter((c) => c.from === id)
      .map((c) => ({
        id: c.id,
        to: c.to,
        item: c.item as LendLeaseItem,
        gen: c.gen,
        perMonth: c.perMonth,
        sentMonth: c.sentMonth,
        arrivedMonth: c.arrivedMonth,
        blocked: c.blocked,
      })),
    incoming: eg.inTransit
      .filter((t) => t.to === id)
      .map((t) => ({
        from: t.from,
        item: t.item as LendLeaseItem,
        count: Math.floor(t.countMilli / 1000),
        arriveDay: t.arriveDay,
      })),
    volunteersOut: eg.volunteers
      .filter((v) => v.from === id)
      .map((v) => ({ army: v.army, to: v.to, divisions: divisions(v.army) })),
    volunteersIn: eg.volunteers
      .filter((v) => v.to === id)
      .map((v) => ({
        army: v.army,
        from: v.from,
        divisions: divisions(v.army),
      })),
  };
}
