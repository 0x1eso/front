// World War 1936 air overhaul (ww8), lane B: the sortie cycle, the zones'
// pulses and their daily close, wing_mission (design §3.3–§3.8). Stubs from
// W0; WwAir's tickWings and issueWingOrder call them in the wing model only.
import type {
  PlaneStats,
  Wing,
  WingOrder,
} from "@openfront/engine-api/ww1936/AirTypes";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import { deploymentStats, type WwAir } from "./WwAir";

/** Every tick: the wings whose `until` came, through their phases (design §3.5). Lane B. */
export function stepWings(air: WwAir, tick: number): void {
  void air;
  void tick;
}

/** Every tick: the zones whose idx % AIR_PULSE_TICKS matches (design §3.6, §3.8). Lane B. */
export function pulseZones(air: WwAir, tick: number): void {
  void air;
  void tick;
}

/**
 * A zone's daily close (design §3.8): today's sums move to the fields the
 * others read, depth.noteSorties, and the superiority alerts. WwAir calls
 * depth.airZoneDay right after it. Lane B.
 */
export function closeAirZone(
  air: WwAir,
  sr: number,
  day: number,
  tick: number,
): void {
  void air;
  void sr;
  void day;
  void tick;
}

/** wing_mission (the sender's own wings, ascending, already checked). Lane B. */
export function issueWingMission(
  air: WwAir,
  smallID: number,
  wings: readonly Wing[],
  order: Extract<WingOrder, { kind: "wing_mission" }>,
  tick: number,
): WwOrderBlock | null {
  void air;
  void smallID;
  void wings;
  void order;
  void tick;
  return "bad_index";
}

/**
 * A wing's numbers in the air: deploymentStats with its experience and ace
 * (WingRules.wingXpStats). Lane B memoises it on planes, xp, ace and statsVer.
 */
export function wingStats(air: WwAir, w: Wing): PlaneStats {
  return deploymentStats(air, w);
}
