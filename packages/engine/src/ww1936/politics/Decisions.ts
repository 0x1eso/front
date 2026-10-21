// World War 1936 P3: decisions and missions (spec §13, §26.4). Lane E
// (Task 3).
//
// A decision's cooldown and running mission are kept per key: the id, or
// "<id>@<target smallID>" for a targeted decision (one line per candidate).
// A targeted decision's `among` sees self = the candidate, from = the
// deciding country, target = the candidate (content guideline); its
// `visible` / `available` see self = the deciding country, target = the
// candidate.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  equipKey,
  EQUIPMENT_GENS,
  WwOrderBlock,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  DecisionDef,
  DecisionId,
  WW_FOREVER,
  WwDecisionCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { costWith } from "@openfront/engine-lib/ww1936/PoliticsRules";
import { drawEquip, drawManpower } from "../economy/Stock";
import { evalCondition, failingLeaves } from "./Conditions";
import { applyEffects, makeCtx } from "./Dispatch";
import { payPp } from "./PayPp";
import type { CountryPol, WwPolitics } from "./WwPolitics";

export function decisionDef(
  pol: WwPolitics,
  id: DecisionId,
): DecisionDef | undefined {
  const i = pol.content.decisionIdx.get(id);
  return i === undefined ? undefined : pol.content.decisions[i];
}

/** The cooldown / mission key of a decision and its target (0: none). */
export function decisionKey(id: DecisionId, target: number): string {
  return target > 0 ? `${id}@${target}` : id;
}

function isFor(d: DecisionDef, tag: CountryTag): boolean {
  return d.for === "any" || d.for.includes(tag);
}

/** Locked in the data and not unlocked, or locked by a lock_decision effect. */
function isLocked(c: CountryPol, d: DecisionDef): boolean {
  return (d.locked === true && !c.unlocked.has(d.id)) || c.locked.has(d.id);
}

function missionRunning(c: CountryPol, id: DecisionId, target: number) {
  return c.missions.some((m) => m.id === id && m.target === target);
}

/** The PP the decision costs `id` now (spec §4.3, decisionCostPct). */
export function decisionCostPp(
  pol: WwPolitics,
  id: number,
  d: DecisionDef,
): number {
  return costWith(d.cost?.pp ?? 0, pol.stats(id).decisionCostPct);
}

/** Units of `type` in the stock, every generation. */
function equipmentHeld(pol: WwPolitics, id: number, d: DecisionDef): boolean {
  const eq = d.cost?.equipment;
  if (eq === undefined) return true;
  const ce = pol.econ.country(id);
  if (ce === null) return false;
  const [type, n] = eq;
  let have = 0;
  for (let g = 1; g <= EQUIPMENT_GENS[type]; g++) {
    have += ce.stock[equipKey(type, g)];
  }
  return have >= n;
}

/** Spec §13.1 costs other than PP: manpower, army experience, equipment. */
function otherCostsMet(pol: WwPolitics, id: number, d: DecisionDef): boolean {
  const cost = d.cost;
  if (cost === undefined) return true;
  if ((cost.manpower ?? 0) > 0) {
    const ce = pol.econ.country(id);
    if (ce === null || ce.manpower < cost.manpower!) return false;
  }
  if ((cost.armyXp ?? 0) > 0) {
    const xp = pol.land.country(id)?.armyXpMilli ?? 0;
    if (xp < cost.armyXp! * 1000) return false;
  }
  return equipmentHeld(pol, id, d);
}

function ppShort(pol: WwPolitics, c: CountryPol, d: DecisionDef): boolean {
  return c.ppMilli < 0 || c.ppMilli < decisionCostPp(pol, c.smallID, d) * 1000;
}

/**
 * Whether `target` can be a line of targeted decision `d` at all: a living
 * country, or (P5 pre-flight §0-11, `target.dead`) one out of the game
 * that is no dormant slot (a restoration).
 */
export function decisionTargetOk(
  pol: WwPolitics,
  d: DecisionDef,
  target: number,
): boolean {
  if (target <= 0 || target >= pol.countries.length) return false;
  if (d.target?.dead === true) {
    return (
      !pol.living(target) && pol.ww.endgame.countryState(target) !== "dormant"
    );
  }
  return pol.living(target);
}

/** Whether `target` may be one of the targeted decision's lines for `id`. */
function amongHolds(
  pol: WwPolitics,
  id: number,
  d: DecisionDef,
  target: number,
  tick: number,
): boolean {
  return evalCondition(makeCtx(pol, target, id, target, tick), d.target?.among);
}

/** Why `id` cannot take `decision` (on `target`) now; null if it can. */
export function decisionBlock(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
): WwOrderBlock | null {
  const c = pol.country(id);
  const d = decisionDef(pol, decision);
  if (c === null || d === undefined || !isFor(d, c.tag) || isLocked(c, d)) {
    return "decision_unavailable";
  }
  const tick = pol.mg.ticks();
  const day = pol.ww.day(tick);
  const key = decisionKey(decision, target);
  if (
    (c.decisionCooldown.get(key) ?? -1) > day ||
    missionRunning(c, decision, target)
  ) {
    return "decision_cooldown";
  }
  if (d.target !== undefined) {
    if (target === 0 || target === id || !decisionTargetOk(pol, d, target)) {
      return "bad_target";
    }
    if (!amongHolds(pol, id, d, target, tick)) return "decision_unavailable";
  } else if (target !== 0) {
    return "bad_target";
  }
  const ctx = makeCtx(pol, id, id, target, tick);
  if (
    !evalCondition(ctx, d.visible ?? d.available) ||
    !evalCondition(ctx, d.available)
  ) {
    return "decision_unavailable";
  }
  if (ppShort(pol, c, d)) return "no_pp";
  if (!otherCostsMet(pol, id, d)) return "decision_unavailable";
  return null;
}

/** Spec §13.1 costs: PP, manpower, army experience, equipment newest generation first. */
function payCosts(pol: WwPolitics, id: number, d: DecisionDef): void {
  payPp(pol, id, decisionCostPp(pol, id, d));
  const cost = d.cost;
  if (cost === undefined) return;
  const ce = pol.econ.country(id);
  if (ce !== null) {
    if ((cost.manpower ?? 0) > 0) drawManpower(ce, cost.manpower!);
    if (cost.equipment !== undefined) {
      const [type, n] = cost.equipment;
      let want = n;
      for (let g = EQUIPMENT_GENS[type]; g >= 1 && want > 0; g--) {
        want -= drawEquip(ce, equipKey(type, g), want);
      }
    }
    pol.econ.markCountryDirty(id);
  }
  const cl = pol.land.country(id);
  if ((cost.armyXp ?? 0) > 0 && cl !== null) {
    cl.armyXpMilli -= cost.armyXp! * 1000;
    pol.land.markCountry(id);
  }
}

/**
 * Takes a decision (an order, the AI, a beat, or `free` from a
 * take_decision effect: then only that it exists and is for the country
 * count — no cost, conditions or cooldown check). The cooldown counts
 * from the day it was taken, missions too.
 */
export function takeDecision(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
  tick: number,
  free: boolean,
): WwOrderBlock | null {
  const c = pol.country(id);
  const d = decisionDef(pol, decision);
  if (c === null || d === undefined || !isFor(d, c.tag)) {
    return "decision_unavailable";
  }
  // A free take of an untargeted decision ignores the context's target.
  const tgt = d.target === undefined && free ? 0 : target;
  if (!free) {
    const block = decisionBlock(pol, id, decision, tgt);
    if (block !== null) return block;
    payCosts(pol, id, d);
  }
  const day = pol.ww.day(tick);
  c.taken.add(decision);
  c.decisionCooldown.set(
    decisionKey(decision, tgt),
    d.cooldownDays !== undefined ? day + d.cooldownDays : WW_FOREVER,
  );
  applyEffects(makeCtx(pol, id, id, tgt, tick), d.effects ?? []);
  if (d.days !== undefined && !missionRunning(c, decision, tgt)) {
    c.missions.push({
      id: decision,
      target: tgt,
      startDay: day,
      endDay: day + d.days,
    });
  }
  pol.message(id, "ww1936_decision", { decision });
  pol.markCountry(id);
  return null;
}

/** Spec §13.1: a running mission ends; nothing is refunded. */
export function cancelMission(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
  target: number,
): WwOrderBlock | null {
  const c = pol.country(id);
  if (c === null) return "decision_unavailable";
  const i = c.missions.findIndex(
    (m) => m.id === decision && m.target === target,
  );
  if (i < 0) return "decision_unavailable";
  c.missions.splice(i, 1);
  pol.markCountry(id);
  return null;
}

/**
 * The country's missions, in the order they were taken: failIf true →
 * removed and failEffects; on or past endDay → removed and completeEffects.
 * Context: self = the country, target = the mission's target.
 */
export function stepDecisions(
  pol: WwPolitics,
  id: number,
  day: number,
  tick: number,
): void {
  const c = pol.country(id);
  if (c === null || c.missions.length === 0) return;
  for (const m of [...c.missions]) {
    // An effect of an earlier mission may have ended this one.
    const i = c.missions.indexOf(m);
    if (i < 0) continue;
    const d = decisionDef(pol, m.id);
    if (d === undefined) {
      c.missions.splice(i, 1);
      continue;
    }
    const ctx = makeCtx(pol, id, id, m.target, tick);
    if (d.failIf !== undefined && evalCondition(ctx, d.failIf)) {
      c.missions.splice(i, 1);
      applyEffects(ctx, d.failEffects ?? []);
      pol.message(id, "ww1936_mission_failed", { decision: m.id });
    } else if (day >= m.endDay) {
      c.missions.splice(i, 1);
      applyEffects(ctx, d.completeEffects ?? []);
      pol.message(id, "ww1936_mission_done", { decision: m.id });
    } else {
      continue;
    }
    pol.markCountry(id);
  }
}

/**
 * The decision screen (spec §21.4): the country's table and the "any" table
 * in decision order, without locked ones, those whose `visible` holds; a
 * targeted decision has one card per living candidate (smallID order).
 * State: 0 can take, 1 condition, 2 cost, 3 cooldown, 4 running mission.
 */
export function decisionCards(pol: WwPolitics, id: number): WwDecisionCard[] {
  const c = pol.country(id);
  if (c === null) return [];
  const own = pol.content.decisionsFor.get(c.tag) ?? [];
  const list =
    own.length === 0
      ? pol.content.decisionsAny
      : [...own, ...pol.content.decisionsAny].sort((a, b) => a - b);
  const tick = pol.mg.ticks();
  const day = pol.ww.day(tick);
  const out: WwDecisionCard[] = [];
  const card = (d: DecisionDef, target: number) => {
    const ctx = makeCtx(pol, id, id, target, tick);
    if (!evalCondition(ctx, d.visible ?? d.available)) return;
    const key = decisionKey(d.id, target);
    const cooldownUntil = c.decisionCooldown.get(key) ?? -1;
    let state = 0;
    let failing: number[] = [];
    if (missionRunning(c, d.id, target)) state = 4;
    else if (cooldownUntil > day) state = 3;
    else if (!evalCondition(ctx, d.available)) {
      state = 1;
      failing = failingLeaves(ctx, d.available);
    } else if (ppShort(pol, c, d) || !otherCostsMet(pol, id, d)) state = 2;
    out.push({
      id: d.id,
      target,
      state,
      costPp: decisionCostPp(pol, id, d),
      cooldownUntil,
      failing,
    });
  };
  let last = -1;
  for (const i of list) {
    if (i === last) continue;
    last = i;
    const d = pol.content.decisions[i];
    if (isLocked(c, d)) continue;
    if (d.target === undefined) {
      card(d, 0);
      continue;
    }
    for (const t of pol.list()) {
      const tid = t.smallID;
      if (tid === id || !decisionTargetOk(pol, d, tid)) continue;
      if (amongHolds(pol, id, d, tid, tick)) card(d, tid);
    }
  }
  return out;
}
