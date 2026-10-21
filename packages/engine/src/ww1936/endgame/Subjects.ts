// World War 1936 P5 lane S (plan Task 4, spec §9): subjects and autonomy —
// the 1936 table, making, moving and ending subjects, their faction and
// wars, their day (autonomy, flags, what flows to the overlord), the
// independence war, what a subject may not do alone and the dominion's
// trade price. The pure rules are engine-lib's (SubjectRules, EndgameRules);
// the AI is AiSubjects.ts. No PRNG but P3's call-to-arms roll (the same
// roll P3's callToArmsChoice makes, so the two answers never disagree).
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { RESOURCE_COUNT } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  SUBJECT_LEVELS,
  SubjectLevel,
  WW_SUBJECT_START_AUT_BP,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import { autonomyDelta } from "@openfront/engine-lib/ww1936/EndgameRules";
import { idHash, P_EVT, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  autonomyAfter,
  levelAfter,
  SubjectAction,
  subjectActionBlocked,
  subjectFlows,
  subjectTradeCivPct,
  subjectWarRule,
  WW_SUBJECT_CALL_PCT,
  WW_SUBJECT_DOWN_AUT_BP,
  WW_SUBJECT_FULL_AUT_BP,
  WW_SUBJECT_UP_AUT_BP,
} from "@openfront/engine-lib/ww1936/SubjectRules";
import type { Player } from "../../game/Game";
import { declareWar } from "../Diplomacy";
import { foughtTest } from "../land/Sustain";
import { type EffectCtx, resolveSelector } from "../politics/Dispatch";
import { joinFaction, leaveFaction, warBeatDue } from "../politics/Factions";
import { setGovernment } from "../politics/Ideology";
import { endWarBetween } from "../politics/Territory";
import {
  addWarGoal,
  declareWarRules,
  removeWarGoal,
} from "../politics/WarGoals";
import type { CountryPol } from "../politics/WwPolitics";
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

/** The flags this file sets on a subject (spec §9.3, plan Task 4 Step 3). */
export const FLAG_AUTONOMY_FULL = "autonomy_full";
export const FLAG_INDEPENDENCE_DENIED = "independence_denied";
export const FLAG_CONTROL_TIGHTENED = "control_tightened";

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

/** The subject line of `id`, null when it is nobody's subject. */
export function subjectLine(eg: WwEndgame, id: number): Subject | null {
  const i = eg.subjectIdx.get(id);
  return i === undefined ? null : eg.subjects[i];
}

function levelOf(s: Subject): SubjectLevel {
  return SUBJECT_LEVELS[s.level];
}

function playerOf(eg: WwEndgame, id: number): Player | null {
  const p = eg.mg.playerBySmallID(id);
  return p.isPlayer() ? p : null;
}

/** Spec §22: "subject level changed" to both sides (level: a SUBJECT_LEVELS id, or "independent"). */
function notifyLevel(
  eg: WwEndgame,
  subject: number,
  overlord: number,
  level: string,
): void {
  const tag = eg.ww.tagOf(subject);
  const params = {
    tag,
    countryTag: tag,
    overlordTag: eg.ww.tagOf(overlord),
    level,
  };
  eg.message(subject, "ww1936_subject_level", params);
  eg.message(overlord, "ww1936_subject_level", params);
}

function setFlag(
  eg: WwEndgame,
  c: CountryPol,
  flag: string,
  on: boolean,
): void {
  if (on === c.flags.has(flag)) return;
  if (on) c.flags.set(flag, [eg.ww.politics.day(), -1]);
  else c.flags.delete(flag);
  eg.ww.politics.markCountry(c.smallID);
}

function clearFlows(s: Subject): void {
  s.flowRes.fill(0);
  s.flowCiv = 0;
  s.flowMp = 0;
}

/** Spec §9.4: the 1936 table; a tag missing from the scenario is skipped. */
export function startSubjects(eg: WwEndgame): void {
  // Task 1: endgame.start() runs first — read the scenario only. The 1936
  // subjects already sit in their overlords' factions (Countries.ts).
  const sc = eg.ww.scenario;
  for (const [s, o, level, aut] of START_SUBJECTS) {
    const sid = sc.smallIdOf(s);
    const oid = sc.smallIdOf(o);
    if (sid === 0 || oid === 0) continue;
    eg.subjects.push(newSubject(sid, oid, level, aut, false));
  }
  reindex(eg);
}

// ---- Making, moving and ending (spec §9.1, §9.3, §9.5) ----

/** Whether `a` is (through any chain) an overlord of `b`. */
function isAbove(eg: WwEndgame, a: number, b: number): boolean {
  let x = subjectLine(eg, b);
  for (let n = 0; x !== null && n <= eg.subjects.length; n++) {
    if (x.overlord === a) return true;
    x = subjectLine(eg, x.overlord);
  }
  return false;
}

/**
 * Spec §9.1: a subject (not a neutral collaborator) sits in its overlord's
 * faction — out of any other first; P3 joinFaction, no ideology rule. An
 * overlord with no faction leaves it where it is.
 */
function bindFaction(eg: WwEndgame, s: Subject, tick: number): void {
  if (s.neutral || s.suspended) return;
  const pol = eg.ww.politics;
  const f = pol.factionIdx(s.overlord);
  if (f < 0 || pol.factionIdx(s.subject) === f || !pol.living(s.subject)) {
    return;
  }
  if (pol.factionIdx(s.subject) >= 0) leaveFaction(pol, s.subject, tick);
  joinFaction(pol, s.subject, f, tick);
}

/** The faction, and (`wars`) the overlord's ongoing wars by the level's rule. */
function bind(eg: WwEndgame, s: Subject, tick: number, wars: boolean): void {
  if (s.suspended) return;
  bindFaction(eg, s, tick);
  if (!wars) return;
  for (const e of eg.ww.enemiesOf(s.overlord)) {
    const w = eg.war(eg.warOfPair(s.overlord, e));
    if (w !== null && w.kind === "civil") continue;
    followWar(eg, s, e, w !== null && eg.sideIndex(w, s.overlord) === 1, tick);
  }
}

/**
 * Spec §9.1, §9.5: `subject` becomes `overlord`'s subject at `level`, or an
 * existing subject moves a level ("up": +1 — up from a dominion is
 * independence, still in the faction — autonomy 20%; "down": −1, 80%). A
 * new subject starts at 20%, takes its overlord's ideology (P3
 * setGovernment and its leader rule; a neutral collaborator keeps its own),
 * ends any war with its overlord, joins its faction and its ongoing wars by
 * the level's rule. An explicit level on an existing subject sets the level
 * (and the overlord: P3 annex hands an annexed country's subjects on).
 */
export function makeSubject(
  eg: WwEndgame,
  subject: number,
  overlord: number,
  level: SubjectLevel | "up" | "down",
  neutral: boolean,
  tick: number,
): void {
  if (subject <= 0 || overlord <= 0 || subject === overlord) return;
  if (subject >= eg.size || overlord >= eg.size) return;
  const s = subjectLine(eg, subject);
  if (s !== null) {
    if (level === "up" || level === "down") {
      stepLevel(eg, s, level, tick);
      return;
    }
    if (isAbove(eg, subject, overlord)) return;
    const moved = s.overlord !== overlord;
    const was = s.level;
    s.overlord = overlord;
    s.level = SUBJECT_LEVELS.indexOf(level);
    s.neutral = neutral;
    eg.dirtySubjects = true;
    bind(eg, s, tick, moved || s.level < was);
    if (moved || s.level !== was) notifyLevel(eg, subject, overlord, level);
    return;
  }
  if (level === "up" || level === "down") return;
  if (isAbove(eg, subject, overlord)) return;
  const sub = newSubject(
    subject,
    overlord,
    level,
    WW_SUBJECT_START_AUT_BP,
    neutral,
  );
  eg.subjects.push(sub);
  reindex(eg);
  const pol = eg.ww.politics;
  if (!neutral) {
    const ruling = pol.country(overlord)?.ruling;
    if (ruling !== undefined) setGovernment(pol, subject, ruling, tick);
  }
  if (eg.ww.isAtWar(subject, overlord)) {
    endWarBetween(pol, subject, overlord, tick);
  }
  bind(eg, sub, tick, true);
  notifyLevel(eg, subject, overlord, level);
}

function stepLevel(
  eg: WwEndgame,
  s: Subject,
  dir: "up" | "down",
  tick: number,
): void {
  const now = levelOf(s);
  const next = levelAfter(now, dir);
  if (next === null) {
    // Spec §9.3: a dominion raised is independent; it stays in the faction.
    endSubject(eg, s.subject, tick);
    return;
  }
  if (next === now) return;
  s.level = SUBJECT_LEVELS.indexOf(next);
  s.autBp = dir === "up" ? WW_SUBJECT_UP_AUT_BP : WW_SUBJECT_DOWN_AUT_BP;
  eg.dirtySubjects = true;
  // A step down binds tighter: the overlord's wars by the new rule.
  bind(eg, s, tick, dir === "down");
  notifyLevel(eg, s.subject, s.overlord, next);
}

/** Spec §9.3: `subject` is free; its faction stays as it is. */
export function endSubject(eg: WwEndgame, subject: number, tick: number): void {
  void tick;
  const s = subjectLine(eg, subject);
  if (s === null) return;
  eg.subjects = eg.subjects.filter((x) => x.subject !== subject);
  reindex(eg);
  const c = eg.ww.politics.country(subject);
  if (c !== null) {
    setFlag(eg, c, FLAG_AUTONOMY_FULL, false);
    setFlag(eg, c, FLAG_INDEPENDENCE_DENIED, false);
    setFlag(eg, c, FLAG_CONTROL_TIGHTENED, false);
  }
  notifyLevel(eg, subject, s.overlord, "independent");
}

/**
 * The bonds that no longer hold, in subject order (plan Task 4 Step 1;
 * idempotent — stepSubject and aiSubjectsDay both call it): a gone
 * subject's line goes; a gone overlord (not an exile — spec §9.3) frees its
 * subjects; a paused bond whose independence war is over and settled (no
 * conference still to come) ends: lost → integrated again, else free.
 */
export function settleSubjects(eg: WwEndgame, tick: number): void {
  if (eg.subjects.length === 0) return;
  const gone = (id: number) =>
    eg.countryState(id) === "gone" && !eg.isExile(id);
  for (const s of [...eg.subjects]) {
    if (!eg.subjectIdx.has(s.subject)) continue;
    if (gone(s.subject) || gone(s.overlord)) {
      endSubject(eg, s.subject, tick);
      continue;
    }
    if (s.suspended) settlePaused(eg, s, tick);
  }
}

/** The independence wars of a subject against its overlord, oldest first. */
function independenceWars(eg: WwEndgame, s: Subject): WwWar[] {
  return eg.wars.filter(
    (w) =>
      w.kind === "independence" &&
      eg.sideIndex(w, s.subject) === 0 &&
      eg.sideIndex(w, s.overlord) === 1,
  );
}

function settlePaused(eg: WwEndgame, s: Subject, tick: number): void {
  if (eg.ww.isAtWar(s.subject, s.overlord)) return;
  const wars = independenceWars(eg, s);
  if (wars.some((w) => w.ended === null)) return;
  const ids = new Set(wars.map((w) => w.id));
  if (
    eg.conferences.some(
      (c) => c.status !== 2 && c.warIds.some((id) => ids.has(id)),
    )
  ) {
    return;
  }
  const last = wars.length > 0 ? wars[wars.length - 1] : null;
  if (last !== null && last.ended?.winner === 1) {
    lostIndependence(eg, s, last, tick);
  } else {
    endSubject(eg, s.subject, tick);
  }
}

// ---- Wars (spec §9.1) ----

/**
 * P3's call-to-arms answer for an AI subject, now (spec §9.1 weights:
 * colony 95, dominion 80): with historical AI a history beat due joins;
 * otherwise P3 callToArmsChoice's own roll (same stream, receiver and day),
 * so a P3 faction call that follows agrees with it.
 */
function aiAnswersCall(
  eg: WwEndgame,
  id: number,
  enemy: number,
  pct: number,
): boolean {
  const pol = eg.ww.politics;
  const day = pol.day();
  if (eg.mg.config().historicalAi() && warBeatDue(pol, id, enemy, day)) {
    return true;
  }
  return subjectCallRoll(eg, id, day) < pct;
}

/** The 0..99 roll of P3's call to arms to `id` on `day` (Factions.callToArmsChoice). */
export function subjectCallRoll(
  eg: WwEndgame,
  id: number,
  day: number,
): number {
  const seed = eg.ww.politics.seed;
  return (wwRoll(seed, P_EVT, idHash("gen_call_to_arms"), id, day) >>> 8) % 100;
}

/** Subject `s` follows its overlord into the war against `enemy` by its level's rule. */
function followWar(
  eg: WwEndgame,
  s: Subject,
  enemy: number,
  defensive: boolean,
  tick: number,
): void {
  const ww = eg.ww;
  const id = s.subject;
  if (s.suspended || id === enemy || enemy === s.overlord) return;
  if (!eg.isActor(id) || !eg.isActor(enemy)) return;
  if (ww.isAtWar(id, enemy) || ww.sameFaction(id, enemy)) return;
  const level = levelOf(s);
  const rule = subjectWarRule(level, s.neutral, defensive);
  if (rule === "none") return;
  const link = {
    kind: "into" as const,
    warId: eg.warOfPair(s.overlord, enemy),
  };
  if (rule === "join") {
    ww.setWar(id, enemy, tick, link);
    return;
  }
  const pol = ww.politics;
  if (eg.isHumanControlled(id)) {
    // In its overlord's faction, P3's faction call (the overlord leads and
    // declared) or P0's chain (the faction was declared on) reaches it.
    if (pol.sameFaction(id, s.overlord)) return;
    pol.queueEvent("gen_call_to_arms", id, s.overlord, enemy, 0);
    return;
  }
  if (ww.inPrep(tick)) return;
  if (declareWarRules(pol, id, enemy, true).block !== null) return;
  const pct =
    level === "colony"
      ? WW_SUBJECT_CALL_PCT.colony
      : WW_SUBJECT_CALL_PCT.dominion;
  if (aiAnswersCall(eg, id, enemy, pct)) ww.setWar(id, enemy, tick, link);
}

/**
 * Spec §9.1 (WwEndgame.onWarPairCreated, both ways): `overlord`'s subjects
 * (smallID order, not paused) follow it into the war with `enemy` —
 * integrated and puppet at once, a colony at once when `defensive` (the
 * overlord was declared on) and by a call to arms otherwise, a dominion by
 * a call to arms, a neutral collaborator not at all. And a subject declared
 * on (`defensive`, `overlord` is that subject) brings its own overlord in
 * (a neutral collaborator's too). Civil wars draw nobody in.
 */
export function onOverlordWar(
  eg: WwEndgame,
  overlord: number,
  enemy: number,
  defensive: boolean,
  tick: number,
): void {
  if (eg.subjects.length === 0) return;
  const w = eg.war(eg.warOfPair(overlord, enemy));
  if (w !== null && w.kind === "civil") return;
  for (const id of eg.subjectsOf(overlord)) {
    const s = subjectLine(eg, id);
    if (s !== null) followWar(eg, s, enemy, defensive, tick);
  }
  if (!defensive) return;
  const me = subjectLine(eg, overlord);
  if (me === null || me.suspended) return;
  const o = me.overlord;
  const ww = eg.ww;
  if (o === enemy || !eg.isActor(o) || !eg.isActor(enemy)) return;
  if (ww.isAtWar(o, enemy) || ww.sameFaction(o, enemy)) return;
  ww.setWar(o, enemy, tick, {
    kind: "into",
    warId: eg.warOfPair(overlord, enemy),
  });
}

// ---- The independence war (spec §9.3, §4.4) ----

/**
 * Spec §9.3: `subject` declares its independence war on its overlord — the
 * AI's (AiSubjects), and the one path for a human subject's declaration on
 * its overlord: only with the flag `independence_denied`. It leaves the
 * overlord's faction, its bond pauses (no flows, no war binding) and P0
 * declareWar runs with the war kind `independence` (no subject refusal).
 * False when it may not (then nothing changed).
 */
export function declareIndependence(
  eg: WwEndgame,
  subject: number,
  tick: number,
): boolean {
  const s = subjectLine(eg, subject);
  if (s === null || s.suspended) return false;
  const ww = eg.ww;
  const pol = ww.politics;
  const o = s.overlord;
  const c = pol.country(subject);
  if (c === null || !c.hasFlag(FLAG_INDEPENDENCE_DENIED, pol.day())) {
    return false;
  }
  if (ww.inPrep(tick) || !eg.isActor(subject) || !eg.isActor(o)) return false;
  if (eg.isExile(subject) || ww.isAtWar(subject, o)) return false;
  if (declareWarRules(pol, subject, o, false).block !== null) return false;
  const sp = playerOf(eg, subject);
  const op = playerOf(eg, o);
  if (sp === null || op === null) return false;
  const left = pol.sameFaction(subject, o);
  if (left) leaveFaction(pol, subject, tick);
  s.suspended = true;
  clearFlows(s);
  eg.dirtySubjects = true;
  const joined = declareWar(eg.mg, ww, sp, op, tick, {
    war: "independence",
    independence: true,
  });
  if (joined.length > 0) return true;
  s.suspended = false;
  if (left) bindFaction(eg, s, tick);
  return false;
}

/** The subject lost its independence war: integrated, no autonomy, at peace with that war's other side, back in the faction. */
function lostIndependence(
  eg: WwEndgame,
  s: Subject,
  w: WwWar,
  tick: number,
): void {
  const ww = eg.ww;
  const pol = ww.politics;
  const id = s.subject;
  if (ww.isCapitulated(id) && !eg.isExile(id)) ww.clearCapitulation(id);
  for (const m of [...w.sides[1].members].sort((a, b) => a.id - b.id)) {
    if (ww.isAtWar(id, m.id)) endWarBetween(pol, id, m.id, tick);
  }
  s.level = SUBJECT_LEVELS.indexOf("integrated");
  s.autBp = 0;
  s.lastDelta = 0;
  s.suspended = false;
  s.deniedDay = -1;
  clearFlows(s);
  eg.dirtySubjects = true;
  const c = pol.country(id);
  if (c !== null) {
    setFlag(eg, c, FLAG_INDEPENDENCE_DENIED, false);
    setFlag(eg, c, FLAG_AUTONOMY_FULL, false);
  }
  removeWarGoal(pol, id, s.overlord);
  bindFaction(eg, s, tick);
  notifyLevel(eg, id, s.overlord, "integrated");
}

/**
 * Spec §9.3, §4.4 (W's checkWarEnds calls it): independence war `warId`
 * ended, `winner` the side index that won (0: the subjects, 1: the
 * overlord). A subject that lost goes back to an integrated puppet with no
 * autonomy and its pairs of that war end (no conference); one that won
 * stays paused until W's conference settles the peace, whose end (W, or
 * settleSubjects after it) ends the bond.
 */
export function endIndependenceWar(
  eg: WwEndgame,
  warId: number,
  winner: 0 | 1,
  tick: number,
): void {
  const w = eg.war(warId);
  if (w === null || winner === 0) return;
  for (const m of [...w.sides[0].members].sort((a, b) => a.id - b.id)) {
    const s = subjectLine(eg, m.id);
    if (s === null || eg.sideIndex(w, s.overlord) !== 1) continue;
    if (eg.countryState(m.id) === "gone" && !eg.isExile(m.id)) {
      endSubject(eg, m.id, tick);
      continue;
    }
    lostIndependence(eg, s, w, tick);
  }
}

// ---- The day (spec §9.2) ----

/**
 * Spec §9.2 (the subject's country turn): the day's autonomy (autonomyDelta;
 * its lend-lease line is A's llToday, read and cleared), the flags
 * (`autonomy_full` at 100%; a new `independence_denied` gives a topple goal
 * on the overlord), then the flows of plan decision 19: the level's shares
 * of the subject's own output (yesterday's totals without the flows),
 * which subjectEconomy moves in both countries' P1 refreshTotals.
 */
export function stepSubject(eg: WwEndgame, subject: number, day: number): void {
  const tick = eg.mg.ticks();
  settleSubjects(eg, tick);
  const s = subjectLine(eg, subject);
  if (s === null) return;
  const ww = eg.ww;
  const pol = ww.politics;
  const o = s.overlord;
  const c = pol.country(subject);
  const oc = pol.country(o);
  if (s.suspended || !eg.isActor(o) || c === null || oc === null) {
    clearFlows(s);
    s.llToday = 0;
    return;
  }
  bindFaction(eg, s, tick);
  // Autonomy.
  const land = ww.land;
  const t = land.divisions;
  const fought = foughtTest(subject, day, ww.prepEndTick());
  let fighting = 0;
  for (const r of land.rowsOf(subject)) if (fought(t.lastFight[r])) fighting++;
  let garrison = 0;
  for (const r of land.rowsOf(o)) {
    if (land.controller[t.region[r]] === subject) garrison++;
  }
  const delta = autonomyDelta({
    subjFactories: eg.factoriesOf(subject),
    overlordFactories: eg.factoriesOf(o),
    ideologyDiffers: c.ruling !== oc.ruling,
    fightingDivs: fighting,
    overlordDivsInSubject: garrison,
    llFromOverlord: s.llToday,
    tightening: c.hasFlag(FLAG_CONTROL_TIGHTENED, day),
    statPct: pol.stats(subject).autonomyGainPct,
  });
  const aut = autonomyAfter(s.autBp, delta);
  if (aut !== s.autBp || delta !== s.lastDelta) eg.dirtySubjects = true;
  s.autBp = aut;
  s.lastDelta = delta;
  s.llToday = 0;
  // Flags.
  setFlag(eg, c, FLAG_AUTONOMY_FULL, aut >= WW_SUBJECT_FULL_AUT_BP);
  const tight = c.flags.get(FLAG_CONTROL_TIGHTENED);
  s.tightenUntil = tight === undefined ? -1 : tight[1];
  const denied = c.flags.get(FLAG_INDEPENDENCE_DENIED);
  if (
    denied !== undefined &&
    c.hasFlag(FLAG_INDEPENDENCE_DENIED, day) &&
    s.deniedDay !== denied[0]
  ) {
    s.deniedDay = denied[0];
    if (!pol.hasWarGoal(subject, o)) {
      addWarGoal(pol, subject, o, "topple", "", day);
    }
  }
  // Flows.
  const ce = ww.economy.country(subject);
  if (ce === null) {
    clearFlows(s);
    return;
  }
  const mine: EconAdjust = {
    res: new Array<number>(RESOURCE_COUNT).fill(0),
    civIn: 0,
    civOut: 0,
    manpower: 0,
    virtualMil: 0,
  };
  subjectEconomy(eg, subject, mine);
  // Yesterday's output without what flowed (a clamped 0 counts as none).
  const produced = ce.totals.produced.map((p, k) =>
    p > 0 ? Math.max(0, p - mine.res[k]) : 0,
  );
  const f = subjectFlows(
    levelOf(s),
    produced,
    ce.totals.civ,
    ww.economy.recruitableWith(subject, ce.law().conscriptionPermille),
  );
  for (let k = 0; k < RESOURCE_COUNT; k++) s.flowRes[k] = f.res[k] ?? 0;
  s.flowCiv = f.civ;
  s.flowMp = f.manpower;
}

/**
 * Plan decision 19: today's flows — a subject gives its resources (from
 * what it may use), civilian factories (P1's "paid" path) and recruitable
 * men; its overlord gets them (the "received" path builds only for it).
 */
export function subjectEconomy(
  eg: WwEndgame,
  id: number,
  out: EconAdjust,
): void {
  if (eg.subjects.length === 0) return;
  for (const s of eg.subjects) {
    if (s.suspended) continue;
    if (s.subject === id) {
      for (let k = 0; k < RESOURCE_COUNT; k++) out.res[k] -= s.flowRes[k];
      out.civOut += s.flowCiv;
      out.manpower -= s.flowMp;
    } else if (s.overlord === id && eg.isActor(s.subject)) {
      for (let k = 0; k < RESOURCE_COUNT; k++) out.res[k] += s.flowRes[k];
      out.civIn += s.flowCiv;
      out.manpower += s.flowMp;
    }
  }
}

// ---- Limits and trade (spec §9.1) ----

/** Spec §9.1: a subject may not do `action` on its own (a paused bond: free). */
export function subjectBlock(
  eg: WwEndgame,
  id: number,
  action: SubjectAction,
): boolean {
  const s = subjectLine(eg, id);
  if (s === null || s.suspended) return false;
  return subjectActionBlocked(levelOf(s), s.neutral, action);
}

/** Spec §9.1: percent of the civilian-factory price (an overlord buying from its dominion pays half). */
export function tradeCivFactorPct(
  eg: WwEndgame,
  buyer: number,
  seller: number,
): number {
  return subjectTradeCivPct(eg.subjectOf(seller), buyer);
}

// ---- Effects (plan decision 26) ----

/**
 * make_subject {target, level, neutral?} (the actor is the overlord; "up" /
 * "down" move an existing subject under its own overlord), end_subject
 * {target}, autonomy {pct} (the actor's own, percentage points).
 */
export function applySubjectEffect(
  ctx: EffectCtx,
  e: Effect,
  actor: number,
): void {
  const eg = ctx.pol.ww.endgame;
  switch (e.kind) {
    case "make_subject": {
      const t = resolveSelector(ctx, e.target);
      if (e.level === "up" || e.level === "down") {
        const s = subjectLine(eg, t);
        if (s !== null) {
          makeSubject(eg, t, s.overlord, e.level, s.neutral, ctx.tick);
        }
        return;
      }
      makeSubject(eg, t, actor, e.level, e.neutral === true, ctx.tick);
      return;
    }
    case "end_subject":
      endSubject(eg, resolveSelector(ctx, e.target), ctx.tick);
      return;
    case "autonomy": {
      const s = subjectLine(eg, actor);
      if (s === null) return;
      const aut = autonomyAfter(s.autBp, e.pct * 100);
      if (aut === s.autBp) return;
      s.autBp = aut;
      eg.dirtySubjects = true;
      return;
    }
    default:
      return;
  }
}
