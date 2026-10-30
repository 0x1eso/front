// World War 1936: white peace (owner-approved plan, 2026-10-30). A war's
// side leader offers the whole war a white peace; an ordinary member offers
// a separate peace (it alone leaves that war and its faction, Finland
// 1944). The other side's leader answers: a human by a card (30 s, refused
// at the deadline), the AI by the war's state and a seeded roll. Peace
// goes through P3 end_war (occupied land back to its legal owner, the
// armies home; occupation zones stay), no conference opens (winner -1),
// and the two sides keep a one-year truce. Integers only; wars, countries
// and offers by id.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_COOLDOWN_DAYS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  WW_WHITE_PEACE_STALEMATE_DAYS,
  WwPeaceOfferView,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { leaveFaction } from "../politics/Factions";
import { payPp } from "../politics/PayPp";
import { endWarBetween } from "../politics/Territory";
import { countryParams } from "./Wars";
import type { PeaceOffer, WwEndgame } from "./WwEndgame";

// ---- The AI's rule (named thresholds; ‰ of victory points or of the surrender line) ----

/** The AI target refuses outright when the proposer is this close to its surrender line (‰). */
export const AI_PEACE_REFUSE_CAP_PM = 700;
/** …or when its side holds this much of the proposer's land (‰ of victory points). */
export const AI_PEACE_REFUSE_HELD_PM = 300;
/** Accept chance (percent) at its own surrender line, less in proportion. */
export const AI_PEACE_LOSING_PCT = 50;
/** Accept chance (percent) when the proposer holds all of its side's land, less in proportion. */
export const AI_PEACE_LOST_LAND_PCT = 40;
/** Accept chance (percent) once the front has been stalemated WW_WHITE_PEACE_STALEMATE_DAYS. */
export const AI_PEACE_STALEMATE_PCT = 15;
/** War support (bp) under which the accept chance rises… */
export const AI_PEACE_LOW_WS_BP = 5000;
/** …by up to this much (percent) at 0 war support. */
export const AI_PEACE_LOW_WS_PCT = 40;
/** The accept chance never passes this (percent). */
export const AI_PEACE_MAX_PCT = 85;
/** The AI offers peace when losing badly: this close to its surrender line (‰)… */
export const AI_PROPOSE_CAP_PM = 500;
/** …or the enemy holds this much of its (its side's, for a leader) land (‰). */
export const AI_PROPOSE_LOST_PM = 250;
/** A stalemate offer only while neither side holds this much more of the other's land (‰). */
export const AI_PROPOSE_EVEN_PM = 100;
/** …and only from a side leader whose war support (bp) is under this (war-weary). */
export const AI_PROPOSE_WS_BP = 5000;
/** The front "barely changed": at most this many regions changed hands since the stalemate began. */
export const WW_STALEMATE_REGIONS = 2;
/** Occupation rows an offer's card shows. */
const HELD_ROWS = 4;
const P_WPEACE = idHash("white_peace");

type Member = WwWar["sides"][0]["members"][number];
const fighting = (m: Member | null): boolean =>
  m !== null && (m.state === "active" || m.state === "exiled");

/** A puppet (or integrated subject) follows its overlord: it never offers peace itself. */
function isPuppet(eg: WwEndgame, id: number): boolean {
  const s = eg.subjectOf(id);
  return s !== null && (s.level === "integrated" || s.level === "puppet");
}

/** `id`'s puppets fighting on its side of `w` (ascending): its separate peace covers them. */
function followers(eg: WwEndgame, w: WwWar, id: number): number[] {
  const s = eg.sideIndex(w, id);
  if (s < 0) return [];
  return eg
    .subjectsOf(id)
    .filter(
      (x) =>
        isPuppet(eg, x) &&
        eg.sideIndex(w, x) === s &&
        fighting(eg.member(w, x)),
    );
}

/** Every member of side `s` of `w` (any state). */
function sideIds(w: WwWar, s: 0 | 1): number[] {
  return w.sides[s].members.map((m) => m.id);
}

/** The countries an offer makes peace for: the whole side, or the proposer and its puppets. */
function proposerGroup(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
): number[] {
  const s = eg.sideIndex(w, from);
  if (s === -1) return [];
  return whole ? sideIds(w, s) : [from, ...followers(eg, w, from)];
}

/** Pairs [a, b] (a < b) at war under `w`'s record, in key order. */
function pairsOf(eg: WwEndgame, w: WwWar): [number, number][] {
  const out: [number, number][] = [];
  for (const [k, v] of eg.pairWar) {
    if (v === w.id) out.push([Math.floor(k / eg.size), k % eg.size]);
  }
  return out.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
}

/**
 * ‰ of the victory points of the regions `owners` legally own that
 * `holders` control (0 when they own none).
 */
export function heldPm(
  eg: WwEndgame,
  holders: readonly number[],
  owners: readonly number[],
): number {
  const h = new Set(holders);
  const o = new Set(owners);
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  let total = 0;
  let held = 0;
  for (const r of eg.ww.scenario.landRegions) {
    if (!o.has(legal[r.id] ?? 0)) continue;
    total += r.vp;
    if (h.has(ctrl[r.id] ?? 0)) held += r.vp;
  }
  return total > 0 ? Math.floor((held * 1000) / total) : 0;
}

/**
 * How far `id` is to its surrender line, ‰ (P0's check: the victory points
 * of its legal land it lost, against its line; 1000 at or past it). An
 * exile, or a country with nothing to lose, counts as at the line or at 0.
 */
export function surrenderPm(eg: WwEndgame, id: number): number {
  if (eg.isExile(id) || eg.ww.isCapitulated(id)) return 1000;
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  let start = 0;
  let held = 0;
  for (const r of eg.ww.scenario.landRegions) {
    if ((legal[r.id] ?? 0) !== id) continue;
    start += r.vp;
    if ((ctrl[r.id] ?? 0) === id) held += r.vp;
  }
  let lost = start - held;
  let line = start;
  const base = Math.min(eg.capitulationBase(id), lost);
  lost -= base;
  line -= base;
  const pct = eg.ww.politics.surrenderPct(id);
  if (line <= 0 || pct <= 0) return 0;
  return Math.min(1000, Math.floor((lost * 100_000) / (line * pct)));
}

// ---- The front (stalemate) ----

/**
 * Regions of side 1's legal land side 0 controls, the other way round, and
 * whether there is a front at all: a region side 0 controls next to one
 * side 1 controls (a war across the sea alone has none).
 */
function frontCounts(eg: WwEndgame, w: WwWar): [number, number, boolean] {
  const side = new Int8Array(eg.size).fill(-1);
  for (const s of [0, 1] as const) {
    for (const m of w.sides[s].members) side[m.id] = s;
  }
  const sideAt = (c: number) => (c > 0 && c < eg.size ? side[c] : -1);
  const sc = eg.ww.scenario;
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  let a = 0;
  let b = 0;
  let contact = false;
  for (const r of sc.landRegions) {
    const c = ctrl[r.id] ?? 0;
    const sc0 = sideAt(c);
    if (!contact && sc0 === 0) {
      contact = sc.edgesOf(r.id).some((e) => sideAt(ctrl[e.to] ?? 0) === 1);
    }
    const l = legal[r.id] ?? 0;
    if (c === l || sc0 < 0) continue;
    const sl = sideAt(l);
    if (sc0 === 0 && sl === 1) a++;
    else if (sc0 === 1 && sl === 0) b++;
  }
  return [a, b, contact];
}

/**
 * The day's common step: each ongoing normal war's front — [war, regions
 * side 0 holds of side 1, the other way, the day it last really moved]. A
 * change of more than WW_STALEMATE_REGIONS regions since that day starts
 * the count again; a new war counts from its first day. A war without a
 * front (the sides touch nowhere on land) is no stalemate: its count
 * starts again every day.
 */
export function stepFronts(eg: WwEndgame, day: number): void {
  const next: [number, number, number, number][] = [];
  for (const w of eg.wars) {
    if (w.ended !== null || w.kind !== "normal") continue;
    const [a, b, contact] = frontCounts(eg, w);
    const prev = eg.fronts.find((f) => f[0] === w.id);
    if (!contact) next.push([w.id, a, b, day]);
    else if (prev === undefined) next.push([w.id, a, b, w.startDay]);
    else if (
      Math.abs(a - prev[1]) + Math.abs(b - prev[2]) >
      WW_STALEMATE_REGIONS
    )
      next.push([w.id, a, b, day]);
    else next.push(prev);
  }
  eg.fronts = next;
}

/** Days the front of war `warId` has barely moved (0: not tracked). */
export function stalemateDays(
  eg: WwEndgame,
  warId: number,
  day: number,
): number {
  const f = eg.fronts.find((x) => x[0] === warId);
  return f === undefined ? 0 : Math.max(0, day - f[3]);
}

// ---- Truces and cooldowns ----

/** The last day + 1 of the truce between `a` and `b` (0: none). */
export function truceUntil(eg: WwEndgame, a: number, b: number): number {
  if (eg.truces.length === 0) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return eg.truces.find((t) => t[0] === lo && t[1] === hi)?.[2] ?? 0;
}

function setTruce(eg: WwEndgame, a: number, b: number, until: number): void {
  if (a === b) return;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const t = eg.truces.find((x) => x[0] === lo && x[1] === hi);
  if (t !== undefined) t[2] = Math.max(t[2], until);
  else {
    eg.truces.push([lo, hi, until]);
    eg.truces.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  }
  eg.dirtyPeace = true;
}

/** The day `from` may offer `to` again after a refusal (0: now). */
export function cooldownUntil(eg: WwEndgame, from: number, to: number): number {
  return eg.peaceCooldowns.find((c) => c[0] === from && c[1] === to)?.[2] ?? 0;
}

/** The day's common step: truces and cooldowns that ran out go. */
export function expirePeaceTimers(eg: WwEndgame, day: number): void {
  const t = eg.truces.filter((x) => x[2] > day);
  const c = eg.peaceCooldowns.filter((x) => x[2] > day);
  if (t.length !== eg.truces.length || c.length !== eg.peaceCooldowns.length) {
    eg.truces = t;
    eg.peaceCooldowns = c;
    eg.dirtyPeace = true;
  }
}

// ---- Offers ----

/**
 * Why `from` may not offer a white peace in war `warId` to `target` on
 * `day` (null: it may). The target is the other side's leader; the war a
 * normal one at least WW_WHITE_PEACE_MIN_DAYS old; the proposer a fighting
 * member that is no puppet, with WW_WHITE_PEACE_PP political power, no
 * offer of its own pending in that war and no refusal from the target in
 * the last WW_WHITE_PEACE_COOLDOWN_DAYS.
 */
export function peaceOfferBlock(
  eg: WwEndgame,
  from: number,
  warId: number,
  target: number,
  day: number,
): WwOrderBlock | null {
  const w = eg.war(warId);
  if (w === null || w.ended !== null) return "not_at_war";
  if (w.kind !== "normal") return "peace_war_kind";
  const s = eg.sideIndex(w, from);
  if (s === -1 || !fighting(eg.member(w, from))) return "not_at_war";
  if (!eg.isActor(from)) return "dead";
  if (isPuppet(eg, from)) return "subject_restricted";
  const leader = w.sides[1 - s].leader;
  if (
    target !== leader ||
    !eg.isActor(target) ||
    !fighting(eg.member(w, target))
  ) {
    return "bad_target";
  }
  // It must still fight someone there (its pairs, or its side's).
  const whole = w.sides[s].leader === from;
  const group = new Set(proposerGroup(eg, w, from, whole));
  if (!pairsOf(eg, w).some(([a, b]) => group.has(a) || group.has(b))) {
    return "not_at_war";
  }
  if (day - w.startDay < WW_WHITE_PEACE_MIN_DAYS) return "peace_too_early";
  if (cooldownUntil(eg, from, target) > day) return "peace_cooldown";
  if (eg.peaceOffers.some((o) => o.from === from && o.war === warId)) {
    return "peace_pending";
  }
  const c = eg.ww.politics.country(from);
  if (c === null || c.ppMilli < WW_WHITE_PEACE_PP * 1000) return "no_pp";
  return null;
}

/**
 * peace_offer: `from` offers `target` a white peace in war `warId` — the
 * whole war when it leads its side, else a separate peace. The political
 * power goes now; a human target gets the card until its deadline.
 */
export function offerPeace(
  eg: WwEndgame,
  from: number,
  warId: number,
  target: number,
  tick: number,
): WwOrderBlock | null {
  const day = eg.ww.day(tick);
  const block = peaceOfferBlock(eg, from, warId, target, day);
  if (block !== null) return block;
  const pol = eg.ww.politics;
  if (!payPp(pol, from, WW_WHITE_PEACE_PP)) return "no_pp";
  pol.markCountry(from);
  const w = eg.war(warId)!;
  const s = eg.sideIndex(w, from);
  if (s === -1) return "not_at_war";
  const whole = w.sides[s].leader === from;
  const human = eg.isHumanControlled(target);
  eg.peaceOffers.push({
    id: eg.nextOfferId++,
    war: warId,
    from,
    to: target,
    whole,
    sentTick: tick,
    // Its real 30 s at the game's pace (Pace: fewer, longer ticks unlimited).
    deadlineTick: human
      ? tick +
        wwRealTicks(eg.mg.config().gameConfig(), WW_WHITE_PEACE_CARD_TICKS)
      : tick,
  });
  eg.dirtyPeace = true;
  return null;
}

/** peace_reply: `smallID` answers an offer made to it (now). */
export function replyPeace(
  eg: WwEndgame,
  smallID: number,
  offerId: number,
  accept: boolean,
  tick: number,
): WwOrderBlock | null {
  const o = eg.peaceOffers.find((x) => x.id === offerId && x.to === smallID);
  if (o === undefined) return "peace_no_offer";
  resolveOffer(eg, o, accept, tick);
  return null;
}

/**
 * Spec order 8 (the endgame's tick), in offer order: an AI target answers,
 * a human target's card past its deadline is a refusal, an offer whose war
 * or sides changed lapses.
 */
export function stepPeaceOffers(eg: WwEndgame, tick: number): void {
  if (eg.peaceOffers.length === 0) return;
  for (const o of [...eg.peaceOffers]) {
    if (!eg.peaceOffers.includes(o)) continue;
    if (!offerStands(eg, o)) resolveOffer(eg, o, false, tick);
    else if (!eg.isHumanControlled(o.to)) {
      resolveOffer(eg, o, aiAccepts(eg, o, eg.ww.day(tick)), tick);
    } else if (tick >= o.deadlineTick) resolveOffer(eg, o, false, tick);
  }
}

/** The offer still makes sense: the war goes on, both still answer for what they did. */
function offerStands(eg: WwEndgame, o: PeaceOffer): boolean {
  const w = eg.war(o.war);
  if (w === null || w.ended !== null) return false;
  const sf = eg.sideIndex(w, o.from);
  const st = eg.sideIndex(w, o.to);
  if (sf === -1 || st === -1 || sf === st) return false;
  if (!fighting(eg.member(w, o.from)) || !fighting(eg.member(w, o.to))) {
    return false;
  }
  if (!eg.isActor(o.from) || !eg.isActor(o.to)) return false;
  if (w.sides[st].leader !== o.to) return false;
  return !o.whole || w.sides[sf].leader === o.from;
}

function resolveOffer(
  eg: WwEndgame,
  o: PeaceOffer,
  accept: boolean,
  tick: number,
): void {
  eg.peaceOffers = eg.peaceOffers.filter((x) => x !== o);
  eg.dirtyPeace = true;
  const day = eg.ww.day(tick);
  const names = countryParams(eg, { target: o.to });
  if (!offerStands(eg, o)) {
    eg.message(o.from, "ww1936_wpeace_lapsed", names);
    return;
  }
  if (!accept) {
    eg.peaceCooldowns = eg.peaceCooldowns.filter(
      (c) => !(c[0] === o.from && c[1] === o.to),
    );
    eg.peaceCooldowns.push([o.from, o.to, day + WW_WHITE_PEACE_COOLDOWN_DAYS]);
    eg.peaceCooldowns.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    eg.message(o.from, "ww1936_wpeace_refused", {
      ...names,
      days: WW_WHITE_PEACE_COOLDOWN_DAYS,
    });
    return;
  }
  makePeace(eg, o, tick);
  eg.message(o.from, "ww1936_wpeace_accepted", names);
}

/**
 * The peace: P3 end_war for every pair it covers (occupied land back to
 * its legal owner, armies home — an occupation zone stays as it is), a
 * truce for each pair, no conference. The whole war: every pair, the war
 * ends with no winner. A separate peace: the proposer and its puppets
 * leave it (marked left first, as separate_peace all does), then leave
 * the proposer's faction. Everyone hears of it.
 */
function makePeace(eg: WwEndgame, o: PeaceOffer, tick: number): void {
  const pol = eg.ww.politics;
  const w = eg.war(o.war)!;
  const day = eg.ww.day(tick);
  const until = day + WW_TRUCE_DAYS;
  const keep = (r: number) => eg.isZone(r);
  if (o.whole) {
    // Every cross pair of those still in it keeps the truce.
    const a = w.sides[0].members.filter((m) => fighting(m)).map((m) => m.id);
    const b = w.sides[1].members.filter((m) => fighting(m)).map((m) => m.id);
    for (const [x, y] of pairsOf(eg, w)) endWarBetween(pol, x, y, tick, keep);
    for (const x of a) for (const y of b) setTruce(eg, x, y, until);
    w.ended = { day, winner: -1 };
    eg.dirtyWars = true;
  } else {
    const ids = [o.from, ...followers(eg, w, o.from)];
    const fid = pol.factionIdx(o.from);
    for (const x of ids) {
      eg.setMemberState(w.id, x, "left");
      for (const [p, q] of pairsOf(eg, w)) {
        if (p !== x && q !== x) continue;
        const y = p === x ? q : p;
        endWarBetween(pol, x, y, tick, keep);
        setTruce(eg, x, y, until);
      }
    }
    // Finland 1944: out of its faction (its puppets in it with it).
    for (const x of ids) {
      if (fid >= 0 && pol.factionIdx(x) === fid) leaveFaction(pol, x, tick);
    }
    pol.markGlobal();
  }
  pol.news("news_white_peace", countryParams(eg, { a: o.from, b: o.to }));
}

// ---- The AI ----

/** What the AI weighs: the proposer's and the target's groups' land and lines. */
function warState(eg: WwEndgame, w: WwWar, from: number, whole: boolean) {
  const sf = eg.sideIndex(w, from) as 0 | 1;
  const gp = proposerGroup(eg, w, from, whole);
  const gt = sideIds(w, (1 - sf) as 0 | 1);
  return {
    /** The proposer's land the target's side holds (‰). */
    heldByTarget: heldPm(eg, gt, gp),
    /** The target's side's land the proposer's group holds (‰). */
    heldByProposer: heldPm(eg, gp, gt),
  };
}

/**
 * The AI target's accept chance, percent (0: it refuses outright — its
 * side is clearly winning: the proposer near its surrender line, or much
 * of the proposer's land held). It rises as the target nears its own line,
 * as its side's land is held, with a long stalemate and low war support.
 */
export function aiAcceptPct(eg: WwEndgame, o: PeaceOffer, day: number): number {
  const w = eg.war(o.war);
  if (w === null) return 0;
  const st = warState(eg, w, o.from, o.whole);
  if (
    surrenderPm(eg, o.from) >= AI_PEACE_REFUSE_CAP_PM ||
    st.heldByTarget >= AI_PEACE_REFUSE_HELD_PM
  ) {
    return 0;
  }
  let pct = Math.floor((surrenderPm(eg, o.to) * AI_PEACE_LOSING_PCT) / 1000);
  pct += Math.floor((st.heldByProposer * AI_PEACE_LOST_LAND_PCT) / 1000);
  if (stalemateDays(eg, w.id, day) >= WW_WHITE_PEACE_STALEMATE_DAYS) {
    pct += AI_PEACE_STALEMATE_PCT;
  }
  const ws = eg.ww.politics.country(o.to)?.wsBp ?? AI_PEACE_LOW_WS_BP;
  if (ws < AI_PEACE_LOW_WS_BP) {
    pct += Math.floor(
      ((AI_PEACE_LOW_WS_BP - ws) * AI_PEACE_LOW_WS_PCT) / AI_PEACE_LOW_WS_BP,
    );
  }
  return Math.min(AI_PEACE_MAX_PCT, pct);
}

/** The AI target's answer: its chance against a seeded roll of the offer. */
export function aiAccepts(eg: WwEndgame, o: PeaceOffer, day: number): boolean {
  const pct = aiAcceptPct(eg, o, day);
  if (pct <= 0) return false;
  const roll =
    (wwRoll(eg.ww.politics.seed, P_WPEACE, o.id, o.from, o.to) >>> 8) % 100;
  return roll < pct;
}

/**
 * Whether the AI `id` wants peace in `w`: only when the other side would
 * not refuse outright, and it is losing badly (near its surrender line,
 * or much of its land — its side's, for a leader — held). A side leader
 * also offers when the front has been stalemated
 * WW_WHITE_PEACE_STALEMATE_DAYS with neither side ahead and its war
 * support under AI_PROPOSE_WS_BP; a member never leaves on a stalemate.
 */
export function aiWantsPeace(
  eg: WwEndgame,
  w: WwWar,
  id: number,
  day: number,
): boolean {
  const s = eg.sideIndex(w, id);
  if (s === -1) return false;
  const whole = w.sides[s].leader === id;
  const st = warState(eg, w, id, whole);
  const cap = surrenderPm(eg, id);
  if (
    cap >= AI_PEACE_REFUSE_CAP_PM ||
    st.heldByTarget >= AI_PEACE_REFUSE_HELD_PM
  ) {
    return false;
  }
  if (cap >= AI_PROPOSE_CAP_PM || st.heldByTarget >= AI_PROPOSE_LOST_PM) {
    return true;
  }
  const ws = eg.ww.politics.country(id)?.wsBp ?? AI_PROPOSE_WS_BP;
  return (
    whole &&
    ws < AI_PROPOSE_WS_BP &&
    stalemateDays(eg, w.id, day) >= WW_WHITE_PEACE_STALEMATE_DAYS &&
    Math.abs(st.heldByProposer - st.heldByTarget) <= AI_PROPOSE_EVEN_PM
  );
}

/** The AI's day (its dailyCountry): at most one offer, in its oldest war that wants one. */
export function aiPeaceDay(
  eg: WwEndgame,
  id: number,
  day: number,
  tick: number,
): void {
  if (eg.peaceOffers.some((o) => o.from === id)) return;
  const c = eg.ww.politics.country(id);
  if (c === null || c.ppMilli < WW_WHITE_PEACE_PP * 1000) return;
  for (const wid of [...eg.warsOf(id)].sort((a, b) => a - b)) {
    const w = eg.war(wid);
    if (w === null || w.ended !== null || w.kind !== "normal") continue;
    const s = eg.sideIndex(w, id);
    if (s < 0) continue;
    const target = w.sides[1 - s].leader;
    if (peaceOfferBlock(eg, id, wid, target, day) !== null) continue;
    if (!aiWantsPeace(eg, w, id, day)) continue;
    offerPeace(eg, id, wid, target, tick);
    return;
  }
}

// ---- Screens ----

/** An offer as the screens read it: the card's war score, surrender lines and occupation. */
export function peaceOfferView(eg: WwEndgame, o: PeaceOffer): WwPeaceOfferView {
  const w = eg.war(o.war);
  const empty = { id: 0, capPm: 0, scorePm: 0 };
  const base = {
    id: o.id,
    war: o.war,
    from: o.from,
    to: o.to,
    whole: o.whole,
    sentTick: o.sentTick,
    deadlineTick: o.deadlineTick,
  };
  if (w === null) return { ...base, sides: [empty, empty], held: [] };
  const sf = eg.sideIndex(w, o.from);
  const st = sf === 0 ? 1 : 0;
  const score = (s: number) =>
    w.sides[s]?.members.reduce((n, m) => n + Math.max(0, m.wsMilli), 0) ?? 0;
  const total = score(0) + score(1);
  const side = (s: number, id: number) => ({
    id,
    capPm: surrenderPm(eg, id),
    scorePm: total > 0 ? Math.floor((score(s) * 1000) / total) : 500,
  });
  // Who holds how much of whose land, across the two sides (one pass).
  const pIds = new Set(
    sf < 0 ? [o.from] : proposerGroup(eg, w, o.from, o.whole),
  );
  const tIds = new Set(sideIds(w, st));
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  const totalOf = new Map<number, number>();
  const heldOf = new Map<number, number>();
  for (const r of eg.ww.scenario.landRegions) {
    const l = legal[r.id] ?? 0;
    if (!pIds.has(l) && !tIds.has(l)) continue;
    totalOf.set(l, (totalOf.get(l) ?? 0) + r.vp);
    const c = ctrl[r.id] ?? 0;
    if (pIds.has(l) ? !tIds.has(c) : !pIds.has(c)) continue;
    const k = c * eg.size + l;
    heldOf.set(k, (heldOf.get(k) ?? 0) + r.vp);
  }
  const held: [number, number, number][] = [];
  for (const [k, vp] of heldOf) {
    const l = k % eg.size;
    const t = totalOf.get(l) ?? 0;
    if (t > 0 && vp > 0) {
      held.push([Math.floor(k / eg.size), l, Math.floor((vp * 1000) / t)]);
    }
  }
  held.sort((x, y) => y[2] - x[2] || x[0] - y[0] || x[1] - y[1]);
  return {
    ...base,
    sides: [side(Math.max(0, sf), o.from), side(st, o.to)],
    held: held.slice(0, HELD_ROWS),
  };
}
