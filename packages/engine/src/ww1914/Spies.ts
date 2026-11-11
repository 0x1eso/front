// Great War 1914, ww173 (design ww173 §6): the secret war. Each country's
// service (`GwNationState.intel`) reads codes, spots the enemy's preparation,
// keeps agents abroad and catches the foreigners at home. Everything here is
// hidden: a seat learns only through its reports (Intel.learn), and the AI
// through `intel.heard`, by the same rules. Every roll has its own purpose.
import {
  GW_FIELDS,
  GW_SIDES,
  GW_THEATRES,
  GwIntel,
  GwSeatState,
  GwSide,
  GwSource,
  GwStamp,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES, GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwSpyAct, GwSpyCan } from "@openfront/engine-api/ww1914/GwSpies";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { learn, sendReport } from "./Intel";
import {
  loudnessOf,
  markSeen,
  offensivesOf,
  seenBy,
  type GwOffensiveView,
} from "./Offensives";
import { firstRegime } from "./Regimes";
import { addStrain } from "./Strain";
import { atWarWith, memberEnd, membersOf, warOf } from "./Wars";
import {
  clampTo,
  defOf,
  fights,
  monthsFrom,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_CRYPT = idHash("gw_crypt");
const P_SUSPECT = idHash("gw_suspect");
const P_SPOT = idHash("gw_spot");
const P_ALARM = idHash("gw_alarm");
const P_CATCH = idHash("gw_catch");
const P_OP = idHash("gw_spy_op");
const P_OP_OUT = idHash("gw_spy_out");
const P_AI = idHash("gw_spy_ai");
const P_TURN = idHash("gw_spy_turn");
const P_COUNTER = idHash("gw_spy_counter");
const P_EVENT = idHash("gw_spy_event");

/** Countries with a service of their own: they read, spot and send agents. */
export const GW_SPY_POWERS: readonly GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
];
/** Neutrals worth a net and a courting. */
const COURTED: readonly GwTag[] = ["USA", "ITA", "ROU", "BGR", "GRC", "OTT"];

/** Design §6 start values: Room 40 grows by state, Russia speaks in plain. */
const CRYPT_START: Partial<Record<GwTag, number>> = { FRA: 2, AUH: 2 };
const SECURE_START: Partial<Record<GwTag, number>> = { RUS: 0 };
/** Days count from 1970: 1914 is far below zero. */
const NEVER = -1_000_000;
const YEAR = 365;
const HALF_YEAR = 182;
/** Days before blaming the spies costs the service and the house. */
const BLAME_LATER = 60;
/** Chapters a caught agent waits for the seat's word before he is shown. */
const CAUGHT_WAIT = 2;
const OPS_KEPT = 6;
/**
 * Counter-intelligence, per mille a chapter for each foreign net (ww173
 * tune: the design's percent caught about twenty agents a game; one to
 * three is the aim): a base, each point of counter, less each point of net.
 */
const CATCH_BASE = 2;
const CATCH_COUNTER = 6;
const CATCH_NET = 2;
/** An operation's chance to be found out rises this much a point of counter. */
const OUT_COUNTER = 3;
/** Nets abroad an AI service keeps at most: good men are few. */
const AI_NETS = 2;
/** Percent a chapter an AI service tries a new net (bold, others). */
const AI_NET_PCT_BOLD = 6;
const AI_NET_PCT = 4;
/** Percent an AI service is funded more after it catches agents. */
const AI_FUND_PCT = 25;

/** A country's service, filled with the start values on first use. */
export function intelOf(gw: GreatWar, tag: GwTag): GwIntel {
  const n = gw.nation(tag)!;
  n.intel ??= {
    crypt: CRYPT_START[tag] ?? 1,
    secure: SECURE_START[tag] ?? 1,
    counter: 1,
    net: {},
    reads: [],
    suspect: {},
    turned: [],
    heard: [],
    readOn: [],
    raided: {},
    caught: [],
    ops: [],
    subverted: NEVER,
    sabotaged: NEVER,
    marks: [],
    later: [],
  };
  return n.intel;
}

/** The report's word for a front end's strain, 0 (holds) .. 4 (near breaking). */
export function strainWord(strain: number): number {
  return clampTo(Math.floor(strain / 20), 0, 4);
}

/** The head of the service: the office's holder, or null. */
function chiefOf(gw: GreatWar, tag: GwTag) {
  return (
    gw.s.people.find(
      (p) =>
        p.office === "intelligence" &&
        p.status === "active" &&
        defOf(p.id)?.tag === tag,
    ) ?? null
  );
}

/** Design §6: war or politics competence adds 5 a point above 2. */
export function skillOf(gw: GreatWar, tag: GwTag): number {
  const p = chiefOf(gw, tag);
  if (p === null) return 0;
  const war = p.competence[GW_FIELDS.indexOf("war")] ?? 2;
  const pol = p.competence[GW_FIELDS.indexOf("politics")] ?? 2;
  const temper =
    p.temperament === "cunning" ? 5 : p.temperament === "arrogant" ? -5 : 0;
  return 5 * Math.max(0, Math.max(war, pol) - 2) + temper;
}

const idx = (gw: GreatWar, tag: GwTag) =>
  gw.s.nations.findIndex((n) => n.tag === tag);
const roll = (gw: GreatWar, p: number, ...k: number[]) =>
  wwRoll(gw.s.seed, p, gw.s.chapter, ...k) % 100;

/** The end of `t` each fights on, when they face each other there. */
function facing(gw: GreatWar, t: GwTheatre, a: GwTag, b: GwTag): boolean {
  const th = gw.s.theatres.find((x) => x.id === t);
  if (th === undefined || !th.open) return false;
  const ea = memberEnd(gw, t, a);
  const eb = memberEnd(gw, t, b);
  return ea !== null && eb !== null && ea !== eb;
}

function sharedFronts(gw: GreatWar, a: GwTag, b: GwTag): GwTheatre[] {
  return GW_THEATRES.filter((t) => facing(gw, t, a, b));
}

/** The lead of the end `tag` faces on `t`, or null. */
export function foeOn(gw: GreatWar, t: GwTheatre, tag: GwTag): GwTag | null {
  const end = memberEnd(gw, t, tag);
  if (end === null) return null;
  const other: GwSide = end === GW_SIDES[0] ? GW_SIDES[1] : GW_SIDES[0];
  return membersOf(gw, t, other)[0] ?? null;
}

const seatOf = (gw: GreatWar, tag: GwTag): GwSeatState | undefined =>
  seatsOf(gw, tag)[0];

// ---- What a country holds (the seat's reports, the AI's lines) ----

interface Held {
  claim: number;
  stamp: GwStamp | null;
  chapter: number;
}

/** The newest strain or prep word `viewer` holds of `of` at `theatre`. */
function heldOf(
  gw: GreatWar,
  viewer: GwTag,
  fact: "prep" | "strain",
  theatre: GwTheatre,
  of: GwTag,
): Held | null {
  const seat = seatOf(gw, viewer);
  if (seat !== undefined) {
    for (let i = gw.s.reports.length - 1; i >= 0; i--) {
      const r = gw.s.reports[i];
      if (r.smallID !== seat.smallID || r.fact !== fact) continue;
      if (r.tag !== of || r.theatre !== theatre) continue;
      // Checked: the seat knows what was so.
      const checked = r.stamp === "unconfirmed" && r.checkDay === null;
      return {
        claim: checked ? r.truth : r.claim,
        stamp: r.stamp,
        chapter: r.chapter,
      };
    }
    return null;
  }
  const heard = gw.nation(viewer)?.intel?.heard ?? [];
  for (let i = heard.length - 1; i >= 0; i--) {
    const h = heard[i];
    if (h.fact === fact && h.tag === of && h.theatre === theatre) {
      return { claim: h.claim, stamp: null, chapter: h.chapter };
    }
  }
  return null;
}

/**
 * The latest strain report the viewer holds, 0..100 in its word's steps
 * (0, 25, 50, 75, 100), or null if none. The AI and the front card use it.
 */
export function believedStrain(
  gw: GreatWar,
  viewer: GwTag,
  theatre: GwTheatre,
  of: GwTag,
): number | null {
  const h = heldOf(gw, viewer, "strain", theatre, of);
  return h === null ? null : h.claim * 25;
}

/** The seat's newest word on the foe's strain, with its stamp, for the card. */
export function foeRead(
  gw: GreatWar,
  seat: GwSeatState,
  theatre: GwTheatre,
  of: GwTag,
): { word: number; stamp: GwStamp } | null {
  const h = heldOf(gw, seat.tag, "strain", theatre, of);
  return h === null || h.stamp === null
    ? null
    : { word: h.claim, stamp: h.stamp };
}

/** Whether `viewer` believes `of` is preparing on `theatre` (last 2 chapters). */
export function believedPrep(
  gw: GreatWar,
  viewer: GwTag,
  theatre: GwTheatre,
  of: GwTag,
): boolean {
  const h = heldOf(gw, viewer, "prep", theatre, of);
  return h !== null && h.claim === 1 && gw.s.chapter - h.chapter <= 2;
}

/** Whether `viewer` reads `of`'s codes now. */
export function reads(gw: GreatWar, viewer: GwTag, of: GwTag): boolean {
  return gw.nation(viewer)?.intel?.reads.includes(of) === true;
}

// ---- Codes (Room 40's dilemma) ----

function codesStep(gw: GreatWar, a: GwTag, foes: GwTag[]): void {
  const ia = intelOf(gw, a);
  for (const f of foes) {
    const iF = intelOf(gw, f);
    if (ia.crypt <= iF.secure) {
      ia.reads = ia.reads.filter((x) => x !== f);
      continue;
    }
    if (!ia.reads.includes(f)) {
      const pct = 25 + 15 * (ia.crypt - iF.secure) + skillOf(gw, a);
      if (roll(gw, P_CRYPT, idx(gw, a), idx(gw, f)) >= pct) continue;
      ia.reads.push(f);
      const seat = seatOf(gw, a);
      if (seat !== undefined) reason(gw, seat, "spy_code_read");
    }
    for (const t of sharedFronts(gw, a, f)) {
      learn(gw, a, "strain", f, t, "codes", "confirmed");
      for (const o of preparing(gw, f, t)) {
        learn(gw, a, "prep", f, t, "codes", "confirmed");
        // Read in his codes: the counterplay offers "모르는 척한다".
        markSeen(gw, o, a, true);
        ia.readOn.push({ tag: f, theatre: t, chapter: gw.s.chapter });
      }
    }
  }
}

function preparing(gw: GreatWar, tag: GwTag, t: GwTheatre): GwOffensiveView[] {
  return offensivesOf(gw).filter(
    (o) => o.tag === tag && o.theatre === t && o.launch === null,
  );
}

/**
 * Acting on a read: the chapter after a code read named a front, the main
 * effort signed there tells the enemy. Then his roll to change his codes.
 */
function suspicionStep(gw: GreatWar, a: GwTag): void {
  const ia = intelOf(gw, a);
  const main = allocOf(gw, a)?.main ?? null;
  const last = gw.s.chapter - 1;
  for (const e of ia.readOn) {
    if (e.chapter !== last || e.theatre !== main) continue;
    actedOnRead(gw, a, e.tag);
  }
  ia.readOn = ia.readOn.filter((e) => e.chapter >= gw.s.chapter);
}

/** `reader` acted on what it read in `of`'s codes: `of` suspects it more. */
export function actedOnRead(gw: GreatWar, reader: GwTag, of: GwTag): void {
  const iF = intelOf(gw, of);
  iF.suspect[reader] = (iF.suspect[reader] ?? 0) + 1;
}

function codeChangeStep(gw: GreatWar, f: GwTag): void {
  const iF = gw.nation(f)?.intel;
  if (iF === undefined) return;
  const most = Math.max(0, ...Object.values(iF.suspect));
  if (most === 0) return;
  if (roll(gw, P_SUSPECT, idx(gw, f)) >= 15 * most) return;
  iF.secure = Math.min(3, iF.secure + 1);
  iF.suspect = {};
  for (const n of gw.s.nations) {
    if (n.intel === undefined || !n.intel.reads.includes(f)) continue;
    n.intel.reads = n.intel.reads.filter((x) => x !== f);
    const seat = seatOf(gw, n.tag);
    if (seat !== undefined) reason(gw, seat, "spy_code_lost");
  }
  news(gw, "spy_codes_changed", f);
}

// ---- Seeing preparation ----

function spotStep(gw: GreatWar): void {
  for (const o of offensivesOf(gw)) {
    if (o.launch !== null) continue;
    for (const a of GW_SPY_POWERS) {
      if (a === o.tag || !facing(gw, o.theatre, a, o.tag)) continue;
      if (reads(gw, a, o.tag) || seenBy(gw, o).includes(a)) continue;
      const ia = intelOf(gw, a);
      const net = ia.net[o.tag] ?? 0;
      const raided = (ia.raided[o.theatre] ?? NEVER) >= gw.s.chapter - 1;
      const pct = clampTo(
        loudnessOf(gw, o) +
          15 * net +
          (raided ? 10 : 0) -
          10 * intelOf(gw, o.tag).secure +
          skillOf(gw, a),
        5,
        95,
      );
      const t = GW_THEATRES.indexOf(o.theatre);
      if (roll(gw, P_SPOT, idx(gw, a), idx(gw, o.tag), t) >= pct) continue;
      const source: GwSource =
        net > 0 ? "agents" : raided ? "prisoners" : "attache";
      if (learn(gw, a, "prep", o.tag, o.theatre, source) === 1) {
        markSeen(gw, o, a);
      }
    }
  }
}

/** An anxious service hears of offensives that aren't there more often. */
function alarmStep(gw: GreatWar, a: GwTag, foes: GwTag[]): void {
  const anxious = chiefOf(gw, a)?.temperament === "anxious";
  for (const f of foes) {
    for (const t of sharedFronts(gw, a, f)) {
      if (preparing(gw, f, t).length > 0) continue;
      const k = GW_THEATRES.indexOf(t);
      if (roll(gw, P_ALARM, idx(gw, a), idx(gw, f), k) >= (anxious ? 30 : 15))
        continue;
      learn(gw, a, "prep", f, t, "attache", undefined, true);
    }
  }
}

/** A net's reports: the foe's strain on our main front, a neutral's lean. */
function netStep(gw: GreatWar, a: GwTag): void {
  const ia = intelOf(gw, a);
  const seat = seatOf(gw, a);
  for (const x of Object.keys(ia.net) as GwTag[]) {
    if ((ia.net[x] ?? 0) < 1) continue;
    const lie = gw.nation(x)?.intel?.turned.includes(a) === true;
    const force = lie ? ("lie" as const) : undefined;
    if (atWarWith(gw, a, x)) {
      const fronts = sharedFronts(gw, a, x);
      const main = allocOf(gw, a)?.main;
      const t = fronts.find((y) => y === main) ?? fronts[0];
      if (t !== undefined) learn(gw, a, "strain", x, t, "agents", force);
    } else if (seat !== undefined && gw.nation(x)?.side === null) {
      sendReport(gw, seat, "lean", x, null, "agents", force);
    }
  }
}

// ---- Counter-intelligence ----

function catchStep(gw: GreatWar): void {
  for (const s of GW_SPY_POWERS) {
    const is = gw.nation(s)?.intel;
    if (is === undefined) continue;
    for (const x of Object.keys(is.net) as GwTag[]) {
      const net = is.net[x] ?? 0;
      if (net < 1 || gw.nation(x) === null) continue;
      const ix = intelOf(gw, x);
      if (ix.turned.includes(s)) continue;
      if (ix.caught.some((c) => c.tag === s)) continue;
      const pm =
        CATCH_BASE +
        CATCH_COUNTER * ix.counter -
        CATCH_NET * net +
        skillOf(gw, x);
      const r = wwRoll(
        gw.s.seed,
        P_CATCH,
        gw.s.chapter,
        idx(gw, s),
        idx(gw, x),
      );
      if (r % 1000 >= pm) continue;
      agentsTaken(gw, x, s);
    }
  }
  // A caught man nobody decided about is shown to the world.
  for (const n of gw.s.nations) {
    const i = n.intel;
    if (i === undefined || i.caught.length === 0) continue;
    for (const c of i.caught.filter(
      (y) => gw.s.chapter - y.chapter > CAUGHT_WAIT,
    )) {
      expose(gw, n.tag, c.tag);
    }
    i.caught = i.caught.filter((y) => gw.s.chapter - y.chapter <= CAUGHT_WAIT);
  }
}

/** `x` has taken `s`'s agents: a seat with counter 3 is asked; else shown. */
export function agentsTaken(gw: GreatWar, x: GwTag, s: GwTag): void {
  const ix = intelOf(gw, x);
  if (ix.counter >= 3) {
    if (ruledBySeat(gw, x)) {
      ix.caught.push({ tag: s, chapter: gw.s.chapter });
      for (const seat of seatsOf(gw, x)) {
        seat.scheduled.push({
          scene: "gw_spy_caught",
          chapter: gw.s.chapter + 1,
        });
      }
      return;
    }
    const sly = gw.nation(x)?.ai === "opportunist";
    if (sly || roll(gw, P_TURN, idx(gw, x), idx(gw, s)) < 40) {
      turn(gw, x, s);
      return;
    }
  }
  expose(gw, x, s);
}

function turn(gw: GreatWar, x: GwTag, s: GwTag): void {
  const ix = intelOf(gw, x);
  if (!ix.turned.includes(s)) ix.turned.push(s);
}

/**
 * Design §6, exposure: the net is lost, the world hears of it, `x` trusts the
 * sender less, and a neutral `x` turns against the sender's side.
 */
export function expose(gw: GreatWar, x: GwTag, s: GwTag): void {
  const is = intelOf(gw, s);
  delete is.net[x];
  const nx = gw.nation(x);
  const ns = gw.nation(s);
  if (nx === null || ns === null) return;
  nx.trust[s] = clampTo((nx.trust[s] ?? 0) - 1, -3, 3);
  if (nx.side === null && ns.side !== null) {
    nx.lean = clampTo(nx.lean + (ns.side === "central" ? 1 : -1), -1, 1);
    nx.readiness = clampTo(nx.readiness + 10, 0, 100);
  }
  news(gw, "spy_exposed", x, s);
  for (const seat of seatsOf(gw, s)) reason(gw, seat, "spy_ours_exposed");
  for (const seat of seatsOf(gw, x)) reason(gw, seat, "spy_caught");
  // Design §6, AI: counter-intelligence is funded when agents turn up.
  const ix = intelOf(gw, x);
  if (
    !ruledBySeat(gw, x) &&
    ix.counter < 3 &&
    roll(gw, P_COUNTER, idx(gw, x), idx(gw, s)) < AI_FUND_PCT
  ) {
    ix.counter++;
  }
}

// ---- Operations abroad (the schedule's 뒷공작 rows, and the AI) ----

function record(
  gw: GreatWar,
  a: GwTag,
  act: string,
  tag: GwTag | null,
  ok: boolean,
  out: boolean,
): void {
  const ia = intelOf(gw, a);
  ia.ops.push({ act, tag, ok, out, chapter: gw.s.chapter });
  if (ia.ops.length > OPS_KEPT) ia.ops.splice(0, 1);
}

/** The roll of an operation against `x`'s counter-intelligence. */
function opRoll(
  gw: GreatWar,
  a: GwTag,
  x: GwTag,
  act: GwSpyAct,
  base: number,
  outBase: number,
): { ok: boolean; out: boolean } {
  const ia = intelOf(gw, a);
  const ix = intelOf(gw, x);
  const net = ia.net[x] ?? 0;
  const k = idHash(act);
  const ok =
    roll(gw, P_OP, idx(gw, a), idx(gw, x), k) <
    base + 10 * net + skillOf(gw, a) - 12 * ix.counter;
  const out =
    roll(gw, P_OP_OUT, idx(gw, a), idx(gw, x), k) <
    outBase + OUT_COUNTER * ix.counter;
  return { ok, out };
}

function plantNet(gw: GreatWar, a: GwTag, x: GwTag): void {
  const ia = intelOf(gw, a);
  const { ok, out } = opRoll(gw, a, x, "net", 55, 3);
  if (ok) ia.net[x] = Math.min(3, (ia.net[x] ?? 0) + 1);
  record(gw, a, "net", x, ok, out);
  if (out) expose(gw, x, a);
}

function sabotage(gw: GreatWar, a: GwTag, x: GwTag): void {
  const ia = intelOf(gw, a);
  ia.sabotaged = gw.s.day;
  const { ok, out } = opRoll(gw, a, x, "sabotage", 30, 6);
  if (ok) {
    moveGauge(gw, x, "shells", -1, "shells_sabotaged");
    news(gw, "spy_sabotage", x);
  }
  record(gw, a, "sabotage", x, ok, out);
  if (out) expose(gw, x, a);
}

function court(gw: GreatWar, a: GwTag, x: GwTag): void {
  const na = gw.nation(a);
  const nx = gw.nation(x);
  const { ok, out } = opRoll(gw, a, x, "court", 35, 6);
  if (ok && na !== null && nx !== null && na.side !== null) {
    nx.lean = clampTo(nx.lean + (na.side === "entente" ? 1 : -1), -1, 1);
    nx.readiness = clampTo(nx.readiness + 5, 0, 100);
  }
  record(gw, a, "court", x, ok, out);
  if (out) expose(gw, x, a);
}

// ---- Subversion (at most one a year) ----

function rested(gw: GreatWar, a: GwTag): boolean {
  return gw.s.day - intelOf(gw, a).subverted >= YEAR;
}

function marked(gw: GreatWar, tag: GwTag, mark: string): boolean {
  return gw.nation(tag)?.intel?.marks.includes(mark) === true;
}

/** What Britain's promise to Hussein adds to France's price for a place. */
const HUSSEIN_COST = 15;
const HUSSEIN_GROUPS: readonly string[] = ["syria", "palestine"];

/**
 * At the peace table, McMahon against Sykes-Picot: once Britain has backed
 * the Arab revolt (`m_hussein_promise`), France's claims in Syria and
 * Palestine cost it more to win.
 */
export function promiseCost(gw: GreatWar, by: GwTag, place: GwPlace): number {
  if (by !== "FRA" || !marked(gw, "GBR", "hussein")) return 0;
  return HUSSEIN_GROUPS.includes(GW_PLACES[place].group) ? HUSSEIN_COST : 0;
}

function mark(gw: GreatWar, tag: GwTag, m: string): void {
  const i = intelOf(gw, tag);
  if (!i.marks.includes(m)) i.marks.push(m);
}

function live(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  return n !== null && !n.out;
}

/** Whether `a` can order this subversion now. */
function subversionOpen(
  gw: GreatWar,
  a: GwTag,
  act: "lenin" | "ireland" | "arab" | "jihad",
): boolean {
  if (!fights(gw.nation(a)) || !rested(gw, a)) return false;
  switch (act) {
    case "lenin": {
      const rus = gw.nation("RUS");
      return (
        a === "DEU" &&
        rus !== null &&
        !rus.out &&
        atWarWith(gw, a, "RUS") &&
        !marked(gw, a, "lenin") &&
        (rus.unrest >= 3 || rus.regime !== firstRegime("RUS"))
      );
    }
    case "ireland":
      return (
        a === "DEU" &&
        live(gw, "GBR") &&
        atWarWith(gw, a, "GBR") &&
        !marked(gw, a, "ireland")
      );
    case "arab": {
      const w = warOf(gw, "GBR", "OTT");
      return (
        a === "GBR" &&
        live(gw, "OTT") &&
        w !== null &&
        monthsFrom(gw, w.since) >= 12 &&
        !marked(gw, a, "arab")
      );
    }
    case "jihad":
      return (
        (a === "DEU" || a === "OTT") &&
        live(gw, "OTT") &&
        gw.nation("OTT")?.side === "central" &&
        !marked(gw, "OTT", "jihad")
      );
  }
}

function subvert(
  gw: GreatWar,
  a: GwTag,
  act: "lenin" | "ireland" | "arab" | "jihad",
): void {
  if (!subversionOpen(gw, a, act)) return;
  const s = gw.s;
  intelOf(gw, a).subverted = s.day;
  mark(gw, a, act);
  switch (act) {
    case "lenin": {
      // The sealed train: Russia's ladder takes a rung's push, the east line
      // its strain; the contagion comes home later.
      const rus = gw.nation("RUS")!;
      rus.lowOrder += 2;
      moveGauge(gw, "RUS", "order", -1, "order_stirred");
      addStrain(gw, "east", "RUS", 20);
      intelOf(gw, a).later.push({ what: "lenin_home", day: s.day + YEAR });
      news(gw, "spy_lenin", "RUS", a);
      record(gw, a, "lenin", "RUS", true, false);
      return;
    }
    case "ireland": {
      // Britain reading Germany's traffic finds the ship (the Aud, 1916).
      const read = reads(gw, "GBR", a);
      if (read) {
        mark(gw, a, "ship");
        news(gw, "spy_arms_taken", "GBR", a);
      } else {
        moveGauge(gw, "GBR", "order", -1, "order_stirred");
        news(gw, "spy_irish_rising", "GBR", a);
      }
      record(gw, a, "ireland", "GBR", !read, read);
      return;
    }
    case "arab": {
      moveGauge(gw, "OTT", "order", -1, "order_stirred");
      mark(gw, a, "hussein");
      for (const seat of seatsOf(gw, a)) {
        seat.memory.push({
          key: "m_hussein_promise",
          who: null,
          chapter: s.chapter,
          weight: 0,
        });
      }
      news(gw, "spy_arab_revolt", "OTT", a);
      record(gw, a, "arab", "OTT", true, false);
      return;
    }
    case "jihad": {
      // It mostly failed: a weak roll, and only Britain's order feels it.
      mark(gw, "OTT", "jihad");
      const ok = roll(gw, P_EVENT, idHash("jihad")) < 25 && live(gw, "GBR");
      if (ok) moveGauge(gw, "GBR", "order", -1, "order_stirred");
      news(gw, "spy_jihad", "OTT");
      record(gw, a, "jihad", null, ok, false);
      return;
    }
  }
}

/** The Arab revolt keeps the Ottoman ends of the south strained. */
function ongoingStep(gw: GreatWar): void {
  if (marked(gw, "GBR", "arab") && live(gw, "OTT")) {
    addStrain(gw, "palestine", "OTT", 2);
    addStrain(gw, "mesopotamia", "OTT", 2);
  }
  for (const n of gw.s.nations) {
    const i = n.intel;
    if (i === undefined || i.later.length === 0) continue;
    const due = i.later.filter((l) => l.day <= gw.s.day);
    i.later = i.later.filter((l) => l.day > gw.s.day);
    for (const l of due) laterNow(gw, n.tag, l.what);
  }
}

function laterNow(gw: GreatWar, tag: GwTag, what: string): void {
  const n = gw.nation(tag)!;
  if (what === "lenin_home") {
    // The contagion of November 1918: the revolution sent east comes back.
    n.lowOrder += 1;
    moveGauge(gw, tag, "order", -1, "order_contagion");
  } else if (what === "blame_cost") {
    const i = intelOf(gw, tag);
    i.counter = Math.max(0, i.counter - 1);
    n.authority = clampTo(n.authority - 5, 0, 100);
    for (const seat of seatsOf(gw, tag)) reason(gw, seat, "spy_blame_cost");
  }
}

// ---- State events: the Magdeburg, the Russian plain radio, Room 40 ----

function eventsStep(gw: GreatWar): void {
  const s = gw.s;
  const dr = warOf(gw, "DEU", "RUS");
  if (
    dr !== null &&
    !marked(gw, "DEU", "magdeburg") &&
    monthsFrom(gw, dr.since) <= 6 &&
    roll(gw, P_EVENT, idHash("magdeburg")) < 30
  ) {
    // A cruiser aground in the Baltic: Russia keeps the book, Britain gets one.
    mark(gw, "DEU", "magdeburg");
    const to: GwTag = atWarWith(gw, "GBR", "DEU") ? "GBR" : "RUS";
    const i = intelOf(gw, to);
    i.crypt = Math.min(3, i.crypt + 1);
    mark(gw, to, "magdeburg");
    const seat = seatOf(gw, to);
    if (seat !== undefined) reason(gw, seat, "spy_codebook");
  }
  const rus = gw.nation("RUS");
  const ir = rus?.intel;
  if (rus !== null && (ir?.secure ?? 0) === 0) {
    const beaten = s.battles.some(
      (b) =>
        b.theatre === "east" &&
        b.by === "central" &&
        (b.result === "advance" || b.result === "break"),
    );
    if (beaten) {
      intelOf(gw, "RUS").secure = 1;
      mark(gw, "RUS", "plain_end");
    }
  }
  const dg = warOf(gw, "GBR", "DEU");
  if (
    dg !== null &&
    marked(gw, "GBR", "magdeburg") &&
    !marked(gw, "GBR", "room40") &&
    monthsFrom(gw, dg.since) >= 6
  ) {
    const hall = gw.person("gbr_hall")?.office === "intelligence";
    const seat = seatOf(gw, "GBR");
    const opened =
      seat?.memory.some((m) => m.key === "m_room40_opened") === true;
    if (hall || opened || !ruledBySeat(gw, "GBR")) {
      const i = intelOf(gw, "GBR");
      i.crypt = Math.min(3, i.crypt + 1);
      mark(gw, "GBR", "room40");
    }
  }
}

// ---- The AI's service (design §6 AI, 9A) ----

function aiStep(gw: GreatWar, a: GwTag, foes: GwTag[]): void {
  const n = gw.nation(a)!;
  const ia = intelOf(gw, a);
  const bold = n.ai === "opportunist" || n.ai === "hardline";
  const k = idx(gw, a);
  const neutrals = COURTED.filter(
    (x) => x !== a && gw.nation(x)?.side === null && live(gw, x),
  );
  const nets = Object.values(ia.net).filter((v) => (v ?? 0) > 0).length;
  const netPct = bold ? AI_NET_PCT_BOLD : AI_NET_PCT;
  if (nets < AI_NETS && roll(gw, P_AI, k, 1) < netPct) {
    const pool = [...foes, ...neutrals].filter((x) => (ia.net[x] ?? 0) < 3);
    if (pool.length > 0) {
      plantNet(gw, a, pool[roll(gw, P_AI, k, 2) % pool.length]);
    }
  }
  if (gw.s.day - ia.sabotaged >= HALF_YEAR && roll(gw, P_AI, k, 3) < 30) {
    const at = [...foes, ...neutrals].find((x) => (ia.net[x] ?? 0) > 0);
    if (at !== undefined) sabotage(gw, a, at);
  }
  const courted = neutrals.find((x) => (ia.net[x] ?? 0) > 0);
  if (courted !== undefined && roll(gw, P_AI, k, 4) < 20) {
    court(gw, a, courted);
  }
  for (const act of ["lenin", "ireland", "arab", "jihad"] as const) {
    if (subversionOpen(gw, a, act) && roll(gw, P_AI, k, 5) < 40) {
      subvert(gw, a, act);
      break;
    }
  }
}

/** Chapter step (from Intel.intelStep): the secret war of every service. */
export function spiesStep(gw: GreatWar): void {
  const s = gw.s;
  const war = s.warChapter !== null || s.wars.some((w) => w.ended === null);
  if (!war) return;
  eventsStep(gw);
  ongoingStep(gw);
  for (const a of GW_SPY_POWERS) {
    if (!fights(gw.nation(a))) continue;
    suspicionStep(gw, a);
  }
  for (const n of s.nations) codeChangeStep(gw, n.tag);
  for (const a of GW_SPY_POWERS) {
    const n = gw.nation(a);
    if (!fights(n)) continue;
    const foes = n!.atWar.filter((f) => live(gw, f));
    codesStep(gw, a, foes);
    alarmStep(gw, a, foes);
    netStep(gw, a);
  }
  spotStep(gw);
  catchStep(gw);
  for (const a of GW_SPY_POWERS) {
    const n = gw.nation(a);
    if (!fights(n) || ruledBySeat(gw, a)) continue;
    aiStep(
      gw,
      a,
      n!.atWar.filter((f) => live(gw, f)),
    );
  }
}

// ---- Called by the fronts (S7a raids, S7b breakthroughs) ----

/** A won raid: a prisoner's word on the foe's strain, and the raid's spotting term. */
export function wonRaid(gw: GreatWar, winner: GwTag, theatre: GwTheatre): void {
  if (gw.nation(winner) === null) return;
  intelOf(gw, winner).raided[theatre] = gw.s.chapter;
  const foe = foeOn(gw, theatre, winner);
  if (foe !== null) learn(gw, winner, "strain", foe, theatre, "prisoners");
}

/**
 * Papers taken in a raid or a breakthrough: the foe's next offensive, if he
 * prepares one anywhere he faces the winner, or his strain here, confirmed.
 */
export function capturedOrders(
  gw: GreatWar,
  winner: GwTag,
  theatre: GwTheatre,
): void {
  if (gw.nation(winner) === null) return;
  const foe = foeOn(gw, theatre, winner);
  if (foe === null) return;
  const o =
    offensivesOf(gw).find(
      (x) => x.tag === foe && x.launch === null && x.theatre === theatre,
    ) ??
    offensivesOf(gw).find(
      (x) =>
        x.tag === foe &&
        x.launch === null &&
        facing(gw, x.theatre, winner, foe),
    );
  if (o === undefined) {
    learn(gw, winner, "strain", foe, theatre, "prisoners", "confirmed");
    return;
  }
  learn(gw, winner, "prep", foe, o.theatre, "prisoners", "confirmed");
  if (!seenBy(gw, o).includes(winner)) markSeen(gw, o, winner);
}

// ---- What a scene can ask and do (WorldDsl `spy`) ----

const TAGGED: readonly GwSpyCan[] = ["net", "sabotage", "court"];

/** Whether the seat's country can do it now, or how its last operation went. */
export function spyHolds(
  gw: GreatWar,
  seat: GwSeatState,
  can: GwSpyCan,
  tag?: GwTag,
): boolean {
  const a = seat.tag;
  const na = gw.nation(a);
  if (na === null) return false;
  if (TAGGED.includes(can)) {
    if (tag === undefined || tag === a || !live(gw, tag)) return false;
    if (!GW_SPY_POWERS.includes(a)) return false;
  }
  const i = na.intel;
  const net = tag === undefined ? 0 : (i?.net[tag] ?? 0);
  const lastOp = i?.ops[i.ops.length - 1];
  switch (can) {
    case "net":
      return net < 3;
    case "sabotage":
      return net > 0 && fights(na) && gw.s.day - (i?.sabotaged ?? NEVER) >= 30;
    case "court":
      return net > 0 && gw.nation(tag!)?.side === null && na.side !== null;
    case "lenin":
    case "ireland":
    case "arab":
    case "jihad":
      return subversionOpen(gw, a, can);
    case "blame":
      return fights(na) && lostLately(gw, a);
    case "ok":
      return lastOp?.ok === true;
    case "out":
      return lastOp?.out === true;
    case "from":
      return i?.caught.some((c) => c.tag === tag) === true;
    case "reading":
      return tag !== undefined && i?.reads.includes(tag) === true;
    case "ship":
      return marked(gw, "DEU", "ship");
    case "double":
      return (i?.caught.length ?? 0) > 0;
  }
}

/** A battle went against the seat's end in the last two chapters. */
function lostLately(gw: GreatWar, a: GwTag): boolean {
  return gw.s.battles.some((b) => {
    if (gw.s.chapter - b.chapter > 2 || b.by === null) return false;
    const end = memberEnd(gw, b.theatre, a);
    if (end === null) return false;
    const won =
      b.result === "advance" || b.result === "break"
        ? b.by
        : b.result === "repelled"
          ? b.by === "central"
            ? "entente"
            : "central"
          : null;
    return won !== null && won !== end;
  });
}

/**
 * The row's own first pick, with no country named: the enemy facing the main
 * effort (a net, sabotage), or the neutral where a net already works (courting).
 */
function defaultTarget(
  gw: GreatWar,
  seat: GwSeatState,
  act: "net" | "sabotage" | "court",
): GwTag | null {
  const a = seat.tag;
  if (act === "court") {
    return (
      COURTED.find((x) => x !== a && spyHolds(gw, seat, "court", x)) ?? null
    );
  }
  const main = allocOf(gw, a)?.main;
  const foe = main === undefined ? null : foeOn(gw, main, a);
  return foe ?? gw.nation(a)?.atWar.find((x) => live(gw, x)) ?? null;
}

/** What the scene orders. An act that can't be done now records a failure. */
export function spyEffect(
  gw: GreatWar,
  seat: GwSeatState,
  act: GwSpyAct,
  tag?: GwTag,
): void {
  const a = seat.tag;
  if (gw.nation(a) === null) return;
  const i = intelOf(gw, a);
  switch (act) {
    case "net":
    case "sabotage":
    case "court": {
      const x = tag ?? defaultTarget(gw, seat, act);
      if (x === null || !spyHolds(gw, seat, act, x)) {
        record(gw, a, act, x, false, false);
        return;
      }
      if (act === "net") plantNet(gw, a, x);
      else if (act === "sabotage") sabotage(gw, a, x);
      else court(gw, a, x);
      return;
    }
    case "lenin":
    case "ireland":
    case "arab":
    case "jihad":
      subvert(gw, a, act);
      return;
    case "double":
    case "expose": {
      const c = i.caught[i.caught.length - 1];
      if (c === undefined) return;
      i.caught.pop();
      if (act === "double") turn(gw, a, c.tag);
      else expose(gw, a, c.tag);
      return;
    }
    case "blame": {
      // Myasoedov, March 1915: the front breathes, the service pays later.
      const main = allocOf(gw, a)?.main;
      if (main !== undefined) addStrain(gw, main, a, -5);
      moveGauge(gw, a, "order", 1, "order_spies_blamed");
      i.later.push({ what: "blame_cost", day: gw.s.day + BLAME_LATER });
      return;
    }
    case "hide":
      i.readOn = [];
      return;
  }
}
