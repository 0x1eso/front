// P5 lane S fills this file (plan Task 4): subjects and autonomy (spec §9).
// The foundation's stub: the 1936 table (spec §9.4) and the record of
// make/end subject (levels and autonomy only, no faction moves); the rest
// neutral.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { RESOURCE_COUNT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SUBJECT_LEVELS,
  SubjectLevel,
  WW_SUBJECT_START_AUT_BP,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EffectCtx } from "../politics/Dispatch";
import type { EconAdjust, Subject, WwEndgame } from "./WwEndgame";

/** Spec §9.4: the subjects of 1 January 1936 (overlord, level, autonomy bp). */
export const START_SUBJECTS: readonly (readonly [
  CountryTag,
  CountryTag,
  SubjectLevel,
  number,
])[] = [
  ["CAN", "GBR", "dominion", 6000],
  ["AUS", "GBR", "dominion", 6000],
  ["NZL", "GBR", "dominion", 6000],
  ["ZAF", "GBR", "dominion", 6000],
  ["RAJ", "GBR", "colony", 4000],
  ["MCK", "JPN", "puppet", 2000],
  ["MNG", "SUN", "puppet", 5000],
  ["TTU", "SUN", "puppet", 3000],
];

function newSubject(
  subject: number,
  overlord: number,
  level: SubjectLevel,
  autBp: number,
  neutral: boolean,
): Subject {
  return {
    subject,
    overlord,
    level: SUBJECT_LEVELS.indexOf(level),
    autBp,
    neutral,
    deniedDay: -1,
    tightenUntil: -1,
    lastDelta: 0,
    suspended: false,
    flowRes: new Array<number>(RESOURCE_COUNT).fill(0),
    flowCiv: 0,
    flowMp: 0,
    llToday: 0,
  };
}

function reindex(eg: WwEndgame): void {
  eg.subjects.sort((a, b) => a.subject - b.subject);
  eg.subjectIdx = new Map(eg.subjects.map((s, i) => [s.subject, i]));
  eg.dirtySubjects = true;
}

/** Spec §9.4: the 1936 table; a tag missing from the scenario is skipped. */
export function startSubjects(eg: WwEndgame): void {
  const sc = eg.ww.scenario;
  for (const [s, o, level, aut] of START_SUBJECTS) {
    const sid = sc.smallIdOf(s);
    const oid = sc.smallIdOf(o);
    if (sid === 0 || oid === 0) continue;
    eg.subjects.push(newSubject(sid, oid, level, aut, false));
  }
  reindex(eg);
}

/** Spec §9.2: a subject's day (autonomy, flows). Stub: nothing. */
export function stepSubject(eg: WwEndgame, subject: number, day: number): void {
  void eg;
  void subject;
  void day;
}

/**
 * Spec §9.1: `subject` becomes (or moves a level as) `overlord`'s subject.
 * Stub: the record only (level, autonomy; no faction or war moves).
 */
export function makeSubject(
  eg: WwEndgame,
  subject: number,
  overlord: number,
  level: SubjectLevel | "up" | "down",
  neutral: boolean,
  tick: number,
): void {
  void tick;
  if (subject <= 0 || overlord <= 0 || subject === overlord) return;
  const i = eg.subjectIdx.get(subject);
  if (i !== undefined) {
    const s = eg.subjects[i];
    if (level === "up") s.level = Math.max(0, s.level - 1);
    else if (level === "down") {
      s.level = Math.min(SUBJECT_LEVELS.length - 1, s.level + 1);
    } else s.level = SUBJECT_LEVELS.indexOf(level);
    s.overlord = overlord;
    s.neutral = neutral;
    eg.dirtySubjects = true;
    return;
  }
  const lv = level === "up" || level === "down" ? "puppet" : level;
  eg.subjects.push(
    newSubject(subject, overlord, lv, WW_SUBJECT_START_AUT_BP, neutral),
  );
  reindex(eg);
}

/** Spec §9.3: `subject` is free. Stub: the record goes. */
export function endSubject(eg: WwEndgame, subject: number, tick: number): void {
  void tick;
  if (!eg.subjectIdx.has(subject)) return;
  eg.subjects = eg.subjects.filter((s) => s.subject !== subject);
  reindex(eg);
}

/** Plan decision 19: a subject's and an overlord's flows of today. Stub: nothing. */
export function subjectEconomy(
  eg: WwEndgame,
  id: number,
  out: EconAdjust,
): void {
  void eg;
  void id;
  void out;
}

/** Spec §9.1: an overlord's subjects follow it into a war. Stub: nothing. */
export function onOverlordWar(
  eg: WwEndgame,
  overlord: number,
  enemy: number,
  defensive: boolean,
  tick: number,
): void {
  void eg;
  void overlord;
  void enemy;
  void defensive;
  void tick;
}

/** Spec §9.3: an independence war ended. Stub: nothing. */
export function endIndependenceWar(
  eg: WwEndgame,
  warId: number,
  winner: 0 | 1,
  tick: number,
): void {
  void eg;
  void warId;
  void winner;
  void tick;
}

/** Spec §9.1: a subject may not do `action` on its own. Stub: never blocked. */
export function subjectBlock(
  eg: WwEndgame,
  id: number,
  action: "declare" | "justify" | "faction" | "treaty" | "leave_faction",
): boolean {
  void eg;
  void id;
  void action;
  return false;
}

/** Spec §9.1: a dominion pays half (percent of the civilian-factory cost). Stub: 100. */
export function tradeCivFactorPct(
  eg: WwEndgame,
  buyer: number,
  seller: number,
): number {
  void eg;
  void buyer;
  void seller;
  return 100;
}

/** make_subject / end_subject / autonomy effects (lane S). Stub: nothing. */
export function applySubjectEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  void ctx;
  void e;
  void actor;
}
