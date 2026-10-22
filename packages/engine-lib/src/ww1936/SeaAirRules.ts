// World War 1936 P6 (P6 spec §15): mines, aces, night bombing and
// recon. Final (plan Task 1 Step 8); lane W2 uses them (Task 8).
import type { ShipClass } from "@openfront/engine-api/ww1936/NavyTypes";

/** Mines are milli-units (0..1_000_000 = spec 0..1000). */
export const MINE_MAX = 1_000_000;
export const MINE_LAY_PER_DAY: Readonly<Partial<Record<ShipClass, number>>> = {
  dd: 2_000,
  cl: 3_000,
  ss: 3_000,
};
export const MINE_SWEEP_PER_DAY: Readonly<Partial<Record<ShipClass, number>>> =
  {
    dd: 3_000,
    cl: 2_000,
  };

export function mineDecay(m: number): number {
  return Math.floor((m * 5) / 1000);
}

/** Daily HP damage to a side's ships in the region, milli-HP, before the visibility split. */
export function mineDamageMilli(
  totalHpMilli: number,
  enemyMinesMilli: number,
  sweepers: boolean,
): number {
  const d = Math.floor(
    (Math.floor(totalHpMilli / 1000) * Math.floor(enemyMinesMilli / 1000) * 4) /
      1000,
  );
  return sweepers ? Math.floor(d / 2) : d;
}

export function mineConvoyLossPm(enemyMinesMilli: number): number {
  return Math.floor(enemyMinesMilli / 10_000);
}

export function mineInvasionCutPct(enemyMinesMilli: number): number {
  return Math.min(10, Math.floor(enemyMinesMilli / 100_000));
}

export const NIGHT_LOSS_BP = 5_000;
export function nightBombBp(nightBombStatBp: number): number {
  return 6_000 + nightBombStatBp;
}

/**
 * Spec §15.3: a night deployment's air-combat loss factor, bp, against
 * shooters of which `radarPlanes` of `shooterPlanes` are radar-design night
 * fighters (their share is not halved). No shooters known: NIGHT_LOSS_BP.
 */
export function nightLossBp(
  radarPlanes: number,
  shooterPlanes: number,
): number {
  if (shooterPlanes <= 0) return NIGHT_LOSS_BP;
  const r = Math.max(0, Math.min(shooterPlanes, radarPlanes));
  return Math.floor(
    (NIGHT_LOSS_BP * (shooterPlanes - r) + 10_000 * r) / shooterPlanes,
  );
}
export const ACE_KILLS = 20;
export const ACE_SPAWN_PM = 20;
export const ACE_DEATH_PM = 5;
export const WW_MAX_ACES = 5;
export const ACE_STATS = { attackPct: 10, agilityPct: 5 } as const;
/** Plan decision 34: the callsign number of an ace of a deployment ("No. n Fighter Wing ace"). */
export function aceCallNo(deploymentId: number): number {
  return (deploymentId % 100) + 1;
}
export const RECON_SORTIES = 20;
/** Spec §15.4: a recon camera design flies its recon sorties twice over. */
export const RECON_CAMERA_X = 2;
export const RECON_PLAN_CUT_BP = -500;
