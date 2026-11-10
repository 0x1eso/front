// Great War 1914 (ww170 S3, design ww168 B4): scenes by state, and the crisis
// ladder. The July chain stays the first crisis; after it a seat can send a
// note from the 통치 tab to a country it could fight: a member of a coalition
// it is not in, or a neutral. The ladder is the same as July's, shorter:
// the note, the answer, mobilisation, then war or a climb-down. War still joins
// the existing coalitions (any-pair war is phase 4).
//
// Steps run as a chapter closes:
// - `sent`: the other side answers. A seat answers on a card it is dealt the
//   chapter the note goes out (`gw_ladder_note`); an AI by its character,
//   strength and friends, with a seeded roll.
// - `rejected`: the sender's card (`gw_ladder_refused`) says mobilise or climb
//   down; nobody deciding climbs down.
// - `mobilised`: one last chance (`gw_ladder_last` to a seat), then war.
// Every step writes the seat's reason lines and the world's news.
import {
  GW_LADDER_OPEN,
  GwLadder,
  GwLadderStep,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { GW_LADDER_REACH } from "@openfront/engine-lib/ww1914/content/ladder";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { closeChain } from "./Crises";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { moveRuler } from "./Ruler";
import { GW_ENTRIES } from "./Tables";
import { enter, openWar } from "./Wars";
import { clampTo, news, other, reason, seatsOf, turn } from "./World";

const P_LADDER = idHash("gw_ladder");

/** The cards of the ladder (content/scenes/ladder.ts). */
export const GW_LADDER_NOTE = "gw_ladder_note";
export const GW_LADDER_REFUSED = "gw_ladder_refused";
export const GW_LADDER_LAST = "gw_ladder_last";

/** Who stood where when the July war came, and the neutrals' leanings. */
const CASCADE: Readonly<Partial<Record<GwTag, GwSide>>> = {
  DEU: "central",
  AUH: "central",
  RUS: "entente",
  FRA: "entente",
  SRB: "entente",
  MNE: "entente",
  BEL: "entente",
  GBR: "entente",
};

/** The side a country would stand on in the general war, if it is known. */
export function naturalSide(gw: GreatWar, tag: GwTag): GwSide | null {
  const n = gw.nation(tag);
  if (n !== null && n.side !== null) return n.side;
  return CASCADE[tag] ?? GW_ENTRIES.find((e) => e.tag === tag)?.natural ?? null;
}

/** A ladder still running that has `tag` in it. */
export function openLadder(gw: GreatWar, tag: GwTag): GwLadder | null {
  return (
    gw.s.ladders.find(
      (l) =>
        GW_LADDER_OPEN.includes(l.step) && (l.from === tag || l.to === tag),
    ) ?? null
  );
}

/**
 * Whom `from` may send a note to now: a country it is not at war with that is
 * in a coalition it isn't, or a neutral; before the general war, one the July
 * war would put across from it. Neither side may be in another ladder.
 */
export function ladderTargets(gw: GreatWar, from: GwTag): GwTag[] {
  const me = gw.nation(from);
  if (me === null || me.out || openLadder(gw, from) !== null) return [];
  const mine = naturalSide(gw, from);
  const out: GwTag[] = [];
  for (const n of gw.s.nations) {
    if (n.tag === from || n.out || me.atWar.includes(n.tag)) continue;
    if (!GW_LADDER_REACH.includes(n.tag)) continue;
    if (openLadder(gw, n.tag) !== null) continue;
    const theirs = naturalSide(gw, n.tag);
    // In the war: anyone outside our coalition. Before it: across the July lines.
    const across =
      gw.s.warChapter !== null
        ? n.side === null || (me.side !== null && n.side !== me.side)
        : mine !== null && theirs !== null && theirs !== mine;
    if (across) out.push(n.tag);
  }
  return out;
}

function setStep(gw: GreatWar, l: GwLadder, step: GwLadderStep): void {
  l.step = step;
  l.chapter = gw.s.chapter;
}

const lineFor = (gw: GreatWar, tag: GwTag, key: string) => {
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
};

/** The world effect `ultimatum`: the seat's country sends its note. */
export function sendUltimatum(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
): void {
  if (!ladderTargets(gw, seat.tag).includes(to)) return;
  const l: GwLadder = {
    from: seat.tag,
    to,
    step: "sent",
    opened: gw.s.chapter,
    chapter: gw.s.chapter,
  };
  gw.s.ladders.push(l);
  gw.s.temp = clampTo(gw.s.temp + 1, 0, 10);
  news(gw, "ladder_sent", seat.tag, to);
  turn(gw, "ladder_sent");
  reason(gw, seat, "ladder_sent");
  for (const t of seatsOf(gw, to)) {
    t.scheduled.push({ scene: GW_LADDER_NOTE, chapter: gw.s.chapter + 1 });
  }
}

/** The ladder the seat has a part in, by that part. */
function ladderOf(
  gw: GreatWar,
  seat: GwSeatState,
  role: "from" | "to",
): GwLadder | null {
  return (
    gw.s.ladders.find(
      (l) => GW_LADDER_OPEN.includes(l.step) && l[role] === seat.tag,
    ) ?? null
  );
}

/** The world effect `ladder_answer`: the seat that was sent the note answers. */
export function ladderAnswer(
  gw: GreatWar,
  seat: GwSeatState,
  yes: boolean,
): void {
  const l = ladderOf(gw, seat, "to");
  if (l === null || l.step === "rejected") return;
  if (yes) return giveWay(gw, l);
  if (l.step === "mobilised") return toWar(gw, l);
  refuse(gw, l);
}

/** The world effect `ladder_press`: after a refusal, mobilise or climb down. */
export function ladderPress(
  gw: GreatWar,
  seat: GwSeatState,
  on: boolean,
): void {
  const l = ladderOf(gw, seat, "from");
  if (l === null || l.step !== "rejected") return;
  if (!on) return backDown(gw, l);
  setStep(gw, l, "mobilised");
  const n = gw.nation(l.from);
  if (n !== null) n.mob = 2;
  gw.s.temp = clampTo(gw.s.temp + 2, 0, 10);
  news(gw, "ladder_mobilised", l.from, l.to);
  lineFor(gw, l.from, "ladder_mobilised");
  for (const t of seatsOf(gw, l.to)) {
    t.scheduled.push({ scene: GW_LADDER_LAST, chapter: gw.s.chapter + 1 });
  }
}

function giveWay(gw: GreatWar, l: GwLadder): void {
  setStep(gw, l, "accepted");
  const from = gw.nation(l.from);
  const to = gw.nation(l.to);
  if (from !== null) from.authority = clampTo(from.authority + 5, 0, 100);
  if (to !== null) {
    to.authority = clampTo(to.authority - 5, 0, 100);
    to.mob = Math.min(to.mob, 0);
  }
  gw.s.temp = clampTo(gw.s.temp - 1, 0, 10);
  news(gw, "ladder_accepted", l.to, l.from);
  turn(gw, "ladder_accepted");
  lineFor(gw, l.from, "ladder_they_gave_way");
  for (const seat of seatsOf(gw, l.to)) {
    reason(gw, seat, "ladder_we_gave_way");
    moveRuler(gw, seat, "reputation", -1, "ladder_humbled");
  }
}

function refuse(gw: GreatWar, l: GwLadder): void {
  setStep(gw, l, "rejected");
  news(gw, "ladder_rejected", l.to, l.from);
  lineFor(gw, l.to, "ladder_we_refused");
  for (const seat of seatsOf(gw, l.from)) {
    reason(gw, seat, "ladder_they_refused");
    seat.scheduled.push({
      scene: GW_LADDER_REFUSED,
      chapter: gw.s.chapter + 1,
    });
  }
}

function backDown(gw: GreatWar, l: GwLadder): void {
  setStep(gw, l, "backed_down");
  const from = gw.nation(l.from);
  if (from !== null) from.authority = clampTo(from.authority - 10, 0, 100);
  gw.s.temp = clampTo(gw.s.temp - 2, 0, 10);
  news(gw, "ladder_backed_down", l.from, l.to);
  turn(gw, "ladder_backed_down");
  lineFor(gw, l.to, "ladder_they_backed_down");
  for (const seat of seatsOf(gw, l.from)) {
    moveRuler(gw, seat, "reputation", -1, "ladder_backed_down");
  }
}

/**
 * War: before the general war, the ladder lights it (the July chain if one is
 * open, else the war itself); then the two are put across from each other.
 */
function toWar(gw: GreatWar, l: GwLadder): void {
  setStep(gw, l, "war");
  if (gw.s.warChapter === null) {
    if (gw.s.chain !== null) closeChain(gw, "war");
    else {
      const topic = gw.s.crisis ?? "balkan";
      gw.s.chains.push({ topic, outcome: "war", chapter: gw.s.chapter });
      openWar(gw);
    }
  }
  const a = gw.nation(l.from);
  const b = gw.nation(l.to);
  if (a === null || b === null) return;
  if (b.side === null && a.side !== null) {
    enter(gw, l.to, other(a.side), "war_declared");
  } else if (a.side === null && b.side !== null) {
    enter(gw, l.from, other(b.side), "war_declared");
  } else if (a.side === null && b.side === null) {
    const side = naturalSide(gw, l.from) ?? "central";
    enter(gw, l.from, side, "war_declared");
    enter(gw, l.to, other(side), "war_declared");
  }
  news(gw, "ladder_war", l.from, l.to);
  lineFor(gw, l.from, "ladder_war");
  lineFor(gw, l.to, "ladder_war");
}

/** How much a country weighs: its armies' base bands. */
function weight(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null) return 0;
  return Object.values(n.base).reduce((a, b) => a + (b ?? 0), 0);
}

/** Its side's weight with it: friends who would come. */
function sideWeight(gw: GreatWar, tag: GwTag): number {
  const side = naturalSide(gw, tag);
  if (side === null) return weight(gw, tag);
  return gw.s.nations
    .filter((n) => !n.out && naturalSide(gw, n.tag) === side)
    .reduce((a, n) => a + weight(gw, n.tag), 0);
}

/** Percent an AI gives way: fear against pride, by its character. */
export function yieldOdds(gw: GreatWar, l: GwLadder): number {
  const to = gw.nation(l.to);
  if (to === null) return 0;
  const mine = weight(gw, l.to);
  const theirs = weight(gw, l.from);
  let odds = 30;
  if (mine < theirs) odds += 20;
  if (mine * 2 < theirs) odds += 15;
  if (sideWeight(gw, l.to) > sideWeight(gw, l.from)) odds -= 25;
  odds += { cautious: 20, opportunist: 5, principled: -10, hardline: -25 }[
    to.ai
  ];
  if (l.step === "mobilised") odds += 15;
  return clampTo(odds, 5, 90);
}

/** Chapter step: AI answers, and what nobody answered by the deadline. */
export function ladderStep(gw: GreatWar): void {
  const s = gw.s;
  for (const l of s.ladders) {
    if (!GW_LADDER_OPEN.includes(l.step) || l.chapter >= s.chapter) continue;
    const seatTo = seatsOf(gw, l.to).length > 0;
    const seatFrom = seatsOf(gw, l.from).length > 0;
    if (l.step === "sent" || l.step === "mobilised") {
      // A seat's card took its fallback when the chapter closed; this is the AI.
      if (seatTo) {
        if (l.step === "sent") refuse(gw, l);
        else toWar(gw, l);
        continue;
      }
      const roll = wwRoll(s.seed, P_LADDER, s.chapter, idHash(l.to)) % 100;
      if (roll < yieldOdds(gw, l)) giveWay(gw, l);
      else if (l.step === "mobilised") toWar(gw, l);
      else refuse(gw, l);
    } else if (l.step === "rejected" && !seatFrom) {
      backDown(gw, l);
    } else if (l.step === "rejected" && s.chapter - l.chapter > 1) {
      // The paper lay unanswered: the moment passed.
      backDown(gw, l);
    }
  }
}

// ---- Conditions: months of war and peace, the calendar month, the ladder ----

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

/** Whole months since chapter `from`, on the calendar's dates. */
function monthsSince(gw: GreatWar, from: number): number {
  const days = gwChapters(gw.s.calendar);
  const a = days[Math.max(0, Math.min(from, days.length - 1))].day;
  return Math.floor((days[gw.s.chapter].day - a) / 30);
}

export function monthsHold(
  gw: GreatWar,
  seat: GwSeatState,
  c: Extract<
    GwWorldCond,
    { is: "war_months" | "peace_months" | "month" | "ladder" }
  >,
): boolean {
  const s = gw.s;
  switch (c.is) {
    case "war_months": {
      if (c.own !== true)
        return s.warChapter !== null && inRange(warMonths(gw), c);
      const n = gw.nation(seat.tag);
      return (
        n !== null &&
        n.entered !== null &&
        inRange(monthsSince(gw, n.entered), c)
      );
    }
    case "peace_months": {
      const n = gw.nation(seat.tag);
      if (n === null || n.entered !== null || n.atWar.length > 0) return false;
      const last = s.chains[s.chains.length - 1];
      return (
        last !== undefined &&
        last.outcome !== "war" &&
        inRange(monthsSince(gw, last.chapter), c)
      );
    }
    case "month":
      return c.of.includes(civilFromDays(s.day).month);
    case "ladder":
      return s.ladders.some(
        (l) =>
          (c.role === undefined
            ? l.from === seat.tag || l.to === seat.tag
            : l[c.role] === seat.tag) &&
          (c.tag === undefined ||
            (l.from === seat.tag ? l.to : l.from) === c.tag) &&
          (c.of === undefined
            ? GW_LADDER_OPEN.includes(l.step)
            : c.of.includes(l.step)),
      );
  }
}
