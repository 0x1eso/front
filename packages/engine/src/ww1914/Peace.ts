// Great War 1914: how the fighting stops. Countries are beaten by their ground,
// break by their ladder, or ask. Small ones leave; when a side's leaders go the
// armistice comes and the next chapter is the conference (design §3).
import {
  GW_LINES,
  GwArmisticeKind,
  GwNationState,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_TABLE_SESSIONS } from "@openfront/engine-lib/ww1914/TableRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { closeTable, tableStart } from "./Table";
import { GW_BEATEN, GwBeaten } from "./Tables";
import { leaveWar } from "./Wars";
import {
  chapterOf,
  everyMonths,
  fights,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_MINOR = idHash("gw_minor_out");
const P_SPENT = idHash("gw_spent");

/** Who leads each side: when they're gone, the side is done. */
const LEADERS: Readonly<Record<GwSide, readonly GwTag[]>> = {
  central: ["DEU"],
  entente: ["FRA", "GBR"],
};
/** Countries that can only follow, and leave alone when they can't go on. */
const FOLLOWERS: readonly GwTag[] = [
  "BGR",
  "OTT",
  "AUH",
  "ITA",
  "ROU",
  "GRC",
  "SRB",
  "MNE",
];

/** Months of war before anyone will talk of stopping as they stand. */
const SPENT_MONTHS = 30;
/** Within this of level, a war can stop with neither side beaten. */
const LEVEL_SCORE = 30;
/** Chapters the peace takes before the closing one, and days in each. */
const CONFERENCE_CHAPTERS = GW_TABLE_SESSIONS;
const CONFERENCE_DAYS = 30;
/** Past this a side has lost, and knows it. */
const LOST_SCORE = -40;
/** Months before a staff nobody plays admits a lost war: 1914's men don't. */
const LEADER_ASKS_MONTHS = 30;
/** Months before anyone will hear of stopping: the first year has no bill yet. */
export const TALKS_MONTHS = 10;

function beatenBy(gw: GreatWar, row: GwBeaten): boolean {
  const n = gw.nation(row.tag);
  const t = gw.s.theatres.find((x) => x.id === row.theatre)!;
  if (n === null || !fights(n) || n.entered === null || t.since === null) {
    return false;
  }
  if (gw.s.chapter - n.entered < row.after) return false;
  if (row.behind !== undefined && gw.nation(row.behind)?.out !== true) {
    return false;
  }
  const lines = GW_LINES[row.theatre];
  if (row.from !== undefined) return t.line >= lines.indexOf(row.from);
  return t.line <= lines.indexOf(row.to ?? lines[0]);
}

function groundStep(gw: GreatWar): void {
  for (const row of GW_BEATEN) {
    if (beatenBy(gw, row)) leaveWar(gw, row.tag, "nation_beaten");
  }
}

/** A follower with nothing left asks on its own. */
function followerDone(gw: GreatWar, n: GwNationState): boolean {
  const side = n.side;
  if (side === null || ruledBySeat(gw, n.tag)) return false;
  const lost = warScore(gw, side) <= LOST_SCORE;
  const tired = n.gauges.morale <= 1 && n.gauges.order <= 1;
  const r = wwRoll(gw.s.seed, P_MINOR, gw.s.chapter, gw.s.nations.indexOf(n));
  return lost && tired && r % 100 < 35;
}

function leadersLeft(gw: GreatWar, side: GwSide): GwTag[] {
  return LEADERS[side].filter((t) => {
    const n = gw.nation(t);
    return n?.side === side && fights(n);
  });
}

/**
 * The side is done: Germany gone, or France with Russia gone or Britain alone.
 * A side its leaders never joined (ww171: Vienna and Belgrade alone, say) is
 * done when every member of it is out.
 */
function sideDone(gw: GreatWar, side: GwSide): boolean {
  const members = gw.s.nations.filter((n) => n.side === side);
  if (members.length === 0) return false;
  const joined = LEADERS[side].filter((t) => gw.nation(t)?.side === side);
  if (joined.length === 0) return members.every((n) => n.out);
  if (side === "central") return leadersLeft(gw, side).length === 0;
  const fra = gw.nation("FRA")?.out === true;
  const rus = gw.nation("RUS")?.out === true;
  if (!joined.includes("FRA")) return leadersLeft(gw, side).length === 0;
  return fra && (rus || leadersLeft(gw, side).length === 0);
}

export function armistice(
  gw: GreatWar,
  kind: GwArmisticeKind,
  by: GwTag | null,
): void {
  const s = gw.s;
  if (s.armistice !== null || s.warChapter === null) return;
  s.armistice = { kind, chapter: s.chapter, by };
  news(gw, `armistice_${kind}`, by);
  turn(gw, `armistice_${kind}`);
}

/** A leader nobody plays asks when the war is plainly lost. */
function leaderAsks(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || !fights(n) || n.side === null) return false;
  if (ruledBySeat(gw, tag)) return false;
  if (warMonths(gw) < LEADER_ASKS_MONTHS) return false;
  const score = warScore(gw, n.side);
  const friends = gw.s.nations.filter(
    (x) => x.side === n.side && x.tag !== tag && fights(x),
  ).length;
  const broken = n.gauges.morale <= 1 || n.unrest >= 2;
  return score <= LOST_SCORE && (broken || friends === 0);
}

/** Both sides spent, nobody at the table to say no: it stops as it stands. */
function bothSpent(gw: GreatWar): boolean {
  const s = gw.s;
  if (warMonths(gw) < SPENT_MONTHS || !everyMonths(gw, 6, 2)) return false;
  if (s.seats.length > 0) return false;
  const score = warScore(gw, "central");
  if (Math.abs(score) > LEVEL_SCORE) return false;
  return wwRoll(s.seed, P_SPENT, s.chapter) % 100 < 25;
}

/** Chapter step: who is out, and whether it's over. */
export function peaceStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.warChapter === null || s.armistice !== null) return;
  groundStep(gw);
  for (const tag of FOLLOWERS) {
    const n = gw.nation(tag);
    if (n !== null && fights(n) && followerDone(gw, n)) {
      leaveWar(gw, tag, "sued_for_peace");
    }
  }
  if (sideDone(gw, "central")) armistice(gw, "central_lost", "DEU");
  else if (sideDone(gw, "entente")) armistice(gw, "entente_lost", "GBR");
  else if (leaderAsks(gw, "DEU")) armistice(gw, "central_lost", "DEU");
  else if (bothSpent(gw)) armistice(gw, "compromise", null);
  answerTalks(gw);
}

/** The other side's lead: who has to say yes. */
function enemyLead(gw: GreatWar, side: GwSide): GwNationState | null {
  const foe = other(side);
  const tag = leadersLeft(gw, foe)[0];
  return tag === undefined ? null : gw.nation(tag);
}

/** Would the other side stop as things stand? Valued, never rolled. */
export function talksAccepted(gw: GreatWar, seat: GwSeatState): boolean {
  const n = gw.nation(seat.tag);
  if (n === null || n.side === null) return false;
  const foe = enemyLead(gw, n.side);
  if (foe === null) return true;
  if (warMonths(gw) < TALKS_MONTHS) return false;
  const theirs = warScore(gw, foe.side!);
  const tired =
    (foe.gauges.morale <= 2 ? 1 : 0) +
    (foe.gauges.order <= 2 ? 1 : 0) +
    (foe.gauges.bread <= 1 ? 1 : 0) +
    (foe.unrest >= 1 ? 1 : 0) +
    (warMonths(gw) >= SPENT_MONTHS ? 1 : 0);
  const stubborn = { hardline: 3, principled: 2, opportunist: 1, cautious: 1 }[
    foe.ai
  ];
  // Nobody stops while winning unless he has been shown the bill.
  return theirs <= LEVEL_SCORE && tired >= stubborn;
}

/** Talks offered last chapter have their answer now. */
function answerTalks(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of s.seats) {
    if (!seat.flags.includes("gw_talks_open")) continue;
    seat.flags = seat.flags.filter((f) => f !== "gw_talks_open");
    const side = gw.nation(seat.tag)?.side ?? null;
    if (side === null) continue;
    // A friend who leads the other side hears it first, whoever leads it.
    const seated = leadersLeft(gw, other(side)).find((t) => ruledBySeat(gw, t));
    const friend = seated === undefined ? [] : seatsOf(gw, seated);
    if (friend.length > 0) {
      for (const f of friend) {
        f.scheduled.push({ scene: "gw_peace_offer", chapter: s.chapter + 1 });
      }
      continue;
    }
    if (talksAccepted(gw, seat)) {
      reason(gw, seat, "talks_accepted");
      armistice(gw, "compromise", null);
      return;
    }
    reason(gw, seat, "talks_refused");
    news(gw, "talks_refused", seat.tag);
  }
}

/** The seat offers peace: the answer comes when the chapter closes. */
export function openTalks(gw: GreatWar, seat: GwSeatState): void {
  gw.s.talks = gw.s.chapter;
  if (!seat.flags.includes("gw_talks_open")) seat.flags.push("gw_talks_open");
}

/** The seat's country asks. A leader's asking stops its side. */
export function sue(gw: GreatWar, tag: GwTag): void {
  const n = gw.nation(tag);
  if (n === null || n.side === null) return;
  if (LEADERS[n.side].includes(tag)) {
    const left = leadersLeft(gw, n.side).filter((t) => t !== tag);
    if (left.length === 0) {
      armistice(
        gw,
        n.side === "central" ? "central_lost" : "entente_lost",
        tag,
      );
      return;
    }
  }
  leaveWar(gw, tag, "sued_for_peace");
}

/** The chapter after an armistice is the conference, whatever the calendar says. */
export function skipToConference(gw: GreatWar): void {
  const s = gw.s;
  const chapters = gwChapters(s.calendar);
  const last = chapters.length - 1;
  if (s.armistice === null || s.closingDay !== null) return;
  // A bilateral table still sitting signs before the conference takes its place.
  if (s.table !== null && s.table.pair !== undefined) closeTable(gw);
  s.closingDay = s.day + chapterOf(gw).spanDays;
  s.conferenceLeft = CONFERENCE_CHAPTERS;
  s.chapter = last - 1;
  s.table = tableStart(gw);
  // The war's papers stop with it; the jump mustn't bring them all at once.
  for (const seat of s.seats) {
    seat.scheduled = seat.scheduled.filter((q) => {
      const stage = gwContent().scenes.find((x) => x.id === q.scene)?.stage;
      return stage === undefined || stage.includes("conference");
    });
  }
}

/** Chapters the game has had: the jump to the conference skips rows nobody saw. */
export function chaptersPlayed(gw: GreatWar): number {
  const s = gw.s;
  if (s.armistice === null || s.closingDay === null) return s.chapter + 1;
  return s.armistice.chapter + 2 + CONFERENCE_CHAPTERS - s.conferenceLeft;
}

/** A chapter of the peace ends: the next opens a month on, in the same row. */
export function nextConferenceChapter(gw: GreatWar): void {
  gw.s.conferenceLeft--;
  gw.s.closingDay = (gw.s.closingDay ?? gw.s.day) + CONFERENCE_DAYS;
}
