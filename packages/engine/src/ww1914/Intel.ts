import {
  GwFactKind,
  GwReport,
  GwSeatState,
  GwSource,
  GwStamp,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { allocOf } from "./Fronts";
import type { GreatWar } from "./GreatWar";
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
): GwReport {
  const s = gw.s;
  const uid = s.nextReport++;
  const band = s.sources.find((x) => x.id === source)?.band ?? 2;
  const truth = factTruth(gw, fact, tag, theatre);
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
  };
  s.reports.push(report);
  return report;
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
  ITA: "embassy_vienna",
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

/** Chapter step: old reports are checked, new ones go out. */
export function intelStep(gw: GreatWar): void {
  checkReports(gw);
  for (const seat of gw.s.seats) {
    if (gw.s.warChapter === null) sendCrisisReports(gw, seat);
    else sendWarReports(gw, seat);
  }
}
