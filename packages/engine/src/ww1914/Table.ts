// Great War 1914: the peace table (design §3, ww155). The armistice brings it;
// the map is the table. In each month of the conference the countries speak in
// turn: one puts a place on the table, whoever would lose it says yes, no, or
// offers something else, and the claimant takes that, insists, or lets it go.
// What is agreed moves on the map at once. Everything is valued, nothing rolled.
// A seat speaks by order; anyone else, or a seat that leaves it to its delegation,
// answers by the same rules. The table talks at reading speed (`tableTick`).
import {
  GwPairTable,
  GwSeatState,
  GwSide,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
  GwPlace,
} from "@openfront/engine-api/ww1914/GwPlaces";
import {
  GW_TABLE_TRADES,
  GwMapRecord,
  GwTableClaim,
  GwTableDue,
  GwTableLineKind,
  GwTableState,
  GwTableTrade,
  GwTableView,
  GwTableWord,
} from "@openfront/engine-api/ww1914/GwTable";
import {
  GW_TABLE_AIMS,
  GW_TABLE_CAPITALS,
  GW_TABLE_HEART,
  GW_TABLE_ORDER,
  GW_TABLE_PORTS,
  GW_TABLE_ROUNDS,
  GW_TABLE_SESSIONS,
} from "@openfront/engine-lib/ww1914/TableRows";
import { claimsHeld } from "./Claims";
import { signWays } from "./Fate";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { holderOf, moveLand } from "./Land";
import {
  beatenAt,
  canAskFor,
  hasLandGraph,
  landLine,
  monthsHeld,
} from "./Occupation";
import { sessionsLeft } from "./Peace";
import { promiseCost } from "./Spies";
import { weariness } from "./Terms";
import {
  clampTo,
  moveGauge,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

/** Ticks between two things said, and between two the seat has no part in. */
const PACE = 45;
const QUICK = 22;
/** Lines the screens get. */
const LINES_SHOWN = 24;

/** Where a country stands when it sits down. */
const STANDING = { won: 45, even: 15, lost: -15 } as const;
/** The war's score counts this part, up to this much. */
const SCORE_PART = 3;
const SCORE_MOST = 15;
/** Each painted place the others have read about, and the most. */
const PAINTED_EVERY = 2;
const PAINTED_MOST = 10;
const IN_PERSON = 5;
/** What a place costs the one who gives it up. */
const COST_BASE = 30;
const COST_CAPITAL = 30;
const COST_HEART = 25;
const COST_FRIEND = 15;
/** What makes it easier: it is in the claimant's hands, or it is its known case. */
const EASE_HELD = 15;
/** ww172: each month the claimant has held it, up to the most. */
const EASE_MONTH = 1;
const EASE_MONTHS_MOST = 12;
const EASE_CASE = 15;
const EASE_PAPERS = 5;
/** The seat that said it would follow Wilson's points asks less easily. */
const WILSON_COST = 10;
/** Each place already given to the claimant makes the next one dearer. */
const APPETITE = 5;
/** Places the table bears; each past it goes down as too much. */
const BEARS = 6;
/** What going too far takes off the claimant's standing, each step. */
const OVER_WORTH = 8;
/** Steps past which the rest of the table says so. */
const OVER_WARN = 3;
/** What each refusal to the last adds to the holder's side. */
const HOLD_WORTH = 6;
/** Refusals a winner puts up with, and one more for each weariness step. */
const HOLD_BASE = 2;
const HOLD_TIRED = 6;
/** Inside this of a yes, the holder offers something else. */
const TRADE_GAP = 15;
/** Insisting moves the holder this much, at the price of `over`. */
const PRESS_WORTH = 10;
/** What each thing is worth in place of land. */
const TRADE_WORTH: Readonly<Record<GwTableTrade, number>> = {
  reparations: 20,
  port: 14,
  guarantee: 10,
  recognition: 8,
};
/** Each step already on the bill takes this off the next. */
const BILL_WEAR = 4;
/** A seat that took up the trade of land finds offers easier. */
const TRADER_WORTH = 6;
/** Offers on one claim, both sides together. */
const OFFERS_MOST = 2;
/** The most a bill takes off the money gauge. */
const BILL_MOST = 3;

/**
 * Where a country sits. At the conference its coalition; at a bilateral table
 * (ww172) the first chair is `central` and the second `entente`, whatever
 * their coalitions, and nobody else sits.
 */
function sideOf(gw: GreatWar, tag: GwTag): GwSide | null {
  const p = gw.s.table?.pair;
  if (p !== undefined) {
    return tag === p.a ? "central" : tag === p.b ? "entente" : null;
  }
  return gw.nation(tag)?.side ?? null;
}

/** Who won; null when nobody did. */
export function winnerOf(gw: GreatWar): GwSide | null {
  const p = gw.s.table?.pair;
  if (p !== undefined) return p.winner === null ? null : sideOf(gw, p.winner);
  const k = gw.s.armistice?.kind;
  if (k === "central_lost") return "entente";
  if (k === "entente_lost") return "central";
  return null;
}

/** The conference's winner, from the armistice alone. */
function armisticeWinner(gw: GreatWar): GwSide | null {
  const k = gw.s.armistice?.kind;
  if (k === "central_lost") return "entente";
  if (k === "entente_lost") return "central";
  return null;
}

/** A chair: those who fought, but not a country that left a war its side won. */
function chairs(gw: GreatWar): GwTag[] {
  const winner = armisticeWinner(gw);
  const seated = (tag: GwTag) => {
    const n = gw.nation(tag);
    if (n === null || n.side === null) return false;
    if (!n.out) return true;
    if (tag === "RUS") return winner === "central";
    return n.side === winner || seatsOf(gw, tag).length > 0;
  };
  const first: GwSide = winner ?? "entente";
  return [
    ...GW_TABLE_ORDER[first].filter(seated),
    ...GW_TABLE_ORDER[other(first)].filter(seated),
  ];
}

/** The table as the armistice leaves it. */
export function tableStart(gw: GreatWar): GwTableState {
  return {
    session: 0,
    order: chairs(gw),
    round: 0,
    at: 0,
    next: 0,
    done: false,
    closed: false,
    claims: [],
    lines: [],
    bill: {},
    over: {},
    held: {},
  };
}

function say(
  t: GwTableState,
  word: GwTableLineKind,
  who: GwTag,
  claim: number,
): void {
  t.lines.push({ n: t.lines.length, word, who, claim });
}

/** A month of the conference opens. */
export function openSession(gw: GreatWar, ticks: number): void {
  const t = gw.s.table;
  if (t === null || t.closed) return;
  // A bilateral table is one month, whatever the calendar (ww172).
  if (t.pair === undefined && sessionsLeft(gw) === 0) return;
  t.session = t.pair === undefined ? GW_TABLE_SESSIONS - sessionsLeft(gw) : 0;
  t.round = 0;
  t.at = 0;
  t.done = t.order.length === 0;
  t.next = ticks + PACE;
  if (t.order.length > 0) say(t, "open", t.order[0], -1);
}

/** A person speaks for this country at the table; a regent's delegation answers alone. */
const hasSeat = (gw: GreatWar, tag: GwTag) => ruledBySeat(gw, tag);

const openClaim = (t: GwTableState) => t.claims.find((c) => c.state === "open");

/** Who has to speak on a claim. */
function dueBy(c: GwTableClaim): GwTag {
  if (c.step === "refused") return c.by;
  if (c.step === "offered") return c.offerBy === c.by ? c.against : c.by;
  return c.against;
}

/** A place can't be asked for twice in a month, or at all once it is settled. */
function onTable(t: GwTableState, place: GwPlace): boolean {
  return t.claims.some(
    (c) =>
      c.place === place &&
      (c.session === t.session ||
        c.state === "open" ||
        c.state === "agreed" ||
        c.state === "imposed" ||
        c.state === "traded"),
  );
}

/**
 * The owner came to this table beaten: its side lost, it lost the war of the
 * two, or (at the conference) it was knocked out on its own.
 */
function beatenHere(gw: GreatWar, owner: GwTag): boolean {
  const winner = winnerOf(gw);
  const side = sideOf(gw, owner);
  if (winner !== null && side !== null && side !== winner) return true;
  return gw.s.table?.pair === undefined && beatenAt(gw, owner) !== null;
}

/**
 * 9A (ww172): one's own land, a place one holds, or one in a group next to
 * what one holds whose owner came here beaten; over the water with the sea.
 */
function reachable(gw: GreatWar, by: GwTag, place: GwPlace): boolean {
  if (GW_PLACES[place].owner === by) return true;
  return canAskFor(gw, by, place, (owner) => beatenHere(gw, owner));
}

/** Whoever would lose it; null when it can't be asked for at this table. */
function againstOf(gw: GreatWar, by: GwTag, place: GwPlace): GwTag | null {
  const t = gw.s.table!;
  const side = sideOf(gw, by);
  if (!reachable(gw, by, place)) return null;
  const friend =
    t.pair !== undefined
      ? undefined
      : gw.s.seats.find(
          (x) =>
            x.tag !== by &&
            x.claims.includes(place) &&
            sideOf(gw, x.tag) === side &&
            t.order.includes(x.tag),
        );
  if (friend !== undefined) return friend.tag;
  const owner = GW_PLACES[place].owner;
  const holder = holderOf(gw, place);
  const ours = holder === by || sideOf(gw, holder) === side;
  const who = owner === by || !ours ? holder : owner;
  if (who === by || sideOf(gw, who) === null) return null;
  return who;
}

function standing(gw: GreatWar, tag: GwTag): number {
  const t = gw.s.table!;
  const side = sideOf(gw, tag);
  const winner = winnerOf(gw);
  let v =
    winner === null
      ? STANDING.even
      : side === winner
        ? STANDING.won
        : STANDING.lost;
  const p = t.pair;
  if (side !== null) {
    const war =
      p === undefined ? warScore(gw, side) : tag === p.a ? p.score : -p.score;
    const score = Math.trunc(war / SCORE_PART);
    v += clampTo(score, -SCORE_MOST, SCORE_MOST);
  }
  // The painted map is the conference's.
  const seat = p === undefined ? seatsOf(gw, tag)[0] : undefined;
  if (seat !== undefined) {
    const painted = Math.trunc(seat.claims.length / PAINTED_EVERY);
    v -= Math.min(PAINTED_MOST, painted);
    if (seat.flags.includes("f_e_in_person")) v += IN_PERSON;
  }
  return v - (t.over[tag] ?? 0) * OVER_WORTH;
}

/** What the claimant can bring to bear on this claim. */
function leverage(gw: GreatWar, c: GwTableClaim): number {
  const t = gw.s.table!;
  const n = gw.nation(c.against);
  const tired = n === null ? 0 : weariness(n);
  const v = standing(gw, c.by) + tired - (t.held[c.against] ?? 0) * HOLD_WORTH;
  return sideOf(gw, c.by) === sideOf(gw, c.against) ? Math.trunc(v / 2) : v;
}

const claimsMade = (t: GwTableState, by: GwTag) =>
  t.claims.filter(
    (c) => c.by === by && (c.state === "agreed" || c.state === "imposed"),
  ).length;

function placeCost(gw: GreatWar, c: GwTableClaim): number {
  const t = gw.s.table!;
  const place = GW_PLACES[c.place];
  const known = GW_TABLE_AIMS[c.by]?.includes(c.place) === true;
  const papers = seatsOf(gw, c.by)[0]?.flags ?? [];
  let v = COST_BASE;
  if (GW_TABLE_CAPITALS.includes(c.place)) v += COST_CAPITAL;
  if (GW_TABLE_HEART[c.against]?.includes(place.group) === true) {
    v += COST_HEART;
  }
  if (sideOf(gw, c.by) === sideOf(gw, c.against)) v += COST_FRIEND;
  if (holderOf(gw, c.place) === c.by) {
    v -= EASE_HELD;
    v -= Math.min(EASE_MONTHS_MOST, monthsHeld(gw, c.place) * EASE_MONTH);
  }
  if (known) {
    v -= EASE_CASE;
    if (papers.includes("f_e_held_treaty")) v -= EASE_PAPERS;
    if (papers.includes("f_e_experts")) v -= EASE_PAPERS;
  } else if (papers.includes("f_e_followed_wilson")) {
    v += WILSON_COST;
  }
  v += promiseCost(gw, c.by, c.place);
  return v + claimsMade(t, c.by) * APPETITE;
}

/** What the claimant is short of a yes, or over it. */
const gapOf = (gw: GreatWar, c: GwTableClaim) =>
  leverage(gw, c) - placeCost(gw, c);

function tradeWorth(
  gw: GreatWar,
  c: GwTableClaim,
  trade: GwTableTrade,
): number {
  const t = gw.s.table!;
  let v = TRADE_WORTH[trade];
  if (trade === "reparations") v -= (t.bill[c.against] ?? 0) * BILL_WEAR;
  const seat = seatsOf(gw, c.offerBy ?? c.by)[0];
  if (seat?.flags.includes("f_e_traded_land") === true) v += TRADER_WORTH;
  return v;
}

/** What can stand in for this place. */
function tradesFor(gw: GreatWar, c: GwTableClaim): GwTableTrade[] {
  const noBill = seatsOf(gw, c.by)[0]?.flags.includes("f_e_no_bill") === true;
  return GW_TABLE_TRADES.filter((x) => {
    if (x === "port") return GW_TABLE_PORTS.includes(c.place);
    if (x === "reparations") return !noBill;
    return true;
  });
}

/** What the seat may say to this claim now. */
function wordsFor(c: GwTableClaim, tag: GwTag): GwTableWord[] {
  const offers = c.offers < OFFERS_MOST;
  if (dueBy(c) !== tag) return [];
  if (tag === c.against) {
    if (c.step === "offered") return ["yes", "no"];
    return offers ? ["yes", "no", "offer"] : ["yes", "no"];
  }
  const out: GwTableWord[] = [];
  if (c.step === "offered") out.push("yes");
  if (!c.pressed) out.push("press");
  if (c.step === "refused" && offers) out.push("offer");
  out.push("drop");
  return out;
}

function nextChair(t: GwTableState): void {
  t.at++;
  if (t.at < t.order.length) return;
  t.at = 0;
  t.round++;
}

function overBy(gw: GreatWar, c: GwTableClaim): void {
  const t = gw.s.table!;
  const tag = c.by;
  t.over[tag] = (t.over[tag] ?? 0) + 1;
  if (t.over[tag] !== OVER_WARN) return;
  const usa = t.order.includes("USA") && tag !== "USA";
  const voice = usa ? "USA" : t.order.find((x) => x !== tag);
  if (voice !== undefined) say(t, "over", voice, c.id);
}

/** A claim's end, as world news and a line on both seats (ww172). */
function resultLines(
  gw: GreatWar,
  c: GwTableClaim,
  end: "ceded" | "imposed" | "traded" | "refused" | "dropped",
): void {
  news(gw, `table_${end}`, c.by, c.against, null, c.place);
  landLine(gw, c.by, `land_table_${end}_by`, c.against, c.place);
  landLine(gw, c.against, `land_table_${end}_to`, c.by, c.place);
}

function give(gw: GreatWar, c: GwTableClaim, state: "agreed" | "imposed") {
  const t = gw.s.table!;
  c.state = state;
  moveLand(gw, c.place, c.by, null, "table");
  resultLines(gw, c, state === "agreed" ? "ceded" : "imposed");
  if (state === "agreed") say(t, "yes", c.against, c.id);
  else say(t, "impose", c.by, c.id);
  if (claimsMade(t, c.by) > BEARS) overBy(gw, c);
}

/** Refused to the last: a loser can do that only so often, and it costs. */
function refuseToTheLast(gw: GreatWar, c: GwTableClaim): void {
  const t = gw.s.table!;
  const winner = winnerOf(gw);
  const forced = winner !== null && sideOf(gw, c.by) === winner;
  const lost = forced && sideOf(gw, c.against) !== winner;
  if (lost) {
    const n = gw.nation(c.by);
    const tired = n === null ? 0 : weariness(n);
    const patience = HOLD_BASE + Math.trunc(tired / HOLD_TIRED);
    if ((t.held[c.against] ?? 0) >= patience) {
      give(gw, c, "imposed");
      return;
    }
    moveGauge(gw, c.against, "bread", -1, "table_hold");
  }
  c.state = "refused";
  t.held[c.against] = (t.held[c.against] ?? 0) + 1;
  say(t, "hold", c.against, c.id);
  resultLines(gw, c, "refused");
}

function settle(gw: GreatWar, c: GwTableClaim): void {
  const t = gw.s.table!;
  c.state = "traded";
  if (c.offer === "reparations") {
    t.bill[c.against] = (t.bill[c.against] ?? 0) + 1;
  }
  say(t, "traded", dueBy(c), c.id);
  resultLines(gw, c, "traded");
}

/** A word on a claim, whoever says it. */
function word(
  gw: GreatWar,
  c: GwTableClaim,
  tag: GwTag,
  w: GwTableWord,
  trade: GwTableTrade | null,
): void {
  const t = gw.s.table!;
  switch (w) {
    case "yes":
      if (c.step === "offered") settle(gw, c);
      else give(gw, c, "agreed");
      return;
    case "no":
      if (c.pressed) {
        refuseToTheLast(gw, c);
        return;
      }
      c.step = "refused";
      c.offer = null;
      c.offerBy = null;
      say(t, "no", tag, c.id);
      return;
    case "offer":
      c.step = "offered";
      c.offer = trade;
      c.offerBy = tag;
      c.offers++;
      say(t, "offer", tag, c.id);
      return;
    case "press":
      c.step = "pressed";
      c.pressed = true;
      c.offer = null;
      c.offerBy = null;
      say(t, "press", tag, c.id);
      overBy(gw, c);
      return;
    case "drop":
      c.state = "dropped";
      say(t, "drop", tag, c.id);
      resultLines(gw, c, "dropped");
      return;
  }
}

/** What the holder would rather give: a port, money if it lost, a guarantee. */
function offerOf(gw: GreatWar, c: GwTableClaim): GwTableTrade {
  const open = tradesFor(gw, c);
  if (open.includes("port")) return "port";
  const lost = sideOf(gw, c.against) !== winnerOf(gw);
  if (lost && open.includes("reparations")) return "reparations";
  return "guarantee";
}

/** Whether this claimant insists: a winner does, a hard man if it can move it. */
function insists(gw: GreatWar, c: GwTableClaim): boolean {
  if (c.pressed || hasSeat(gw, c.by)) return false;
  const winner = winnerOf(gw);
  if (winner !== null && sideOf(gw, c.by) === winner) {
    return sideOf(gw, c.against) !== winner;
  }
  const kind = gw.nation(c.by)?.ai;
  const hard = kind === "hardline" || kind === "opportunist";
  return hard && gapOf(gw, c) + PRESS_WORTH >= 0;
}

/** The answer of anyone with no seat, or a seat that left it to its people. */
function answer(gw: GreatWar, c: GwTableClaim, who: GwTag): void {
  const gap = gapOf(gw, c);
  if (who === c.against) {
    const offers = c.offers < OFFERS_MOST;
    if (c.step === "offered") {
      const yes = gap + tradeWorth(gw, c, c.offer!) >= 0;
      word(gw, c, who, yes ? "yes" : "no", null);
    } else if (c.step === "pressed") {
      word(gw, c, who, gap + PRESS_WORTH >= 0 ? "yes" : "no", null);
    } else if (gap >= 0) {
      word(gw, c, who, "yes", null);
    } else if (gap >= -TRADE_GAP && offers) {
      word(gw, c, who, "offer", offerOf(gw, c));
    } else {
      word(gw, c, who, "no", null);
    }
    return;
  }
  if (c.step === "offered" && gap < tradeWorth(gw, c, c.offer!)) {
    word(gw, c, who, "yes", null);
  } else if (insists(gw, c)) {
    word(gw, c, who, "press", null);
  } else {
    word(gw, c, who, "drop", null);
  }
}

/** How much of what it could ask for a country asks: a hard man most. */
const APPETITE_PCT = {
  hardline: 100,
  opportunist: 80,
  principled: 60,
  cautious: 50,
} as const;
/** What a winner's appetite gains, and what a hard man asks past the bearable. */
const APPETITE_WON = 10;
const APPETITE_HARD_PAST = 2;
/** How it ranks what it could ask for. */
const WANT_OWN = 40;
const WANT_HELD = 30;
const WANT_MONTH = 2;
const WANT_MONTHS_MOST = 20;
const WANT_CASE = 25;
const WANT_PORT = 5;
const WANT_CAPITAL = 10;

/**
 * Nobody beaten at a bilateral table: each keeps what it stands on (design
 * ww168 B6), so only its own land in the other's hands is worth asking for.
 */
const standsOn = (gw: GreatWar) =>
  gw.s.table?.pair !== undefined && winnerOf(gw) === null;

/**
 * What a country nobody plays would ask for, the most wanted first: its own
 * land back where each keeps what it stands on, else what it holds (the
 * longer the dearer to it), then a beaten neighbour's land in reach. Its
 * known case (GW_TABLE_AIMS) ranks a place up; on a map without the places
 * only the case and what it holds count. Read off the state, not a list.
 */
function wishesOf(gw: GreatWar, tag: GwTag): GwPlace[] {
  const aims = GW_TABLE_AIMS[tag] ?? [];
  const even = winnerOf(gw) === null;
  const keeps = standsOn(gw);
  const graph = hasLandGraph(gw);
  const out: { place: GwPlace; want: number }[] = [];
  for (const place of GW_PLACE_KEYS) {
    const owner = GW_PLACES[place].owner;
    const holder = holderOf(gw, place);
    const known = aims.indexOf(place);
    let want: number;
    if (owner === tag) {
      if (holder === tag || !keeps) continue;
      want = WANT_OWN;
    } else if (holder === tag) {
      if (keeps) continue;
      const months = monthsHeld(gw, place) * WANT_MONTH;
      want = WANT_HELD + Math.min(WANT_MONTHS_MOST, months);
    } else if (even || keeps || (!graph && known < 0)) {
      continue;
    } else {
      want = 0;
    }
    if (known >= 0) want += WANT_CASE - known;
    if (GW_TABLE_PORTS.includes(place)) want += WANT_PORT;
    if (GW_TABLE_CAPITALS.includes(place)) want -= WANT_CAPITAL;
    out.push({ place, want });
  }
  out.sort(
    (a, b) =>
      b.want - a.want || (a.place < b.place ? -1 : a.place > b.place ? 1 : 0),
  );
  return out
    .filter((x) => againstOf(gw, tag, x.place) !== null)
    .map((x) => x.place);
}

/** How many of `count` wishes it asks for: its character, then its state. */
function appetiteOf(gw: GreatWar, tag: GwTag, count: number): number {
  const n = gw.nation(tag)!;
  const won = winnerOf(gw) !== null && winnerOf(gw) === sideOf(gw, tag);
  const pct = clampTo(
    APPETITE_PCT[n.ai] - weariness(n) + (won ? APPETITE_WON : 0),
    10,
    100,
  );
  const most = BEARS + (n.ai === "hardline" ? APPETITE_HARD_PAST : 0);
  return Math.min(most, Math.ceil((count * pct) / 100));
}

function pickFor(gw: GreatWar, tag: GwTag): GwPlace | null {
  const t = gw.s.table!;
  const n = gw.nation(tag);
  const winner = winnerOf(gw);
  if (n === null || (winner !== null && sideOf(gw, tag) !== winner))
    return null;
  const made = t.claims.filter((c) => c.by === tag).length;
  // What it asked for, got or not, it doesn't ask for again.
  const wishes = wishesOf(gw, tag).filter(
    (place) => !t.claims.some((c) => c.by === tag && c.place === place),
  );
  if (made >= appetiteOf(gw, tag, wishes.length + made)) return null;
  return wishes.find((place) => !onTable(t, place)) ?? null;
}

function put(gw: GreatWar, by: GwTag, place: GwPlace, against: GwTag): void {
  const t = gw.s.table!;
  const c: GwTableClaim = {
    id: t.claims.length,
    place,
    by,
    against,
    session: t.session,
    state: "open",
    step: "asked",
    offer: null,
    offerBy: null,
    offers: 0,
    pressed: false,
  };
  t.claims.push(c);
  say(t, "claim", by, c.id);
}

/** One thing happens; false when it waits for a seat, or there's nothing left. */
function stepTable(gw: GreatWar): boolean {
  const t = gw.s.table!;
  const c = openClaim(t);
  if (c !== undefined) {
    const who = dueBy(c);
    if (hasSeat(gw, who)) return false;
    answer(gw, c, who);
    return true;
  }
  while (t.round < GW_TABLE_ROUNDS && t.order.length > 0) {
    const tag = t.order[t.at];
    if (hasSeat(gw, tag)) return false;
    const place = pickFor(gw, tag);
    nextChair(t);
    if (place === null) continue;
    put(gw, tag, place, againstOf(gw, tag, place)!);
    return true;
  }
  t.done = true;
  if (t.order.length > 0) say(t, "close", t.order[0], -1);
  return true;
}

function paceOf(gw: GreatWar): number {
  const t = gw.s.table!;
  const c = t.claims[t.claims.length - 1];
  const mine = c === undefined || hasSeat(gw, c.by) || hasSeat(gw, c.against);
  return mine ? PACE : QUICK;
}

/** Every tick: the table goes on when it is time and nobody is awaited. */
export function tableTick(gw: GreatWar, ticks: number): void {
  const t = gw.s.table;
  if (t === null || t.closed || t.done || ticks < t.next) return;
  if (!stepTable(gw)) return;
  t.next = ticks + paceOf(gw);
  gw.touch();
}

/** Nobody waits past the month's end: the delegations finish it. */
function runOut(gw: GreatWar): void {
  const t = gw.s.table!;
  while (!t.done) {
    const c = openClaim(t);
    if (c !== undefined) {
      answer(gw, c, dueBy(c));
    } else if (
      t.round < GW_TABLE_ROUNDS &&
      t.order.length > 0 &&
      hasSeat(gw, t.order[t.at])
    ) {
      nextChair(t);
    } else {
      stepTable(gw);
    }
  }
}

/** Chapter step: the month closes; the last one signs. */
export function tableStep(gw: GreatWar): void {
  const t = gw.s.table;
  if (t === null || t.closed) return;
  // A bilateral table sits one month: it signs as that month closes.
  if (t.pair !== undefined) {
    closeTable(gw);
    return;
  }
  if (sessionsLeft(gw) === 0) return;
  runOut(gw);
  if (sessionsLeft(gw) === 1) closeTable(gw);
}

/** Both of a bilateral table's countries, or neither: what it covers. */
function ofThePair(t: GwTableState, owner: GwTag, holder: GwTag): boolean {
  const p = t.pair;
  if (p === undefined) return true;
  const two = [p.a, p.b];
  return two.includes(owner) && two.includes(holder) && owner !== holder;
}

/**
 * Land stays where the table put it and nowhere else. A bilateral table
 * covers only the two's land, and with nobody beaten each keeps what it
 * stands on. A line for each country that gets land back.
 */
function returnLand(gw: GreatWar): void {
  const t = gw.s.table!;
  if (standsOn(gw)) return;
  const kept = (place: GwPlace, tag: GwTag) =>
    t.claims.some(
      (c) =>
        c.place === place &&
        c.by === tag &&
        (c.state === "agreed" || c.state === "imposed"),
    );
  const places = Object.keys(gw.s.held).sort() as GwPlace[];
  const told = new Set<string>();
  for (const place of places) {
    const holder = gw.s.held[place]!;
    const owner = GW_PLACES[place].owner;
    if (!ofThePair(t, owner, holder) || kept(place, holder)) continue;
    moveLand(gw, place, owner, null, "table");
    if (holderOf(gw, place) !== owner || told.has(`${holder}>${owner}`)) {
      continue;
    }
    told.add(`${holder}>${owner}`);
    news(gw, "land_returned", holder, owner, null, place);
    landLine(gw, owner, "land_returned_home", holder, place);
    landLine(gw, holder, "land_returned_gave", owner, place);
  }
}

/**
 * What a bilateral table covered (what was asked for, and the two's land in
 * the other's hands as it signs) stays put until the two fight again.
 */
function settleLand(gw: GreatWar): void {
  const t = gw.s.table!;
  const s = gw.s;
  if (t.pair === undefined) return;
  const settled = new Set(s.settled ?? []);
  for (const c of t.claims) settled.add(c.place);
  for (const place of GW_PLACE_KEYS) {
    if (ofThePair(t, GW_PLACES[place].owner, holderOf(gw, place))) {
      settled.add(place);
    }
  }
  s.settled = [...settled].sort();
}

function payBills(gw: GreatWar): void {
  const t = gw.s.table!;
  const tags = Object.keys(t.bill).sort() as GwTag[];
  for (const tag of tags) {
    const steps = Math.min(BILL_MOST, t.bill[tag] ?? 0);
    moveGauge(gw, tag, "money", -steps, "table_bill");
  }
  const paid = new Set(
    t.claims
      .filter((c) => c.state === "traded" && c.offer === "reparations")
      .map((c) => c.by),
  );
  for (const tag of [...paid].sort()) {
    moveGauge(gw, tag, "money", 1, "table_paid");
  }
}

function trustDown(gw: GreatWar, tag: GwTag, of: GwTag): void {
  const n = gw.nation(tag);
  if (n !== null) n.trust[of] = clampTo((n.trust[of] ?? 0) - 1, -3, 3);
}

/** What the seat carries away from the table, shown after. */
function seatCloses(gw: GreatWar, seat: GwSeatState): void {
  const t = gw.s.table!;
  const flag = (f: string) => {
    if (!seat.flags.includes(f)) seat.flags.push(f);
  };
  if ((t.over[seat.tag] ?? 0) >= OVER_WARN) {
    flag("f_t_overreach");
    reason(gw, seat, "table_over");
    trustDown(gw, "USA", seat.tag);
    for (const tag of t.order) {
      if (sideOf(gw, tag) !== sideOf(gw, seat.tag) || tag === seat.tag) {
        continue;
      }
      trustDown(gw, tag, seat.tag);
    }
  }
  if ((t.held[seat.tag] ?? 0) > 0) {
    flag("f_t_held_out");
    reason(gw, seat, "table_held");
  }
  if (seat.claims.length > 0) {
    const got = claimsHeld(gw, seat).length;
    reason(
      gw,
      seat,
      got * 2 >= seat.claims.length ? "table_got" : "table_short",
    );
  }
}

/** The treaty: what wasn't agreed goes home, the bills fall due. */
export function closeTable(gw: GreatWar): void {
  const t = gw.s.table;
  if (t === null || t.closed) return;
  runOut(gw);
  t.closed = true;
  settleLand(gw);
  returnLand(gw);
  payBills(gw);
  if (t.pair !== undefined) {
    pairSigned(gw, t);
    gw.touch();
    return;
  }
  for (const seat of gw.s.seats) seatCloses(gw, seat);
  news(gw, "table_signed");
  turn(gw, "table_signed");
  gw.touch();
}

// ---- The bilateral table (ww172, design ww168 B5-B6) ----

/** The waiting row of a bilateral table now sitting, or null. */
function rowOf(gw: GreatWar, t: GwTableState): GwPairTable | null {
  const p = t.pair;
  if (p === undefined) return null;
  return (
    (gw.s.pairTables ?? []).find(
      (r) =>
        r.a === p.a && r.b === p.b && r.opened !== null && r.signed === null,
    ) ?? null
  );
}

/** How the table came out for `tag`: `won`, `lost` or `even`. */
function pairResult(p: NonNullable<GwTableState["pair"]>, tag: GwTag) {
  if (p.winner === null) return "even";
  return p.winner === tag ? "won" : "lost";
}

/** The two sign: news, a line and a memory on each seat. */
function pairSigned(gw: GreatWar, t: GwTableState): void {
  const p = t.pair!;
  const row = rowOf(gw, t);
  if (row !== null) row.signed = gw.s.chapter;
  news(gw, "pair_table_signed", p.a, p.b);
  for (const [me, them] of [
    [p.a, p.b],
    [p.b, p.a],
  ] as const) {
    for (const seat of seatsOf(gw, me)) {
      const key = `pair_table_${pairResult(p, me)}`;
      seat.log.push({ key, chapter: gw.s.chapter, tag: them });
      seat.memory.push({
        key: `pair_table_signed_${them.toLowerCase()}`,
        who: null,
        chapter: gw.s.chapter,
        weight: 0,
      });
    }
  }
}

/** A bilateral table sits down: the one who came out ahead speaks first. */
function openPairTable(gw: GreatWar, row: GwPairTable): void {
  const s = gw.s;
  row.opened = s.chapter;
  const first = row.winner ?? row.a;
  const second = first === row.a ? row.b : row.a;
  s.table = {
    session: 0,
    order: [first, second],
    round: 0,
    at: 0,
    next: 0,
    done: false,
    closed: false,
    claims: [],
    lines: [],
    bill: {},
    over: {},
    held: {},
    pair: { a: row.a, b: row.b, winner: row.winner, score: row.score },
  };
  news(gw, "pair_table_open", row.a, row.b);
  for (const [me, them] of [
    [row.a, row.b],
    [row.b, row.a],
  ] as const) {
    for (const seat of seatsOf(gw, me)) {
      seat.log.push({ key: "pair_table_open", chapter: s.chapter, tag: them });
    }
  }
}

/**
 * Chapter step, after the conference's: the next peace of two with land at
 * stake sits down. With no seat at it, it talks and signs at once; with one,
 * it sits through the next chapter and signs as it closes (tableStep). One at
 * a time; none once an armistice brings the conference.
 */
export function pairTableStep(gw: GreatWar): void {
  const s = gw.s;
  for (let guard = 0; guard < 8; guard++) {
    if (s.armistice !== null || s.conferenceLeft > 0) return;
    const t = s.table;
    if (t !== null && !t.closed) return;
    const row = (s.pairTables ?? []).find((r) => r.opened === null);
    if (row === undefined) return;
    openPairTable(gw, row);
    if (hasSeat(gw, row.a) || hasSeat(gw, row.b)) return;
    const table = s.table!;
    say(table, "open", table.order[0], -1);
    closeTable(gw);
  }
}

/**
 * A peace of two (PairWar): a table waits for it when there is land at
 * stake: one holds the other's, or one came out ahead.
 */
export function queuePairTable(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
  winner: GwTag | null,
  score: number,
): boolean {
  const s = gw.s;
  const stake = GW_PLACE_KEYS.some((place) => {
    const owner = GW_PLACES[place].owner;
    const holder = holderOf(gw, place);
    return (owner === a && holder === b) || (owner === b && holder === a);
  });
  if (!stake && winner === null) return false;
  s.pairTables ??= [];
  s.pairTables.push({
    a,
    b,
    chapter: s.chapter,
    winner,
    score,
    opened: null,
    signed: null,
  });
  return true;
}

const myTurn = (gw: GreatWar, seat: GwSeatState) => {
  const t = gw.s.table;
  if (t === null || t.closed || t.done) return false;
  return (
    openClaim(t) === undefined &&
    t.round < GW_TABLE_ROUNDS &&
    t.order[t.at] === seat.tag
  );
};

/** Applies `table_claim`: the seat's turn, a place. */
export function tableClaim(
  gw: GreatWar,
  seat: GwSeatState,
  place: string,
): GwOrderBlock | null {
  const t = gw.s.table;
  if (t === null || !myTurn(gw, seat) || !(place in GW_PLACES)) {
    return "table_no";
  }
  const p = place as GwPlace;
  const against = againstOf(gw, seat.tag, p);
  if (onTable(t, p) || against === null) return "table_no";
  nextChair(t);
  put(gw, seat.tag, p, against);
  t.next = gw.mg.ticks() + PACE;
  return null;
}

/** Applies `table_pass`. */
export function tablePass(
  gw: GreatWar,
  seat: GwSeatState,
): GwOrderBlock | null {
  const t = gw.s.table;
  if (t === null || !myTurn(gw, seat)) return "table_no";
  nextChair(t);
  t.next = 0;
  return null;
}

/** Applies `table_word`: the seat's answer to a claim. */
export function tableWord(
  gw: GreatWar,
  seat: GwSeatState,
  id: number,
  w: GwTableWord,
  trade: GwTableTrade | null,
): GwOrderBlock | null {
  const t = gw.s.table;
  const c = t === null ? undefined : t.claims[id];
  if (t === null || t.closed || c === undefined || c.state !== "open") {
    return "table_no";
  }
  if (!wordsFor(c, seat.tag).includes(w)) return "table_no";
  if (w === "offer" && (trade === null || !tradesFor(gw, c).includes(trade))) {
    return "table_no";
  }
  word(gw, c, seat.tag, w, trade);
  t.next = gw.mg.ticks() + PACE;
  return null;
}

/** Applies `table_next`: on with it now. */
export function tableNext(gw: GreatWar): GwOrderBlock | null {
  const t = gw.s.table;
  if (t === null || t.closed) return "table_no";
  t.next = 0;
  return null;
}

function dueOf(gw: GreatWar, seat: GwSeatState): GwTableDue {
  const t = gw.s.table!;
  if (t.closed || t.done) return null;
  const c = openClaim(t);
  if (c !== undefined) {
    const words = wordsFor(c, seat.tag);
    if (words.length === 0) return null;
    return {
      kind: "word",
      claim: c.id,
      words,
      trades: words.includes("offer") ? tradesFor(gw, c) : [],
    };
  }
  if (!myTurn(gw, seat)) return null;
  const places = GW_PLACE_KEYS.filter(
    (p) => !onTable(t, p) && againstOf(gw, seat.tag, p) !== null,
  );
  return { kind: "turn", left: GW_TABLE_ROUNDS - t.round, places };
}

function roleOf(gw: GreatWar, seat: GwSeatState): GwTableView["role"] {
  const t = gw.s.table!;
  if (!t.order.includes(seat.tag)) return "watch";
  const winner = winnerOf(gw);
  if (winner === null) return "even";
  return sideOf(gw, seat.tag) === winner ? "won" : "lost";
}

/** The screen's copy; null before an armistice. */
export function tableView(gw: GreatWar, seat: GwSeatState): GwTableView | null {
  const t = gw.s.table;
  if (t === null) return null;
  // A bilateral table is the two's, and gone once signed.
  if (t.pair !== undefined && (t.closed || !t.order.includes(seat.tag))) {
    return null;
  }
  const c = openClaim(t);
  const idle = t.done || t.closed || t.round >= GW_TABLE_ROUNDS;
  return {
    session: t.session,
    // A bilateral table sits one month.
    sessions: t.pair === undefined ? GW_TABLE_SESSIONS : 1,
    closed: t.closed,
    done: t.done,
    role: roleOf(gw, seat),
    order: t.order,
    losers: t.order.filter((tag) => {
      const winner = winnerOf(gw);
      return winner !== null && sideOf(gw, tag) !== winner;
    }),
    pair: t.pair === undefined ? null : [t.pair.a, t.pair.b],
    speaker: c !== undefined ? dueBy(c) : idle ? null : t.order[t.at],
    claims: t.claims,
    lines: t.lines.slice(-LINES_SHOWN),
    bill: t.bill,
    over: t.over[seat.tag] ?? 0,
    held: t.held[seat.tag] ?? 0,
    due: dueOf(gw, seat),
    sign: t.order.includes(seat.tag)
      ? { ways: signWays(gw, seat), signed: t.sign?.[seat.tag] ?? null }
      : null,
    fates: seat.fates ?? {},
  };
}

/** What the map became, for the memoir; null where nothing moved or was wanted. */
export function mapRecord(gw: GreatWar, seat: GwSeatState): GwMapRecord | null {
  const t = gw.s.table;
  const places = Object.keys(gw.s.held).sort() as GwPlace[];
  if (t === null && places.length === 0 && seat.claims.length === 0) {
    return null;
  }
  const mine = (t?.claims ?? []).filter(
    (c) =>
      c.state === "traded" && (c.by === seat.tag || c.against === seat.tag),
  );
  return {
    painted: seat.claims,
    got: claimsHeld(gw, seat),
    moves: places.map((place) => ({
      place,
      from: GW_PLACES[place].owner,
      to: gw.s.held[place]!,
    })),
    trades: mine.map((c) => ({
      place: c.place,
      with: c.by === seat.tag ? c.against : c.by,
      trade: c.offer!,
      mine: c.by === seat.tag,
    })),
    held: t?.held[seat.tag] ?? 0,
    over: t?.over[seat.tag] ?? 0,
    role: t === null ? null : roleOf(gw, seat),
  };
}
