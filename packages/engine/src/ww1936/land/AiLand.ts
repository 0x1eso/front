// World War 1936 P2: the AI's land war (P2 spec §14). It reads the land
// war as a player's screens show it (armies, divisions, control, the wars,
// the historical calendar; never another country's plans) and acts only
// through the orders a player gives: land.issue(smallID, order, "ai") and
// the economy's queueBuild. It keeps no memory of its own: every day it
// works the picture out again from the game (a restored game decides the
// same), with no randomness but the seeded draw of a main sector (AiEffort),
// and every tie to the smaller id.
//
// One day of a country (aiLandTick): the template refit (every 180 days),
// then, daily at war or with a calendar war near (else every 10 days),
// garrisons, grouping, generals, fronts (or the peacetime line), attacks,
// training and building. A human's country runs only fronts and attacks,
// for its auto armies (spec §8.5), and the training when its automation
// hands that over (owner brief 2026-10-30).
//
// ww7 lane D: the AI commands by the army objective orders a player gives.
// A front's armies each get Defend with an explicit zone, the front's border
// cut geographically by their divisions (holdFront); too few divisions, or an
// enemy much stronger, and the line falls back to a shorter ring behind the
// border (shorterLine). Offensives (launch) are judged on the combined range
// of every division the side would commit against a region, then go in on an
// aggressive stance. A human's auto armies take the same road by their level:
// 1 holds only, 2 also attacks. ww81: a line that stands is attacked at one
// main sector a front (land/AiEffort, mainEffort), by army_direct.
import type { WwOrder } from "@openfront/engine-api/Schemas";
import { COUNTRIES, CountryTag } from "@openfront/engine-api/ww1936/Countries";
import { WwTechId } from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  BattalionId,
  type LandTerrain,
  MOVE_ADVANCE,
  MOVE_NONE,
  MOVE_RETREAT,
  MOVE_WALK,
  ROLE_ATTACK,
  Stance,
  SupportId,
  TPL_ARMOR_ANY,
  TPL_MOTOR_ANY,
  TPL_PARA_ANY,
  WW_AI_PREWAR_DAYS,
  WW_MAX_ARMY_DIVISIONS,
  WW_MAX_SUPPORT,
  WW_MAX_TARGETS,
  WW_ZONE_MAX,
} from "@openfront/engine-api/ww1936/LandTypes";
import { WW_INVASION_MAX_KM } from "@openfront/engine-api/ww1936/NavyTypes";
import { wwAiWarPlanDue } from "@openfront/engine-lib/ww1936/AiDifficulty";
import { dayOfDate } from "@openfront/engine-lib/ww1936/Calendar";
import { combatWidth } from "@openfront/engine-lib/ww1936/CombatRules";
import { splitFront } from "@openfront/engine-lib/ww1936/CommandRules";
import { queuedInRegion } from "@openfront/engine-lib/ww1936/EconomyChecks";
import {
  borderChain,
  splitByWeight,
} from "@openfront/engine-lib/ww1936/FrontRules";
import { WW_INITIAL_WARS } from "@openfront/engine-lib/ww1936/History";
import { WW_TARGET_REACH_EDGES } from "@openfront/engine-lib/ww1936/LandOrderChecks";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import { ALL_EDGES } from "@openfront/engine-lib/ww1936/SeaGraph";
import {
  presetById,
  PresetRole,
} from "@openfront/engine-lib/ww1936/TemplatePresets";
import {
  GEN1,
  groupStock,
  specialCap,
  templateStats,
} from "@openfront/engine-lib/ww1936/TemplateStats";
import { type AiPersonality, aiPersonality } from "../economy/AiEconomy";
import { convoysOf, effectiveLevel } from "../economy/Buildings";
import { queueBuild } from "../economy/Construction";
import type { CountryEconomy } from "../economy/WwEconomy";
import { seaReach } from "../navy/AiNavy";
import { navalPort, navalPortsOf } from "../navy/Ports";
import {
  AI_EFFORT_CAPITAL_VALUE,
  AI_EFFORT_PERIOD_DAYS,
  effortFed,
  effortRoom,
  effortTarget,
  enemyCuts,
  type EnemyCuts,
  P_AXIS,
  pickMainSector,
} from "./AiEffort";
import { meanWidthOf, zoneCap } from "./Fronts";
import { canServe } from "./GeneralsRun";
import { capitalRegion } from "./LandStartRun";
import { enemyDivisionsIn } from "./Movement";
import {
  armyRows,
  attackTarget,
  axisOf,
  enemyStrength,
  predictAttack,
  predictAttackRange,
  targetDistances,
} from "./Plans";
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
/**
 * The strength ratio lifts it only after this many days of that war. ww7 lane
 * F: 540 (was 240, the Phoney War's eight months): 1940's Allies, 300
 * divisions against Germany's 130, took it apart the month the rule lifted.
 */
export const AI_LIBERATION_LIFT_WAR_DAYS = 540;
/**
 * ww7 lane D item 3: the AI's offensives go in aggressive once decided. The
 * plan step judges a stance per region, with what stands there today; the
 * AI's own gates (the combined range against the region, ρ < 0.7 or org <
 * 40% stops, org ≥ 85% and readiness to start again) do the judging instead.
 */
const AI_STANCE: Stance = "aggressive";
/** (내 판단) An army attacks once this share of it stands on its front; and, massing on its axis, once this share of those going there has arrived. */
const FORMED_PM = 600;
/**
 * The ρ of a front with enemy regions across it and no defender in them.
 * ww7 lane D (revisited): it stands for "free" only where a ratio is read
 * (the stop rule, the liberation lift). The readiness gates no longer key on
 * its size: a real preview can run past 10,000, and an attack on defenders
 * must wait for its readiness all the same. Empty regions are told by name.
 */
const RATIO_FREE_PM = 10_000;
/**
 * ww7 lane D item 4 (내 판단 on the measure): a front is outnumbered when the
 * enemy's combat power within AI_FACING_EDGES of its border is over this
 * share of the power of the armies on it, %.
 */
export const AI_OUTNUMBERED_PCT = 150;
/**
 * ww7 lane F: the mid ratio from which an outnumbered front still attacks, ‰:
 * at the wide win table's 94 % a local chance is worth taking whatever the
 * whole front looks like (it was the pursuit bar, 2.0).
 */
export const AI_OUTNUMBERED_ATTACK_PM = 1600;
const AI_FACING_EDGES = 2;
/** ww7 lane D item 2: a fallback line lies at most this many layers behind the border. */
export const AI_SHORTEN_LAYERS = 3;
/** (내 판단) Divisions per line region under which an outnumbered front already shortens (else 1). */
export const AI_OUTNUMBERED_PER_REGION = 2;
/** (내 판단) A ring is worth the land only when it is this much shorter than the border, %: no retreat for a region or two. */
export const AI_SHORTEN_MIN_SAVE_PCT = 25;
/** (내 판단) A front on a fallback line goes back to the border at this share of the divisions the border asks, %: no daily swing. */
const AI_SHORTEN_BACK_PCT = 120;
/** (내 판단) A planned attack waiting for its army goes back to Defend when the range falls under this share of the bar, %. */
const AI_GATE_GIVE_UP_PCT = 80;
/** (내 판단) An army's sector stays while it is within this factor of its share of the line by divisions (and one region). */
const AI_ZONE_SLACK = 2;
/** ww7 lane F: for a front with nobody on it, a division more in an army counts as this many km farther: the smallest that can go. */
const AI_COVER_RANK_PER_DIVISION = 100_000;
/** Spec §14.5. */
const TRAIN_TARGET_MAJOR = 10;
const TRAIN_TARGET_MINOR = 3;
/**
 * ww7 lane F: a democracy at peace with no war in sight keeps this many in
 * training (else the major's or minor's target): the three years of peace gave
 * Britain 95 divisions and France 118 by 1939 against Germany's 127, and no
 * attack can pass a line that deep (the width holds the attackers, the org of
 * everyone behind counts). Their factories fill the stock for the day war comes.
 */
export const AI_DEMOCRACY_PEACE_TRAIN = 2;
const TRAIN_PER_DAY = 3;
const TRAIN_MEN_FACTOR = 2;
const TRAIN_FILL_PM = 500;
/** Spec §14.5: the template refit comes every 180 days. */
export const AI_REFIT_DAYS = 180;
/** Spec §14.2: armies of 1–3 divisions join a bigger one in their region; armies under 4 on one front merge. */
const SMALL_ARMY = 3;
const FRONT_MERGE_UNDER = 4;
/**
 * (내 판단) Armies cross the sea (spec §7.5) to a front at most this far.
 * Task 11: 6,000 km (was 3,000): Britain to Egypt (spec §7.5's example)
 * and Italy to Eritrea are 3,500–4,000 km on the map.
 */
export const AI_SEA_MAX_KM = 6000;
/**
 * ww79 (내 판단): at peace this share of the divisions, in percent, stays
 * home (in regions whose supply feeds them) instead of lining a border.
 */
export const AI_PEACE_HOME_PCT = 25;
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
  // ww7 (lane B2's open item): a fort of level 3+ halves the directions' extra width.
  const width = combatWidth(i.land, i.dirs, i.fort);
  const fort = Math.max(0, Math.min(5, i.fort));
  const cap = Math.floor(
    (AI_HOLD_WIDTHS * width * 10 * (100 - AI_HOLD_FORT_PCT * fort)) /
      (AI_HOLD_DIV_WIDTH * 100),
  );
  return Math.max(DEMAND_MIN, Math.min(d, cap));
}

/** The range an offensive has to clear, ‰. */
export interface AiGate {
  midPm: number;
  lowPm: number;
}

/**
 * ww7 lane D item 3 (design §7): the bars of an offensive on the combined
 * range against a region. The low bar is the personality's risk: how bad a
 * day it accepts. Minors stand halfway.
 */
export function aiGatePm(personality: AiPersonality): AiGate {
  switch (personality) {
    case "aggressor":
      // ww7 lane F: 1100 / 750 (design: 1300 / 900). On the wide win table
      // 1.1 is won six times in ten.
      return { midPm: 1100, lowPm: 750 };
    case "democracy":
      return { midPm: 1600, lowPm: 1100 };
    case "minor":
      return { midPm: 1450, lowPm: 1000 };
  }
}

/** A candidate line: its regions, its terrain (half regions) and the victory points it gives up. */
export interface AiRing {
  regions: number;
  terrain: number;
  vpLost: number;
}

/**
 * ww7 lane D item 2 (design §7): the best ring to fall back to (the index in
 * `rings`, nearest first), -1 to stay on the border. The score, smallest wins,
 * is regions − terrain + victory points given up, in half regions: a river, a
 * fort level step, a mountain or a city is worth half a region (so a long
 * ring of rivers does not beat a short one on open ground); a victory point
 * a whole one. A ring must be AI_SHORTEN_MIN_SAVE_PCT shorter than the border
 * and score better than holding it. Ties: the nearer ring.
 */
export function aiBestRing(
  border: { regions: number; terrain: number },
  rings: readonly AiRing[],
): number {
  const score = (r: AiRing) => 2 * r.regions - r.terrain + 2 * r.vpLost;
  let best = -1;
  let bestScore = score({ ...border, vpLost: 0 });
  rings.forEach((r, i) => {
    if (r.regions === 0) return;
    if (r.regions * 100 > border.regions * (100 - AI_SHORTEN_MIN_SAVE_PCT)) {
      return;
    }
    const s = score(r);
    if (s < bestScore) {
      best = i;
      bestScore = s;
    }
  });
  return best;
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
  /** ww7 lane D: the enemy outnumbers what stands here: its armies stay, whatever the demand says. */
  keep?: boolean;
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
 * ww7 lane D (내 판단): covered or not, it leaves its front only for one still
 * wanting at least half of it: a march across the country for a few tenths of
 * demand left its old sector empty for a month, and the next change sent it
 * back.
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
      if (a.current === e.id && (l >= 0 || e.keep === true)) return e.id;
      if (best < 0 || l > bestLeft || (l === bestLeft && e.id < best)) {
        best = e.id;
        bestLeft = l;
      }
    }
    if (
      a.current !== undefined &&
      best !== a.current &&
      (a.reach === undefined || a.reach.includes(a.current)) &&
      !seaPhase &&
      bestLeft * 2 < a.divisions * DEMAND_PER_ARMY_DIVISION &&
      fronts.some((e) => e.id === a.current)
    ) {
      return a.current;
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
  /** ww81 C3: the enemy divisions taking it would cut off. */
  cut?: number;
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
    Math.floor(
      (r.vp * (r.capital === true ? 200 : 100) + (r.cut ?? 0) * 100) /
        (r.dist + 1),
    );
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
  const preset = presetById(key);
  if (preset !== undefined) return PRESET_AI_ROLE[preset.role];
  for (const role of AI_ROLES) {
    if (ROLE_KEYS[role].includes(key)) return role;
  }
  return "infantry";
}

/** The AI's training role of each preset role (the armour presets all stand for "armor"). */
const PRESET_AI_ROLE: Readonly<Record<PresetRole, AiRole>> = {
  infantry: "infantry",
  elite: "infantry",
  artillery: "infantry",
  mountain: "mountain",
  marine: "mountain",
  para: "mountain",
  cavalry: "cavalry",
  motor: "motorized",
  light_armor: "armor",
  armor: "armor",
  heavy: "armor",
  td: "armor",
  spg: "armor",
  spaa: "armor",
  mixed: "armor",
};

/** How many of a role's templates the AI mixes: the medium tank division carries most of the armour. */
const PRESET_AI_WEIGHT: Readonly<Record<string, number>> = {
  pre_medium_armored: 4,
  pre_light_armored: 2,
  pre_mot_infantry: 3,
};

export interface AiTrainTemplate {
  id: number;
  key: string;
  /** Divisions of it in the field and in training (the AI mixes a role's templates by it). */
  have?: number;
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
  /** At peace with no war in sight (trainTarget). */
  atPeace?: boolean;
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

/** How many divisions an AI keeps in training. */
function trainTarget(
  major: boolean,
  personality: AiPersonality,
  atPeace: boolean,
): number {
  return atPeace && personality === "democracy"
    ? AI_DEMOCRACY_PEACE_TRAIN
    : major
      ? TRAIN_TARGET_MAJOR
      : TRAIN_TARGET_MINOR;
}

/**
 * Spec §14.5: the templates to queue today (at most 3): while fewer than
 * the target train (major 10, minor 3), the role furthest below its share
 * (ties: AI_ROLES order) whose template has men for two divisions left and
 * half a division's equipment in stock.
 */
export function aiTrainPlan(i: AiTrainInput): number[] {
  const target = trainTarget(i.major, i.personality, i.atPeace === true);
  const shares = roleShares(i);
  const counts = { ...i.counts };
  let manpower = i.manpower;
  let training = i.training;
  const tplOf = (role: AiRole): AiTrainTemplate | undefined => {
    if (role === "infantry") return i.templates[0];
    // The role's templates (1936 keys, presets): the one furthest below its weight that the stock and men allow (else any, so the gate below holds).
    const own = i.templates.filter(
      (t) => ROLE_KEYS[role].includes(t.key) || roleOfTemplate(t.key) === role,
    );
    const ok = (t: AiTrainTemplate) =>
      t.fillPm >= TRAIN_FILL_PM && manpower >= t.men * TRAIN_MEN_FACTOR;
    let best: AiTrainTemplate | undefined;
    let bestLoad = Infinity;
    for (const t of own.filter(ok)) {
      const load = (t.have ?? 0) / (PRESET_AI_WEIGHT[t.key] ?? 1);
      if (load < bestLoad) {
        best = t;
        bestLoad = load;
      }
    }
    return best ?? own[0];
  };
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
  // The lobby's difficulty: an Easy AI plans its daily days every 3 days.
  if (ai.daily && !ai.human && !wwAiWarPlanDue(land.ww.aiLevel, smallID, day)) {
    return;
  }
  ai.run();
}

/** A front: one enemy along one land-connected stretch of our side. */
interface Front {
  enemy: number;
  comp: number;
  border: number[];
  demand: number;
}

/** An axis region of a plan and the enemy region it goes for. */
interface AiLeg {
  f: number;
  x: number;
}

/** What an army would (or does) throw at the regions across its zone. */
interface AiStrike {
  a: Army;
  legs: AiLeg[];
  /** Enemy region -> the army's divisions that go for it. */
  rows: Map<number, number[]>;
}

/** The combined range against an enemy region; `free`: nobody defends it. */
interface AiRange {
  free: boolean;
  lowPm: number;
  midPm: number;
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
  /** It trains divisions: an AI country, or a human's with training automated. */
  readonly trains: boolean;
  private sideCache: SideView | null = null;
  private standingCache = new Map<number, Map<number, number[]>>();
  private offensiveCache: Set<number> | null = null;
  /** (front enemy × 65,536 + region) → today's preview and its width. */
  private regionRatioCache = new Map<
    number,
    { ratioPm: number; width: number }
  >();
  private capDistCache: Int32Array | null = null;
  /** armies()'s list, dropped by every order issued. */
  private armiesMemo: Army[] | null = null;
  /** bfsReach's distances (FAR between calls, reset over the reached ones). */
  private reachDist: Int32Array | null = null;
  private warsCache: readonly { a: number; b: number; sinceTick: number }[] =
    [];
  private warsRead = false;
  /** ww7 lane D item 4: today's armies on a front the enemy outnumbers. */
  private holding = new Set<number>();
  /** facingPower's memo. */
  private facingCache = new Map<number, number>();
  /** ww81 C1: today's armies on a main effort, and the region each goes for. */
  private effortOf = new Map<number, number>();
  /** ww81 C1: the others on a front judged for one: they walk and pursue, no more. */
  private offEffort = new Set<number>();
  /** ww81 C3: today's cuts of each enemy read (on the period's day or for a new sector). */
  private cutsMemo = new Map<number, EnemyCuts>();

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
    this.trains = !human || land.ww.autoOn(this.me, "training");
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
    this.armiesMemo = null;
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

  /**
   * `bfs` over a reused buffer: the regions reached, in BFS order, with
   * their distances in `reachDist` until `reachDone` resets them.
   */
  private bfsReach(
    sources: readonly number[],
    pass: (region: number) => boolean,
    maxDepth: number,
  ): number[] {
    const sc = this.land.scenario;
    this.reachDist ??= new Int32Array(sc.maxRegionId() + 1).fill(FAR);
    const dist = this.reachDist;
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
    return queue;
  }

  private reachDone(queue: readonly number[]): void {
    for (const r of queue) this.reachDist![r] = FAR;
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
    if (this.armiesMemo !== null) return this.armiesMemo;
    const all = this.land
      .armiesOf(this.me)
      .filter(
        (a) =>
          a.order.kind !== "invade" &&
          !paraArmy(this.land, a) &&
          a.order.kind !== "garrison" &&
          a.volunteerFor === 0,
      );
    this.armiesMemo = this.human ? all.filter((a) => a.auto) : all;
    return this.armiesMemo;
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
    if (this.trains) this.train(garrisons);
    if (!this.human) this.build(enemies);
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
    // Merges only remove armies and grow others, so one list serves the
    // whole pass; `free` drops those merged away.
    const all = this.armies().filter(
      (a) => !garrisons.has(a.id) && a.order.kind !== "paradrop",
    );
    const free = () => all.filter((a) => land.armies.has(a.id));
    // (1) A small army joins the lowest-numbered army at least its size in its region.
    for (const a of free()) {
      if (!land.armies.has(a.id)) continue;
      const n = a.divisions.length;
      if (n === 0 || n > SMALL_ARMY) continue;
      if (a.order.kind === "plan" && a.order.executing) continue;
      const here = land.armyRegion(a);
      const into = all.find(
        (b) =>
          b.id !== a.id &&
          land.armies.has(b.id) &&
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
        // ww7 lane D: zones no longer overlap: the same stretch, near each other.
        const c = this.armyComp(a);
        if (c < 0 || this.armyComp(b) !== c) continue;
        const km = land.scenario.regionKm(
          land.armyRegion(a),
          land.armyRegion(b),
        );
        if (km > AI_RAIL_MIN_KM) continue;
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
      // P6 (spec §4.3, lane D): never a field marshal.
      .filter((g) => g.army === 0 && !g.fm && canServe(this.land, g, this.day))
      .sort((a, b) => sum(b) - sum(a) || a.id - b.id);
    for (let i = 0; i < armies.length && i < free.length; i++) {
      this.issue({
        kind: "army_general",
        army: armies[i].id,
        general: free[i].id,
      });
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
    const ours = fronts.map(() => 0);
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
      if (current >= 0) ours[current] += this.armyPower(a);
    }
    const plan = aiFrontPlan({
      armies: input,
      enemies: fronts.map((f, i) => ({
        id: i,
        border: f.border,
        demand: f.demand,
        keep:
          this.atWar.includes(f.enemy) &&
          this.facingPower(f) * 100 > ours[i] * AI_OUTNUMBERED_PCT,
      })),
    });
    const assigned: Army[][] = fronts.map(() => []);
    for (const { army, enemy, anchor } of plan) {
      const a = land.armies.get(army);
      if (a === undefined || this.travelling(a)) continue;
      const f = fronts[enemy];
      if (this.armyComp(a) !== f.comp) {
        this.crossSea(a, f, anchor);
        continue;
      }
      const o = a.order;
      const there =
        (o.kind === "front" || o.kind === "plan") && o.enemy === f.enemy;
      if (!there && this.railTransit(a, anchor)) continue;
      assigned[enemy].push(a);
    }
    this.balanceFronts(fronts, assigned);
    fronts.forEach((f, i) => {
      if (assigned[i].length > 0) this.holdFront(f, assigned[i]);
    });
  }

  /**
   * ww7 lane D items 1 and 4: a front at war with fewer divisions than regions,
   * or outnumbered, draws the nearest army (one not attacking before one that
   * is) of another front of the same stretch that would keep a division for
   * each of its regions and stay clear of being outnumbered itself. The demand
   * plan knows only tenths of demand, and its armies stay where they are:
   * Germany's last armies chased Poland's remnant while the Allies massed in
   * the west. Worst front first (ties: the earlier). ww7 lane F (item 1: no
   * uncovered border with divisions to spare): a front with nobody on it takes
   * the smallest army another front can spare, however that front stands. With
   * every front outnumbered nobody could give: Niedersachsen and
   * Nordrhein-Westfalen stood unmanned for 954 days on one seed.
   */
  private balanceFronts(fronts: readonly Front[], assigned: Army[][]): void {
    const land = this.land;
    const sc = land.scenario;
    const war = fronts.map((f) => this.atWar.includes(f.enemy));
    const theirs = fronts.map((f, i) => (war[i] ? this.facingPower(f) : 0));
    const power = assigned.map((l) =>
      l.reduce((n, a) => n + this.armyPower(a), 0),
    );
    const divs = assigned.map((l) =>
      l.reduce((n, a) => n + a.divisions.length, 0),
    );
    const clear = (i: number, p: number) =>
      theirs[i] * 100 <= p * AI_OUTNUMBERED_PCT;
    const lacks = (i: number) =>
      war[i] && (divs[i] < fronts[i].border.length || !clear(i, power[i]));
    const order = fronts
      .map((_, i) => i)
      .filter(lacks)
      .sort(
        (x, y) =>
          theirs[y] * 100 -
            power[y] * AI_OUTNUMBERED_PCT -
            (theirs[x] * 100 - power[x] * AI_OUTNUMBERED_PCT) || x - y,
      );
    for (const i of order) {
      const to = fronts[i].border[0];
      while (lacks(i)) {
        let from = -1;
        let pick: Army | null = null;
        let pickRank = Infinity;
        fronts.forEach((g, j) => {
          if (j === i || g.comp !== fronts[i].comp || !war[j]) return;
          for (const a of assigned[j]) {
            if (divs[j] - a.divisions.length < g.border.length) continue;
            const empty = divs[i] === 0;
            if (!empty && !clear(j, power[j] - this.armyPower(a))) continue;
            const busy = a.order.kind === "plan" && a.order.executing;
            const km = sc.regionKm(land.armyRegion(a), to);
            const rank =
              km +
              (empty ? a.divisions.length * AI_COVER_RANK_PER_DIVISION : 0) +
              (busy ? 1 << 24 : 0);
            if (rank < pickRank) {
              from = j;
              pick = a;
              pickRank = rank;
            }
          }
        });
        if (pick === null) break;
        const moved: Army = pick;
        assigned[from] = assigned[from].filter((a) => a !== moved);
        assigned[i].push(moved);
        const p = this.armyPower(moved);
        power[from] -= p;
        power[i] += p;
        divs[from] -= moved.divisions.length;
        divs[i] += moved.divisions.length;
      }
    }
    for (const list of assigned) list.sort((a, b) => a.id - b.id);
  }

  /**
   * An executing army an outnumbered front lets go on: one running over a
   * broken enemy, or (ww7 lane F) one in a battle: the stop rules judge that,
   * and calling it off because the ratio dipped under the pursuit bar threw
   * away battles nearly won (41 against 18, the defenders' line at 21 %).
   */
  private pressing(a: Army): boolean {
    if (this.strikeRatio(a) >= AI_PURSUIT_RATIO_PM) return true;
    const t = this.land.divisions;
    return armyRows(this.land, a).some(
      (r) => t.battle[r] !== 0 && t.role[r] === ROLE_ATTACK,
    );
  }

  /**
   * ww7 lane D items 1, 2, 4: a front's armies, on land, each take a stretch
   * of what the front has to hold: the border, or a shorter ring behind it
   * when there are too few divisions (fewer than the border's regions; an
   * outnumbered front asks AI_OUTNUMBERED_PER_REGION of them, and stops its
   * attacks unless it is running over a broken enemy). The stretches run in
   * order along the border, in proportion to the armies' divisions, so with a
   * division for every region no border region stays uncovered.
   */
  private holdFront(f: Front, armies: readonly Army[]): void {
    const atWar = this.atWar.includes(f.enemy);
    let ours = 0;
    for (const a of armies) ours += this.armyPower(a);
    const outnumbered =
      atWar && this.facingPower(f) * 100 > ours * AI_OUTNUMBERED_PCT;
    if (outnumbered) for (const a of armies) this.holding.add(a.id);
    const { border, shared } = this.ourBorder(f);
    let divisions = 0;
    let attacking = false;
    let pursuing = false;
    for (const a of armies) {
      divisions += a.divisions.length;
      if (a.order.kind === "plan" && a.order.executing) {
        attacking = true;
        if (this.pressing(a)) pursuing = true;
      }
    }
    // An offensive of ours gives no ground while it is not outnumbered, and
    // a human's manual armies keep their line: the auto ones stay beside them.
    const mayShorten =
      atWar &&
      !shared &&
      (outnumbered ? !pursuing : !attacking && !this.offensive(f.enemy));
    const ring = mayShorten
      ? this.shorterLine(f, armies, divisions, outnumbered)
      : null;
    const line = ring ?? border;
    const judged = atWar && ring === null && !outnumbered;
    const per = outnumbered ? AI_OUTNUMBERED_PER_REGION : 1;
    const reserve = atWar ? this.reserveOf(line, armies, per, judged) : null;
    const held = armies.filter((a) => a !== reserve);
    const zones =
      (judged ? this.mainEffort(f, line, held) : null) ??
      this.zonesOf(f, line, held);
    if (reserve !== null) this.postReserve(reserve, f, line);
    for (const a of held) {
      const o = a.order;
      const defend =
        ring !== null ||
        this.defendOnly(a) ||
        (outnumbered &&
          !(o.kind === "plan" && o.executing && this.pressing(a))) ||
        // An effort this army has left: its waiting plan goes.
        (this.offEffort.has(a.id) && o.kind === "plan" && !o.executing);
      this.giveZone(a, f, zones.get(a.id)!, defend);
      const x = this.effortOf.get(a.id);
      if (x !== undefined) this.aim(a, x);
    }
  }

  /**
   * ww81 C7: the army this front keeps back, when three or more stand on it and
   * the others still hold the line at `per` divisions a region: one on its way
   * or back there first, then on a front with a main effort (`judged`) the
   * smallest that isn't a shock army, as the effort wants those, and on any
   * other a shock army first, then the largest.
   */
  private reserveOf(
    line: readonly number[],
    armies: readonly Army[],
    per: number,
    judged: boolean,
  ): Army | null {
    if (armies.length < 3) return null;
    let total = 0;
    for (const a of armies) total += a.divisions.length;
    const onLine = new Set(line);
    const back = (a: Army) => {
      const o = a.order;
      if (o.kind === "front") {
        return o.zone.length === 1 && !onLine.has(o.zone[0]);
      }
      return this.lost(o.kind === "plan" ? o.targets[0] : 0);
    };
    const rank = (a: Army) =>
      (back(a) ? 0 : 2) + (this.shock(a) === judged ? 1 : 0);
    const size = (a: Army) => (judged ? 1 : -1) * a.divisions.length;
    const list = armies
      .filter((a) => {
        if (this.defendOnly(a)) return false;
        const o = a.order;
        const running = o.kind === "plan" && o.executing;
        return back(a) || !running;
      })
      .sort((a, b) => rank(a) - rank(b) || size(a) - size(b) || a.id - b.id);
    for (const a of list) {
      if (total - a.divisions.length >= line.length * per) return a;
    }
    return null;
  }

  /** An enemy holds `region`, which is our side's by right. */
  private lost(region: number): boolean {
    if (region === 0) return false;
    const land = this.land;
    return (
      land.isEnemy(this.me, land.controller[region]) &&
      land.sameSide(this.me, land.ww.politics.legalOwner[region])
    );
  }

  /**
   * ww81 C7: the reserve stands behind the middle of the line; when the enemy
   * has taken a region of ours next to the line (most points first, then the
   * smaller id) it goes for it on the usual gate, and walks back afterwards.
   */
  private postReserve(a: Army, f: Front, line: readonly number[]): void {
    const land = this.land;
    const sc = land.scenario;
    let target = 0;
    const vp = (r: number) => sc.region(r)?.vp ?? 0;
    for (const r of line) {
      for (const e of sc.edgesOf(r)) {
        const x = e.to;
        if (land.controller[x] !== f.enemy || !this.lost(x)) continue;
        if (
          target === 0 ||
          vp(x) > vp(target) ||
          (vp(x) === vp(target) && x < target)
        ) {
          target = x;
        }
      }
    }
    this.offEffort.add(a.id);
    if (target === 0) {
      this.giveZone(a, f, [this.behindLine(f, line)], true);
      return;
    }
    const near = line.filter((r) => sc.edgeBetween(r, target) >= 0);
    this.giveZone(a, f, near, false);
    this.joinEffort(a, target);
    this.aim(a, target);
  }

  /** The region of ours behind the line's middle, nearest our capital; the middle itself with none. */
  private behindLine(f: Front, line: readonly number[]): number {
    const chain = borderChain(this.land, this.me, f.enemy, line);
    const mid = chain[Math.floor(chain.length / 2)];
    const onLine = new Set(line);
    const comp = this.comp();
    const dist = this.capDist();
    let best = mid;
    let bestDist = FAR;
    for (const e of this.land.scenario.edgesOf(mid)) {
      const r = e.to;
      if (onLine.has(r) || comp[r] !== f.comp) continue;
      if (dist[r] < bestDist || (dist[r] === bestDist && r < best)) {
        best = r;
        bestDist = dist[r];
      }
    }
    return best;
  }

  /**
   * ww81 C1: the front's main effort. Its sector's zone (our line regions next
   * to the sector) goes to the armies with armour first, then the largest, as
   * long as those left keep a division for each other region of the line; they
   * share out the rest and send what they can spare to the sector too. With
   * too few to spare, the zones stay as they are and the armies whose zone
   * touches the sector go for it, spare divisions only.
   * Null: the plain zones. A human's auto armies count, those on 수비 자동 hold.
   */
  private mainEffort(
    f: Front,
    line: readonly number[],
    armies: readonly Army[],
  ): Map<number, number[]> | null {
    const land = this.land;
    const sc = land.scenario;
    for (const a of armies) this.offEffort.add(a.id);
    const sector = this.sectorOf(f, line, armies);
    if (sector === 0) return null;
    const near = line.filter((r) => sc.edgeBetween(r, sector) >= 0);
    const rest = line.filter((r) => sc.edgeBetween(r, sector) < 0);
    const running = (a: Army) =>
      a.order.kind === "plan" &&
      a.order.executing &&
      effortTarget(a.order) === sector;
    const rank = (a: Army) => (running(a) ? 0 : 2) + (this.shock(a) ? 0 : 1);
    const ranked = armies
      .filter((a) => !this.defendOnly(a))
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          b.divisions.length - a.divisions.length ||
          a.id - b.id,
      );
    let left = 0;
    for (const a of armies) left += a.divisions.length;
    // C6: no more than the sector feeds; those over it stay on the line.
    const room = this.roomAt(near, this.supplyUnit(ranked));
    const chosen = new Set<Army>();
    let on = 0;
    for (const a of ranked) {
      if (!running(a)) {
        if (left - a.divisions.length < rest.length) continue;
        if (on > 0 && on >= room) continue;
      }
      chosen.add(a);
      left -= a.divisions.length;
      on += a.divisions.length;
    }
    const others = armies.filter((a) => !chosen.has(a));
    if (chosen.size === 0 || (others.length === 0 && rest.length > 0)) {
      const zones = this.zonesOf(f, line, armies);
      for (const a of ranked) {
        if (!zones.get(a.id)!.some((r) => near.includes(r))) continue;
        this.joinEffort(a, sector);
      }
      return zones;
    }
    for (const a of chosen) this.joinEffort(a, sector);
    const zones =
      others.length > 0 && rest.length > 0
        ? this.zonesOf(f, rest, others)
        : new Map<number, number[]>();
    for (const a of chosen) zones.set(a.id, [...near]);
    // Whoever holds the rest keeps a division a region; its spare joins in.
    for (const a of others) {
      const zone = zones.get(a.id) ?? [];
      const wide = [...new Set([...zone, ...near])];
      zones.set(a.id, zone.length === 0 ? [...near] : zone);
      if (this.defendOnly(a) || wide.length > WW_ZONE_MAX) continue;
      if (a.divisions.length <= zone.length || on >= room) continue;
      zones.set(a.id, wide);
      this.joinEffort(a, sector);
      on += a.divisions.length - zone.length;
    }
    return zones;
  }

  /** A division's supply use among `armies`, milli (armour asks more). */
  private supplyUnit(armies: readonly Army[]): number {
    let use = 0;
    let n = 0;
    for (const a of armies) {
      for (const r of armyRows(this.land, a)) {
        use += this.land.supplyBaseOf(r);
        n++;
      }
    }
    return n === 0 ? 1 : Math.max(1, Math.floor(use / n));
  }

  /** C6: the divisions `regions` feed at `unit`. */
  private roomAt(regions: readonly number[], unit: number): number {
    const supply = regions.map((r) => this.land.supplyMilli[r]);
    return effortRoom(supply, unit);
  }

  private joinEffort(a: Army, sector: number): void {
    this.effortOf.set(a.id, sector);
    this.offEffort.delete(a.id);
  }

  /** Motorized and armoured divisions are a third of the army or more (the shock armies of ww80 section 5). */
  private shock(a: Army): boolean {
    const rows = armyRows(this.land, a);
    let n = 0;
    for (const r of rows) {
      const flags = this.land.baseStatsOf(r).flags;
      if ((flags & (TPL_ARMOR_ANY | TPL_MOTOR_ANY)) !== 0) n++;
    }
    return n > 0 && n * 3 >= rows.length;
  }

  /**
   * The front's sector: the one a direct attack runs on; else, between the
   * period's days, the one the armies wait on (their plans are all the memory
   * there is: a restored game reads the same); else a new choice.
   */
  private sectorOf(
    f: Front,
    line: readonly number[],
    armies: readonly Army[],
  ): number {
    const land = this.land;
    const sc = land.scenario;
    let waiting = 0;
    for (const a of armies) {
      const x = effortTarget(a.order);
      if (x === 0 || a.order.enemy !== f.enemy) continue;
      if (land.controller[x] !== f.enemy) continue;
      if (!line.some((r) => sc.edgeBetween(r, x) >= 0)) continue;
      if (a.order.executing) return x;
      if (waiting === 0) waiting = x;
    }
    if (waiting !== 0 && !this.effortDue()) return waiting;
    return this.pickSector(f, line, armies, waiting);
  }

  /** The period's day of this country: the sectors and the cuts are looked at again. */
  private effortDue(): boolean {
    return (this.day + this.me) % AI_EFFORT_PERIOD_DAYS === 0;
  }

  /**
   * ww81 C3: what cutting `enemy`'s land does, from the map alone: control and
   * the divisions the AI already reads, not the encircled flag (fog). Sea
   * supply is not in it, so it is an estimate, good enough for aiming.
   */
  private cutsOf(enemy: number): EnemyCuts {
    const memo = this.cutsMemo.get(enemy);
    if (memo !== undefined) return memo;
    const land = this.land;
    const sc = land.scenario;
    const regions = land.econ
      .regionsOf(enemy)
      .filter((r) => land.controller[r] === enemy)
      .sort((a, b) => a - b);
    const cuts = enemyCuts(
      regions,
      land.ww.capitalRegion(enemy),
      (r) => sc.edgesOf(r).map((e) => e.to),
      (r) => enemyDivisionsIn(land, this.me, r),
    );
    this.cutsMemo.set(enemy, cuts);
    return cuts;
  }

  /** C3 rule 3: `x` is a pocket of `enemy`, seen on the period's day. */
  private inPocket(enemy: number, x: number): boolean {
    return this.effortDue() && this.cutsOf(enemy).pocket.has(x);
  }

  /** Rule 1 of C1, on what stands across `line` today (land/AiEffort). 0: nobody to attack. */
  private pickSector(
    f: Front,
    line: readonly number[],
    armies: readonly Army[],
    waiting: number,
  ): number {
    const land = this.land;
    const sc = land.scenario;
    const across = new Set<number>();
    for (const r of line) {
      for (const e of sc.edgesOf(r)) {
        if (land.controller[e.to] === f.enemy) across.add(e.to);
      }
    }
    if (across.size === 0) return 0;
    const reach = this.targetRegions(
      line,
      f.enemy,
      this.ratioOver(f.enemy, across),
    );
    const { cut } = this.cutsOf(f.enemy);
    // The road on: a target deeper in counts for what stands in front of it.
    const pull = new Map<number, number>();
    const byId = new Map(reach.map((r) => [r.region, r]));
    for (const t of aiTargets({ regions: reach })) {
      const r = byId.get(t)!;
      const worth = r.vp + (r.capital ? AI_EFFORT_CAPITAL_VALUE : 0);
      if (worth === 0) continue;
      const dist = this.bfs(
        [t],
        (x) => land.isEnemy(this.me, land.controller[x]),
        WW_TARGET_REACH_EDGES,
      );
      for (const x of across) {
        if (dist[x] === 0 || dist[x] === FAR) continue;
        const v = Math.floor(worth / (dist[x] + 1));
        pull.set(x, Math.max(pull.get(x) ?? 0, v));
      }
    }
    // C6: the force meant for a sector is at least the largest army.
    const able = armies.filter((a) => !this.defendOnly(a));
    const unit = this.supplyUnit(able);
    const force = Math.max(0, ...able.map((a) => a.divisions.length));
    const fed = (x: number) =>
      effortFed(
        this.roomAt(
          line.filter((r) => sc.edgeBetween(r, x) >= 0),
          unit,
        ),
        force,
      );
    const regions = reach
      .filter(
        (r) =>
          r.dist === 1 &&
          enemyDivisionsIn(land, this.me, r.region) > 0 &&
          fed(r.region),
      )
      .map((r) => {
        const fort = effectiveLevel(land.econ, r.region, "fort");
        return {
          region: r.region,
          vp: r.vp,
          capital: r.capital,
          fort,
          width: combatWidth(sc.landOf(r.region), 1, fort),
          defence: enemyStrength(land, this.me, r.region),
          extra: (pull.get(r.region) ?? 0) + (cut.get(r.region) ?? 0),
        };
      });
    const period = Math.floor((this.day + this.me) / AI_EFFORT_PERIOD_DAYS);
    return pickMainSector(
      regions,
      wwRoll(land.ww.politics.seed, P_AXIS, this.me, period, f.enemy),
      waiting,
    );
  }

  /** The army's plan waits on `x`, unless it runs already (a walk finishes first). */
  private aim(a: Army, x: number): void {
    const o = a.order;
    if (o.kind === "plan" && (o.executing || o.targets[0] === x)) return;
    this.issue({
      kind: "army_plan",
      army: a.id,
      targets: [x],
      stance: AI_STANCE,
    });
  }

  /**
   * ww7 lane D item 1: who holds what of `line`. The regions an army of the
   * front holds stay its own; a region new on the line goes to the army
   * holding the region nearest it along the chain: an army keeps to its sector
   * while the front moves, and its divisions do not cross the country because
   * the border changed by a region. When that fits the armies' sizes badly
   * (AI_ZONE_SLACK; a new army; a division short for a region with another
   * army to spare), or the line is new, the chain is cut anew: armies in the
   * order they stand along it, stretches by their divisions (the split the
   * army groups' front uses).
   */
  private zonesOf(
    f: Front,
    line: readonly number[],
    armies: readonly Army[],
  ): Map<number, number[]> {
    const chain = borderChain(this.land, this.me, f.enemy, line);
    const at = new Map(chain.map((r, i) => [r, i]));
    const zones = new Map<number, number[]>(armies.map((a) => [a.id, []]));
    const owner = new Array<number>(chain.length).fill(0);
    // The explicit zones first, then (a plan just done) what an automatic one holds.
    for (const auto of [false, true]) {
      for (const a of armies) {
        const o = a.order;
        if (o.enemy !== f.enemy || (o.kind !== "front" && o.kind !== "plan")) {
          continue;
        }
        if ((o.zone.length === 0) !== auto) continue;
        for (const r of auto ? a.front : o.zone) {
          const i = at.get(r);
          if (i !== undefined && owner[i] === 0) owner[i] = a.id;
        }
      }
    }
    // Along the chain from each holder, both ways: the nearest takes what is new.
    const held = owner.some((id) => id !== 0);
    if (held) {
      const dist = owner.map((id) => (id !== 0 ? 0 : FAR));
      const by = [...owner];
      for (let pass = 0; pass < 2; pass++) {
        const step = pass === 0 ? 1 : -1;
        for (
          let i = pass === 0 ? 1 : chain.length - 2;
          i >= 0 && i < chain.length;
          i += step
        ) {
          const d = dist[i - step] + 1;
          if (d < dist[i]) {
            dist[i] = d;
            by[i] = by[i - step];
          }
        }
      }
      by.forEach((id, i) => zones.get(id)!.push(chain[i]));
    }
    let divisions = 0;
    for (const a of armies) divisions += a.divisions.length;
    const n = chain.length;
    const fits =
      held &&
      armies.every((a) => {
        const z = zones.get(a.id)!.length;
        const d = a.divisions.length;
        if (z === 0 && n >= armies.length) return false;
        if (divisions >= n && z > d) return false;
        // Within the slack of its share (share = n × d / divisions), ±1 region.
        return (
          z * divisions <= AI_ZONE_SLACK * n * d + divisions &&
          AI_ZONE_SLACK * z * divisions + divisions >= n * d
        );
      });
    if (!fits) {
      const order = this.alongChain(armies, chain);
      const parts = splitFront(
        chain,
        order.map((a) => a.divisions.length),
      );
      order.forEach((a, i) => zones.set(a.id, parts[i]));
    }
    // More armies than regions: one left without a region stands with the others.
    armies.forEach((a, i) => {
      if (zones.get(a.id)!.length > 0) return;
      zones.set(a.id, [
        chain[Math.floor(((2 * i + 1) * n) / (2 * armies.length))],
      ]);
    });
    return zones;
  }

  /** ww7 lane D item 5: a human's army on 수비 자동: it never attacks. */
  private defendOnly(a: Army): boolean {
    return this.human && a.autoLevel < 2;
  }

  /**
   * The regions of front `f` this country's armies have to hold: not an
   * ally's region with its own divisions in it, nor (a human) one its manual
   * armies hold. `shared`: a human's manual army holds part of the front.
   * All taken: the whole border (they stand beside the others).
   */
  private ourBorder(f: Front): { border: number[]; shared: boolean } {
    const land = this.land;
    const t = land.divisions;
    const manual = new Set<number>();
    if (this.human) {
      for (const b of land.armiesOf(this.me)) {
        if (b.auto || (b.order.kind !== "front" && b.order.kind !== "plan")) {
          continue;
        }
        for (const r of b.front) manual.add(r);
      }
    }
    let shared = false;
    const border = f.border.filter((r) => {
      if (manual.has(r)) {
        shared = true;
        return false;
      }
      if (land.controller[r] === this.me) return true;
      return !land
        .rowsIn(r)
        .some((x) => t.owner[x] !== this.me && t.mode[x] === MOVE_NONE);
    });
    return { border: border.length > 0 ? border : f.border, shared };
  }

  /** An army's combat power (what the outnumbered test weighs): its divisions' attack, defence and breakthrough. */
  private armyPower(a: Army): number {
    let n = 0;
    for (const r of armyRows(this.land, a)) n += this.divisionPower(r);
    return n;
  }

  private divisionPower(row: number): number {
    const s = this.land.statsOf(row);
    return s.soft + s.hard + s.def + s.brk;
  }

  /**
   * ww7 lane D item 4: the power of the enemy's side standing or walking in
   * `f.enemy`'s regions within AI_FACING_EDGES of front `f` (once a day per
   * front).
   */
  private facingPower(f: Front): number {
    const key = f.enemy * 65_536 + f.comp;
    const known = this.facingCache.get(key);
    if (known !== undefined) return known;
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const seen = new Set<number>();
    let layer: readonly number[] = f.border;
    for (let d = 0; d < AI_FACING_EDGES; d++) {
      const next: number[] = [];
      for (const u of layer) {
        for (const e of sc.edgesOf(u)) {
          if (seen.has(e.to) || land.controller[e.to] !== f.enemy) continue;
          seen.add(e.to);
          next.push(e.to);
        }
      }
      layer = next;
    }
    let theirs = 0;
    for (const x of seen) {
      for (const r of land.rowsIn(x)) {
        const m = t.mode[r];
        if (m !== MOVE_NONE && m !== MOVE_WALK) continue;
        if (land.sameSide(land.fightOwner(r), f.enemy)) {
          theirs += this.divisionPower(r);
        }
      }
    }
    this.facingCache.set(key, theirs);
    return theirs;
  }

  /** A line region's terrain, half regions: mountain or city, fort (more from level 3), every way in over a river. */
  private lineTerrain(r: number, ahead: (x: number) => boolean): number {
    const sc = this.land.scenario;
    const kind = sc.landOf(r);
    let s = kind === "mountain" || kind === "urban" ? 1 : 0;
    const fort = effectiveLevel(this.land.econ, r, "fort");
    if (fort >= 1) s++;
    if (fort >= 3) s++;
    let any = false;
    let river = true;
    for (const e of sc.edgesOf(r)) {
      if (!ahead(e.to)) continue;
      any = true;
      if (sc.edge(e.edge).river === 0) river = false;
    }
    return any && river ? s + 1 : s;
  }

  /**
   * ww7 lane D item 2: the ring to hold instead of the border, ascending, or
   * null to hold the border. A fallback line already held stays (its regions
   * all ours) until the divisions could man the border with room to spare, so
   * the army does not swing with every region the enemy walks into; then a
   * ring is chosen only with too few divisions for the border (aiBestRing).
   * The state is the armies' own zones: nothing else is remembered.
   */
  private shorterLine(
    f: Front,
    armies: readonly Army[],
    divisions: number,
    outnumbered: boolean,
  ): number[] | null {
    const land = this.land;
    const sc = land.scenario;
    const comp = this.comp();
    const onBorder = new Set(f.border);
    const per = outnumbered ? AI_OUTNUMBERED_PER_REGION : 1;
    const held = new Set<number>();
    for (const a of armies) {
      if (a.order.kind !== "front" || a.order.enemy !== f.enemy) continue;
      for (const r of a.order.zone) held.add(r);
    }
    const heldList = [...held].sort((a, b) => a - b);
    const onRing =
      heldList.some((r) => !onBorder.has(r)) &&
      heldList.every((r) => this.ours(r));
    const asks = f.border.length * per;
    if (
      onRing ? divisions * 100 >= asks * AI_SHORTEN_BACK_PCT : divisions >= asks
    ) {
      return null;
    }
    if (onRing) return heldList;
    const dist = this.bfs(
      f.border,
      (r) => comp[r] === f.comp,
      AI_SHORTEN_LAYERS,
    );
    const rings: number[][] = Array.from(
      { length: AI_SHORTEN_LAYERS + 1 },
      () => [],
    );
    const vpAt = new Array<number>(AI_SHORTEN_LAYERS + 1).fill(0);
    for (const r of this.side().regions) {
      const d = dist[r];
      if (d === FAR || comp[r] !== f.comp) continue;
      rings[d].push(r);
      vpAt[d] += sc.region(r)?.vp ?? 0;
    }
    const terrainOf = (k: number) => {
      const ahead = (x: number) =>
        k === 0 ? land.controller[x] === f.enemy : dist[x] === k - 1;
      let s = 0;
      for (const r of rings[k]) s += this.lineTerrain(r, ahead);
      return s;
    };
    const candidates: AiRing[] = [];
    let vpLost = 0;
    for (let k = 1; k <= AI_SHORTEN_LAYERS; k++) {
      vpLost += vpAt[k - 1];
      candidates.push({
        regions: rings[k].length,
        terrain: rings[k].length === 0 ? 0 : terrainOf(k),
        vpLost,
      });
    }
    const best = aiBestRing(
      { regions: f.border.length, terrain: terrainOf(0) },
      candidates,
    );
    return best < 0 ? null : rings[best + 1];
  }

  /**
   * The armies in the order they stand along `chain`: by the mean place on it
   * of the chain region nearest each of their divisions (ties: smaller id).
   */
  private alongChain(
    armies: readonly Army[],
    chain: readonly number[],
  ): Army[] {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const nearest = new Map<number, number>();
    const placeOf = (region: number) => {
      let p = nearest.get(region);
      if (p !== undefined) return p;
      p = 0;
      let bestKm = Infinity;
      chain.forEach((r, i) => {
        const km = sc.regionKm(region, r);
        if (km < bestKm) {
          bestKm = km;
          p = i;
        }
      });
      nearest.set(region, p);
      return p;
    };
    const place = new Map<number, number>();
    for (const a of armies) {
      const rows = armyRows(land, a);
      let sum = 0;
      for (const r of rows) sum += placeOf(t.region[r]);
      place.set(a.id, Math.floor((sum * 1000) / Math.max(1, rows.length)));
    }
    return [...armies].sort(
      (a, b) => place.get(a.id)! - place.get(b.id)! || a.id - b.id,
    );
  }

  /**
   * Army `a` holds `part` on front `f`. Orders only when something changes,
   * so its readiness stays: the zone alone when it is on this front already
   * (a plan stays a plan, unless it has to `defend`); else Defend, on the
   * border region nearest its zone, and the zone.
   */
  private giveZone(
    a: Army,
    f: Front,
    part: readonly number[],
    defend: boolean,
  ): void {
    const zone = [...part].sort((x, y) => x - y).slice(0, WW_ZONE_MAX);
    const o = a.order;
    const there =
      o.enemy === f.enemy &&
      (o.kind === "front" || (o.kind === "plan" && !defend));
    if (!there) {
      const anchor = this.nearestIn(f.border, zone[0]);
      const order: WwOrder = {
        kind: "army_front",
        army: a.id,
        anchor,
        enemy: f.enemy,
      };
      if (!this.issue(order)) return;
    }
    const now = a.order.zone;
    if (now.length === zone.length && now.every((r, i) => r === zone[i])) {
      return;
    }
    this.issue({ kind: "army_zone", army: a.id, regions: zone });
  }

  /** The region of `list` nearest `to` (itself when on it; ties: the smaller id). */
  private nearestIn(list: readonly number[], to: number): number {
    if (list.includes(to)) return to;
    const sc = this.land.scenario;
    let best = list[0];
    let bestKm = Infinity;
    for (const r of list) {
      const km = sc.regionKm(to, r);
      if (km < bestKm || (km === bestKm && r < best)) {
        best = r;
        bestKm = km;
      }
    }
    return best;
  }

  /**
   * Task 11 round 2 (내 판단): an army standing still farther than
   * AI_RAIL_MIN_KM from where it is sent takes the train there first (spec
   * §7.4), when a railway of our side leads to it: the Soviet armies in
   * the Far East walked three months to the Polish border in 1939. ww7 lane
   * D: wherever on its old zone it stands (the order check wants a railway
   * under each of its regions).
   * Its front comes the day after it arrives. False when it walks.
   */
  private railTransit(a: Army, to: number): boolean {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const rows = armyRows(land, a);
    if (rows.length === 0 || (land.econ.rail[to] ?? 0) < 1) return false;
    const here = land.armyRegion(a);
    if (here === to || sc.regionKm(here, to) <= AI_RAIL_MIN_KM) return false;
    const still = rows.every(
      (r) => t.mode[r] === MOVE_NONE && t.battle[r] === 0,
    );
    if (!still) return false;
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
   * Spec §14.3-5, ww79: no enemy: the armies are shared across our borders
   * by threat (each hostile neighbour weighs its divisions, plus one, split
   * over its border regions), only where a region's supply feeds at least
   * half an army; AI_PEACE_HOME_PCT of the divisions stay home, in regions
   * with room.
   * Armies already placed (there or on their way) keep their place while it
   * still has a share and room; the rest go to the border region most
   * short of its share, or to the nearest region with room.
   */
  private peacetime(garrisons: ReadonlySet<number>): void {
    const land = this.land;
    const sc = land.scenario;
    const mine = land.econ.regionsOf(this.me);
    // Threat of each neighbour that is a possible enemy, and its border size.
    const threat = new Map<number, number>();
    for (const n of land.econ.countryNeighbours(this.me)) {
      if (land.sameSide(this.me, n) || !this.fights(n)) continue;
      let d = 1;
      for (const a of land.armiesOf(n)) d += a.divisions.length;
      threat.set(n, d);
    }
    if (threat.size === 0) return;
    const edgesTo = new Map<number, number>();
    for (const r of mine) {
      for (const n of this.borderOwners(r, threat)) {
        edgesTo.set(n, (edgesTo.get(n) ?? 0) + 1);
      }
    }
    const share = new Map<number, number>();
    let shareSum = 0;
    for (const r of mine) {
      let w = 0;
      for (const n of this.borderOwners(r, threat)) {
        w += Math.floor((threat.get(n)! * 1000) / edgesTo.get(n)!);
      }
      if (w > 0) {
        share.set(r, w);
        shareSum += w;
      }
    }
    if (shareSum === 0) return;
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
    if (armies.length === 0) return;
    // A division's supply use, milli: the average of the armies' own.
    let useSum = 0;
    let divs = 0;
    for (const a of armies) {
      const rows = armyRows(land, a);
      if (rows.length === 0) continue;
      useSum += land.supplyBaseOf(rows[0]) * a.divisions.length;
      divs += a.divisions.length;
    }
    if (divs === 0) return;
    const unit = Math.max(1, Math.floor(useSum / divs));
    // Divisions each region can feed, less what the garrisons already use.
    const room = new Map<number, number>();
    for (const r of mine) {
      const fed = Math.floor(land.supplyMilli[r] / unit);
      if (fed > 0) room.set(r, fed);
    }
    for (const g of land.armiesOf(this.me)) {
      if (!garrisons.has(g.id)) continue;
      const at = land.armyRegion(g);
      const left = room.get(at);
      if (left !== undefined) room.set(at, left - g.divisions.length);
    }
    const home = Math.floor((divs * AI_PEACE_HOME_PCT) / 100);
    const border = divs - home;
    const placed = new Map<number, number>();
    let homeLoad = 0;
    const spot = new Map<number, number>();
    // An army fits where its region would feed at least half of it.
    const fits = (r: number, n: number): boolean =>
      ((room.get(r) ?? 0) - (placed.get(r) ?? 0)) * 2 >= n;
    const put = (a: Army, r: number): void => {
      const n = a.divisions.length;
      placed.set(r, (placed.get(r) ?? 0) + n);
      if (!share.has(r)) homeLoad += n;
      spot.set(a.id, r);
    };
    // Short of its share, scaled by shareSum: positive means room for more.
    const short = (r: number): number =>
      border * share.get(r)! - (placed.get(r) ?? 0) * shareSum;
    const rest: Army[] = [];
    for (const a of armies) {
      const here = land.armyRegion(a);
      const at = a.order.kind === "move" ? a.order.to : here;
      if (share.has(at) && short(at) > 0 && fits(at, a.divisions.length)) {
        put(a, at);
      } else rest.push(a);
    }
    const left: Army[] = [];
    for (const a of rest) {
      const here = land.armyRegion(a);
      const at = a.order.kind === "move" ? a.order.to : here;
      if (
        !share.has(at) &&
        homeLoad < home &&
        comp[at] >= 0 &&
        fits(at, a.divisions.length)
      ) {
        put(a, at);
      } else left.push(a);
    }
    for (const a of left) {
      const n = a.divisions.length;
      const here = land.armyRegion(a);
      let best = 0;
      let bestShort = 0;
      for (const [r] of share) {
        if (comp[r] !== comp[here] || !fits(r, n)) continue;
        const sh = short(r);
        if (sh > bestShort || (sh === bestShort && sh > 0 && r < best)) {
          best = r;
          bestShort = sh;
        }
      }
      if (best === 0) {
        let near = Infinity;
        for (const r of mine) {
          if (comp[r] !== comp[here] || share.has(r) || !fits(r, n)) continue;
          const km = sc.regionKm(here, r);
          if (km < near || (km === near && r < best)) {
            best = r;
            near = km;
          }
        }
      }
      if (best === 0) {
        // Nothing with room: it stays where it is.
        spot.set(a.id, here);
        continue;
      }
      put(a, best);
    }
    for (const a of armies) {
      const to = spot.get(a.id);
      if (to === undefined) continue;
      const here = land.armyRegion(a);
      if (comp[here] !== comp[to]) continue;
      if (a.order.kind === "move" && a.order.to === to) continue;
      if (a.order.kind === "idle" && here === to) continue;
      if (this.railTransit(a, to)) continue;
      this.issue({ kind: "army_move", army: a.id, region: to });
    }
  }

  /** The neighbours in `among` that control a region next to `r`, ascending, once each. */
  private borderOwners(
    r: number,
    among: ReadonlyMap<number, number>,
  ): number[] {
    const out: number[] = [];
    for (const e of this.land.scenario.edgesOf(r)) {
      const c = this.land.controller[e.to];
      if (among.has(c) && !out.includes(c)) out.push(c);
    }
    return out.sort((x, y) => x - y);
  }

  // ---- Attacks (spec §14.4) ----

  private attacks(): void {
    const land = this.land;
    const ready = new Map<number, Army[]>();
    for (const a of this.armies()) {
      if (!land.armies.has(a.id) || a.order.kind === "paradrop") continue;
      // ww7 lane D item 5: 수비 자동 never attacks, not even out of a pocket.
      if (this.defendOnly(a)) continue;
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
          const ratio = this.strikeRatio(a);
          if (ratio < STOP_RATIO_PM) return true;
          return (
            !fighting && org < AI_ATTACK_ORG_PM && ratio < AI_PURSUIT_RATIO_PM
          );
        };
        if (stop()) {
          // ww81 C1: a direct attack ends for good; Defend keeps the zone.
          if (o.direct === true) this.toDefend(a);
          else this.issue({ kind: "army_execute", army: a.id, on: false });
        }
        continue;
      }
      if (org < AI_ATTACK_ORG_PM || this.formedPm(a, rows) < FORMED_PM) {
        continue;
      }
      let list = ready.get(o.enemy);
      if (list === undefined) ready.set(o.enemy, (list = []));
      list.push(a);
    }
    for (const enemy of [...ready.keys()].sort((x, y) => x - y)) {
      this.launch(enemy, ready.get(enemy)!);
    }
  }

  /**
   * ww7 lane D item 3: the offensives of the day against `enemy`, from the
   * `ready` armies (fit and formed). Each enemy region across their zones is
   * judged on the combined range of every division that would go in: the
   * spare of each ready army next to it (those converging, from every zone
   * region touching it) and what is attacking it already. Of those that clear
   * the gate the one on the way to the armies' targets goes first (aiTargets:
   * the fewest edges to one, then a walk before a fight, the best range, the
   * most victory points, the smaller id), each army once. Whoever finds none
   * stays where it is; a planned attack that has lost its reason goes back
   * to Defend.
   */
  private launch(enemy: number, ready: readonly Army[]): void {
    const land = this.land;
    const sc = land.scenario;
    const fixed: AiStrike[] = [];
    for (const b of land.armiesOf(this.me)) {
      const o = b.order;
      if (o.kind === "plan" && o.executing && o.enemy === enemy) {
        fixed.push(this.strikeOf(b, this.legsOf(b)));
      }
    }
    interface Aims {
      targets: number[];
      allowed: ReadonlySet<number>;
      dist: Int32Array;
    }
    const aims = new Map<number, Aims>();
    for (const a of ready) {
      const regions = this.targetRegions(
        this.zoneOf(a),
        enemy,
        this.ratioOf(a, enemy),
      );
      if (regions.length === 0) continue;
      const targets = aiTargets({ regions });
      aims.set(a.id, {
        targets,
        allowed: new Set(regions.map((r) => r.region)),
        dist: targetDistances(land, a, targets),
      });
    }
    const vp = (r: number) => sc.region(r)?.vp ?? 0;
    const read = new Map<number, AiRange>();
    let rest = ready.filter((a) => aims.has(a.id));
    for (;;) {
      const next = new Map<number, AiStrike[]>();
      for (const a of rest) {
        const allowed = aims.get(a.id)!.allowed;
        const legs = new Map<number, AiLeg[]>();
        for (const f of this.zoneOf(a)) {
          for (const e of sc.edgesOf(f)) {
            if (!allowed.has(e.to)) continue;
            let l = legs.get(e.to);
            if (l === undefined) legs.set(e.to, (l = []));
            l.push({ f, x: e.to });
          }
        }
        for (const [x, l] of legs) {
          let list = next.get(x);
          if (list === undefined) next.set(x, (list = []));
          list.push(this.strikeOf(a, l));
        }
      }
      let best: AiStrike[] = [];
      let bestRange: AiRange | null = null;
      let bestX = 0;
      let bestNear = 0;
      for (const x of [...next.keys()].sort((p, q) => p - q)) {
        const tried = this.settle(x, next.get(x)!, fixed);
        if (!read.has(x)) read.set(x, tried.first);
        if (tried.live.length === 0) continue;
        let near = FAR;
        for (const s of tried.live) {
          near = Math.min(near, aims.get(s.a.id)!.dist[x]);
          // ww81 C1: a sector that stands goes before any walk.
          if (!tried.range.free && this.effortOf.get(s.a.id) === x) near = -1;
        }
        const r = tried.range;
        const mid = r.free ? Infinity : r.midPm;
        const had = bestRange === null ? -1 : bestRange.midPm;
        const hadMid = bestRange?.free === true ? Infinity : had;
        if (
          bestRange === null ||
          near < bestNear ||
          (near === bestNear &&
            (mid > hadMid || (mid === hadMid && vp(x) > vp(bestX))))
        ) {
          best = tried.live;
          bestRange = r;
          bestX = x;
          bestNear = near;
        }
      }
      if (bestRange === null) break;
      for (const s of best) {
        this.go(s, bestRange, aims.get(s.a.id)!.targets);
      }
      fixed.push(...best);
      rest = rest.filter((a) => !best.some((s) => s.a === a));
    }
    // A planned attack that has lost its reason goes back to Defend.
    const bar = aiGatePm(this.personality);
    for (const a of ready) {
      if (a.order.kind !== "plan" || !this.ripe(a, enemy, 0)) continue;
      if (fixed.some((s) => s.a === a) || this.effortOf.has(a.id)) continue;
      const r = read.get(a.order.targets[0]);
      if (r === undefined || r.midPm * 100 < bar.midPm * AI_GATE_GIVE_UP_PCT) {
        this.toDefend(a);
      }
    }
  }

  /**
   * The gate over `strikes` against region `x`, on top of what attacks it
   * already (`fixed`): an army that does not clear it goes out, and what is
   * left is judged again without its divisions, until everyone left clears it.
   */
  private settle(
    x: number,
    strikes: readonly AiStrike[],
    fixed: readonly AiStrike[],
  ): { live: AiStrike[]; range: AiRange; first: AiRange } {
    let live = [...strikes];
    const first = this.rangeAt(x, [...fixed, ...live]);
    let range = first;
    while (live.length > 0) {
      const now = range;
      const still = live.filter((s) => this.clears(s, now));
      if (still.length === live.length) break;
      live = still;
      range = this.rangeAt(x, [...fixed, ...live]);
    }
    return { live, range, first };
  }

  /** The zone an army holds (today's order, which the front catches up with this tick). */
  private zoneOf(a: Army): readonly number[] {
    return a.order.zone.length > 0 ? a.order.zone : a.front;
  }

  /**
   * ww7 lane D item 3: where an army's plan goes in: each axis region of its
   * zone facing its enemy and the enemy region it goes for (Plans.attackTarget,
   * the plan step's own choice).
   */
  private legsOf(a: Army): AiLeg[] {
    const land = this.land;
    const sc = land.scenario;
    const { enemy, targets } = a.order;
    const zone = this.zoneOf(a).filter((f) =>
      sc.edgesOf(f).some((e) => land.controller[e.to] === enemy),
    );
    if (zone.length === 0) return [];
    const dist = targetDistances(land, a, targets);
    const axis = axisOf(zone, targets.length > 0 ? dist : null);
    const legs: AiLeg[] = [];
    for (const f of axis) {
      const x = attackTarget(land, a, this.me, f, dist, false);
      if (x >= 0) legs.push({ f, x });
    }
    return legs;
  }

  /**
   * What army `a` throws at its legs: whoever stands on a leg's region (the
   * layout leaves those over the width there, and they attack from it), and
   * of the rest as many as the spare (every division free to go, but one for
   * each zone region off its axis) and the width let walk there.
   */
  private strikeOf(a: Army, legs: AiLeg[]): AiStrike {
    const land = this.land;
    const t = land.divisions;
    const sc = land.scenario;
    const rows = new Map<number, number[]>();
    const out = { a, legs, rows };
    if (legs.length === 0) return out;
    const xs = new Set(legs.map((l) => l.x));
    const free = armyRows(land, a).filter((r) => {
      const m = t.mode[r];
      if (m === MOVE_RETREAT || m === MOVE_ADVANCE) return false;
      return t.battle[r] === 0 || xs.has(t.battle[r]);
    });
    if (free.length === 0) return out;
    const axis = new Set(legs.map((l) => l.f));
    const off = Math.max(0, this.zoneOf(a).length - axis.size);
    const shares = splitByWeight(
      Math.max(legs.length, free.length - off),
      legs.map(() => 1),
    );
    const mean = meanWidthOf(land, free);
    const used = new Set<number>();
    const lists = legs.map((l) => {
      let list = rows.get(l.x);
      if (list === undefined) rows.set(l.x, (list = []));
      for (const r of free) {
        if (t.region[r] === l.f && t.mode[r] === MOVE_NONE && !used.has(r)) {
          used.add(r);
          list.push(r);
        }
      }
      return list;
    });
    legs.forEach((l, i) => {
      let dirs = 0;
      for (const e of sc.edgesOf(l.f)) {
        if (land.isEnemy(this.me, land.controller[e.to])) dirs++;
      }
      // ww81 C1: a direct attack lifts the layout's cap.
      let more = this.effortOf.has(a.id)
        ? shares[i]
        : Math.min(shares[i], zoneCap(land, l.f, dirs, mean));
      for (const r of free) if (t.region[r] === l.f) more--;
      for (const r of free) {
        if (more <= 0) break;
        if (used.has(r)) continue;
        used.add(r);
        lists[i].push(r);
        more--;
      }
    });
    return out;
  }

  /** The combined range against enemy region `x` of whatever of `strikes` goes for it. */
  private rangeAt(x: number, strikes: readonly AiStrike[]): AiRange {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    if (enemyDivisionsIn(land, this.me, x) === 0) {
      return { free: true, lowPm: 0, midPm: 0 };
    }
    const rows: number[] = [];
    const from = new Set<number>();
    for (const s of strikes) {
      for (const l of s.legs) if (l.x === x) from.add(l.f);
      const mine = s.rows.get(x);
      if (mine !== undefined) rows.push(...mine);
    }
    if (rows.length === 0) return { free: false, lowPm: 0, midPm: 0 };
    // The first division stands for its side (its edge, its readiness): one
    // that already stands next to the region, when there is one.
    const first = rows.findIndex((r) => sc.edgeBetween(t.region[r], x) >= 0);
    if (first > 0) [rows[0], rows[first]] = [rows[first], rows[0]];
    const p = predictAttackRange(land, rows, x, from.size);
    return { free: false, lowPm: p.lowPm, midPm: p.midPm };
  }

  /** The readiness gates (spec §14.4, Task 11): the war's own, and the floor a broken enemy (`midPm`) lifts. */
  private ripe(a: Army, enemy: number, midPm: number): boolean {
    if (a.planBp < READY_BP && this.warDays(enemy) < WAR_READY_DAYS) {
      return false;
    }
    return midPm >= AI_PURSUIT_RATIO_PM || a.planBp >= AI_REATTACK_READY_BP;
  }

  /** Nobody defends any enemy region across the army's zone. */
  private nobodyAcross(a: Army, enemy: number): boolean {
    const land = this.land;
    const sc = land.scenario;
    for (const f of this.zoneOf(a)) {
      for (const e of sc.edgesOf(f)) {
        if (
          land.controller[e.to] === enemy &&
          enemyDivisionsIn(land, this.me, e.to) > 0
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Strike `s` clears the gate on range `r`: the bars and its readiness; an
   * empty region wants the readiness too, unless nobody at all stands across
   * the army's zone (spec §7.7: it walks in at once). An outnumbered front
   * (item 4) walks nowhere and attacks only a broken enemy.
   */
  private clears(s: AiStrike, r: AiRange): boolean {
    const hold = this.holding.has(s.a.id);
    const enemy = s.a.order.enemy;
    // ww81 C1: an effort goes for its sector, and off it nobody attacks a
    // line that stands: walks and a broken enemy only.
    const aim = this.effortOf.get(s.a.id);
    const x = s.legs[0].x;
    const pocket = !r.free && this.inPocket(enemy, x);
    if (
      (aim !== undefined || this.offEffort.has(s.a.id)) &&
      aim !== x &&
      !r.free &&
      !pocket &&
      r.midPm < AI_PURSUIT_RATIO_PM
    ) {
      return false;
    }
    if (r.free) {
      if (hold) return false;
      return this.nobodyAcross(s.a, enemy) || this.ripe(s.a, enemy, 0);
    }
    const gate = aiGatePm(this.personality);
    // C3 rule 3: a pocket waits for no readiness, as a broken enemy doesn't.
    const floor = pocket ? AI_PURSUIT_RATIO_PM : r.midPm;
    if (!this.ripe(s.a, enemy, floor)) return false;
    return (
      r.midPm >= (hold ? AI_OUTNUMBERED_ATTACK_PM : gate.midPm) &&
      r.lowPm >= gate.lowPm
    );
  }

  /**
   * Strike `s` cleared the gate on range `r`: the army plans its region first
   * and its own `targets` beyond it (a region next to its zone would be an
   * attack of its own, without a gate; a walk leaves out those defended). Empty
   * land or a broken enemy: at once. Otherwise army_plan first, without
   * army_execute, so the spare walks to the axis, and army_execute the day the
   * army has massed there: an aggressive stance would throw in whoever is
   * there at any odds.
   */
  private go(s: AiStrike, r: AiRange, targets: readonly number[]): void {
    const land = this.land;
    const sc = land.scenario;
    const x = s.legs[0].x;
    const o = s.a.order;
    // ww81 C1: a line that stands takes the whole effort, massed; empty land
    // and a broken enemy go on as they always did.
    const pocket = !r.free && this.inPocket(o.enemy, x);
    if (
      this.effortOf.get(s.a.id) === x &&
      !r.free &&
      r.midPm < AI_PURSUIT_RATIO_PM
    ) {
      if (!pocket && !this.massed(s)) return;
      this.issue({
        kind: "army_direct",
        army: s.a.id,
        targets: [x],
        favorable: false,
        allIn: false,
        advance: false,
      });
      return;
    }
    const planned =
      o.kind === "plan" && o.targets[0] === x && !this.effortOf.has(s.a.id);
    if (planned) {
      const now =
        r.free || pocket || r.midPm >= AI_PURSUIT_RATIO_PM || this.massed(s);
      this.plan(s.a, o.targets, AI_STANCE, now);
      return;
    }
    const zone = this.zoneOf(s.a);
    const beyond = targets.filter(
      (t) =>
        t !== x &&
        !sc.edgesOf(t).some((e) => zone.includes(e.to)) &&
        (!r.free || enemyDivisionsIn(land, this.me, t) === 0),
    );
    this.plan(
      s.a,
      [x, ...beyond].slice(0, WW_MAX_TARGETS),
      AI_STANCE,
      r.free || pocket || r.midPm >= AI_PURSUIT_RATIO_PM,
    );
  }

  /** The divisions on their way to the army's axis have (mostly) arrived. */
  private massed(s: AiStrike): boolean {
    const t = this.land.divisions;
    const axis = new Set(s.legs.map((l) => l.f));
    let there = 0;
    let coming = 0;
    for (const r of armyRows(this.land, s.a)) {
      if (t.mode[r] === MOVE_NONE && axis.has(t.region[r])) there++;
      else if (t.mode[r] === MOVE_WALK && axis.has(t.dest[r])) coming++;
    }
    return coming === 0 || there * 1000 >= (there + coming) * FORMED_PM;
  }

  /** A plan that has lost its reason: Defend on the same zone; its readiness stays. */
  private toDefend(a: Army): void {
    const o = a.order;
    const zone = [...o.zone];
    const list = this.zoneOf(a);
    const anchor = list.includes(o.anchor) ? o.anchor : list[0];
    if (anchor === undefined) return;
    const order: WwOrder = {
      kind: "army_front",
      army: a.id,
      anchor,
      enemy: o.enemy,
    };
    if (!this.issue(order) || zone.length === 0) return;
    this.issue({ kind: "army_zone", army: a.id, regions: zone });
  }

  /** army_plan when the targets or the stance change, then (`execute`) execute. */
  private plan(
    a: Army,
    targets: number[],
    stance: Stance,
    execute = true,
  ): void {
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
    if (execute) this.issue({ kind: "army_execute", army: a.id, on: true });
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

  /**
   * Share of the divisions posted to the army's front that stand there, ‰.
   * ww7: those over a region's width wait in reserve with no post (the
   * layout): they neither stand on the front nor are on their way to it.
   */
  private formedPm(a: Army, rows: readonly number[]): number {
    const t = this.land.divisions;
    let n = 0;
    let posted = 0;
    for (const r of rows) {
      if (!a.front.includes(t.dest[r])) continue;
      posted++;
      if (t.mode[r] === MOVE_NONE && t.region[r] === t.dest[r]) n++;
    }
    return posted === 0 ? 0 : Math.floor((n * 1000) / posted);
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
    const me = this.me;
    const across = new Set<number>();
    for (const f of this.zoneOf(a)) {
      for (const e of sc.edgesOf(f)) {
        const c = land.controller[e.to];
        if (!land.isEnemy(me, c) || (enemy !== 0 && c !== enemy)) continue;
        across.add(e.to);
      }
    }
    if (across.size === 0) return 0;
    return this.ratioOver(a.order.enemy, across);
  }

  /**
   * ww7 lane D: ρ where an executing plan fights: the regions its axis goes
   * for and those it is attacking (its massed divisions stand there; a thin
   * rest of the zone says nothing). 0 with none.
   */
  private strikeRatio(a: Army): number {
    const t = this.land.divisions;
    const xs = new Set<number>();
    for (const l of this.legsOf(a)) xs.add(l.x);
    for (const r of armyRows(this.land, a)) {
      if (t.battle[r] !== 0 && t.role[r] === ROLE_ATTACK) xs.add(t.battle[r]);
    }
    return xs.size === 0 ? 0 : this.ratioOver(a.order.enemy, xs);
  }

  /** ρ over `regions`, by each region's combat width; no defender in any: RATIO_FREE_PM. */
  private ratioOver(enemy: number, regions: ReadonlySet<number>): number {
    let num = 0;
    let den = 0;
    for (const x of [...regions].sort((p, q) => p - q)) {
      const hit = this.ratioAt(enemy, x);
      if (hit.width === 0) continue;
      num += hit.ratioPm * hit.width;
      den += hit.width;
    }
    return den === 0 ? RATIO_FREE_PM : Math.floor(num / den);
  }

  /**
   * Task 11 (내 판단): the battle as it would be fought: every division of
   * ours standing on a front against the same enemy next to the enemy region
   * joins it, not only this army's (two armies on one sector attack
   * together; an army fronting another enemy does not), and (ww7 bands)
   * those attacking inside it. One preview per (front enemy, region) a day
   * (Task 11 round 2).
   */
  private ratioAt(
    enemy: number,
    x: number,
  ): { ratioPm: number; width: number } {
    const land = this.land;
    const sc = land.scenario;
    const t = land.divisions;
    const key = enemy * 65_536 + x;
    let hit = this.regionRatioCache.get(key);
    if (hit !== undefined) return hit;
    hit = { ratioPm: 0, width: 0 };
    if (enemyDivisionsIn(land, this.me, x) > 0) {
      const standing = this.frontStanding(enemy);
      const att: number[] = [];
      let dirs = 0;
      for (const e of sc.edgesOf(x)) {
        const here = (standing.get(e.to) ?? []).filter(
          (r) => t.battle[r] === 0 || t.battle[r] === x,
        );
        if (here.length > 0) dirs++;
        att.push(...here);
      }
      for (const r of land.rowsIn(x)) {
        if (t.owner[r] === this.me && t.battle[r] === x) att.push(r);
      }
      if (att.length > 0) {
        hit.width = combatWidth(
          sc.landOf(x),
          dirs,
          effectiveLevel(land.econ, x, "fort"),
        );
        hit.ratioPm = predictAttack(land, att, x).ratioPm;
      }
    }
    this.regionRatioCache.set(key, hit);
    return hit;
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
  private targetRegions(
    zone: readonly number[],
    enemy: number,
    ratioPm: number,
  ): AiTargetRegion[] {
    const land = this.land;
    const sc = land.scenario;
    const me = this.me;
    const reached = this.bfsReach(
      zone,
      (r) => land.isEnemy(me, land.controller[r]),
      WW_TARGET_REACH_EDGES,
    );
    const dist = this.reachDist!;
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
    const cands = reached.filter((id) => sc.region(id) !== undefined);
    cands.sort((p, q) => p - q);
    for (const id of cands) {
      const r = sc.region(id)!;
      const d = dist[id];
      if (d === 0 || d === FAR || land.controller[r.id] !== enemy) continue;
      // Liberation only: our own (a democracy: or its camp's) core regions
      // (P3 legal owner + core).
      if (coresOnly && !(ours(pol.legalOwner[r.id]) && pol.isCore(r.id))) {
        continue;
      }
      const cut = this.effortDue()
        ? (this.cutsOf(enemy).cut.get(r.id) ?? 0)
        : 0;
      regions.push({
        region: r.id,
        vp: r.vp,
        dist: d,
        capital: r.id === capital,
        ...(cut > 0 ? { cut } : {}),
      });
    }
    this.reachDone(reached);
    return regions;
  }

  /**
   * Task 11 round 2 (내 판단): a democracy's liberation-only rule against an
   * aggressor ends once that enemy's side holds our 1936 capital or that of
   * a major of our camp (Paris fallen: the Allies go for Germany; ww7 lane D:
   * Warsaw is not Paris, now that a Poland can fall in a month), from
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
      if (
        id !== this.me &&
        !(COUNTRIES[tag].major && land.ww.sameFaction(this.me, id))
      ) {
        continue;
      }
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
    const atPeace = this.atWar.length === 0 && this.imminent.length === 0;
    if (training >= trainTarget(this.major, this.personality, atPeace)) {
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
    const have = new Map<number, number>();
    const add = (tpl: number, n: number) => {
      have.set(tpl, (have.get(tpl) ?? 0) + n);
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
        have: have.get(tpl.id) ?? 0,
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
      atPeace,
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
   * when (내 판단) the stock already holds what
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
