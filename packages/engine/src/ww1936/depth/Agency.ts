// P6 lane I fills this file (plan Task 5): the intelligence agency, its upgrades and the day (spec §8.1–§8.2).
// The foundation's stub: final signatures, neutral answers.
import type { DepthOrder } from "@openfront/engine-api/Schemas";
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { Effect } from "@openfront/engine-api/ww1936/PoliticsDsl";
import type { EffectCtx } from "../politics/Dispatch";
import type { WwDepth } from "./WwDepth";

/** intel_found … crypto_activate. */
export function issueIntel(
  d: WwDepth,
  id: number,
  o: DepthOrder,
  tick: number,
): WwOrderBlock | null {
  return "no_agency";
}

/** Upgrades, operatives, missions, operations, cryptology. */
export function dailyIntel(d: WwDepth, id: number, day: number): void {}

/** The intel_network, decrypt and agency effects (spec §18.3). */
export function applyIntelEffect(
  ctx: EffectCtx,
  e: Extract<Effect, { kind: "intel_network" | "decrypt" | "agency" }>,
  actor: number,
): void {}
