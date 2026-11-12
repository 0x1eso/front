// ww190 §1, §6: the peace years. Arms are read off the budget (no state of
// their own), bonds tie allies (s.bonds), accords bind rivals (s.accords).
// A neutral great power's seat is courted, and may mediate in a war it sits
// out. All of it is absent from the state until first used.
import {
  GW_TOPICS,
  GwAccord,
  GwAccordKind,
  GwNationState,
  GwSeatState,
  GwSide,
  GwTopic,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { budgetRow } from "@openfront/engine-lib/ww1914/BudgetRules";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { playingOn } from "./Aftermath";
import { sparkSooner } from "./Crises";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { armistice, judgesTalks, sideLead } from "./Peace";
import { sceneOf } from "./SceneRun";
import { GW_START_TREATIES } from "./Tables";
import { GW_GREAT } from "./Wars";
import {
  clampTo,
  isLongChapter,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

export type GwYearsCond = Extract<
  GwWorldCond,
  {
    is:
      | "arming"
      | "arms_race"
      | "bond"
      | "accord"
      | "accord_offered"
      | "courted"
      | "mediating";
  }
>;
export type GwYearsEffect = Extract<
  GwWorldEffect,
  {
    do:
      | "arms"
      | "bond"
      | "accord"
      | "accord_answer"
      | "break_accord"
      | "mediate";
  }
>;

const P_ARMS = idHash("gw_y_arms");
const P_BREAK = idHash("gw_y_break");
const P_COURT = idHash("gw_y_court");

/** Rivals in arms, and the line they race on. */
export const GW_ARMS_RIVALS: readonly (readonly [
  GwTag,
  GwTag,
  "army" | "navy",
])[] = [
  ["DEU", "GBR", "navy"],
  ["DEU", "FRA", "army"],
  ["DEU", "RUS", "army"],
  ["AUH", "RUS", "army"],
  ["AUH", "ITA", "navy"],
];

/** Points of army and navy share above June 1914 for one step of arms. */
export const GW_ARMS_STEP = 5;
const ARMS_MAX = 3;
const BOND_MAX = 3;
/** Months between two steps of a bond's drift. */
const BOND_DRIFT_MONTHS = 6;
/** The heat at which a hardline government tears up an accord. */
const BREAK_AT = 7;
/** Chapters after a break before the same two talk of it again. */
const REOFFER_AFTER = 12;
/** Chapters a seat has to answer an accord before the silence is a no. */
const ANSWER_WAIT = 2;
/** Months between two offers to mediate. */
const MEDIATE_EVERY = 6;
/** Scheduled to a seat offered an accord (common pack). */
export const GW_ACCORD_OFFER_SCENE = "gw_y_accord_offer";
/** Seat flag: an offer to mediate is out. */
export const GW_MEDIATING = "gw_mediating";
/** Seat flag: it went out this chapter; the answer comes as the next closes. */
const MEDIATION_SENT = "gw_mediating_sent";
/** The most a side offers a great power that sits out. */
const COURT_MAX = 5;
/** A side this far behind bids harder. */
const LOSING_SCORE = 15;

const TOPIC_OF: Readonly<Record<GwAccordKind, GwTopic>> = {
  naval: "naval",
  colonial: "colonial",
  balkan: "balkan",
  straits: "straits",
};

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

// ---- Arms ----

/**
 * How far `tag` arms past its June 1914 budget, 0..3: a step for every five
 * points its running army and navy shares stand above that row. A country
 * mobilised counts as fully armed.
 */
export function armsLevel(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null) return 0;
  if (n.mob >= 1) return ARMS_MAX;
  const peace = budgetRow(tag).peace;
  const now = n.budget.plan.shares;
  const over =
    (now[0] ?? 0) + (now[1] ?? 0) - (peace[0] ?? 0) - (peace[1] ?? 0);
  return clampTo(Math.floor(over / GW_ARMS_STEP), 0, ARMS_MAX);
}

const rivals = (a: GwTag, b: GwTag) =>
  GW_ARMS_RIVALS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** `a` and `b` race each other, both arming. */
export function armsRace(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  return rivals(a, b) && armsLevel(gw, a) >= 1 && armsLevel(gw, b) >= 1;
}

/** The shares a rise is taken from and a cut given back to: relief, works, national. */
const SPARE = [2, 3, 4] as const;

/** `delta` points to a line of `shares`, the fattest spare line paying. */
function tiltShares(shares: number[], line: 0 | 1, delta: number): void {
  for (let k = 0; k < Math.abs(delta); k++) {
    if (delta > 0) {
      const from = [...SPARE].sort(
        (x, y) => (shares[y] ?? 0) - (shares[x] ?? 0) || x - y,
      )[0];
      if ((shares[from] ?? 0) <= 0) return;
      shares[from]--;
      shares[line]++;
    } else {
      if ((shares[line] ?? 0) <= 0) return;
      shares[line]--;
      shares[SPARE[k % SPARE.length]]++;
    }
  }
}

/**
 * The running plan (and a draft on the table) gives `line` `delta` points,
 * out of relief, works and the national debt. A navy that grows breaks a
 * naval accord.
 */
export function raiseArms(
  gw: GreatWar,
  tag: GwTag,
  line: "army" | "navy",
  delta: number,
): void {
  const n = gw.nation(tag);
  if (n === null || delta === 0) return;
  const i = line === "army" ? 0 : 1;
  tiltShares(n.budget.plan.shares, i, delta);
  if (n.budget.draft !== null) tiltShares(n.budget.draft.shares, i, delta);
  if (delta < 0) return;
  news(gw, "arms_raised", tag);
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "arms_raised");
  if (line === "navy" && accordsOf(gw, tag).some(inForce("naval"))) {
    breakAccord(gw, tag, "naval");
  }
}

// ---- Bonds ----

const pairKey = (a: GwTag, b: GwTag) => (a < b ? `${a}_${b}` : `${b}_${a}`);

let pairs: readonly string[] | null = null;
/** The pairs with a bond: June 1914's treaties, the Entente, London and Petersburg. */
export function bondPairs(): readonly string[] {
  if (pairs !== null) return pairs;
  const all = new Set<string>(["FRA_GBR", "GBR_RUS"]);
  for (const t of GW_START_TREATIES) all.add(pairKey(t.by, t.for));
  pairs = [...all].sort();
  return pairs;
}

/** The bond between two countries, -3..3; null if the pair has none. */
export function bondOf(gw: GreatWar, a: GwTag, b: GwTag): number | null {
  const key = pairKey(a, b);
  if (!bondPairs().includes(key)) return null;
  return gw.s.bonds?.[key] ?? 0;
}

export function moveBond(gw: GreatWar, a: GwTag, b: GwTag, d: number): void {
  const was = bondOf(gw, a, b);
  if (was === null || d === 0) return;
  const now = clampTo(was + d, -BOND_MAX, BOND_MAX);
  if (now === was) return;
  (gw.s.bonds ??= {})[pairKey(a, b)] = now;
}

/** The countries `tag` has a bond with. */
export function bondPartners(tag: GwTag): GwTag[] {
  const out: GwTag[] = [];
  for (const key of bondPairs()) {
    const [a, b] = key.split("_") as [GwTag, GwTag];
    if (a === tag) out.push(b);
    else if (b === tag) out.push(a);
  }
  return out;
}

// ---- Accords ----

const isOffered = (x: GwAccord) => x.offered === true;
const inForce = (kind?: GwAccordKind) => (x: GwAccord) =>
  x.offered !== true && x.broken === null && (kind ?? x.kind) === x.kind;
const between = (x: GwAccord, a: GwTag, b?: GwTag) =>
  (x.a === a && (b === undefined || x.b === b)) ||
  (x.b === a && (b === undefined || x.a === b));

/** The accords `tag` made: in force or broken, not those only offered. */
export function accordsOf(gw: GreatWar, tag: GwTag): readonly GwAccord[] {
  return (gw.s.accords ?? []).filter((x) => !isOffered(x) && between(x, tag));
}

/**
 * `from` offers `to` an accord. A government nobody plays answers as the
 * chapter closes; a seat's country by its card (`gw_y_accord_offer`).
 */
export function offerAccord(
  gw: GreatWar,
  from: GwTag,
  kind: GwAccordKind,
  to: GwTag,
): void {
  const s = gw.s;
  if (from === to || gw.nation(from) === null || gw.nation(to) === null) return;
  const open = (s.accords ?? []).some(
    (x) =>
      x.kind === kind &&
      between(x, from, to) &&
      (x.broken === null || s.chapter - x.broken < REOFFER_AFTER),
  );
  if (open) return;
  (s.accords ??= []).push({
    kind,
    a: from,
    b: to,
    chapter: s.chapter,
    broken: null,
    offered: true,
  });
  news(gw, "accord_offered", from, to);
  for (const seat of seatsOf(gw, from)) reason(gw, seat, "accord_offered");
  if (sceneOf(GW_ACCORD_OFFER_SCENE) === null) return;
  for (const seat of seatsOf(gw, to)) {
    seat.scheduled.push({
      scene: GW_ACCORD_OFFER_SCENE,
      chapter: s.chapter + 1,
    });
  }
}

function settle(gw: GreatWar, x: GwAccord, yes: boolean): void {
  const s = gw.s;
  delete x.offered;
  if (yes) {
    x.chapter = s.chapter;
    news(gw, "accord_made", x.a, x.b);
    for (const tag of [x.a, x.b]) {
      for (const seat of seatsOf(gw, tag)) reason(gw, seat, "accord_made");
    }
    return;
  }
  s.accords = (s.accords ?? []).filter((y) => y !== x);
  news(gw, "accord_refused", x.a, x.b);
  for (const seat of seatsOf(gw, x.a)) reason(gw, seat, "accord_refused");
}

/** The seat's answer to the newest accord offered to its country. */
export function answerAccord(
  gw: GreatWar,
  seat: GwSeatState,
  yes: boolean,
): void {
  const open = (gw.s.accords ?? []).filter(
    (x) => isOffered(x) && x.b === seat.tag,
  );
  const x = open[open.length - 1];
  if (x !== undefined) settle(gw, x, yes);
}

/**
 * `tag` ends an accord in force (of `kind`, with `other` if named): its
 * question heats (+3), the world a step, each loses trust in the other
 * (−2), and a spark on that question comes a chapter sooner.
 */
export function breakAccord(
  gw: GreatWar,
  tag: GwTag,
  kind: GwAccordKind,
  other?: GwTag,
): void {
  const s = gw.s;
  const x = (s.accords ?? []).find(
    (y) => inForce(kind)(y) && between(y, tag, other),
  );
  if (x === undefined) return;
  x.broken = s.chapter;
  const them = x.a === tag ? x.b : x.a;
  const topic = TOPIC_OF[kind];
  s.pressure[topic] += 3;
  s.temp = clampTo(s.temp + 1, 0, 10);
  for (const [p, q] of [
    [tag, them],
    [them, tag],
  ] as const) {
    const n = gw.nation(p);
    if (n !== null) n.trust[q] = clampTo((n.trust[q] ?? 0) - 2, -3, 3);
  }
  sparkSooner(gw, topic);
  news(gw, "accord_broken", tag, them);
  for (const t of [tag, them]) {
    for (const seat of seatsOf(gw, t)) reason(gw, seat, "accord_broken");
  }
}

// ---- The neutral great power (§6) ----

/** A great power a seat holds, sitting out the great war or out by its own peace. */
function courtable(gw: GreatWar, n: GwNationState): boolean {
  if (gw.s.warChapter === null || gw.s.armistice !== null) return false;
  if (!GW_GREAT.includes(n.tag) || !ruledBySeat(gw, n.tag)) return false;
  if (n.side === null && !n.out) return true;
  return seatsOf(gw, n.tag).some(playingOn);
}

/**
 * The sides with no seat among them bid for a great power that sits out: a
 * step at 18% a chapter, 30% for a side that is losing, up to 5.
 */
export function courtSeats(gw: GreatWar): void {
  const s = gw.s;
  const score = warScore(gw, "central");
  const losing: GwSide | null =
    score <= -LOSING_SCORE
      ? "central"
      : score >= LOSING_SCORE
        ? "entente"
        : null;
  for (const n of s.nations) {
    if (!courtable(gw, n)) continue;
    for (const side of ["central", "entente"] as const) {
      const seated = s.seats.some(
        (x) => x.memoir === null && gw.nation(x.tag)?.side === side,
      );
      const held = n.offers[side] ?? 0;
      if (seated || held >= COURT_MAX) continue;
      const odds = side === losing ? 30 : 18;
      const r = wwRoll(s.seed, P_COURT, s.chapter, idHash(n.tag), idHash(side));
      if (r % 100 < odds) n.offers[side] = held + 1;
    }
  }
}

/** The last answer to the seat's mediation, by chapter; null none. */
function lastMediation(gw: GreatWar, tag: GwTag): number | null {
  let last: number | null = null;
  for (const x of gw.s.news) {
    if (x.a === tag && x.key.startsWith("mediation_")) last = x.chapter;
  }
  return last;
}

/** The seat offers to mediate: answered as the next chapter closes. */
export function mediate(gw: GreatWar, seat: GwSeatState): void {
  const s = gw.s;
  if (s.warChapter === null || s.armistice !== null) return;
  const n = gw.nation(seat.tag);
  if (n === null || n.side !== null) return;
  if (seat.flags.includes(GW_MEDIATING)) return;
  const last = lastMediation(gw, seat.tag);
  if (last !== null && monthsBetween(gw, last, s.chapter) < MEDIATE_EVERY) {
    return;
  }
  seat.flags.push(GW_MEDIATING, MEDIATION_SENT);
}

/** Each side's lead judges the offer as it would talks of peace. */
function answerMediation(gw: GreatWar, seat: GwSeatState): void {
  seat.flags = seat.flags.filter((f) => f !== GW_MEDIATING);
  const leads = (["central", "entente"] as const).map((side) =>
    sideLead(gw, side),
  );
  const yes = leads.filter(
    (n): n is GwNationState => n !== null && judgesTalks(gw, n),
  );
  if (yes.length === 2) {
    news(gw, "mediation_peace", seat.tag);
    reason(gw, seat, "mediation_peace");
    armistice(gw, "compromise", null);
    return;
  }
  if (yes.length === 1) {
    const n = yes[0];
    n.trust[seat.tag] = clampTo((n.trust[seat.tag] ?? 0) + 1, -3, 3);
    news(gw, "mediation_half", seat.tag, n.tag);
    reason(gw, seat, "mediation_half");
    return;
  }
  news(gw, "mediation_refused", seat.tag);
  reason(gw, seat, "mediation_refused");
}

function mediationStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    if (seat.memoir !== null || !seat.flags.includes(GW_MEDIATING)) continue;
    if (seat.flags.includes(MEDIATION_SENT)) {
      seat.flags = seat.flags.filter((f) => f !== MEDIATION_SENT);
      continue;
    }
    if (gw.s.armistice !== null || gw.s.warChapter === null) {
      seat.flags = seat.flags.filter((f) => f !== GW_MEDIATING);
      continue;
    }
    answerMediation(gw, seat);
  }
}

// ---- The DSL ----

export function yearsHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwYearsCond,
): boolean {
  const s = gw.s;
  const tag = seat.tag;
  switch (c.is) {
    case "arming":
      return inRange(armsLevel(gw, c.tag ?? tag), c);
    case "arms_race":
      return armsRace(gw, tag, c.tag);
    case "bond": {
      const b = bondOf(gw, tag, c.tag);
      return b !== null && inRange(b, c);
    }
    case "accord":
      return accordsOf(gw, tag).some(
        (x) =>
          (c.kind === undefined || x.kind === c.kind) &&
          (c.tag === undefined || between(x, tag, c.tag)) &&
          (c.broken === undefined || (x.broken !== null) === c.broken),
      );
    case "accord_offered":
      return (s.accords ?? []).some(
        (x) =>
          isOffered(x) &&
          x.b === tag &&
          (c.kind === undefined || x.kind === c.kind) &&
          (c.tag === undefined || x.a === c.tag),
      );
    case "courted": {
      const n = gw.nation(tag);
      if (n === null || !courtable(gw, n)) return false;
      const v =
        c.side === undefined
          ? Math.max(n.offers.central ?? 0, n.offers.entente ?? 0)
          : (n.offers[c.side] ?? 0);
      return inRange(v, c);
    }
    case "mediating":
      return seat.flags.includes(GW_MEDIATING);
  }
}

export function yearsDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: GwYearsEffect,
): void {
  switch (e.do) {
    case "arms":
      raiseArms(gw, seat.tag, e.line, e.delta);
      return;
    case "bond":
      moveBond(gw, seat.tag, e.tag, e.delta);
      return;
    case "accord":
      offerAccord(gw, seat.tag, e.kind, e.tag);
      return;
    case "accord_answer":
      answerAccord(gw, seat, e.yes);
      return;
    case "break_accord":
      breakAccord(gw, seat.tag, e.kind, e.tag);
      return;
    case "mediate":
      mediate(gw, seat);
      return;
  }
}

// ---- The step ----

/** Whole months between two chapters, by their dates. */
function monthsBetween(gw: GreatWar, from: number, to: number): number {
  const rows = gwChapters(gw.s.calendar);
  const at = (i: number) => rows[clampTo(i, 0, rows.length - 1)].day;
  return Math.floor((at(to) - at(from)) / 30);
}

/** A count of `k` months from the game's first chapter falls in this one. */
function monthBeat(gw: GreatWar, k: number): boolean {
  const rows = gwChapters(gw.s.calendar);
  const row = rows[gw.s.chapter];
  const end = row.day - rows[0].day;
  const start = end - row.spanDays;
  const beats = (days: number) => Math.floor(days / 30 / k);
  return end > 0 && beats(end) > beats(start);
}

const roll = (gw: GreatWar, salt: number, a: number, b: number) =>
  wwRoll(gw.s.seed, salt, gw.s.chapter, a, b);

/**
 * A government nobody plays, a step behind its rival, catches up by its
 * character: hardline always, opportunist one time in two, principled one in
 * three, cautious only two steps behind. Never past a naval accord.
 */
function aiArms(gw: GreatWar): void {
  for (const [a, b, line] of GW_ARMS_RIVALS) {
    for (const [me, them] of [
      [a, b],
      [b, a],
    ] as const) {
      const n = gw.nation(me);
      if (n === null || n.out || gw.nation(them) === null) continue;
      if (ruledBySeat(gw, me)) continue;
      const mine = armsLevel(gw, me);
      const gap = armsLevel(gw, them) - mine;
      if (gap <= 0 || mine >= ARMS_MAX) continue;
      if (line === "navy" && accordsOf(gw, me).some(inForce("naval"))) {
        continue;
      }
      const r = roll(gw, P_ARMS, idHash(me), idHash(them));
      const goes =
        n.ai === "hardline" ||
        (n.ai === "opportunist" && r % 2 === 0) ||
        (n.ai === "principled" && r % 3 === 0) ||
        (n.ai === "cautious" && gap >= 2);
      if (goes) raiseArms(gw, me, line, GW_ARMS_STEP);
    }
  }
}

/** Bonds drift a step every six months towards the sign of the pair's trust. */
function driftBonds(gw: GreatWar): void {
  if (!monthBeat(gw, BOND_DRIFT_MONTHS)) return;
  for (const key of bondPairs()) {
    const [a, b] = key.split("_") as [GwTag, GwTag];
    const na = gw.nation(a);
    const nb = gw.nation(b);
    if (na === null || nb === null) continue;
    const want = Math.sign((na.trust[b] ?? 0) + (nb.trust[a] ?? 0));
    const now = bondOf(gw, a, b) ?? 0;
    if (now !== want) moveBond(gw, a, b, now < want ? 1 : -1);
  }
}

/**
 * A ladder that reached mobilisation or war this chapter: a partner that
 * mobilised with its friend, or went to war with it, is closer; one that
 * stood aside as it went to war is further.
 */
function laddersMoveBonds(gw: GreatWar): void {
  const s = gw.s;
  for (const l of s.ladders) {
    if (l.chapter !== s.chapter) continue;
    if (l.step !== "mobilised" && l.step !== "war") continue;
    for (const [me, foe] of [
      [l.from, l.to],
      [l.to, l.from],
    ] as const) {
      for (const p of bondPartners(me)) {
        const n = gw.nation(p);
        if (p === foe || n === null || n.out) continue;
        if (l.step === "war")
          moveBond(gw, me, p, n.atWar.includes(foe) ? 1 : -1);
        else if (n.mob >= 1) moveBond(gw, me, p, 1);
      }
    }
  }
}

/**
 * Accords offered: a government nobody plays says yes if it is behind in
 * arms or cautious; a seat that says nothing in two chapters has said no.
 */
function answerAccords(gw: GreatWar): void {
  const s = gw.s;
  for (const x of [...(s.accords ?? [])]) {
    if (!isOffered(x)) continue;
    const n = gw.nation(x.b);
    if (n !== null && !n.out && ruledBySeat(gw, x.b)) {
      if (s.chapter - x.chapter > ANSWER_WAIT) settle(gw, x, false);
      continue;
    }
    const behind = armsLevel(gw, x.b) < armsLevel(gw, x.a);
    settle(gw, x, n !== null && !n.out && (behind || n.ai === "cautious"));
  }
}

/** An accord in force cools its question a step every long chapter. */
function accordsCool(gw: GreatWar): void {
  const s = gw.s;
  const cooled = new Set<GwTopic>();
  for (const x of s.accords ?? []) {
    if (inForce()(x)) cooled.add(TOPIC_OF[x.kind]);
  }
  for (const t of GW_TOPICS) {
    if (cooled.has(t)) s.pressure[t] = Math.max(0, s.pressure[t] - 1);
  }
}

/** A hardline government nobody plays tears one up when the world runs hot. */
function aiBreaks(gw: GreatWar): void {
  if (gw.s.temp < BREAK_AT) return;
  for (const x of [...(gw.s.accords ?? [])]) {
    if (!inForce()(x)) continue;
    for (const tag of [x.a, x.b]) {
      const n = gw.nation(tag);
      if (n === null || n.ai !== "hardline" || ruledBySeat(gw, tag)) continue;
      if (roll(gw, P_BREAK, idHash(tag), idHash(x.kind)) % 12 !== 0) continue;
      breakAccord(gw, tag, x.kind, tag === x.a ? x.b : x.a);
      break;
    }
  }
}

/** A principled or cautious Britain nobody plays offers Germany a naval holiday. */
function aiOffers(gw: GreatWar): void {
  const gbr = gw.nation("GBR");
  if (gbr === null || gbr.out || ruledBySeat(gw, "GBR")) return;
  if (gbr.ai !== "principled" && gbr.ai !== "cautious") return;
  // ww190 tune: was naval 5 and Germany two steps up; it seldom came at all.
  if (gw.s.pressure.naval < 4 || armsLevel(gw, "DEU") < 1) return;
  offerAccord(gw, "GBR", "naval", "DEU");
}

/**
 * Chapter step, after the AI. Answers first (offers made last chapter or by
 * a seat this one), then in the great war the courting of a great power that
 * sits out, and in peace the arms, bonds and accords of the governments
 * nobody plays.
 */
export function peaceYearsStep(gw: GreatWar): void {
  const s = gw.s;
  answerAccords(gw);
  mediationStep(gw);
  if (s.armistice !== null) return;
  if (s.warChapter !== null) {
    courtSeats(gw);
    return;
  }
  laddersMoveBonds(gw);
  driftBonds(gw);
  aiBreaks(gw);
  if (!isLongChapter(gw)) return;
  accordsCool(gw);
  aiArms(gw);
  aiOffers(gw);
}
