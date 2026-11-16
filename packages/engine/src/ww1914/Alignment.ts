// ww220 §3 (lane A): camps that move. A great power's camp (`n.camp`) is
// where it would stand if the general war came now; it starts from June
// 1914's (Wars.CASCADE) and moves only by papers: accords, bonds and signed
// treaties make the road between two powers of opposite camps a reading
// (cold, thaw, understanding, pledge, alliance), never a resource. A pledge
// keeps the pledged power out when the war comes; an alliance turns its camp.
// In the war a losing country, or one under a new regime, may change sides.
// Closings are state, never dates: a broken accord, a leak, an attack on a
// protected country, a new government, a bond gone sour.
import {
  GW_ROAD_FALL_CHAPTERS,
  GW_ROADS,
  GW_TRUST_MIN,
  GwClause,
  GwRoad,
  GwSeatState,
  GwSide,
  GwTreaty,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { warScore } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { bondOf } from "./PeaceYears";
import { regimeRow } from "./Regimes";
import { GW_START_TREATIES } from "./Tables";
import { leak, offerTreatyFrom } from "./Treaties";
import {
  addWar,
  GW_GREAT,
  juneCamp,
  naturalSide,
  refreshTheatres,
  syncAtWar,
  warOf,
} from "./Wars";
import {
  clampTo,
  fights,
  isLongChapter,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
  turn,
} from "./World";

const P_REALIGN = idHash("gw_realign");
const P_ROAD_LEAK = idHash("gw_road_leak");

/** Countries a road runs between: the great powers, and America. */
export const GW_ROAD_POWERS: readonly GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "USA",
];

/**
 * The strongest first, for `leadsOf`: who signs for a side and whose word its
 * peace waits on.
 */
export const GW_LEAD_RANK: readonly GwTag[] = [
  "DEU",
  "FRA",
  "GBR",
  "RUS",
  "AUH",
];
/** Leads that carry their side alone; any other left alone is done. */
const CARRIES_ALONE: readonly GwTag[] = ["DEU", "FRA"];

/** The small country each power stands for: an attack on it is a fall. */
export const GW_PROTECTS: Readonly<Partial<Record<GwTag, GwTag>>> = {
  GBR: "BEL",
  RUS: "SRB",
};

/** War score at or below which a side's member may change sides. */
export const GW_SWITCH_SCORE = -20;
/** Trust old partners lose in a country that turned. */
const TURN_TRUST = -3;
/** Chance in a hundred a chapter that a road treaty on the table gets out. */
const OFFER_LEAK_PCT = 4;
/** Chapters the staff pays for a plan that spares Belgium, and how much. */
export const GW_SPARE_CHAPTERS = 3;
export const GW_SPARE_COST = 10;

/**
 * Chances in a thousand, a long chapter, that a government nobody plays
 * offers a road's next step it could take (§6, §7; the M lane tunes them).
 */
export const GW_REALIGN_PER_MIL: Readonly<
  Record<"pledge" | "alliance", Readonly<Record<string, number>>>
> = {
  pledge: { opportunist: 60, principled: 40, cautious: 40, hardline: 15 },
  alliance: { opportunist: 30, principled: 5, cautious: 0, hardline: 20 },
};

const pairKey = (a: GwTag, b: GwTag) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const between = (t: GwTreaty, a: GwTag, b: GwTag) =>
  (t.from === a && t.to === b) || (t.from === b && t.to === a);
const has = (t: GwTreaty, kind: GwClause["kind"], by?: GwTag) =>
  t.clauses.some((c) => c.kind === kind && (by === undefined || c.by === by));

// ---- Camps ----

/** Where `tag` would stand if the general war came now (null: nowhere). */
export function campOf(gw: GreatWar, tag: GwTag): GwSide | null {
  return naturalSide(gw, tag);
}

/** Its camp is not June 1914's. */
export function turned(gw: GreatWar, tag: GwTag): boolean {
  return campOf(gw, tag) !== juneCamp(tag);
}

/** Two countries a road runs between: both road powers, camps apart. */
export function hasRoad(gw: GreatWar, a: GwTag, b: GwTag): boolean {
  if (a === b) return false;
  if (!GW_ROAD_POWERS.includes(a) || !GW_ROAD_POWERS.includes(b)) return false;
  const ja = juneCamp(a);
  const jb = juneCamp(b);
  if (ja !== null && jb !== null && ja !== jb) return true;
  const ca = campOf(gw, a);
  const cb = campOf(gw, b);
  return ca !== cb;
}

/** The signed treaties between the two. */
function signedBetween(gw: GreatWar, a: GwTag, b: GwTag): GwTreaty[] {
  return gw.s.treaties.filter((t) => t.state === "signed" && between(t, a, b));
}

/** Accords in force between the two. */
function accordsBetween(gw: GreatWar, a: GwTag, b: GwTag): number {
  return (gw.s.accords ?? []).filter(
    (x) =>
      x.offered !== true &&
      x.broken === null &&
      ((x.a === a && x.b === b) || (x.a === b && x.b === a)),
  ).length;
}

/** Live falls on the pair's road. */
function fallsOn(gw: GreatWar, a: GwTag, b: GwTag): number {
  const key = pairKey(a, b);
  return (gw.s.roadFalls ?? []).filter(
    (f) => f.key === key && gw.s.chapter - f.chapter < GW_ROAD_FALL_CHAPTERS,
  ).length;
}

/** The step the accords and the bond alone make: cold, thaw, understanding. */
function groundStep(gw: GreatWar, a: GwTag, b: GwTag): number {
  const accords = accordsBetween(gw, a, b);
  const bond = bondOf(gw, a, b) ?? 0;
  if (accords >= 2 || (accords >= 1 && bond >= 1)) return 2;
  return accords >= 1 ? 1 : 0;
}

/** The road's step 0..4 (GW_ROADS), or null where no road runs. */
export function roadStep(gw: GreatWar, a: GwTag, b: GwTag): number | null {
  if (!hasRoad(gw, a, b)) return null;
  const ground = groundStep(gw, a, b);
  let step = ground;
  for (const t of signedBetween(gw, a, b)) {
    if (has(t, "alliance")) step = Math.max(step, ground >= 2 ? 4 : 3);
    else if (has(t, "neutrality")) step = Math.max(step, 3);
  }
  step -= fallsOn(gw, a, b);
  if ((bondOf(gw, a, b) ?? 0) < 0) step -= 1;
  return clampTo(step, 0, GW_ROADS.length - 1);
}

/** The road as a word (the diplomacy tab, the envoy's findings). */
export function roadOf(gw: GreatWar, a: GwTag, b: GwTag): GwRoad | null {
  const step = roadStep(gw, a, b);
  return step === null ? null : GW_ROADS[step];
}

/** The road between the two falls a step for GW_ROAD_FALL_CHAPTERS. */
export function roadFall(gw: GreatWar, a: GwTag, b: GwTag, why: string): void {
  if (!hasRoad(gw, a, b)) return;
  (gw.s.roadFalls ??= []).push({ key: pairKey(a, b), chapter: gw.s.chapter });
  for (const [me, them] of [
    [a, b],
    [b, a],
  ] as const) {
    for (const seat of seatsOf(gw, me)) {
      seat.log.push({
        key: `road_fell_${why}`,
        chapter: gw.s.chapter,
        tag: them,
      });
    }
  }
}

// ---- Pledges, alliances, renouncing ----

/** `tag` signed its neutrality toward `to` (a pledge in force). */
export function pledgedTo(gw: GreatWar, tag: GwTag, to: GwTag): boolean {
  return signedBetween(gw, tag, to).some((t) => has(t, "neutrality", tag));
}

/** `tag` holds a pledge toward any country standing in `side`. */
export function pledgedAgainst(
  gw: GreatWar,
  tag: GwTag,
  side: GwSide,
): boolean {
  return gw.s.treaties.some((t) => {
    if (t.state !== "signed" || (t.from !== tag && t.to !== tag)) return false;
    const partner = t.from === tag ? t.to : t.from;
    return has(t, "neutrality", tag) && campOf(gw, partner) === side;
  });
}

/** A naval accord in force between Britain and Germany. */
export function navalAccord(gw: GreatWar): boolean {
  return (gw.s.accords ?? []).some(
    (x) =>
      x.kind === "naval" &&
      x.offered !== true &&
      x.broken === null &&
      [x.a, x.b].includes("GBR") &&
      [x.a, x.b].includes("DEU"),
  );
}

/** `tag` signed that it won't march through Belgium. */
export function spares(gw: GreatWar, tag: GwTag): boolean {
  return gw.s.treaties.some(
    (t) =>
      t.state === "signed" &&
      (t.from === tag || t.to === tag) &&
      has(t, "spare", tag),
  );
}

/** What sparing Belgium costs the side's attack on the west, percent. */
export function spareCost(gw: GreatWar, t: string, by: GwSide): number {
  const s = gw.s;
  if (t !== "west" || s.warChapter === null) return 0;
  if (s.chapter > s.warChapter + GW_SPARE_CHAPTERS) return 0;
  const deu = gw.nation("DEU");
  if (deu === null || deu.side !== by || !spares(gw, "DEU")) return 0;
  return GW_SPARE_COST;
}

/** A June 1914 treaty row is still alive (not renounced by a turned partner). */
export function startTreatyLive(id: string, gw: GreatWar): boolean {
  return !(gw.s.renounced ?? []).includes(id);
}

/** `tag` renounces its June 1914 treaties with the camp it leaves. */
function renounce(gw: GreatWar, tag: GwTag, left: GwSide): void {
  for (const row of GW_START_TREATIES) {
    if (row.by !== tag && row.for !== tag) continue;
    const partner = row.by === tag ? row.for : row.by;
    if (juneCamp(partner) !== left && campOf(gw, partner) !== left) continue;
    if (!startTreatyLive(row.id, gw)) continue;
    (gw.s.renounced ??= []).push(row.id);
  }
}

/** The great powers whose camp is `side` now, the strongest first. */
function campLeads(gw: GreatWar, side: GwSide, except: GwTag): GwTag[] {
  return GW_LEAD_RANK.filter(
    (t) => t !== except && gw.nation(t)?.out !== true && campOf(gw, t) === side,
  );
}

/** `tag`'s bond to the lead of its camp now (0 with none). */
export function bondToLead(gw: GreatWar, tag: GwTag): number {
  const camp = campOf(gw, tag);
  if (camp === null) return 0;
  const lead = campLeads(gw, camp, tag)[0];
  return lead === undefined ? 0 : (bondOf(gw, tag, lead) ?? 0);
}

/** Old partners take it badly; the news hears only once it is out. */
function tellTurn(gw: GreatWar, tag: GwTag, left: GwSide, t: GwTreaty | null) {
  for (const n of gw.s.nations) {
    if (n.tag === tag || campOf(gw, n.tag) !== left) continue;
    if (n.out) continue;
    n.trust[tag] = Math.max(GW_TRUST_MIN, (n.trust[tag] ?? 0) + TURN_TRUST);
    for (const seat of seatsOf(gw, n.tag)) {
      seat.log.push({ key: "partner_turned", chapter: gw.s.chapter, tag });
    }
  }
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "camp_turned_mine");
  if (t === null || t.leaked) {
    news(gw, "camp_turned", tag);
    turn(gw, `camp_turned@${tag}`);
  }
}

/** Before the war: `tag`'s camp turns to `to` (an alliance with its lead). */
export function turnCamp(
  gw: GreatWar,
  tag: GwTag,
  to: GwSide,
  t: GwTreaty | null = null,
): void {
  const n = gw.nation(tag);
  if (n === null || n.out || n.side !== null) return;
  const was = campOf(gw, tag);
  if (was === to) return;
  if (was !== null) renounce(gw, tag, was);
  n.camp = to;
  if (was !== null) tellTurn(gw, tag, was, t);
}

/** Who of an allied pair turns: the one whose bond to its lead is soured. */
function mover(gw: GreatWar, t: GwTreaty): GwTag | null {
  const ok = [t.from, t.to].filter(
    (x) => campOf(gw, x) !== null && bondToLead(gw, x) <= -1,
  );
  if (ok.length === 0) return null;
  // Both soured: the lower bond, then the lower lead rank, turns.
  return ok.sort(
    (x, y) =>
      bondToLead(gw, x) - bondToLead(gw, y) ||
      GW_LEAD_RANK.indexOf(y) - GW_LEAD_RANK.indexOf(x),
  )[0];
}

/** A signed alliance across the camps turns one of them, if the road allows. */
function alliancesTurn(gw: GreatWar): void {
  for (const t of gw.s.treaties) {
    if (t.state !== "signed" || !has(t, "alliance")) continue;
    if (!hasRoad(gw, t.from, t.to)) continue;
    const ca = campOf(gw, t.from);
    const cb = campOf(gw, t.to);
    if (ca === null || cb === null || ca === cb) continue;
    if ((roadStep(gw, t.from, t.to) ?? 0) < 4) continue;
    const who = mover(gw, t);
    if (who === null) continue;
    const n = gw.nation(who)!;
    const to = campOf(gw, who === t.from ? t.to : t.from)!;
    if (n.side === null) turnCamp(gw, who, to, t);
  }
}

/**
 * At the outbreak: a pledged power stands in no camp, so it starts the war
 * neutral and both sides court it. Called by Wars.openGeneral first.
 */
export function outbreakCamps(gw: GreatWar): void {
  for (const t of gw.s.treaties) {
    if (t.state !== "signed") continue;
    for (const c of t.clauses) {
      if (c.kind !== "neutrality") continue;
      const partner = c.by === t.from ? t.to : t.from;
      if (!hasRoad(gw, c.by, partner)) continue;
      const mine = campOf(gw, c.by);
      const theirs = campOf(gw, partner);
      if (mine === null || theirs === null || mine === theirs) continue;
      const n = gw.nation(c.by);
      if (n === null || n.side !== null) continue;
      n.camp = null;
      for (const seat of seatsOf(gw, c.by)) reason(gw, seat, "pledge_holds");
    }
  }
}

// ---- Changing sides in the war ----

/**
 * `tag` may change sides now: in a coalition, not out, and losing (war score
 * at or below GW_SWITCH_SCORE, or the streets at 2), or under a regime that
 * turns (Regimes `camp: "turn"`).
 */
export function canSwitch(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || n.out || n.side === null || gw.s.armistice !== null) {
    return false;
  }
  if (regimeRow(n)?.camp === "turn") return true;
  return warScore(gw, n.side) <= GW_SWITCH_SCORE || n.unrest >= 2;
}

/**
 * A country at war goes over to `to`: its wars with the new friends end in a
 * peace of two (never `out`), it renounces the old ties, takes the new side
 * and is at war with the old partners (Italy 1915 and Romania 1916, in
 * reverse). False when it can't.
 */
export function switchSide(gw: GreatWar, tag: GwTag, to: GwSide): boolean {
  const n = gw.nation(tag);
  if (n === null || n.out || n.side !== other(to)) return false;
  const was = n.side;
  for (const w of gw.s.wars) {
    if (w.ended !== null || (w.a !== tag && w.b !== tag)) continue;
    const foe = gw.nation(w.a === tag ? w.b : w.a);
    if (foe === null || foe.side !== to) continue;
    w.ended = gw.s.chapter;
    w.how = "mutual";
  }
  renounce(gw, tag, was);
  tellTurn(gw, tag, was, null);
  n.side = to;
  n.camp = to;
  for (const e of gw.s.nations) {
    if (e.side !== was || e.out || e.tag === tag) continue;
    addWar(gw, tag, e.tag, "switched");
  }
  news(gw, "side_switched", tag);
  turn(gw, `side_switched@${tag}`);
  refreshTheatres(gw);
  return true;
}

/**
 * A regime that wants no part of the war (Regimes `camp: "neutral"`): it
 * makes a peace of two with each foe and stands in no camp; not beaten.
 */
export function leaveCoalition(gw: GreatWar, tag: GwTag): boolean {
  const n = gw.nation(tag);
  if (n === null || n.out || n.side === null) return false;
  const was = n.side;
  for (const w of gw.s.wars) {
    if (w.ended !== null || (w.a !== tag && w.b !== tag)) continue;
    w.ended = gw.s.chapter;
    w.how = "mutual";
  }
  n.side = null;
  n.camp = null;
  n.mob = Math.min(n.mob, 1);
  for (const e of gw.s.nations) {
    if (e.side !== was || e.tag === tag || e.out) continue;
    e.trust[tag] = Math.max(GW_TRUST_MIN, (e.trust[tag] ?? 0) - 2);
  }
  syncAtWar(gw);
  news(gw, "left_coalition", tag);
  turn(gw, `left_coalition@${tag}`);
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, "left_coalition");
  refreshTheatres(gw);
  return true;
}

/** Regimes.changeRegime: what the new form does to the country's camp. */
export function regimeCamp(gw: GreatWar, tag: GwTag): void {
  const n = gw.nation(tag);
  if (n === null) return;
  const row = regimeRow(n);
  // A new government in peace looks again at every road its rivals built.
  if (gw.s.warChapter === null) {
    for (const x of GW_ROAD_POWERS) {
      if (hasRoad(gw, tag, x) && (roadStep(gw, tag, x) ?? 0) > 0) {
        roadFall(gw, tag, x, "government");
      }
    }
  }
  if (row?.camp !== "neutral") return;
  n.camp = null;
  // A regime that asks for peace goes to the table the old way (Peace.ts).
  if (row.seeksPeace) return;
  if (fights(n) && n.side !== null && !ruledBySeat(gw, tag)) {
    leaveCoalition(gw, tag);
  }
}

// ---- Treaties (Treaties.ts calls these) ----

/** An alliance with the enemy is a road only for one that may change sides. */
export function switchTreatyOk(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
  clauses: readonly GwClause[],
): boolean {
  if (!clauses.some((c) => c.kind === "alliance")) return false;
  return canSwitch(gw, a) || canSwitch(gw, b);
}

/** A treaty was signed: an alliance across a war is a change of sides. */
export function onTreatySigned(gw: GreatWar, t: GwTreaty): void {
  if (!has(t, "alliance")) return;
  const a = gw.nation(t.from);
  const b = gw.nation(t.to);
  if (a === null || b === null) return;
  if (warOf(gw, t.from, t.to) !== null && a.side !== null && b.side !== null) {
    const ca = canSwitch(gw, t.from);
    const cb = canSwitch(gw, t.to);
    const who =
      ca && cb
        ? GW_LEAD_RANK.indexOf(t.from) > GW_LEAD_RANK.indexOf(t.to)
          ? t.from
          : t.to
        : ca
          ? t.from
          : cb
            ? t.to
            : null;
    if (who === null) return;
    const partner = who === t.from ? b : a;
    switchSide(gw, who, partner.side!);
    return;
  }
  alliancesTurn(gw);
}

/** A road treaty got out: the press and the parties pull the road back. */
export function onTreatyLeaked(gw: GreatWar, t: GwTreaty): void {
  if (!has(t, "alliance") && !has(t, "neutrality")) return;
  if (!hasRoad(gw, t.from, t.to)) return;
  if (gw.s.warChapter === null || t.state === "offered") {
    roadFall(gw, t.from, t.to, "leak");
  }
  // A camp turned on this alliance in secret: now the world hears it.
  if (t.state !== "signed" || !has(t, "alliance")) return;
  for (const [tag, partner] of [
    [t.from, t.to],
    [t.to, t.from],
  ] as const) {
    const camp = campOf(gw, tag);
    if (turned(gw, tag) && camp !== null && camp === campOf(gw, partner)) {
      news(gw, "camp_turned", tag);
    }
  }
}

/** What the road adds to an AI's wish to sign a treaty across the camps. */
export function roadSignTerm(gw: GreatWar, t: GwTreaty): number {
  if (!hasRoad(gw, t.from, t.to)) return 0;
  if (!has(t, "alliance") && !has(t, "neutrality") && !has(t, "spare")) {
    return 0;
  }
  const bond = bondOf(gw, t.from, t.to) ?? 0;
  const step = roadStep(gw, t.from, t.to) ?? 0;
  let term = 10 * bond + 5 * step;
  // An alliance needs the understanding first.
  if (has(t, "alliance") && groundStep(gw, t.from, t.to) < 2) term -= 30;
  return term;
}

// ---- The leads of a side (Peace.ts) ----

/** The great powers that joined `side`, the strongest first. */
export function leadsOf(gw: GreatWar, side: GwSide): GwTag[] {
  return GW_LEAD_RANK.filter((t) => gw.nation(t)?.side === side);
}

/** The leads of `side` still fighting, the strongest first. */
export function leadsLeft(gw: GreatWar, side: GwSide): GwTag[] {
  return leadsOf(gw, side).filter((t) => fights(gw.nation(t)));
}

/**
 * The side is done: its leads are out, or one is left alone that cannot carry
 * it (only Germany and France can; June 1914's "France with Russia gone").
 * A side no lead joined is done when every member of it is out.
 */
export function sideDoneBy(gw: GreatWar, side: GwSide): boolean {
  const members = gw.s.nations.filter((n) => n.side === side);
  if (members.length === 0) return false;
  if (leadsOf(gw, side).length === 0) return members.every((n) => n.out);
  const left = leadsLeft(gw, side);
  if (left.length === 0) return true;
  return left.length === 1 && !CARRIES_ALONE.includes(left[0]);
}

// ---- The step ----

/** Wars on a protected country: a fall on the attacker's road with its protector. */
function protectedAttacked(gw: GreatWar): void {
  for (const [guard, ward] of Object.entries(GW_PROTECTS) as [GwTag, GwTag][]) {
    for (const w of gw.s.wars) {
      if (w.ended !== null || w.b !== ward || w.since !== gw.s.chapter)
        continue;
      if (hasRoad(gw, guard, w.a)) roadFall(gw, guard, w.a, "protected");
    }
  }
}

/** Road treaties on the table can get out before anyone signs. */
function offersLeak(gw: GreatWar): void {
  const s = gw.s;
  for (const t of s.treaties) {
    if (t.state !== "offered" || t.leaked || !hasRoad(gw, t.from, t.to)) {
      continue;
    }
    if (!has(t, "alliance") && !has(t, "neutrality")) continue;
    if (wwRoll(s.seed, P_ROAD_LEAK, t.uid, s.chapter) % 100 >= OFFER_LEAK_PCT) {
      continue;
    }
    leak(gw, t);
  }
}

/** A seat stands in `side` (not a party): no AI walks a road toward it. */
function seatIn(
  gw: GreatWar,
  side: GwSide,
  parties: readonly GwTag[],
): boolean {
  return gw.s.seats.some(
    (x) =>
      x.memoir === null &&
      !x.regent &&
      !parties.includes(x.tag) &&
      campOf(gw, x.tag) === side,
  );
}

/** The step an AI pair could offer next, and who offers it. */
function nextOffer(
  gw: GreatWar,
  a: GwTag,
  b: GwTag,
): { step: "pledge" | "alliance"; by: GwTag; to: GwTag } | null {
  const step = roadStep(gw, a, b);
  const bond = bondOf(gw, a, b) ?? 0;
  if (step === null) return null;
  const open = gw.s.treaties.some(
    (t) => t.state === "offered" && between(t, a, b),
  );
  if (open) return null;
  if (warOf(gw, a, b) !== null) {
    // In the war: only one that may change sides offers, and only an alliance.
    const by = canSwitch(gw, a) ? a : canSwitch(gw, b) ? b : null;
    if (by === null || bond < 0) return null;
    const to = by === a ? b : a;
    const camp = gw.nation(to)?.side ?? null;
    if (camp === null || seatIn(gw, camp, [a, b])) return null;
    return { step: "alliance", by, to };
  }
  // The one less tied to its own lead walks first; even, the lesser power.
  const rank = (x: GwTag) => GW_LEAD_RANK.indexOf(x);
  const first = bondToLead(gw, a) - bondToLead(gw, b) || rank(b) - rank(a);
  const [by, to] = first <= 0 ? [a, b] : [b, a];
  if (step === 2 && bond >= 1 && !pledgedTo(gw, by, to)) {
    return { step: "pledge", by, to };
  }
  if (step >= 3 && bond >= 2 && bondToLead(gw, by) <= -1) {
    const camp = campOf(gw, to);
    if (camp === null || seatIn(gw, camp, [a, b])) return null;
    return { step: "alliance", by, to };
  }
  return null;
}

/**
 * §6: a government nobody plays looks at each road it stands on, once a long
 * chapter, and by its character offers the next step: a pledge of its own
 * neutrality, or an alliance. A seat on the far side answers by its card.
 */
export function aiRealign(gw: GreatWar): void {
  const s = gw.s;
  if (s.armistice !== null || !isLongChapter(gw)) return;
  for (let i = 0; i < GW_GREAT.length; i++) {
    for (let j = i + 1; j < GW_GREAT.length; j++) {
      const a = GW_GREAT[i];
      const b = GW_GREAT[j];
      const offer = nextOffer(gw, a, b);
      if (offer === null || ruledBySeat(gw, offer.by)) continue;
      const n = gw.nation(offer.by);
      if (n === null || n.out) continue;
      if (offer.step === "alliance" && s.warChapter !== null) {
        // In the war only a hardline government that is losing goes over.
        if (n.ai !== "hardline" || !canSwitch(gw, offer.by)) continue;
      }
      const per = GW_REALIGN_PER_MIL[offer.step][n.ai] ?? 0;
      const roll = wwRoll(s.seed, P_REALIGN, s.chapter, idHash(pairKey(a, b)));
      if (roll % 1000 >= per) continue;
      // Britain's price for its neutrality: Belgium spared.
      const spare =
        offer.step === "pledge" && offer.by === "GBR" && offer.to === "DEU";
      if (spare) {
        offerTreatyFrom(gw, "GBR", "DEU", [
          { kind: "neutrality", by: "GBR", theatre: null, value: 0 },
          { kind: "spare", by: "DEU", theatre: null, value: 0 },
        ]);
      } else {
        offerRoad(gw, offer.by, offer.to, offer.step, false);
      }
    }
  }
}

/**
 * `by` offers `to` the treaty of a road's step. `pledge`: `by`'s own
 * neutrality, or with `ask` `to`'s; `spare`: `by` spares Belgium too (what
 * Germany gives for Britain's pledge). False when it can't.
 */
export function offerRoad(
  gw: GreatWar,
  by: GwTag,
  to: GwTag,
  step: "pledge" | "alliance",
  spare: boolean,
  ask = false,
): boolean {
  const pledger = ask ? to : by;
  const clauses: GwClause[] =
    step === "pledge"
      ? [{ kind: "neutrality", by: pledger, theatre: null, value: 0 }]
      : [{ kind: "alliance", by, theatre: null, value: 0 }];
  if (spare) clauses.push({ kind: "spare", by, theatre: null, value: 0 });
  return offerTreatyFrom(gw, by, to, clauses) === null;
}

/** Chapter step, after the treaties: falls, leaks, alliances that turn, the AI. */
export function alignStep(gw: GreatWar): void {
  if (gw.s.armistice !== null) return;
  protectedAttacked(gw);
  offersLeak(gw);
  alliancesTurn(gw);
  aiRealign(gw);
}

// ---- Scenes (WorldDsl `road`, `camp`, `switch_can`; the four effects) ----

export type GwAlignCond = Extract<
  GwWorldCond,
  { is: "road" | "camp" | "switch_can" }
>;
export type GwAlignEffect = Extract<
  GwWorldEffect,
  { do: "road_fall" | "realign_offer" | "switch_side" | "leave_coalition" }
>;

export function alignHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwAlignCond,
): boolean {
  switch (c.is) {
    case "road": {
      const step = roadStep(gw, c.of ?? seat.tag, c.tag);
      return (
        step !== null &&
        step >= (c.min ?? -Infinity) &&
        step <= (c.max ?? Infinity)
      );
    }
    case "camp": {
      const tag = c.tag ?? seat.tag;
      const camp = campOf(gw, tag) ?? "neutral";
      if (c.of !== undefined && !c.of.includes(camp)) return false;
      return c.turned === undefined || turned(gw, tag) === c.turned;
    }
    case "switch_can":
      return canSwitch(gw, c.tag ?? seat.tag);
  }
}

export function alignDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: GwAlignEffect,
): void {
  switch (e.do) {
    case "road_fall":
      roadFall(gw, seat.tag, e.tag, "paper");
      return;
    case "realign_offer":
      offerRoad(gw, seat.tag, e.tag, e.step, e.spare === true, e.ask === true);
      return;
    case "switch_side": {
      const to = gw.nation(e.tag)?.side ?? null;
      if (to !== null && canSwitch(gw, seat.tag)) switchSide(gw, seat.tag, to);
      return;
    }
    case "leave_coalition":
      leaveCoalition(gw, seat.tag);
      return;
  }
}

/** The seat's roads for the diplomacy tab: each power a road runs to. */
export function roadsOf(
  gw: GreatWar,
  tag: GwTag,
): { tag: GwTag; road: GwRoad }[] {
  const out: { tag: GwTag; road: GwRoad }[] = [];
  for (const x of GW_GREAT) {
    const road = roadOf(gw, tag, x);
    if (road !== null && gw.nation(x)?.out !== true) out.push({ tag: x, road });
  }
  return out;
}
