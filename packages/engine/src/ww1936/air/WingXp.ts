// World War 1936 air overhaul (ww8), lane D: a wing's experience (design §6).
// Stubs from W0. Lanes A, B and C call them at the events below.
import type { Wing } from "@openfront/engine-api/ww1936/AirTypes";
import type { WwAir } from "./WwAir";

/** A pulse where it met the enemy, `shotDown` planes this pulse (lane B). Lane D. */
export function noteWingFight(
  air: WwAir,
  w: Wing,
  shotDown: number,
  day: number,
): void {
  void air;
  void w;
  void shotDown;
  void day;
}

/** A CAS pulse inside a battle (lane B). Lane D. */
export function noteWingCas(air: WwAir, w: Wing): void {
  void air;
  void w;
}

/** A delivery: bombs or a naval strike (lane B, after deliverSortie). Lane D. */
export function noteWingDelivery(air: WwAir, w: Wing): void {
  void air;
  void w;
}

/** A finished station on patrol or recon (lane B). Lane D. */
export function noteWingStation(air: WwAir, w: Wing): void {
  void air;
  void w;
}

/** The wing rested on the ground today (lane A's country turn). Lane D. */
export function noteWingRest(air: WwAir, w: Wing, day: number): void {
  void air;
  void w;
  void day;
}
