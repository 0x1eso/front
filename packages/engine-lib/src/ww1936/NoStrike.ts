// World War 1936: the no-strike list is abolished (owner decision
// 2026-10-31). Korea and Taiwan are ordinary regions: bombed, struck, built
// in, based in and nuked like any other. The list is empty and the
// predicates stay (every strike picker and build check still asks them), so
// the callers need no change.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

/** world1936's no-strike region ids: none. */
export const NO_STRIKE_REGION_IDS: readonly number[] = [];

const MEMO = new WeakMap<ScenarioIndex, ReadonlySet<number>>();

/** The scenario's no-strike region ids (ids it lacks are skipped: the test maps have 20 regions at most). */
export function noStrikeRegions(sc: ScenarioIndex): ReadonlySet<number> {
  let set = MEMO.get(sc);
  if (set === undefined) {
    const ids = new Set(NO_STRIKE_REGION_IDS);
    set = new Set(sc.landRegions.filter((r) => ids.has(r.id)).map((r) => r.id));
    MEMO.set(sc, set);
  }
  return set;
}

export function isNoStrike(sc: ScenarioIndex, region: number): boolean {
  return noStrikeRegions(sc).has(region);
}

/** The block every strike order and picker checks first. */
export function strikeBlock(
  sc: ScenarioIndex,
  region: number,
): WwOrderBlock | null {
  return isNoStrike(sc, region) ? "no_strike_region" : null;
}
