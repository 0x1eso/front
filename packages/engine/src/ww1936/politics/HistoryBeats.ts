// World War 1936 P3: the history beats (spec §18.2, §18.3, plan decision
// 15). The foundation wrote declare / join (P0 processHistory's result: AI
// only, used up once, a pact dropped and a goal made first); lane E (Task 3)
// adds the other acts, windowDays and the safety-net skip.
//
// Owner direction (lane A, Task 6): with historical AI a beat is a
// suggestion — before a declare or join beat, or a decision beat aimed at a
// country, the AI judges it (AiPolitics.aiBeatReady); one it does not like
// yet waits up to AI_BEAT_WAIT_DAYS, then lapses.
//
// A due beat acts first and is marked done after, so the receiver of a
// diplomacy beat's request still sees the beat pending while it answers
// (the treaty rules accept a request that matches a beat, controller ruling
// R1). A blocked beat inside its window is left not done and tried again on
// the next day's common step.
import type { PolOrder } from "@openfront/engine-api/Schemas";
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  BeatAct,
  DecisionId,
  HistoryBeat,
  WW_BEAT_WINDOW_DEFAULT_DAYS,
  WW_WAR_GOAL_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import type { DeclareWarBlock } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { ContentRegistry } from "@openfront/engine-lib/ww1936/content/registry";
import { declareWar, declareWarBlock, joinWar } from "../Diplomacy";
import { forceFocusNext } from "./AiFocus";
import { AI_BEAT_WAIT_DAYS, aiBeatReady } from "./AiPolitics";
import { takeDecision } from "./Decisions";
import type { BeatState, WwPolitics } from "./WwPolitics";

/** Spec §18.2: a diplomacy beat's order (an AI asks like a human would). */
const DIPLO_ORDER = {
  nap: "nap_offer",
  guarantee: "guarantee",
  access: "access_ask",
  join_faction: "faction_request",
  invite: "faction_invite",
} as const;

/** Spec §18.2: every beat due by `day`, in table order; only an AI actor acts. */
export function runBeats(pol: WwPolitics, day: number, tick: number): void {
  pol.content.beats.forEach((b, i) => {
    const s = pol.beats[i];
    if (s === undefined || s.done || s.skipped || s.fireDay > day) return;
    const a = pol.idOfTag(b.actor);
    // Spec §18.8: beats never move a human country (used up all the same).
    if (a === 0 || !pol.living(a) || pol.isHuman(a)) {
      s.done = true;
      return;
    }
    s.done = !runAct(pol, b, s, a, day, tick);
  });
}

/** One beat's act; true when it was blocked and tries again tomorrow. */
function runAct(
  pol: WwPolitics,
  b: HistoryBeat,
  s: BeatState,
  a: number,
  day: number,
  tick: number,
): boolean {
  const act: BeatAct = b.act;
  const within = (window: number) => day < s.fireDay + window;
  switch (act.kind) {
    case "declare":
    case "join": {
      // Owner direction (lane A): the AI judges the suggestion first.
      if (!aiBeatReady(pol, b, a)) return day < s.fireDay + AI_BEAT_WAIT_DAYS;
      const block = beatWar(pol, a, act.kind, act.target, day, tick);
      return block !== null && block !== "prep" && within(b.windowDays ?? 0);
    }
    case "decision": {
      const t = act.target === undefined ? 0 : pol.idOfTag(act.target);
      if (act.target !== undefined && t === 0) return false;
      if (!aiBeatReady(pol, b, a)) return day < s.fireDay + AI_BEAT_WAIT_DAYS;
      const block = takeDecision(pol, a, act.id, t, tick, false);
      return (
        block !== null && within(b.windowDays ?? WW_BEAT_WINDOW_DEFAULT_DAYS)
      );
    }
    case "event":
      pol.queueEvent(act.id, a, a, 0, 0);
      return false;
    case "focus":
      forceFocusNext(pol, a, act.id);
      return false;
    case "diplo": {
      const t = pol.idOfTag(act.target);
      if (t === 0) return false;
      const order = { kind: DIPLO_ORDER[act.order], target: t } as PolOrder;
      const block = pol.issue(a, order, tick);
      return block !== null && within(b.windowDays ?? 0);
    }
  }
}

/** Beat indices by "<tag>:<decision>" for each content (derived, never state). */
const DECISION_BEATS = new WeakMap<ContentRegistry, Map<string, number[]>>();

function decisionBeats(content: ContentRegistry): Map<string, number[]> {
  let m = DECISION_BEATS.get(content);
  if (m !== undefined) return m;
  m = new Map();
  content.beats.forEach((b, i) => {
    if (b.act.kind !== "decision") return;
    const k = `${b.actor}:${b.act.id}`;
    const l = m!.get(k);
    if (l === undefined) m!.set(k, [i]);
    else l.push(i);
  });
  DECISION_BEATS.set(content, m);
  return m;
}

/**
 * Whether a history beat of `id` taking `decision` is still to come (neither
 * skipped nor done): the AI's general weights leave the decision to it
 * (spec §18.2, §18.6-3; controller ruling R2). A skipped beat leaves the
 * decision to the general AI.
 */
export function beatPending(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
): boolean {
  const list = decisionBeats(pol.content).get(`${pol.tagOf(id)}:${decision}`);
  if (list === undefined) return false;
  return list.some((i) => {
    const s = pol.beats[i];
    return s !== undefined && !s.skipped && !s.done;
  });
}

/**
 * No penalty on the history path: a pact is dropped first and a goal made
 * on the spot (spec §18.2). A war that already runs — a guarantee, a call
 * to arms or an event made it first — is left alone (spec §18.3 safety
 * net). Returns why the war could not start, null when it started or
 * already ran.
 */
export function beatWar(
  pol: WwPolitics,
  a: number,
  kind: "declare" | "join",
  targetTag: CountryTag,
  day: number,
  tick: number,
): DeclareWarBlock | null {
  const t = pol.idOfTag(targetTag);
  const ap = pol.player(a);
  const tp = pol.player(t);
  if (t === 0 || ap === null || tp === null || !pol.living(t)) return "dead";
  if (pol.ww.isAtWar(a, t)) return null;
  const lo = Math.min(a, t);
  const hi = Math.max(a, t);
  const naps = pol.naps.length;
  pol.naps = pol.naps.filter((n) => !(n.a === lo && n.b === hi));
  if (pol.naps.length !== naps) pol.markGlobal();
  const c = pol.country(a)!;
  if (!pol.hasWarGoal(a, t)) {
    c.warGoals.push({
      on: t,
      type: "conquer",
      group: "",
      untilDay: day + WW_WAR_GOAL_DAYS,
    });
    pol.markCountry(a);
  }
  const block = declareWarBlock(pol.mg, pol.ww, ap, tp, tick, kind === "join");
  if (block !== null) return block;
  if (kind === "declare") declareWar(pol.mg, pol.ww, ap, tp, tick);
  else joinWar(pol.mg, pol.ww, ap, tp, tick);
  return null;
}
