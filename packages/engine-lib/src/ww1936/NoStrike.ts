// World War 1936 sensitivity rule (P6 pre-flight): the regions no strike
// may target — Korea's eleven regions and Taiwan, held by Japan in 1936.
// Strategic bombing, port strikes and every later strike picker (AI and
// human; P6's rockets, nuclear weapons and raids) refuse them with
// "no_strike_region". Resolved by name, so a scenario's ids may move.
import type { WwOrderBlock } from "@openfront/engine-api/ww1936/EconomyTypes";
import type { ScenarioIndex } from "./ScenarioIndex";

/** world1936's region names (resources/maps/world1936/scenario.json). */
export const NO_STRIKE_REGION_NAMES: readonly string[] = [
  "Hamgyŏng-bukto",
  "Ryanggang",
  "Chagang-do",
  "Hamgyŏng-namdo",
  "P'yŏngan-namdo",
  "P'yŏngyang",
  "Gangwon",
  "Keijō (Seoul)",
  "North Chungcheong",
  "North Gyeongsang",
  "South Jeolla",
  "Taiwan",
];

const MEMO = new WeakMap<ScenarioIndex, ReadonlySet<number>>();

/** The scenario's no-strike region ids (names it lacks are skipped: test maps). */
export function noStrikeRegions(sc: ScenarioIndex): ReadonlySet<number> {
  let set = MEMO.get(sc);
  if (set === undefined) {
    const names = new Set(NO_STRIKE_REGION_NAMES);
    set = new Set(
      sc.landRegions.filter((r) => names.has(r.name)).map((r) => r.id),
    );
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
