// Great War 1914 (먼저 움직이는 외교): the seat offers a country terms first, from
// clauses built on what the game already keeps: a neutral's price, money, grain,
// shells, a way out of the war. The country answers when the chapter closes, by
// its valuation; nothing is rolled. Only a country nobody plays answers.
import {
  GW_ASK_CLAUSES,
  GW_GIVE_CLAUSES,
  GwAskClause,
  GwGiveClause,
  GwNationState,
  GwSeatState,
  GwSide,
  GwTermRefusal,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag, isGwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwOrderBlock } from "@openfront/engine-api/ww1914/GwOrders";
import type { GwTermsView } from "@openfront/engine-api/ww1914/GwView";
import { daysFromCivil } from "@openfront/engine-lib/ww1936/Calendar";
import { moveMoney } from "./Budget";
import { claimsOn } from "./Claims";
import { warMonths } from "./Eras";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { armistice, TALKS_MONTHS } from "./Peace";
import { GW_ACTORS, GW_ENTRIES, GW_ENTRY_BAR } from "./Tables";
import { enter, leaveWar } from "./Wars";
import { clampTo, fights, moveGauge, news, other, ruledBySeat } from "./World";

/** What a clause is worth to the country, by their measure. */
const GIVE_WORTH: Readonly<Record<GwGiveClause, number>> = {
  price: 14,
  credit: 8,
  grain: 8,
  shells: 8,
  guarantee: 6,
};
const ASK_COST: Readonly<Record<GwAskClause, number>> = {
  peace: 30,
  join: 30,
  stay_out: 12,
  credit: 10,
  grain: 10,
  shells: 12,
  mediate: 6,
};
/** Each step of its trust in the seat, and its leaning, count this much. */
const TRUST_WORTH = 4;
/** What each place of its own the seat has painted takes off, and the most. */
const PAINTED_WORTH = 3;
const PAINTED_MOST = 15;
const LEAN_WORTH = 6;
/** The side ahead by this much is the side worth being near. */
const AHEAD_AT = 15;
const AHEAD_WORTH = 8;
/** Readiness short of its bar that makes one point of a neutral's price. */
const READINESS_PER_POINT = 4;
/** What going against a neutral's natural side costs. */
const AGAINST_NATURE = 12;
/** Chapters before the same country will hear terms again. */
const TERMS_REST = 3;
/** A gauge must keep this much to give any of it. */
const GIVE_FLOOR = 2;
/** Readiness a neutral gives up for staying out. */
const STAY_OUT = 30;
/** What mediation takes off the crisis. */
const MEDIATE_TEMP = 2;

const dayOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return daysFromCivil(y, m, d);
};

function entryOf(tag: GwTag) {
  return GW_ENTRIES.find((e) => e.tag === tag) ?? null;
}

const guaranteeFlag = (n: GwNationState) =>
  `f_guarantee_${n.tag.toLowerCase()}`;

function giveOpen(
  seat: GwSeatState,
  me: GwNationState,
  n: GwNationState,
  c: GwGiveClause,
): boolean {
  const foe = me.side !== null && n.side === other(me.side);
  switch (c) {
    case "price": {
      const e = entryOf(n.tag);
      if (e === null || n.side !== null || me.side === null) return false;
      return (n.offers[me.side] ?? 0) < e.offers[me.side];
    }
    case "credit":
      return !foe && me.gauges.money >= GIVE_FLOOR;
    case "grain":
      return !foe && me.gauges.bread >= GIVE_FLOOR;
    case "shells":
      return !foe && me.gauges.shells >= GIVE_FLOOR;
    case "guarantee":
      return !foe && !seat.flags.includes(guaranteeFlag(n));
  }
}

function askOpen(
  gw: GreatWar,
  me: GwNationState,
  n: GwNationState,
  c: GwAskClause,
): boolean {
  const foe = me.side !== null && n.side === other(me.side);
  const friend = me.side !== null && n.side === me.side;
  switch (c) {
    case "peace":
      return foe && fights(n);
    case "join": {
      const e = entryOf(n.tag);
      if (e === null || n.side !== null || me.side === null) return false;
      return gw.s.day >= dayOf(e.earliest);
    }
    case "stay_out":
      return n.side === null;
    case "credit":
    case "grain":
      return !foe;
    case "shells":
      return friend;
    case "mediate":
      return gw.s.chain !== null && n.side === null;
  }
}

function targets(gw: GreatWar, seat: GwSeatState): GwNationState[] {
  return gw.s.nations.filter(
    (n) =>
      GW_ACTORS.includes(n.tag) &&
      n.tag !== seat.tag &&
      !n.out &&
      !ruledBySeat(gw, n.tag) &&
      !seat.terms.some(
        (t) => t.tag === n.tag && gw.s.chapter - t.chapter <= TERMS_REST,
      ),
  );
}

/** Applies the `terms` order; null when it took effect. */
export function offerTerms(
  gw: GreatWar,
  seat: GwSeatState,
  tag: string,
  give: readonly GwGiveClause[],
  ask: readonly GwAskClause[],
): GwOrderBlock | null {
  if (seat.terms.some((t) => t.chapter === gw.s.chapter)) return "terms_sent";
  const me = gw.nation(seat.tag);
  if (me === null || !isGwTag(tag)) return "no_terms";
  const n = targets(gw, seat).find((x) => x.tag === tag);
  if (n === undefined || give.length + ask.length === 0) return "no_terms";
  if (new Set(give).size !== give.length) return "no_terms";
  if (new Set(ask).size !== ask.length) return "no_terms";
  if (!give.every((c) => giveOpen(seat, me, n, c))) return "no_terms";
  if (!ask.every((c) => askOpen(gw, me, n, c))) return "no_terms";
  seat.terms.push({
    tag,
    give: [...give],
    ask: [...ask],
    chapter: gw.s.chapter,
    yes: null,
    why: null,
  });
  return null;
}

/** The side ahead as this country would hear it; null when it is close. */
function ahead(gw: GreatWar): GwSide | null {
  const score = warScore(gw, "central");
  if (score >= AHEAD_AT) return "central";
  if (score <= -AHEAD_AT) return "entente";
  return null;
}

/** What a character adds to the price of a clause. */
function characterCost(n: GwNationState, c: GwAskClause): number {
  if (c === "peace") {
    return { hardline: 14, principled: 8, opportunist: 0, cautious: 0 }[n.ai];
  }
  if (c === "join") {
    return { hardline: 0, principled: 6, opportunist: 4, cautious: 12 }[n.ai];
  }
  return 0;
}

/** How far a neutral is from coming in by itself, and against its nature. */
function reluctance(n: GwNationState, me: GwNationState): number {
  const gap = Math.max(0, GW_ENTRY_BAR[n.ai] - n.readiness);
  const natural = entryOf(n.tag)?.natural ?? null;
  const against = natural !== null && natural !== me.side;
  return Math.floor(gap / READINESS_PER_POINT) + (against ? AGAINST_NATURE : 0);
}

/** What a clause costs this country now: each time it gave it, as much again. */
function askCost(
  seat: GwSeatState,
  me: GwNationState,
  n: GwNationState,
  c: GwAskClause,
): number {
  const before = seat.terms.filter(
    (t) => t.tag === n.tag && t.yes === true && t.ask.includes(c),
  ).length;
  const own = c === "join" ? reluctance(n, me) : 0;
  return ASK_COST[c] * (1 + before) + characterCost(n, c) + own;
}

/** What the country makes of the seat, apart from the clauses. */
function goodwill(
  gw: GreatWar,
  seat: GwSeatState,
  me: GwNationState,
  n: GwNationState,
): number {
  let v = (n.trust[me.tag] ?? 0) * TRUST_WORTH;
  v -= Math.min(PAINTED_MOST, claimsOn(seat, n.tag) * PAINTED_WORTH);
  if (me.side !== null) {
    const towards = me.side === "entente" ? n.lean : -n.lean;
    v += towards * LEAN_WORTH;
    const best = ahead(gw);
    const weight = n.ai === "opportunist" ? 2 : 1;
    if (best === me.side) v += AHEAD_WORTH * weight;
    else if (best !== null) v -= AHEAD_WORTH * weight;
  }
  return v;
}

/** How tired a country at war is: what a peace is worth to it. */
export function weariness(n: GwNationState): number {
  return (
    (n.gauges.morale <= 2 ? 6 : 0) +
    (n.gauges.order <= 2 ? 6 : 0) +
    (n.gauges.bread <= 1 ? 6 : 0) +
    (n.unrest >= 1 ? 6 : 0)
  );
}

type Term = GwSeatState["terms"][number];

/** Its answer: null is yes, a word is why not. */
function valuation(
  gw: GreatWar,
  seat: GwSeatState,
  me: GwNationState,
  n: GwNationState,
  t: Term,
): GwTermRefusal | null {
  if (!t.ask.every((c) => askOpen(gw, me, n, c))) return "bound";
  const peace = t.ask.includes("peace");
  if (peace && warMonths(gw) < TALKS_MONTHS) return "too_soon";
  const given = t.give.reduce((v, c) => v + GIVE_WORTH[c], 0);
  const asked = t.ask.reduce((v, c) => v + askCost(seat, me, n, c), 0);
  const will = goodwill(gw, seat, me, n);
  if (given + (peace ? weariness(n) : 0) + will >= asked) return null;
  const big = peace || t.ask.includes("join");
  const best = ahead(gw);
  if (big && best !== null && best !== me.side) return "winning";
  if ((n.trust[me.tag] ?? 0) < 0) return "no_trust";
  return "too_little";
}

function moveTrust(n: GwNationState, tag: GwTag, delta: number): void {
  n.trust[tag] = clampTo((n.trust[tag] ?? 0) + delta, -3, 3);
}

function pay(
  gw: GreatWar,
  seat: GwSeatState,
  me: GwNationState,
  n: GwNationState,
  c: GwGiveClause,
): void {
  switch (c) {
    case "price":
      if (me.side !== null) n.offers[me.side] = (n.offers[me.side] ?? 0) + 1;
      return;
    case "credit":
      moveMoney(gw, me, -1, "money_scene");
      return;
    case "grain":
      moveGauge(gw, me.tag, "bread", -1, "terms_grain");
      moveGauge(gw, n.tag, "bread", 1, "terms_grain");
      return;
    case "shells":
      moveGauge(gw, me.tag, "shells", -1, "terms_shells");
      moveGauge(gw, n.tag, "shells", 1, "terms_shells");
      return;
    case "guarantee":
      gw.s.temp = clampTo(gw.s.temp + (gw.s.chain === null ? 0 : 1), 0, 10);
      seat.flags.push(guaranteeFlag(n));
      return;
  }
}

function collect(
  gw: GreatWar,
  me: GwNationState,
  n: GwNationState,
  c: GwAskClause,
): void {
  switch (c) {
    case "peace": {
      const lead: readonly GwTag[] = ["DEU", "FRA", "GBR"];
      if (lead.includes(n.tag)) armistice(gw, "compromise", null);
      else leaveWar(gw, n.tag, "sued_for_peace");
      return;
    }
    case "join":
      if (me.side !== null) enter(gw, n.tag, me.side, "entered_war");
      return;
    case "stay_out":
      n.readiness = clampTo(n.readiness - STAY_OUT, 0, 100);
      return;
    case "credit":
      moveMoney(gw, me, 1, "money_scene");
      return;
    case "grain":
      moveGauge(gw, me.tag, "bread", 1, "terms_grain");
      moveGauge(gw, n.tag, "bread", -1, "terms_grain");
      return;
    case "shells":
      moveGauge(gw, me.tag, "shells", 1, "terms_shells");
      moveGauge(gw, n.tag, "shells", -1, "terms_shells");
      return;
    case "mediate":
      gw.s.temp = clampTo(gw.s.temp - MEDIATE_TEMP, 0, 10);
      return;
  }
}

/** Chapter step: terms sent this chapter have their answer. */
export function termsStep(gw: GreatWar): void {
  for (const seat of gw.s.seats) {
    const me = gw.nation(seat.tag);
    for (const t of seat.terms) {
      if (t.yes !== null || me === null) continue;
      const n = gw.nation(t.tag);
      const why = n === null || n.out ? "bound" : valuation(gw, seat, me, n, t);
      t.yes = why === null;
      t.why = why;
      seat.log.push({
        key: t.yes ? "terms_yes" : "terms_no",
        chapter: gw.s.chapter,
        tag: t.tag,
      });
      if (n === null || !t.yes) continue;
      for (const c of t.give) pay(gw, seat, me, n, c);
      for (const c of t.ask) collect(gw, me, n, c);
      moveTrust(me, t.tag, 1);
      moveTrust(n, seat.tag, 1);
      news(gw, "terms_signed", seat.tag, t.tag);
    }
  }
}

/** The screen's list: who can be approached with what, and what they said. */
export function termsView(gw: GreatWar, seat: GwSeatState): GwTermsView {
  const me = gw.nation(seat.tag);
  return {
    sent: seat.terms.some((t) => t.chapter === gw.s.chapter),
    targets:
      me === null
        ? []
        : targets(gw, seat).map((n) => ({
            tag: n.tag,
            give: GW_GIVE_CLAUSES.filter((c) => giveOpen(seat, me, n, c)),
            ask: GW_ASK_CLAUSES.filter((c) => askOpen(gw, me, n, c)),
          })),
    log: seat.terms.slice(-TERMS_SHOWN).map((t) => ({
      tag: t.tag,
      give: t.give,
      ask: t.ask,
      yes: t.yes,
      why: t.why,
    })),
  };
}

const TERMS_SHOWN = 4;
