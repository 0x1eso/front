// Great War 1914: the great offensive as a decision (ww173 phase B, design
// ww173 §4). The chief's paper prepares one; it launches when prepared, then
// each chapter the ruler presses on or stops. The defender may learn of it
// (Spies, S7c) and answer. Everything here is hidden from other countries.
import {
  GW_OFF_METHODS,
  GW_SIDES,
  GwAlloc,
  GwNationState,
  GwOffCounter,
  GwOffensive,
  GwOffMethod,
  GwResult,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwFrontPrepView } from "@openfront/engine-api/ww1914/GwWorldView";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { eraOf, hasTech } from "./Eras";
import {
  atEnd,
  bleed,
  lossesOf,
  move,
  offenseOdds,
  pressOdds,
  settle,
  trenchFaced,
} from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { GW_HOME } from "./HomeTable";
import { believedStrain, capturedOrders } from "./Spies";
import { addStrain, strainOf } from "./Strain";
import { memberEnd, membersOf } from "./Wars";
import {
  defOf,
  fights,
  monthsOf,
  moveGauge,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

/** What another lane reads of an offensive (ww173 interfaces). */
export interface GwOffensiveView {
  tag: GwTag;
  theatre: GwTheatre;
  from: number;
  launch: number | null;
  method: "long" | "broad" | "surprise";
  feint: boolean;
  quiet: boolean;
  round: number;
}

const P_OFFENSIVE = idHash("gw_offensive");
const P_GAP = idHash("gw_offensive_gap");
const P_PAPERS = idHash("gw_offensive_papers");
const P_STRIKE = idHash("gw_offensive_strike");
const P_AI_PREP = idHash("gw_offensive_ai");

/** The launch roll, percent: wider than a chapter's 85..115. */
const ROLL_LOW = 70;
const ROLL_SPAN = 61;
/**
 * Somewhere the line gives: a tired division, a gap in the wire. The chance a
 * day finds it, percent, and what it adds to the roll. A surprise looks for
 * it; a defender at the end of his strength has more of them.
 */
const GAP_PCT = 22;
const GAP_SURPRISE = 8;
const GAP_STRAINED = 10;
const GAP_ROLL = 70;
/** Percent of the preparation's weight that counts on the day. */
const WEIGHT_WORTH = 33;
/** What each method adds, and the trench it takes off. */
const METHOD: Readonly<Record<GwOffMethod, number>> = {
  long: 15,
  broad: 5,
  surprise: 10,
};
/** Nobody on the other end saw it coming. */
const UNSEEN = 25;
/** It was seen, and the defender sent his reserves. */
const SEEN_MET = -20;
/** The defender stepped back before it: the guns hit empty trenches. */
const STEPPED_BACK = -25;
/** Allies launching the same chapter on two fronts, each. */
const JOINT = 15;
/** Ratios for each result of a round. */
const BREAK_AT = 170;
const BITE_AT = 115;
const ATTRITION_AT = 80;
/** A great offensive can break a line dug this deep, faced, and no deeper. */
const BREAK_TRENCH = 5;
const WEIGHT_MAX = 75;
const ROUNDS = 4;
/** Chapters a country rests after an offensive before it prepares another. */
const REST = 3;
/** The defender's reserves: sent, and gathered for each later round. */
const COUNTER_RESERVES = 20;
const ROUND_RESERVES = 10;
const COUNTER_CHAPTERS = 2;
/** A spoiling blow that works takes this off the weight. */
const STRIKE_WEIGHT = 20;
/** Strain at which a staff stops pressing on; a hard one goes further. */
const PRESS_STRAIN = 60;
const PRESS_STRAIN_HARD = 75;
/** Fronts with no great offensive: the sea and the far colonies. */
const NO_OFFENSIVE: readonly GwTheatre[] = ["sea", "colonies"];
/** Chapters after the war opens when plans still run on peace's drawings. */
const OPENING = 3;
/** Chapters an AI staff waits after a great push, by character. */
const AI_REST = {
  hardline: 3,
  opportunist: 4,
  principled: 5,
  cautious: 7,
} as const;
/**
 * Odds an AI staff wants to prepare on, counting what three months of
 * preparation and its method would add on the day; a bold one less.
 */
const AI_ODDS = 90;
const AI_ODDS_BOLD = 75;
/** Percent chance a rested staff that could prepare does so this chapter. */
const AI_PREP_PCT = 60;
/** Foe's strain an AI staff believes it can break. */
const AI_STRAIN = 40;

function list(gw: GreatWar): GwOffensive[] {
  return gw.s.offensives ?? [];
}

function live(o: GwOffensive): boolean {
  return o.done === null;
}

function theatreOf(gw: GreatWar, t: GwTheatre): GwTheatreState {
  return gw.s.theatres.find((x) => x.id === t)!;
}

function viewOf(o: GwOffensive): GwOffensiveView {
  return {
    tag: o.tag,
    theatre: o.theatre,
    from: o.from,
    launch: o.launch,
    method: o.method,
    feint: o.feint,
    quiet: o.quiet,
    round: o.round,
  };
}

function recordOf(gw: GreatWar, o: GwOffensiveView): GwOffensive | null {
  return (
    list(gw).find(
      (x) =>
        live(x) &&
        x.tag === o.tag &&
        x.theatre === o.theatre &&
        x.feint === o.feint,
    ) ?? null
  );
}

// ---- What the other lanes read (ww173 interfaces) ----

/** Offensives in preparation or running, feints too, sorted by tag. */
export function offensivesOf(gw: GreatWar): readonly GwOffensiveView[] {
  const idx = (t: GwTheatre) => gw.s.theatres.findIndex((x) => x.id === t);
  return list(gw)
    .filter(live)
    .map(viewOf)
    .sort((a, b) =>
      a.tag === b.tag
        ? idx(a.theatre) - idx(b.theatre)
        : a.tag < b.tag
          ? -1
          : 1,
    );
}

/** How loud its preparation is (design §6 L): a feint is as loud as 40. */
export function loudnessOf(gw: GreatWar, o: GwOffensiveView): number {
  if (o.feint) return 40;
  const chapters = Math.max(0, gw.s.chapter - o.from);
  const base =
    o.method === "long" ? 50 + 25 * chapters : o.method === "broad" ? 30 : 15;
  return base - (o.quiet ? 15 : 0);
}

/**
 * `by` has learned of it. A defender on its front is sent the counterplay
 * scene (a seat) or weighs it at once (an AI). `code`: learned through a code
 * `by` reads, which opens "play dumb".
 */
export function markSeen(
  gw: GreatWar,
  o: GwOffensiveView,
  by: GwTag,
  code = false,
): void {
  const r = recordOf(gw, o);
  if (r === null || by === r.tag) return;
  if (code && !r.codeBy.includes(by)) r.codeBy.push(by);
  if (r.seenBy.includes(by)) return;
  r.seenBy.push(by);
  if (memberEnd(gw, r.theatre, by) !== other(r.end)) return;
  if (r.answers.some((a) => a.tag === by)) return;
  if (ruledBySeat(gw, by)) {
    for (const seat of seatsOf(gw, by)) {
      seat.scheduled.push({
        scene: "gw_offensive_seen",
        chapter: gw.s.chapter + 1,
      });
    }
    return;
  }
  const n = gw.nation(by);
  if (n !== null) aiCounter(gw, r, n);
}

export function seenBy(gw: GreatWar, o: GwOffensiveView): readonly GwTag[] {
  return recordOf(gw, o)?.seenBy ?? [];
}

/** What `tag` did about it, if anything (for the code's suspicion, S7c). */
export function counterOf(
  gw: GreatWar,
  o: GwOffensiveView,
  tag: GwTag,
): GwOffCounter | null {
  return recordOf(gw, o)?.answers.find((a) => a.tag === tag)?.pick ?? null;
}

// ---- The paper ----

/** The country's own offensive under way, prepared or running; not a feint. */
export function ownOffensive(gw: GreatWar, tag: GwTag): GwOffensive | null {
  return list(gw).find((o) => live(o) && o.tag === tag && !o.feint) ?? null;
}

/** Months of preparation before it goes in. */
function need(o: GwOffensive): number {
  return o.months + (o.quiet ? 1 : 0);
}

export function isReady(o: GwOffensive): boolean {
  return o.round === 0 && o.prepared >= need(o);
}

/** Resting after one: no paper for a new one yet. */
function resting(gw: GreatWar, tag: GwTag): boolean {
  return list(gw).some(
    (o) =>
      o.tag === tag &&
      !o.feint &&
      o.done !== null &&
      gw.s.chapter - o.done < REST,
  );
}

/** Whether the paper can be offered on `t` at all. */
export function offensiveFront(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
): boolean {
  const s = gw.s;
  if (NO_OFFENSIVE.includes(t)) return false;
  if (s.warChapter === null || s.chapter <= s.warChapter + OPENING) {
    return false;
  }
  if (ownOffensive(gw, tag) !== null || resting(gw, tag)) return false;
  const end = memberEnd(gw, t, tag);
  return end !== null && !atEnd(theatreOf(gw, t), end);
}

/** Each method, open or why not (design §4 "The paper"). */
export function methodsFor(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
): { method: GwOffMethod; open: boolean; why: string | null }[] {
  const n = gw.nation(tag)!;
  const th = theatreOf(gw, t);
  const commander = th.commander === null ? null : gw.person(th.commander);
  const ownCommander =
    commander !== null && defOf(commander.id)?.tag === tag ? commander : null;
  const broad =
    hasTech(n, "assault_groups") || ownCommander?.competence[0] === 3;
  const surprise =
    hasTech(n, "infiltration") ||
    hasTech(n, "tanks") ||
    hasTech(n, "predicted_fire") ||
    eraOf(gw).id === "storm";
  return GW_OFF_METHODS.map((method) => {
    const open = method === "long" || (method === "broad" ? broad : surprise);
    const why = open
      ? null
      : method === "broad"
        ? "off_no_broad"
        : "off_no_surprise";
    return { method, open, why };
  });
}

/** The fronts a feint can be on: the country's other fronts. */
export function feintFronts(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
): GwTheatre[] {
  return gw.s.theatres
    .filter(
      (x) =>
        x.open &&
        x.id !== t &&
        !NO_OFFENSIVE.includes(x.id) &&
        memberEnd(gw, x.id, tag) !== null,
    )
    .map((x) => x.id);
}

/** The papers instead of the usual ones while an offensive is under way. */
export function offensivePaperIds(
  gw: GreatWar,
  o: GwOffensive,
  bold: boolean,
): string[] {
  if (o.round === 0) {
    return isReady(o) ? ["launch", "prep_stop"] : ["prep_go", "prep_stop"];
  }
  const tired = strainOf(gw, o.theatre, o.tag) >= PRESS_STRAIN;
  return !bold && tired ? ["stop", "press_on"] : ["press_on", "stop"];
}

/** Papers of this file: their order answers by id. */
export const GW_OFFENSIVE_PAPERS: readonly string[] = [
  "offensive",
  "prep_go",
  "launch",
  "prep_stop",
  "press_on",
  "stop",
];

function blank(
  tag: GwTag,
  t: GwTheatre,
  end: GwSide,
  chapter: number,
  method: GwOffMethod,
  months: number,
  quiet: boolean,
  feint: boolean,
): GwOffensive {
  return {
    tag,
    theatre: t,
    end,
    from: chapter,
    launch: null,
    method,
    weight: 0,
    feint,
    quiet,
    round: 0,
    seenBy: [],
    months,
    prepared: 0,
    press: null,
    done: null,
    codeBy: [],
    answers: [],
  };
}

/** Starts one: the record, and a feint's record and price. */
function prepare(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
  method: GwOffMethod,
  months: number,
  quiet: boolean,
  feint: GwTheatre | null,
): void {
  const s = gw.s;
  const end = memberEnd(gw, t, tag)!;
  s.offensives ??= [];
  s.offensives.push(
    blank(tag, t, end, s.chapter, method, months, quiet, false),
  );
  if (feint === null) return;
  const fEnd = memberEnd(gw, feint, tag);
  if (fEnd === null) return;
  s.offensives.push(
    blank(tag, feint, fEnd, s.chapter, method, months, quiet, true),
  );
  const n = gw.nation(tag)!;
  if (n.gauges.money > 0) moveGauge(gw, tag, "money", -1, "off_feint");
  else moveGauge(gw, tag, "shells", -1, "off_feint");
}

/** Ends it, and its feint with it. */
function end(gw: GreatWar, o: GwOffensive): void {
  o.done = gw.s.chapter;
  for (const f of list(gw)) {
    if (f.feint && live(f) && f.tag === o.tag) f.done = gw.s.chapter;
  }
}

export interface GwOffensivePick {
  method?: GwOffMethod;
  months?: number;
  feint?: GwTheatre;
  quiet?: boolean;
}

/**
 * A seat signed one of this file's papers (or the chief's stood). Returns a
 * block reason, or null. `methods`/`feints`: what the paper offered.
 */
export function signOffensivePaper(
  gw: GreatWar,
  seat: GwSeatState,
  id: string,
  main: GwTheatre,
  pick: GwOffensivePick,
  dryRun = false,
): "closed" | "not_proposed" | null {
  const o = ownOffensive(gw, seat.tag);
  if (id === "offensive") {
    if (o !== null || !offensiveFront(gw, seat.tag, main)) return "closed";
    const method = pick.method ?? "long";
    const row = methodsFor(gw, seat.tag, main).find((m) => m.method === method);
    if (row === undefined || !row.open) return "closed";
    const months = pick.months === 3 ? 3 : 1;
    const feint = pick.feint ?? null;
    if (feint !== null && !feintFronts(gw, seat.tag, main).includes(feint)) {
      return "closed";
    }
    if (dryRun) return null;
    prepare(gw, seat.tag, main, method, months, pick.quiet === true, feint);
    reason(gw, seat, "off_prepared");
    return null;
  }
  if (o === null || o.theatre !== main) return "not_proposed";
  if (dryRun) return null;
  switch (id) {
    case "prep_stop":
    case "stop":
      end(gw, o);
      reason(gw, seat, "off_called_off");
      return null;
    case "press_on":
      o.press = gw.s.chapter;
      return null;
    default:
      return null;
  }
}

// ---- The chapter ----

/** Reserves an answer moved: `here` more on `t`, or none at all (`away`). */
export function counterReserves(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
): { here: number; away: boolean } {
  const c = gw.s.chapter;
  let here = 0;
  let away = false;
  for (const o of list(gw)) {
    for (const a of o.answers) {
      if (a.tag !== tag || a.pick !== "reserves") continue;
      if (c < a.chapter || c >= a.chapter + COUNTER_CHAPTERS) continue;
      if (o.theatre === t) here += COUNTER_RESERVES;
      else away = true;
    }
  }
  return { here, away: away && here === 0 };
}

/** Cost and gain of a chapter's preparation (design §4 "Preparation"). */
function prepStep(gw: GreatWar, o: GwOffensive): void {
  const n = gw.nation(o.tag)!;
  o.weight = Math.min(
    WEIGHT_MAX,
    o.weight +
      10 +
      (n.gauges.shells >= 2 ? 10 : 0) +
      (n.manpower >= 40 ? 5 : 0),
  );
  n.manpower = Math.max(0, n.manpower - 3);
  if (o.method === "long") moveGauge(gw, o.tag, "shells", -1, "off_shells");
  addStrain(gw, o.theatre, o.tag, -2);
  if (o.prepared === 0) moveGauge(gw, o.tag, "morale", 1, "off_papers_talk");
  o.prepared += monthsOf(gw);
}

/** Whether it still has a front to go in on. */
function stillOn(gw: GreatWar, o: GwOffensive): boolean {
  const n = gw.nation(o.tag);
  const t = theatreOf(gw, o.theatre);
  return fights(n) && t.open && memberEnd(gw, o.theatre, o.tag) === o.end;
}

/**
 * Before the fronts are judged: spoiling blows, a chapter of preparation,
 * launches, and the rounds pressed on. Each offensive that goes in this
 * chapter is then fought by `judgeOffensives` in its theatre's turn.
 */
export function offensiveStep(gw: GreatWar): void {
  const s = gw.s;
  const all = list(gw);
  if (all.length === 0) return;
  s.offensives = all.filter(
    (o) => o.done === null || s.chapter - o.done <= REST,
  );
  for (const o of s.offensives) {
    if (!live(o)) continue;
    if (!stillOn(gw, o)) {
      end(gw, o);
      continue;
    }
    strikes(gw, o);
  }
  for (const o of s.offensives) {
    if (!live(o) || o.feint) continue;
    if (o.round === 0) {
      if (isReady(o)) {
        o.round = 1;
        o.launch = s.chapter;
        news(gw, "off_launched", o.tag, null, o.theatre);
      } else {
        prepStep(gw, o);
      }
    } else if (o.press === s.chapter && o.round < ROUNDS) {
      o.round++;
      o.weight = Math.floor(o.weight / 2);
    } else {
      end(gw, o);
      for (const seat of seatsOf(gw, o.tag)) reason(gw, seat, "off_over");
    }
  }
  // A feint lasts as long as what it hides.
  for (const f of s.offensives) {
    if (!f.feint || !live(f)) continue;
    if (ownOffensive(gw, f.tag) === null) f.done = s.chapter;
    else f.prepared += monthsOf(gw);
  }
}

/** Whether `o` goes in as this chapter closes. */
function goesIn(gw: GreatWar, o: GwOffensive): boolean {
  return (
    live(o) &&
    !o.feint &&
    o.round > 0 &&
    (o.launch === gw.s.chapter || o.press === gw.s.chapter)
  );
}

/** A spoiling blow the defender ordered for this chapter. */
function strikes(gw: GreatWar, o: GwOffensive): void {
  const s = gw.s;
  for (const a of o.answers) {
    if (a.pick !== "strike" || a.chapter !== s.chapter) continue;
    const by = other(o.end);
    const t = theatreOf(gw, o.theatre);
    const i = s.theatres.indexOf(t);
    const roll = 85 + (wwRoll(s.seed, P_STRIKE, s.chapter, i) % 31);
    const ratio = Math.floor((pressOdds(gw, o.theatre, by) * roll) / 100);
    const worked = ratio >= ATTRITION_AT;
    const [lostA, lostD] = lossesOf(
      gw,
      o.theatre,
      by,
      worked ? "stalemate" : "repelled",
      true,
    );
    bleed(gw, o.theatre, by, lostA);
    bleed(gw, o.theatre, o.end, lostD);
    if (worked) o.weight = Math.max(0, o.weight - STRIKE_WEIGHT);
    for (const seat of seatsOf(gw, a.tag)) {
      reason(gw, seat, worked ? "off_strike_worked" : "off_strike_failed");
    }
  }
}

/** Ratio's parts, for the launch table; exported for the fixed-state check. */
export function offensiveRatio(
  gw: GreatWar,
  o: GwOffensive,
): { ratio: number; faced: number } {
  const s = gw.s;
  const t = theatreOf(gw, o.theatre);
  const i = s.theatres.indexOf(t);
  const foe = other(o.end);
  const defenders = membersOf(gw, o.theatre, foe);
  const mine = (pick: GwOffCounter) =>
    o.answers.some((a) => a.pick === pick && defenders.includes(a.tag));
  const steppedBack = mine("step_back");
  // The defender's reserves: what he sent, and what he gathers each round.
  // A broad front pins them where they stand: they count once.
  const sent = defenders.reduce(
    (sum, tag) => sum + counterReserves(gw, tag, o.theatre).here,
    0,
  );
  const foePrep = list(gw)
    .filter((x) => goesIn(gw, x) && x.theatre === o.theatre && x.end === foe)
    .reduce((sum, x) => sum + Math.floor(x.weight / 2), 0);
  const extra =
    o.method === "broad" ? -sent : ROUND_RESERVES * (o.round - 1) + foePrep;
  const odds = offenseOdds(gw, t, o.end, extra);
  const seen = o.seenBy.some((x) => defenders.includes(x));
  const surprise =
    o.round !== 1 ? 0 : !seen ? UNSEEN : mine("reserves") ? SEEN_MET : 0;
  const joint =
    o.round === 1 &&
    list(gw).some(
      (x) =>
        goesIn(gw, x) &&
        x.round === 1 &&
        x.tag !== o.tag &&
        x.theatre !== o.theatre &&
        gw.nation(x.tag)?.side === gw.nation(o.tag)?.side &&
        gw.nation(o.tag)?.side !== null,
    )
      ? JOINT
      : 0;
  const method = steppedBack ? 0 : METHOD[o.method];
  const back = steppedBack && o.round === 1 ? STEPPED_BACK : 0;
  let roll = ROLL_LOW + (wwRoll(s.seed, P_OFFENSIVE, s.chapter, i) % ROLL_SPAN);
  const lead = defenders[0];
  const gap =
    GAP_PCT +
    (o.method === "surprise" && !seen ? GAP_SURPRISE : 0) +
    (lead !== undefined && strainOf(gw, o.theatre, lead) >= 60
      ? GAP_STRAINED
      : 0);
  if (wwRoll(s.seed, P_GAP, s.chapter, i, o.round) % 100 < gap) {
    roll += GAP_ROLL;
  }
  const weight = Math.floor((o.weight * WEIGHT_WORTH) / 100);
  const ratio = Math.floor(
    ((odds + weight + method + surprise + joint + back) * roll) / 100,
  );
  const n = gw.nation(o.tag)!;
  const cut =
    o.method === "broad"
      ? 1
      : o.method === "surprise"
        ? hasTech(n, "infiltration")
          ? 2
          : 1
        : 0;
  return { ratio, faced: Math.max(0, trenchFaced(gw, t) - cut) };
}

export type GwOffResult = "break" | "bite" | "attrition" | "repulsed";

export function offensiveResult(ratio: number, faced: number): GwOffResult {
  if (ratio >= BREAK_AT && faced <= BREAK_TRENCH) return "break";
  if (ratio >= BITE_AT) return "bite";
  if (ratio >= ATTRITION_AT) return "attrition";
  return "repulsed";
}

const AS_BATTLE: Readonly<Record<GwOffResult, GwResult>> = {
  break: "break",
  bite: "advance",
  attrition: "stalemate",
  repulsed: "repelled",
};

/** One round of one offensive: the table, the ground, the blood. */
function round(gw: GreatWar, o: GwOffensive): void {
  const s = gw.s;
  const t = theatreOf(gw, o.theatre);
  const foe = other(o.end);
  const { ratio, faced } = offensiveRatio(gw, o);
  const result = offensiveResult(ratio, faced);
  const battle = AS_BATTLE[result];
  const lead = membersOf(gw, o.theatre, foe)[0] ?? null;
  const strain = (tag: GwTag | null, d: number) => {
    if (tag !== null) addStrain(gw, o.theatre, tag, d);
  };
  let steps = 0;
  if (result === "break") {
    steps = Math.min(6, 3 + Math.floor((ratio - BREAK_AT) / 30));
    strain(lead, 30);
    if (wwRoll(s.seed, P_PAPERS, s.chapter, s.theatres.indexOf(t)) % 5 === 0) {
      capturedOrders(gw, o.tag, o.theatre);
    }
  } else if (result === "bite") {
    steps = ratio >= BITE_AT + 25 ? 2 : 1;
    strain(lead, 12);
  } else if (result === "attrition") {
    strain(lead, 10);
    strain(o.tag, 6);
  } else {
    strain(o.tag, 18);
  }
  if (o.round > 1) strain(lead, 8);
  if (steps > 0) move(gw, t, o.end, steps);
  const [rawA, lostD] = lossesOf(gw, o.theatre, o.end, battle, false);
  const lostA =
    result === "attrition"
      ? Math.floor((rawA * 130) / 100)
      : result === "repulsed"
        ? Math.floor(
            (lossesOf(gw, o.theatre, o.end, "stalemate", false)[0] * 180) / 100,
          )
        : rawA;
  bleed(gw, o.theatre, o.end, lostA);
  bleed(gw, o.theatre, foe, lostD);
  s.battles.push({
    theatre: o.theatre,
    chapter: s.chapter,
    result: battle,
    by: o.end,
    lost: o.end === GW_SIDES[0] ? [lostA, lostD] : [lostD, lostA],
    line: t.line,
    luck: 0,
  });
  settle(gw, t, o.end, battle);
  for (const tag of membersOf(gw, o.theatre, o.end)) {
    gw.nation(tag)!.spent = s.chapter;
  }
  news(gw, `off_${result}`, o.tag, lead, o.theatre);
  for (const seat of seatsOf(gw, o.tag)) reason(gw, seat, `off_${result}`);
  if (lead !== null) {
    for (const tag of membersOf(gw, o.theatre, foe)) {
      for (const seat of seatsOf(gw, tag)) {
        reason(
          gw,
          seat,
          result === "break" || result === "bite"
            ? "off_def_gave"
            : "off_def_held",
        );
      }
    }
  }
  const n = gw.nation(o.tag)!;
  if (
    result === "repulsed" &&
    strainOf(gw, o.theatre, o.tag) >= 60 &&
    n.gauges.morale <= 2
  ) {
    armyRefuses(gw, n);
  }
  if (o.round >= ROUNDS) end(gw, o);
}

/**
 * The army will not go again: the ladder's army rung, and the seat's own
 * scene of it where one is written (design §4, the mutiny hook).
 */
function armyRefuses(gw: GreatWar, n: GwNationState): void {
  const ARMY_RUNG = 3;
  news(gw, "off_refusal", n.tag);
  if (n.unrest >= ARMY_RUNG) return;
  n.unrest = ARMY_RUNG;
  moveGauge(gw, n.tag, "order", -1, "off_refusal");
  const scene = GW_HOME[n.tag]?.rungs[ARMY_RUNG - 1] ?? "gw_unrest";
  for (const seat of seatsOf(gw, n.tag)) {
    reason(gw, seat, "off_refusal");
    seat.scheduled.push({ scene, chapter: gw.s.chapter + 1 });
  }
}

/**
 * In a theatre's turn: the offensives that go in this chapter, each on its
 * own table. True when there were any, and the theatre's usual judging is
 * skipped. Both ends may go in at once: both resolve.
 */
export function judgeOffensives(gw: GreatWar, t: GwTheatreState): boolean {
  const going = list(gw)
    .filter((o) => goesIn(gw, o) && o.theatre === t.id)
    .sort((a, b) => (a.tag < b.tag ? -1 : 1));
  for (const o of going) round(gw, o);
  return going.length > 0;
}

// ---- The defender's answer ----

/** The offensive the seat's country learned of and has not answered. */
function pending(gw: GreatWar, tag: GwTag): GwOffensive | null {
  return (
    list(gw).find(
      (o) =>
        live(o) &&
        o.seenBy.includes(tag) &&
        !o.answers.some((a) => a.tag === tag) &&
        memberEnd(gw, o.theatre, tag) === other(o.end),
    ) ?? null
  );
}

export function foeOffensiveHolds(
  gw: GreatWar,
  tag: GwTag,
  c: { theatre?: GwTheatre[]; method?: GwOffMethod[]; code?: boolean },
): boolean {
  const o = pending(gw, tag);
  if (o === null) return false;
  if (c.theatre !== undefined && !c.theatre.includes(o.theatre)) return false;
  if (c.method !== undefined && !c.method.includes(o.method)) return false;
  if (c.code !== undefined && o.codeBy.includes(tag) !== c.code) return false;
  return true;
}

/** Whether `n` can step back and take it in depth. */
export function canStepBack(gw: GreatWar, n: GwNationState): boolean {
  const era = eraOf(gw).id;
  return hasTech(n, "depth_defence") || era === "depth" || era === "storm";
}

/** The answer, on the offensive `tag` learned of. */
export function counterOffensive(
  gw: GreatWar,
  tag: GwTag,
  pick: GwOffCounter,
  chapter = gw.s.chapter,
): void {
  const o = pending(gw, tag);
  const n = gw.nation(tag);
  if (o === null || n === null) return;
  if (pick === "step_back" && !canStepBack(gw, n)) return;
  o.answers.push({ tag, pick, chapter });
  if (pick === "reserves") n.manpower = Math.max(0, n.manpower - 2);
  if (pick === "step_back") move(gw, theatreOf(gw, o.theatre), o.end, 1);
}

/** An AI weighs what it learned at once, by its character. */
function aiCounter(gw: GreatWar, o: GwOffensive, n: GwNationState): void {
  const next = gw.s.chapter + 1;
  const depth = canStepBack(gw, n);
  const odds = pressOdds(gw, o.theatre, other(o.end));
  const pick: GwOffCounter =
    n.ai === "hardline" && odds >= AI_ODDS_BOLD
      ? "strike"
      : n.ai === "opportunist" && depth
        ? "step_back"
        : n.manpower >= 15
          ? "reserves"
          : depth
            ? "step_back"
            : "dumb";
  counterOffensive(gw, n.tag, pick, next);
}

// ---- AI staffs (they replace the old CAMPAIGN_REST) ----

const BOLD_AI: readonly GwNationState["ai"][] = ["hardline", "opportunist"];
/** Armies that hold what is left of their country: no great offensives. */
const NO_GREAT: readonly GwTag[] = ["BEL", "MNE"];

/**
 * An AI staff's effort while it prepares or fights a great offensive, or as
 * it starts one; null leaves the usual plan. It prepares when rested, with
 * shells, believing the foe strained or its own odds good; a bold one on
 * worse odds. It presses on while its own strain allows.
 */
export function aiOffensive(
  gw: GreatWar,
  n: GwNationState,
  main: GwTheatre,
  research: GwAlloc["research"],
): GwAlloc | null {
  const s = gw.s;
  const plan = (t: GwTheatre, go: boolean): GwAlloc => ({
    main: t,
    posture: go ? "offensive" : "hold",
    scale: go ? "major" : "limited",
    allyShare: 0,
    research,
  });
  const o = ownOffensive(gw, n.tag);
  if (o !== null) {
    if (o.round === 0) {
      // It goes in as the next chapter closes if it is ready now.
      return plan(o.theatre, isReady(o));
    }
    const cap = n.ai === "hardline" ? PRESS_STRAIN_HARD : PRESS_STRAIN;
    const presses =
      o.round < ROUNDS &&
      strainOf(gw, o.theatre, n.tag) < cap &&
      n.gauges.morale > 1 &&
      n.gauges.shells > 0;
    if (!presses) return null;
    o.press = s.chapter + 1;
    return plan(o.theatre, true);
  }
  if (NO_GREAT.includes(n.tag) || !offensiveFront(gw, n.tag, main)) {
    return null;
  }
  if (s.chapter - n.spent < AI_REST[n.ai]) return null;
  if (n.gauges.shells < 2 || n.gauges.morale < 2 || n.manpower < 12) {
    return null;
  }
  const end = memberEnd(gw, main, n.tag)!;
  const foe = membersOf(gw, main, other(end))[0];
  const believed =
    foe === undefined ? null : believedStrain(gw, n.tag, main, foe);
  const methods = methodsFor(gw, n.tag, main).filter((m) => m.open);
  const method = methods[methods.length - 1].method;
  const floor = BOLD_AI.includes(n.ai) ? AI_ODDS_BOLD : AI_ODDS;
  const onTheDay =
    pressOdds(gw, main, end) +
    Math.floor((WEIGHT_MAX * WEIGHT_WORTH) / 100) +
    METHOD[method];
  if ((believed ?? 0) < AI_STRAIN && onTheDay < floor) return null;
  const roll = wwRoll(s.seed, P_AI_PREP, s.chapter, s.nations.indexOf(n)) % 100;
  if (roll >= AI_PREP_PCT) return null;
  const months = n.ai === "hardline" ? 1 : n.ai === "cautious" ? 3 : 1;
  const feints = feintFronts(gw, n.tag, main);
  const feint =
    n.ai === "opportunist" && n.gauges.money >= 2 && feints.length > 0
      ? feints[0]
      : null;
  prepare(gw, n.tag, main, method, months, n.ai === "cautious", feint);
  return plan(main, false);
}

// ---- What the seat sees of its own ----

export function prepView(
  gw: GreatWar,
  tag: GwTag,
  t: GwTheatre,
): GwFrontPrepView | null {
  const o = ownOffensive(gw, tag);
  if (o === null || o.theatre !== t) return null;
  return {
    method: o.method,
    round: o.round,
    month: o.prepared + 1,
    ready: isReady(o),
  };
}
