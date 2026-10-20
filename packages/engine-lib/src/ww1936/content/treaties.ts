// World War 1936 P3 (spec §16.2): the non-aggression pacts in force on
// 1936-01-01 (facts): German–Polish (1934), Soviet–Polish (1932),
// Soviet–Finnish (1932), Soviet–Estonian, –Latvian, –Lithuanian.
import type { CountryTag } from "@openfront/engine-api/ww1936/Countries";

export const START_NAPS: readonly (readonly [CountryTag, CountryTag])[] = [
  ["DEU", "POL"],
  ["SUN", "POL"],
  ["SUN", "FIN"],
  ["SUN", "EST"],
  ["SUN", "LVA"],
  ["SUN", "LTU"],
];
