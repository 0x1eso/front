// World War 1936 P2: army orders (P2 spec §7, §8.2–§8.5, §16.3). STUB:
// Task 3 writes the bodies; the signatures are final.
import type { LandOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { LandOrderSource } from "@openfront/engine-api/ww1936/LandTypes";
import type { CountryLand, WwLand } from "./WwLand";

/**
 * Spec §16.3: one army order (army_* and paradrop). `by` (pre-flight U2):
 * a "player" order of any kind but army_auto turns the army's auto off
 * (spec §8.5), army_general included; an "ai" order does not.
 */
export function issueArmyOrder(
  land: WwLand,
  cl: CountryLand,
  order: LandOrder,
  by: LandOrderSource,
): WwOrderBlock | null {
  const a = land.armies.get((order as { army?: number }).army ?? 0);
  if (a === undefined || a.owner !== cl.smallID) return "no_army";
  return null;
}

/** Turns the pending orders into destinations, this tick (spec §2.2-3). */
export function applyArmyOrders(land: WwLand, tick: number): void {}

/** The engine and the screens share it: why `order` cannot be given now. */
export function armyOrderBlock(
  land: WwLand,
  cl: CountryLand,
  order: LandOrder,
): WwOrderBlock | null {
  return null;
}
