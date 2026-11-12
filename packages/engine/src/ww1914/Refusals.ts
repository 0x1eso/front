// Great War 1914 (ww190 §4): refusals in an army. France's only, in v1: after
// a great offensive in the west has failed, with the nerve low and the front
// worn, regiments refuse to go up. Unanswered, it spreads a stage a month: at
// the second the world knows (`fra_army_refusals`), at the third order breaks
// and the ladder climbs. The command answers with the courts, with rest (no
// great attack for three months), or with both; the President reviews the
// sentences. No date anywhere: the state calls it.
import {
  GW_INST_MAX,
  GW_INST_MIN,
  GwInstitution,
  GwRefusal,
  GwRefusalAnswer,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import type { GreatWar } from "./GreatWar";
import { beatSince } from "./Rule";
import { strainOf } from "./Strain";
import { memberEnd } from "./Wars";
import {
  clampTo,
  fights,
  isLongChapter,
  monthsFrom,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

export type GwRefusalsCond = Extract<GwWorldCond, { is: "refusals" }>;
export type GwRefusalsEffect = Extract<
  GwWorldEffect,
  { do: "refusals" | "pardon" }
>;

/** The armies that can refuse (v1). */
const REFUSERS: readonly GwTag[] = ["FRA"];
const STAGE_MAX = 3;
/** The world learns of it at this stage. */
const KNOWN_AT = 2;
const SECRET = "fra_army_refusals";
/** Strain of the west at which a failed attack can set it off; alone. */
const STRAIN_FAILED = 60;
const STRAIN_ALONE = 80;
/** Chapters since a failed great attack that still count. */
const FAILED_WITHIN = 2;
/** Months an answer holds before an unhealed army refuses again. */
const ANSWER_HOLDS = 3;
/** Months of rest the command grants. */
const REST_MONTHS = 3;
/** Months a healed army stays quiet before it can refuse again. */
const QUIET_AFTER = 6;

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

export function refusalsOf(gw: GreatWar, tag: GwTag): GwRefusal | null {
  return gw.s.refusals?.find((r) => r.tag === tag) ?? null;
}

function shiftInst(gw: GreatWar, tag: GwTag, i: GwInstitution, d: number) {
  const n = gw.nation(tag);
  const v = n?.inst[i];
  if (n === null || v === undefined || d === 0) return;
  n.inst[i] = clampTo(v + d, GW_INST_MIN, GW_INST_MAX);
}

function tell(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
}

/** The scene of a stage, where the writers have one. */
function schedule(gw: GreatWar, tag: GwTag, stage: number): void {
  const scene = `${tag.toLowerCase()}_m_refusals_${stage}`;
  if (!gwContent().scenes.some((x) => x.id === scene)) return;
  for (const seat of seatsOf(gw, tag)) {
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
}

/** The chapter `months` months on, by the calendar's dates. */
function chapterIn(gw: GreatWar, months: number): number {
  const rows = gwChapters(gw.s.calendar);
  const day = rows[gw.s.chapter].day + 30 * months;
  const i = rows.findIndex((c) => c.day >= day);
  return i < 0 ? rows.length : i;
}

export function answerRefusals(
  gw: GreatWar,
  tag: GwTag,
  a: GwRefusalAnswer,
): void {
  const r = refusalsOf(gw, tag);
  if (r === null || r.stage === 0 || a === "none") return;
  const n = gw.nation(tag)!;
  switch (a) {
    case "courts":
      r.stage--;
      shiftInst(gw, tag, "army", 1);
      shiftInst(gw, tag, "chamber", -1);
      break;
    case "rest":
      r.stage--;
      n.strength.west = Math.max(1, (n.strength.west ?? 1) - 1);
      r.restUntil = chapterIn(gw, REST_MONTHS);
      break;
    case "both":
      // Half of each price: the Chamber's anger and the rest's pause stay;
      // the courts' hold on the army and the rest's lost strength don't.
      r.stage -= 2;
      shiftInst(gw, tag, "chamber", -1);
      r.restUntil = chapterIn(gw, REST_MONTHS);
      break;
  }
  r.stage = Math.max(0, r.stage);
  r.answer = a;
  r.since = gw.s.chapter;
  news(gw, "refusals_answered", tag);
  tell(gw, tag, "refusals_answered");
}

/** The President's review of the sentences: many pardons, or few. */
export function pardon(gw: GreatWar, tag: GwTag, many: boolean): void {
  const r = refusalsOf(gw, tag);
  if (r === null) return;
  shiftInst(gw, tag, "chamber", many ? 1 : -1);
  shiftInst(gw, tag, "army", many ? -1 : 1);
  r.pardons++;
}

/** The rest the command granted blocks new great offensives (Offensives.ts). */
export function restBlocks(gw: GreatWar, tag: GwTag): boolean {
  const r = refusalsOf(gw, tag);
  return r !== null && r.restUntil > gw.s.chapter;
}

export function refusalsHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwRefusalsCond,
): boolean {
  const r = refusalsOf(gw, c.tag ?? "FRA");
  if (r === null) return false;
  if (c.answer !== undefined && r.answer !== c.answer) return false;
  if (c.pardons !== undefined && !inRange(r.pardons, c.pardons)) return false;
  // A range with neither end asks for refusals now.
  if (c.min === undefined && c.max === undefined) {
    return c.pardons !== undefined || r.stage >= 1;
  }
  return inRange(r.stage, c);
}

export function refusalsDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: GwRefusalsEffect,
): void {
  if (e.do === "refusals") answerRefusals(gw, seat.tag, e.answer);
  else pardon(gw, seat.tag, e.many);
}

// ---- The chapter ----

/** The army's nerve is gone after a great attack in the west failed. */
function breaks(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || !fights(n) || memberEnd(gw, "west", tag) === null) {
    return false;
  }
  const west = gw.s.theatres.find((t) => t.id === "west");
  if (west === undefined || !west.open) return false;
  const strain = strainOf(gw, "west", tag);
  const morale = n.gauges.morale;
  if (morale <= 1 && strain >= STRAIN_ALONE) return true;
  if (morale > 2 || strain < STRAIN_FAILED) return false;
  return (gw.s.offensives ?? []).some(
    (o) =>
      o.tag === tag &&
      o.theatre === "west" &&
      !o.feint &&
      o.done !== null &&
      gw.s.chapter - o.done <= FAILED_WITHIN &&
      (o.last === "repulsed" || o.last === "attrition"),
  );
}

function stageUp(gw: GreatWar, r: GwRefusal): void {
  r.stage = Math.min(STAGE_MAX, r.stage + 1);
  r.since = gw.s.chapter;
  r.answer = "none";
  news(gw, `refusals_${r.stage}`, r.tag);
  tell(gw, r.tag, `refusals_${r.stage}`);
  if (r.stage >= KNOWN_AT && !gw.s.secrets.includes(SECRET)) {
    gw.s.secrets.push(SECRET);
  }
  schedule(gw, r.tag, r.stage);
}

function step(gw: GreatWar, tag: GwTag): void {
  const s = gw.s;
  let r = refusalsOf(gw, tag);
  if (r === null || r.stage === 0) {
    if (r !== null && monthsFrom(gw, r.since) < QUIET_AFTER) return;
    if (!breaks(gw, tag)) return;
    if (r === null) {
      r = {
        tag,
        stage: 0,
        since: s.chapter,
        answer: "none",
        pardons: 0,
        restUntil: -1,
      };
      s.refusals ??= [];
      s.refusals.push(r);
    }
    stageUp(gw, r);
    return;
  }
  const n = gw.nation(tag)!;
  if (!fights(n)) return;
  // An AI command answers at once, by its character.
  if (r.answer === "none" && !ruledBySeat(gw, tag)) {
    answerRefusals(gw, tag, n.ai === "hardline" ? "courts" : "both");
    return;
  }
  const wait = r.answer === "none" ? 1 : ANSWER_HOLDS;
  if (r.stage < STAGE_MAX && monthsFrom(gw, r.since) >= wait) {
    stageUp(gw, r);
    return;
  }
  // The third stage, left: order breaks and the ladder climbs.
  if (r.stage === STAGE_MAX && beatSince(gw, r.since, 2)) {
    moveGauge(gw, tag, "order", -2, "refusals_3");
    n.lowOrder += 2;
  }
}

/** Chapter step, after the home front. */
export function refusalsStep(gw: GreatWar): void {
  if (!isLongChapter(gw) || gw.s.armistice !== null) return;
  for (const tag of REFUSERS) step(gw, tag);
}
