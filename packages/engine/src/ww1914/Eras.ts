// Great War 1914: what the war's length does to it (design §4.2). Periods are
// counted from the war's first month, so a war that starts late starts open.
// Research is one of three priorities; whoever reaches a step first has it
// alone for some chapters. No date is scripted: a step needs months of research
// put in, and the months of war that make it thinkable.
import {
  GW_LINE_STEP,
  GW_RESEARCH,
  GwEra,
  GwNationState,
  GwResearch,
  GwTech,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwResearchTrackView } from "@openfront/engine-api/ww1914/GwWorldView";
import { gwChapters } from "@openfront/engine-lib/ww1914/Calendars";
import type { GreatWar } from "./GreatWar";
import { fights, news, reason, seatsOf, turn } from "./World";

export interface GwEraRow {
  readonly id: GwEra;
  /** Months of war it starts at. */
  readonly month: number;
  /** Percent added to every defence. */
  readonly defence: number;
  /** Trench stages an attack can look past: what the storm brings back. */
  readonly open: number;
}

export const GW_ERA_TABLE: readonly GwEraRow[] = [
  { id: "movement", month: 0, defence: 0, open: 0 },
  { id: "trenches", month: 4, defence: 15, open: 0 },
  { id: "material", month: 18, defence: 20, open: 0 },
  { id: "depth", month: 30, defence: 25, open: 0 },
  { id: "storm", month: 43, defence: 5, open: 2 },
];

export interface GwTechRow {
  readonly id: GwTech;
  readonly track: GwResearch;
  /** Months of war before anyone can reach it. */
  readonly month: number;
  /** Months of research it takes on its track. */
  readonly need: number;
  /** Percent on attack, while the defender lacks it; half if he has it too. */
  readonly attack: number;
  /** Percent on defence. */
  readonly defence: number;
  /** Only these countries can reach it. */
  readonly only?: readonly GwTag[];
}

export const GW_TECH_TABLE: readonly GwTechRow[] = [
  {
    id: "gas_heavy",
    track: "artillery",
    month: 8,
    need: 5,
    attack: 8,
    defence: 0,
  },
  {
    id: "barrage",
    track: "artillery",
    month: 20,
    need: 12,
    attack: 10,
    defence: 0,
  },
  {
    id: "predicted_fire",
    track: "artillery",
    month: 38,
    need: 20,
    attack: 12,
    defence: 0,
  },
  {
    id: "assault_groups",
    track: "infantry",
    month: 14,
    need: 5,
    attack: 6,
    defence: 0,
  },
  {
    id: "tanks",
    track: "infantry",
    month: 25,
    need: 9,
    attack: 12,
    defence: 0,
    only: ["GBR", "FRA", "USA"],
  },
  {
    id: "depth_defence",
    track: "infantry",
    month: 28,
    need: 8,
    attack: 0,
    defence: 15,
  },
  {
    id: "infiltration",
    track: "infantry",
    month: 36,
    need: 12,
    attack: 15,
    defence: 0,
  },
  // ww179: only the Royal Navy's blockade uses the nets (Sea.ts), so only
  // Britain reaches them: a fleet with nothing to gain shows the track shut.
  {
    id: "mine_nets",
    track: "sea",
    month: 10,
    need: 4,
    attack: 0,
    defence: 0,
    only: ["GBR"],
  },
  {
    id: "ocean_boats",
    track: "sea",
    month: 20,
    need: 8,
    attack: 0,
    defence: 0,
    only: ["DEU"],
  },
  {
    id: "convoys",
    track: "sea",
    month: 30,
    need: 8,
    attack: 0,
    defence: 0,
    only: ["GBR", "USA", "FRA"],
  },
];

/**
 * ww179: how far the country's research has come on each track, in steps the
 * screen words: 0 just begun, 1 halfway, 2 nearly, 3 done but the war is not
 * yet long enough. `next` null: nothing more to reach; `none`: nothing on the
 * track this country can ever reach.
 */
export function researchView(
  gw: GreatWar,
  n: GwNationState,
): GwResearchTrackView[] {
  const months = warMonths(gw);
  return GW_RESEARCH.map((id) => {
    const rows = GW_TECH_TABLE.filter(
      (t) => t.track === id && (t.only === undefined || t.only.includes(n.tag)),
    );
    const next = rows.find((t) => !hasTech(n, t.id)) ?? null;
    if (next === null)
      return { id, next: null, step: 0, none: rows.length === 0 };
    const put = n.tech[id] ?? 0;
    const step =
      put >= next.need
        ? months < next.month
          ? 3
          : 2
        : Math.min(2, Math.floor((put * 3) / next.need));
    return { id, next: next.id, step, none: false };
  });
}

/** Whole months since the war began; 0 at peace. */
export function warMonths(gw: GreatWar, chapter = gw.s.chapter): number {
  const s = gw.s;
  if (s.warChapter === null) return 0;
  const days = gwChapters(s.calendar);
  const from = days[Math.max(0, s.warChapter)].day;
  return Math.floor((days[chapter].day - from) / 30);
}

export function eraOf(gw: GreatWar): GwEraRow {
  const m = warMonths(gw);
  let out = GW_ERA_TABLE[0];
  for (const e of GW_ERA_TABLE) if (m >= e.month) out = e;
  return out;
}

export const hasTech = (n: GwNationState, t: GwTech): boolean =>
  n.techs.includes(t);

/** Percent the attacker's research is worth against this defender. */
export function techEdge(a: GwNationState, d: GwNationState): number {
  let out = 0;
  for (const t of GW_TECH_TABLE) {
    if (t.attack === 0 || !hasTech(a, t.id)) continue;
    out += hasTech(d, t.id) ? t.attack >> 1 : t.attack;
  }
  return out;
}

/** Percent the defender's research adds. */
export function techShield(d: GwNationState): number {
  let out = 0;
  for (const t of GW_TECH_TABLE) if (hasTech(d, t.id)) out += t.defence;
  return out;
}

function reach(gw: GreatWar, n: GwNationState): void {
  const months = warMonths(gw);
  for (const t of GW_TECH_TABLE) {
    if (hasTech(n, t.id) || months < t.month) continue;
    if (t.only !== undefined && !t.only.includes(n.tag)) continue;
    if ((n.tech[t.track] ?? 0) < t.need) continue;
    const first = !gw.s.nations.some((x) => hasTech(x, t.id));
    n.techs.push(t.id);
    if (first) news(gw, `tech_${t.id}`, n.tag);
    for (const seat of seatsOf(gw, n.tag)) reason(gw, seat, `tech_${t.id}`);
  }
}

/** Chapter step of the fronts: what was put in, what it came to, the period. */
export function researchStep(gw: GreatWar): void {
  // A 25-day chapter leaves the count where it was: ask the last chapter.
  const was = eraOfMonth(warMonths(gw, Math.max(0, gw.s.chapter - 1)));
  for (const n of gw.s.nations) {
    if (fights(n)) reach(gw, n);
  }
  const now = eraOf(gw);
  if (now.id !== was.id) {
    news(gw, `era_${now.id}`);
    turn(gw, `era_${now.id}`);
  }
}

function eraOfMonth(m: number): GwEraRow {
  let out = GW_ERA_TABLE[0];
  for (const e of GW_ERA_TABLE) if (m >= e.month) out = e;
  return out;
}

/** How far a theatre's line has gone, in steps. */
export const posOf = (t: { line: number; progress: number }): number =>
  t.line * GW_LINE_STEP + t.progress;

/** Theatres whose season shuts them, month 1..12 -> percent off an attack. */
export const GW_SEASON: Readonly<
  Partial<Record<GwTheatre, Readonly<Record<number, number>>>>
> = {
  west: { 12: 10, 1: 15, 2: 15 },
  east: { 3: 10, 4: 10, 10: 10, 11: 15, 12: 10, 1: 15, 2: 15 },
  balkan: { 12: 15, 1: 20, 2: 20 },
  italy: { 11: 20, 12: 30, 1: 35, 2: 35, 3: 20 },
  caucasus: { 11: 20, 12: 35, 1: 35, 2: 35, 3: 20 },
  mesopotamia: { 6: 20, 7: 25, 8: 25 },
  palestine: { 6: 15, 7: 20, 8: 20 },
  // ww171's fronts: the high Alps shut in winter like the Isonzo's; the
  // Carpathian passes snow up; Thrace and the Dobruja are the Balkans' plain;
  // the Low Countries flood; Persia's roads bake in summer and close in snow.
  alps: { 11: 25, 12: 35, 1: 40, 2: 40, 3: 25 },
  danube: { 11: 15, 12: 25, 1: 30, 2: 30, 3: 15 },
  thrace: { 12: 15, 1: 20, 2: 20 },
  low_countries: { 11: 10, 12: 15, 1: 15, 2: 15 },
  dobruja: { 12: 15, 1: 20, 2: 15 },
  persia: { 1: 20, 2: 20, 6: 15, 7: 20, 8: 20, 12: 15 },
};
