import {
  GW_ALLY_GRACE,
  GW_LINES,
  GW_LOAN_EVERY,
  GW_LOAN_MAX,
  GW_OFFER_CHAPTERS,
  GW_TRUST_MAX,
  GW_TRUST_MIN,
  GwClause,
  GwSeatState,
  GwSide,
  GwTreaty,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import type { GreatWar } from "./GreatWar";
import { enter } from "./Wars";
import {
  clampTo,
  fights,
  moveGauge,
  news,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_LEAK = idHash("gw_treaty_leak");
const P_AI_TREATY = idHash("gw_treaty_ai");

/** The chance in a hundred, each chapter, that a signed treaty gets out. */
const LEAK_PCT = 4;
/** What breaking your word costs the head of state. */
const BREAK_AUTHORITY = 5;
const OFFERS_PER_CHAPTER = 3;

/**
 * Secret treaties (design §9): clauses, two signatures, then rules. Keeping
 * and breaking are read off the world each chapter, so a war declared by a
 * scene breaks a treaty as surely as the break order does.
 */

const partnerOf = (t: GwTreaty, tag: GwTag): GwTag =>
  t.from === tag ? t.to : t.from;

function moveTrust(gw: GreatWar, of: GwTag, about: GwTag, delta: number): void {
  const n = gw.nation(of);
  if (n === null) return;
  n.trust[about] = clampTo(
    (n.trust[about] ?? 0) + delta,
    GW_TRUST_MIN,
    GW_TRUST_MAX,
  );
}

function tellBoth(gw: GreatWar, t: GwTreaty, key: string): void {
  for (const tag of [t.from, t.to]) {
    for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
  }
}

function remember(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) {
    seat.memory.push({ key, who: null, chapter: gw.s.chapter, weight: 0 });
  }
}

function clauseOk(gw: GreatWar, t: GwTag, to: GwTag, c: GwClause): boolean {
  if (c.by !== t && c.by !== to) return false;
  switch (c.kind) {
    case "alliance":
    case "neutrality":
      return true;
    case "loan":
      return c.value >= 1 && c.value <= GW_LOAN_MAX;
    case "passage":
      return c.theatre !== null;
    case "territory":
      return c.theatre !== null && c.value < GW_LINES[c.theatre].length;
    case "entry": {
      const last = gwChapters(gw.s.calendar).length - 1;
      return c.value > gw.s.chapter && c.value <= last;
    }
  }
}

export function offerTreaty(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
  clauses: readonly GwClause[],
): GwOrderBlock | null {
  const s = gw.s;
  const n = gw.nation(seat.tag);
  const partner = gw.nation(to);
  if (to === seat.tag || n === null || partner === null) return "no_seat";
  if (n.atWar.includes(to)) return "at_war";
  if (clauses.some((c) => !clauseOk(gw, seat.tag, to, c))) return "bad_clause";
  const offered = s.treaties.filter(
    (t) => t.from === seat.tag && t.chapter === s.chapter,
  );
  if (offered.length >= OFFERS_PER_CHAPTER) return "too_many";
  s.treaties.push({
    uid: s.nextTreaty++,
    from: seat.tag,
    to,
    clauses: clauses.map((c) => ({ ...c })),
    state: "offered",
    chapter: s.chapter,
    signed: null,
    leaked: false,
    brokenBy: null,
    brokenAt: null,
    why: null,
    sides: [n.side, partner.side],
    waiting: null,
  });
  return null;
}

/** Passage is real strength in the theatre, for as long as the treaty stands. */
function passage(gw: GreatWar, t: GwTreaty, c: GwClause, delta: number): void {
  const n = gw.nation(partnerOf(t, c.by));
  if (n === null || c.theatre === null) return;
  n.base[c.theatre] = (n.base[c.theatre] ?? 0) + delta;
  n.strength[c.theatre] = (n.strength[c.theatre] ?? 0) + delta;
}

/** What a loan moves: false when the payer can't pay. */
function payLoan(gw: GreatWar, t: GwTreaty, c: GwClause): boolean {
  const payer = gw.nation(c.by);
  if (payer === null || payer.gauges.money < c.value) return false;
  moveGauge(gw, c.by, "money", -c.value, "treaty_loan_paid");
  moveGauge(gw, partnerOf(t, c.by), "money", c.value, "treaty_loan_got");
  return true;
}

/** The side a neutral AI party is promised for: its price goes up. */
function priceFor(gw: GreatWar, t: GwTreaty): void {
  for (const [buyer, seller] of [
    [t.from, t.to],
    [t.to, t.from],
  ] as const) {
    const side = gw.nation(buyer)?.side ?? null;
    const n = gw.nation(seller);
    if (side === null || n === null || n.side !== null) continue;
    if (ruledBySeat(gw, seller)) continue;
    const promised = t.clauses.filter(
      (c) => c.by === buyer && c.kind === "territory",
    ).length;
    if (promised > 0) {
      n.offers[side] = Math.max(n.offers[side] ?? 0, 2 + promised);
    }
  }
}

function signTreaty(gw: GreatWar, t: GwTreaty): void {
  t.state = "signed";
  t.signed = gw.s.chapter;
  t.sides = [gw.nation(t.from)!.side, gw.nation(t.to)!.side];
  for (const c of t.clauses) {
    if (c.kind === "passage") passage(gw, t, c, 1);
    if (c.kind === "loan" && !payLoan(gw, t, c)) {
      breakTreaty(gw, t, c.by, "loan_unpaid");
      return;
    }
  }
  priceFor(gw, t);
  moveTrust(gw, t.from, t.to, 1);
  moveTrust(gw, t.to, t.from, 1);
  tellBoth(gw, t, "treaty_signed");
}

/** Every AI country remembers; the wronged one remembers more (design §9). */
function breakTreaty(
  gw: GreatWar,
  t: GwTreaty,
  by: GwTag,
  why: string,
): void {
  const s = gw.s;
  const wronged = partnerOf(t, by);
  t.state = "broken";
  t.brokenBy = by;
  t.brokenAt = s.chapter;
  t.why = why;
  for (const c of t.clauses) {
    if (c.kind === "passage") passage(gw, t, c, -1);
  }
  moveTrust(gw, wronged, by, -3);
  for (const n of s.nations) {
    if (n.tag === by || n.tag === wronged || ruledBySeat(gw, n.tag)) continue;
    moveTrust(gw, n.tag, by, -1);
  }
  const n = gw.nation(by);
  if (n !== null) n.authority = clampTo(n.authority - BREAK_AUTHORITY, 0, 100);
  for (const seat of seatsOf(gw, by)) reason(gw, seat, "treaty_i_broke");
  for (const seat of seatsOf(gw, wronged)) reason(gw, seat, "treaty_broken");
  remember(gw, by, "treaty_i_broke");
  remember(gw, wronged, "treaty_broken");
  if (t.leaked) news(gw, "treaty_broken", by, wronged);
}

export function answerTreaty(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
  sign: boolean,
): GwOrderBlock | null {
  const t = gw.s.treaties.find((x) => x.uid === uid);
  if (t === undefined || t.state !== "offered" || t.to !== seat.tag) {
    return "no_treaty";
  }
  if (sign && gw.nation(t.from)?.atWar.includes(t.to) === true) return "at_war";
  if (sign) {
    signTreaty(gw, t);
  } else {
    t.state = "refused";
    tellBoth(gw, t, "treaty_refused");
  }
  return null;
}

export function breakOrder(
  gw: GreatWar,
  seat: GwSeatState,
  uid: number,
): GwOrderBlock | null {
  const t = gw.s.treaties.find((x) => x.uid === uid);
  if (t === undefined || t.state !== "signed") return "no_treaty";
  if (t.from !== seat.tag && t.to !== seat.tag) return "no_treaty";
  breakTreaty(gw, t, seat.tag, "broken_openly");
  return null;
}

/** Whether a signed treaty stops `tag` joining `side`: it must break it first. */
export function treatyBars(gw: GreatWar, tag: GwTag, side: GwSide): boolean {
  return gw.s.treaties.some((t) => {
    if (t.state !== "signed" || (t.from !== tag && t.to !== tag)) return false;
    const other = gw.nation(partnerOf(t, tag));
    if (other === null || other.side === null || other.side === side) {
      return false;
    }
    return t.clauses.some(
      (c) =>
        c.kind === "alliance" || (c.kind === "neutrality" && c.by === tag),
    );
  });
}

export function enterWar(
  gw: GreatWar,
  seat: GwSeatState,
  side: GwSide,
): GwOrderBlock | null {
  const n = gw.nation(seat.tag);
  if (gw.s.warChapter === null) return "no_war";
  if (n === null || n.side !== null || n.out) return "at_war";
  if (treatyBars(gw, seat.tag, side)) return "treaty_bars";
  enter(gw, seat.tag, side, "entered_war");
  return null;
}

/** What a clause is worth to an AI party: paying out counts against. */
function clauseValue(c: GwClause, ai: GwTag): number {
  const mine = c.by === ai;
  switch (c.kind) {
    case "loan":
      return (mine ? -20 : 15) * c.value;
    case "territory":
      return mine ? -25 : 15;
    case "passage":
      return mine ? -15 : 5;
    case "neutrality":
      return mine ? -5 : 10;
    case "entry":
      return mine ? -30 : 10;
    case "alliance":
      return -5;
  }
}

/** An AI country values an offer (design §10) with its trust and character. */
function aiWouldSign(gw: GreatWar, t: GwTreaty): boolean {
  const n = gw.nation(t.to);
  const from = gw.nation(t.from);
  if (n === null || from === null || n.out) return false;
  const roll = wwRoll(gw.s.seed, P_AI_TREATY, t.uid) % 21;
  let score = (n.trust[t.from] ?? 0) * 10 + roll - 10;
  for (const c of t.clauses) score += clauseValue(c, t.to);
  if (n.side !== null && n.side === from.side) score += 15;
  score += { opportunist: 10, hardline: -5, cautious: -10, principled: 0 }[
    n.ai
  ];
  return score >= 10;
}

/** Offers to AI countries are answered; offers left alone lapse. */
function settleOffers(gw: GreatWar): void {
  const s = gw.s;
  for (const t of s.treaties) {
    if (t.state !== "offered") continue;
    if (seatsOf(gw, t.to).length === 0) {
      if (aiWouldSign(gw, t)) {
        signTreaty(gw, t);
      } else {
        t.state = "refused";
        tellBoth(gw, t, "treaty_refused");
      }
    } else if (s.chapter - t.chapter >= GW_OFFER_CHAPTERS - 1) {
      t.state = "lapsed";
      tellBoth(gw, t, "treaty_lapsed");
    }
  }
}

/** Who moved to make the parties enemies: the one whose side is new. */
function whoMoved(gw: GreatWar, t: GwTreaty): GwTag {
  const newTo = t.sides[1] === null && gw.nation(t.to)!.side !== null;
  const newFrom = t.sides[0] === null && gw.nation(t.from)!.side !== null;
  return newTo && !newFrom ? t.to : t.from;
}

/** An AI or regent keeps its word: it comes in at its partner's side. */
function honour(gw: GreatWar, tag: GwTag, side: GwSide): boolean {
  if (ruledBySeat(gw, tag) || gw.nation(tag)?.side !== null) return false;
  if (gw.s.warChapter === null) return false;
  enter(gw, tag, side, "entered_war");
  return true;
}

function checkAlliance(gw: GreatWar, t: GwTreaty): boolean {
  const a = gw.nation(t.from)!;
  const b = gw.nation(t.to)!;
  if (a.atWar.includes(t.to)) {
    breakTreaty(gw, t, whoMoved(gw, t), "fought_partner");
    return false;
  }
  if (fights(a) === fights(b)) {
    t.waiting = null;
    return true;
  }
  const late = fights(a) ? b : a;
  const side = (fights(a) ? a : b).side!;
  if (late.out || honour(gw, late.tag, side)) {
    t.waiting = null;
    return true;
  }
  t.waiting ??= gw.s.chapter;
  if (gw.s.chapter - t.waiting < GW_ALLY_GRACE) return true;
  breakTreaty(gw, t, late.tag, "ally_stayed_out");
  return false;
}

function checkClause(gw: GreatWar, t: GwTreaty, c: GwClause): boolean {
  const s = gw.s;
  const partner = partnerOf(t, c.by);
  const by = gw.nation(c.by)!;
  const other = gw.nation(partner)!;
  switch (c.kind) {
    case "alliance":
      return checkAlliance(gw, t);
    case "neutrality":
      if (!by.atWar.includes(partner)) return true;
      breakTreaty(gw, t, c.by, "fought_partner");
      return false;
    case "loan": {
      const due = s.chapter - t.signed!;
      if (due <= 0 || due % GW_LOAN_EVERY !== 0) return true;
      if (payLoan(gw, t, c)) return true;
      breakTreaty(gw, t, c.by, "loan_unpaid");
      return false;
    }
    case "entry": {
      if (s.chapter !== c.value || other.side === null) return true;
      if (by.side === other.side || honour(gw, c.by, other.side)) return true;
      breakTreaty(gw, t, c.by, "entry_late");
      return false;
    }
    case "passage":
    case "territory":
      return true;
  }
}

function leak(gw: GreatWar, t: GwTreaty): void {
  const s = gw.s;
  t.leaked = true;
  news(gw, "treaty_leaked", t.from, t.to);
  turn(gw, "treaty_leaked");
  for (const n of s.nations) {
    if (n.tag === t.from || n.tag === t.to || ruledBySeat(gw, n.tag)) continue;
    moveTrust(gw, n.tag, t.from, -1);
    moveTrust(gw, n.tag, t.to, -1);
  }
  if (s.warChapter === null) s.temp = clampTo(s.temp + 1, 0, 10);
}

/** Chapter step: offers answered, clauses read against the world, leaks. */
export function treatyStep(gw: GreatWar): void {
  const s = gw.s;
  settleOffers(gw);
  for (const t of s.treaties) {
    if (t.state !== "signed") continue;
    for (const c of t.clauses) {
      if (!checkClause(gw, t, c)) break;
    }
    if (t.state !== "signed") continue;
    t.sides = [gw.nation(t.from)!.side, gw.nation(t.to)!.side];
    if (t.leaked) continue;
    if (wwRoll(s.seed, P_LEAK, t.uid, s.chapter) % 100 < LEAK_PCT) leak(gw, t);
  }
}

/** The promised line, judged when the game closes. */
export function closeTreaties(gw: GreatWar): void {
  for (const t of gw.s.treaties) {
    if (t.state !== "signed") continue;
    for (const c of t.clauses) {
      if (c.kind !== "territory" || c.theatre === null) continue;
      const th = gw.s.theatres.find((x) => x.id === c.theatre);
      if (th === undefined || th.line === c.value) continue;
      breakTreaty(gw, t, c.by, "territory_unmet");
      break;
    }
  }
}

/** A price on side's name: every broken word by its seats counts against it. */
export function brokenWords(gw: GreatWar, side: GwSide): number {
  return gw.s.treaties.filter(
    (t) =>
      t.state === "broken" &&
      t.brokenBy !== null &&
      gw.nation(t.brokenBy)?.side === side,
  ).length;
}
