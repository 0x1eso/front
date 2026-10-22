// World War 1936 P6 lane W3 (plan Task 9): the naval treaty (spec §13.3).
// The 1936 members (GBR, USA, FRA — the foundation's start list) build no
// fourth-generation battleship line until the escalator: a major outside
// the treaty laying down a battleship line of generation 3 or more, or the
// event treaty_escalation (K5; its flag `treaty_escalated`, e.g. from the
// history beat). A member leaves with treaty_leave (50 PP, +2% tension it
// made, in effect 30 days later) or at once when it goes to war with a
// major; the treaty ends on 1942-12-31. State: WwDepth.mech.treaty.
import { COUNTRIES } from "@openfront/engine-api/ww1936/Countries";
import {
  TREATY_END_DATE,
  TREATY_LEAVE_DAYS,
  TREATY_LEAVE_PP,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { SHIP_CLASSES } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { payPp } from "../politics/PayPp";
import { addTension } from "../politics/Tension";
import type { WwDepth } from "./WwDepth";

const BB = SHIP_CLASSES.indexOf("bb");
/** Spec §13.3: members may not lay down this battleship generation before the escalator. */
export const TREATY_BB_GEN = 4;
/** Spec §13.3: a non-member's battleship line of this generation or more escalates. */
export const ESCALATOR_BB_GEN = 3;
/** Spec §13.3: +2% world tension (the leaver's own). */
export const TREATY_LEAVE_TENSION_BP = 200;
export const TREATY_ESCALATION_EVENT = "treaty_escalation";
/** The 1936 members (WwDepth.start's list); nobody joins later. */
const TREATY_START_TAGS: readonly string[] = ["GBR", "USA", "FRA"];
export const TREATY_ESCALATED_FLAG = "treaty_escalated";

/** A member of the naval treaty now (the foundation's body: the list). */
export function treatyMember(d: WwDepth, id: number): boolean {
  return d.mech.treaty.members.includes(id) && !d.mech.treaty.ended;
}

export function treatyEscalated(d: WwDepth): boolean {
  return d.mech.treaty.escalated;
}

/** The treaty refuses the naval line (cls, gen): a member's BB 4 before the escalator. */
export function treatyLineBlock(
  d: WwDepth,
  id: number,
  cls: number,
  gen: number,
): boolean {
  return (
    cls === BB &&
    gen >= TREATY_BB_GEN &&
    treatyMember(d, id) &&
    !treatyEscalated(d) &&
    !atWarWithMajor(d, id)
  );
}

function isMajor(d: WwDepth, id: number): boolean {
  const tag = d.ww.scenario.tagOfSmallId(id);
  return tag !== undefined && COUNTRIES[tag].major;
}

function atWarWithMajor(d: WwDepth, id: number): boolean {
  return d.ww.enemiesOf(id).some((e) => isMajor(d, e));
}

/** treaty_leave: a member not leaving yet, 50 PP. */
export function issueTreatyLeave(
  d: WwDepth,
  id: number,
  day: number,
): WwOrderBlock | null {
  const t = d.mech.treaty;
  if (!treatyMember(d, id) || t.leaving.some(([x]) => x === id)) {
    return "bad_index";
  }
  const pol = d.ww.politics;
  if (!payPp(pol, id, TREATY_LEAVE_PP)) return "no_pp";
  addTension(pol, id, TREATY_LEAVE_TENSION_BP);
  pol.markCountry(id);
  t.leaving.push([id, day + TREATY_LEAVE_DAYS]);
  t.leaving.sort((a, b) => a[0] - b[0]);
  d.markGlobal();
  d.markCountry(id);
  return null;
}

/** The day's treaty clock (dayCommon): the end, leavers, wars, the escalator. */
export function treatyDay(d: WwDepth, day: number, tick: number): void {
  const t = d.mech.treaty;
  if (t.ended) return;
  if (day >= dayOfDate(TREATY_END_DATE)) {
    t.ended = true;
    t.leaving = [];
    d.markGlobal();
    return;
  }
  const out = new Set<number>();
  for (const [id, effect] of t.leaving) if (effect <= day) out.add(id);
  for (const id of t.members) if (atWarWithMajor(d, id)) out.add(id);
  if (out.size > 0) {
    t.members = t.members.filter((id) => !out.has(id));
    t.leaving = t.leaving.filter(([id]) => !out.has(id));
    for (const id of out) d.markCountry(id);
    d.markGlobal();
  }
  if (!t.escalated && escalatorDue(d, day)) escalate(d, tick);
}

/**
 * A BB 3+ line of a major that was never a member (a leaver or a released
 * member is no outside power), or the K5 event's flag on someone.
 */
function escalatorDue(d: WwDepth, day: number): boolean {
  const pol = d.ww.politics;
  if (pol.gflags.has(TREATY_ESCALATED_FLAG)) return true;
  for (let id = 1; id < d.cap; id++) {
    if (pol.country(id)?.hasFlag(TREATY_ESCALATED_FLAG, day) === true) {
      return true;
    }
    if (
      TREATY_START_TAGS.includes(d.ww.scenario.tagOfSmallId(id) ?? "") ||
      d.mech.treaty.members.includes(id) ||
      !isMajor(d, id) ||
      !d.ww.isActor(id)
    ) {
      continue;
    }
    const ce = d.ww.economy.country(id);
    if (
      ce !== null &&
      ce.navalLines.some((l) => l.cls === BB && l.gen >= ESCALATOR_BB_GEN)
    ) {
      return true;
    }
  }
  return false;
}

/** Spec §13.3: the cap rises for every member (K5's event tells them). */
function escalate(d: WwDepth, tick: number): void {
  d.mech.treaty.escalated = true;
  d.markGlobal();
  const pol = d.ww.politics;
  for (const id of d.mech.treaty.members) {
    d.markCountry(id);
    pol.queueEvent(TREATY_ESCALATION_EVENT, id, id, 0, 0);
  }
  pol.flushEvents(tick);
}
