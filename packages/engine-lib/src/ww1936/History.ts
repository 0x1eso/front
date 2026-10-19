import { CountryTag } from "@openfront/engine-api/ww1936/Countries";

/**
 * "declare": a declaration of war that brings in the target's faction.
 * "join": a war between the two only (spec §7.3).
 */
export type HistoryKind = "declare" | "join";

export interface HistoryEntry {
  date: string;
  kind: HistoryKind;
  actor: CountryTag;
  target: CountryTag;
}

/** One entry in this many is skipped (PseudoRandom.chance), spec §7.4. */
export const HISTORY_SKIP_ODDS = 10;
/** The rest happen 0..this many days late. */
export const HISTORY_MAX_DELAY_DAYS = 20;

/** Wars already running on 1936-01-01 (spec §5.3). */
export const WW_INITIAL_WARS: readonly (readonly [CountryTag, CountryTag])[] = [
  ["ITA", "ETH"],
];

/** The P0 historical calendar (spec §7.4), by date. */
export const HISTORY: readonly HistoryEntry[] = [
  { date: "1936-07-17", kind: "declare", actor: "ESN", target: "ESR" },
  { date: "1937-07-07", kind: "declare", actor: "JPN", target: "CHN" },
  { date: "1939-04-07", kind: "declare", actor: "ITA", target: "ALB" },
  { date: "1939-09-01", kind: "declare", actor: "DEU", target: "POL" },
  { date: "1939-09-01", kind: "declare", actor: "DEU", target: "DZG" },
  { date: "1939-09-03", kind: "join", actor: "GBR", target: "DEU" },
  { date: "1939-09-03", kind: "join", actor: "FRA", target: "DEU" },
  { date: "1939-09-03", kind: "join", actor: "AUS", target: "DEU" },
  { date: "1939-09-03", kind: "join", actor: "NZL", target: "DEU" },
  { date: "1939-09-03", kind: "join", actor: "RAJ", target: "DEU" },
  { date: "1939-09-06", kind: "join", actor: "ZAF", target: "DEU" },
  { date: "1939-09-10", kind: "join", actor: "CAN", target: "DEU" },
  { date: "1939-09-17", kind: "declare", actor: "SUN", target: "POL" },
  { date: "1939-11-30", kind: "declare", actor: "SUN", target: "FIN" },
  { date: "1940-04-09", kind: "declare", actor: "DEU", target: "DNK" },
  { date: "1940-04-09", kind: "declare", actor: "DEU", target: "NOR" },
  { date: "1940-05-10", kind: "declare", actor: "DEU", target: "NLD" },
  { date: "1940-05-10", kind: "declare", actor: "DEU", target: "BEL" },
  { date: "1940-05-10", kind: "declare", actor: "DEU", target: "LUX" },
  { date: "1940-05-10", kind: "declare", actor: "DEU", target: "FRA" },
  { date: "1940-06-10", kind: "declare", actor: "ITA", target: "FRA" },
  { date: "1940-10-28", kind: "declare", actor: "ITA", target: "GRC" },
  { date: "1941-04-06", kind: "declare", actor: "DEU", target: "YUG" },
  { date: "1941-04-06", kind: "declare", actor: "DEU", target: "GRC" },
  { date: "1941-04-06", kind: "join", actor: "ITA", target: "YUG" },
  { date: "1941-04-11", kind: "join", actor: "HUN", target: "YUG" },
  { date: "1941-06-22", kind: "declare", actor: "DEU", target: "SUN" },
  { date: "1941-06-22", kind: "join", actor: "ITA", target: "SUN" },
  { date: "1941-06-22", kind: "join", actor: "ROU", target: "SUN" },
  { date: "1941-06-25", kind: "join", actor: "FIN", target: "SUN" },
  { date: "1941-06-27", kind: "join", actor: "HUN", target: "SUN" },
  { date: "1941-08-25", kind: "join", actor: "GBR", target: "IRN" },
  { date: "1941-08-25", kind: "join", actor: "SUN", target: "IRN" },
  { date: "1941-12-07", kind: "declare", actor: "JPN", target: "USA" },
  { date: "1941-12-07", kind: "declare", actor: "JPN", target: "GBR" },
  { date: "1941-12-08", kind: "join", actor: "NLD", target: "JPN" },
  { date: "1941-12-09", kind: "join", actor: "CHN", target: "DEU" },
  { date: "1941-12-09", kind: "join", actor: "CHN", target: "ITA" },
  { date: "1941-12-11", kind: "declare", actor: "DEU", target: "USA" },
  { date: "1941-12-11", kind: "declare", actor: "ITA", target: "USA" },
  { date: "1942-01-25", kind: "join", actor: "THA", target: "GBR" },
  { date: "1942-01-25", kind: "join", actor: "THA", target: "USA" },
  { date: "1942-05-22", kind: "join", actor: "MEX", target: "DEU" },
  { date: "1942-05-22", kind: "join", actor: "MEX", target: "ITA" },
  { date: "1942-05-22", kind: "join", actor: "MEX", target: "JPN" },
  { date: "1942-08-22", kind: "join", actor: "BRA", target: "DEU" },
  { date: "1942-08-22", kind: "join", actor: "BRA", target: "ITA" },
  { date: "1945-08-08", kind: "declare", actor: "SUN", target: "JPN" },
];
