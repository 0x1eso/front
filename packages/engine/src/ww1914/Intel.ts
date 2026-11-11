import {
  GW_THEATRES,
  GwFactKind,
  GwReport,
  GwSeatState,
  GwSource,
  GwStamp,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { agentsStep } from "./Agents";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { offensivesOf } from "./Offensives";
import { propagandaStep } from "./Propaganda";
import {
  intelOf,
  planOf,
  resolveTruth,
  spiesStep,
  strainWord,
  treatyTruth,
} from "./Spies";
import { strainOf } from "./Strain";
import { clampTo, reason } from "./World";

const P_STAMP = idHash("gw_stamp");
const P_WRONG = idHash("gw_wrong");
const P_CHECK = idHash("gw_check");

/** Percent chance of a stamp, by a source's band 1..3. */
const CONFIRMED_BY_BAND = [15, 35, 60];
const ESTIMATE_BY_BAND = [20, 15, 10];
/** Percent chance an unconfirmed report is wrong, by band. */
const WRONG_BY_BAND = [55, 30, 15];
/** A wrong report is put right within this many days (design §4.5). */
const CHECK_MIN = 18;
const CHECK_SPAN = 13;

/** What is true now. Text: gw.fact.<kind>.<value>. */
export function factTruth(
  gw: GreatWar,
  fact: GwFactKind,
  tag: GwTag,
  t: GwTheatre | null,
): number {
  const n = gw.nation(tag);
  if (n === null) return 0;
  switch (fact) {
    case "force":
      return t === null ? 0 : (n.strength[t] ?? 1);
    case "lean":
      // A claim is never negative: 0 stays out, 1 divided, 2 comes in.
      return n.lean + 1;
    case "mob":
      return n.mob;
    case "shells":
      return n.gauges.shells;
    case "morale":
      return n.gauges.morale;
    // ww173: a feint is gathered for show, and is there to be seen.
    case "prep":
      return t !== null &&
        offensivesOf(gw).some(
          (o) => o.tag === tag && o.theatre === t && o.launch === null,
        )
        ? 1
        : 0;
    case "strain":
      return t === null ? 0 : strainWord(strainOf(gw, t, tag));
    // ww178: peace's facts (Spies).
    case "resolve":
      return resolveTruth(gw, tag);
    case "plan": {
      const p = planOf(gw, tag);
      return p === null ? 0 : GW_THEATRES.indexOf(p);
    }
    case "treaty":
      return treatyTruth(gw, tag);
    case "unrest":
      return n.unrest;
    // Filed by their own systems (House, S2), never sent through here.
    case "count":
    case "plot":
    case "file":
    case "ally":
      return 0;
  }
}

function wrongClaim(
  gw: GreatWar,
  fact: GwFactKind,
  truth: number,
  uid: number,
): number {
  const up = wwRoll(gw.s.seed, P_WRONG, uid, 1) % 2 === 0;
  const bounds: Record<GwFactKind, [number, number]> = {
    force: [1, 5],
    lean: [0, 2],
    mob: [0, 2],
    shells: [0, 3],
    morale: [0, 5],
    count: [0, 4],
    plot: [0, 4],
    file: [0, 1],
    ally: [0, 2],
    prep: [0, 1],
    strain: [0, 4],
    resolve: [0, 1],
    plan: [0, GW_THEATRES.length - 1],
    treaty: [0, 1],
    unrest: [0, 4],
  };
  const [lo, hi] = bounds[fact];
  const moved = clampTo(truth + (up ? 1 : -1), lo, hi);
  return moved !== truth ? moved : clampTo(truth + (up ? -1 : 1), lo, hi);
}

/**
 * A report reaches a seat. The one rule (design §4.5): only an unconfirmed
 * report can be wrong, and every unconfirmed one is checked within a month.
 */
export function sendReport(
  gw: GreatWar,
  seat: GwSeatState,
  fact: GwFactKind,
  tag: GwTag,
  theatre: GwTheatre | null,
  source: GwSource,
  force?: GwReportForce,
): GwReport {
  const s = gw.s;
  const uid = s.nextReport++;
  const truth = factTruth(gw, fact, tag, theatre);
  const { stamp, wrong } = stampOf(gw, source, uid, force);
  const report: GwReport = {
    uid,
    fact,
    tag,
    theatre,
    source,
    stamp,
    claim: wrong ? wrongClaim(gw, fact, truth, uid) : truth,
    truth,
    smallID: seat.smallID,
    chapter: s.chapter,
    checkDay:
      stamp === "unconfirmed"
        ? s.day + CHECK_MIN + (wwRoll(s.seed, P_CHECK, uid) % CHECK_SPAN)
        : null,
    ...(force === "lie" ? { about: TURNED } : {}),
  };
  s.reports.push(report);
  return report;
}

/**
 * ww173: how a report is stamped beyond the band's roll. confirmed: read in
 * the enemy's own traffic, or his own papers. lie: a turned agent's, wrong
 * and unconfirmed until it is checked.
 */
export type GwReportForce = "confirmed" | "lie";
/** A turned agent's report: when it is checked the source's band drops. */
const TURNED = "turned";

function stampOf(
  gw: GreatWar,
  source: GwSource,
  uid: number,
  force?: GwReportForce,
): { stamp: GwStamp; wrong: boolean } {
  if (force === "confirmed") return { stamp: "confirmed", wrong: false };
  if (force === "lie") return { stamp: "unconfirmed", wrong: true };
  const s = gw.s;
  const band = s.sources.find((x) => x.id === source)?.band ?? 2;
  const r = wwRoll(s.seed, P_STAMP, uid) % 100;
  const confirmed = CONFIRMED_BY_BAND[band - 1];
  const stamp: GwStamp =
    r < confirmed
      ? "confirmed"
      : r < confirmed + ESTIMATE_BY_BAND[band - 1]
        ? "estimate"
        : "unconfirmed";
  const wrong =
    stamp === "unconfirmed" &&
    wwRoll(s.seed, P_WRONG, uid) % 100 < WRONG_BY_BAND[band - 1];
  return { stamp, wrong };
}

/**
 * ww173: what `viewer` comes to hold of `fact` about `tag` at `theatre`: a
 * seat's report, or, for a country nobody plays, a line in its service's
 * `heard`. The claim it holds; with `onlyWrong`, nothing is sent unless the
 * roll makes it wrong (a false alarm), and null comes back.
 */
export function learn(
  gw: GreatWar,
  viewer: GwTag,
  fact: GwFactKind,
  tag: GwTag,
  theatre: GwTheatre | null,
  source: GwSource,
  force?: GwReportForce,
  onlyWrong = false,
): number | null {
  const s = gw.s;
  const seat = s.seats.find((x) => x.tag === viewer && x.memoir === null);
  if (seat !== undefined) {
    const r = sendReport(gw, seat, fact, tag, theatre, source, force);
    if (onlyWrong && r.claim === r.truth) {
      s.reports.pop();
      return null;
    }
    return r.claim;
  }
  const n = gw.nation(viewer);
  // ww178: an AI keeps only what it acts on.
  if (n === null || !isHeard(fact)) return null;
  const uid = s.nextReport++;
  const truth = factTruth(gw, fact, tag, theatre);
  const { wrong } = stampOf(gw, source, uid, force);
  if (onlyWrong && !wrong) return null;
  const claim = wrong ? wrongClaim(gw, fact, truth, uid) : truth;
  heardBy(gw, viewer).push({ fact, tag, theatre, claim, chapter: s.chapter });
  return claim;
}

const HEARD_FACTS = ["prep", "strain", "resolve", "plan"] as const;
const isHeard = (f: GwFactKind): f is (typeof HEARD_FACTS)[number] =>
  (HEARD_FACTS as readonly string[]).includes(f);

/** Lines an AI service keeps: the newest win. */
const HEARD_KEPT = 12;

function heardBy(gw: GreatWar, viewer: GwTag) {
  const i = intelOf(gw, viewer);
  if (i.heard.length >= HEARD_KEPT) i.heard.splice(0, 1);
  return i.heard;
}

/** A report that waits to be put right until its system says so (a file). */
export const GW_CHECK_LATER = 2_000_000_000;

/** A report's stamp, rolled before it is written: whether it will be wrong. */
export interface GwReportRoll {
  uid: number;
  stamp: GwStamp;
  wrong: boolean;
}

/** Rolls the next report's stamp by the source's band (the one rule kept). */
export function rollReport(gw: GreatWar, source: GwSource): GwReportRoll {
  const uid = gw.s.nextReport++;
  return { uid, ...stampOf(gw, source, uid) };
}

/**
 * A report on something a system keeps (S2: plots, files, allies): the same
 * stamp rule as `sendReport`, the truth given. `later`: an unconfirmed one is
 * put right only when its system calls `checkNow` (a file, when it is used).
 */
export function sendHouseReport(
  gw: GreatWar,
  seat: GwSeatState,
  fact: GwFactKind,
  truth: number,
  source: GwSource,
  about: string,
  later = false,
  roll: GwReportRoll = rollReport(gw, source),
): GwReport {
  const s = gw.s;
  const { uid, stamp, wrong } = roll;
  const report: GwReport = {
    uid,
    fact,
    tag: seat.tag,
    theatre: null,
    source,
    stamp,
    claim: wrong ? wrongClaim(gw, fact, truth, uid) : truth,
    truth,
    smallID: seat.smallID,
    chapter: s.chapter,
    checkDay:
      stamp !== "unconfirmed"
        ? null
        : later
          ? GW_CHECK_LATER
          : s.day + CHECK_MIN + (wwRoll(s.seed, P_CHECK, uid) % CHECK_SPAN),
    about,
  };
  s.reports.push(report);
  return report;
}

/** Puts a report right today: the seat learns what was so. */
export function checkNow(gw: GreatWar, uid: number): void {
  const r = gw.s.reports.find((x) => x.uid === uid);
  if (r === undefined || r.checkDay === null) return;
  r.checkDay = gw.s.day;
  checkReports(gw);
}

/** Seen with the seat's own eyes: the truth, and any report of it is checked now. */
export function inspect(
  gw: GreatWar,
  seat: GwSeatState,
  fact: GwFactKind,
  tag: GwTag,
  theatre: GwTheatre | null,
): void {
  const s = gw.s;
  for (const r of s.reports) {
    const same = r.fact === fact && r.tag === tag && r.theatre === theatre;
    if (same && r.smallID === seat.smallID && r.checkDay !== null) {
      r.checkDay = s.day;
    }
  }
  checkReports(gw);
  const truth = factTruth(gw, fact, tag, theatre);
  s.reports.push({
    uid: s.nextReport++,
    fact,
    tag,
    theatre,
    source: "own_eyes",
    stamp: "confirmed",
    claim: truth,
    truth,
    smallID: seat.smallID,
    chapter: s.chapter,
    checkDay: null,
  });
}

/** The turned agent behind a lie is found out: his sender's reports run true. */
function unturn(gw: GreatWar, r: GwReport): void {
  const reader = gw.s.seats.find((x) => x.smallID === r.smallID)?.tag;
  const i = gw.nation(r.tag)?.intel;
  if (reader === undefined || i === undefined) return;
  i.turned = i.turned.filter((t) => t !== reader);
}

/** Checks what has come due: the source's record is what the seat learns from. */
function checkReports(gw: GreatWar): void {
  const s = gw.s;
  for (const r of s.reports) {
    if (r.checkDay === null || r.checkDay > s.day) continue;
    r.checkDay = null;
    const src = s.sources.find((x) => x.id === r.source);
    if (src === undefined) continue;
    if (r.claim === r.truth) {
      src.right++;
    } else {
      src.wrong++;
      // ww173: a turned agent's lie came out: his source is worth less.
      if (r.about === TURNED) {
        src.band = Math.max(1, src.band - 1);
        unturn(gw, r);
      }
      const seat = s.seats.find((x) => x.smallID === r.smallID);
      if (seat !== undefined) reason(gw, seat, "report_corrected");
    }
  }
}

const EMBASSY: Readonly<Partial<Record<GwTag, GwSource>>> = {
  GBR: "embassy_london",
  FRA: "embassy_paris",
  RUS: "embassy_petersburg",
  AUH: "embassy_vienna",
  ITA: "embassy_rome",
  DEU: "embassy_berlin",
};

function neutralsToWatch(gw: GreatWar): GwTag[] {
  const asked: GwTag[] = ["GBR", "ITA", "OTT"];
  return asked.filter((t) => gw.nation(t)?.side === null);
}

function sendCrisisReports(gw: GreatWar, seat: GwSeatState): void {
  const s = gw.s;
  const watch = neutralsToWatch(gw).filter((t) => t !== seat.tag);
  if (watch.length > 0) {
    const tag = watch[s.chapter % watch.length];
    sendReport(gw, seat, "lean", tag, null, EMBASSY[tag] ?? "press");
  }
  if (s.chain !== null && s.chain.step >= 3 && seat.tag !== "RUS") {
    sendReport(gw, seat, "mob", "RUS", null, "embassy_petersburg");
  }
}

function sendWarReports(gw: GreatWar, seat: GwSeatState): void {
  const s = gw.s;
  const main = allocOf(gw, seat.tag)?.main ?? "west";
  const t = s.theatres.find((x) => x.id === main);
  const foe = t === undefined ? null : foeOf(gw, seat, t.attacker, t.defender);
  if (t !== undefined && foe !== null) {
    sendReport(
      gw,
      seat,
      "force",
      foe,
      t.id,
      s.chapter % 2 ? "attache" : "staff",
    );
  }
  const watch = neutralsToWatch(gw);
  if (watch.length > 0) {
    const tag = watch[s.chapter % watch.length];
    sendReport(gw, seat, "lean", tag, null, EMBASSY[tag] ?? "agents");
  } else if (foe !== null) {
    sendReport(
      gw,
      seat,
      "morale",
      foe,
      null,
      s.chapter % 2 ? "agents" : "press",
    );
  }
}

function foeOf(
  gw: GreatWar,
  seat: GwSeatState,
  a: GwTag | null,
  b: GwTag | null,
): GwTag | null {
  const side = gw.nation(seat.tag)?.side ?? null;
  if (side === null) return null;
  const pick = [a, b].find((x) => x !== null && gw.nation(x)?.side !== side);
  return pick ?? null;
}

/** Chapter step: old reports are checked, new ones go out, then the secret war. */
export function intelStep(gw: GreatWar): void {
  checkReports(gw);
  for (const seat of gw.s.seats) {
    if (gw.s.warChapter === null) sendCrisisReports(gw, seat);
    else sendWarReports(gw, seat);
  }
  spiesStep(gw);
  agentsStep(gw);
  propagandaStep(gw);
}
