// World War 1936 P2: the AI's land war (P2 spec §14). It reads the land
// war as a player's screens show it (armies, divisions, control, the wars,
// the historical calendar; never another country's plans) and acts only
// through the orders a player gives: land.issue(smallID, order, "ai") and
// the economy's queueBuild. It keeps no memory of its own: every day it
// works the picture out again from the game (a restored game decides the
// same), with no randomness and every tie to the smaller id.
//
// One day of a country (aiLandTick): the template refit (every 180 days),
// then, daily at war or with a calendar war near (else every 10 days),
// garrisons, grouping, generals, fronts (or the peacetime line), attacks,
// training and building. A human's country runs only fronts and attacks,
// for its auto armies (spec §8.5).
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  type LandTerrain,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_WALK,
  Stance,
  SupportId,
  TPL_ARMOR_ANY,
  TPL_PARA_ANY,
  WW_AI_PREWAR_DAYS,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TARGETS,
  WW_TITLED_GENERAL_XP_MILLI,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_INVASION_MAX_KM } from "@openfront/engine-api/ww1936/NavyTypes";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { combatWidth } from "@openfront/engine-lib/ww1936/CombatRules";
import { queuedInRegion } from "@openfront/engine-lib/ww1936/EconomyChecks";
import { WW_INITIAL_WARS } from "@openfront/engine-lib/ww1936/History";
import { WW_TARGET_REACH_EDGES } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { ALL_EDGES } from "@openfront/engine-lib/ww1936/SeaGraph";
import {
  GEN1,
  groupStock,
  specialCap,
  templateStats,
  templateXpCost,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { type AiPersonality, aiPersonality } from "../economy/AiEconomy";
import { convoysOf } from "../economy/Buildings";
import { queueBuild } from "../economy/Construction";
import type { CountryEconomy } from "../economy/WwEconomy";
import { seaReach } from "../navy/AiNavy";
import { navalPort, navalPortsOf } from "../navy/Ports";
import { canServe } from "./GeneralsRun";
import { capitalRegion } from "./LandStartRun";
import { enemyDivisionsIn } from "./Movement";
import { armyRows, predictAttack } from "./Plans";
import type { Army, CountryLand, GeneralState, WwLand } from "./WwLand";

// ---- Constants (spec §14; the (내 판단) ones are marked) ----

/** Spec §14.1: at peace an AI acts on every tenth day. */
export const AI_PEACE_PERIOD_DAYS = 10;
/**
 * Spec §14.3-2: demand per border region, tenths of a division: at least
 * 1, else 1.2 × the enemy divisions facing it. (내 판단) An enemy stack
 * next to several of our border regions counts once, split among them: a
 * stack touching three of them is not three times the threat (counted
 * whole, a big front's demand drew every army away from the small ones).
 */
const DEMAND_MIN = 10;
const DEMAND_PER_DIVISION = 12;
/** An assigned army covers its divisions × 10 of the demand. */
const DEMAND_PER_ARMY_DIVISION = 10;
/**
 * Task 11 balance (내 판단, HOI4's AI weighs its fronts by its war
 * plans): a front against an enemy this country attacks by the calendar
 * (it is the entry's actor, firing within the pre-war 60 days or fired)
 * asks this share of its demand, %. Every other front is held: a border
 * region there asks no more than fills its combat width (for the enemy
 * regions next to it) AI_HOLD_WIDTHS times with AI_HOLD_DIV_WIDTH-wide
 * divisions, a tenth less per level of its fort. Germany in 1939 puts
 * most of its army on Poland and holds the Saar with the rest (Fall
 * Weiss), and in 1940 goes through the Low Countries, not the Maginot.
 */
export const AI_OFFENSE_DEMAND_PCT = 200;
export const AI_HOLD_WIDTHS = 2;
export const AI_HOLD_DIV_WIDTH = 20;
export const AI_HOLD_FORT_PCT = 10;
/** Spec §14.3-4: the capital guard, when the capital is this close to an enemy. */
export const AI_GUARD_DIVISIONS = 2;
/** P4 spec §17.4 (내 판단): the coastal guard's regions have this many points or more (or a port). */
export const AI_COAST_VP = 5;
/** P4 spec §17.4: an invasion's reach by sea. */
export const AI_INVASION_KM = WW_INVASION_MAX_KM;
const GUARD_EDGES = 4;
/**
 * Controller ruling 2 (내 판단): this share of the most divisions the
 * country has had (CountryLand.peakDivisions) guards its victory points
 * near the enemy and its coasts, two divisions a guard. Measured on the
 * high-water mark, losses do not shrink it.
 */
export const AI_RESERVE_PCT = 10;
/** Spec §14.4: an executing plan stops under this ratio. */
const STOP_RATIO_PM = 700;
/** Spec §14.4: readiness to start a plan, or this many days of war. */
const READY_BP = 1500;
const WAR_READY_DAYS = 60;
/**
 * Controller ruling 5 (내 판단): an attacking army regroups (stops) when its
 * org falls under 40% of its maximum, and attacks again only from 85%: no
 * daily attack with whatever recovered overnight.
 */
export const AI_REGROUP_ORG_PM = 400;
export const AI_ATTACK_ORG_PM = 850;
/**
 * Task 11 (controller ruling 6, 내 판단): an executing army none of whose
 * divisions is in a battle any more (the attack is over, won or lost)
 * regroups once its org is under AI_ATTACK_ORG_PM, so it does not throw
 * whatever recovered overnight at the same region again; and no attack
 * on defenders starts under this readiness, even after the war's 60th
 * day (a regrouping army builds it while its org recovers).
 */
export const AI_REATTACK_READY_BP = 500;
/**
 * Task 11 round 2 (내 판단, HOI4's aggressive plans push on against a
 * broken enemy): at this strength ratio or more, ‰, a worn army does not
 * stop to regroup between battles, and a new attack needs no readiness
 * floor (the war's own readiness gate still holds). Poland's 1939
 * remnant was taken a region and a five-day pause at a time.
 */
export const AI_PURSUIT_RATIO_PM = 2000;
/**
 * Task 11 round 2 (내 판단): when a democracy's liberation-only rule
 * against an aggressor ends (AiDay.liberationLifted): from 1942 (the
 * Allies' offensives of 1942–44), or at this strength ratio, ‰.
 */
export const AI_LIBERATION_END_DAY = dayOfDate("1942-01-01");
export const AI_LIBERATION_LIFT_RATIO_PM = 3000;
/** The strength ratio lifts it only after this many days of that war (the Phoney War's eight months). */
export const AI_LIBERATION_LIFT_WAR_DAYS = 240;
/**
 * (내 판단, deviation from spec §14.4's "balanced") The stance of the AI's
 * offensives. The plan step (lane M) checks a balanced plan's odds per
 * front region with that region's divisions alone, one direction, while
 * the AI's ρ sees the battle the whole army gives (every direction): with
 * "balanced" an executing plan could stand for weeks without a battle
 * (the test map's Warsaw: 8 Poles against 7–11 Germans per region, 2
 * directions). The AI's own gates (ρ ≥ its threshold, ρ < 0.7 or org < 40%
 * stops, org ≥ 85% and readiness to start again) do the judging instead.
 */
const AI_STANCE: Stance = "aggressive";
/** (내 판단) An army attacks once this share of it stands on its front. */
const FORMED_PM = 600;
/** Spec §14.4: no defender in reach: the plan only walks in. */
const RATIO_FREE_PM = 10_000;
/** Spec §14.5. */
const TRAIN_TARGET_MAJOR = 10;
const TRAIN_TARGET_MINOR = 3;
const TRAIN_PER_DAY = 3;
const TRAIN_MEN_FACTOR = 2;
const TRAIN_FILL_PM = 500;
/** Spec §14.5: the template refit comes every 180 days. */
export const AI_REFIT_DAYS = 180;
/** Spec §14.2: a titled general from this much army experience, milli. */
const APPOINT_XP_MILLI = 30_000;
/** Spec §14.2: armies of 1–3 divisions join a bigger one in their region; armies under 4 on one front merge. */
const SMALL_ARMY = 3;
const FRONT_MERGE_UNDER = 4;
/**
 * (내 판단) Armies cross the sea (spec §7.5) to a front at most this far.
 * Task 11: 6,000 km (was 3,000): Britain to Egypt (spec §7.5's example)
 * and Italy to Eritrea are 3,500–4,000 km on the map.
 */
export const AI_SEA_MAX_KM = 6000;
/** Task 11 round 2 (내 판단): an army goes by rail to a place this far, km. */
export const AI_RAIL_MIN_KM = 1000;
/** (내 판단) At most this many forts and railways wait in the queue. */
const LAND_BUILDS_QUEUED = 2;
/** Spec §14.5: Germany's West Wall. */
const WESTWALL_DAY = dayOfDate("1938-01-01");
const FORT_MAX = 5;

// ---- Pure decisions (plain data in, plain data out) ----

/**
 * Spec §14.3-2 and Task 11: one border region's demand, tenths of a
 * division: 1.2 × the enemy divisions facing it (`facingMilli`, ×1000),
 * at least 1; on an offensive front × AI_OFFENSE_DEMAND_PCT; on a held
 * front no more than its combat width for `dirs` enemy regions filled
 * AI_HOLD_WIDTHS times with AI_HOLD_DIV_WIDTH-wide divisions, a tenth
 * less per fort level (never under the minimum).
 */
export function aiBorderDemand(i: {
  facingMilli: number;
  offensive: boolean;
  land: LandTerrain;
  dirs: number;
  fort: number;
}): number {
  const d = Math.max(
    DEMAND_MIN,
    Math.floor((DEMAND_PER_DIVISION * i.facingMilli) / 1000),
  );
  if (i.offensive) return Math.floor((d * AI_OFFENSE_DEMAND_PCT) / 100);
  const width = combatWidth(i.land, i.dirs);
  const fort = Math.max(0, Math.min(5, i.fort));
  const cap = Math.floor(
    (AI_HOLD_WIDTHS * width * 10 * (100 - AI_HOLD_FORT_PCT * fort)) /
      (AI_HOLD_DIV_WIDTH * 100),
  );
  return Math.max(DEMAND_MIN, Math.min(d, cap));
}

/** Spec §14.4: the attack ratio an AI wants, ‰. */
export function aiThresholdPm(personality: AiPersonality): number {
  switch (personality) {
    case "aggressor":
      return 1100;
    case "democracy":
      return 1500;
    case "minor":
      return 1300;
  }
}

export interface AiFrontArmy {
  id: number;
  divisions: number;
  /** The front (enemies[].id) it holds now: it stays while that front still wants troops. */
  current?: number;
  /** The fronts it can reach (undefined: all). */
  reach?: readonly number[];
  /** It reaches its fronts only by sea: it goes only where demand is left. */
  sea?: boolean;
}

export interface AiFrontEnemy {
  id: number;
  /** Border regions, from the one nearest the capital, BFS over the border graph. */
  border: readonly number[];
  /** Tenths of a division (spec §14.3-2). */
  demand: number;
}

export interface AiFrontAssignment {
  army: number;
  enemy: number;
  anchor: number;
}

/**
 * Spec §14.3-3: armies by size (then id) to the front with the most demand
 * left (ties: the smaller id), each taking its divisions × 10 off it.
 * Armies that reach their fronts by land go first and all get one; those
 * that would have to cross the sea go only where demand is left. An army
 * keeps the front it holds while that front's demand is not covered (no
 * daily switching: it would reset its readiness). A front's armies, in
 * assignment order i of n, anchor at border[floor((i + 0.5) × |border| / n)].
 */
export function aiFrontPlan(input: {
  armies: readonly AiFrontArmy[];
  enemies: readonly AiFrontEnemy[];
}): AiFrontAssignment[] {
  const fronts = input.enemies.filter((e) => e.border.length > 0);
  const left = new Map<number, number>(fronts.map((e) => [e.id, e.demand]));
  const assigned = new Map<number, number[]>();
  const order = [...input.armies].sort(
    (a, b) => b.divisions - a.divisions || a.id - b.id,
  );
  const pick = (a: AiFrontArmy, seaPhase: boolean): number => {
    let best = -1;
    let bestLeft = 0;
    for (const e of fronts) {
      if (a.reach !== undefined && !a.reach.includes(e.id)) continue;
      const l = left.get(e.id)!;
      if (seaPhase && l <= 0) continue;
      if (a.current === e.id && l >= 0) return e.id;
      if (best < 0 || l > bestLeft || (l === bestLeft && e.id < best)) {
        best = e.id;
        bestLeft = l;
      }
    }
    return best;
  };
  for (const seaPhase of [false, true]) {
    for (const a of order) {
      if ((a.sea === true) !== seaPhase) continue;
      const e = pick(a, seaPhase);
      if (e < 0) continue;
      left.set(e, left.get(e)! - a.divisions * DEMAND_PER_ARMY_DIVISION);
      const l = assigned.get(e) ?? [];
      l.push(a.id);
      assigned.set(e, l);
    }
  }
  const out: AiFrontAssignment[] = [];
  for (const e of fronts) {
    const ids = assigned.get(e.id) ?? [];
    const b = e.border;
    ids.forEach((army, i) => {
      const at = Math.floor(((2 * i + 1) * b.length) / (2 * ids.length));
      out.push({ army, enemy: e.id, anchor: b[at] });
    });
  }
  return out;
}

export interface AiTargetRegion {
  region: number;
  vp: number;
  /** Edges from the army's front (1: next to it). */
  dist: number;
  /** The enemy's capital: its victory points count twice (controller ruling 5). */
  capital?: boolean;
}

/**
 * Spec §14.4: up to 3 targets by vp × 100 / (dist + 1) (ties: the smaller
 * id); when fewer than 3 are worth anything the nearest fill up
 * (pre-flight A3, ties: the smaller id).
 */
export function aiTargets(input: {
  regions: readonly AiTargetRegion[];
}): number[] {
  const score = (r: AiTargetRegion) =>
    Math.floor((r.vp * (r.capital === true ? 200 : 100)) / (r.dist + 1));
  const out = input.regions
    .filter((r) => score(r) > 0)
    .sort((a, b) => score(b) - score(a) || a.region - b.region)
    .slice(0, WW_MAX_TARGETS)
    .map((r) => r.region);
  if (out.length < WW_MAX_TARGETS) {
    const rest = input.regions
      .filter((r) => !out.includes(r.region))
      .sort((a, b) => a.dist - b.dist || a.region - b.region);
    for (const r of rest) {
      if (out.length >= WW_MAX_TARGETS) break;
      out.push(r.region);
    }
  }
  return out;
}

export const AI_ROLES = [
  "infantry",
  "armor",
  "motorized",
  "mountain",
  "cavalry",
] as const;
export type AiRole = (typeof AI_ROLES)[number];

/** Spec §14.5: the template keys of each role (infantry: the first template). */
const ROLE_KEYS: Readonly<Record<AiRole, readonly string[]>> = {
  infantry: [],
  armor: ["armored", "mobile", "dlm", "celere", "tank_brigade"],
  motorized: ["motorized"],
  mountain: ["mountain", "alpini", "mountain_rifle"],
  cavalry: ["cavalry", "cavalry_brigade"],
};

/** The role of a template by its 1936 key; any other (a player's own, colonial, garrison) counts as infantry. */
export function roleOfTemplate(key: string): AiRole {
  for (const role of AI_ROLES) {
    if (ROLE_KEYS[role].includes(key)) return role;
  }
  return "infantry";
}

export interface AiTrainTemplate {
  id: number;
  key: string;
  /** Men of one division. */
  men: number;
  /** Stock against one division's equipment: its lowest type, ‰ (at most 1000). */
  fillPm: number;
}

export interface AiTrainInput {
  personality: AiPersonality;
  major: boolean;
  dev: number;
  hasArmorTech: boolean;
  hasMountains: boolean;
  /** Divisions in training (queued and started). */
  training: number;
  manpower: number;
  /** Divisions by role, in the field and in training. */
  counts: Readonly<Record<AiRole, number>>;
  /** The country's templates, its first (infantry) one first. */
  templates: readonly AiTrainTemplate[];
}

/** Spec §14.5: the role shares, %. */
function roleShares(i: AiTrainInput): Record<AiRole, number> {
  const s: Record<AiRole, number> = {
    infantry: 0,
    armor: 0,
    motorized: 0,
    mountain: 0,
    cavalry: 0,
  };
  switch (i.personality) {
    case "aggressor":
      s.infantry = 70;
      s.armor = i.hasArmorTech ? 15 : 0;
      s.motorized = 5;
      s.mountain = i.hasMountains ? 10 : 0;
      break;
    case "democracy":
      s.infantry = 85;
      s.armor = i.hasArmorTech ? 15 : 0;
      break;
    case "minor":
      s.infantry = 90;
      s.cavalry = i.dev <= 2 ? 10 : 0;
      break;
  }
  return s;
}

/**
 * Spec §14.5: the templates to queue today (at most 3): while fewer than
 * the target train (major 10, minor 3), the role furthest below its share
 * (ties: AI_ROLES order) whose template has men for two divisions left and
 * half a division's equipment in stock.
 */
export function aiTrainPlan(i: AiTrainInput): number[] {
  const target = i.major ? TRAIN_TARGET_MAJOR : TRAIN_TARGET_MINOR;
  const shares = roleShares(i);
  const counts = { ...i.counts };
  let manpower = i.manpower;
  let training = i.training;
  const tplOf = (role: AiRole): AiTrainTemplate | undefined =>
    role === "infantry"
      ? i.templates[0]
      : i.templates.find((t) => ROLE_KEYS[role].includes(t.key));
  const out: number[] = [];
  while (out.length < TRAIN_PER_DAY && training < target) {
    let total = 0;
    for (const role of AI_ROLES) total += counts[role];
    let best: AiRole | null = null;
    let bestGap = 0;
    for (const role of AI_ROLES) {
      if (shares[role] <= 0) continue;
      const t = tplOf(role);
      if (t === undefined) continue;
      if (t.fillPm < TRAIN_FILL_PM || manpower < t.men * TRAIN_MEN_FACTOR) {
        continue;
      }
      // Percent points under its share once this division is in.
      const gap = shares[role] * (total + 1) - 100 * counts[role];
      if (best === null || gap > bestGap) {
        best = role;
        bestGap = gap;
      }
    }
    if (best === null) break;
    const t = tplOf(best)!;
    out.push(t.id);
    counts[best]++;
    manpower -= t.men;
    training++;
  }
  return out;
}

// ---- The country's day ----

/** Spec §14.1: the country's day (an AI, or a human with an auto army). */
export function aiLandTick(land: WwLand, smallID: number, day: number): void {
  const p = land.mg.playerBySmallID(smallID);
  const cl = land.country(smallID);
  const ce = land.econ.country(smallID);
  if (!p.isPlayer() || cl === null || ce === null) return;
  // P5 plan decision 7: a human controls it now (a takeover moves it).
  const ai = new AiDay(land, cl, ce, day, land.ww.isHumanControlled(smallID));
  if (!ai.human && day % AI_REFIT_DAYS === smallID % AI_REFIT_DAYS) {
    ai.refitTemplates();
  }
  if (!ai.daily && (day + smallID) % AI_PEACE_PERIOD_DAYS !== 0) return;
  ai.run();
}

/** A front: one enemy along one land-connected stretch of our side. */
interface Front {
  enemy: number;
  comp: number;
  border: number[];
  demand: number;
}

const FAR = 1 << 30;

/**
 * A side's regions split into land-connected stretches (straits count):
 * `comp[region]` is its stretch, -1 off the side; `regions` ascending;
 * `ports` of each stretch, ascending. Every member of the side shares it.
 */
interface SideView {
  comp: Int32Array;
  regions: number[];
  ports: number[][];
}

/**
 * Derived, never state: the side views. A view reads only the region
 * controllers and the sides; the cache keys on WwLand.controlChanges
 * (setController, the only way control changes, counts every change), the
 * side list (factions) and WwLand.derivedEpoch (a restore), so every
 * country of a side sees the view a fresh computation would give, live or
 * restored. Kept outside WwLand (not in its snapshot graph), like
 * Supply's run cache.
 */
const sideViews = new WeakMap<
  WwLand,
  {
    epoch: number;
    changes: number;
    sides: readonly unknown[];
    /** P4 (pre-flight §0-5): the naval ports' version (a base bombed out or built). */
    portVer: number;
    bySide: Map<number, SideView>;
  }
>();

function sideView(land: WwLand, me: number): SideView {
  let cache = sideViews.get(land);
  // The side list is rebuilt when the factions change (P3): a new array.
  const sides = land.sideList();
  const epoch = land.derivedEpoch;
  if (
    cache === undefined ||
    cache.epoch !== epoch ||
    cache.changes !== land.controlChanges ||
    cache.sides !== sides ||
    cache.portVer !== land.econ.portVer
  ) {
    cache = {
      epoch,
      changes: land.controlChanges,
      sides,
      portVer: land.econ.portVer,
      bySide: new Map(),
    };
    sideViews.set(land, cache);
  }
  const key = land.sideOf(me);
  const hit = cache.bySide.get(key);
  if (hit !== undefined) return hit;
  const sc = land.scenario;
  const ours = (r: number) => land.sameSide(me, land.controller[r]);
  const comp = new Int32Array(sc.maxRegionId() + 1).fill(-1);
  const regions: number[] = [];
  const ports: number[][] = [];
  const queue: number[] = [];
  for (const r of sc.landRegions) {
    if (!ours(r.id)) continue;
    regions.push(r.id);
    if (comp[r.id] >= 0) continue;
    const n = ports.length;
    ports.push([]);
    comp[r.id] = n;
    queue.length = 0;
    queue.push(r.id);
    for (let i = 0; i < queue.length; i++) {
      for (const e of sc.edgesOf(queue[i])) {
        if (comp[e.to] >= 0 || !ours(e.to)) continue;
        comp[e.to] = n;
        queue.push(e.to);
      }
    }
  }
  for (const r of regions) {
    if (navalPort(land.ww, r)) ports[comp[r]].push(r);
  }
  const view = { comp, regions, ports };
  cache.bySide.set(key, view);
  return view;
}

/**
 * P4 (AiInvasion): `me`'s side split into land-connected stretches —
 * `comp[region]`, -1 off the side — and each stretch's working ports.
 */
export function aiSideStretches(
  land: WwLand,
  me: number,
): { comp: Int32Array; ports: readonly (readonly number[])[] } {
  const v = sideView(land, me);
  return { comp: v.comp, ports: v.ports };
}

/** An army all of paratroopers (the paradrop planner's, AiAir.aiParadrops). */
function paraArmy(land: WwLand, a: Army): boolean {
  if (a.divisions.length === 0) return false;
  const t = land.divisions;
  return a.divisions.every((id) => {
    const r = t.rowOf(id);
    return r >= 0 && (land.baseStatsOf(r).flags & TPL_PARA_ANY) !== 0;
  });
}

/** Derived (one tick): the coastal guard's threat zones by the enemies' list. */
const threatMemo = new WeakMap<
  WwLand,
  { tick: number; m: Map<string, ReadonlySet<number>> }
>();
const NO_ZONES: ReadonlySet<number> = new Set();

class AiDay {
  readonly me: number;
  readonly tag: CountryTag;
  readonly personality: AiPersonality;
  readonly major: boolean;
  /** At war and able to fight, ascending. */
  readonly atWar: number[];
  /**
   * The planned wars within 60 days (P3 politics.plannedWars): their other
   * countries, ascending, every one, not only the first (Task 11:
   * Germany's 1939 beats against Danzig and Poland fall together, and
   * Danzig alone, out of reach, left the army in the west).
   */
  readonly imminent: readonly number[];
  readonly daily: boolean;
  private sideCache: SideView | null = null;
  private standingCache = new Map<number, Map<number, number[]>>();
  private offensiveCache: Set<number> | null = null;
  /** (front enemy × 65,536 + region) → today's preview and its width. */
  private regionRatioCache = new Map<
    number,
    { ratioPm: number; width: number }
  >();
  private capDistCache: Int32Array | null = null;
  private warsCache: readonly { a: number; b: number; sinceTick: number }[] =
    [];
  private warsRead = false;

  constructor(
    readonly land: WwLand,
    readonly cl: CountryLand,
    readonly ce: CountryEconomy,
    readonly day: number,
    readonly human: boolean,
  ) {
    this.me = cl.smallID;
    this.tag = cl.tag;
    this.personality = aiPersonality(cl.tag);
    this.major = COUNTRIES[cl.tag].major;
    this.atWar = land.ww
      .enemiesOf(this.me)
      .filter((e) => this.fights(e) && land.isEnemy(this.me, e));
    this.imminent = this.plannedWarsNow();
    this.daily = this.atWar.length > 0 || this.imminent.length > 0;
  }

  /** P5 plan decision 6: the country plays (an exile does). */
  private fights(id: number): boolean {
    return this.land.ww.isActor(id);
  }

  /**
   * Pre-flight ("next historical war"), from P3 politics: the countries
   * this one plans to fight within WW_AI_PREWAR_DAYS (due history beats, a
   * justification about to finish, held war goals; plannedWars' window)
   * that are fighting, no camp mate and not at war with us yet; ascending.
   */
  private plannedWarsNow(): number[] {
    const ww = this.land.ww;
    const out: number[] = [];
    for (const id of ww.politics.plannedWars(this.me, this.day)) {
      if (!this.fights(id) || ww.sameFaction(this.me, id)) continue;
      if (ww.isAtWar(this.me, id)) continue;
      out.push(id);
    }
    return out;
  }

  /**
   * Task 11: whether `enemy` is our offensive: a planned war of ours (a
   * history beat we are the actor of, due within the pre-war window or
   * fired; a justification about to finish; a war goal: politics'
   * plannedWars, its own side only — a beat in which the other country
   * acts on us, France joining Germany's war, is its offensive, not ours),
   * or a war running since 1936-01-01 that we began (Italy's in Ethiopia).
   */
  private offensive(enemy: number): boolean {
    if (this.offensiveCache === null) {
      const pol = this.land.ww.politics;
      const set = new Set<number>();
      pol.content.beats.forEach((b, i) => {
        const st = pol.beats[i];
        if (st === undefined || st.skipped || b.actor !== this.tag) return;
        if (b.act.kind !== "declare" && b.act.kind !== "join") return;
        if (!st.done && st.fireDay - this.day > WW_AI_PREWAR_DAYS) return;
        const t = pol.idOfTag(b.act.target);
        if (t !== 0) set.add(t);
      });
      const c = pol.countries[this.me];
      const j = c?.justification ?? null;
      if (j !== null && j.totalDays - j.progressDays <= WW_AI_PREWAR_DAYS) {
        set.add(j.on);
      }
      for (const g of c?.warGoals ?? []) set.add(g.on);
      // P3 lane A: a war this country declared (the declaration used its
      // goal up — politics' war decision; R12's declaredOn list).
      for (const t of c?.declaredOn ?? []) set.add(t);
      for (const [a, b] of WW_INITIAL_WARS) {
        if (a !== this.tag) continue;
        const t = this.land.scenario.smallIdOf(b);
        if (t !== 0) set.add(t);
      }
      this.offensiveCache = set;
    }
    return this.offensiveCache.has(enemy);
  }

  private issue(order: WwOrder): boolean {
    return this.land.issue(this.me, order, "ai") === null;
  }

  private ours(region: number): boolean {
    return this.land.sameSide(this.me, this.land.controller[region]);
  }

  private side(): SideView {
    this.sideCache ??= sideView(this.land, this.me);
    return this.sideCache;
  }

  /** Land-connected stretches of our side's regions (straits count); -1 elsewhere. */
  private comp(): Int32Array {
    return this.side().comp;
  }

  /** Edges from our capital over our side (FAR where it does not reach). */
  private capDist(): Int32Array {
    if (this.capDistCache !== null) return this.capDistCache;
    const cap = capitalRegion(this.land, this.me);
    this.capDistCache = this.bfs(cap === 0 ? [] : [cap], (r) => this.ours(r));
    return this.capDistCache;
  }

  /** BFS distances from `sources` (0) through regions `pass` accepts, up to `maxDepth`. */
  private bfs(
    sources: readonly number[],
    pass: (region: number) => boolean,
    maxDepth = FAR,
  ): Int32Array {
    const sc = this.land.scenario;
    const dist = new Int32Array(sc.maxRegionId() + 1).fill(FAR);
    const queue: number[] = [];
    for (const s of sources) {
      if (dist[s] === 0) continue;
      dist[s] = 0;
      queue.push(s);
    }
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i];
      if (dist[u] >= maxDepth) continue;
      for (const e of sc.edgesOf(u)) {
        if (dist[e.to] !== FAR || !pass(e.to)) continue;
        dist[e.to] = dist[u] + 1;
        queue.push(e.to);
      }
    }
    return dist;
  }

  /** Days since our war with `enemy` began (counted from the preparation's end). */
  private warDays(enemy: number): number {
    const ww = this.land.ww;
    if (!this.warsRead) {
      this.warsCache = ww.data().wars;
      this.warsRead = true;
    }
    for (const w of this.warsCache) {
      if (
        (w.a === this.me && w.b === enemy) ||
        (w.b === this.me && w.a === enemy)
      ) {
        return this.day - ww.day(Math.max(w.sinceTick, ww.prepEndTick()));
      }
    }
    return 0;
  }

  /**
   * The armies the AI commands today: all of an AI country's; a human's
   * auto ones. P4 (spec §17.4): an army preparing or sailing an invasion
   * is the invasion planner's (AiInvasion), until it lands; an army all of
   * paratroopers is the paradrop planner's (AiAir). P5 (plan decision 38):
   * never a garrison (lane O's) or a volunteer army (lane A's).
   */
  private armies(): Army[] {
    const all = this.land
      .armiesOf(this.me)
      .filter(
        (a) =>
          a.order.kind !== "invade" &&
          !paraArmy(this.land, a) &&
          a.order.kind !== "garrison" &&
          a.volunteerFor === 0,
      );
    return this.human ? all.filter((a) => a.auto) : all;
  }

  run(): void {
    const enemies = [...this.atWar];
    for (const e of this.imminent) if (!enemies.includes(e)) enemies.push(e);
    enemies.sort((a, b) => a - b);
    const garrisons = this.human ? new Set<number>() : this.garrisons(enemies);
    if (!this.human) {
      this.group(garrisons);
      this.generals(garrisons);
    }
    if (enemies.length > 0) this.fronts(enemies, garrisons);
    else if (!this.human) this.peacetime(garrisons);
    this.attacks();
    if (!this.human) {
      this.train(garrisons);
      this.build(enemies);
    }
  }

  // ---- Garrisons, the reserve (spec §14.3-4, controller rulings 2 and 5) ----

  /**
   * The regions to hold with a guard: the capital when an enemy is within
   * 4 edges (spec §14.3-4, always), then, within AI_RESERVE_PCT of the
   * high-water mark, our own victory-point regions within 4 edges of an
   * enemy (most points first, then the nearer, then the smaller id), then
   * our victory-point ports on a sea where an enemy at war holds a coast,
   * and (P4 spec §17.4, coastal guard) our coastal regions of 5 points or
   * more and our ports within an invasion's reach (8,000 km by sea) of an
   * enemy fleet or of an enemy's ports while it has convoys.
   */
  private garrisonSlots(enemies: readonly number[]): number[] {
    const land = this.land;
    const sc = land.scenario;
    const enemySet = new Set(enemies);
    const hostile = (c: number) => c !== 0 && enemySet.has(c);
    const touching = this.side().regions.filter((r) =>
      sc.edgesOf(r).some((e) => hostile(land.controller[e.to])),
    );
    const threat = this.seaThreatZones();
    if (touching.length === 0 && threat.size === 0) return [];
    // 0: touching an enemy region (1 edge from it), ... GUARD_EDGES - 1.
    const near = this.bfs(touching, (r) => this.ours(r), GUARD_EDGES - 1);
    // P3: the legal owner (spec §17), not the 1936 map.
    const owners = land.ww.politics.legalOwner;
    const cap = capitalRegion(land, this.me);
    const out: number[] = [];
    if (cap !== 0 && near[cap] !== FAR) out.push(cap);
    const slots = Math.floor(
      Math.floor((this.cl.peakDivisions * AI_RESERVE_PCT) / 100) /
        AI_GUARD_DIVISIONS,
    );
    if (slots === 0) return out;
    const vp = (r: number) => sc.region(r)?.vp ?? 0;
    // The seas an enemy at war holds a port on (a landing could come, P4).
    const zones = new Set<number>();
    for (const e of this.atWar) {
      for (const r of land.econ.regionsOf(e)) {
        if (navalPort(land.ww, r))
          for (const z of sc.regionSeaZones(r)) zones.add(z);
      }
    }
    const inland: number[] = [];
    const coast: number[] = [];
    for (const r of land.econ.regionsOf(this.me)) {
      if (out.includes(r) || owners[r] !== this.me) continue;
      const port = navalPort(land.ww, r);
      const harbor = sc.harborOf(r);
      const landing =
        harbor !== 0 && threat.has(harbor) && (vp(r) >= AI_COAST_VP || port);
      if (vp(r) <= 0 && !landing) continue;
      if (near[r] !== FAR && vp(r) > 0) inland.push(r);
      else if (
        landing ||
        (port && sc.regionSeaZones(r).some((z) => zones.has(z)))
      ) {
        coast.push(r);
      }
    }
    inland.sort((a, b) => vp(b) - vp(a) || near[a] - near[b] || a - b);
    coast.sort((a, b) => vp(b) - vp(a) || a - b);
    out.push(...[...inland, ...coast].slice(0, slots));
    return out;
  }

  /**
   * P4 spec §17.4: the sea zones an invasion could come from — within
   * AI_INVASION_KM by sea of an enemy-at-war fleet, or of an enemy's
   * ports while it has convoys. Empty at peace or with no navy about.
   */
  private seaThreatZones(): ReadonlySet<number> {
    if (this.atWar.length === 0) return NO_ZONES;
    // Shared by the countries with the same enemies on this tick.
    const tick = this.land.mg.ticks();
    let memo = threatMemo.get(this.land);
    if (memo === undefined || memo.tick !== tick) {
      memo = { tick, m: new Map() };
      threatMemo.set(this.land, memo);
    }
    const key = this.atWar.join(",");
    const hit = memo.m.get(key);
    if (hit !== undefined) return hit;
    const out = this.seaThreatZonesNow();
    memo.m.set(key, out);
    return out;
  }

  private seaThreatZonesNow(): Set<number> {
    const out = new Set<number>();
    const ww = this.land.ww;
    const sc = this.land.scenario;
    const navy = ww.navy;
    const from = new Set<number>();
    for (const e of this.atWar) {
      for (const f of navy.fleetsOf(e)) from.add(f.zone);
      const ce = ww.economy.country(e);
      if (ce === null || convoysOf(ce) <= 0) continue;
      for (const r of navalPortsOf(ww, e)) {
        const z = sc.harborOf(r);
        if (z !== 0) from.add(z);
      }
    }
    if (from.size === 0) return out;
    const dist = seaReach(
      sc,
      [...from].sort((a, b) => a - b),
      ALL_EDGES,
    ).dist;
    for (const [z, km] of dist) if (km <= AI_INVASION_KM) out.add(z);
    return out;
  }

  /**
   * Today's guards: a small idle army in (or walking to) each guard region
   * keeps it; an empty one gets a spare small idle army of its stretch,
   * else a guard split off a big army (one split a day). Returns the guard
   * armies, which grouping and the fronts leave alone.
   */
  private garrisons(enemies: readonly number[]): Set<number> {
    const land = this.land;
    const held = new Set<number>();
    if (enemies.length === 0) return held;
    const slots = this.garrisonSlots(enemies);
    if (slots.length === 0) return held;
    const comp = this.comp();
    const small = this.armies().filter(
      (a) =>
        a.divisions.length > 0 &&
        a.divisions.length <= AI_GUARD_DIVISIONS &&
        (a.order.kind === "idle" ||
          (a.order.kind === "move" && a.order.mode === MOVE_WALK)),
    );
    const open: number[] = [];
    for (const s of slots) {
      const a = small.find(
        (x) =>
          !held.has(x.id) &&
          ((x.order.kind === "idle" && land.armyRegion(x) === s) ||
            (x.order.kind === "move" && x.order.to === s)),
      );
      if (a === undefined) open.push(s);
      else held.add(a.id);
    }
    let split = false;
    for (const s of open) {
      const spare = small.find(
        (x) =>
          !held.has(x.id) &&
          x.order.kind === "idle" &&
          comp[land.armyRegion(x)] === comp[s],
      );
      if (spare !== undefined) {
        if (this.issue({ kind: "army_move", army: spare.id, region: s })) {
          held.add(spare.id);
        }
        continue;
      }
      if (split) continue;
      split = true;
      const guard = this.splitGuard(s, held);
      if (guard !== null) held.add(guard);
    }
    return held;
  }

  /**
   * Spec §14.3-4 (pre-flight A5): two first-template divisions split off
   * the nearest army of the guard region's stretch (ties: the bigger) that
   * is not attacking, and sent there. Returns the new army's id.
   */
  private splitGuard(region: number, held: ReadonlySet<number>): number | null {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const comp = this.comp();
    const tpl = this.cl.templates[0];
    if (tpl === undefined) return null;
    let best: Army | null = null;
    let bestKm = 0;
    for (const a of this.armies()) {
      if (held.has(a.id) || a.divisions.length < 3 * AI_GUARD_DIVISIONS) {
        continue;
      }
      if (a.order.kind === "plan" && a.order.executing) continue;
      if (a.order.kind === "move" || a.order.kind === "paradrop") continue;
      const at = land.armyRegion(a);
      if (comp[at] !== comp[region]) continue;
      const n = a.divisions.filter((id) => {
        const r = t.rowOf(id);
        return r >= 0 && t.template[r] === tpl.id;
      }).length;
      if (n < AI_GUARD_DIVISIONS) continue;
      const km = sc.regionKm(at, region);
      if (
        best === null ||
        km < bestKm ||
        (km === bestKm && a.divisions.length > best.divisions.length)
      ) {
        best = a;
        bestKm = km;
      }
    }
    if (best === null) return null;
    const id = land.nextArmyId;
    const order: WwOrder = {
      kind: "army_split",
      army: best.id,
      count: AI_GUARD_DIVISIONS,
      template: tpl.id,
    };
    if (!this.issue(order)) return null;
    const guard = land.armies.get(id);
    if (guard === undefined) return null;
    if (land.armyRegion(guard) !== region) {
      this.issue({ kind: "army_move", army: guard.id, region });
    }
    return guard.id;
  }

  // ---- Grouping and generals (spec §14.2) ----

  private group(garrisons: ReadonlySet<number>): void {
    const land = this.land;
    const free = () =>
      this.armies().filter(
        (a) => !garrisons.has(a.id) && a.order.kind !== "paradrop",
      );
    // (1) A small army joins the lowest-numbered army at least its size in its region.
    for (const a of free()) {
      if (!land.armies.has(a.id)) continue;
      const n = a.divisions.length;
      if (n === 0 || n > SMALL_ARMY) continue;
      if (a.order.kind === "plan" && a.order.executing) continue;
      const here = land.armyRegion(a);
      const into = free().find(
        (b) =>
          b.id !== a.id &&
          b.divisions.length >= n &&
          b.divisions.length + n <= WW_MAX_ARMY_DIVISIONS &&
          land.armyRegion(b) === here,
      );
      if (into !== undefined) {
        this.issue({ kind: "army_merge", army: a.id, into: into.id });
      }
    }
    // (2) Two armies under 4 divisions on one front merge (into the lower number).
    const small = free().filter(
      (a) =>
        a.divisions.length < FRONT_MERGE_UNDER &&
        (a.order.kind === "front" || a.order.kind === "plan"),
    );
    for (let i = 0; i < small.length; i++) {
      const a = small[i];
      for (let j = i + 1; j < small.length; j++) {
        const b = small[j];
        if (!land.armies.has(a.id) || !land.armies.has(b.id)) continue;
        if (b.order.enemy !== a.order.enemy) continue;
        if (!b.front.some((f) => a.front.includes(f))) continue;
        if (a.divisions.length + b.divisions.length > WW_MAX_ARMY_DIVISIONS) {
          continue;
        }
        this.issue({ kind: "army_merge", army: b.id, into: a.id });
      }
    }
  }

  /** Spec §14.2-3: free generals (skill sum, then id) to the biggest armies without one. */
  private generals(garrisons: ReadonlySet<number>): void {
    const cl = this.cl;
    const armies = this.armies()
      .filter(
        (a) =>
          a.general === 0 &&
          !garrisons.has(a.id) &&
          a.divisions.length > AI_GUARD_DIVISIONS,
      )
      .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id);
    if (armies.length === 0) return;
    const sum = (g: GeneralState) => g.att + g.dfn + g.plan + g.log;
    const free = cl.generals
      .filter((g) => g.army === 0 && canServe(this.land, g, this.day))
      .sort((a, b) => sum(b) - sum(a) || a.id - b.id);
    for (let i = 0; i < armies.length && i < free.length; i++) {
      this.issue({
        kind: "army_general",
        army: armies[i].id,
        general: free[i].id,
      });
    }
    if (
      free.length === 0 &&
      cl.armyXpMilli >= Math.max(APPOINT_XP_MILLI, WW_TITLED_GENERAL_XP_MILLI)
    ) {
      // The new general takes an army on the next AI day.
      this.issue({ kind: "appoint_general" });
    }
  }

  // ---- Fronts (spec §14.3) ----

  /** Divisions of `enemy`'s side standing (or walking) in a region. */
  private enemyCount(region: number, enemy: number): number {
    const land = this.land;
    const t = land.divisions;
    let n = 0;
    for (const r of land.rowsIn(region)) {
      const m = t.mode[r];
      if (
        (m === MOVE_NONE || m === MOVE_WALK) &&
        land.sameSide(t.owner[r], enemy)
      ) {
        n++;
      }
    }
    return n;
  }

  /** Spec §14.3-1/2: per enemy and stretch of our side, the ordered border and its demand. */
  private buildFronts(enemies: readonly number[]): Front[] {
    const land = this.land;
    const sc = land.scenario;
    const comp = this.comp();
    const capDist = this.capDist();
    const byEnemy = new Map<number, number[]>(enemies.map((e) => [e, []]));
    for (const r of this.side().regions) {
      for (const e of sc.edgesOf(r)) {
        const l = byEnemy.get(land.controller[e.to]);
        if (l !== undefined && l[l.length - 1] !== r) l.push(r);
      }
    }
    const facing = new Map<number, number>();
    const fronts: Front[] = [];
    for (const enemy of enemies) {
      const border = byEnemy.get(enemy)!;
      if (border.length === 0) continue;
      const set = new Set(border);
      // Stretches by their region nearest the capital.
      const first = new Map<number, number>();
      for (const r of border) {
        const f = first.get(comp[r]);
        if (
          f === undefined ||
          capDist[r] < capDist[f] ||
          (capDist[r] === capDist[f] && r < f)
        ) {
          first.set(comp[r], r);
        }
      }
      const comps = [...first.keys()].sort((a, b) => {
        const x = first.get(a)!;
        const y = first.get(b)!;
        return capDist[x] - capDist[y] || x - y;
      });
      for (const c of comps) {
        const order = this.borderOrder(enemy, set, c);
        // An enemy region's divisions face each of our border regions next
        // to it: they count once, shared among those regions.
        const touching = new Map<number, number>();
        for (const b of order) {
          for (const e of sc.edgesOf(b)) {
            if (land.controller[e.to] !== enemy) continue;
            touching.set(e.to, (touching.get(e.to) ?? 0) + 1);
          }
        }
        const offensive = this.offensive(enemy);
        let demand = 0;
        for (const b of order) {
          let milli = 0;
          let dirs = 0;
          for (const e of sc.edgesOf(b)) {
            const x = e.to;
            if (land.controller[x] !== enemy) continue;
            dirs++;
            let k = facing.get(x);
            if (k === undefined) facing.set(x, (k = this.enemyCount(x, enemy)));
            milli += Math.floor((k * 1000) / touching.get(x)!);
          }
          demand += aiBorderDemand({
            facingMilli: milli,
            offensive,
            land: sc.landOf(b),
            dirs,
            fort: land.econ.fort[b] ?? 0,
          });
        }
        fronts.push({ enemy, comp: c, border: order, demand });
      }
    }
    return fronts;
  }

  /**
   * Spec §14.3-3: a stretch's border regions from the one nearest the
   * capital, BFS over the border graph (linked by an edge or by a shared
   * enemy region, neighbours by id); a part it does not reach starts again
   * from its region nearest the capital.
   */
  private borderOrder(
    enemy: number,
    border: ReadonlySet<number>,
    c: number,
  ): number[] {
    const land = this.land;
    const sc = land.scenario;
    const comp = this.comp();
    const capDist = this.capDist();
    const mine = [...border]
      .filter((r) => comp[r] === c)
      .sort((a, b) => capDist[a] - capDist[b] || a - b);
    const inStretch = new Set(mine);
    const byEnemyRegion = new Map<number, number[]>();
    for (const b of mine) {
      for (const e of sc.edgesOf(b)) {
        if (land.controller[e.to] !== enemy) continue;
        const l = byEnemyRegion.get(e.to) ?? [];
        l.push(b);
        byEnemyRegion.set(e.to, l);
      }
    }
    const out: number[] = [];
    const seen = new Set<number>();
    for (const s of mine) {
      if (seen.has(s)) continue;
      seen.add(s);
      const from = out.length;
      out.push(s);
      for (let i = from; i < out.length; i++) {
        const next = new Set<number>();
        for (const e of sc.edgesOf(out[i])) {
          if (inStretch.has(e.to)) next.add(e.to);
          for (const b of byEnemyRegion.get(e.to) ?? []) next.add(b);
        }
        for (const v of [...next].sort((a, b) => a - b)) {
          if (seen.has(v)) continue;
          seen.add(v);
          out.push(v);
        }
      }
    }
    return out;
  }

  /** The stretch of our side an army stands in (its main region's); -1: none. */
  private armyComp(a: Army): number {
    return this.comp()[this.land.armyRegion(a)] ?? -1;
  }

  /** Our side's ports in stretch `c`, by id. */
  private portsOf(c: number): readonly number[] {
    return this.side().ports[c] ?? [];
  }

  /** On its way by a move order (to a port, a guard region, by rail or sea). */
  private travelling(a: Army): boolean {
    if (a.order.kind !== "move") return false;
    const t = this.land.divisions;
    return armyRows(this.land, a).some((r) => t.mode[r] !== MOVE_NONE);
  }

  private fronts(
    enemies: readonly number[],
    garrisons: ReadonlySet<number>,
  ): void {
    const land = this.land;
    const sc = land.scenario;
    const fronts = this.buildFronts(enemies);
    if (fronts.length === 0) return;
    const portsIn = (c: number) => this.portsOf(c);
    const armies = this.armies().filter(
      (a) =>
        !garrisons.has(a.id) &&
        a.divisions.length > 0 &&
        a.order.kind !== "paradrop",
    );
    const input: AiFrontArmy[] = [];
    for (const a of armies) {
      const c = this.armyComp(a);
      if (c < 0) continue;
      let reach: number[] = [];
      fronts.forEach((f, i) => {
        if (f.comp === c) reach.push(i);
      });
      let sea = false;
      if (reach.length === 0) {
        // Spec §13.3: over the sea from a port of ours to one by the front.
        const from = portsIn(c);
        if (from.length === 0) continue;
        reach = [];
        fronts.forEach((f, i) => {
          const to = portsIn(f.comp);
          if (
            to.some((p) => from.some((q) => sc.regionKm(q, p) <= AI_SEA_MAX_KM))
          ) {
            reach.push(i);
          }
        });
        if (reach.length === 0) continue;
        sea = true;
      }
      const o = a.order;
      const current =
        o.kind === "front" || o.kind === "plan"
          ? fronts.findIndex((f) => f.enemy === o.enemy && f.comp === c)
          : -1;
      input.push({
        id: a.id,
        divisions: a.divisions.length,
        reach,
        sea,
        ...(current >= 0 ? { current } : {}),
      });
    }
    const plan = aiFrontPlan({
      armies: input,
      enemies: fronts.map((f, i) => ({
        id: i,
        border: f.border,
        demand: f.demand,
      })),
    });
    const comp = this.comp();
    for (const { army, enemy, anchor } of plan) {
      const a = land.armies.get(army);
      if (a === undefined || this.travelling(a)) continue;
      const f = fronts[enemy];
      if (this.armyComp(a) !== f.comp) {
        this.crossSea(a, f, anchor);
        continue;
      }
      const o = a.order;
      if (
        (o.kind === "front" || o.kind === "plan") &&
        o.enemy === f.enemy &&
        a.front.some((r) => comp[r] === f.comp)
      ) {
        continue; // The same front: no order, its readiness stays (spec §14.3).
      }
      if (this.railTransit(a, anchor)) continue;
      this.issue({ kind: "army_front", army: a.id, anchor, enemy: f.enemy });
    }
  }

  /**
   * Task 11 round 2 (내 판단): an army standing together farther than
   * AI_RAIL_MIN_KM from where it is sent takes the train there first (spec
   * §7.4), when a railway of our side leads to it: the Soviet armies in
   * the Far East walked three months to the Polish border in 1939.
   * Its front comes the day after it arrives. False when it walks.
   */
  private railTransit(a: Army, to: number): boolean {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const rows = armyRows(land, a);
    if (rows.length === 0 || (land.econ.rail[to] ?? 0) < 1) return false;
    const here = t.region[rows[0]];
    if (here === to || sc.regionKm(here, to) <= AI_RAIL_MIN_KM) return false;
    const together = rows.every(
      (r) =>
        t.region[r] === here && t.mode[r] === MOVE_NONE && t.battle[r] === 0,
    );
    if (!together || (land.econ.rail[here] ?? 0) < 1) return false;
    if (a.order.kind === "move" && a.order.to === to) return true;
    return this.issue({ kind: "army_rail", army: a.id, region: to });
  }

  /**
   * Spec §7.5, §13.3: an army whose front lies over the sea gathers in a
   * port of its stretch, then sails to the port of the front's stretch
   * nearest the anchor.
   */
  private crossSea(a: Army, f: Front, anchor: number): void {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const comp = this.comp();
    const rows = armyRows(land, a);
    if (rows.length === 0) return;
    const here = t.region[rows[0]];
    const together = rows.every(
      (r) => t.region[r] === here && t.mode[r] === MOVE_NONE,
    );
    if (together && navalPort(land.ww, here) && comp[here] >= 0) {
      const fromAnchor = this.bfs([anchor], (r) => comp[r] === f.comp);
      let best = 0;
      for (const p of this.portsOf(f.comp)) {
        if (sc.regionKm(here, p) > AI_SEA_MAX_KM) continue;
        if (best === 0 || fromAnchor[p] < fromAnchor[best]) best = p;
      }
      if (best !== 0) {
        this.issue({ kind: "army_sea", army: a.id, region: best });
      }
      return;
    }
    const at = land.armyRegion(a);
    const c = comp[at];
    const dist = this.bfs([at], (r) => comp[r] === c);
    let port = 0;
    for (const p of this.portsOf(c)) {
      if (port === 0 || dist[p] < dist[port]) port = p;
    }
    if (port === 0 || (a.order.kind === "move" && a.order.to === port)) return;
    this.issue({ kind: "army_move", army: a.id, region: port });
  }

  /**
   * Spec §14.3-5: no enemy: the armies line our border with the neighbour
   * fielding the most divisions (ties: the smaller id), spread along it as
   * a front's anchors are; those already there or on their way stay.
   */
  private peacetime(garrisons: ReadonlySet<number>): void {
    const land = this.land;
    const sc = land.scenario;
    let pick = 0;
    let most = -1;
    for (const n of land.econ.countryNeighbours(this.me)) {
      if (land.sameSide(this.me, n) || !this.fights(n)) continue;
      let d = 0;
      for (const a of land.armiesOf(n)) d += a.divisions.length;
      if (d > most) {
        pick = n;
        most = d;
      }
    }
    if (pick === 0) return;
    const capDist = this.capDist();
    const border = land.econ
      .regionsOf(this.me)
      .filter((r) => sc.edgesOf(r).some((e) => land.controller[e.to] === pick))
      .sort((a, b) => capDist[a] - capDist[b] || a - b);
    if (border.length === 0) return;
    const comp = this.comp();
    const armies = this.armies()
      .filter(
        (a) =>
          !garrisons.has(a.id) &&
          a.divisions.length > 0 &&
          a.order.kind !== "paradrop" &&
          !this.travelling(a),
      )
      .sort((a, b) => b.divisions.length - a.divisions.length || a.id - b.id);
    armies.forEach((a, i) => {
      const at = Math.floor(
        ((2 * i + 1) * border.length) / (2 * armies.length),
      );
      const to = border[at];
      const here = land.armyRegion(a);
      if (comp[here] !== comp[to]) return;
      if (a.order.kind === "move" && a.order.to === to) return;
      if (a.order.kind === "idle" && here === to) return;
      if (this.railTransit(a, to)) return;
      this.issue({ kind: "army_move", army: a.id, region: to });
    });
  }

  // ---- Attacks (spec §14.4) ----

  private attacks(): void {
    const land = this.land;
    const threshold = aiThresholdPm(this.personality);
    for (const a of this.armies()) {
      if (!land.armies.has(a.id) || a.order.kind === "paradrop") continue;
      const rows = armyRows(land, a);
      if (rows.length === 0 || this.travelling(a)) continue;
      // Spec §14.4: a pocket breaks out; with no way out it fights on as a front.
      if (this.atWar.length > 0 && this.encircled(rows) && this.breakOut(a)) {
        continue;
      }
      const o = a.order;
      if (o.kind !== "front" && o.kind !== "plan") continue;
      if (!this.atWar.includes(o.enemy)) continue;
      const org = this.orgPm(rows);
      if (o.kind === "plan" && o.executing) {
        // Ruling 5: under 40% org it regroups; spec §14.4: under 0.7 it
        // holds; Task 11 (ruling 6): the attack over, a worn army regroups.
        const stop = () => {
          if (org < AI_REGROUP_ORG_PM) return true;
          const fighting = rows.some(
            (r) =>
              land.divisions.battle[r] !== 0 ||
              land.divisions.mode[r] === MOVE_ADVANCE,
          );
          const ratio = this.ratioOf(a, o.enemy);
          if (ratio < STOP_RATIO_PM) return true;
          return (
            !fighting && org < AI_ATTACK_ORG_PM && ratio < AI_PURSUIT_RATIO_PM
          );
        };
        if (stop()) this.issue({ kind: "army_execute", army: a.id, on: false });
        continue;
      }
      if (org < AI_ATTACK_ORG_PM || this.formedPm(a, rows) < FORMED_PM) {
        continue;
      }
      const ratio = this.ratioOf(a, o.enemy);
      if (ratio < threshold) continue;
      // (내 판단) Empty enemy land across the front is walked into at once
      // (spec §7.7); a fight waits for the readiness or the war's 60th day,
      // and never starts under AI_REATTACK_READY_BP (Task 11).
      if (
        ratio < RATIO_FREE_PM &&
        ((ratio < AI_PURSUIT_RATIO_PM && a.planBp < AI_REATTACK_READY_BP) ||
          (a.planBp < READY_BP && this.warDays(o.enemy) < WAR_READY_DAYS))
      ) {
        continue;
      }
      const targets = this.targetsFor(a, o.enemy, ratio);
      if (targets.length > 0) this.plan(a, targets, AI_STANCE);
    }
  }

  /** army_plan when the targets or the stance change, then execute. */
  private plan(a: Army, targets: number[], stance: Stance): void {
    const o = a.order;
    const same =
      o.kind === "plan" &&
      o.stance === stance &&
      o.targets.length === targets.length &&
      o.targets.every((r, i) => r === targets[i]);
    if (!same) {
      if (!this.issue({ kind: "army_plan", army: a.id, targets, stance })) {
        return;
      }
    }
    this.issue({ kind: "army_execute", army: a.id, on: true });
  }

  /** Org of the army against its maximum, ‰. */
  private orgPm(rows: readonly number[]): number {
    const land = this.land;
    let org = 0;
    let max = 0;
    for (const r of rows) {
      org += land.divisions.org[r];
      max += land.orgMaxOf(r);
    }
    return max === 0 ? 0 : Math.floor((org * 1000) / max);
  }

  /** Share of the army standing in its front regions, ‰. */
  private formedPm(a: Army, rows: readonly number[]): number {
    const t = this.land.divisions;
    let n = 0;
    for (const r of rows) {
      if (t.mode[r] === MOVE_NONE && a.front.includes(t.region[r])) n++;
    }
    return Math.floor((n * 1000) / rows.length);
  }

  /**
   * Spec §14.4 ρ (pre-flight A2): over the enemy regions across the
   * army's front that hold enemy divisions, the preview (§9.9) of the
   * army's divisions standing next to each, weighted by that region's
   * combat width for as many directions. Enemy regions but no defenders: a
   * free walk (RATIO_FREE_PM); no enemy region: 0.
   */
  private ratioOf(a: Army, enemy: number): number {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const me = this.me;
    // Task 11 (내 판단): the battle as it would be fought: every division
    // of ours standing on a front against the same enemy next to the
    // enemy region joins it, not only this army's (two armies on one
    // sector attack together; an army fronting another enemy does not).
    const standing = this.frontStanding(a.order.enemy);
    const across = new Map<number, number[]>();
    for (const f of a.front) {
      for (const e of sc.edgesOf(f)) {
        const c = land.controller[e.to];
        if (!land.isEnemy(me, c) || (enemy !== 0 && c !== enemy)) continue;
        const l = across.get(e.to) ?? [];
        if (!l.includes(f)) l.push(f);
        across.set(e.to, l);
      }
    }
    if (across.size === 0) return 0;
    let num = 0;
    let den = 0;
    for (const x of [...across.keys()].sort((p, q) => p - q)) {
      // Task 11 round 2: one preview per (front enemy, region) a day; every
      // army facing that enemy there shares it.
      const key = a.order.enemy * 65_536 + x;
      let hit = this.regionRatioCache.get(key);
      if (hit === undefined) {
        hit = { ratioPm: 0, width: 0 };
        if (enemyDivisionsIn(land, me, x) > 0) {
          const att: number[] = [];
          let dirs = 0;
          for (const e of sc.edgesOf(x)) {
            const here = (standing.get(e.to) ?? []).filter(
              (r) => t.battle[r] === 0 || t.battle[r] === x,
            );
            if (here.length > 0) dirs++;
            att.push(...here);
          }
          if (att.length > 0) {
            hit.width = combatWidth(sc.landOf(x), dirs);
            hit.ratioPm = predictAttack(land, att, x).ratioPm;
          }
        }
        this.regionRatioCache.set(key, hit);
      }
      if (hit.width === 0) continue;
      num += hit.ratioPm * hit.width;
      den += hit.width;
    }
    return den === 0 ? RATIO_FREE_PM : Math.floor(num / den);
  }

  /**
   * Our divisions standing (not moving) in the front regions of our front
   * and plan armies against `enemy`, by region (once a day per enemy).
   */
  private frontStanding(enemy: number): ReadonlyMap<number, readonly number[]> {
    const cached = this.standingCache.get(enemy);
    if (cached !== undefined) return cached;
    const land = this.land;
    const t = land.divisions;
    const out = new Map<number, number[]>();
    for (const b of land.armiesOf(this.me)) {
      if (b.order.kind !== "front" && b.order.kind !== "plan") continue;
      if (b.order.enemy !== enemy) continue;
      for (const r of armyRows(land, b)) {
        const f = t.region[r];
        if (t.mode[r] !== MOVE_NONE || !b.front.includes(f)) continue;
        const l = out.get(f) ?? [];
        l.push(r);
        out.set(f, l);
      }
    }
    for (const l of out.values()) l.sort((x, y) => x - y);
    this.standingCache.set(enemy, out);
    return out;
  }

  /**
   * Spec §14.4: the plan's targets among `enemy`'s regions within 6 edges
   * of the front (through enemy land). A minor fighting a major takes back
   * only its own 1936 regions (controller ruling 3: no offensives of its
   * own beyond liberating them).
   */
  private targetsFor(a: Army, enemy: number, ratioPm = 0): number[] {
    const land = this.land;
    const sc = land.scenario;
    const me = this.me;
    const dist = this.bfs(
      a.front,
      (r) => land.isEnemy(me, land.controller[r]),
      WW_TARGET_REACH_EDGES,
    );
    const pol = land.ww.politics;
    const enemyTag = sc.tagOfSmallId(enemy);
    // P5: a woken dormant slot's capital is its best region.
    const capital = enemyTag === undefined ? 0 : land.ww.capitalRegion(enemy);
    // Ruling 3: a minor fighting a major only takes back its own 1936
    // regions. Task 11 (내 판단, the Phoney War: HOI4's Allies hold in
    // 1939-40): a democracy fighting an aggressor only takes back its
    // own and its camp's.
    const enemyMajor = enemyTag !== undefined && COUNTRIES[enemyTag].major;
    const coresOnly =
      (this.personality === "minor" && enemyMajor) ||
      (this.personality === "democracy" &&
        enemyTag !== undefined &&
        aiPersonality(enemyTag) === "aggressor" &&
        !this.liberationLifted(enemy, ratioPm));
    const ours = (owner: number) =>
      owner === me ||
      (this.personality === "democracy" && land.ww.sameFaction(me, owner));
    const regions: AiTargetRegion[] = [];
    for (const r of sc.landRegions) {
      const d = dist[r.id];
      if (d === 0 || d === FAR || land.controller[r.id] !== enemy) continue;
      // Liberation only: our own (a democracy: or its camp's) core regions
      // (P3 legal owner + core).
      if (coresOnly && !(ours(pol.legalOwner[r.id]) && pol.isCore(r.id))) {
        continue;
      }
      regions.push({
        region: r.id,
        vp: r.vp,
        dist: d,
        capital: r.id === capital,
      });
    }
    return aiTargets({ regions });
  }

  /**
   * Task 11 round 2 (내 판단): a democracy's liberation-only rule against an
   * aggressor ends once that enemy's side holds the 1936 capital of a
   * country of our camp (Paris fallen: the Allies go for Germany), from
   * AI_LIBERATION_END_DAY on, or when our strength ratio there reaches
   * AI_LIBERATION_LIFT_RATIO_PM after AI_LIBERATION_LIFT_WAR_DAYS of war
   * (a thin West Wall in 1939 is no reason).
   */
  private liberationLifted(enemy: number, ratioPm: number): boolean {
    if (this.day >= AI_LIBERATION_END_DAY) return true;
    if (
      ratioPm >= AI_LIBERATION_LIFT_RATIO_PM &&
      this.warDays(enemy) >= AI_LIBERATION_LIFT_WAR_DAYS
    ) {
      return true;
    }
    const land = this.land;
    const sc = land.scenario;
    for (const tag of sc.countries) {
      const id = sc.smallIdOf(tag);
      if (id !== this.me && !land.ww.sameFaction(this.me, id)) continue;
      // P5: a woken dormant slot's capital is its best region (0: none).
      const cap = land.ww.capitalRegion(id);
      const c = cap === 0 ? 0 : land.controller[cap];
      if (c !== 0 && (c === enemy || land.sameSide(enemy, c))) return true;
    }
    return false;
  }

  private encircled(rows: readonly number[]): boolean {
    const t = this.land.divisions;
    return rows.some((r) => t.encircled[r] === 1);
  }

  /**
   * Spec §14.4: an encircled army attacks (aggressive) the first enemy
   * region on the shortest way to our side's nearest region outside the
   * pocket. False when no way out leads through enemy land.
   */
  private breakOut(a: Army): boolean {
    const land = this.land;
    const sc = land.scenario;
    const me = this.me;
    const start = land.armyRegion(a);
    const prev = new Map<number, number>([[start, 0]]);
    const queue = [start];
    let goal = 0;
    for (let i = 0; i < queue.length && goal === 0; i++) {
      const u = queue[i];
      for (const e of sc.edgesOf(u)) {
        const v = e.to;
        if (prev.has(v)) continue;
        const c = land.controller[v];
        const own = land.sameSide(me, c);
        if (!own && !land.isEnemy(me, c)) continue;
        prev.set(v, u);
        if (own && land.encircled[v] === 0) {
          goal = v;
          break;
        }
        queue.push(v);
      }
    }
    if (goal === 0) return false;
    let target = 0;
    for (let v = goal; v !== start; v = prev.get(v)!) {
      if (land.isEnemy(me, land.controller[v])) target = v;
    }
    if (target === 0) return false;
    const o = a.order;
    if (
      o.kind === "plan" &&
      o.executing &&
      o.stance === "aggressive" &&
      o.targets.length === 1 &&
      o.targets[0] === target
    ) {
      return true;
    }
    this.plan(a, [target], "aggressive");
    return true;
  }

  // ---- Training, templates, building (spec §14.5) ----

  /** Stock of need group i (P6 plan decision 6: NEED_GROUPS order), every slot of it. */
  private stockOf(i: number): number {
    return groupStock(this.ce.stock, i, this.land.keyStatsOf(this.ce.smallID));
  }

  /** Stock against one division's need, its lowest type, ‰ (at most 1000). */
  private fillPm(need: readonly number[]): number {
    let low = 1000;
    for (let i = 0; i < need.length; i++) {
      if (need[i] <= 0) continue;
      low = Math.min(low, Math.floor((this.stockOf(i) * 1000) / need[i]));
    }
    return low;
  }

  private train(garrisons: ReadonlySet<number>): void {
    const land = this.land;
    const cl = this.cl;
    let training = cl.trainees.length;
    for (const e of cl.training) training += e.remaining;
    if (training >= (this.major ? TRAIN_TARGET_MAJOR : TRAIN_TARGET_MINOR)) {
      return;
    }
    const keyOf = new Map(cl.templates.map((t) => [t.id, t.key]));
    const firstId = cl.templates[0]?.id ?? -1;
    const counts: Record<AiRole, number> = {
      infantry: 0,
      armor: 0,
      motorized: 0,
      mountain: 0,
      cavalry: 0,
    };
    // Battalions in use and the special ones (spec §4.1's cap, which
    // queueTraining enforces): Task 11 round 2.
    let battalions = 0;
    let special = 0;
    const add = (tpl: number, n: number) => {
      const role =
        tpl === firstId ? "infantry" : roleOfTemplate(keyOf.get(tpl) ?? "");
      counts[role] += n;
      const ts = land.templateStatsOf(this.me, tpl);
      if (ts !== null) {
        battalions += ts.battalions * n;
        special += ts.special * n;
      }
    };
    const t = land.divisions;
    for (const a of land.armiesOf(this.me)) {
      for (const id of a.divisions) {
        const r = t.rowOf(id);
        if (r >= 0) add(t.template[r], 1);
      }
    }
    for (const e of cl.training) add(e.template, e.remaining);
    for (const x of cl.trainees) add(x.template, 1);
    const templates: AiTrainTemplate[] = [];
    for (const tpl of cl.templates) {
      const s = land.templateStatsOf(this.me, tpl.id);
      if (s === null) continue;
      // Task 11 round 2: a template over the special-forces cap is not
      // offered (its order would be refused every day, and the role it
      // stands for blocked all training: Germany's mountain division held
      // its army at 102 divisions from 1939).
      if (
        s.special > 0 &&
        special + s.special > specialCap(battalions + s.battalions)
      ) {
        continue;
      }
      templates.push({
        id: tpl.id,
        key: tpl.key,
        men: s.men,
        fillPm: this.fillPm(s.need),
      });
    }
    let civ = 0;
    for (const r of land.econ.regionsOf(this.me)) civ += land.econ.civ[r];
    const picks = aiTrainPlan({
      personality: this.personality,
      major: this.major,
      dev: land.scenario.devOf(cl.tag, civ),
      hasArmorTech: this.ce.researched.has("light_tank_1"),
      hasMountains: land.econ
        .regionsOf(this.me)
        .some((r) => land.scenario.landOf(r) === "mountain"),
      training,
      manpower: this.ce.manpower,
      counts,
      templates,
    });
    for (const template of picks) {
      this.issue({
        kind: "train",
        template,
        count: 1,
        army: this.trainArmy(garrisons),
        region: 0,
      });
    }
  }

  /**
   * The army a new division joins: the smallest (counting what already
   * trains for it) on the capital's stretch, no guard (ties: the smaller
   * id); 0: a new army.
   */
  private trainArmy(garrisons: ReadonlySet<number>): number {
    const land = this.land;
    const cl = this.cl;
    const cap = capitalRegion(land, this.me);
    if (cap === 0) return 0;
    const comp = this.comp();
    const waiting = new Map<number, number>();
    for (const e of cl.training) {
      waiting.set(e.army, (waiting.get(e.army) ?? 0) + e.remaining);
    }
    for (const x of cl.trainees) {
      const e = cl.training.find((y) => y.id === x.entry);
      if (e !== undefined) waiting.set(e.army, (waiting.get(e.army) ?? 0) + 1);
    }
    let best = 0;
    let bestN = WW_MAX_ARMY_DIVISIONS;
    for (const a of land.armiesOf(this.me)) {
      if (garrisons.has(a.id) || a.divisions.length <= AI_GUARD_DIVISIONS) {
        continue;
      }
      // P4: an invasion army takes no new divisions (it would outgrow its
      // landing), and neither does one on its way somewhere (rail, sea, a
      // port): the new divisions appear at the capital and would be left
      // behind on another stretch, the army split over the sea.
      if (a.order.kind === "invade" || a.order.kind === "move") continue;
      if (paraArmy(land, a)) continue;
      if (comp[land.armyRegion(a)] !== comp[cap]) continue;
      const n = a.divisions.length + (waiting.get(a.id) ?? 0);
      if (n < bestN) {
        best = a.id;
        bestN = n;
      }
    }
    return best;
  }

  /**
   * Spec §14.5: every 180 days, with the army experience for it, one more
   * support company on the infantry template (support artillery, then
   * engineers, anti-tank when an enemy at war fields armour, field
   * hospital, logistics); and medium tanks for light ones once researched.
   */
  refitTemplates(): void {
    const cl = this.cl;
    const researched = this.ce.researched;
    const inf = cl.templates[0];
    if (inf !== undefined && inf.def.support.length < WW_MAX_SUPPORT) {
      const wanted: readonly (readonly [SupportId, readonly WwTechId[]])[] = [
        ["support_artillery", ["artillery_1", "support_eq_1"]],
        ["engineer", ["engineer_company"]],
        ["support_anti_tank", ["anti_tank_1", "support_eq_1"]],
        ["field_hospital", ["field_hospital"]],
        ["logistics", ["logistics_company"]],
      ];
      for (const [s, techs] of wanted) {
        if (inf.def.support.includes(s)) continue;
        if (!techs.every((x) => researched.has(x))) continue;
        if (s === "support_anti_tank" && !this.enemyArmour()) continue;
        this.saveTemplate(inf.id, inf.def.battalions, [...inf.def.support, s]);
        break;
      }
    }
    if (researched.has("medium_tank_1")) {
      for (const tpl of cl.templates) {
        if (roleOfTemplate(tpl.key) !== "armor") continue;
        if (!tpl.def.battalions.includes("light_armor")) continue;
        const bns = tpl.def.battalions.map(
          (b): BattalionId => (b === "light_armor" ? "medium_armor" : b),
        );
        this.saveTemplate(tpl.id, bns, tpl.def.support);
      }
    }
  }

  /**
   * template_save of an edit with the automatic name (the 1936 key stays),
   * when the experience allows and (내 판단) the stock already holds what
   * the edit adds for every division of the template, in the field and in
   * training: an edit the stock cannot fill would only leave the divisions
   * short and stop the training (it waits for half the equipment).
   */
  private saveTemplate(
    id: number,
    battalions: readonly BattalionId[],
    support: readonly SupportId[],
  ): void {
    const tpl = this.cl.template(id);
    if (tpl === null) return;
    const def = { name: "", battalions, support };
    if (templateXpCost(tpl.def, def) > this.cl.armyXpMilli) return;
    const t = this.land.divisions;
    let n = this.cl.trainees.filter((x) => x.template === id).length;
    for (const e of this.cl.training) if (e.template === id) n += e.remaining;
    for (const a of this.land.armiesOf(this.me)) {
      for (const d of a.divisions) {
        const r = t.rowOf(d);
        if (r >= 0 && t.template[r] === id) n++;
      }
    }
    const before = templateStats(tpl.def, this.ce.stats, GEN1).need;
    const after = templateStats(def, this.ce.stats, GEN1).need;
    for (let i = 0; i < after.length; i++) {
      const more = after[i] - before[i];
      if (more > 0 && this.stockOf(i) < more * Math.max(1, n)) return;
    }
    this.issue({
      kind: "template_save",
      template: id,
      base: 0,
      name: "",
      battalions: [...battalions],
      support: [...support],
    });
  }

  /** An enemy at war fields an armoured division. */
  private enemyArmour(): boolean {
    const land = this.land;
    const t = land.divisions;
    for (const e of land.ww.enemiesOf(this.me)) {
      for (const a of land.armiesOf(e)) {
        for (const id of a.divisions) {
          const r = t.rowOf(id);
          if (r >= 0 && (land.baseStatsOf(r).flags & TPL_ARMOR_ANY) !== 0) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Spec §14.5, one a day with at most LAND_BUILDS_QUEUED waiting: a fort
   * in the core victory-point region facing the most enemy divisions
   * (democracies and minors), Germany's West Wall from 1938, else a
   * railway in a core region without one, nearest the capital first.
   */
  private build(enemies: readonly number[]): void {
    const land = this.land;
    const econ = land.econ;
    const ce = this.ce;
    const sc = land.scenario;
    let queued = 0;
    for (const q of ce.queue) {
      if (q.building === "fort" || q.building === "rail") queued++;
    }
    if (queued >= LAND_BUILDS_QUEUED) return;
    // P3: core regions we legally own (spec §17.6).
    const pol = land.ww.politics;
    const core = econ
      .regionsOf(this.me)
      .filter((r) => pol.legalOwner[r] === this.me && pol.isCore(r));
    const fortLevel = (r: number) =>
      econ.fort[r] + queuedInRegion(ce.queue, r).fort;
    const tryBuild = (r: number, b: "fort" | "rail") => {
      if (queueBuild(econ, ce, r, b, 1) !== null) return false;
      econ.markCountryDirty(this.me);
      return true;
    };
    if (this.personality !== "aggressor" && enemies.length > 0) {
      const facing = new Map<number, number>();
      for (const r of core) {
        if ((sc.region(r)?.vp ?? 0) <= 0 || fortLevel(r) >= FORT_MAX) continue;
        let n = -1;
        for (const e of sc.edgesOf(r)) {
          const c = land.controller[e.to];
          if (!enemies.includes(c)) continue;
          n = Math.max(0, n) + this.enemyCount(e.to, c);
        }
        if (n >= 0) facing.set(r, n);
      }
      const list = [...facing.keys()].sort(
        (a, b) => facing.get(b)! - facing.get(a)! || a - b,
      );
      for (const r of list) if (tryBuild(r, "fort")) return;
    }
    if (this.tag === "DEU" && this.day >= WESTWALL_DAY) {
      const fra = sc.smallIdOf("FRA");
      const west = core
        .filter(
          (r) =>
            fortLevel(r) < FORT_MAX &&
            sc.edgesOf(r).some((e) => land.controller[e.to] === fra),
        )
        .sort((a, b) => fortLevel(a) - fortLevel(b) || a - b);
      for (const r of west) if (tryBuild(r, "fort")) return;
    }
    const capDist = this.capDist();
    const rail = core
      .filter(
        (r) => econ.rail[r] === 0 && queuedInRegion(ce.queue, r).rail === 0,
      )
      .sort((a, b) => capDist[a] - capDist[b] || a - b);
    for (const r of rail) if (tryBuild(r, "rail")) return;
  }
}
