// World War 1936 P6 (spec §8.2, §19.5): when the historical AI founds each
// major's intelligence agency. Nobody has one on 1936-01-01 (spec §8.2).
//
// The agencies of Germany, Britain, the Soviet Union, Japan, Italy and France
// all existed before 1936, so they found theirs on the first day of the
// AI's window (spec §19.5: 1936-03 to 1937-06). The United States had no
// peacetime foreign intelligence service until the Office of the Coordinator
// of Information was created on 1941-07-11 (sources: content/depth/sources.ts).
//
// An agency has no name of its own (the screens show the country); its
// operatives go by codename (ww1936.codename.c<n>, n = 0..CODENAME_COUNT - 1;
// a bare number key cannot stay sorted in en.json), never by a person's
// name (spec §24-2).
import type { AgencyStartDef } from "@openfront/engine-api/ww1936/DepthTypes";

export const AGENCY_STARTS: readonly AgencyStartDef[] = [
  { tag: "DEU", date: "1936-03-01" },
  { tag: "GBR", date: "1936-03-01" },
  { tag: "SUN", date: "1936-03-01" },
  { tag: "JPN", date: "1936-03-01" },
  { tag: "ITA", date: "1936-03-01" },
  { tag: "FRA", date: "1936-03-01" },
  { tag: "USA", date: "1941-07-11" },
];
