// World War 1936 P6 T1b (navy/air half): the four admiral traits P6 adds
// (spec §4.2; engine-lib ADMIRAL_TRAIT_STATS) as P4's admiral modifiers —
// night_fighter's torpedoes and fleet_tactician's positioning in naval
// battles, convoy_master's escort and blockade_runner's raid losses in the
// convoy war, blockade_runner's visibility in spotting.
import {
  ADMIRAL_TRAITS,
  admiralTraitBit,
} from "@openfront/engine-api/ww1936/NavyTypes";
import {
  ADMIRAL_TRAIT_STATS,
  type AdmiralTraitStats,
} from "@openfront/engine-lib/ww1936/CommandRules";
import type { Fleet, WwNavy } from "./WwNavy";

/** The P6 admiral traits' percent on `key` for a trait mask (0 for none). */
export function admiralPct(
  traits: number,
  key: keyof AdmiralTraitStats,
): number {
  if (traits === 0) return 0;
  let pct = 0;
  for (const t of ADMIRAL_TRAITS) {
    if ((traits & admiralTraitBit(t)) === 0) continue;
    pct += ADMIRAL_TRAIT_STATS[t]?.[key] ?? 0;
  }
  return pct;
}

/** The traits of the admiral commanding `f` (0: none). */
export function fleetAdmiralTraits(navy: WwNavy, f: Fleet): number {
  if (f.admiral === 0) return 0;
  return navy.admirals.get(f.admiral)?.traits ?? 0;
}
