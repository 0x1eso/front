// World War 1936 sensitivity rule (P6 pre-flight): the regions no strike
// may target — Korea's eleven regions and Taiwan, held by Japan in 1936.
// Strategic bombing, port strikes and every later strike picker (AI and
// human; P6's rockets, nuclear weapons and raids) refuse them with
// "no_strike_region", and nothing is built there (final review B: I1, I3).
// Final review B, I2: a fixed id list (the controller's rulings), not
// names, so a rename never drops a region from the rule. world1936's region
// ids are stable (the map tool keeps them); map-generator/regions.go holds
// the same list for the start bases.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

/**
 * world1936's no-strike region ids (resources/maps/world1936/scenario.json):
 * Hamgyŏng-bukto, Ryanggang, Chagang-do, Hamgyŏng-namdo, P'yŏngan-namdo,
 * Seoul, P'yŏngyang, Gangwon, North Chungcheong, North Gyeongsang, South
 * Jeolla and Taiwan.
 */
export const NO_STRIKE_REGION_IDS: readonly number[] = [
  563, 598, 604, 622, 639, 679, 686, 701, 732, 734, 761, 901,
];

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
