// World War 1936: white peace (owner-approved plan, 2026-10-30). A war's
// side leader offers the whole war a white peace; an ordinary member offers
// a separate peace (it alone leaves that war and its faction, Finland
// 1944). Diplomacy D1 (ww161 Design B): a side leader may also offer any
// enemy member that is no puppet a separate peace, which takes that member
// and its puppets out (SeparatePeaceRules, SeparatePeace.ts). The target
// answers: a human by a card (30 s, refused at the deadline), the AI by
// the war's state and a seeded roll. Peace goes through P3 end_war
// (occupied land back to its legal owner, the armies home; occupation
// zones stay), no conference opens (winner -1), and the two sides keep a
// one-year truce. Integers only; wars, countries and offers by id.
import {
  WW_SEP_LEADER_BEATEN_PM,
  WW_SEP_LOYAL_HOLD_PCT,
  WW_SEP_LOYAL_PTS,
} from "@openfront/engine-api/ww1936/DiploTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_TRUCE_DAYS,
  WW_WHITE_PEACE_CARD_TICKS,
  WW_WHITE_PEACE_COOLDOWN_DAYS,
  WW_WHITE_PEACE_MIN_DAYS,
  WW_WHITE_PEACE_PP,
  WW_WHITE_PEACE_STALEMATE_DAYS,
  WwPeaceOfferView,
  WwPeaceTerms,
  WwWar,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { sharePm } from "@openfront/engine-lib/ww1936/EndgameRules";
import {
  hasPeaceTerms,
  negPeaceAccepts,
  warWearinessPct,
} from "@openfront/engine-lib/ww1936/NegPeaceRules";
import { wwRealTicks } from "@openfront/engine-lib/ww1936/Pace";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  homeTargetBlock,
  peaceTargetBlock,
  targetLeaves,
} from "@openfront/engine-lib/ww1936/SeparatePeaceRules";
import { evictDivisions, transferRegionPeaceful } from "../land/PoliticsBridge";
import { leaveFaction } from "../politics/Factions";
import { payPp } from "../politics/PayPp";
import { endWarBetween } from "../politics/Territory";
import { landRegained } from "./Activate";
import { askTermsAccepted, openTermsConference } from "./AskTerms";
import { cardFrontId } from "./DiploState";
import { applyLinePeace, lineAiAccepts, linePeaceOfferView } from "./LinePeace";
import {
  aiPeaceTerms,
  applyPeaceTerms,
  negPeaceFacts,
  offerValue,
  peaceJudgeOf,
  peaceTermsBlock,
  peaceTermsView,
  storedTerms,
} from "./NegPeace";
import { targetLeft } from "./SeparatePeace";
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
/**
 * Negotiated peace: the target's side's war-score lead takes up to this
 * much (percent) off its accept chance. A deficit adds nothing (the rule
 * stays tight: a white peace is never likelier than before).
 */
export const AI_PEACE_SCORE_PCT = 10;
/** The AI offers peace when losing badly: this close to its surrender line (‰)… */
export const AI_PROPOSE_CAP_PM = 500;
/** …or the enemy holds this much of its (its side's, for a leader) land (‰). */
export const AI_PROPOSE_LOST_PM = 250;
/** A stalemate offer only while neither side holds this much more of the other's land (‰). */
export const AI_PROPOSE_EVEN_PM = 100;
/** …and only from a side leader whose war support (bp) is under this (war-weary). */
export const AI_PROPOSE_WS_BP = 5000;
/**
 * A side this many times stronger than the other (civilian + military
 * factories of its fighting members) neither offers nor takes a stalemate
 * peace: a lopsided colonial war goes on (Italy in Ethiopia).
 */
export const AI_PEACE_STRONGER_RATIO = 3;
/** ww177: the Imjin War offers no stalemate peace before this many days of war. */
export const IMJIN_STALEMATE_MIN_DAYS = 365;
/** The front "barely changed": at most this many regions changed hands since the stalemate began. */
export const WW_STALEMATE_REGIONS = 2;
/** Occupation rows an offer's card shows. */
const HELD_ROWS = 4;
const P_WPEACE = idHash("white_peace");

type Member = WwWar["sides"][0]["members"][number];
/** Still in the war: active or in exile. */
export const fighting = (m: Member | null): boolean =>
  m !== null && (m.state === "active" || m.state === "exiled");

/** A puppet (or integrated subject) follows its overlord: it never offers peace itself. */
export function isPuppet(eg: WwEndgame, id: number): boolean {
  const s = eg.subjectOf(id);
  return s !== null && (s.level === "integrated" || s.level === "puppet");
}

/**
 * Whom a human on side `s` of `w` may be judged offering peace (the screens'
 * chance rows): the other side's leader, and — from its own side's leader
 * (`whole`), D1 — every other member still fighting that is no puppet.
 */
export function peaceJudgeTargets(
  eg: WwEndgame,
  w: WwWar,
  s: 0 | 1,
  whole: boolean,
): number[] {
  const st = s === 0 ? 1 : 0;
  const leader = w.sides[st].leader;
  const out = leader > 0 ? [leader] : [];
  if (!whole) return out;
  for (const m of w.sides[st].members) {
    if (m.id !== leader && fighting(m) && !isPuppet(eg, m.id)) out.push(m.id);
  }
  return out;
}

/** `id`'s puppets fighting on its side of `w` (ascending): its separate peace covers them. */
export function followers(eg: WwEndgame, w: WwWar, id: number): number[] {
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
export function sideIds(w: WwWar, s: 0 | 1): number[] {
  return w.sides[s].members.map((m) => m.id);
}

/** The countries an offer makes peace for: the whole side, or the proposer and its puppets. */
export function proposerGroup(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
): number[] {
  const s = eg.sideIndex(w, from);
  if (s === -1) return [];
  return whole ? sideIds(w, s) : [from, ...followers(eg, w, from)];
}

/**
 * The countries an offer of `from` to `to` makes peace with: the other side,
 * or — a side leader's separate peace with an enemy member (D1,
 * SeparatePeaceRules.targetLeaves) — that member and its puppets.
 */
export function targetGroup(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  to: number,
  whole: boolean,
): number[] {
  const s = eg.sideIndex(w, from);
  if (s === -1) return [];
  if (targetLeaves(w, from, to, whole)) return [to, ...followers(eg, w, to)];
  return sideIds(w, s === 0 ? 1 : 0);
}

/** Pairs [a, b] (a < b) at war under `w`'s record, in key order. */
export function pairsOf(eg: WwEndgame, w: WwWar): [number, number][] {
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

/**
 * ww103: `holders` control land of a country among `owners` that is beaten:
 * capitulated, in exile, or AI_PEACE_REFUSE_CAP_PM of its way to its surrender
 * line. A white or negotiated peace would hand it back and undo the push, so an
 * AI side holding one deals on the line instead. Occupation zones stay either
 * way and do not count.
 */
export function holdsBeaten(
  eg: WwEndgame,
  holders: readonly number[],
  owners: readonly number[],
): boolean {
  const h = new Set(holders);
  const o = new Set(owners);
  const ctrl = eg.ww.land.controller;
  const legal = eg.ww.politics.legalOwner;
  const held = new Set<number>();
  for (const r of eg.ww.scenario.landRegions) {
    const l = legal[r.id] ?? 0;
    if (o.has(l) && h.has(ctrl[r.id] ?? 0) && !eg.isZone(r.id)) held.add(l);
  }
  for (const l of held) {
    if (surrenderPm(eg, l) >= AI_PEACE_REFUSE_CAP_PM) return true;
  }
  return false;
}

/**
 * ww103: the group `from` would make peace for holds a beaten enemy in `w`
 * (among the group it makes peace with: `to`'s, D1's targetGroup; no `to`:
 * the other side).
 */
export function proposerHoldsBeaten(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
  to?: number,
): boolean {
  const s = eg.sideIndex(w, from);
  if (s === -1) return false;
  return holdsBeaten(
    eg,
    proposerGroup(eg, w, from, whole),
    otherGroup(eg, w, from, whole, to),
  );
}

/** ww103: the side (D1: the group) `from` offers peace to holds a beaten country of `from`'s group. */
export function targetHoldsBeaten(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
  to?: number,
): boolean {
  const s = eg.sideIndex(w, from);
  if (s === -1) return false;
  return holdsBeaten(
    eg,
    otherGroup(eg, w, from, whole, to),
    proposerGroup(eg, w, from, whole),
  );
}

/** targetGroup when the target is known, else the other side. */
function otherGroup(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
  to: number | undefined,
): number[] {
  if (to !== undefined) return targetGroup(eg, w, from, to, whole);
  const s = eg.sideIndex(w, from);
  return s === -1 ? [] : sideIds(w, s === 0 ? 1 : 0);
}

// ---- The front (stalemate) ----

/**
 * Regions of side 1's legal land side 0 controls, the other way round, and
 * whether there is a front at all: a region side 0 controls next to one
 * side 1 controls (a war across the sea alone has none).
 */
export function frontCounts(
  eg: WwEndgame,
  w: WwWar,
): [number, number, boolean] {
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
 * the count again; a new war counts from its first day, front or none (a
 * war the sides fight only at sea counts too).
 */
export function stepFronts(eg: WwEndgame, day: number): void {
  const next: [number, number, number, number][] = [];
  for (const w of eg.wars) {
    if (w.ended !== null || w.kind !== "normal") continue;
    const [a, b] = frontCounts(eg, w);
    const prev = eg.fronts.find((f) => f[0] === w.id);
    // ww88: a war with no land front counts from its start too.
    if (prev === undefined) next.push([w.id, a, b, w.startDay]);
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

export function setTruce(
  eg: WwEndgame,
  a: number,
  b: number,
  until: number,
): void {
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
 * `day` (null: it may). The target is the other side's leader, or (D1,
 * from a side's leader) any member there that is no puppet; the war a
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
  if (!eg.isActor(target)) return "bad_target";
  // D1: the other side's leader, or (from my side's leader) any member of
  // that side that is no puppet (SeparatePeaceRules).
  const tb = peaceTargetBlock(w, from, target, (x) => isPuppet(eg, x));
  if (tb !== null) return tb;
  // It must still fight someone there (its pairs, or its side's); a side
  // leader's separate peace, the target must (D1).
  const whole = w.sides[s].leader === from;
  const group = new Set(
    targetLeaves(w, from, target, whole)
      ? [target, ...followers(eg, w, target)]
      : proposerGroup(eg, w, from, whole),
  );
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
 * peace_offer: `from` offers `target` peace in war `warId` — the whole war
 * when it leads its side and `target` leads the other, its own separate
 * peace when it doesn't lead, or (D1) the target's separate peace when it
 * leads and `target` is another member — a white peace, or with `terms`
 * (negotiated peace: checked by NegPeaceRules). `home`: D1's "come home as
 * my subject", from SeparatePeace.offerHome only. The political power goes
 * now; a human target gets the card until its deadline.
 */
export function offerPeace(
  eg: WwEndgame,
  from: number,
  warId: number,
  target: number,
  tick: number,
  terms?: WwPeaceTerms,
  home?: boolean,
): WwOrderBlock | null {
  const day = eg.ww.day(tick);
  const block = peaceOfferBlock(eg, from, warId, target, day);
  if (block !== null) return block;
  const stored = storedTerms(terms);
  const bad = peaceTermsBlock(eg, from, target, stored);
  if (bad !== null) return bad;
  const pol = eg.ww.politics;
  if (!payPp(pol, from, WW_WHITE_PEACE_PP)) return "no_pp";
  pol.markCountry(from);
  const w = eg.war(warId)!;
  const s = eg.sideIndex(w, from);
  if (s === -1) return "not_at_war";
  const whole = w.sides[s].leader === from;
  const id = eg.nextOfferId++;
  eg.peaceOffers.push({
    id,
    war: warId,
    from,
    to: target,
    whole,
    sentTick: tick,
    deadlineTick: peaceDeadline(eg, target, id, tick),
    ...(stored === undefined ? {} : { terms: stored }),
    // D1: "come home as my subject" (SeparatePeace.offerHome checked it).
    ...(home === true ? { home: true as const } : {}),
    // D1: a side leader's separate peace with a member, as sent (a change
    // of the target side's leader lapses it rather than turning it).
    ...(home !== true && targetLeaves(w, from, target, whole)
      ? { sep: true as const }
      : {}),
  });
  eg.dirtyPeace = true;
  return null;
}

/** A human target's card: its real 30 s at the game's pace (Pace: fewer, longer ticks unlimited). */
export const peaceCardTicks = (eg: WwEndgame): number =>
  wwRealTicks(eg.mg.config().gameConfig(), WW_WHITE_PEACE_CARD_TICKS);

/**
 * A new peace offer's deadline (call before pushing it): an AI target
 * answers on the next tick; a human's card runs now when nothing waits for
 * it, else −1 until it is in front (the one card, DiploState.cardFrontId).
 */
export function peaceDeadline(
  eg: WwEndgame,
  to: number,
  id: number,
  tick: number,
): number {
  if (!eg.isHumanControlled(to)) return tick;
  return cardFrontId(eg, to) > id ? tick + peaceCardTicks(eg) : -1;
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
    else if (aiAnswers(eg, o.to)) {
      resolveOffer(eg, o, aiAccepts(eg, o, eg.ww.day(tick)), tick);
    } else if (cardFrontId(eg, o.to) !== o.id) {
      // Behind another card (a peace offer, deal or ultimatum): it waits
      // with its clock stopped and gets its full window in front.
      if (o.deadlineTick !== -1) {
        o.deadlineTick = -1;
        eg.dirtyPeace = true;
      }
    } else if (o.deadlineTick < 0) {
      o.deadlineTick = tick + peaceCardTicks(eg);
      eg.dirtyPeace = true;
    } else if (tick >= o.deadlineTick) resolveOffer(eg, o, false, tick);
  }
}

/**
 * Its country's AI answers offers to `id`: an AI country, or a human's with
 * the `diplomacy` automation on (D6: no card; a manual peace_reply turns it
 * off, Automation.AUTO_ORDER_DOMAIN).
 */
export function aiAnswers(eg: WwEndgame, id: number): boolean {
  return !eg.isHumanControlled(id) || eg.ww.autoOn(id, "diplomacy");
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
  if (o.whole && w.sides[sf].leader !== o.from) return false;
  // D1: "come home" still goes to an exile that is no leader nor puppet.
  if (o.home === true) {
    return homeTargetBlock(w, o.from, o.to, (x) => isPuppet(eg, x)) === null;
  }
  // D1: a side leader's separate peace (recorded when sent) stays one with
  // a member that is no puppet; any other offer (and always terms asked
  // for) needs the target to still lead its side. When the target side's
  // leader changed so the offer would mean the other kind, it lapses.
  const sep = o.sep === true;
  if (sep !== targetLeaves(w, o.from, o.to, o.whole)) return false;
  if (sep) return o.ask !== true && !isPuppet(eg, o.to);
  return w.sides[st].leader === o.to;
}

function resolveOffer(
  eg: WwEndgame,
  o: PeaceOffer,
  accept: boolean,
  tick: number,
): void {
  eg.peaceOffers = eg.peaceOffers.filter((x) => x !== o);
  eg.dirtyPeace = true;
  // w86: the card shows one offer at a time; the next one (waiting with
  // deadlineTick −1) gets its full window once it is in front, on the next
  // step (stepPeaceOffers, the one card across peace, deals, ultimatums).
  const day = eg.ww.day(tick);
  const names = countryParams(eg, { target: o.to });
  // Negotiated peace: terms that no longer hold (a region changed its
  // legal owner meanwhile) lapse the offer too.
  if (
    !offerStands(eg, o) ||
    (accept && peaceTermsBlock(eg, o.from, o.to, o.terms) !== null)
  ) {
    eg.message(o.from, "ww1936_wpeace_lapsed", names);
    // w86: the one who tapped Accept hears it too.
    if (accept) {
      eg.message(
        o.to,
        "ww1936_wpeace_lapsed_to",
        countryParams(eg, { target: o.from }),
      );
    }
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
  // ww88: terms asked for and granted: the conference takes it from here.
  if (o.ask === true) {
    openTermsConference(eg, o.war, o.from, tick);
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
  // Negotiated peace: the terms first (a ceded region is the receiver's by
  // law, so end_war leaves it with it); the rest is status quo ante.
  const terms = hasPeaceTerms(o.terms);
  // D1: a side leader's separate peace takes the target out instead; an
  // exile holding nothing that takes the line ends, its land still held.
  const leaves = o.home === true || targetLeaves(w, o.from, o.to, o.whole);
  const collapse =
    leaves &&
    o.line === true &&
    eg.isExile(o.to) &&
    !pol.controlsAnyRegion(o.to);
  applyPeaceTerms(eg, o, tick);
  // Peace on the current line (LinePeace.ts): the occupied regions go to
  // their occupiers first; end_war gives the rest back.
  if (!collapse) applyLinePeace(eg, o, tick);
  if (o.whole && !leaves) {
    // Status quo ante: those still in it, and those that capitulated
    // without an exile (their land comes back); every cross pair keeps
    // the truce.
    const inIt = (m: Member) =>
      fighting(m) || (m.state === "capitulated" && !eg.isExile(m.id));
    const a = w.sides[0].members.filter(inIt).map((m) => m.id);
    const b = w.sides[1].members.filter(inIt).map((m) => m.id);
    for (const [x, y] of pairsOf(eg, w)) endWarBetween(pol, x, y, tick, keep);
    reviveCapitulated(eg, w, tick);
    for (const x of a) for (const y of b) setTruce(eg, x, y, until);
    w.ended = { day, winner: -1 };
    eg.dirtyWars = true;
  } else {
    // The one leaving: the proposer, or (D1) the target; its puppets with it.
    const out = leaves ? o.to : o.from;
    const ids = [out, ...followers(eg, w, out)];
    const fid = pol.factionIdx(out);
    const told = leaves ? loyalLeader(eg, w, o.to) : 0;
    const legal = pol.legalOwner;
    const hold = collapse ? (r: number) => keep(r) || legal[r] === o.to : keep;
    // D1: the truce with the proposer's whole side, not only its pairs.
    const sf = eg.sideIndex(w, o.from);
    const side =
      leaves && sf !== -1
        ? w.sides[sf].members.filter((m) => fighting(m)).map((m) => m.id)
        : [];
    for (const x of ids) {
      // A collapsing exile is marked capitulated by endExile (its land
      // goes at the conference).
      if (!collapse || x !== o.to) eg.setMemberState(w.id, x, "left");
      for (const [p, q] of pairsOf(eg, w)) {
        if (p !== x && q !== x) continue;
        const y = p === x ? q : p;
        endWarBetween(pol, x, y, tick, hold);
        setTruce(eg, x, y, until);
      }
      for (const y of side) setTruce(eg, x, y, until);
    }
    // Finland 1944: out of its faction (its puppets in it with it).
    for (const x of ids) {
      if (fid >= 0 && pol.factionIdx(x) === fid) leaveFaction(pol, x, tick);
    }
    if (leaves) targetLeft(eg, o, told, collapse, tick);
    pol.markGlobal();
  }
  pol.news(
    o.line === true
      ? "news_line_peace"
      : terms
        ? "news_neg_peace"
        : "news_white_peace",
    countryParams(eg, { a: o.from, b: o.to }),
  );
}

/**
 * A whole-war white peace is status quo ante: a member that capitulated
 * without going into exile gets back its legal regions the war's members
 * hold (their divisions go home) and plays again — a peace conference's
 * way with a loser's leftover land (P5 landRegained: active, its
 * capitulation cleared, its executions at order 8), its capitulation's
 * tile transfer stopped and its other wars' capitulated records left.
 * Occupation zones stay where they are.
 */
function reviveCapitulated(eg: WwEndgame, w: WwWar, tick: number): void {
  const ww = eg.ww;
  const land = ww.land;
  const legal = ww.politics.legalOwner;
  const members = new Set(w.sides.flatMap((s) => s.members.map((m) => m.id)));
  for (const s of w.sides) {
    for (const m of s.members) {
      if (m.state !== "capitulated" || eg.isExile(m.id)) continue;
      const L = m.id;
      const back = ww.scenario.landRegions
        .map((r) => r.id)
        .filter((r) => {
          const c = land.controller[r] ?? 0;
          return legal[r] === L && c !== L && members.has(c) && !eg.isZone(r);
        });
      if (back.length === 0) continue;
      const tr = ww.transfers();
      for (let i = tr.length - 1; i >= 0; i--) {
        if (tr[i].from === L) tr.splice(i, 1);
      }
      for (const r of back) {
        const from = land.controller[r] ?? 0;
        transferRegionPeaceful(land, r, L, tick);
        if (from !== 0) evictDivisions(land, r, from);
      }
      landRegained(eg, L, tick);
      for (const x of eg.wars) {
        if (x.ended !== null || x.id === w.id) continue;
        if (eg.member(x, L)?.state === "capitulated") {
          eg.setMemberState(x.id, L, "left");
        }
      }
      ww.politics.markCountry(L);
    }
  }
}

// ---- The AI ----

/** Civilian and military factories of side `s`'s fighting members. */
function sideFactories(eg: WwEndgame, w: WwWar, s: 0 | 1): number {
  return w.sides[s].members
    .filter((m) => fighting(m))
    .reduce((n, m) => n + eg.factoriesOf(m.id), 0);
}

/** Side `s` of `w` has AI_PEACE_STRONGER_RATIO times the other's factories (or more). */
export function muchStronger(eg: WwEndgame, w: WwWar, s: 0 | 1): boolean {
  const mine = sideFactories(eg, w, s);
  return (
    mine > 0 &&
    mine >= AI_PEACE_STRONGER_RATIO * sideFactories(eg, w, s === 0 ? 1 : 0)
  );
}

/** ww106: `id` is a democracy the AI plays. */
export function aiDemocracy(eg: WwEndgame, id: number): boolean {
  return (
    !eg.isHumanControlled(id) && eg.ww.politics.country(id)?.ruling === IDEO_DEM
  );
}

/**
 * ww106: side `s` of `w` has more factories than the other with an AI
 * democracy fighting on it: the war is its to win. A whole-war peace binds the
 * side, whoever leads it (the leader is whoever has most factories: the Soviets
 * signed Britain and France out of the German war at six to one).
 */
export function democracyCanWin(eg: WwEndgame, w: WwWar, s: 0 | 1): boolean {
  return (
    w.sides[s].members.some((m) => fighting(m) && aiDemocracy(eg, m.id)) &&
    sideFactories(eg, w, s) > sideFactories(eg, w, s === 0 ? 1 : 0)
  );
}

/**
 * ww106: and it is winning: the front moved within
 * WW_WHITE_PEACE_STALEMATE_DAYS and it holds at least as much of the other side
 * as they hold of it. Such a side neither takes nor offers peace of any kind; a
 * stalled front is weariness's to judge.
 */
export function democracyFightsOn(
  eg: WwEndgame,
  w: WwWar,
  s: 0 | 1,
  day: number,
): boolean {
  if (!democracyCanWin(eg, w, s)) return false;
  if (stalemateDays(eg, w.id, day) >= WW_WHITE_PEACE_STALEMATE_DAYS) {
    return false;
  }
  const mine = sideIds(w, s);
  const theirs = sideIds(w, s === 0 ? 1 : 0);
  return heldPm(eg, mine, theirs) >= heldPm(eg, theirs, mine);
}

/** What the AI weighs: the proposer's and the target's groups' land and lines. */
function warState(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  whole: boolean,
  to?: number,
) {
  const gp = proposerGroup(eg, w, from, whole);
  const gt = otherGroup(eg, w, from, whole, to);
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
  return w === null ? 0 : acceptPct(eg, w, o.from, o.to, o.whole, day);
}

/**
 * aiAcceptPct for an offer of `from` (its group: the whole side, or it and
 * its puppets) to `to` in `w`. Negotiated peace adds the war score: the
 * target's side ahead on it (its share of the war's score past half)
 * takes up to AI_PEACE_SCORE_PCT off; behind, nothing changes. D1: a side
 * leader's offer to a member weighs that member's group and its loyalty;
 * `mirror` (a country judging its own wish for peace as if the other
 * leader offered it) keeps today's whole-side reading.
 */
export function acceptPct(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  to: number,
  whole: boolean,
  day: number,
  mirror = false,
): number {
  const leaves = !mirror && targetLeaves(w, from, to, whole);
  const st = warState(eg, w, from, whole, leaves ? to : undefined);
  if (
    surrenderPm(eg, from) >= AI_PEACE_REFUSE_CAP_PM ||
    st.heldByTarget >= AI_PEACE_REFUSE_HELD_PM
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(
      AI_PEACE_MAX_PCT,
      basePct(eg, w, from, to, day, st.heldByProposer) +
        (leaves ? loyaltyPts(eg, w, to) : 0),
    ),
  );
}

/** acceptPct before D1's loyalty term (past its outright refusals). */
function basePct(
  eg: WwEndgame,
  w: WwWar,
  from: number,
  to: number,
  day: number,
  heldByProposer: number,
): number {
  let pct = Math.floor((surrenderPm(eg, to) * AI_PEACE_LOSING_PCT) / 1000);
  pct += Math.floor((heldByProposer * AI_PEACE_LOST_LAND_PCT) / 1000);
  const sTo = eg.sideIndex(w, to);
  if (sTo !== -1) {
    const score = (s: 0 | 1) =>
      w.sides[s].members.reduce((n, m) => n + Math.max(0, m.wsMilli), 0);
    const mine = score(sTo);
    const lead = 2 * sharePm(mine, [mine, score(sTo === 0 ? 1 : 0)]) - 1000;
    if (lead > 0) pct -= Math.floor((lead * AI_PEACE_SCORE_PCT) / 1000);
  }
  pct = Math.max(0, pct);
  // A long war tires its target, with or without a land front (ww88);
  // a side much stronger is tired by half as much.
  const strong = sTo !== -1 && muchStronger(eg, w, sTo);
  pct += warWearinessPct(day - w.startDay, strong);
  // A much stronger side takes no stalemate peace: only its own losses count.
  if (strong) return Math.min(AI_PEACE_MAX_PCT, pct);
  if (stalemateDays(eg, w.id, day) >= WW_WHITE_PEACE_STALEMATE_DAYS) {
    pct += AI_PEACE_STALEMATE_PCT;
  }
  const ws = eg.ww.politics.country(to)?.wsBp ?? AI_PEACE_LOW_WS_BP;
  if (ws < AI_PEACE_LOW_WS_BP) {
    pct += Math.floor(
      ((AI_PEACE_LOW_WS_BP - ws) * AI_PEACE_LOW_WS_PCT) / AI_PEACE_LOW_WS_BP,
    );
  }
  return Math.min(AI_PEACE_MAX_PCT, pct);
}

/**
 * D1: the leader a member answers to — its faction's leader, else its
 * side's in `w` (0: none, or itself).
 */
export function loyalLeader(eg: WwEndgame, w: WwWar, id: number): number {
  const pol = eg.ww.politics;
  const f = pol.factionIdx(id);
  const fl = f >= 0 ? (pol.faction(f)?.leader ?? 0) : 0;
  const s = eg.sideIndex(w, id);
  const leader = fl > 0 ? fl : s === -1 ? 0 : w.sides[s].leader;
  return leader === id ? 0 : leader;
}

/**
 * D1 loyalty (percent points on the AI target's accept chance, for a side
 * leader's separate peace with it): −WW_SEP_LOYAL_PTS while the leader it
 * answers to still fights and holds WW_SEP_LOYAL_HOLD_PCT of its own
 * victory points, +WW_SEP_LOYAL_PTS once that leader is in exile or past
 * WW_SEP_LEADER_BEATEN_PM of its surrender line, else 0.
 */
export function loyaltyPts(eg: WwEndgame, w: WwWar, to: number): number {
  const l = loyalLeader(eg, w, to);
  if (l <= 0) return 0;
  if (eg.isExile(l) || surrenderPm(eg, l) >= WW_SEP_LEADER_BEATEN_PM) {
    return WW_SEP_LOYAL_PTS;
  }
  const fights =
    eg.isActor(l) &&
    eg.warsOf(l).some((id) => {
      const x = eg.war(id);
      return x !== null && x.ended === null && fighting(eg.member(x, l));
    });
  if (fights && heldPm(eg, [l], [l]) >= WW_SEP_LOYAL_HOLD_PCT * 10) {
    return -WW_SEP_LOYAL_PTS;
  }
  return 0;
}

/** The offer's seeded roll, 0..99 (the white peace's). */
export function offerRoll(eg: WwEndgame, o: PeaceOffer): number {
  return (
    (wwRoll(eg.ww.politics.seed, P_WPEACE, o.id, o.from, o.to) >>> 8) % 100
  );
}

/**
 * The AI target's answer (negotiated peace, NegPeaceRules): the terms'
 * value to its side against what the war says it needs at the offer's
 * seeded roll. A white peace (value 0) is accepted exactly when the roll
 * is under its chance (aiAcceptPct; 0: never).
 */
export function aiAccepts(eg: WwEndgame, o: PeaceOffer, day: number): boolean {
  // Peace on the current line: the line's value (LinePeace.ts).
  if (o.line === true) return lineAiAccepts(eg, o, day);
  // ww88: terms asked for: its own judgement (AskTerms.ts).
  if (o.ask === true) return askTermsAccepted(eg, o);
  const w = eg.war(o.war);
  if (w === null) return false;
  // ww103: what its side has beaten stays down: it deals on the line only.
  if (targetHoldsBeaten(eg, w, o.from, o.whole, o.to)) return false;
  // ww106: a democracy that is winning fights on.
  const st = eg.sideIndex(w, o.to);
  if (st !== -1 && democracyFightsOn(eg, w, st, day)) return false;
  const f = negPeaceFacts(eg);
  const j = peaceJudgeOf(eg, w, o.from, o.to, o.whole, day, f);
  return negPeaceAccepts(j, offerValue(eg, w, o, f), offerRoll(eg, o));
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
  // ww106: nor does it ask for peace, or sign its side out.
  if ((whole || aiDemocracy(eg, id)) && democracyFightsOn(eg, w, s, day)) {
    return false;
  }
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
  // ww177 (Imjin design §7): a stalemate peace is P4's truce; until then
  // the Imjin War's sides fight on its first year out (the landings and the
  // march take months before any front stands).
  if (eg.ww.imjin && day - w.startDay < IMJIN_STALEMATE_MIN_DAYS) return false;
  const ws = eg.ww.politics.country(id)?.wsBp ?? AI_PROPOSE_WS_BP;
  return (
    whole &&
    ws < AI_PROPOSE_WS_BP &&
    !muchStronger(eg, w, s) &&
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
    if (s === -1) continue;
    const target = w.sides[1 - s].leader;
    if (peaceOfferBlock(eg, id, wid, target, day) !== null) continue;
    if (!aiWantsPeace(eg, w, id, day)) continue;
    // ww103: holding a beaten country it offers the line (aiLinePeaceDay).
    if (proposerHoldsBeaten(eg, w, id, w.sides[s].leader === id)) continue;
    // Negotiated peace: the losing side gives, a side ahead may demand.
    const terms = aiPeaceTerms(eg, w, id, target, day) ?? undefined;
    offerPeace(eg, id, wid, target, tick, terms);
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
    terms: peaceTermsView(eg, o),
    ...(o.line === true ? { line: linePeaceOfferView(eg, o) } : {}),
    ...(o.ask === true ? { ask: true } : {}),
    ...(o.home === true ? { home: true } : {}),
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
  const tIds = new Set(
    sf < 0 ? sideIds(w, st) : targetGroup(eg, w, o.from, o.to, o.whole),
  );
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
