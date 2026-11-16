// Great War 1914 (ww218 §2, lane W): running the country well wins wars.
//
// A country's war power is read from its state in four strands, each 0..3:
// - firepower (화력): the shells gauge's industry behind it;
// - reserves (예비): the pool of men, their drill, the bread that feeds both;
// - mobility (기동): the rail and the administration behind the army;
// - staying power (지구력): morale, order, unrest and a regime's age.
// They are readings, never resources: nothing is spent from them. Only the
// rail and the drill are kept (`GwNationState.warPower`), with their growth, and
// the garrisons hard-held land ties down.
//
// The fronts read the strands (Fronts `fireOfNation`, `refill`, `bandOf`,
// `effortOf`; Stalemate `feedOf`, `breakPct`); everything here is by state,
// never by date. Each strand caps at 3, and each step costs more than the
// last: every strand at the top is worth about one band, never a sure break.
import type {
  GwNationState,
  GwSeatState,
  GwSide,
  GwTheatre,
  GwTheatreState,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import {
  GW_FRONT_UP,
  GW_SIDES,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GW_BUDGET_LINES } from "@openfront/engine-api/ww1914/GwBudget";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";
import { GW_PLACES } from "@openfront/engine-api/ww1914/GwPlaces";
import {
  GW_POWER_MAX,
  GwPowerStrand,
  GwWarPowerState,
  GwWarPowerView,
} from "@openfront/engine-api/ww1914/GwWarPower";
import { budgetNorm } from "@openfront/engine-lib/ww1914/BudgetRules";
import { hasTech, warMonths } from "./Eras";
import type { GreatWar } from "./GreatWar";
import { lawStage } from "./Laws";
import { membersOf } from "./Wars";
import { fights, isLongChapter, monthsFrom, monthsOf, seatsOf } from "./World";

/** A country's start: rail, drill, firepower's industrial base, yearly class. */
export interface GwPowerRow {
  readonly rail: number;
  readonly drill: number;
  /** Firepower the industry gives before the war's own rate (0..2). */
  readonly fire: number;
  /** Manpower points a year of war the new class and the healed bring. */
  readonly klass: number;
}

/**
 * Per country (§2 "Country strengths"). Germany: industry and rail; Britain:
 * money and sea lift, volunteers; France: industry, a small well-drilled pool;
 * Russia: men without guns or rail; Austria-Hungary: middling everywhere.
 */
export const GW_POWER_ROWS: Readonly<Partial<Record<GwTag, GwPowerRow>>> = {
  DEU: { rail: 3, drill: 2, fire: 1, klass: 8 },
  GBR: { rail: 2, drill: 1, fire: 0, klass: 7 },
  FRA: { rail: 2, drill: 2, fire: 1, klass: 4 },
  RUS: { rail: 0, drill: 0, fire: 0, klass: 12 },
  AUH: { rail: 1, drill: 1, fire: 0, klass: 6 },
  ITA: { rail: 1, drill: 1, fire: 0, klass: 6 },
  OTT: { rail: 0, drill: 1, fire: 0, klass: 5 },
  USA: { rail: 2, drill: 1, fire: 1, klass: 12 },
};
const ROW_OTHER: GwPowerRow = { rail: 1, drill: 1, fire: 0, klass: 4 };

export const powerRow = (tag: GwTag): GwPowerRow =>
  GW_POWER_ROWS[tag] ?? ROW_OTHER;

/** Laws that set up a munitions ministry: industry mobilises at once. */
export const GW_MUNITIONS_LAWS: readonly string[] = [
  "gbr_munitions",
  "rus_factories",
  "auh_factories",
  "fra_law_labour",
  "deu_aux",
];
/** Laws that put women into the works: +15% works. */
export const GW_WOMEN_LAWS: readonly string[] = [
  "gbr_register",
  "deu_aux",
  "fra_law_labour",
];
/** Laws that call more men: raw recruits lower the drill for a while. */
export const GW_CONSCRIPTION_LAWS: readonly string[] = [
  "gbr_conscription",
  "rus_ratniki",
  "auh_landsturm",
  "fra_law_dalbiez",
  "fra_law_three_years",
  "deu_army_bill",
  "auh_army_bill",
];
/** Percent more works a women's labour law brings. */
export const WOMEN_WORKS = 15;
/** Chapters raw recruits lower the drill by one. */
const RAW_CHAPTERS = 6;

/** Growth needed for the next rail step at rail 0, 1, 2. */
const RAIL_STEP = [20, 28, 36];
/** And for the next drill step at drill 0, 1, 2. */
const DRILL_STEP = [6, 10, 14];
/** Thousands lost in a chapter that cost the drill a point (cadres killed). */
const DRILL_BLEED = 120;
/** Growth below zero that loses a drill step (men without bread). */
const DRILL_LOSE = -6;
/** The peace course `rails` (작전, c_front_peace): rail growth at once. */
const RAILS_COURSE = 10;
/** The war courses' span, chapters. */
const COURSE_CHAPTERS = 6;
/** Memory keys of the courses (Departments `course_<id>`). */
export const COURSE_RAILS = "course_rails";
export const COURSE_DRILL = "course_drill";
export const COURSE_RAIL_ARMY = "course_rail_army";
/** Occupied places held hard (`rule.hard` >= 2) that tie down one band. */
export const GARRISON_PLACES = 4;
const GARRISON_HARD = 2;
/** War score at which the trailing coalition gets the counterweight. */
export const COUNTERWEIGHT_AT = 40;
/** Months a new regime counts as untried (staying power -1). */
const REGIME_NEW_MONTHS = 6;

// ---- Effects the fronts read ----

/** Attack worth per firepower level, percent. */
export const FIRE_PCT = 8;
/** Trench worth an attack's heavy guns take off per firepower level. */
export const FIRE_TRENCH = 4;
/** Manpower points a band's refill takes. */
export const REFILL_MEN = 4;
/** Chapters between refills at drill 0..3. */
const REFILL_EVERY = [3, 2, 2, 1];
/** Below this pool refill halves; below MEN_LOW the bands melt. */
export const POOL_THIN = 30;
/** Chapters between desertion steps once the pool is gone. */
export const DESERT_EVERY = 4;
/** Wear a band refilled with untrained men comes back with. */
export const RAW_WEAR = 3;
/** The casualty-list morale hit's base, thousands, and per staying level. */
export const LIST_HIT = 250;
export const LIST_HIT_PER = 100;
/** breakPct per staying level. */
export const BREAK_PER = 6;
/** Casualties (thousands) at which the country's weariness begins. */
export const GW_WEARY_BLOOD: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 1500,
  FRA: 1000,
  GBR: 700,
  RUS: 1800,
  AUH: 1100,
  ITA: 500,
  OTT: 450,
  BGR: 150,
};

function inForce(n: GwNationState, id: string): boolean {
  return lawStage(n, id)?.stage === "force";
}

/** Whether any law of `ids` is in force for `n`. */
export function lawInForce(n: GwNationState, ids: readonly string[]): boolean {
  return ids.some((id) => inForce(n, id));
}

/** Raw recruits: a conscription law passed within RAW_CHAPTERS. */
function rawRecruits(gw: GreatWar, n: GwNationState): boolean {
  return GW_CONSCRIPTION_LAWS.some((id) => {
    const st = lawStage(n, id);
    return st?.stage === "force" && gw.s.chapter - st.since < RAW_CHAPTERS;
  });
}

/** The kept state as it stands, or the start, without writing it. */
export function powerOf(gw: GreatWar, n: GwNationState): GwWarPowerState {
  return n.warPower ?? startPower(gw, n.tag);
}

function startPower(gw: GreatWar, tag: GwTag): GwWarPowerState {
  const row = powerRow(tag);
  const ahead = tag === "RUS" && gw.s.secrets.includes("rus_rail_ahead");
  return {
    rail: Math.min(GW_POWER_MAX, row.rail + (ahead ? 1 : 0)),
    drill: row.drill,
    railGrow: 0,
    drillGrow: 0,
    garrison: 0,
  };
}

function ensure(gw: GreatWar, n: GwNationState): GwWarPowerState {
  n.warPower ??= startPower(gw, n.tag);
  return n.warPower;
}

/** 0..3: the rail behind `tag`'s army. */
export function railOf(gw: GreatWar, tag: GwTag): number {
  const n = gw.nation(tag);
  return n === null ? 0 : powerOf(gw, n).rail;
}

/** 0..3: the drill of the men `n` sends, less raw recruits. */
export function drillOf(gw: GreatWar, n: GwNationState): number {
  const d = powerOf(gw, n).drill - (rawRecruits(gw, n) ? 1 : 0);
  return Math.max(0, Math.min(GW_POWER_MAX, d));
}

const cap = (v: number) => Math.max(0, Math.min(GW_POWER_MAX, v));

/** Firepower 0..3 and why. */
function fireOf(n: GwNationState): { level: number; why: string[] } {
  const why: string[] = [];
  let v = powerRow(n.tag).fire;
  if (v > 0) why.push("fire_works");
  const rate = n.econ?.rate.shells ?? 0;
  if (n.gauges.shells >= 2 || rate >= 0) v++;
  else why.push("fire_short");
  if (rate >= 200) {
    v++;
    why.push("fire_rising");
  }
  if (n.econ?.mobilised !== null && n.econ?.mobilised !== undefined) {
    v++;
    why.push("fire_mobilised");
  }
  if (hasTech(n, "barrage") || hasTech(n, "predicted_fire")) {
    v++;
    why.push("fire_guns");
  }
  return { level: cap(v), why };
}

/** 0..3: firepower. */
export function fireLevel(n: GwNationState): number {
  return fireOf(n).level;
}

/** The pool in steps: plenty, enough, thin, gone. */
function poolLevel(n: GwNationState): number {
  if (n.manpower >= 60) return 3;
  if (n.manpower >= POOL_THIN) return 2;
  if (n.manpower >= 12) return 1;
  return 0;
}

/** Britain's men are volunteers until a conscription law. */
function volunteers(n: GwNationState): boolean {
  return n.tag === "GBR" && !inForce(n, "gbr_conscription");
}

function reservesOf(
  gw: GreatWar,
  n: GwNationState,
): { level: number; why: string[] } {
  const why: string[] = [];
  let v = poolLevel(n);
  why.push(`pool_${v}`);
  if (volunteers(n)) {
    v = Math.min(v, 1);
    why.push("volunteers");
  }
  why.push(`drill_${drillOf(gw, n)}`);
  if (rawRecruits(gw, n)) why.push("raw_recruits");
  if (n.gauges.bread === 0) {
    v--;
    why.push("bread_none");
  }
  return { level: cap(v), why };
}

/** 0..3: staying power, and why. */
function stayingOf(
  gw: GreatWar,
  n: GwNationState,
): { level: number; why: string[] } {
  const why: string[] = [];
  const g = n.gauges;
  let v = 0;
  if (g.morale >= 4) v++;
  else why.push("morale_low");
  if (g.order >= 3) v++;
  else why.push("order_low");
  if (n.unrest <= 1) v++;
  else why.push("unrest");
  const at = n.warPower?.regimeAt;
  if (at !== undefined && monthsFrom(gw, at) < REGIME_NEW_MONTHS) {
    v--;
    why.push("regime_new");
  }
  if (v >= 3) why.push("staying_firm");
  return { level: cap(v), why };
}

/** 0..3: staying power. */
export function stayingLevel(gw: GreatWar, n: GwNationState): number {
  return stayingOf(gw, n).level;
}

/** Attack and holding worth from firepower, percent. */
export function firePct(n: GwNationState): number {
  return 100 + FIRE_PCT * fireLevel(n);
}

/** Trench worth an attack by `n` does not meet: its heavy guns. */
export function trenchCut(n: GwNationState | null): number {
  return n === null ? 0 : FIRE_TRENCH * fireLevel(n);
}

/** Chapters between refills: drill, the pool, Britain's volunteers. */
export function refillEvery(gw: GreatWar, n: GwNationState): number {
  let every = REFILL_EVERY[drillOf(gw, n)];
  if (volunteers(n)) every = Math.max(every, 3);
  if (n.manpower < POOL_THIN) every *= 2;
  return every;
}

/** The year's class and the healed, for this chapter: GW_POWER_ROWS `klass`. */
export function classIntake(gw: GreatWar, n: GwNationState): number {
  const k = powerRow(n.tag).klass;
  const now = warMonths(gw);
  const was = Math.max(0, now - monthsOf(gw));
  return Math.floor((k * now) / 12) - Math.floor((k * was) / 12);
}

/**
 * A band in the field: its strength less what holds occupied land. The
 * garrison comes off the strongest fronts first, never below one band.
 */
export function fieldStrength(n: GwNationState, t: GwTheatre): number {
  const own = n.strength[t] ?? 1;
  const g = n.warPower?.garrison ?? 0;
  if (g <= 0) return own;
  // One band at a time from the strongest front left (ties: the first kept).
  const ids = (Object.keys(n.strength) as GwTheatre[]).filter(
    (x) => x !== "sea",
  );
  const left = new Map<GwTheatre, number>(
    ids.map((x) => [x, n.strength[x] ?? 1]),
  );
  for (let k = 0; k < g; k++) {
    let best = -1;
    ids.forEach((x, i) => {
      const v = left.get(x)!;
      if (v > 1 && (best < 0 || v > left.get(ids[best])!)) best = i;
    });
    if (best < 0) break;
    left.set(ids[best], left.get(ids[best])! - 1);
  }
  return left.get(t) ?? own;
}

/**
 * The coalition far behind (war score at or below -COUNTERWEIGHT_AT), whose
 * partners send more and whose neutrals lean its way; null when even.
 */
export function trailingSide(
  gw: GreatWar,
  scoreOf: (side: GwSide) => number,
): GwSide | null {
  if (gw.s.warChapter === null) return null;
  for (const side of GW_SIDES) {
    if (scoreOf(side) <= -COUNTERWEIGHT_AT) return side;
  }
  return null;
}

/** The weariness of blood: casualties past the country's measure. */
export function bloodWeary(n: GwNationState): boolean {
  const at = GW_WEARY_BLOOD[n.tag];
  return at !== undefined && n.casualties >= at;
}

/** A course taken this chapter (`now`) or within the war courses' span. */
function courseOn(
  gw: GreatWar,
  n: GwNationState,
  key: string,
  now: boolean,
): boolean {
  const c = gw.s.chapter;
  return seatsOf(gw, n.tag).some((seat) =>
    seat.memory.some(
      (m) =>
        m.key === key &&
        (now ? m.chapter === c : c - m.chapter < COURSE_CHAPTERS),
    ),
  );
}

/** ww209-style budget line off the norm, percent points. */
function lineOff(n: GwNationState, line: "army" | "national"): number {
  const i = GW_BUDGET_LINES.indexOf(line);
  return n.budget.plan.shares[i] - budgetNorm(n.tag, n.atWar.length > 0)[i];
}

/** Rail growth this chapter. */
function railGrowth(gw: GreatWar, n: GwNationState): number {
  let g = courseOn(gw, n, COURSE_RAILS, true) ? RAILS_COURSE : 0;
  if (!isLongChapter(gw)) return g;
  const m = monthsOf(gw);
  let monthly = fights(n) ? 1 : 0;
  // Russia's national share goes on the railways (ww209 §1).
  if (n.tag === "RUS")
    monthly += 2 * Math.max(0, Math.floor(lineOff(n, "national") / 3));
  if (courseOn(gw, n, COURSE_RAIL_ARMY, false)) monthly *= 2;
  g += monthly * m;
  return g;
}

/**
 * Drill growth this chapter: the army line, the course and the bread build it;
 * heavy losses kill the trained men and hunger empties the depots.
 */
function drillGrowth(gw: GreatWar, n: GwNationState): number {
  if (!isLongChapter(gw)) return 0;
  if (n.gauges.bread === 0) return -2 * monthsOf(gw);
  let monthly = Math.max(-1, Math.min(3, Math.floor(lineOff(n, "army") / 3)));
  if (courseOn(gw, n, COURSE_DRILL, false)) monthly += 2;
  if (n.gauges.bread >= 2) monthly++;
  if (n.lostNow >= DRILL_BLEED) monthly--;
  if (n.lostNow >= 2 * DRILL_BLEED) monthly--;
  return monthly * monthsOf(gw);
}

/** Hard-held occupied places of each holder this chapter. */
function hardHeld(gw: GreatWar): Map<GwTag, number> {
  const out = new Map<GwTag, number>();
  const own = new Set(
    gw.s.nations
      .filter((n) => n.client !== undefined || n.vassal !== undefined)
      .map((n) => n.tag),
  );
  for (const [p, holder] of Object.entries(gw.s.held)) {
    if (holder === undefined || own.has(holder)) continue;
    const owner = GW_PLACES[p as GwPlace]?.owner;
    if (owner === undefined || owner === holder) continue;
    const row = (gw.s.rule ?? []).find(
      (r) => r.by === holder && r.of === owner,
    );
    if ((row?.hard ?? 1) < GARRISON_HARD) continue;
    out.set(holder, (out.get(holder) ?? 0) + 1);
  }
  return out;
}

function step(p: GwWarPowerState, key: "rail" | "drill", grow: number): void {
  const k = key === "rail" ? "railGrow" : "drillGrow";
  const need = key === "rail" ? RAIL_STEP : DRILL_STEP;
  p[k] += grow;
  while (p[key] < GW_POWER_MAX && p[k] >= need[p[key]]) {
    p[k] -= need[p[key]];
    p[key]++;
  }
  if (p[key] >= GW_POWER_MAX) p[k] = Math.min(p[k], 0);
  if (key === "drill" && p[k] <= DRILL_LOSE) {
    p[k] = 0;
    p.drill = Math.max(0, p.drill - 1);
  }
}

/** Chapter step: the rail and drill grow, the garrisons are counted. */
export function powerStep(gw: GreatWar): void {
  const held = hardHeld(gw);
  for (const n of gw.s.nations) {
    if (n.out) continue;
    const at =
      n.warPower !== undefined || fights(n) || seatsOf(gw, n.tag).length > 0;
    if (!at) continue;
    const p = ensure(gw, n);
    step(p, "rail", railGrowth(gw, n));
    step(p, "drill", drillGrowth(gw, n));
    p.garrison = Math.floor((held.get(n.tag) ?? 0) / GARRISON_PLACES);
  }
}

/** A regime begins: its first months it is untried (Regimes.changeRegime). */
export function powerRegime(gw: GreatWar, n: GwNationState): void {
  ensure(gw, n).regimeAt = gw.s.chapter;
}

/**
 * A front opens: a side whose rail is two steps or more above its foe's is
 * there first and gains a step (Germany against Russia, by state).
 */
export function railOpening(gw: GreatWar, t: GwTheatreState): GwSide | null {
  if (t.id === "sea") return null;
  const best = (side: GwSide) =>
    Math.max(-1, ...membersOf(gw, t.id, side).map((tag) => railOf(gw, tag)));
  const up = GW_FRONT_UP[t.id];
  const down = up === "central" ? "entente" : "central";
  const a = best(up);
  const b = best(down);
  if (a < 0 || b < 0) return null;
  if (a - b >= 2) return up;
  if (b - a >= 2) return down;
  return null;
}

/** The 작전 tab's reading of the seat's war power. */
export function powerView(
  gw: GreatWar,
  seat: GwSeatState,
): GwWarPowerView | null {
  const n = gw.nation(seat.tag);
  if (n === null) return null;
  const fire = fireOf(n);
  const res = reservesOf(gw, n);
  const stay = stayingOf(gw, n);
  const rail = powerOf(gw, n).rail;
  const why: Record<GwPowerStrand, readonly string[]> = {
    fire: fire.why.slice(0, 2),
    reserves: res.why.slice(0, 3),
    mobility: [`rail_${rail}`],
    staying: stay.why.slice(0, 2),
  };
  const levels = {
    fire: fire.level,
    reserves: res.level,
    mobility: rail,
    staying: stay.level,
  };
  return { levels, why, garrison: powerOf(gw, n).garrison };
}
