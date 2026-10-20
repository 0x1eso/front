// World War 1936 P3: the history beats (spec §18.2, plan decision 15). The
// foundation wrote declare / join (P0 processHistory's result: AI only,
// used up once); lane E (Task 3) adds the other acts, windowDays and the
// safety-net skip without changing these two.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import {
  DecisionId,
  WW_WAR_GOAL_DAYS,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import { declareWar, joinWar } from "../Diplomacy";
import type { WwPolitics } from "./WwPolitics";

/** Spec §18.2: every beat due by `day`, in table order; only an AI actor acts. */
export function runBeats(pol: WwPolitics, day: number, tick: number): void {
  pol.content.beats.forEach((b, i) => {
    const s = pol.beats[i];
    if (s === undefined || s.done || s.skipped || s.fireDay > day) return;
    s.done = true;
    const a = pol.idOfTag(b.actor);
    if (a === 0 || !pol.living(a) || pol.isHuman(a)) return;
    if (b.act.kind === "declare" || b.act.kind === "join") {
      beatWar(pol, a, b.act.kind, b.act.target, day, tick);
    }
    // Task 3 adds: decision, event, focus, diplo, windowDays, the safety-net skip.
  });
}

/**
 * Whether a history beat of `id` taking `decision` is still to come (neither
 * skipped nor done): the AI's general weights leave the decision to it
 * (spec §18.2; controller ruling R2). STUB: lane E (Task 3) writes it.
 */
export function beatPending(
  pol: WwPolitics,
  id: number,
  decision: DecisionId,
): boolean {
  return false;
}

/** No penalty on the history path: a pact is dropped first and a goal made on the spot (spec §18.2). */
export function beatWar(
  pol: WwPolitics,
  a: number,
  kind: "declare" | "join",
  targetTag: CountryTag,
  day: number,
  tick: number,
): void {
  const t = pol.idOfTag(targetTag);
  const ap = pol.player(a);
  const tp = pol.player(t);
  if (t === 0 || ap === null || tp === null || !pol.living(t)) return;
  const lo = Math.min(a, t);
  const hi = Math.max(a, t);
  pol.naps = pol.naps.filter((n) => !(n.a === lo && n.b === hi));
  const c = pol.country(a)!;
  if (!pol.hasWarGoal(a, t)) {
    c.warGoals.push({
      on: t,
      type: "conquer",
      group: "",
      untilDay: day + WW_WAR_GOAL_DAYS,
    });
  }
  if (kind === "declare") declareWar(pol.mg, pol.ww, ap, tp, tick);
  else joinWar(pol.mg, pol.ww, ap, tp, tick);
}
