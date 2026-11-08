// World War 1936 P4: sorties, air combat, anti-air and air superiority
// (P4 spec §14.2–§14.5). Lane A1 (Task 7). A zone's day: every
// deployment's sorties (weather, fuel, range, base damage and, but for
// superiority and interception, yesterday's superiority), then the air
// battles of every pair of sides at war, the land anti-air, the losses
// taken all at once, and the superiority by side the others read next.
import { PlaneStats } from "@openfront/engine-api/ww1936/AirTypes";
import {
  agilityFactorPm,
  airLossesMilli,
} from "@openfront/engine-lib/ww1936/AirRules";
import { WwAir, ZoneAirState } from "./WwAir";

/** One group of planes in a duel: its numbers and how many fly, milli planes. */
export interface DuelPlanes {
  stats: PlaneStats;
  milli: number;
  /** The mission's weight on this group as a target (spec §14.3: ×1, ×2, ×3). */
  weight: number;
}
/** Spec §14.3 target weights, in hundredths (so a mix of the two missions stays whole). */
export const W_SUP_FIGHTER = 200;
export const W_SUP_OTHER = 100;
export const W_INT_FIGHTER = 100;
export const W_INT_OTHER = 300;
/** The alert's spacing per zone and country, days (spec §18.10). */
const SUP_ALERT_DAYS = 7;

/** P6 (spec §21.2, T1b): a sortie rate ‰ × (100 + sortieEffPct)%, at most one sortie a day. */
export function effWith(pct: number, pm: number): number {
  return pct === 0
    ? pm
    : Math.min(1000, Math.floor((pm * Math.max(0, 100 + pct)) / 100));
}

/**
 * Spec §14.3: one air battle's losses the attackers inflict on the
 * defenders, milli planes (N2's carrier strikes, A2's paradrops and the
 * zone's air battles call it): KP = Σ air attack × sorties × the agility
 * factor of the attackers' average against the targets' (weighted)
 * average; losses = KP × detection / (the targets' weighted average air
 * defense × 28).
 */
export function airDuelMilli(
  attackers: readonly DuelPlanes[],
  defenders: readonly DuelPlanes[],
  detPm: number,
): number {
  let atk = 0;
  let kp = 0;
  let agiA = 0;
  for (const a of attackers) {
    if (a.milli <= 0) continue;
    atk += a.milli;
    kp += Math.floor((a.milli * a.stats.airAtk) / 1000);
    agiA += a.milli * a.stats.agility;
  }
  if (atk === 0 || kp === 0) return 0;
  let w = 0;
  let def = 0;
  let agiB = 0;
  for (const d of defenders) {
    if (d.milli <= 0 || d.weight <= 0) continue;
    const x = d.milli * d.weight;
    w += x;
    def += x * d.stats.airDef;
    agiB += x * d.stats.agility;
  }
  if (w === 0) return 0;
  return duelSumsMilli(atk, kp, agiA, w, def, agiB, detPm);
}

/**
 * airDuelMilli over its running sums (ww8: a pulse keeps these per side
 * instead of building two arrays): the shooters' sorties, kill power and
 * sorties × agility; the targets' weighted sorties, × defense and × agility.
 */
export function duelSumsMilli(
  atk: number,
  kp: number,
  agiA: number,
  w: number,
  def: number,
  agiB: number,
  detPm: number,
): number {
  if (atk === 0 || kp === 0 || w === 0) return 0;
  const factor = agilityFactorPm(Math.floor(agiA / atk), Math.floor(agiB / w));
  return airLossesMilli(
    Math.floor((kp * factor) / 1000),
    detPm,
    Math.floor(def / w),
  );
}

/** Whether two sides are at war (some member of one with some member of the other). */
export function sidesAtWar(air: WwAir, a: number, b: number): boolean {
  if (a === b) return false;
  const land = air.land;
  for (const x of land.sideMembers(a)) {
    for (const y of land.sideMembers(b)) {
      if (land.isEnemy(x, y)) return true;
    }
  }
  return false;
}

/**
 * Spec §18.10 `ww1936_air_superiority`: a side's superiority over the zone
 * crossed 50% (up or down); its countries at war that have the zone as a
 * front (we fly there, an enemy flies there, or — a land zone — our side
 * and an enemy both hold ground in it) are told, at most once in 7 days a
 * side and zone. The days are state (ZoneAirState.alertDay, snapshotted
 * and hashed), so a restored game repeats or skips none.
 */
export function superiorityAlerts(
  air: WwAir,
  z: ZoneAirState,
  sr: number,
  day: number,
  before: ReadonlyMap<number, number>,
  after: ReadonlyMap<number, number>,
  flights: readonly { readonly owner: number }[],
): void {
  const sc = air.ww.scenario;
  const s = sc.sr(sr)!;
  const land = air.land;
  const sides = new Set<number>([...before.keys(), ...after.keys()]);
  for (const side of [...sides].sort((a, b) => a - b)) {
    const was = before.get(side) ?? 0;
    const now = after.get(side) ?? 0;
    if (was > 500 === now > 500) continue;
    if (z.alertDay.has(side)) continue;
    const told: number[] = [];
    for (const c of land.sideMembers(side)) {
      if (!air.ww.hasWar(c)) continue;
      const front =
        flights.some((f) => f.owner === c || land.isEnemy(c, f.owner)) ||
        (s.kind === "land" &&
          s.members.some((r) => land.isEnemy(c, land.controller[r] ?? 0)) &&
          s.members.some((r) => land.sameSide(c, land.controller[r] ?? 0)));
      if (front) told.push(c);
    }
    if (told.length === 0) continue;
    // Map order is key order (Global Constraints): insert sorted. Day 0 is
    // a day too (sortedMap drops zeros: Task 15).
    z.alertDay = new Map(
      [...z.alertDay, [side, day] as [number, number]].sort(
        (a, b) => a[0] - b[0],
      ),
    );
    for (const c of told) {
      air.message(c, "events_display.ww1936_air_superiority", {
        sr,
        pct: Math.floor(now / 10),
        gained: now > 500 ? 1 : 0,
      });
    }
  }
}

/**
 * The alerts' days past the spacing are forgotten (the state stays
 * small), first thing on the zone's day — before the emptiness check, so
 * a quiet zone with an old alert is empty (Task 15: it was cleared and
 * sent to the screens again every day until the alert aged out).
 */
export function pruneAlerts(z: ZoneAirState, day: number): void {
  if (z.alertDay.size === 0) return;
  for (const [side, last] of [...z.alertDay]) {
    if (day - last >= SUP_ALERT_DAYS) z.alertDay.delete(side);
  }
}

/** Puts a key-ordered copy of `m` (non-zero values only). */
export function sortedMap(m: ReadonlyMap<number, number>): Map<number, number> {
  const out = new Map<number, number>();
  for (const [k, v] of [...m].sort((a, b) => a[0] - b[0])) {
    if (v !== 0) out.set(k, v);
  }
  return out;
}
