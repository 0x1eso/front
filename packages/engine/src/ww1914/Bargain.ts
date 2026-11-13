// Great War 1914 (ww205): a table of one beaten country, as the owner asked
// for it: each victor lays down one whole proposal (every place and its fate
// at once), the beaten answers place by place with its reason in words, and
// they bargain over what was refused for a few rounds. Accepted places are
// fixed; for each refused one the victor insists, steps down (annex → occupy
// → vassal → return), asks for another place in its stead, or lets it go.
// Push too hard or too long and the beaten walks out, and the war goes on
// (Trotsky at Brest-Litovsk, 10 February 1918; the German advance from the
// 18th). Every answer is read off the state: the beaten's character, the
// strength it has left, its allies still fighting. Nothing is rolled.
// The general conference keeps its claim-by-claim talk (Table.ts).
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwFate,
  GwFateMark,
  GwFateTerm,
} from "@openfront/engine-api/ww1914/GwFate";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwBargainMove,
  GwTableClaim,
  GwTableDue,
  GwTableMood,
  GwTableState,
  GwTableView,
  GwTableWhy,
} from "@openfront/engine-api/ww1914/GwTable";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import {
  GW_TABLE_AIMS,
  GW_TABLE_HEART,
} from "@openfront/engine-lib/ww1914/TableRows";
import { aiPartnerWord, markOf, record } from "./Fate";
import type { GreatWar } from "./GreatWar";
import { holderOf, moveLand } from "./Land";
import {
  againstOf,
  claimsMade,
  give,
  hasSeat,
  leverage,
  onTable,
  pickFor,
  placeCost,
  put,
  resultLines,
  rowOf,
  say,
  word,
  wordsFor,
} from "./Table";
import { weariness } from "./Terms";
import { resumeWar } from "./Wars";
import { clampTo, news, reason, seatsOf } from "./World";

/** Proposals a victor may lay down: the first and three more. */
export const GW_TALK_ROUNDS = 4;
/** What the beaten gives up, in hundredths of annexing it, by fate. */
const WEIGHT = {
  annex: 100,
  ally: 100,
  state: 75,
  vassal: 60,
  occupy_long: 50,
  occupy_short: 35,
  return: 0,
} as const;
/** How hard the beaten is to move, by its character. */
const CHARACTER = {
  hardline: 10,
  principled: 5,
  opportunist: 0,
  cautious: -10,
} as const;
/** Allies still fighting stiffen it. */
const ALLIES_FIGHT = 10;
/** Each insistence moves it this much, at the price of strain. */
const INSIST_WORTH = 10;
/** A country that walked out once comes back to a harder table. */
const WALKED_BEFORE = 10;
/** Strain: each proposal after the first, and each insistence in it. */
const STRAIN_ROUND = 1;
const STRAIN_INSIST = 2;
/** Strain the beaten bears before it walks out, by character. */
const WALK_AT = {
  hardline: 6,
  opportunist: 7,
  principled: 8,
  cautious: 9,
} as const;
/** Allies still fighting make the door nearer; a worn country bears more. */
const WALK_ALLIES = 2;
const WALK_TIRED = 6;
/** Places given past which "too much" is the reason. */
const MUCH = 3;
/** A worn country says it can't go on. */
const TIRED = 12;
// ---- ww210 (S2): the new moves ----
/** A promise to leave, or to let the people vote, falls due after this. */
const PROMISE_CHAPTERS = 12;
/** What a promise leaves of the fate's weight, in hundredths. */
const PROMISE_WEIGHT = { promise_leave: 50, promise_vote: 75 } as const;
/** An ultimatum the beaten believes moves it this much. */
const ULTIMATUM_WORTH = 20;
/** A ransom in money steps: one for each this many hundredths of weight. */
const RANSOM_PER = 35;
const RANSOM_MOST = 3;
/** Moves that leave the place with the beaten: a trade, not a cession. */
const TRADES: readonly GwBargainMove[] = [
  "ransom",
  "favour_neutral",
  "favour_trade",
];

type Talk = NonNullable<GwTableState["talk"]>;

const tableOf = (gw: GreatWar) => gw.s.table!;
const talkOf = (gw: GreatWar): Talk => tableOf(gw).talk!;

/** A table of one beaten country starts its talk. */
export function startTalk(t: GwTableState): void {
  t.talk = { rounds: {}, strain: {}, walked: [] };
}

/** The beaten at a talk; null where nobody is. */
export function beatenOf(t: GwTableState): GwTag | null {
  const p = t.pair;
  if (p === undefined || p.winner === null) return null;
  return p.winner === p.a ? p.b : p.a;
}

/** Proposals each victor may make: one more after a ruler pressed on. */
const roundsOf = (t: GwTableState) => GW_TALK_ROUNDS + (t.extra ?? 0);

const openOf = (t: GwTableState, by: GwTag) =>
  t.claims.filter((c) => c.by === by && c.state === "open");

/** Whose proposal is on the table: the first victor not finished. */
function claimantOf(gw: GreatWar): GwTag | null {
  const t = tableOf(gw);
  const beaten = beatenOf(t);
  for (const x of t.order) {
    if (x === beaten) continue;
    if (t.talk!.rounds[x] === undefined || openOf(t, x).length > 0) return x;
  }
  return null;
}

/** What `by` may ask for at this talk now: the beaten's land in reach. */
function askable(gw: GreatWar, by: GwTag): GwPlace[] {
  const t = tableOf(gw);
  return GW_PLACE_KEYS.filter(
    (p) => !onTable(t, p) && againstOf(gw, by, p) !== null,
  );
}

/** What a seat's proposal holds: its land back and every place it painted. */
function seatPlaces(gw: GreatWar, seat: GwSeatState): GwPlace[] {
  return askable(gw, seat.tag).filter(
    (p) => GW_PLACES[p].owner === seat.tag || markOf(seat, p) !== null,
  );
}

/** A victor lays down its whole proposal. */
function propose(gw: GreatWar, by: GwTag): void {
  const t = tableOf(gw);
  const talk = t.talk!;
  talk.rounds[by] = 1;
  say(t, "propose", by, -1);
  const seat = hasSeat(gw, by) ? seatsOf(gw, by)[0] : undefined;
  if (seat !== undefined) {
    for (const p of seatPlaces(gw, seat)) {
      put(gw, by, p, againstOf(gw, by, p)!, 1);
    }
    return;
  }
  // A government nobody plays: what it wants, as much as its character asks.
  for (let guard = 0; guard < 64; guard++) {
    const p = pickFor(gw, by);
    if (p === null) break;
    put(gw, by, p, againstOf(gw, by, p)!, 1);
  }
}

/** The beaten's allies still fight on: the war isn't over for its side. */
function alliesFight(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || n.side === null || gw.s.armistice !== null) return false;
  return gw.s.nations.some(
    (x) => x.tag !== tag && x.side === n.side && !x.out && x.atWar.length > 0,
  );
}

const weightOf = (c: GwTableClaim): number => {
  const f = c.fate ?? "annex";
  if (f === "occupy") {
    return c.term === "long" ? WEIGHT.occupy_long : WEIGHT.occupy_short;
  }
  return WEIGHT[f];
};

/**
 * The beaten's answer to one place, and why: from what the victor can bring
 * to bear, what the place costs it under this fate, its character, its
 * allies. A capital is never annexed, given away, or made a state.
 */
export function answerOf(
  gw: GreatWar,
  c: GwTableClaim,
): { yes: boolean; why: GwTableWhy } {
  const fate = c.fate ?? "annex";
  const owner = GW_PLACES[c.place].owner;
  if (fate === "return" || owner === c.by) return { yes: true, why: "return" };
  if (c.move !== undefined && TRADES.includes(c.move)) {
    return tradeAnswer(gw, c);
  }
  const capital = GW_CAPITALS[owner] === c.place;
  if (capital && (fate === "annex" || fate === "ally" || fate === "state")) {
    return { yes: false, why: "capital" };
  }
  const n = gw.nation(c.against);
  const allies = alliesFight(gw, c.against);
  const walked = (gw.s.walkedOut ?? []).includes(c.against);
  // ww210: an ultimatum it believes; a bluff it reads by its character.
  const pressed =
    c.move === "ultimatum" && c.ultimatum !== undefined && !bluffRead(gw, c)
      ? ULTIMATUM_WORTH
      : 0;
  const lev =
    leverage(gw, c) +
    (c.insisted ?? 0) * INSIST_WORTH +
    (walked ? WALKED_BEFORE : 0) -
    (allies ? ALLIES_FIGHT : 0) +
    pressed;
  const full = placeCost(gw, c) + (n === null ? 0 : CHARACTER[n.ai]);
  const promised =
    c.move === "promise_leave" || c.move === "promise_vote"
      ? PROMISE_WEIGHT[c.move]
      : 100;
  const cost = Math.trunc((full * weightOf(c) * promised) / 10_000);
  if (lev >= cost) {
    if (fate !== "annex" && fate !== "ally" && lev < full) {
      return { yes: true, why: "soft" };
    }
    if (holderOf(gw, c.place) === c.by) return { yes: true, why: "held" };
    if (n !== null && weariness(n) >= TIRED) return { yes: true, why: "tired" };
    return { yes: true, why: "beaten" };
  }
  if ((c.insisted ?? 0) > 0) return { yes: false, why: "again" };
  if (GW_TABLE_HEART[owner]?.includes(GW_PLACES[c.place].group) === true) {
    return { yes: false, why: "heart" };
  }
  if (fate === "ally") return { yes: false, why: "to_ally" };
  if (allies) return { yes: false, why: "allies" };
  if (claimsMade(tableOf(gw), c.by) >= MUCH) return { yes: false, why: "much" };
  return { yes: false, why: "army" };
}

/**
 * ww210: a trade for the place (ransom, neutrality, trade terms): the land
 * stays with the beaten, so it weighs only whether it can pay or promise.
 */
function tradeAnswer(
  gw: GreatWar,
  c: GwTableClaim,
): { yes: boolean; why: GwTableWhy } {
  const n = gw.nation(c.against);
  if (c.move === "ransom") {
    const can = n !== null && n.gauges.money >= (c.ransom ?? 1);
    return can ? { yes: true, why: "soft" } : { yes: false, why: "army" };
  }
  if (c.move === "favour_neutral" && alliesFight(gw, c.against)) {
    return { yes: false, why: "allies" };
  }
  return { yes: true, why: "soft" };
}

/**
 * ww210: the beaten reads an ultimatum as a bluff when the victor is too
 * weary to march again, if its character is hard enough to call it.
 */
function bluffRead(gw: GreatWar, c: GwTableClaim): boolean {
  const by = gw.nation(c.by);
  const it = gw.nation(c.against);
  if (by === null || it === null) return false;
  const hard = it.ai === "hardline" || it.ai === "principled";
  return hard && weariness(by) >= TIRED;
}

/** ww210: a ransom's steps of money, by the weight of what it buys off. */
const ransomOf = (c: GwTableClaim): number =>
  clampTo(Math.ceil(weightOf(c) / RANSOM_PER), 1, RANSOM_MOST);

/** ww210: the fates lighter than the claim's, heaviest first (the counters). */
function lighterOf(c: GwTableClaim): GwFate[] {
  const out: GwFate[] = [];
  let x: GwTableClaim = { ...c };
  for (let guard = 0; guard < 6; guard++) {
    const was = x.fate ?? "annex";
    if (was === "return") break;
    x = { ...x };
    stepDown(x);
    const f = x.fate ?? "annex";
    if (f === was) break;
    if (f !== "return" && !out.includes(f)) out.push(f);
  }
  return out;
}

/**
 * ww210: a government nobody plays names its own fate for a place it
 * refuses: the heaviest lighter fate it would take.
 */
function aiCounter(gw: GreatWar, c: GwTableClaim): void {
  for (const f of lighterOf(c)) {
    const x: GwTableClaim = { ...c, fate: f };
    if (f === "occupy") x.term = "short";
    else delete x.term;
    delete x.move;
    if (!answerOf(gw, x).yes) continue;
    c.counter = f === "occupy" ? { fate: f, term: "short" } : { fate: f };
    return;
  }
  delete c.counter;
}

/** ww210: a trade taken: the land stays, the beaten pays or promises. */
function settleTrade(gw: GreatWar, c: GwTableClaim): void {
  const t = tableOf(gw);
  c.state = "traded";
  if (c.move === "ransom") {
    c.offer = "reparations";
    t.bill[c.against] = (t.bill[c.against] ?? 0) + (c.ransom ?? 1);
  } else if (c.move === "favour_neutral") {
    c.offer = "guarantee";
    const n = gw.nation(c.against);
    if (n !== null) n.trust[c.by] = clampTo((n.trust[c.by] ?? 0) + 1, -3, 3);
  } else {
    c.offer = "port";
  }
  c.offerBy = c.against;
  say(t, "traded", c.against, c.id);
  resultLines(gw, c, "traded");
}

/** A place refused to the last: it stays with the beaten. */
function refuseFinal(gw: GreatWar, c: GwTableClaim): void {
  c.state = "refused";
  say(tableOf(gw), "hold", c.against, c.id);
  resultLines(gw, c, "refused");
}

/**
 * The beaten answers a proposal place by place: by the state, or as its
 * seat said (`said`: claim id -> yes). After the last round what is still
 * refused stays refused.
 */
function answerAll(
  gw: GreatWar,
  by: GwTag,
  said: ReadonlyMap<number, boolean> | null,
): void {
  const t = tableOf(gw);
  const asked = openOf(t, by).filter((c) => c.step === "asked");
  for (const c of asked) {
    const a =
      said === null
        ? answerOf(gw, c)
        : { yes: said.get(c.id) === true, why: undefined };
    if (a.why === undefined) delete c.why;
    else c.why = a.why;
    if (a.yes) {
      if (c.move !== undefined && TRADES.includes(c.move)) settleTrade(gw, c);
      else give(gw, c, "agreed");
    } else {
      c.step = "refused";
      say(t, "no", c.against, c.id);
      // ww210: an ultimatum refused: the advance resumes, unless it was a
      // bluff the victor can't carry out; then the place goes.
      if (c.move === "ultimatum" && c.ultimatum !== undefined) {
        if (!bluffRead(gw, c) && canWalk(gw, c.against)) {
          walkOut(gw, c.against);
          return;
        }
        c.state = "dropped";
        say(t, "drop", c.by, c.id);
        resultLines(gw, c, "dropped");
        continue;
      }
      if (said === null) aiCounter(gw, c);
    }
  }
  if ((t.talk!.rounds[by] ?? 0) < roundsOf(t)) return;
  for (const c of openOf(t, by)) if (c.step === "refused") refuseFinal(gw, c);
}

/** How much strain the beaten bears before it walks out. */
function walkLimit(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null) return WALK_AT.cautious;
  return (
    WALK_AT[n.ai] +
    Math.trunc(weariness(n) / WALK_TIRED) -
    (alliesFight(gw, tag) ? WALK_ALLIES : 0)
  );
}

/** It may still walk out: in the war's time, and once a country. */
function canWalk(gw: GreatWar, tag: GwTag): boolean {
  return (
    gw.s.armistice === null &&
    tableOf(gw).pair !== undefined &&
    !(gw.s.walkedOut ?? []).includes(tag)
  );
}

/**
 * The beaten leaves the room. No treaty: nothing agreed moves, the table
 * closes, and the war with those across the table begins again.
 */
export function walkOut(gw: GreatWar, beaten: GwTag): void {
  const t = tableOf(gw);
  const talk = t.talk!;
  talk.walked.push(beaten);
  (gw.s.walkedOut ??= []).push(beaten);
  say(t, "walk", beaten, -1);
  for (const c of t.claims) {
    if (c.against !== beaten) continue;
    if (c.state === "open" || c.state === "agreed" || c.state === "imposed") {
      c.state = "refused";
    }
  }
  const foes = t.order.filter((x) => x !== beaten);
  news(gw, "table_walked", beaten, foes[0] ?? null);
  t.done = true;
  t.closed = true;
  const row = rowOf(gw, t);
  if (row !== null) row.signed = gw.s.chapter;
  resumeWar(gw, beaten, foes, "table_walked_war");
  for (const tag of t.order) {
    for (const seat of seatsOf(gw, tag)) {
      reason(gw, seat, tag === beaten ? "table_walked_out" : "table_walked");
    }
  }
  gw.touch();
}

const STEP_DOWN: Readonly<Record<string, GwFateMark>> = {
  annex: { fate: "occupy", term: "long" },
  ally: { fate: "occupy", term: "long" },
  state: { fate: "occupy", term: "long" },
  occupy: { fate: "vassal" },
  vassal: { fate: "return" },
};

/** One step down for a refused place: annex → occupy → vassal → return. */
export function stepDown(c: GwTableClaim): void {
  const next = STEP_DOWN[c.fate ?? "annex"];
  if (next === undefined) return;
  c.fate = next.fate;
  delete c.for;
  delete c.client;
  if (next.term === undefined) delete c.term;
  else c.term = next.term;
}

/** The mark a place asked in another's stead goes with. */
function tradeMark(
  gw: GreatWar,
  by: GwTag,
  place: GwPlace,
  was: GwTableClaim,
): GwFateMark {
  const seat = hasSeat(gw, by) ? seatsOf(gw, by)[0] : undefined;
  const painted = seat === undefined ? null : markOf(seat, place);
  if (painted !== null) return painted;
  const f = was.fate ?? "annex";
  if (f === "state" || f === "ally") return { fate: "occupy", term: "long" };
  return was.term === undefined ? { fate: f } : { fate: f, term: was.term };
}

export interface GwBargainPick {
  move: GwBargainMove;
  place: GwPlace | null;
}

/**
 * The victor's moves on the refused places, then the proposal goes in
 * again. A refused place with no move is insisted on.
 */
function bargain(
  gw: GreatWar,
  by: GwTag,
  moves: ReadonlyMap<number, GwBargainPick>,
): void {
  const t = tableOf(gw);
  const talk = t.talk!;
  const round = (talk.rounds[by] ?? 1) + 1;
  const beaten = beatenOf(t);
  let strain = 0;
  let again = 0;
  for (const c of openOf(t, by)) {
    if (c.step !== "refused") continue;
    const m = moves.get(c.id) ?? { move: "insist", place: null };
    switch (m.move) {
      case "insist":
        c.insisted = (c.insisted ?? 0) + 1;
        strain += STRAIN_INSIST;
        break;
      case "down":
        stepDown(c);
        break;
      case "trade": {
        const place = m.place;
        c.state = "dropped";
        say(t, "drop", by, c.id);
        resultLines(gw, c, "dropped");
        if (place === null || !askable(gw, by).includes(place)) continue;
        const mark = tradeMark(gw, by, place, c);
        const n = put(gw, by, place, againstOf(gw, by, place)!, round);
        if (n.state === "open") {
          n.fate = mark.fate;
          if (mark.for !== undefined) n.for = mark.for;
          else delete n.for;
          if (mark.client !== undefined) n.client = mark.client;
          else delete n.client;
          if (mark.term !== undefined) n.term = mark.term;
          else delete n.term;
          again++;
        }
        continue;
      }
      case "drop":
        c.state = "dropped";
        say(t, "drop", by, c.id);
        resultLines(gw, c, "dropped");
        continue;
      // ---- ww210 ----
      case "counter": {
        const k = c.counter;
        if (k === undefined) {
          c.insisted = (c.insisted ?? 0) + 1;
          strain += STRAIN_INSIST;
          break;
        }
        c.move = "counter";
        c.fate = k.fate;
        delete c.for;
        delete c.client;
        if (k.term === undefined) delete c.term;
        else c.term = k.term;
        give(gw, c, "agreed");
        continue;
      }
      case "ransom":
        c.move = "ransom";
        c.ransom = ransomOf(c);
        break;
      case "promise_leave":
      case "promise_vote":
        c.move = m.move;
        c.fate = "occupy";
        c.term = "short";
        delete c.for;
        delete c.client;
        c.due = gw.s.chapter + PROMISE_CHAPTERS;
        break;
      case "ultimatum":
        c.move = "ultimatum";
        c.ultimatum = round;
        strain += STRAIN_INSIST;
        break;
      case "favour_neutral":
      case "favour_trade":
        c.move = m.move;
        break;
      case "split":
        if (c.fate !== "state" || c.client === undefined) {
          c.insisted = (c.insisted ?? 0) + 1;
          strain += STRAIN_INSIST;
          break;
        }
        // A separate table with the breakaway (the Bread Peace): the place
        // leaves the beaten's count, and the beaten's strain rises.
        c.move = "split";
        give(gw, c, "imposed");
        strain += STRAIN_INSIST;
        continue;
    }
    c.step = "asked";
    c.round = round;
    again++;
  }
  talk.rounds[by] = round;
  if (again === 0 || beaten === null) return;
  talk.strain[beaten] = (talk.strain[beaten] ?? 0) + STRAIN_ROUND + strain;
  say(t, "propose", by, -1);
}

/**
 * What a government nobody plays does with a refused place: its character.
 * A hard man insists once on one place a round, the one it wants most.
 */
function aiMove(
  gw: GreatWar,
  by: GwTag,
  c: GwTableClaim,
  insisting: boolean,
): GwBargainMove {
  const n = gw.nation(by);
  const fate = c.fate ?? "annex";
  if (n === null || fate === "return") return "drop";
  // ww210: the beaten named its own fate: all but a hard man take it.
  if (c.counter !== undefined && n.ai !== "hardline") return "counter";
  switch (n.ai) {
    case "hardline": {
      const wanted =
        (GW_TABLE_AIMS[by] ?? []).includes(c.place) ||
        holderOf(gw, c.place) === by;
      const once = (c.insisted ?? 0) === 0 && c.why !== "capital";
      return wanted && once && !insisting ? "insist" : "down";
    }
    case "opportunist":
      return "down";
    case "principled":
      return fate === "annex" ? "down" : "drop";
    case "cautious":
      return (c.round ?? 1) >= 2 ? "drop" : "down";
  }
}

/**
 * One thing happens at the talk; false when it waits for a seat. `force`:
 * the month is out, and the delegations finish it (a seat's refused places
 * stay refused).
 */
export function stepTalk(gw: GreatWar, force: boolean): boolean {
  const t = tableOf(gw);
  const beaten = beatenOf(t);
  const x = claimantOf(gw);
  if (x === null || beaten === null) {
    t.done = true;
    if (t.order.length > 0) say(t, "close", t.order[0], -1);
    return true;
  }
  if (t.talk!.rounds[x] === undefined) {
    if (hasSeat(gw, x) && !force) return false;
    propose(gw, x);
    return true;
  }
  const mine = openOf(t, x);
  const partner = mine.find((c) => c.step === "partner");
  if (partner !== undefined) {
    const who = partner.partner ?? partner.against;
    if (hasSeat(gw, who) && !force) return false;
    word(gw, partner, who, aiPartnerWord(gw, who, partner), null);
    return true;
  }
  if (mine.some((c) => c.step === "asked")) {
    const seat = hasSeat(gw, beaten);
    if (seat && !force) return false;
    const strain = t.talk!.strain[beaten] ?? 0;
    if (!seat && canWalk(gw, beaten) && strain > walkLimit(gw, beaten)) {
      walkOut(gw, beaten);
      return true;
    }
    answerAll(gw, x, null);
    return true;
  }
  if (hasSeat(gw, x)) {
    if (!force) return false;
    for (const c of mine) if (c.step === "refused") refuseFinal(gw, c);
    return true;
  }
  const moves = new Map<number, GwBargainPick>();
  let insisting = false;
  for (const c of mine) {
    if (c.step !== "refused") continue;
    const move = aiMove(gw, x, c, insisting);
    insisting ||= move === "insist";
    moves.set(c.id, { move, place: null });
  }
  bargain(gw, x, moves);
  return true;
}

/** A ruler pressed on at the signing: his refused places are bargained again. */
export function pressAgain(gw: GreatWar, who: GwTag): void {
  const t = tableOf(gw);
  if (beatenOf(t) === who) return;
  for (const c of t.claims) {
    if (c.by !== who || c.round === undefined || c.state !== "refused") {
      continue;
    }
    c.state = "open";
    c.step = "refused";
  }
}

// ---- The seat's orders ----

const talking = (gw: GreatWar) => {
  const t = gw.s.table;
  return t !== null && !t.closed && !t.done && t.talk !== undefined;
};

/** Applies `table_propose`: the seat lays down its whole proposal. */
export function tablePropose(
  gw: GreatWar,
  seat: GwSeatState,
): GwOrderBlock | null {
  if (!talking(gw)) return "table_no";
  const t = tableOf(gw);
  if (claimantOf(gw) !== seat.tag || t.talk!.rounds[seat.tag] !== undefined) {
    return "table_no";
  }
  propose(gw, seat.tag);
  t.next = gw.mg.ticks() + 45;
  gw.touch();
  return null;
}

/** Applies `table_bargain`: the seat's moves on the refused places. */
export function tableBargain(
  gw: GreatWar,
  seat: GwSeatState,
  moves: readonly {
    claim: number;
    move: GwBargainMove;
    place: string | null;
  }[],
): GwOrderBlock | null {
  if (!talking(gw)) return "table_no";
  const t = tableOf(gw);
  const due = talkDue(gw, seat);
  if (due?.kind !== "bargain") return "table_no";
  const picks = new Map<number, GwBargainPick>();
  for (const m of moves) {
    if (!due.claims.includes(m.claim)) return "table_no";
    const open = due.moves?.[m.claim];
    if (open !== undefined && !open.includes(m.move)) return "table_no";
    const place = m.place === null ? null : (m.place as GwPlace);
    if (m.move === "trade" && (place === null || !(place in GW_PLACES))) {
      return "table_no";
    }
    picks.set(m.claim, { move: m.move, place });
  }
  bargain(gw, seat.tag, picks);
  t.next = gw.mg.ticks() + 45;
  gw.touch();
  return null;
}

/**
 * ww209 (S2): applies `table_counter`: the beaten seat names its own fate for
 * refused places. S0's stub refuses.
 */
export function tableCounter(
  gw: GreatWar,
  seat: GwSeatState,
  counters: readonly {
    claim: number;
    fate: GwFate;
    term: GwFateTerm | null;
  }[],
): GwOrderBlock | null {
  if (!talking(gw)) return "table_no";
  const due = talkDue(gw, seat);
  if (due?.kind !== "answer") return "table_no";
  for (const k of counters) {
    if (!(due.counters?.[k.claim] ?? []).includes(k.fate)) return "table_no";
  }
  const t = tableOf(gw);
  for (const k of counters) {
    const c = t.claims.find((x) => x.id === k.claim)!;
    const term = k.fate === "occupy" ? (k.term ?? "short") : null;
    c.counter = term === null ? { fate: k.fate } : { fate: k.fate, term };
  }
  gw.touch();
  return null;
}

/** Applies `table_answer`: the beaten seat says yes or no, or walks out. */
export function tableAnswer(
  gw: GreatWar,
  seat: GwSeatState,
  answers: readonly { claim: number; yes: boolean }[],
  walk: boolean,
): GwOrderBlock | null {
  if (!talking(gw)) return "table_no";
  const t = tableOf(gw);
  const due = talkDue(gw, seat);
  if (due?.kind !== "answer") return "table_no";
  if (walk) {
    if (!due.walk) return "table_no";
    walkOut(gw, seat.tag);
    return null;
  }
  const said = new Map<number, boolean>();
  for (const a of answers) {
    if (!due.claims.includes(a.claim)) return "table_no";
    said.set(a.claim, a.yes);
  }
  answerAll(gw, claimantOf(gw)!, said);
  t.next = gw.mg.ticks() + 45;
  gw.touch();
  return null;
}

// ---- What the screens read ----

/** What the seat has to do at the talk now. */
export function talkDue(gw: GreatWar, seat: GwSeatState): GwTableDue {
  const t = tableOf(gw);
  if (t.closed || t.done) return null;
  const pc = t.claims.find(
    (c) => c.state === "open" && c.step === "partner" && c.partner === seat.tag,
  );
  if (pc !== undefined) {
    return {
      kind: "word",
      claim: pc.id,
      words: wordsFor(pc, seat.tag),
      trades: [],
    };
  }
  const x = claimantOf(gw);
  if (x === null) return null;
  const talk = t.talk!;
  const mine = openOf(t, x);
  if (x === seat.tag) {
    const round = talk.rounds[x];
    if (round === undefined) {
      return { kind: "propose", places: askable(gw, x) };
    }
    if (mine.some((c) => c.step === "partner" || c.step === "asked")) {
      return null;
    }
    const refused = mine.filter((c) => c.step === "refused");
    if (refused.length === 0) return null;
    return {
      kind: "bargain",
      claims: refused.map((c) => c.id),
      places: askable(gw, x),
      round,
      last: round + 1 >= roundsOf(t),
      moves: Object.fromEntries(refused.map((c) => [c.id, movesFor(gw, c)])),
    };
  }
  if (seat.tag !== beatenOf(t)) return null;
  if (mine.some((c) => c.step === "partner")) return null;
  const asked = mine.filter((c) => c.step === "asked");
  if (asked.length === 0) return null;
  return {
    kind: "answer",
    claims: asked.map((c) => c.id),
    walk: canWalk(gw, seat.tag),
    counters: Object.fromEntries(
      asked
        .filter((c) => c.move === undefined || !TRADES.includes(c.move))
        .map((c) => [c.id, lighterOf(c)]),
    ),
  };
}

/** ww210: the moves open on a refused place, read off the state. */
function movesFor(gw: GreatWar, c: GwTableClaim): GwBargainMove[] {
  const out: GwBargainMove[] = ["insist", "down", "trade", "drop"];
  if (c.counter !== undefined) out.push("counter");
  out.push("ransom");
  if ((c.fate ?? "annex") !== "return")
    out.push("promise_leave", "promise_vote");
  const t = tableOf(gw);
  if (
    gw.s.armistice === null &&
    t.pair !== undefined &&
    c.ultimatum === undefined
  ) {
    out.push("ultimatum");
  }
  out.push("favour_neutral", "favour_trade");
  if (c.fate === "state" && c.client !== undefined) out.push("split");
  return out;
}

/**
 * ww210 (S2), each chapter: promises made at the table fall due. One to
 * leave is kept by leaving; one to let the people vote, by the vote (the
 * country's heart goes back, the rest stays). At war again by then, it is
 * broken: the beaten's trust -2 and its grudge remembered.
 */
export function bargainStep(gw: GreatWar): void {
  const t = gw.s.table;
  if (t === null || !t.closed) return;
  for (const c of t.claims) {
    if (c.due === undefined || gw.s.chapter < c.due) continue;
    if (c.move !== "promise_leave" && c.move !== "promise_vote") continue;
    if (c.state !== "agreed" && c.state !== "imposed") continue;
    delete c.due;
    const by = gw.nation(c.by);
    const it = gw.nation(c.against);
    if (by === null || it === null) continue;
    if (by.atWar.includes(c.against)) {
      it.trust[c.by] = clampTo((it.trust[c.by] ?? 0) - 2, -3, 3);
      for (const seat of seatsOf(gw, c.against)) {
        const flag = `f_revanche_${c.by.toLowerCase()}`;
        if (!seat.flags.includes(flag)) seat.flags.push(flag);
        reason(gw, seat, "table_promise_broken");
      }
      continue;
    }
    if (holderOf(gw, c.place) !== c.by) continue;
    const owner = GW_PLACES[c.place].owner;
    const heart =
      GW_TABLE_HEART[owner]?.includes(GW_PLACES[c.place].group) === true;
    const base = { place: c.place, by: c.by, of: owner, chapter: gw.s.chapter };
    if (c.move === "promise_vote" && !heart) {
      record(gw, { ...base, fate: "annex", to: c.by });
    } else {
      moveLand(gw, c.place, owner, null, "table");
      record(gw, { ...base, fate: "return", to: owner });
    }
    news(gw, `table_${c.move}_kept`, c.by, c.against, null, c.place);
  }
}

/** Who speaks at the talk now. */
export function talkSpeaker(gw: GreatWar): GwTag | null {
  const t = tableOf(gw);
  if (t.closed || t.done) return null;
  const x = claimantOf(gw);
  if (x === null) return null;
  if (t.talk!.rounds[x] === undefined) return x;
  const mine = openOf(t, x);
  const partner = mine.find((c) => c.step === "partner");
  if (partner !== undefined) return partner.partner ?? null;
  if (mine.some((c) => c.step === "asked")) return beatenOf(t);
  return x;
}

/** The beaten's mood in words, from the strain against what it bears. */
function moodOf(gw: GreatWar, beaten: GwTag | null): GwTableMood {
  if (beaten === null) return "calm";
  const strain = talkOf(gw).strain[beaten] ?? 0;
  const limit = walkLimit(gw, beaten);
  if (strain * 2 <= limit) return "calm";
  return strain + STRAIN_ROUND + STRAIN_INSIST > limit ? "breaking" : "tense";
}

/** The talk as every chair sees it. */
export function talkView(gw: GreatWar): NonNullable<GwTableView["talk"]> {
  const t = tableOf(gw);
  const talk = t.talk!;
  const claimant = t.closed || t.done ? null : claimantOf(gw);
  const beaten = beatenOf(t);
  return {
    round: claimant === null ? 0 : (talk.rounds[claimant] ?? 0),
    rounds: roundsOf(t),
    claimant,
    beaten,
    mood: moodOf(gw, beaten),
    walked: talk.walked,
  };
}
