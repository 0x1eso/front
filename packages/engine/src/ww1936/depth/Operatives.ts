// P6 lane I (plan Task 5): operatives — recruiting, travel, missions,
// capture (spec §8.3–§8.4, plan decisions 17, 18, 34). Operatives go by
// codename only (spec §24-2: ww1936.codename.c<n>); a captured one is
// released after a year, never harmed (spec §24).
//
// An operative's state (OPERATIVE_STATES index): 0 idle at home (also
// while recruiting: recruitLeft > 0), 1 travelling (out to `target` with a
// mission, or home with mission −1 and target = its own country), 2 on a
// mission in `target` (its own country for counter_intelligence and
// suppress_resistance), 3 on operation `op` (an ops uid) in `target`, 4
// held by `target` until `releaseDay`.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  AgencyUpgrade,
  CODENAME_COUNT,
  INTEL_MISSIONS,
  INTEL_OPERATIONS,
  IntelMission,
  OPERATIVE_JAIL_DAYS,
  OPERATIVE_MAX_SKILL,
  OPERATIVE_RECRUIT_DAYS,
  OPERATIVE_SKILL_DAYS,
  OPERATIVE_TRAVEL_DAYS,
  WW_MAX_OPERATIVES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { WwStatKey } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { P_INTEL_CAPTURE } from "@openfront/engine-lib/ww1936/DepthRules";
import {
  capturePmMilli,
  counterHalf,
  NETWORK_DECAY_MILLI,
  networkGainMilli,
  operativeSlots,
  upgradeBit,
} from "@openfront/engine-lib/ww1936/IntelRules";
import { addPopularity } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { addOpinion } from "../politics/Treaties";
import type { CountryDepth, Operative, WwDepth } from "./WwDepth";

export const ST_IDLE = 0;
export const ST_TRAVEL = 1;
export const ST_MISSION = 2;
export const ST_OPERATION = 3;
export const ST_CAPTURED = 4;

export const M_BUILD_NETWORK = INTEL_MISSIONS.indexOf("build_network");
export const M_BOOST_IDEOLOGY = INTEL_MISSIONS.indexOf("boost_ideology");
export const M_PROPAGANDA = INTEL_MISSIONS.indexOf("propaganda");
export const M_COUNTER = INTEL_MISSIONS.indexOf("counter_intelligence");
export const M_SUPPORT_RES = INTEL_MISSIONS.indexOf("support_resistance");
export const M_SUPPRESS_RES = INTEL_MISSIONS.indexOf("suppress_resistance");
const OP_UPRISING = INTEL_OPERATIONS.indexOf("op_uprising");

/** Missions done in the operative's own country. */
const HOME_MISSIONS: ReadonlySet<IntelMission> = new Set([
  "counter_intelligence",
  "suppress_resistance",
]);

/** Spec §8.4 network floors, ‰ (support_resistance: half for an exile at its own cores, §8.6). */
export const BOOST_IDEOLOGY_NET_PM = 100;
export const PROPAGANDA_NET_PM = 200;
export const SUPPORT_RES_NET_PM = 200;
/** Spec §8.4 propaganda: bp a day per skill; the bases' floor; the cap per target. */
export const PROPAGANDA_BP = 1;
export const PROPAGANDA_FLOOR_BP = 2_000;
export const PROPAGANDA_CAP_BP = 1_500;
/** Spec §8.4 boost_ideology: bp a day per skill. */
export const BOOST_IDEOLOGY_BP = 8;
/** Spec §8.3: a capture costs this much opinion and network (milli‰). */
export const CAPTURE_OPINION = -20;
export const CAPTURE_NET_MILLI = 200_000;
/** 내 판단: the opinion modifiers of intelligence last a year. */
export const INTEL_OPINION_DAYS = 365;

export function hasUp(c: CountryDepth | null, u: AgencyUpgrade): boolean {
  return c !== null && (c.intel.upgrades & upgradeBit(u)) !== 0;
}

/** Abroad on a mission or an operation (the capture rule's "해외"). */
export function isAbroad(o: Operative, owner: number): boolean {
  return (
    o.state === ST_OPERATION || (o.state === ST_MISSION && o.target !== owner)
  );
}

/** The counter_intelligence operatives `t` keeps at home. */
export function counterMissions(d: WwDepth, t: number): number {
  const c = d.country(t);
  if (c === null) return 0;
  let n = 0;
  for (const o of c.intel.operatives) {
    if (o.state === ST_MISSION && o.mission === M_COUNTER && o.target === t) {
      n++;
    }
  }
  return n;
}

/** Plan decision 18: `t`'s counter-intelligence in half units. */
export function counterHalfOf(d: WwDepth, t: number): number {
  return counterHalf(counterMissions(d, t), hasUp(d.country(t), "ag_counter"));
}

/**
 * Spec §8.6: `owner` is a government in exile and `target` administers
 * (P5 §8.1) a region holding its core.
 */
export function exileOwnCore(
  d: WwDepth,
  owner: number,
  target: number,
): boolean {
  const eg = d.ww.endgame;
  if (!eg.isExile(owner)) return false;
  return eg.administeredOf(target).some((r) => eg.hasCore(owner, r));
}

/** Plan decision 34 (K5): the codename key's id, ww1936.codename.<id>. */
export function codenameId(n: number): string {
  return `c${n % CODENAME_COUNT}`;
}

export function statOf(d: WwDepth, id: number, k: WwStatKey): number {
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  return s?.[k] ?? 0;
}

/** Spec §8.3–§8.6: today's capture chance of an operative abroad, milli‰ (0 at home). */
export function captureMilliOf(
  d: WwDepth,
  owner: number,
  o: Operative,
): number {
  if (!isAbroad(o, owner)) return 0;
  const resistance =
    o.state === ST_OPERATION
      ? d.ops.find((x) => x.uid === o.op)?.kind === OP_UPRISING
      : o.mission === M_SUPPORT_RES;
  return capturePmMilli(
    o.state === ST_OPERATION,
    o.skill,
    counterHalfOf(d, o.target),
    resistance && exileOwnCore(d, owner, o.target),
  );
}

/**
 * Review E6: an operative's capture risk today, ‰ (the screens' number):
 * spec §8.3 with the target's counter-intelligence and an exile's own
 * cores (§8.6).
 */
export function operativeCapturePm(
  d: WwDepth,
  id: number,
  o: Operative,
): number {
  return Math.floor(captureMilliOf(d, id, o) / 1000);
}

// ---- orders ----

/** operative_recruit (spec §8.3): 30 days, free; skill 1, 2 with ag_special_ops. */
export function recruitOperative(
  d: WwDepth,
  id: number,
  day: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  const slots = Math.min(WW_MAX_OPERATIVES, operativeSlots(c.intel.upgrades));
  if (c.intel.operatives.length >= slots) return "no_slot";
  c.intel.operatives.push({
    uid: d.uid(),
    codename: c.intel.nextCodename,
    skill: hasUp(c, "ag_special_ops") ? 2 : 1,
    abroadDays: 0,
    state: ST_IDLE,
    target: 0,
    mission: -1,
    op: 0,
    sinceDay: day,
    travelLeft: 0,
    releaseDay: -1,
    recruitLeft: OPERATIVE_RECRUIT_DAYS,
  });
  c.intel.nextCodename++;
  d.markCountry(id);
  return null;
}

export function operativeOf(
  c: CountryDepth,
  uid: number,
): Operative | undefined {
  return c.intel.operatives.find((o) => o.uid === uid);
}

/** Recruited, at home and free: what an operation takes. */
export function isFree(o: Operative): boolean {
  return o.state === ST_IDLE && o.recruitLeft === 0;
}

/** A target country of an order: a scenario slot other than `id`. */
export function validTarget(d: WwDepth, id: number, t: number): boolean {
  return t > 0 && t < d.cap && t !== id && d.country(t) !== null;
}

/**
 * operative_assign (spec §8.3–§8.4): abroad after 10 days' travel (none
 * when it is there already), at home at once.
 */
export function assignOperative(
  d: WwDepth,
  id: number,
  o: Extract<DepthOrder, { kind: "operative_assign" }>,
  day: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  const op = operativeOf(c, o.operative);
  if (
    op === undefined ||
    op.recruitLeft > 0 ||
    op.state === ST_OPERATION ||
    op.state === ST_CAPTURED
  ) {
    return "no_operative";
  }
  const home = HOME_MISSIONS.has(o.mission);
  if (home ? o.target !== id : !validTarget(d, id, o.target)) {
    return "bad_target";
  }
  const there = op.state === ST_MISSION && op.target === o.target;
  const goingThere =
    op.state === ST_TRAVEL && op.mission >= 0 && op.target === o.target;
  op.mission = INTEL_MISSIONS.indexOf(o.mission);
  op.target = o.target;
  op.sinceDay = day;
  if (home || there) {
    op.state = ST_MISSION;
    op.travelLeft = 0;
  } else if (!goingThere) {
    op.state = ST_TRAVEL;
    op.travelLeft = OPERATIVE_TRAVEL_DAYS;
  }
  d.markCountry(id);
  return null;
}

/** operative_recall (spec §8.3): home after 10 days (as far as it went when still on its way out). */
export function recallOperative(
  d: WwDepth,
  id: number,
  uid: number,
  day: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null || !c.intel.agency) return "no_agency";
  const op = operativeOf(c, uid);
  if (
    op === undefined ||
    op.state === ST_OPERATION ||
    op.state === ST_CAPTURED ||
    op.recruitLeft > 0
  ) {
    return "no_operative";
  }
  if (op.state === ST_IDLE || (op.state === ST_TRAVEL && op.mission < 0)) {
    return "bad_index";
  }
  const back =
    op.state === ST_TRAVEL
      ? OPERATIVE_TRAVEL_DAYS - op.travelLeft
      : op.target === id
        ? 0
        : OPERATIVE_TRAVEL_DAYS;
  op.mission = -1;
  op.sinceDay = day;
  if (back <= 0) {
    goHome(op);
  } else {
    op.state = ST_TRAVEL;
    op.target = id;
    op.travelLeft = back;
  }
  d.markCountry(id);
  return null;
}

/** Idle at home (after an operation, a recall, a release). */
export function goHome(o: Operative): void {
  o.state = ST_IDLE;
  o.target = 0;
  o.mission = -1;
  o.op = 0;
  o.travelLeft = 0;
  o.releaseDay = -1;
}

// ---- capture ----

/**
 * Spec §8.3: the operative is held by its target for a year; an operation
 * it was on is cancelled (its cost stays spent, the other operative comes
 * home); relations −20; the network there −200‰.
 */
export function captureOperative(
  d: WwDepth,
  owner: number,
  o: Operative,
  day: number,
): void {
  const target = o.target;
  if (o.state === ST_OPERATION) cancelOperationOf(d, owner, o.op);
  o.target = target;
  holdOperative(d, owner, o, day, CAPTURE_OPINION);
}

/**
 * The capture itself (a failed coup holds both its operatives this way,
 * its operation row finishing as failed): held by its target for a year,
 * both countries hear of it, opinion, the network −200‰.
 */
export function holdOperative(
  d: WwDepth,
  owner: number,
  o: Operative,
  day: number,
  opinion: number,
): void {
  const target = o.target;
  o.state = ST_CAPTURED;
  o.target = target;
  o.mission = -1;
  o.op = 0;
  o.travelLeft = 0;
  o.sinceDay = day;
  o.releaseDay = day + OPERATIVE_JAIL_DAYS;
  const params = {
    codename: codenameId(o.codename),
    countryTag: d.ww.tagOf(target),
  };
  d.message(owner, "ww1936_operative_captured", params);
  d.message(target, "ww1936_operative_captured", params);
  if (opinion !== 0) {
    addOpinion(d.ww.politics, owner, target, opinion, INTEL_OPINION_DAYS);
    d.ww.politics.markCountry(owner);
    d.ww.politics.markCountry(target);
  }
  d.setNetMilli(owner, target, d.netMilli(owner, target) - CAPTURE_NET_MILLI);
  d.markCountry(owner);
  d.markCountry(target);
}

/** Removes `owner`'s operation `uid` (no refund); its operatives come home. */
export function cancelOperationOf(
  d: WwDepth,
  owner: number,
  uid: number,
): void {
  const i = d.ops.findIndex((x) => x.uid === uid && x.owner === owner);
  if (i < 0) return;
  d.ops.splice(i, 1);
  for (const o of d.country(owner)?.intel.operatives ?? []) {
    if (o.state === ST_OPERATION && o.op === uid) goHome(o);
  }
  d.markCountry(owner);
}

// ---- the day ----

/**
 * Spec §8.3–§8.4, on the owner's turn, operatives in uid order: release,
 * recruiting, travel, then abroad the skill, the capture roll and the
 * mission; last the networks nobody works in decay.
 */
export function dailyOperatives(d: WwDepth, id: number, day: number): void {
  const c = d.country(id);
  if (c === null) return;
  const seed = d.ww.politics.seed;
  let changed = false;
  for (const o of c.intel.operatives) {
    if (o.state === ST_CAPTURED) {
      if (day >= o.releaseDay) {
        const captor = o.target;
        goHome(o);
        o.sinceDay = day;
        d.message(id, "ww1936_operative_released", {
          codename: codenameId(o.codename),
          countryTag: d.ww.tagOf(captor),
        });
        changed = true;
      }
      continue;
    }
    if (o.recruitLeft > 0) {
      o.recruitLeft--;
      if (o.recruitLeft === 0) o.sinceDay = day;
      changed = true;
      continue;
    }
    if (o.state === ST_TRAVEL) {
      o.travelLeft--;
      if (o.travelLeft <= 0) {
        if (o.mission >= 0) {
          o.state = ST_MISSION;
          o.travelLeft = 0;
        } else {
          goHome(o);
        }
        o.sinceDay = day;
      }
      changed = true;
      continue;
    }
    // At home: counter_intelligence and suppress_resistance act through
    // the other countries' formulas and the resistance table.
    if (!isAbroad(o, id)) continue;
    // A target out of the game: home (an operation there is cancelled).
    if (!d.ww.isActor(o.target)) {
      if (o.state === ST_OPERATION) cancelOperationOf(d, id, o.op);
      goHome(o);
      o.sinceDay = day;
      changed = true;
      continue;
    }
    // Spec §8.3: every 180 days abroad, one skill, at most 3.
    o.abroadDays++;
    if (o.abroadDays % OPERATIVE_SKILL_DAYS === 0) {
      o.skill = Math.min(OPERATIVE_MAX_SKILL, o.skill + 1);
      changed = true;
    }
    // Spec §8.3, plan decisions 17–18: on my turn, a stateless roll.
    const p = captureMilliOf(d, id, o);
    if (wwRoll(seed, P_INTEL_CAPTURE, o.uid, day, o.target) % 1_000_000 < p) {
      captureOperative(d, id, o, day);
      changed = true;
      continue;
    }
    if (o.state === ST_MISSION) abroadMission(d, id, o);
  }
  decayNetworks(d, id, c);
  if (changed) d.markCountry(id);
}

/** Spec §8.4: a day of a mission abroad (support_resistance acts through the resistance table). */
function abroadMission(d: WwDepth, id: number, o: Operative): void {
  const t = o.target;
  const pol = d.ww.politics;
  switch (o.mission) {
    case M_BUILD_NETWORK: {
      const gain = networkGainMilli(
        o.skill,
        statOf(d, id, "intelPct"),
        counterMissions(d, t),
        hasUp(d.country(t), "ag_counter"),
      );
      d.setNetMilli(id, t, d.netMilli(id, t) + gain);
      return;
    }
    case M_BOOST_IDEOLOGY: {
      if (d.netPm(id, t) < BOOST_IDEOLOGY_NET_PM || d.ww.isAtWar(id, t)) {
        return;
      }
      const me = pol.country(id);
      const tc = pol.country(t);
      if (me === null || tc === null) return;
      addPopularity(tc.pop, me.ruling, BOOST_IDEOLOGY_BP * o.skill);
      pol.markCountry(t);
      return;
    }
    case M_PROPAGANDA: {
      if (d.netPm(id, t) < PROPAGANDA_NET_PM) return;
      const tc = pol.country(t);
      const c = d.country(id);
      if (tc === null || c === null) return;
      const rec = c.intel.propagandaBp.find((x) => x[0] === t);
      const done = rec?.[1] ?? 0;
      const step = Math.min(PROPAGANDA_BP * o.skill, PROPAGANDA_CAP_BP - done);
      if (step <= 0) return;
      tc.stabBaseBp = lowered(tc.stabBaseBp, step);
      tc.wsBaseBp = lowered(tc.wsBaseBp, step);
      if (rec === undefined) {
        c.intel.propagandaBp.push([t, step]);
        c.intel.propagandaBp.sort((a, b) => a[0] - b[0]);
      } else {
        rec[1] = done + step;
      }
      pol.markCountry(t);
      return;
    }
    default:
      return;
  }
}

/** A base lowered by `step`, not below the propaganda floor (and never raised). */
function lowered(base: number, step: number): number {
  return base <= PROPAGANDA_FLOOR_BP
    ? base
    : Math.max(PROPAGANDA_FLOOR_BP, base - step);
}

/** Spec §8.4: a network where none of mine works (mission or operation) loses 1‰ a day. */
function decayNetworks(d: WwDepth, id: number, c: CountryDepth): void {
  for (let t = 1; t < d.cap; t++) {
    if (t === id) continue;
    const net = d.netMilli(id, t);
    if (net <= 0) continue;
    const present = c.intel.operatives.some(
      (o) =>
        o.target === t && (o.state === ST_MISSION || o.state === ST_OPERATION),
    );
    if (!present) d.setNetMilli(id, t, net - NETWORK_DECAY_MILLI);
  }
}
