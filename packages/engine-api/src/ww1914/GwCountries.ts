import { COUNTRIES, CountryTag, isCountryTag } from "../ww1936/Countries";

/**
 * Great War 1914: the countries of June 1914. A list of its own, not an
 * append to COUNTRY_TAGS: that list ends with the dormant slots and the 1936
 * tests and the lobby's picker walk all of it. A tag also in COUNTRY_TAGS
 * names the same country.
 *
 * APPEND ONLY, NEVER REORDER OR REMOVE: a country's smallID is its index
 * among the tags present on the map, plus one (engine-lib/ww1914/World1914).
 */
export const GW_TAGS = [
  // The powers
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
  "JPN",
  // Europe
  "SRB",
  "MNE",
  "BEL",
  "NLD",
  "LUX",
  "CHE",
  "DNK",
  "NOR",
  "SWE",
  "ESP",
  "PRT",
  "ROU",
  "BGR",
  "GRC",
  "ALB",
  // Asia and Africa
  "CHN",
  "IRN",
  "AFG",
  "THA",
  "NPL",
  "ETH",
  "LBR",
  // Americas
  "MEX",
  "GTM",
  "HND",
  "SLV",
  "NIC",
  "CRI",
  "PAN",
  "CUB",
  "HTI",
  "DOM",
  "COL",
  "VEN",
  "ECU",
  "PER",
  "BOL",
  "BRA",
  "PRY",
  "URY",
  "ARG",
  "CHL",
] as const;
export type GwTag = (typeof GW_TAGS)[number];

export function isGwTag(v: string): v is GwTag {
  return (GW_TAGS as readonly string[]).includes(v);
}

export interface GwCountryDef {
  /** English name: the engine's player name. Screens use `gw.country.<TAG>`. */
  readonly name: string;
  /** File name stem in resources/flags. */
  readonly flag: string;
  /** Territory colour, RGB. */
  readonly color: readonly [number, number, number];
}

const OWN: Readonly<Partial<Record<GwTag, GwCountryDef>>> = {
  AUH: {
    name: "Austria-Hungary",
    flag: "austria-hungary",
    color: [205, 190, 120],
  },
  RUS: { name: "Russia", flag: "Romanov Russia", color: [90, 140, 90] },
  OTT: { name: "Ottoman Empire", flag: "Ottoman Empire", color: [185, 145, 110] },
  SRB: { name: "Serbia", flag: "rs", color: [150, 70, 90] },
  MNE: { name: "Montenegro", flag: "me", color: [170, 110, 60] },
  ESP: { name: "Spain", flag: "spain", color: [195, 155, 75] },
};

/** A country's name, flag and colour; 1936's row for a shared tag. */
export function gwCountry(tag: GwTag): GwCountryDef {
  const own = OWN[tag];
  if (own !== undefined) return own;
  if (!isCountryTag(tag)) throw new Error(`no row for country ${tag}`);
  const def = COUNTRIES[tag as CountryTag];
  return { name: def.name, flag: def.flag, color: def.color };
}
