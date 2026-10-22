// P6 lane W2 (plan Task 8): aces (spec §15.2). An ace is a callsign on a
// fighter deployment record ("No. n Fighter Wing ace", n = the record's id
// % 100 + 1; never a real name, spec §24): its air attack +10% and agility
// +5% (aceMods, P4's air combat reads it, T1b). Born on a zone's day when a
// country's planes shot down 20 or more there (a 2% roll), lost on a day
// its record fought in the air (a 0.5% roll). The rolls are P3's stateless
// wwRoll with the "ace_spawn" / "ace_death" purposes (spec §21.3). The
// notice (lane T's events_display.ww1936_ace {callsign, state}) carries the
// callsign number; the screen names it with ww1936.ace.callsign {n}.
import { AIR_MISSIONS, AIR_TYPES } from "@openfront/engine-api/ww1936/AirTypes";
import {
  P_ACE_DEATH,
  P_ACE_SPAWN,
} from "@openfront/engine-lib/ww1936/DepthRules";
import { wwRoll } from "@openfront/engine-lib/ww1936/Roll";
import {
  ACE_DEATH_PM,
  ACE_KILLS,
  ACE_SPAWN_PM,
  ACE_STATS,
  aceCallNo,
  WW_MAX_ACES,
} from "@openfront/engine-lib/ww1936/SeaAirRules";
import { type AirFlight, zoneFlights } from "../air/AirCombat";
import { isCarrierWing } from "../air/Deploy";
import type { Deployment } from "../air/WwAir";
import { sidesAtWar } from "./Mines";
import type { WwDepth } from "./WwDepth";

const M_SUP = AIR_MISSIONS.indexOf("air_superiority");
const M_INT = AIR_MISSIONS.indexOf("interception");
/** Spec §15.2: the fighters and heavy fighters. */
const ACE_TYPES: ReadonlySet<number> = new Set([
  AIR_TYPES.indexOf("fighter"),
  AIR_TYPES.indexOf("heavy_fighter"),
]);

const isShooter = (f: AirFlight) => f.mission === M_SUP || f.mission === M_INT;

/** The ace's numbers for its deployment record (0 without a living ace). */
export function aceMods(
  d: WwDepth,
  deploymentId: number,
): { attackPct: number; agilityPct: number } {
  const dep = d.ww.air.deployments.get(deploymentId);
  if (
    dep === undefined ||
    dep.ace === 0 ||
    !d.sea.aces.some((a) => a.id === dep.ace && a.deployment === dep.id)
  ) {
    return { attackPct: 0, agilityPct: 0 };
  }
  return { attackPct: ACE_STATS.attackPct, agilityPct: ACE_STATS.agilityPct };
}

/** The planes of a record (its generations and its design slots). */
function planesOf(dep: Deployment): number {
  let n = 0;
  for (const c of dep.counts) n += c;
  for (const c of dep.dcounts) n += c;
  return n;
}

/** The record fought in the air today: it shot at an enemy here, or an enemy's fighters shot at it. */
function inAirCombat(
  d: WwDepth,
  dep: Deployment,
  flights: readonly AirFlight[],
): boolean {
  const own = flights.find((f) => f.id === dep.id);
  if (own === undefined) return false;
  return flights.some(
    (f) =>
      f.side !== own.side &&
      (isShooter(own) || isShooter(f)) &&
      sidesAtWar(d, own.side, f.side),
  );
}

/**
 * The zone's aces (inside airZoneDay): aces whose record is gone or
 * changed hands retire; an ace whose record fought in the air today is
 * lost on a 0.5% roll; then each country that shot down ≥ 20 planes here
 * today (fighters flying superiority or interception here) and has fewer
 * than 5 aces gets one on a 2% roll, on its record here with the most
 * fighters and no ace yet (ties: the smaller id).
 */
export function dailyAces(d: WwDepth, sr: number, day: number): void {
  const ww = d.ww;
  const air = ww.air;
  const idx = ww.scenario.srIdxOf(sr);
  if (idx < 0) return;
  const seed = ww.politics.seed;
  // Retired with their record (recalled, merged away, lost with the country).
  if (d.sea.aces.length > 0) {
    const kept = d.sea.aces.filter((a) => {
      const dep = air.deployments.get(a.deployment);
      return dep !== undefined && dep.owner === a.owner && dep.ace === a.id;
    });
    if (kept.length !== d.sea.aces.length) {
      d.sea.aces = kept;
      d.markGlobal();
    }
  }
  const flights = zoneFlights(air, sr);
  // Lost in the air.
  for (const a of [...d.sea.aces]) {
    const dep = air.deployments.get(a.deployment)!;
    if (dep.sr !== sr || !inAirCombat(d, dep, flights)) continue;
    if (wwRoll(seed, P_ACE_DEATH, a.id, day) % 1000 >= ACE_DEATH_PM) continue;
    d.sea.aces = d.sea.aces.filter((x) => x.id !== a.id);
    dep.ace = 0;
    air.markDeployment(dep.id);
    d.markGlobal();
    d.message(a.owner, "ww1936_ace", { callsign: a.callNo, state: "lost" });
  }
  // Born.
  const z = air.zoneState[idx];
  if (z === undefined || z.result.size === 0) return;
  for (const [c, r] of [...z.result].sort((a, b) => a[0] - b[0])) {
    if ((r[0] ?? 0) < ACE_KILLS) continue;
    if (
      !flights.some(
        (f) => f.owner === c && ACE_TYPES.has(f.type) && isShooter(f),
      )
    ) {
      continue;
    }
    if (d.sea.aces.filter((a) => a.owner === c).length >= WW_MAX_ACES) {
      continue;
    }
    if (wwRoll(seed, P_ACE_SPAWN, c, day, sr) % 1000 >= ACE_SPAWN_PM) continue;
    let best: Deployment | null = null;
    let bestN = 0;
    for (const id of air.deploymentsIn(sr)) {
      const dep = air.deployments.get(id);
      if (
        dep === undefined ||
        dep.owner !== c ||
        dep.ace !== 0 ||
        isCarrierWing(dep) ||
        !ACE_TYPES.has(dep.type)
      ) {
        continue;
      }
      const n = planesOf(dep);
      if (n > bestN) {
        best = dep;
        bestN = n;
      }
    }
    if (best === null) continue;
    const ace = {
      id: d.uid(),
      owner: c,
      deployment: best.id,
      sinceDay: day,
      callNo: aceCallNo(best.id),
    };
    d.sea.aces = [...d.sea.aces, ace];
    best.ace = ace.id;
    air.markDeployment(best.id);
    d.markGlobal();
    d.message(c, "ww1936_ace", { callsign: ace.callNo, state: "rise" });
  }
}
