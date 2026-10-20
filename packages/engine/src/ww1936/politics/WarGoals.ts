// World War 1936 P3: war goals, justification and the declaration rules
// (spec §14.2–§14.5).
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  IDEO_DEM,
  WarGoalType,
  WW_WAR_GOAL_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  justifyCost,
  justifyDays,
  justifyGate,
  JustifyGateCtx,
  tensionFor,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { callToArms, isMajor, passLeadership } from "./Factions";
import { payPp } from "./Power";
import { hasRule } from "./Spirits";
import { addTension } from "./Tension";
import { addOpinion, endTreatiesOf, guaranteeCalled } from "./Treaties";
import type { WwPolitics } from "./WwPolitics";

/**
 * Spec §14.3: `target` is a member of a faction at war with `id` or with a
 * member of `id`'s faction.
 */
function enemyFactionOf(pol: WwPolitics, id: number, target: number): boolean {
  const tf = pol.factionIdx(target);
  if (tf < 0) return false;
  const mine = pol.factionIdx(id);
  const ours = mine < 0 ? [id] : pol.factionMembers(mine);
  return pol
    .factionMembers(tf)
    .some((m) => ours.some((x) => pol.ww.isAtWar(x, m)));
}

function gateCtx(pol: WwPolitics, id: number, target: number): JustifyGateCtx {
  const c = pol.country(id)!;
  return {
    ruling: c.ruling,
    wtBp: pol.wtBp,
    targetThreatBp: pol.threatBp[target] ?? 0,
    targetInEnemyFaction: enemyFactionOf(pol, id, target),
    atWarWith: pol.ww.isAtWar(id, target),
    sameFaction: pol.sameFaction(id, target),
    nap: pol.isAtWarBlockedByNap(id, target),
    iGuarantee: pol.guarantees.some((g) => g.by === id && g.to === target),
    noJustifyRule: hasRule(pol, id, "no_justify"),
    busy: false,
  };
}

/** Why `id` may not start justifying on `target` now; null when it may. */
export function justifyBlock(
  pol: WwPolitics,
  id: number,
  target: number,
): WwOrderBlock | null {
  if (target === id || !pol.living(target)) return "bad_target";
  if (pol.hasWarGoal(id, target)) return "treaty_exists";
  return justifyGate({
    ...gateCtx(pol, id, target),
    busy: pol.country(id)!.justification !== null,
  });
}

/** Spec §14.3: the `justify` order. */
export function startJustification(
  pol: WwPolitics,
  id: number,
  target: number,
  goal: WarGoalType,
  group: string,
  tick: number,
): WwOrderBlock | null {
  const block = justifyBlock(pol, id, target);
  if (block !== null) return block;
  const c = pol.country(id)!;
  if (goal === "claim" && !pol.content.groupIdx.has(group)) return "bad_target";
  if (!payPp(pol, id, justifyCost(isMajor(pol, target), c.stats))) {
    return "no_pp";
  }
  const majorGuarantors = pol
    .guarantorsOf(target)
    .filter((g) => isMajor(pol, g)).length;
  const days = justifyDays(
    c.stats,
    pol.stats(target).enemyJustifyTimePct,
    majorGuarantors,
  );
  c.justification = {
    on: target,
    type: goal,
    group: goal === "claim" ? group : "",
    progressDays: 0,
    totalDays: days,
  };
  // Spec §14.3: the target hears of it at the start too (lockstep: no
  // secrets); "justified against" is for the goal itself.
  const started = { countryTag: c.tag, targetTag: pol.tagOf(target) };
  pol.message(target, "ww1936_justify_started", started);
  pol.message(id, "ww1936_justify_started", started);
  pol.queueEvent("gen_justified_against", target, id, target, 0);
  pol.markCountry(id);
  pol.markCountry(target);
  pol.markGlobal();
  void tick;
  return null;
}

/** Spec §14.3: no refund. */
export function cancelJustification(
  pol: WwPolitics,
  id: number,
): WwOrderBlock | null {
  const c = pol.country(id)!;
  if (c.justification === null) return "justify_blocked";
  c.justification = null;
  pol.markGlobal();
  return null;
}

/** Whether the running justification is paused by its conditions now (the screens). */
export function justificationBlocked(pol: WwPolitics, id: number): boolean {
  const j = pol.country(id)?.justification ?? null;
  return j !== null && justifyGate(gateCtx(pol, id, j.on)) !== null;
}

/** A goal on `on` for a year (spec §14.2); one per target, the new one replaces. */
export function addWarGoal(
  pol: WwPolitics,
  by: number,
  on: number,
  type: WarGoalType,
  group: string,
  day: number,
): void {
  const c = pol.country(by);
  if (c === null || on === by || on <= 0) return;
  c.warGoals = c.warGoals.filter((g) => g.on !== on);
  c.warGoals.push({ on, type, group, untilDay: day + WW_WAR_GOAL_DAYS });
  c.warGoals.sort((a, b) => a.on - b.on);
  pol.markCountry(by);
}

export function removeWarGoal(pol: WwPolitics, by: number, on: number): void {
  const c = pol.country(by);
  if (c === null) return;
  const n = c.warGoals.length;
  c.warGoals = c.warGoals.filter((g) => g.on !== on);
  if (c.warGoals.length !== n) pol.markCountry(by);
}

/**
 * Spec §14.2 expiry and §14.3 progress, in the day's common step: every
 * justification one day further at once; a paused one waits.
 */
export function stepJustifications(
  pol: WwPolitics,
  day: number,
  tick: number,
): void {
  for (const c of pol.list()) {
    if (c.warGoals.length > 0) {
      const kept = c.warGoals.filter(
        (g) => g.untilDay > day && pol.living(g.on),
      );
      if (kept.length !== c.warGoals.length) {
        if (c.warGoals.some((g) => g.untilDay <= day && pol.living(g.on))) {
          pol.message(c.smallID, "ww1936_war_goal_expired");
        }
        c.warGoals = kept;
        pol.markCountry(c.smallID);
      }
    }
    const j = c.justification;
    if (j === null || !pol.living(c.smallID)) continue;
    if (!pol.living(j.on)) {
      c.justification = null;
      pol.markCountry(c.smallID);
      pol.markGlobal();
      continue;
    }
    if (justifyGate(gateCtx(pol, c.smallID, j.on)) !== null) continue;
    j.progressDays++;
    pol.markGlobal();
    if (j.progressDays < j.totalDays) continue;
    c.justification = null;
    addWarGoal(pol, c.smallID, j.on, j.type, j.group, day);
    addTension(
      pol,
      c.smallID,
      tensionFor("justified", isMajor(pol, j.on), c.stats, j.type),
    );
    pol.message(j.on, "ww1936_justified_against", { countryTag: c.tag });
    pol.markCountry(c.smallID);
  }
  void tick;
}

/**
 * Spec §14.5: the reasons P3 adds to a declaration. `join`: a war between
 * two only (a call to arms, a guarantee, a beat's join, the join_war
 * effect) needs no goal and costs nothing.
 */
export function declareWarRules(
  pol: WwPolitics,
  attacker: number,
  target: number,
  join: boolean,
): { block: DeclareWarBlock | null; noGoal: boolean } {
  if (pol.isAtWarBlockedByNap(attacker, target)) {
    return { block: "nap", noGoal: false };
  }
  if (pol.guarantees.some((g) => g.by === attacker && g.to === target)) {
    return { block: "guarantor", noGoal: false };
  }
  if (!join && hasRule(pol, attacker, "no_justify")) {
    return { block: "isolation", noGoal: false };
  }
  if (join) return { block: null, noGoal: false };
  const noGoal = !pol.hasWarGoal(attacker, target);
  if (noGoal && pol.country(attacker)?.ruling === IDEO_DEM) {
    return { block: "democracy_no_goal", noGoal };
  }
  return { block: null, noGoal };
}

/**
 * After P0's declareWar set the wars (spec §14.5): the goal is used,
 * tension, the no-goal penalties, the target's guarantors (the first
 * declarer only, spec §16.1) and the attacker's faction (spec §15.5).
 * Controller ruling R12: everyone in `joined` goes into `declaredOn`.
 */
export function afterWarDeclared(
  pol: WwPolitics,
  attacker: number,
  target: number,
  joined: readonly number[],
  noGoal: boolean,
  tick: number,
): void {
  const c = pol.country(attacker);
  if (c === null) return;
  const goal = c.warGoals.find((g) => g.on === target);
  c.warGoals = c.warGoals.filter((g) => g.on !== target);
  c.declaredOn = [...new Set([...c.declaredOn, ...joined])].sort(
    (a, b) => a - b,
  );
  const major = isMajor(pol, target);
  if (noGoal) {
    c.stabBaseBp = Math.max(0, c.stabBaseBp - 1500);
    c.wsBaseBp = Math.max(0, c.wsBaseBp - 1000);
    addTension(pol, attacker, tensionFor("declare_no_goal", major, c.stats));
    addOpinion(pol, attacker, "all", -20, 180);
  } else {
    addTension(
      pol,
      attacker,
      tensionFor("declare_goal", major, c.stats, goal?.type),
    );
  }
  pol.markCountry(attacker);
  guaranteeCalled(pol, attacker, target, tick);
  callToArms(pol, attacker, target, tick);
}

/** Spec §15.5: a member that joins a war calls its faction too (R21 skips those already in). */
export function afterWarJoined(
  pol: WwPolitics,
  actor: number,
  enemy: number,
  tick: number,
): void {
  callToArms(pol, actor, enemy, tick);
}

/**
 * Spec §14.1 (+2% to the victor), §15.3 (a capitulated leader is succeeded;
 * the country stays a member — HOI4's exiles, P0 decision 11's team win),
 * §16 (its treaties end), §14.2 (goals and justifications on it go),
 * controller ruling R12 (out of declaredOn).
 */
export function afterCapitulation(
  pol: WwPolitics,
  loser: number,
  victor: number,
  tick: number,
): void {
  if (victor > 0) {
    const v = pol.country(victor);
    if (v !== null) {
      addTension(
        pol,
        victor,
        tensionFor("capitulation", isMajor(pol, loser), v.stats),
      );
    }
  }
  passLeadership(pol, loser, tick);
  endTreatiesOf(pol, loser);
  forgetCountry(pol, loser);
}

/**
 * Nobody aims at `gone` any more, and it at nobody: goals, justifications
 * and declaredOn (capitulation, annexation).
 */
export function forgetCountry(pol: WwPolitics, gone: number): void {
  for (const c of pol.list()) {
    const goals = c.warGoals.filter((g) => g.on !== gone);
    const declared = c.declaredOn.filter((x) => x !== gone);
    const j = c.justification;
    const changed =
      goals.length !== c.warGoals.length ||
      declared.length !== c.declaredOn.length ||
      (j !== null && j.on === gone);
    if (!changed) continue;
    c.warGoals = goals;
    c.declaredOn = declared;
    if (j !== null && j.on === gone) c.justification = null;
    pol.markCountry(c.smallID);
  }
  const g = pol.country(gone);
  if (g !== null) {
    g.warGoals = [];
    g.declaredOn = [];
    g.justification = null;
    pol.markCountry(gone);
  }
  pol.markGlobal();
}
