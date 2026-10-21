// World War 1936 P5 lane S (plan Task 4 Step 6, spec §17.3): the subjects'
// and overlords' AI, on an AI country's endgame turn. A subject asks for
// more autonomy at 100%, fights for independence once refused (when strong
// enough and its overlord is at peace) and demands autonomy when its
// ideology differs; an overlord tightens its grip on a restless
// non-dominion (both AI modes, owner direction) and annexes a spent, small
// integrated puppet (with historical AI only when no history beat concerns
// it). Decisions go through P3 takeDecision (costs,
// cooldowns, the content's conditions).
import { SUBJECT_LEVELS } from "@openfront/engine-api/ww1936/EndgameTypes";
import {
  WW_SUBJECT_ANNEX_VP_PCT,
  WW_SUBJECT_DEMAND_PP,
  WW_SUBJECT_FULL_AUT_BP,
  WW_SUBJECT_INDEPENDENCE_RATIO_PM,
  WW_SUBJECT_TIGHTEN_AUT_BP,
} from "@openfront/engine-lib/ww1936/SubjectRules";
import { controlledVp } from "../Capitulation";
import { armyStrength } from "../politics/Conditions";
import { takeDecision } from "../politics/Decisions";
import { beatPending } from "../politics/HistoryBeats";
import {
  declareIndependence,
  FLAG_INDEPENDENCE_DENIED,
  settleSubjects,
  subjectLine,
} from "./Subjects";
import type { Subject, WwEndgame } from "./WwEndgame";

export function aiSubjectsDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (eg.subjects.length === 0) return;
  settleSubjects(eg, tick);
  const s = subjectLine(eg, id);
  if (s !== null && !s.suspended) aiSubject(eg, s, day, tick);
  aiOverlord(eg, id, tick);
}

/** Spec §9.3: strength ‰ against the overlord's (P3 strength_ratio_ge). */
function strongEnough(eg: WwEndgame, id: number, o: number): boolean {
  const pol = eg.ww.politics;
  return (
    armyStrength(pol, id) * 1000 >=
    WW_SUBJECT_INDEPENDENCE_RATIO_PM * Math.max(1, armyStrength(pol, o))
  );
}

function aiSubject(eg: WwEndgame, s: Subject, day: number, tick: number) {
  const ww = eg.ww;
  const pol = ww.politics;
  const id = s.subject;
  const o = s.overlord;
  const c = pol.country(id);
  if (c === null || !eg.isActor(o)) return;
  const denied = c.hasFlag(FLAG_INDEPENDENCE_DENIED, day);
  // 1. Autonomy full: ask for the next level (the overlord's event).
  if (s.autBp >= WW_SUBJECT_FULL_AUT_BP && !denied) {
    if (
      takeDecision(pol, id, "gen_request_autonomy", 0, tick, false) === null
    ) {
      const tag = ww.tagOf(id);
      eg.message(o, "ww1936_autonomy_request", { tag, countryTag: tag });
      pol.flushEvents(tick);
      return;
    }
  }
  // 2. Refused: the independence war when strong enough and the overlord is at peace.
  if (denied && !ww.hasWar(o) && strongEnough(eg, id, o)) {
    if (declareIndependence(eg, id, tick)) return;
  }
  // 3. Another ideology and PP to spare: demand autonomy.
  const oc = pol.country(o);
  if (
    oc !== null &&
    c.ruling !== oc.ruling &&
    c.ppMilli >= WW_SUBJECT_DEMAND_PP * 1000
  ) {
    takeDecision(pol, id, "gen_demand_autonomy", 0, tick, false);
  }
}

function aiOverlord(eg: WwEndgame, id: number, tick: number): void {
  const pol = eg.ww.politics;
  let vp: number[] | null = null;
  for (const s of [...eg.subjects]) {
    if (s.overlord !== id || s.suspended || s.neutral) continue;
    if (!eg.isActor(s.subject)) continue;
    if (subjectLine(eg, s.subject) !== s) continue;
    const level = SUBJECT_LEVELS[s.level];
    if (s.autBp >= WW_SUBJECT_TIGHTEN_AUT_BP && level !== "dominion") {
      takeDecision(pol, id, "gen_tighten_control", s.subject, tick, false);
    }
    if (
      level === "integrated" &&
      s.autBp === 0 &&
      !annexHeld(eg, id, s.subject)
    ) {
      vp ??= controlledVp(eg.mg, eg.ww);
      if (vp[s.subject] * 100 < vp[id] * WW_SUBJECT_ANNEX_VP_PCT) {
        takeDecision(pol, id, "gen_annex_subject", s.subject, tick, false);
      }
    }
  }
}

/** With historical AI: a pending history beat on the overlord's annexation or on the subject holds the annexation back. */
function annexHeld(eg: WwEndgame, o: number, subject: number): boolean {
  if (!eg.mg.config().historicalAi()) return false;
  const pol = eg.ww.politics;
  if (beatPending(pol, o, "gen_annex_subject")) return true;
  const tag = pol.tagOf(subject);
  return pol.content.beats.some((b, i) => {
    const st = pol.beats[i];
    if (st === undefined || st.skipped || st.done) return false;
    const a = b.act;
    return (
      b.actor === tag ||
      ((a.kind === "declare" ||
        a.kind === "join" ||
        a.kind === "decision" ||
        a.kind === "diplo") &&
        a.target === tag)
    );
  });
}
