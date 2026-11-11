// Great War 1914 (ww173 phase A, design ww173 §3 and §5): the hidden clock of
// a stalled front. Each end of each front carries a strain, 0..100, fed by
// its losses, its home and the ground it gives up, eased by holding, quiet
// and good news. A strained army attacks and holds worse (Fronts.oddsOf); at
// 80 and over it may break, and a broken end gives up a line or two at once.
// Where nobody attacks, raids and small salients keep the clock ticking and
// change a place now and then (FrontLand.frontLandAt's `salient`).
import {
  GW_FRONT_UP,
  GW_LINE_STEP,
  GW_SIDES,
  GwSeatState,
  GwSide,
  GwTempo,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import type { GwWorldCond } from "@openfront/engine-api/ww1914/WorldDsl";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { frontLandAt } from "@openfront/engine-lib/ww1914/FrontLand";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { posOf } from "./Eras";
import {
  allocOf,
  attacks,
  bandOf,
  bleed,
  move,
  oddsOf,
  ROLL_LOW,
  ROLL_SPAN,
  SCALE_OF,
  seasonOf,
} from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { lineStep, reachedLine } from "./Land";
import { capturedOrders, wonRaid } from "./Spies";
import { endIdx, endStrain, setEndStrain, STRAIN_WORN } from "./Strain";
import { membersOf, sideIn } from "./Wars";
import {
  clampTo,
  defOf,
  fights,
  monthsFrom,
  moveGauge,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

const P_COLLAPSE = idHash("gw_collapse");
const P_RAID = idHash("gw_raid");
const P_RAID_ROLL = idHash("gw_raid_roll");
const P_SALIENT = idHash("gw_salient");
const P_RAIDER = idHash("gw_raider");
const P_TRUCE = idHash("gw_truce");
const P_ORDERS = idHash("gw_raid_orders");

/** From here a collapse may come. */
const COLLAPSE_AT = 80;
/** Collapses a war has at most: the clock runs out rarely. */
const COLLAPSES_MAX = 2;
/** Thousands lost on a front for a point of strain, and the most a chapter. */
const LOSS_PER_POINT = 25;
const LOSS_FEED_MAX = 8;
/** Men rotate out of the line: an end sheds this fraction of its strain. */
const ROTATION = 20;
/**
 * What a front's depth of rail, reserves and drill takes off the chance of a
 * collapse: the west rarely breaks (design §3).
 */
const STEADY: Readonly<Partial<Record<GwTheatre, number>>> = { west: 85 };
/** A broken end stands on its new line, and holds there. */
const STRAIN_AFTER = 40;
/** What the other end eases by when the line in front of it breaks. */
const FOE_EASE = 10;
/** Months before the same front can break again. */
const COOLDOWN_MONTHS = 6;

/** Percent chance a quiet front sees a raid in a chapter. */
const RAID_PCT: Readonly<Record<GwTheatre, number>> = {
  west: 65,
  east: 60,
  italy: 60,
  balkan: 50,
  straits: 45,
  caucasus: 45,
  mesopotamia: 40,
  palestine: 45,
  sea: 0,
  colonies: 0,
  alps: 50,
  danube: 50,
  thrace: 45,
  low_countries: 50,
  dobruja: 45,
  persia: 40,
};
/** One raid in so many goes for a salient (tuned: every raid may, if it goes well). */
const SALIENT_IN = 1;
/** The raid's odds a salient needs. */
const SALIENT_AT = 105;
/** The raid's odds that win it. */
const RAID_WIN = 95;
/** A raid thrown back this badly lets the defenders bite instead. */
const BITE_BACK = 80;
/** What a lost raid costs the loser in strain. */
const RAID_WEAR = 2;
/** Places small moves change in the whole world in a chapter. */
const SMALL_MOVES_MAX = 3;
/** Chapters a salient's loser has to take it back. */
const RETAKE_WITHIN = 6;
/** One won raid in so many brings back the enemy's orders. */
const ORDERS_IN = 5;

/** The four answers every seat's collapse card gives (ww173 format 7a). */
export const GW_COLLAPSE_PICKS = ["sack", "river", "allies", "peace"] as const;
const COLLAPSE_SCENE = "gw_w_collapse";

/** The chapter `months` on from this one, on the calendar's dates. */
function chapterIn(gw: GreatWar, months: number): number {
  const rows = gwChapters(gw.s.calendar);
  const day = rows[gw.s.chapter].day + months * 30;
  const i = rows.findIndex((c, k) => k > gw.s.chapter && c.day >= day);
  return i < 0 ? rows.length : i;
}

// ---- The chief's standing word: raids or a tacit truce ----

/**
 * The tempo an end keeps: a seat's word if one fights there, else its lead's
 * staff by character (hardline and opportunist raid, cautious lie quiet; a
 * worn one lies quiet).
 */
export function tempoOf(
  gw: GreatWar,
  t: GwTheatre,
  side: GwSide,
): GwTempo | null {
  const members = membersOf(gw, t, side);
  for (const tag of members) {
    if (!ruledBySeat(gw, tag)) continue;
    return seatsOf(gw, tag)[0]?.tempo ?? null;
  }
  const lead = members.length === 0 ? null : gw.nation(members[0]);
  if (lead === null) return null;
  // A worn staff lies quiet, whatever its character.
  const th = gw.s.theatres.find((x) => x.id === t)!;
  if (endStrain(th, side) >= STRAIN_WORN) return "quiet";
  if (lead.ai === "hardline" || lead.ai === "opportunist") return "active";
  return lead.ai === "cautious" ? "quiet" : null;
}

// ---- Small moves ----

/** What one front's small move this chapter did, for its strain. */
interface Moves {
  /** Places won by small moves, by end. */
  won: [number, number];
  lost: [number, number];
}

/**
 * A raid's or a salient's odds, the narrow roll in. A night raid is a small
 * thing: the armies' odds count half, the night's luck the rest.
 */
function raidRatio(gw: GreatWar, t: GwTheatreState, by: GwSide): number {
  const s = gw.s;
  const i = s.theatres.indexOf(t);
  const roll =
    ROLL_LOW +
    (wwRoll(s.seed, P_RAID_ROLL, s.chapter, i, endIdx(by)) % ROLL_SPAN);
  const odds = 100 + Math.floor((oddsOf(gw, t, by, false, true) - 100) / 2);
  return Math.floor((odds * roll) / 100);
}

/** The place a salient change would move, or null when none would. */
function bitten(t: GwTheatreState, next: number): GwPlace | null {
  const line = reachedLine(t);
  const step = lineStep(t);
  const was = frontLandAt(t.id, line, step, t.salient ?? 0);
  const now = frontLandAt(t.id, line, step, next);
  for (const p of new Set([...was.keys(), ...now.keys()])) {
    if (was.get(p) !== now.get(p)) return p;
  }
  return null;
}

/** Who raids: a seat's or a staff's word first, else most often the fresher end. */
function raiderOf(gw: GreatWar, t: GwTheatreState): GwSide | null {
  const ends = GW_SIDES.filter((e) => membersOf(gw, t.id, e).length > 0);
  if (ends.length < 2) return null;
  const tempo = ends.map((e) => tempoOf(gw, t.id, e));
  const open = ends.filter((_, k) => tempo[k] !== "quiet");
  // A staff raids where there is ground to bite, if it has any.
  const room = open.filter((e) => canBite(t, e));
  const willing = room.length > 0 ? room : open;
  const s = gw.s;
  const i = s.theatres.indexOf(t);
  // Live and let live: a tacit truce holds two chapters in three.
  if (willing.length === 0 && wwRoll(s.seed, P_TRUCE, s.chapter, i) % 3 !== 0) {
    return null;
  }
  if (willing.length === 1) return willing[0];
  const active = ends.filter((_, k) => tempo[k] === "active");
  if (active.length === 1) return active[0];
  // Both willing: the fresher end raids two times in three.
  const [a, b] = ends.map((e) => endStrain(t, e));
  const fresh = a <= b ? 0 : 1;
  const r = wwRoll(s.seed, P_RAIDER, s.chapter, i) % 3;
  return ends[r < 2 ? fresh : 1 - fresh];
}

/** Whether `by` has a place to bite past the line here. */
function canBite(t: GwTheatreState, by: GwSide): boolean {
  const next = (t.salient ?? 0) + (by === GW_FRONT_UP[t.id] ? 1 : -1);
  return Math.abs(next) <= 2 && bitten(t, next) !== null;
}

/** Sets the salient one place on, with its news; true when a place moved. */
function shift(
  gw: GreatWar,
  t: GwTheatreState,
  by: GwSide,
  m: Moves,
  key: string,
): boolean {
  const next = (t.salient ?? 0) + (by === GW_FRONT_UP[t.id] ? 1 : -1);
  if (Math.abs(next) > 2) return false;
  const place = bitten(t, next);
  if (place === null) return false;
  t.salient = next;
  t.salientAt = gw.s.chapter;
  m.won[endIdx(by)]++;
  m.lost[endIdx(other(by))]++;
  const lead = membersOf(gw, t.id, by)[0] ?? null;
  const foe = membersOf(gw, t.id, other(by))[0] ?? null;
  news(gw, key, lead, foe, t.id, place);
  return true;
}

/**
 * A quiet front's chapter: the loser of a fresh salient tries to take it
 * back; otherwise, by the roll, one end raids. A raid that goes well bites a
 * place (a salient); one thrown back hard lets the defenders bite one; the
 * rest bring prisoners and wear the loser. True when a place changed hands.
 */
function smallMove(gw: GreatWar, t: GwTheatreState, m: Moves): boolean {
  const s = gw.s;
  const i = s.theatres.indexOf(t);
  const sal = t.salient ?? 0;
  if (sal !== 0 && s.chapter - (t.salientAt ?? -99) <= RETAKE_WITHIN) {
    const loser: GwSide =
      sal > 0 ? other(GW_FRONT_UP[t.id]) : GW_FRONT_UP[t.id];
    if (
      endStrain(t, loser) < STRAIN_WORN &&
      membersOf(gw, t.id, loser).length
    ) {
      if (raidRatio(gw, t, loser) >= RAID_WIN) {
        return shift(gw, t, loser, m, "front_salient_back");
      }
      setEndStrain(t, loser, endStrain(t, loser) + 3);
      return false;
    }
  }
  if (wwRoll(s.seed, P_RAID, s.chapter, i) % 100 >= RAID_PCT[t.id]) {
    return false;
  }
  const by = raiderOf(gw, t);
  if (by === null) return false;
  const ratio = raidRatio(gw, t, by);
  const tries = wwRoll(s.seed, P_SALIENT, s.chapter, i) % SALIENT_IN === 0;
  if (tries && ratio >= SALIENT_AT && shift(gw, t, by, m, "front_salient")) {
    return true;
  }
  // Thrown back hard, the raiders are followed into their own line.
  if (
    tries &&
    ratio <= BITE_BACK &&
    shift(gw, t, other(by), m, "front_salient")
  ) {
    return true;
  }
  const winner = ratio >= RAID_WIN ? by : other(by);
  setEndStrain(t, other(winner), endStrain(t, other(winner)) + RAID_WEAR);
  setEndStrain(t, winner, endStrain(t, winner) - 1);
  if (tempoOf(gw, t.id, by) === "active") {
    setEndStrain(t, by, endStrain(t, by) + 1);
  }
  // The prisoners talk; now and then one carries orders (S7c's Spies).
  const won = membersOf(gw, t.id, winner)[0];
  if (won !== undefined) {
    wonRaid(gw, won, t.id);
    if (wwRoll(s.seed, P_ORDERS, s.chapter, i) % ORDERS_IN === 0) {
      capturedOrders(gw, won, t.id);
    }
  }
  for (const tag of membersOf(gw, t.id, winner)) {
    for (const seat of seatsOf(gw, tag)) reason(gw, seat, "raid_won");
  }
  for (const tag of membersOf(gw, t.id, other(winner))) {
    for (const seat of seatsOf(gw, tag)) reason(gw, seat, "raid_lost");
  }
  return false;
}

// ---- Strain and collapse ----

/** Thousands `side` lost on `t` this chapter. */
function lostHere(gw: GreatWar, t: GwTheatreState, side: GwSide): number {
  const b = gw.s.battles.find(
    (x) => x.theatre === t.id && x.chapter === gw.s.chapter,
  );
  return b === undefined ? 0 : b.lost[endIdx(side)];
}

/** A friend of the end's coalition sends men from elsewhere. */
function helped(gw: GreatWar, t: GwTheatre, side: GwSide): boolean {
  const here = membersOf(gw, t, side);
  const coalition = here.length === 0 ? null : gw.nation(here[0])!.side;
  if (coalition === null) return false;
  return gw.s.nations.some(
    (n) =>
      fights(n) &&
      n.side === coalition &&
      !here.includes(n.tag) &&
      (allocOf(gw, n.tag)?.allyShare ?? 0) > 0,
  );
}

function feedOf(
  gw: GreatWar,
  t: GwTheatreState,
  side: GwSide,
  gained: number,
  m: Moves,
): number {
  const n = gw.nation(membersOf(gw, t.id, side)[0])!;
  const g = n.gauges;
  const k = endIdx(side);
  const feed =
    Math.min(
      LOSS_FEED_MAX,
      Math.floor(lostHere(gw, t, side) / LOSS_PER_POINT),
    ) +
    Math.max(0, 3 - g.morale) +
    (g.order === 0 ? 2 : 0) +
    (g.bread === 0 ? 1 : 0) +
    (g.shells === 0 ? 2 : 0) +
    (n.manpower < 12 ? 3 : 0) +
    4 * Math.max(0, -gained) +
    2 * m.lost[k] +
    (bandOf(gw, t.id, other(side)) - bandOf(gw, t.id, side) >= 20 ? 2 : 0) +
    (seasonOf(gw, t.id) > 0 ? 1 : 0);
  const a = allocOf(gw, n.tag);
  const quiet =
    gw.s.battles.find((x) => x.theatre === t.id && x.chapter === gw.s.chapter)
      ?.result === "quiet";
  const cmd = t.commander === null ? null : gw.person(t.commander);
  const cmdTag = t.commander === null ? null : defOf(t.commander)?.tag;
  const able =
    cmd !== null &&
    cmdTag !== undefined &&
    cmdTag !== null &&
    sideIn(gw, t.id, cmdTag) === side &&
    cmd.competence[0] === 3;
  const relief =
    (a?.main === t.id && a.posture === "hold" ? 3 : 0) +
    (quiet ? 1 : 0) +
    (g.morale >= 4 ? 2 : 0) +
    3 * Math.max(0, gained) +
    2 * m.won[k] +
    (helped(gw, t.id, side) ? 2 : 0) +
    (able ? 1 : 0) +
    (tempoOf(gw, t.id, side) === "quiet" ? 1 : 0);
  return feed - relief;
}

/** The chance in a hundred an end at `strain` breaks this chapter. */
function breakPct(
  gw: GreatWar,
  t: GwTheatreState,
  side: GwSide,
  strain: number,
): number {
  const lead = gw.nation(membersOf(gw, t.id, side)[0])!;
  const b = gw.s.battles.find(
    (x) => x.theatre === t.id && x.chapter === gw.s.chapter,
  );
  const attacked = b !== undefined && b.by === other(side);
  return Math.min(
    90,
    4 * (strain - 75) +
      (lead.unrest >= 3 ? 15 : 0) +
      (attacked ? 10 : 0) -
      (STEADY[t.id] ?? 0),
  );
}

/** The scene a seat gets for its own end's collapse. */
function collapseScene(tag: GwTag): string {
  const own = `${tag.toLowerCase()}_w_collapse`;
  return gwContent().scenes.some((x) => x.id === own) ? own : COLLAPSE_SCENE;
}

/** An end breaks: it gives up a line or two, its men and its nerve. */
export function collapse(gw: GreatWar, t: GwTheatreState, side: GwSide): void {
  const s = gw.s;
  const strain = endStrain(t, side);
  const members = membersOf(gw, t.id, side);
  const lead = members[0];
  const foeLead = membersOf(gw, t.id, other(side))[0] ?? null;
  move(
    gw,
    t,
    other(side),
    GW_LINE_STEP + Math.floor(Math.max(0, strain - 80) / 10),
  );
  t.trench = 0;
  t.salient = 0;
  for (const tag of members) {
    const n = gw.nation(tag)!;
    n.strength[t.id] = Math.max(1, (n.strength[t.id] ?? 1) - 1);
  }
  // The prisoners, in thousands.
  bleed(gw, t.id, side, 2 * (SCALE_OF[t.id] ?? 20));
  moveGauge(gw, lead, "morale", -1, "front_collapsed");
  moveGauge(gw, lead, "order", -1, "front_collapsed");
  const n = gw.nation(lead)!;
  n.lowOrder += 2;
  setEndStrain(t, side, STRAIN_AFTER);
  setEndStrain(t, other(side), endStrain(t, other(side)) - FOE_EASE);
  t.cooldown = chapterIn(gw, COOLDOWN_MONTHS);
  s.collapses ??= [];
  s.collapses.push({ theatre: t.id, side, tag: lead, chapter: s.chapter });
  news(gw, "front_collapse", lead, foeLead, t.id);
  for (const tag of members) {
    for (const seat of seatsOf(gw, tag)) {
      reason(gw, seat, "front_collapsed_ours");
      // The card calls the commander there, if he is ours; else the chief.
      const scene = collapseScene(seat.tag);
      const cmd = t.commander;
      if (cmd !== null && defOf(cmd)?.tag === seat.tag) {
        seat.scheduled.push({ scene, chapter: s.chapter + 1, who: cmd });
      } else {
        seat.scheduled.push({ scene, chapter: s.chapter + 1 });
      }
    }
  }
  for (const tag of membersOf(gw, t.id, other(side))) {
    for (const seat of seatsOf(gw, tag)) {
      reason(gw, seat, "front_collapsed_theirs");
    }
  }
}

/**
 * Chapter step, after every front is judged: the quiet fronts' small moves,
 * then each end's strain, then the roll for a collapse. `before`: each
 * judged front's position before the guns.
 */
export function pressureStep(
  gw: GreatWar,
  judged: readonly GwTheatreState[],
  before: readonly number[],
): void {
  const s = gw.s;
  let small = 0;
  judged.forEach((t, k) => {
    if (t.id === "sea" || t.id === "colonies") return;
    const ends = GW_SIDES.filter((e) => membersOf(gw, t.id, e).length > 0);
    if (ends.length < 2) return;
    const m: Moves = { won: [0, 0], lost: [0, 0] };
    const moved = posOf(t) !== before[k];
    // The line moved: whatever was bitten past it is part of the new line.
    if (moved) t.salient = 0;
    const pushed = GW_SIDES.some((e) => attacks(gw, t, e));
    if (!moved && !pushed && small < SMALL_MOVES_MAX && smallMove(gw, t, m)) {
      small++;
    }
    const delta = posOf(t) - before[k];
    for (const e of GW_SIDES) {
      const gained = e === GW_FRONT_UP[t.id] ? delta : -delta;
      const v = endStrain(t, e);
      const rest = Math.floor(v / ROTATION);
      setEndStrain(t, e, v - rest + feedOf(gw, t, e, gained, m));
    }
    if (s.chapter < (t.cooldown ?? 0)) return;
    if ((s.collapses ?? []).length >= COLLAPSES_MAX) return;
    const i = s.theatres.indexOf(t);
    for (const e of GW_SIDES) {
      const v = endStrain(t, e);
      if (v < COLLAPSE_AT) continue;
      const roll = wwRoll(s.seed, P_COLLAPSE, s.chapter, i, endIdx(e)) % 100;
      if (roll < breakPct(gw, t, e, v)) {
        collapse(gw, t, e);
        return;
      }
    }
  });
}

/**
 * The seats' answers to their collapse card, as the chapter closes: standing
 * on the river digs in at once, the allies' divisions come, a new commander
 * steadies the men (the card itself sends him, or opens the talks).
 */
export function collapseAnswers(gw: GreatWar): void {
  const s = gw.s;
  for (const seat of s.seats) {
    for (const c of seat.choices) {
      if (c.chapter !== s.chapter || !c.scene.endsWith("_w_collapse")) continue;
      const t = brokenFront(gw, seat);
      if (t === null) continue;
      const end = sideIn(gw, t.id, seat.tag);
      if (end === null) continue;
      if (c.pick === "river") {
        t.trench = Math.max(t.trench, 2);
        setEndStrain(t, end, endStrain(t, end) - 5);
      } else if (c.pick === "allies") {
        const n = gw.nation(seat.tag)!;
        n.strength[t.id] = clampTo((n.strength[t.id] ?? 1) + 1, 1, 5);
        setEndStrain(t, end, endStrain(t, end) - 5);
      } else if (c.pick === "sack") {
        setEndStrain(t, end, endStrain(t, end) - 5);
      }
    }
  }
}

/** The front the seat's end broke on lately, if it still stands open. */
function brokenFront(gw: GreatWar, seat: GwSeatState): GwTheatreState | null {
  const list = gw.s.collapses ?? [];
  for (let i = list.length - 1; i >= 0; i--) {
    const c = list[i];
    if (gw.s.chapter - c.chapter > 3) break;
    const t = gw.s.theatres.find((x) => x.id === c.theatre)!;
    if (t.open && sideIn(gw, t.id, seat.tag) === c.side) return t;
  }
  return null;
}

/**
 * A front end broke from strain (scene condition `collapse`): the seat's own
 * end, or with `foe` the end that faced it, within the months asked.
 */
export function collapseHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: Extract<GwWorldCond, { is: "collapse" }>,
): boolean {
  return (gw.s.collapses ?? []).some((x) => {
    if (c.theatre !== undefined && !c.theatre.includes(x.theatre)) return false;
    const end = sideIn(gw, x.theatre, seat.tag) ?? gw.nation(seat.tag)?.side;
    if (end === null || end === undefined) return false;
    if ((c.foe === true ? other(end) : end) !== x.side) return false;
    const m = monthsFrom(gw, x.chapter);
    return m >= (c.min ?? 0) && m <= (c.max ?? Infinity);
  });
}
