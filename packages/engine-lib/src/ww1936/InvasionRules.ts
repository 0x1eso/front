// World War 1936 P4: naval invasion rules (P4 spec §11): capacity,
// preparation, the landing division's battle lines, shore bombardment and
// the order judge the army card and the engine share.
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CombatMods } from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_CONVOY_SPEED_KN,
  WW_EASY_INVASION_LOSS_AT_ZERO_PM,
  WW_EASY_INVASION_LOSS_CAP_PM,
  WW_EASY_INVASION_MARINE_PREP_DAYS,
  WW_EASY_INVASION_PREP_DAYS,
  WW_EASY_INVASION_SAFE_SUP_PM,
  WW_EASY_INVASION_SHORT_KM,
  WW_EASY_INVASION_SHORT_PREP_DAYS,
  WW_EASY_LANDING_BP,
  WW_EASY_LANDING_MARINE_BP,
  WW_INVASION_BASE_CAPACITY,
  WW_INVASION_MAX_KM,
  WW_INVASION_PREP_DAYS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { edgeTicks, moveNeed, regionDistances } from "./MoveRules";
import type { ScenarioIndex } from "./ScenarioIndex";

/** Spec §11.1: divisions one invasion may carry (10 + stat + landing craft 5 + 5). */
export function invasionCapacity(
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
): number {
  return (
    WW_INVASION_BASE_CAPACITY +
    stats.invasionCapacity +
    (techs.has("landing_craft_1") ? 5 : 0) +
    (techs.has("landing_craft_2") ? 5 : 0)
  );
}

/** Spec §11.2: the preparation's % (100 + stat − 20 per landing craft − 20 for an amphibious admiral, at least 10). */
function prepPct(
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
  amphibAdmiral: boolean,
): number {
  const lc =
    (techs.has("landing_craft_1") ? 1 : 0) +
    (techs.has("landing_craft_2") ? 1 : 0);
  return Math.max(
    10,
    100 + stats.invasionPrepPct - 20 * lc - (amphibAdmiral ? 20 : 0),
  );
}

/** Spec §11.2: preparation days (60 × (100 + stat − 20 per landing craft − 20 for an amphibious admiral) %, halved for marines). */
export function invasionPrepDays(
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
  allMarines: boolean,
  amphibAdmiral: boolean,
): number {
  const pct = prepPct(stats, techs, amphibAdmiral);
  const days = Math.ceil((WW_INVASION_PREP_DAYS * pct) / 100);
  return allMarines ? Math.ceil(days / 2) : days;
}

/**
 * Easy invasions (human countries): 20 days, 10 when every division has a
 * marine battalion, 5 over a short crossing (route ≤ 300 km) — times the
 * same % as the AI's (invasionPrepPct, landing craft, an amphibious
 * admiral), at least one day.
 */
export function easyInvasionPrepDays(
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
  allMarines: boolean,
  amphibAdmiral: boolean,
  routeKm: number,
): number {
  const base =
    routeKm <= WW_EASY_INVASION_SHORT_KM
      ? WW_EASY_INVASION_SHORT_PREP_DAYS
      : allMarines
        ? WW_EASY_INVASION_MARINE_PREP_DAYS
        : WW_EASY_INVASION_PREP_DAYS;
  const pct = prepPct(stats, techs, amphibAdmiral);
  return Math.max(1, Math.ceil((base * pct) / 100));
}

/**
 * Easy invasions: a day's loss ‰ at sea — spec §10.4's interception,
 * (500 − ours) / 500 × 10%, below 400‰ too (no turning back) — but never
 * past the crossing's cap: `lostPm` is what it lost so far.
 */
export function easyInterceptLossPm(
  ourSupPm: number,
  enemyPower: number,
  lostPm: number,
): number {
  if (enemyPower <= 0 || ourSupPm >= WW_EASY_INVASION_SAFE_SUP_PM) return 0;
  const day = Math.floor(
    ((WW_EASY_INVASION_SAFE_SUP_PM - Math.max(0, ourSupPm)) *
      WW_EASY_INVASION_LOSS_AT_ZERO_PM) /
      WW_EASY_INVASION_SAFE_SUP_PM,
  );
  return Math.max(0, Math.min(day, WW_EASY_INVASION_LOSS_CAP_PM - lostPm));
}

/** Metres a convoy sails a day: 12 knots × (100 + navalSpeedPct) %, at least 10% (spec §11.3). */
export function convoyMetresPerDay(navalSpeedPct: number): number {
  const pct = Math.max(10, 100 + navalSpeedPct);
  return Math.floor((WW_CONVOY_SPEED_KN * 1852 * 24 * pct) / 100);
}

/** Days at sea for `km`: at least one (spec §11.3). */
export function crossingDays(km: number, navalSpeedPct: number): number {
  return Math.max(
    1,
    Math.ceil((km * 1000) / convoyMetresPerDay(navalSpeedPct)),
  );
}

/** One stretch of a crossing: its km and the daily loss ‰ there. */
export interface CrossingLeg {
  km: number;
  lossPm: number;
}

/**
 * Easy invasions: the losses ‰ a crossing is expected to take — each
 * stretch's days at sea times its daily loss, a trip shorter than a day
 * waiting out the day in the last one — capped like the engine's.
 */
export function easyCrossingLossPm(
  legs: readonly CrossingLeg[],
  navalSpeedPct: number,
): number {
  const perDay = convoyMetresPerDay(navalSpeedPct);
  let km = 0;
  let milli = 0;
  for (const l of legs) {
    km += l.km;
    milli += l.km * 1000 * l.lossPm;
  }
  // The voyage takes a day at least: the rest of it in the last stretch.
  const last = legs[legs.length - 1];
  if (last !== undefined && km * 1000 < perDay) {
    milli += (perDay - km * 1000) * last.lossPm;
  }
  return Math.min(WW_EASY_INVASION_LOSS_CAP_PM, Math.floor(milli / perDay));
}

/** Spec §11.4: the coastal fort's cut of a landing attack, bp ≥ 0 (−15% a level, engineers × 0.75). */
export function coastalFortBp(level: number, engineers: boolean): number {
  return level * (engineers ? 1125 : 1500);
}

/**
 * Spec §11.4: the landing's own cut of a landing attack, bp ≥ 0 (70%,
 * marines 35%, landing_craft_2 −10%p); an easy invasion's 40% (marines
 * 20%), the same landing craft.
 */
export function landingBp(
  hasMarines: boolean,
  techs: ReadonlySet<WwTechId>,
  easy = false,
): number {
  const base = easy
    ? hasMarines
      ? WW_EASY_LANDING_MARINE_BP
      : WW_EASY_LANDING_BP
    : hasMarines
      ? 3500
      : 7000;
  return Math.max(0, base - (techs.has("landing_craft_2") ? 1000 : 0));
}

/** Spec §11.4 attack lines of a landing division (negative bp: cuts for combineMods). */
export function amphibiousMods(
  hasMarines: boolean,
  coastalFort: number,
  engineers: boolean,
  techs: ReadonlySet<WwTechId>,
): CombatMods {
  return {
    attackBp: -(
      landingBp(hasMarines, techs) + coastalFortBp(coastalFort, engineers)
    ),
    defenseBp: 0,
  };
}

/** Spec §11.4: the defender's defense cut by shore bombardment; input Σ(heavy + light / 2), centi. */
export function shoreBombardBp(supportCenti: number, stats: WwStats): number {
  const v = Math.min(
    2500,
    Math.floor((supportCenti * (100 + stats.shoreBombardPct)) / 1000),
  );
  return v === 0 ? 0 : -v;
}

export interface InvasionAsk {
  divisions: number;
  capacity: number;
  allInOnePort: boolean;
  anyInBattle: boolean;
  targetCoastal: boolean;
  targetEnemy: boolean;
  routeKm: number | null;
  convoysFree: number;
  convoysNeed: number;
}

/** The order judge the card and the engine share (spec §11.1). */
export function invasionBlock(a: InvasionAsk): WwOrderBlock | null {
  if (!a.allInOnePort) return "not_in_port";
  if (a.anyInBattle) return "army_busy";
  if (!a.targetCoastal) return "not_coastal";
  if (!a.targetEnemy) return "not_at_war";
  if (a.routeKm === null || a.routeKm > WW_INVASION_MAX_KM)
    return "no_sea_path";
  if (a.divisions > a.capacity) return "invasion_too_large";
  return null; // convoys are checked at launch (spec §11.3), not at the order
}

// ---- Easy invasions: the port the landing force sails from ----

/** What pickInvasionPort reads (the engine and the army card fill it). */
export interface InvasionPortWorld {
  scenario: ScenarioIndex;
  /** Where the landing force stands (most of its divisions). */
  from: number;
  /** A region of our side (the way over land). */
  ours(region: number): boolean;
  /** Every division may take the train from where it stands. */
  railOk: boolean;
  railed(region: number): boolean;
  /** A working naval base of our side with a harbor. */
  isPort(region: number): boolean;
  /** Milli-km a tick: the slowest division on clear ground (Movement.slowestPathStep). */
  walkStep: number;
  /** Milli-km a tick by train (MoveRules.railStep). */
  railStep: number;
  /** Sea km from the port's harbor to the target's harbor; null: no route. */
  seaKm(port: number): number | null;
}

export interface InvasionPortPlan {
  port: number;
  /** By train (else on foot); false when it stands there already. */
  rail: boolean;
  /** Ticks over land to the port (0: there). */
  ticks: number;
  seaKm: number;
}

/**
 * Easy invasions: the port nearest the landing force by travel time (on
 * foot over our side's regions, or by train when every division can and
 * it is quicker; ties: the smaller region) that has a sea route to the
 * target within the invasion's reach. "no_invasion_port": no port of our
 * side is reached over land; "no_sea_path": none of them has a route.
 */
export function pickInvasionPort(
  w: InvasionPortWorld,
): InvasionPortPlan | "no_invasion_port" | "no_sea_path" {
  const sc = w.scenario;
  const walk = regionDistances(sc, w.from, w.ours, (e, to) =>
    edgeTicks(moveNeed(sc.edge(e), sc.landOf(to)), w.walkStep),
  );
  const rail =
    w.railOk && w.railed(w.from)
      ? regionDistances(
          sc,
          w.from,
          (r) => w.ours(r) && w.railed(r),
          (e) => edgeTicks(sc.edge(e).km * 1000, w.railStep),
        )
      : new Map<number, number>();
  const cands: { port: number; rail: boolean; ticks: number }[] = [];
  for (const [r, t] of walk) {
    if (!w.isPort(r)) continue;
    const byRail = rail.get(r);
    const train = byRail !== undefined && byRail < t;
    cands.push({ port: r, rail: train, ticks: train ? byRail : t });
  }
  if (cands.length === 0) return "no_invasion_port";
  cands.sort((a, b) => a.ticks - b.ticks || a.port - b.port);
  for (const c of cands) {
    const km = w.seaKm(c.port);
    if (km !== null && km <= WW_INVASION_MAX_KM) {
      return { ...c, rail: c.ticks > 0 && c.rail, seaKm: km };
    }
  }
  return "no_sea_path";
}
