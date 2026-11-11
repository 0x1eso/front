// Great War 1914 (ww170 S3, design ww168 B4): scenes by state, and the crisis
// ladder. The July chain stays the first crisis; after it a seat can send a
// note from the 통치 tab to any country it could fight (ww171 phase 4: a pair
// that shares a front, not in one coalition, not bound by a treaty), and an
// AI sends its own by its state (PairWar.aiWarStep). The ladder is the same
// as July's, shorter: the note, the answer, mobilisation, then war or a
// climb-down. The war is the pair's (Wars.declareWar): the coalitions and the
// treaties make of it what they will.
//
// Steps run as a chapter closes:
// - `sent`: the other side answers. A seat answers on a card it is dealt the
//   chapter the note goes out (`gw_ladder_note`); an AI by its character,
//   strength and friends, with a seeded roll.
// - `rejected`: the sender's card (`gw_ladder_refused`) says mobilise or climb
//   down; an AI sender presses by its character and strength.
// - `mobilised`: one last chance (`gw_ladder_last` to a seat), then war.
// Every step writes the seat's reason lines and the world's news.
import {
  GW_LADDER_OPEN,
  GwLadder,
  GwLadderStep,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_LADDER_LAST,
  GW_LADDER_NOTE,
  GW_LADDER_REACH,
  GW_LADDER_REFUSED,
} from "@openfront/engine-lib/ww1914/content/ladder";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { moveRuler } from "./Ruler";
import { reachable } from "./Tables";
import { treatyAllies } from "./Treaties";
import { declareWar, naturalSide, startAllies } from "./Wars";
import {
  clampTo,
  monthsFrom,
  news,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_LADDER = idHash("gw_ladder");
const P_PRESS = idHash("gw_ladder_press");

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
 * Two countries one of which could go to war on the other (design ww168 B5):
 * they share a front, they aren't in one coalition, and no treaty binds them
 * (a starting alliance, or a signed alliance or neutrality).
 */
export function canFight(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  const na = gw.nation(a);
  const nb = gw.nation(b);
  if (na === null || nb === null || na.out || nb.out) return false;
  if (!reachable(a, b)) return false;
  if (na.side !== null && na.side === nb.side) return false;
  return !startAllies(a, b, true) && !treatyAllies(gw, a, b);
}

/**
 * Whom `from` may send a note to now: a country it could fight that it is not
 * at war with. Neither side may be in another ladder. A seat sends only to
 * the countries its tab lists (GW_LADDER_REACH).
 */
export function ladderTargets(gw: GreatWar, from: GwTag): GwTag[] {
  const me = gw.nation(from);
  if (me === null || me.out || openLadder(gw, from) !== null) return [];
  const seat = ruledBySeat(gw, from);
  const out: GwTag[] = [];
  for (const n of gw.s.nations) {
    if (n.tag === from || me.atWar.includes(n.tag)) continue;
    if (seat && !GW_LADDER_REACH.includes(n.tag)) continue;
    if (openLadder(gw, n.tag) !== null) continue;
    if (canFight(gw, from, n.tag)) out.push(n.tag);
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
  if (sendNote(gw, seat.tag, to)) reason(gw, seat, "ladder_sent");
}

/** `from` sends `to` a note, a seat's or an AI's; false when it can't. */
export function sendNote(gw: GreatWar, from: GwTag, to: GwTag): boolean {
  if (!ladderTargets(gw, from).includes(to)) return false;
  const l: GwLadder = {
    from,
    to,
    step: "sent",
    opened: gw.s.chapter,
    chapter: gw.s.chapter,
  };
  gw.s.ladders.push(l);
  gw.s.temp = clampTo(gw.s.temp + 1, 0, 10);
  news(gw, "ladder_sent", from, to);
  turn(gw, "ladder_sent");
  for (const t of seatsOf(gw, to)) {
    t.scheduled.push({ scene: GW_LADDER_NOTE, chapter: gw.s.chapter + 1 });
  }
  return true;
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
  press(gw, l);
}

/** The sender mobilises: one last chance for the other, then war. */
function press(gw: GreatWar, l: GwLadder): void {
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
 * War: the sender declares it (Wars.declareWar). Between two powers of
 * opposite camps before the general war, that is the general war; otherwise
 * the pair's own, and the treaties make of it what they will.
 */
function toWar(gw: GreatWar, l: GwLadder): void {
  setStep(gw, l, "war");
  if (gw.s.warChapter === null && gw.s.chain === null) {
    const topic = gw.s.crisis ?? "balkan";
    const was = gw.s.warChapter;
    declareWar(gw, l.from, l.to, "ladder");
    if (was === null && gw.s.warChapter !== null) {
      gw.s.chains.push({ topic, outcome: "war", chapter: gw.s.chapter });
    }
  } else {
    declareWar(gw, l.from, l.to, "ladder");
  }
  news(gw, "ladder_war", l.from, l.to);
  lineFor(gw, l.from, "ladder_war");
  lineFor(gw, l.to, "ladder_war");
}

/** The ladder a seat's own war row closes: its note to `to`, refused. */
export function closeLadder(gw: GreatWar, from: GwTag, to: GwTag): void {
  const l = gw.s.ladders.find(
    (x) =>
      GW_LADDER_OPEN.includes(x.step) &&
      ((x.from === from && x.to === to) || (x.from === to && x.to === from)),
  );
  if (l !== undefined) setStep(gw, l, "war");
}

/**
 * Percent an AI sender presses on after a refusal: its character, and who is
 * the stronger with friends counted.
 */
export function pressOn(gw: GreatWar, l: GwLadder): number {
  const from = gw.nation(l.from);
  if (from === null) return 0;
  let odds = { hardline: 70, opportunist: 55, principled: 45, cautious: 25 }[
    from.ai
  ];
  odds += sideWeight(gw, l.from) > sideWeight(gw, l.to) ? 15 : -15;
  if (from.atWar.length > 0) odds -= 20;
  return clampTo(odds, 5, 90);
}

/**
 * How much a country weighs: its two strongest armies and the men behind
 * them (ww171: not the sum of every front it could stand on, which made a
 * country of many small fronts look like a great power).
 */
export function weight(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null) return 0;
  const bands = Object.values(n.base)
    .map((b) => b ?? 0)
    .sort((a, b) => b - a);
  return (bands[0] ?? 0) + (bands[1] ?? 0) + Math.floor(n.manpower / 20);
}

/** Its side's weight with it: friends who would come. */
export function sideWeight(gw: GreatWar, tag: GwTag): number {
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
      const roll = wwRoll(s.seed, P_PRESS, s.chapter, idHash(l.from)) % 100;
      if (roll < pressOn(gw, l)) press(gw, l);
      else backDown(gw, l);
    } else if (l.step === "rejected" && s.chapter - l.chapter > 1) {
      // The paper lay unanswered: the moment passed.
      backDown(gw, l);
    }
  }
}

// ---- Conditions: months of war and peace, the calendar month, the ladder ----

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

const monthsSince = monthsFrom;

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
    case "ladder": {
      const me = c.nation ?? seat.tag;
      return s.ladders.some(
        (l) =>
          (c.role === undefined
            ? l.from === me || l.to === me
            : l[c.role] === me) &&
          (c.tag === undefined || (l.from === me ? l.to : l.from) === c.tag) &&
          (c.of === undefined
            ? GW_LADDER_OPEN.includes(l.step)
            : c.of.includes(l.step)),
      );
    }
  }
}
