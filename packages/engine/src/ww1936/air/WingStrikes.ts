// World War 1936 air overhaul (ww8), lane C: what a wing does when it gets
// there (design §4, §5). Stubs from W0; lane B's stepWings calls them, and
// they fill the zone's `today` and the raid reports.
import type { Wing } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwAir } from "./WwAir";

/**
 * The end of a wing's station on strategic_bombing, port_strike,
 * naval_strike or air_supply: the delivery, after lane B took the anti-air.
 * `load` is the delivery's size in days of sorties ×100 (WingRules.loadCenti).
 * Lane C.
 */
export function deliverSortie(
  air: WwAir,
  w: Wing,
  loadCenti: number,
  tick: number,
): void {
  void air;
  void w;
  void loadCenti;
  void tick;
}

/** One tick on station on naval_patrol or recon: adds to the zone's today. Lane C. */
export function accrueStation(air: WwAir, w: Wing, tick: number): void {
  void air;
  void w;
  void tick;
}
