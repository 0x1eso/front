// World War 1936 P4: convoy formulas (P4 spec §10): how many convoys a
// trade, a supply route or a sea move needs, overseas supply capacity, and
// the expected convoy war of raiders and escorts. No randomness: losses
// are expected values with remainders (Global Constraints).
import type {
  WwOrderBlock,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import {
  WW_ASW_K_PM,
  WW_ESCORT_CUT_MAX_PM,
  WW_RAID_CAP_PM,
  WW_RAID_K,
  WW_SUPPLY_CONVOY_KM,
  WW_TRADE_CONVOY_KM,
} from "@openfront/engine-api/ww1936/NavyTypes";
import type { WwStats } from "@openfront/engine-api/ww1936/PoliticsTypes";

/** Spec §10.2: convoys a sea trade needs (16 units × 8,000 km → 26). */
export function convoysForTrade(unitsPerDay: number, km: number): number {
  return Math.ceil((unitsPerDay * km) / WW_TRADE_CONVOY_KM);
}

/** Spec §10.3: convoys an overseas supply route needs (supply milli a day). */
export function convoysForSupply(supplyMilli: number, km: number): number {
  return Math.ceil((supplyMilli * km) / (WW_SUPPLY_CONVOY_KM * 1000));
}

/** Spec §10.3, milli: min(4 + 2 × level, convoys × 500 / km) × route efficiency. */
export function seaHubCapacity(
  baseLevel: number,
  convoys: number,
  km: number,
  routeEffPm: number,
): number {
  const byBase = (4 + 2 * baseLevel) * 1000;
  const byConvoys = Math.floor(
    (convoys * WW_SUPPLY_CONVOY_KM * 1000) / Math.max(1, km),
  );
  return Math.floor((Math.min(byBase, byConvoys) * routeEffPm) / 1000);
}

/** Spec §10.3: the worst of 1000 − enemy supremacy / 2 over the route's sea regions. */
export function routeEffPm(enemySupPms: readonly number[]): number {
  let e = 1000;
  for (const s of enemySupPms) e = Math.min(e, 1000 - Math.floor(s / 2));
  return e;
}

/** Spec §10.5: a division's convoys, ceil(weight × 2) (infantry 9 = 450 → 9). */
export function divisionConvoys(weightCenti: number): number {
  return Math.ceil((weightCenti * 2) / 100);
}

/**
 * Spec §10.6 raid power, centi. Submarines: torpedo × (100 + subAttack +
 * convoyRaid + doctrine) / 100; surface raiders: (light + heavy) × 0.5
 * (× 1.5 with trade_interdiction_2) × (100 + convoyRaid) / 100; planes:
 * naval attack × 0.2 (sorties already applied); × the fuel ratio.
 */
export function raidPowerCenti(
  subTorpedoCenti: number,
  surfaceGunsCenti: number,
  planeNavalCenti: number,
  stats: WwStats,
  techs: ReadonlySet<WwTechId>,
  fuelPm: number,
): number {
  const doc =
    (techs.has("trade_interdiction_1") ? 15 : 0) +
    (techs.has("trade_interdiction_2") ? 15 : 0);
  const sub = Math.floor(
    (subTorpedoCenti * (100 + stats.subAttackPct + stats.convoyRaidPct + doc)) /
      100,
  );
  const surfK = techs.has("trade_interdiction_2") ? 3 : 2; // ×1.5 or ×1, over 2 (the 0.5)
  const surf = Math.floor(
    (Math.floor((surfaceGunsCenti * surfK) / 4) * (100 + stats.convoyRaidPct)) /
      100,
  );
  const air = Math.floor(planeNavalCenti / 5);
  return Math.floor(((sub + surf + air) * fuelPm) / 1000);
}

/**
 * Spec §10.6 escort power, centi. ddCenti = Σ DD (depth × 2 + light),
 * clCenti = Σ CL (depth + light), otherLightCenti = Σ other light guns
 * (× 0.5); patrol planes 0.5 a plane (sorties applied by the caller).
 */
export function escortPowerCenti(
  ddCenti: number,
  clCenti: number,
  otherLightCenti: number,
  patrolPlanes: number,
  stats: WwStats,
): number {
  const ships = ddCenti + clCenti + Math.floor(otherLightCenti / 2);
  return (
    Math.floor((ships * (100 + stats.convoyEscortPct)) / 100) +
    patrolPlanes * 50
  );
}

/** Spec §10.6 daily loss rate ‰ (display): min(30, raid × 600 / (area × 60)) × (1000 − cut). */
export function convoyLossRatePm(
  raidCenti: number,
  escortCenti: number,
  area: number,
): number {
  return Math.floor(
    (lossBaseMilliPm(raidCenti, area) *
      (1000 - escortCutPm(raidCenti, escortCenti))) /
      1_000_000,
  );
}

function lossBaseMilliPm(raidCenti: number, area: number): number {
  return Math.min(
    WW_RAID_CAP_PM * 1000,
    Math.floor(
      (raidCenti * 600 * 1000) / (Math.max(1, area) * WW_RAID_K * 100),
    ),
  );
}

/** Spec §10.6: the escort's cut of the losses, ‰ (at most 850). */
export function escortCutPm(raidCenti: number, escortCenti: number): number {
  if (escortCenti <= 0) return 0;
  return Math.min(
    WW_ESCORT_CUT_MAX_PM,
    Math.floor((escortCenti * 1000) / (escortCenti + raidCenti)),
  );
}

/** Convoys sunk today in one region, milli (exact: traffic × rate without rounding the rate). */
export function convoySinkMilli(
  traffic: number,
  raidCenti: number,
  escortCenti: number,
  area: number,
): number {
  return Math.floor(
    (traffic *
      lossBaseMilliPm(raidCenti, area) *
      (1000 - escortCutPm(raidCenti, escortCenti))) /
      1_000_000,
  );
}

/** Spec §10.6 ASW: HP milli a day on the raiding submarines: escort × 20‰ × spotting ‰. */
export function aswDamageMilli(escortCenti: number, spotPm: number): number {
  return Math.floor((escortCenti * WW_ASW_K_PM * spotPm) / 100_000);
}

/** Spec §10.4: losses ‰ a day of an unescorted sea move: (500 − our supremacy) / 500 × 10%. */
export function interceptLossPm(ourSupPm: number, enemyPower: number): number {
  return enemyPower <= 0 || ourSupPm >= 500
    ? 0
    : Math.floor((500 - ourSupPm) / 5);
}

// ---- The sea move's judge the army card shares (lane C fills it) ----

/** What seaTransferBlock reads (P4 spec §10.4). */
export interface SeaTransferAsk {
  /** Both ends are ports of the mover's side (navalPort). */
  fromPort: boolean;
  toPort: boolean;
  anyInBattle: boolean;
  /** Sea route km between the harbors; null: none. */
  routeKm: number | null;
  convoysFree: number;
  convoysNeed: number;
}

/** Spec §10.4: why the army may not sail; null when it may (lane C). */
export function seaTransferBlock(a: SeaTransferAsk): WwOrderBlock | null {
  void a;
  return null;
}
