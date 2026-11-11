// Great War 1914 (ww171 phase 4, design ww168 B5 and B7): war and peace
// between any pair, as the seat's orders and as a chapter's step.
//
// - A seat declares war from its tab on a country it could fight once the
//   ultimatum has been (a refused note, either way), or at once on a country
//   at war with its coalition's members or its treaty partners. On a seat the
//   declaration goes as an order and arrives next chapter.
// - A seat offers a peace of the two alone to anyone it is at war with. A
//   seat answers on its card (fallback: no); a government nobody plays values
//   it, never rolls it.
// - Governments nobody plays start wars by their state: desire (aims, grudge,
//   the question that divides them), opportunity, duty, fear, against their
//   character's bar; always by an ultimatum first; at most one a year each,
//   and no more than GW_PAIR_WARS_MAX wars outside the coalitions in the world.
// - Wars of a pair's own end in a peace of the two when both are weary.
import type { GwSeatState } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import {
  GW_PAIR_OFFER,
  GW_WAR_NOTE,
} from "@openfront/engine-lib/ww1914/content/ladder";
import { GW_TABLE_AIMS } from "@openfront/engine-lib/ww1914/TableRows";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { pairScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import {
  canFight,
  closeLadder,
  ladderTargets,
  openLadder,
  sendNote,
  sideWeight,
  weight,
} from "./Ladder";
import { holderOf } from "./Land";
import { GW_AI_MAIN } from "./Tables";
import { treatyAllies } from "./Treaties";
import {
  atWarWith,
  declareWar,
  GW_GREAT,
  makePeace,
  outsideCoalitions,
  pairWars,
  pullTreaties,
  startAllies,
  warOf,
} from "./Wars";
import {
  clampTo,
  isLongChapter,
  monthsFrom,
  news,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_AI_WAR = idHash("gw_ai_war");

/** Wars outside the coalitions the world bears at once (design B7). */
export const GW_PAIR_WARS_MAX = 3;
/** Months between two ultimatums an AI sends. */
const AI_NOTE_EVERY = 12;
/** Chapters before a weary country offers again after a refusal. */
const OFFER_AGAIN = 4;

/** A line on every seat of `of`, naming `about` ({country}). */
function say(gw: GreatWar, of: GwTag, key: string, about: GwTag): void {
  const c = gw.s.chapter;
  for (const seat of seatsOf(gw, of)) {
    const same = seat.log.some(
      (l) => l.key === key && l.chapter === c && l.tag === about,
    );
    if (!same) seat.log.push({ key, chapter: c, tag: about });
  }
}

// ---- What a seat may do ----

/** The two have been through an ultimatum: one refused the other's note. */
function noteRefused(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  return gw.s.ladders.some(
    (l) =>
      (l.step === "rejected" || l.step === "mobilised") &&
      ((l.from === a && l.to === b) || (l.from === b && l.to === a)),
  );
}

/** `b` is at war with a partner of `a`'s: no ultimatum is owed it. */
function joinsWar(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  const me = gw.nation(a);
  const them = gw.nation(b);
  if (me === null || them === null) return false;
  return them.atWar.some(
    (x) =>
      x !== a &&
      ((me.side !== null && gw.nation(x)?.side === me.side) ||
        startAllies(a, x) ||
        treatyAllies(gw, a, x)),
  );
}

/** Countries `from` may declare war on now. */
export function warTargets(gw: GreatWar, from: GwTag): GwTag[] {
  const me = gw.nation(from);
  if (me === null || me.out || gw.s.armistice !== null) return [];
  return gw.s.nations
    .filter(
      (n) =>
        n.tag !== from &&
        !atWarWith(gw, from, n.tag) &&
        canFight(gw, from, n.tag) &&
        (noteRefused(gw, from, n.tag) || joinsWar(gw, from, n.tag)) &&
        !gw.s.pairNotes.some(
          (x) => x.kind === "war" && x.from === from && x.to === n.tag,
        ),
    )
    .map((n) => n.tag);
}

/** Countries `from` is at war with and may offer a peace of the two. */
export function peaceTargets(gw: GreatWar, from: GwTag): GwTag[] {
  const me = gw.nation(from);
  if (me === null || me.out || gw.s.armistice !== null) return [];
  return me.atWar.filter(
    (t) =>
      !gw.s.pairNotes.some(
        (x) =>
          x.kind === "peace" &&
          ((x.from === from && x.to === t) || (x.from === t && x.to === from)),
      ),
  );
}

/** The seat's country declares war: on a seat, as the chapter closes. */
export function seatDeclares(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
  cause = "declared",
): void {
  const s = gw.s;
  if (atWarWith(gw, seat.tag, to)) return;
  closeLadder(gw, seat.tag, to);
  if (ruledBySeat(gw, to)) {
    const sent = s.pairNotes.some(
      (x) => x.kind === "war" && x.from === seat.tag && x.to === to,
    );
    if (sent) return;
    s.pairNotes.push({ from: seat.tag, to, kind: "war", chapter: s.chapter });
    say(gw, seat.tag, "war_note_sent", to);
    for (const t of seatsOf(gw, to)) {
      t.scheduled.push({ scene: GW_WAR_NOTE, chapter: s.chapter + 1 });
    }
    return;
  }
  declareWar(gw, seat.tag, to, cause);
}

/** The world effect `declare_war`: the tab's row, against its target. */
export function declareFromTab(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
): void {
  if (!warTargets(gw, seat.tag).includes(to)) return;
  seatDeclares(gw, seat, to);
}

/** A peace offer goes out; a seat gets its card next chapter. */
function offerPeace(gw: GreatWar, from: GwTag, to: GwTag): void {
  const s = gw.s;
  s.pairNotes.push({ from, to, kind: "peace", chapter: s.chapter });
  news(gw, "pair_peace_offered", from, to);
  say(gw, from, "peace_offer_sent", to);
  for (const t of seatsOf(gw, to)) {
    t.scheduled.push({ scene: GW_PAIR_OFFER, chapter: s.chapter + 1 });
  }
}

/** The world effect `pair_peace`: the seat offers a peace of the two. */
export function seatOffersPeace(
  gw: GreatWar,
  seat: GwSeatState,
  to: GwTag,
): void {
  if (!peaceTargets(gw, seat.tag).includes(to)) return;
  offerPeace(gw, seat.tag, to);
}

function refused(gw: GreatWar, from: GwTag, to: GwTag): void {
  news(gw, "pair_peace_refused", to, from);
  say(gw, from, "peace_offer_refused", to);
  say(gw, to, "peace_offer_we_refused", from);
}

/** The world effect `pair_peace_answer`: the seat's card is answered. */
export function peaceAnswer(
  gw: GreatWar,
  seat: GwSeatState,
  yes: boolean,
): void {
  const s = gw.s;
  const i = s.pairNotes.findIndex(
    (x) => x.kind === "peace" && x.to === seat.tag,
  );
  if (i < 0) return;
  const [note] = s.pairNotes.splice(i, 1);
  if (!atWarWith(gw, note.from, note.to)) return;
  if (yes) makePeace(gw, note.from, note.to, "pair_peace");
  else refused(gw, note.from, note.to);
}

// ---- What a government nobody plays weighs ----

/**
 * How ready a country is to stop its war with `foe`: the months of it, its
 * own weariness, how the war on their fronts stands, its character.
 */
export function peaceWill(gw: GreatWar, tag: GwTag, foe: GwTag): number {
  const n = gw.nation(tag);
  const w = warOf(gw, tag, foe);
  if (n === null || w === null) return 0;
  let will = monthsFrom(gw, w.since) * 4;
  if (n.gauges.morale <= 1) will += 20;
  else if (n.gauges.morale <= 2) will += 10;
  if (n.manpower < 25) will += 15;
  if (n.unrest >= 2) will += 15;
  will -= Math.floor(pairScore(gw, tag, foe) / 2);
  will += { cautious: 15, opportunist: 10, principled: 0, hardline: -15 }[n.ai];
  return will;
}

/** Will it take a peace of the two? Valued, never rolled. */
export function takesPeace(gw: GreatWar, tag: GwTag, foe: GwTag): boolean {
  const w = warOf(gw, tag, foe);
  if (w === null) return false;
  // Leaving a coalition's war is a separate peace: it wants far more.
  return peaceWill(gw, tag, foe) >= (outsideCoalitions(gw, w) ? 40 : 75);
}

/** Offers to a government nobody plays are answered as the chapter closes. */
function answerOffers(gw: GreatWar): void {
  const s = gw.s;
  const keep: typeof s.pairNotes = [];
  for (const x of s.pairNotes) {
    if (x.kind !== "peace" || !atWarWith(gw, x.from, x.to)) continue;
    if (ruledBySeat(gw, x.to)) {
      // The card's fallback answered it; a lost card lapses.
      if (s.chapter - x.chapter < 2) keep.push(x);
      else refused(gw, x.from, x.to);
      continue;
    }
    if (x.chapter === s.chapter && takesPeace(gw, x.to, x.from)) {
      makePeace(gw, x.from, x.to, "pair_peace");
    } else {
      refused(gw, x.from, x.to);
    }
  }
  s.pairNotes = keep.concat(s.pairNotes.filter((x) => x.kind === "war"));
}

/** Seat-to-seat declarations arrive as the chapter closes. */
function deliverDeclarations(gw: GreatWar): void {
  const s = gw.s;
  const war = s.pairNotes.filter((x) => x.kind === "war");
  s.pairNotes = s.pairNotes.filter((x) => x.kind !== "war");
  for (const x of war) declareWar(gw, x.from, x.to, "declared");
}

/** A refusal is fresh: the weary side waits before it asks again. */
function refusedLately(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  return gw.s.news.some(
    (x) =>
      x.key === "pair_peace_refused" &&
      gw.s.chapter - x.chapter < OFFER_AGAIN &&
      ((x.a === a && x.b === b) || (x.a === b && x.b === a)),
  );
}

/**
 * Wars of a pair's own wind down: two governments nobody plays make peace
 * once both are weary enough between them; one facing a seat offers it.
 */
function aiPeaceStep(gw: GreatWar): void {
  for (const w of pairWars(gw)) {
    const seatA = ruledBySeat(gw, w.a);
    const seatB = ruledBySeat(gw, w.b);
    if (seatA && seatB) continue;
    if (seatA || seatB) {
      const ai = seatA ? w.b : w.a;
      const seat = seatA ? w.a : w.b;
      if (refusedLately(gw, ai, seat)) continue;
      if (gw.s.pairNotes.some((x) => x.kind === "peace" && x.from === ai)) {
        continue;
      }
      if (takesPeace(gw, ai, seat)) offerPeace(gw, ai, seat);
      continue;
    }
    if (peaceWill(gw, w.a, w.b) + peaceWill(gw, w.b, w.a) >= 80) {
      makePeace(gw, w.a, w.b, "pair_peace");
    }
  }
}

/** It sent a note within the year: one new war a year at most (design B7). */
function notedLately(gw: GreatWar, tag: GwTag): boolean {
  return gw.s.ladders.some(
    (l) => l.from === tag && monthsFrom(gw, l.opened) < AI_NOTE_EVERY,
  );
}

/** The bar a character's case for war must clear. */
const WAR_BAR = {
  hardline: 30,
  opportunist: 40,
  principled: 55,
  cautious: 65,
} as const;

/**
 * An AI country's case for war on `to`, over its character's bar (below 0:
 * no case): desire, opportunity and duty against fear (design B5). Read off
 * the state.
 */
export function warCase(gw: GreatWar, from: GwTag, to: GwTag): number {
  const s = gw.s;
  const n = gw.nation(from)!;
  const t = gw.nation(to)!;
  // Desire: land it wants that the other holds; a grudge; the open question.
  const aims = (GW_TABLE_AIMS[from] ?? []).filter(
    (p) => holderOf(gw, p) === to || GW_PLACES[p].owner === to,
  ).length;
  let score = Math.min(36, aims * 12);
  if ((n.trust[to] ?? 0) <= -2) score += 15;
  const balkan = ["SRB", "BGR", "GRC", "ROU", "MNE", "OTT", "AUH"];
  if (balkan.includes(from) && balkan.includes(to)) {
    score += Math.min(10, s.pressure.balkan);
  }
  if (from === "OTT" || to === "OTT") score += Math.min(10, s.pressure.straits);
  // Opportunity: busy elsewhere, weaker, worn out.
  if (t.atWar.length > 0) score += 15;
  const mine = weight(gw, from);
  const theirs = weight(gw, to);
  score += mine >= theirs * 2 ? 15 : mine > theirs ? 5 : -10;
  if (t.gauges.morale <= 1 || t.manpower < 20) score += 10;
  // Duty: it fights a partner's war already.
  if (joinsWar(gw, from, to)) score += 20;
  // Fear: its friends, our own war, our own state, a great power.
  if (sideWeight(gw, to) > sideWeight(gw, from)) score -= 20;
  if (n.atWar.length > 0) score -= 30;
  if (n.gauges.morale <= 2) score -= 15;
  if (GW_GREAT.includes(to)) score -= 15;
  return score - WAR_BAR[n.ai];
}

/**
 * Once a month the governments nobody plays look for a war: the strongest
 * case in the world over its bar, a seeded roll, then the ultimatum. Never
 * in the July crisis, which has its own ladder.
 */
function aiWarStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.chain !== null || pairWars(gw).length >= GW_PAIR_WARS_MAX) return;
  let best: { from: GwTag; to: GwTag; score: number } | null = null;
  for (const n of s.nations) {
    if (n.out || ruledBySeat(gw, n.tag) || GW_AI_MAIN[n.tag] === undefined) {
      continue;
    }
    if (openLadder(gw, n.tag) !== null || notedLately(gw, n.tag)) continue;
    for (const to of ladderTargets(gw, n.tag)) {
      const score = warCase(gw, n.tag, to);
      if (score < 0) continue;
      if (best === null || score > best.score) {
        best = { from: n.tag, to, score };
      }
    }
  }
  if (best === null) return;
  const roll = wwRoll(s.seed, P_AI_WAR, s.chapter, idHash(best.from)) % 100;
  if (roll >= clampTo(30 + best.score, 30, 80)) return;
  sendNote(gw, best.from, best.to);
}

/**
 * Chapter step, after the ladder: declarations between seats arrive, peace
 * offers are answered, treaties pull partners into young wars, and once a
 * month the governments nobody plays end their wars and start new ones.
 */
export function warStep(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null) {
    s.pairNotes = [];
    return;
  }
  deliverDeclarations(gw);
  answerOffers(gw);
  pullTreaties(gw);
  if (!isLongChapter(gw)) return;
  aiPeaceStep(gw);
  aiWarStep(gw);
}

// ---- Conditions for the scenes of new wars and peaces ----

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

export function pairHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: Extract<
    GwWorldCond,
    {
      is:
        | "war_target"
        | "peace_target"
        | "pair_war"
        | "pair_peace"
        | "front_months"
        | "peace_offered";
    }
  >,
): boolean {
  const s = gw.s;
  switch (c.is) {
    case "war_target":
      return warTargets(gw, seat.tag).includes(c.tag);
    case "peace_target":
      return peaceTargets(gw, seat.tag).includes(c.tag);
    case "pair_war":
    case "pair_peace": {
      const me = c.tag ?? seat.tag;
      return s.wars.some((w) => {
        if (w.a !== me && w.b !== me) return false;
        const foe = w.a === me ? w.b : w.a;
        if (c.with !== undefined && foe !== c.with) return false;
        if (c.is === "pair_peace") {
          return w.ended !== null && inRange(monthsFrom(gw, w.ended), c);
        }
        if (w.ended !== null) return false;
        if (c.outside === true && !outsideCoalitions(gw, w)) return false;
        if (c.cause !== undefined && !c.cause.includes(w.cause)) return false;
        return inRange(monthsFrom(gw, w.since), c);
      });
    }
    case "front_months": {
      const t = s.theatres.find((x) => x.id === c.theatre)!;
      return t.open && t.since !== null && inRange(monthsFrom(gw, t.since), c);
    }
    case "peace_offered":
      return s.pairNotes.some(
        (x) =>
          x.kind === "peace" &&
          x.to === seat.tag &&
          (c.tag === undefined || x.from === c.tag),
      );
  }
}
