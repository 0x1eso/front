// World War 1936 P4: naval invasion rules (P4 spec §11): capacity,
// preparation, the landing division's battle lines, shore bombardment and
// the order judge the army card and the engine share.
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import type { CombatMods } from "@openfront/engine-api/ww1936/LandTypes";
import {
  WW_INVASION_BASE_CAPACITY,
  WW_INVASION_MAX_KM,
  WW_INVASION_PREP_DAYS,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

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

/** Spec §11.2: preparation days (60 × (100 + stat − 20 per landing craft − 20 for an amphibious admiral) %, halved for marines). */
export function invasionPrepDays(
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
  allMarines: boolean,
  amphibAdmiral: boolean,
): number {
  const lc =
    (techs.has("landing_craft_1") ? 1 : 0) +
    (techs.has("landing_craft_2") ? 1 : 0);
  const pct = Math.max(
    10,
    100 + stats.invasionPrepPct - 20 * lc - (amphibAdmiral ? 20 : 0),
  );
  const days = Math.ceil((WW_INVASION_PREP_DAYS * pct) / 100);
  return allMarines ? Math.ceil(days / 2) : days;
}

/** Spec §11.4: the coastal fort's cut of a landing attack, bp ≥ 0 (−15% a level, engineers × 0.75). */
export function coastalFortBp(level: number, engineers: boolean): number {
  return level * (engineers ? 1125 : 1500);
}

/** Spec §11.4: the landing's own cut of a landing attack, bp ≥ 0 (70%, marines 35%, landing_craft_2 −10%p). */
export function landingBp(
  hasMarines: boolean,
  techs: ReadonlySet<WwTechId>,
): number {
  return (hasMarines ? 3500 : 7000) - (techs.has("landing_craft_2") ? 1000 : 0);
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
