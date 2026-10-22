// P6 lane D (plan Task 2): doctrine mastery, grand doctrines, sub-doctrines
// (spec §3). The country's depth day turns the day's combat tally into
// mastery; the orders pick (and switch) grand doctrines and sub-doctrines;
// the doctrine part of the country's stats is DoctrineRules.doctrineStats
// of the picks and the tracks' levels.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import {
  DOCTRINE_DOMAINS,
  DOCTRINE_TRACKS,
  GD_SWITCH_LOCK_DAYS,
  GD_SWITCH_XP,
  GRAND_DOCTRINES,
  MASTERY_MAX_MILLI,
  SUB_SWITCH_LOCK_DAYS,
  SUB_SWITCH_XP,
  SUBDOCTRINES,
} from "@openfront/engine-api/ww1936/DepthTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type {
  WwStatKey,
  WwStats,
} from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  addMastery,
  AIR_SHARE_MICRO_PER_SORTIE,
  AIR_XP_MAX_MILLI,
  airXpDayMilli,
  doctrinePickBlock,
  doctrineStats,
  masteryGain,
  masteryLevel,
} from "@openfront/engine-lib/ww1936/DoctrineRules";
import type { EffectCtx } from "../politics/Dispatch";
import type { CountryDepth, Domain, WwDepth } from "./WwDepth";

const TRACKS = DOCTRINE_TRACKS.length;

/** The country's doctrine-mastery speed (spec §3.4: rsDoctrinePct — the theorist advisor, cf_army). */
function speedPct(d: WwDepth, id: number): number {
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  return s?.rsDoctrinePct ?? 0;
}

/**
 * Spec §3.4, the country's depth day: each track gains
 * masteryGain(the day's combat tally, rsDoctrinePct) — the base 0.3 a day
 * plus its share of the day's fighting, at most 1.2 — and the tally
 * empties. A level reached tells the owner once (the day's highest), and
 * a level change recomputes the doctrine stats.
 */
export function dailyDoctrine(d: WwDepth, id: number, day: number): void {
  void day;
  const c = d.country(id);
  const t = d.dayTally;
  if (c === null) {
    t.fill(0, id * TRACKS, id * TRACKS + TRACKS);
    return;
  }
  const doc = c.doc;
  const pct = speedPct(d, id);
  dailyAirXp(d, id);
  let levelChanged = false;
  let best = -1;
  let bestLevel = 0;
  for (let dom = 0; dom < 3; dom++) {
    const gain = masteryGain(domainTally(d, c, id, dom), pct);
    for (let k = 0; k < 3; k++) {
      const tr = dom * 3 + k;
      const before = doc.masteryMilli[tr];
      const after = addMastery(before, gain[k]);
      doc.masteryMilli[tr] = after;
      doc.gain[tr] = after - before;
      const level = masteryLevel(after);
      if (level !== masteryLevel(before)) levelChanged = true;
      // A level not told yet (the day's growth or an effect's); a switch's
      // halving brings `announced` down without a word.
      if (level > (doc.announced[tr] ?? 0) && level > bestLevel) {
        best = tr;
        bestLevel = level;
      }
      doc.announced[tr] = level;
    }
  }
  t.fill(0, id * TRACKS, id * TRACKS + TRACKS);
  if (levelChanged) d.markStats(id);
  if (best >= 0) {
    // WwPolitics.message adds "events_display.".
    d.message(id, "ww1936_mastery_level", {
      domain: DOCTRINE_DOMAINS[Math.floor(best / 3)],
      track: DOCTRINE_TRACKS[best],
      level: bestLevel,
    });
  }
}

/**
 * Spec §3.4 combat shares of the domain's three tracks; spec §3.2's last
 * bullet: while the domain has no grand doctrine its tracks grow by the
 * base 0.3 alone (review 4).
 */
function domainTally(
  d: WwDepth,
  c: CountryDepth,
  id: number,
  dom: number,
): [number, number, number] {
  if ((c.doc.gd[dom] ?? -1) < 0) return [0, 0, 0];
  const t = d.dayTally;
  const o = id * TRACKS + dom * 3;
  return [t[o] ?? 0, t[o + 1] ?? 0, t[o + 2] ?? 0];
}

/**
 * Lane D (review 11): the day's air experience from the air tracks' tally
 * (AIR_SHARE_MICRO_PER_SORTIE micro-mastery a sortie) and the airXpMilli
 * stat — DoctrineRules.airXpDayMilli. Read before the tally empties.
 */
function dailyAirXp(d: WwDepth, id: number): void {
  const ca = d.ww.air.country(id);
  if (ca === null) return;
  const t = d.dayTally;
  const o = id * TRACKS + 6;
  const sorties = Math.floor(
    ((t[o] ?? 0) + (t[o + 1] ?? 0) + (t[o + 2] ?? 0)) /
      AIR_SHARE_MICRO_PER_SORTIE,
  );
  const s = d.ww.economy.country(id)?.stats as
    | Partial<Record<WwStatKey, number>>
    | undefined;
  const gain = airXpDayMilli(sorties, s?.airXpMilli ?? 0);
  if (gain === 0) return;
  const next = Math.max(0, Math.min(AIR_XP_MAX_MILLI, ca.airXpMilli + gain));
  if (next !== ca.airXpMilli) {
    ca.airXpMilli = next;
    d.ww.air.markCountry(id);
  }
}

/** Mastery level per track (9). */
export function trackLevels(c: CountryDepth): number[] {
  return c.doc.masteryMilli.map((m) => masteryLevel(m));
}

/** Spec §3.2–§3.3: the doctrine part of the country's stats. */
export function doctrineStatsOf(d: WwDepth, id: number): Partial<WwStats> {
  const c = d.country(id);
  if (c === null) return {};
  return doctrineStats({ gd: c.doc.gd, sub: c.doc.sub }, trackLevels(c));
}

/** Halves the mastery of tracks `from` .. `to` - 1 (a switch, spec §3.2–§3.3). */
function halve(c: CountryDepth, from: number, to: number): void {
  for (let t = from; t < to; t++) {
    c.doc.masteryMilli[t] = Math.floor(c.doc.masteryMilli[t] / 2);
  }
}

/**
 * doctrine_pick, subdoctrine_pick (spec §3.2–§3.3; DoctrineRules.
 * doctrinePickBlock judges). The first pick is free; a switch costs the
 * domain's experience (grand: 100 land / 75 naval or air; sub: 25),
 * halves the mastery (grand: the domain's three tracks; sub: its track)
 * and locks the choice (180 / 90 days).
 */
export function issueDoctrine(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  const c = d.country(id);
  if (c === null) return "dead";
  const day = d.ww.day(tick);
  const doc = c.doc;
  if (o.kind === "doctrine_pick") {
    const domain = DOCTRINE_DOMAINS.indexOf(o.domain) as Domain;
    const gd = GRAND_DOCTRINES.indexOf(o.id);
    const current = doc.gd[domain] ?? -1;
    const block = doctrinePickBlock({
      domain,
      gd,
      current,
      lockUntil: doc.gdLock[domain] ?? -1,
      day,
      xp: d.xpOf(id, domain),
    });
    if (block !== null) return block;
    if (current >= 0) {
      if (!d.spendXp(id, domain, GD_SWITCH_XP[domain])) return "no_xp";
      halve(c, domain * 3, domain * 3 + 3);
      doc.gdLock[domain] = day + GD_SWITCH_LOCK_DAYS;
    }
    doc.gd[domain] = gd;
    d.markStats(id);
    return null;
  }
  if (o.kind === "subdoctrine_pick") {
    const track = DOCTRINE_TRACKS.indexOf(o.track);
    const domain = Math.floor(track / 3) as Domain;
    const sub = SUBDOCTRINES.indexOf(o.id);
    const current = doc.sub[track] ?? -1;
    const block = doctrinePickBlock({
      domain,
      gd: -1,
      current: -1,
      lockUntil: doc.subLock[track] ?? -1,
      day,
      xp: d.xpOf(id, domain),
      track,
      sub,
      currentSub: current,
    });
    if (block !== null) return block;
    if (current >= 0) {
      if (!d.spendXp(id, domain, SUB_SWITCH_XP)) return "no_xp";
      halve(c, track, track + 1);
      doc.subLock[track] = day + SUB_SWITCH_LOCK_DAYS;
    }
    doc.sub[track] = sub;
    d.markStats(id);
    return null;
  }
  return "bad_index";
}

/**
 * The doctrine_mastery effect (spec §1.4, §3.4, §18.3): `amount` mastery
 * (× 1000 milli) to the track, or split over the domain's three tracks —
 * floor(/3) each, the remainder to the first.
 */
export function applyMasteryEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "doctrine_mastery" }>,
  actor: number,
): void {
  const d = ctx.pol.ww.depth as WwDepth | undefined;
  const c = d?.country(actor) ?? null;
  if (d === undefined || c === null) return;
  const milli = Math.trunc(e.amount * 1000);
  const doc = c.doc;
  const before = trackLevels(c);
  if (e.track !== undefined) {
    const t = DOCTRINE_TRACKS.indexOf(e.track);
    if (t >= 0) doc.masteryMilli[t] = addMastery(doc.masteryMilli[t], milli);
  } else {
    const dom = DOCTRINE_DOMAINS.indexOf(e.domain);
    if (dom < 0) return;
    const each = Math.trunc(milli / 3);
    const rest = milli - each * 3;
    for (let k = 0; k < 3; k++) {
      const t = dom * 3 + k;
      doc.masteryMilli[t] = addMastery(
        doc.masteryMilli[t],
        each + (k === 0 ? rest : 0),
      );
    }
  }
  if (trackLevels(c).some((l, t) => l !== before[t])) d.markStats(actor);
  d.markCountry(actor);
}

/**
 * Spec §3.4 for the screens ("+0.84/일"): the mastery each track gained on
 * the country's last depth day, milli. Before its first day (the
 * preparation minute), today's gain from the tally so far (review E6's
 * reading); a track at the cap gains 0.
 */
export function doctrineGainMilli(d: WwDepth, id: number): number[] {
  const c = d.country(id);
  if (c === null) return new Array<number>(TRACKS).fill(0);
  if (c.doc.gain.some((g) => g !== 0)) return [...c.doc.gain];
  const pct = speedPct(d, id);
  const out: number[] = [];
  for (let dom = 0; dom < 3; dom++) {
    const g = masteryGain(domainTally(d, c, id, dom), pct);
    for (let k = 0; k < 3; k++) {
      const m = c.doc.masteryMilli[dom * 3 + k];
      out.push(Math.min(g[k], MASTERY_MAX_MILLI - m));
    }
  }
  return out;
}
