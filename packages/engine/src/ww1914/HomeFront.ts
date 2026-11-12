// Great War 1914 (ww190 §5): the home front. Prisoners are the one new
// list: taken when a front collapses or breaks, when a country capitulates,
// and every long chapter from the losses on the fronts; swapped through
// Switzerland, made to suffer in reprisal, sent home by the aftermath. The
// flu has its waves. Hunger, women at work and refugees are derived from
// state the game keeps already (the blockade, shipping, bread, manpower,
// footing and laws, land held). Scenes read them all through world conds.
import type {
  GwNationState,
  GwSeatState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_SIDES } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import {
  GW_PLACE_KEYS,
  GW_PLACES,
} from "@openfront/engine-api/ww1914/GwPlaces";
import type {
  GwWorldCond,
  GwWorldEffect,
} from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_CAPITALS } from "@openfront/engine-lib/ww1914/PlaceRules";
import { civilFromDays } from "@openfront/engine-lib/ww1936/Calendar";
import { idHash, wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { SCALE_OF } from "./Fronts";
import type { GreatWar } from "./GreatWar";
import { holderOf } from "./Land";
import { atWarWith, membersOf } from "./Wars";
import {
  clampTo,
  everyMonths,
  fights,
  isLongChapter,
  monthsFrom,
  moveGauge,
  news,
  other,
  reason,
  ruledBySeat,
  seatsOf,
} from "./World";

export type GwHomeFrontCond = Extract<
  GwWorldCond,
  {
    is: "prisoners" | "hunger" | "women_work" | "refugees" | "flu";
  }
>;
export type GwHomeFrontEffect = Extract<
  GwWorldEffect,
  { do: "exchange" | "reprisal" }
>;

const P_FLU = idHash("gw_flu");
const P_FLU_GAP = idHash("gw_flu_gap");

/** Thousands of men per point of manpower (Fronts' MEN_PER_POINT). */
const MEN_PER_POINT = 60;
/** Prisoners home, in thousands, for a point of manpower; and the most. */
const HOME_PER_POINT = 50;
const HOME_MAX = 10;
/** A return this large (thousands) shakes order. */
const BIG_RETURN = 250;
/** A tenth each way in an exchange; a tenth of the losses taken prisoner. */
const TENTH = 10;
/** Laws that put women into the works or every man into service. */
const SERVICE_LAWS: readonly string[] = ["gbr_conscription", "deu_aux"];
/** The flu: war months before it can come, the date it can come at peace. */
const FLU_WAR_MONTHS = 36;
const FLU_PEACE_FROM = [1918, 3] as const;
const FLU_WAVE_MONTHS = 3;
const FLU_WAVES = 3;

const inRange = (v: number, c: { min?: number; max?: number }) =>
  v >= (c.min ?? -Infinity) && v <= (c.max ?? Infinity);

/** A range with neither end asks for any at all. */
const anyOr = (v: number, c: { min?: number; max?: number }) =>
  c.min === undefined && c.max === undefined ? v >= 1 : inRange(v, c);

function tell(gw: GreatWar, tag: GwTag, key: string): void {
  for (const seat of seatsOf(gw, tag)) reason(gw, seat, key);
}

// ---- Prisoners ----

/** Men of `of` (anyone's, if absent) held by `by`, in thousands. */
export function prisonersHeld(gw: GreatWar, by: GwTag, of?: GwTag): number {
  return (gw.s.prisoners ?? [])
    .filter((r) => r.by === by && (of === undefined || r.of === of))
    .reduce((a, r) => a + r.n, 0);
}

/** Men of `tag` held by anyone (by `by`, if given), in thousands. */
function heldOf(gw: GreatWar, tag: GwTag, by?: GwTag): number {
  return (gw.s.prisoners ?? [])
    .filter((r) => r.of === tag && (by === undefined || r.by === by))
    .reduce((a, r) => a + r.n, 0);
}

export function addPrisoners(
  gw: GreatWar,
  by: GwTag,
  of: GwTag,
  n: number,
): void {
  if (n <= 0 || by === of) return;
  if (gw.nation(by) === null || gw.nation(of) === null) return;
  const s = gw.s;
  s.prisoners ??= [];
  const row = s.prisoners.find((r) => r.by === by && r.of === of);
  if (row !== undefined) row.n += n;
  else s.prisoners.push({ by, of, n });
}

function take(gw: GreatWar, by: GwTag, of: GwTag, n: number): number {
  const row = (gw.s.prisoners ?? []).find((r) => r.by === by && r.of === of);
  if (row === undefined || n <= 0) return 0;
  const out = Math.min(row.n, n);
  row.n -= out;
  if (row.n === 0) gw.s.prisoners = gw.s.prisoners!.filter((r) => r !== row);
  return out;
}

function trustUp(gw: GreatWar, a: GwTag, b: GwTag, d: number): void {
  const na = gw.nation(a);
  const nb = gw.nation(b);
  if (na !== null) na.trust[b] = clampTo((na.trust[b] ?? 0) + d, -3, 3);
  if (nb !== null) nb.trust[a] = clampTo((nb.trust[a] ?? 0) + d, -3, 3);
}

function menHome(gw: GreatWar, tag: GwTag, thousands: number): void {
  const n = gw.nation(tag);
  if (n === null) return;
  const d = Math.min(HOME_MAX, Math.floor(thousands / HOME_PER_POINT));
  n.manpower = clampTo(n.manpower + d, 0, 100);
}

/** Through Switzerland: a tenth of each side's prisoners go home. */
export function exchange(gw: GreatWar, a: GwTag, b: GwTag): void {
  if (a === b) return;
  const toB = take(gw, a, b, Math.ceil(prisonersHeld(gw, a, b) / TENTH));
  const toA = take(gw, b, a, Math.ceil(prisonersHeld(gw, b, a) / TENTH));
  if (toA + toB === 0) return;
  menHome(gw, a, toA);
  menHome(gw, b, toB);
  trustUp(gw, a, b, 1);
  news(gw, "prisoners_exchanged", a, b);
  tell(gw, a, "prisoners_exchanged");
  tell(gw, b, "prisoners_exchanged");
}

/** `a` makes `b`'s men in its camps pay for something `b` did. */
export function reprisal(gw: GreatWar, a: GwTag, b: GwTag): void {
  if (a === b || prisonersHeld(gw, a, b) === 0) return;
  trustUp(gw, a, b, -1);
  moveGauge(gw, b, "morale", -1, "prisoners_reprisal");
  const usa = gw.nation("USA");
  if (gw.nation(a)?.side === "central" && usa !== null && usa.side === null) {
    usa.readiness = clampTo(usa.readiness + 2, 0, 100);
  }
  news(gw, "prisoners_reprisal", a, b);
  tell(gw, a, "prisoners_reprisal");
}

/** The aftermath sends them home (Aftermath.ts calls it). */
export function returnPrisoners(gw: GreatWar): void {
  const list = gw.s.prisoners ?? [];
  if (list.length === 0) return;
  const home = new Map<GwTag, number>();
  for (const r of list) home.set(r.of, (home.get(r.of) ?? 0) + r.n);
  for (const [tag, n] of home) {
    menHome(gw, tag, n);
    if (n >= BIG_RETURN) moveGauge(gw, tag, "order", -1, "prisoners_home");
    tell(gw, tag, "prisoners_home");
    news(gw, "prisoners_home", tag);
  }
  gw.s.prisoners = [];
}

/** What `tag`'s capitulation leaves in the enemy's hands: a fifth of its men. */
export function capitulationPrisoners(gw: GreatWar, tag: GwTag): void {
  const n = gw.nation(tag);
  if (n === null || n.atWar.length === 0) return;
  const cap = GW_CAPITALS[tag];
  const at = cap === undefined ? null : holderOf(gw, cap);
  const by =
    at !== null && at !== tag && n.atWar.includes(at) ? at : n.atWar[0];
  addPrisoners(gw, by, tag, Math.floor((n.manpower * MEN_PER_POINT) / 5));
}

/** A front's end collapsed: the bleed of its men goes to the other end. */
export function collapsePrisoners(
  gw: GreatWar,
  theatre: Parameters<typeof membersOf>[1],
  side: (typeof GW_SIDES)[number],
  n: number,
): void {
  const of = membersOf(gw, theatre, side)[0];
  const by = membersOf(gw, theatre, other(side))[0];
  if (of === undefined || by === undefined) return;
  addPrisoners(gw, by, of, n);
}

/** This chapter's breakthroughs, and a tenth of every country's losses. */
function takenThisChapter(gw: GreatWar): void {
  const s = gw.s;
  for (const b of s.battles) {
    if (b.chapter !== s.chapter || b.result !== "break" || b.by === null) {
      continue;
    }
    collapsePrisoners(
      gw,
      b.theatre,
      other(b.by),
      Math.floor((SCALE_OF[b.theatre] ?? 20) / 2),
    );
  }
  for (const n of s.nations) {
    const caught = Math.floor(n.lostNow / TENTH);
    if (caught <= 0 || !fights(n)) continue;
    const foes: GwTag[] = [];
    for (const t of s.theatres) {
      if (t.since === null || !t.open) continue;
      for (const side of GW_SIDES) {
        if (!membersOf(gw, t.id, side).includes(n.tag)) continue;
        const foe = membersOf(gw, t.id, other(side))[0];
        if (foe !== undefined && !foes.includes(foe)) foes.push(foe);
      }
    }
    if (foes.length === 0) continue;
    const each = Math.floor(caught / foes.length);
    foes.forEach((f, i) =>
      addPrisoners(gw, f, n.tag, each + (i === 0 ? caught % foes.length : 0)),
    );
  }
}

/** The AI's camps: the mild swap twice a year, the hard pay back. */
function aiPrisoners(gw: GreatWar): void {
  if (!everyMonths(gw, 6)) return;
  const mild = (n: GwNationState | null) =>
    n !== null && (n.ai === "principled" || n.ai === "cautious");
  const pairs: [GwTag, GwTag][] = [];
  for (const r of gw.s.prisoners ?? []) {
    const [a, b] = r.by < r.of ? [r.by, r.of] : [r.of, r.by];
    if (!pairs.some(([x, y]) => x === a && y === b)) pairs.push([a, b]);
  }
  for (const [a, b] of pairs) {
    if (ruledBySeat(gw, a) || ruledBySeat(gw, b)) continue;
    const na = gw.nation(a);
    const nb = gw.nation(b);
    if (mild(na) && mild(nb)) exchange(gw, a, b);
  }
  for (const [a, b] of pairs) {
    for (const [x, y] of [
      [a, b],
      [b, a],
    ] as const) {
      if (ruledBySeat(gw, x) || gw.nation(x)?.ai !== "hardline") continue;
      const ours = prisonersHeld(gw, y, x);
      if (ours > 0 && ours >= 2 * prisonersHeld(gw, x, y)) reprisal(gw, x, y);
    }
  }
}

// ---- Derived: hunger, women at work, refugees ----

const band = (v: number) => (v >= 8 ? 3 : v >= 6 ? 2 : v >= 3 ? 1 : 0);

export function hungerOf(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  if (n === null) return 0;
  const s = gw.s;
  const blockaded = n.side === "central";
  let h = 0;
  if (blockaded) h = band(s.blockade);
  if (tag === "GBR") h = Math.max(h, band(s.shipping));
  const bread = n.gauges.bread;
  h = Math.max(h, bread === 0 ? 2 : bread <= 1 ? 1 : 0);
  if (bread === 0 && blockaded && s.blockade >= 6) h++;
  return Math.min(3, h);
}

export function womenAtWork(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  // Only a country that has been to war: the works fill as the men go.
  if (n === null || n.entered === null) return 0;
  const law = n.laws.some(
    (l) => l.stage === "force" && SERVICE_LAWS.includes(l.id),
  );
  if (law || n.manpower <= 30) return 3;
  const footing = seatsOf(gw, tag).reduce(
    (m, x) => Math.max(m, x.craft?.footing ?? 0),
    0,
  );
  if (n.manpower <= 50 || footing >= 2) return 2;
  if (monthsFrom(gw, n.entered) >= 6 && n.manpower <= 70) return 1;
  return 0;
}

export function refugeesOf(gw: GreatWar, tag: GwTag): number {
  const lost = GW_PLACE_KEYS.filter(
    (p) => GW_PLACES[p].owner === tag && holderOf(gw, p) !== tag,
  ).length;
  const own = lost >= 10 ? 3 : lost >= 4 ? 2 : lost >= 1 ? 1 : 0;
  if (own > 0) return own;
  // An ally's capital held: its people come to us (the Belgians in Britain).
  const n = gw.nation(tag);
  if (n === null || n.side === null) return 0;
  for (const m of gw.s.nations) {
    if (m.tag === tag || m.side !== n.side) continue;
    const cap = GW_CAPITALS[m.tag];
    if (cap === undefined) continue;
    const h = holderOf(gw, cap);
    if (h !== m.tag && atWarWith(gw, h, m.tag)) return 1;
  }
  return 0;
}

// ---- The flu ----

/** The flu's wave now, 0 none .. 3. */
export function fluWave(gw: GreatWar): number {
  const f = gw.s.flu;
  if (f === undefined || f.wave === 0) return 0;
  return monthsFrom(gw, f.chapter) < FLU_WAVE_MONTHS ? f.wave : 0;
}

function fluCan(gw: GreatWar): boolean {
  const s = gw.s;
  if (s.warChapter !== null) {
    return monthsFrom(gw, s.warChapter) >= FLU_WAR_MONTHS;
  }
  const d = civilFromDays(s.day);
  const [y, m] = FLU_PEACE_FROM;
  return d.year > y || (d.year === y && d.month >= m);
}

/** One in three where armies crowd: America in, or three on a front. */
function crowded(gw: GreatWar): boolean {
  if (fights(gw.nation("USA"))) return true;
  return gw.s.theatres.some(
    (t) =>
      t.open &&
      t.since !== null &&
      GW_SIDES.reduce((a, side) => a + membersOf(gw, t.id, side).length, 0) >=
        3,
  );
}

function fluStrikes(gw: GreatWar, wave: number): void {
  const s = gw.s;
  s.flu = { wave, chapter: s.chapter };
  news(gw, `flu_wave_${wave}`);
  for (const n of s.nations) {
    if (!fights(n)) continue;
    n.manpower = clampTo(n.manpower - 2, 0, 100);
    tell(gw, n.tag, `flu_wave_${wave}`);
    if (hungerOf(gw, n.tag) >= 2) {
      moveGauge(gw, n.tag, "morale", -1, `flu_wave_${wave}`);
    }
  }
}

function fluStep(gw: GreatWar): void {
  const s = gw.s;
  const f = s.flu;
  if (f === undefined) {
    if (!fluCan(gw)) return;
    const odds = crowded(gw) ? 3 : 6;
    if (wwRoll(s.seed, P_FLU, s.chapter, 0) % odds === 0) fluStrikes(gw, 1);
    return;
  }
  if (f.wave >= FLU_WAVES) return;
  const gap = 5 + (wwRoll(s.seed, P_FLU_GAP, f.wave, 0) % 3);
  if (monthsFrom(gw, f.chapter) >= gap) fluStrikes(gw, f.wave + 1);
}

// ---- Conditions, effects, the chapter ----

export function homeFrontHolds(
  gw: GreatWar,
  seat: GwSeatState,
  c: GwHomeFrontCond,
): boolean {
  switch (c.is) {
    case "prisoners":
      return anyOr(
        c.held === "ours"
          ? prisonersHeld(gw, seat.tag, c.tag)
          : heldOf(gw, seat.tag, c.tag),
        c,
      );
    case "hunger":
      return anyOr(hungerOf(gw, c.tag ?? seat.tag), c);
    case "women_work":
      return anyOr(womenAtWork(gw, seat.tag), c);
    case "refugees":
      return anyOr(refugeesOf(gw, seat.tag), c);
    case "flu":
      return anyOr(fluWave(gw), c);
  }
}

export function homeFrontDo(
  gw: GreatWar,
  seat: GwSeatState,
  e: GwHomeFrontEffect,
): void {
  if (e.do === "exchange") exchange(gw, seat.tag, e.tag);
  else reprisal(gw, seat.tag, e.tag);
}

/** Chapter step, after the home front's gauges. */
export function homeFrontStep(gw: GreatWar): void {
  if (!isLongChapter(gw)) return;
  const s = gw.s;
  if (s.armistice === null && s.warChapter !== null) {
    takenThisChapter(gw);
    aiPrisoners(gw);
  }
  fluStep(gw);
}
