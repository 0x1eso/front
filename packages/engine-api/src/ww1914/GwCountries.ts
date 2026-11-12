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
  // ww199: dormant until a table founds them. New states (own colour and
  // name: GW_CLIENT_ROWS), then the vassal slots (GW_VASSAL_SLOTS: the
  // colour of the country they are cut from). They have no land in June
  // 1914, so they come after every present tag (World1914) and no smallID moves.
  "POL",
  "LTU",
  "LVA",
  "UKR",
  "GEO",
  "HEJ",
  "CZE",
  "RHN",
  "FLA",
  "VDE",
  "VAU",
  "VRU",
  "VFR",
  "VIT",
  "VOT",
  "VSR",
  "VMN",
  "VBE",
  "VRO",
  "VBG",
  "VGR",
] as const;
export type GwTag = (typeof GW_TAGS)[number];

/** The first tag a table founds: those before it are the countries of June 1914. */
export const GW_FIRST_NEW_TAG: GwTag = "POL";
/** The countries of June 1914, GW_TAGS order: the lobby's and the AI's. */
export const GW_MAP_TAGS: readonly GwTag[] = GW_TAGS.slice(
  0,
  GW_TAGS.indexOf(GW_FIRST_NEW_TAG),
);
/** Tags only a table brings onto the map (ww199). */
export const GW_NEW_TAGS: readonly GwTag[] = GW_TAGS.slice(
  GW_TAGS.indexOf(GW_FIRST_NEW_TAG),
);

/**
 * ww199: a vassal carved out of part of a beaten country plays under a slot
 * of its own, in that country's colour and flag: `of` -> slot. A whole-country
 * vassal is the beaten country itself.
 */
export const GW_VASSAL_SLOTS: Readonly<Partial<Record<GwTag, GwTag>>> = {
  DEU: "VDE",
  AUH: "VAU",
  RUS: "VRU",
  FRA: "VFR",
  ITA: "VIT",
  OTT: "VOT",
  SRB: "VSR",
  MNE: "VMN",
  BEL: "VBE",
  ROU: "VRO",
  BGR: "VBG",
  GRC: "VGR",
};

/** The country a vassal slot was cut from; null for any other tag. */
export function gwSlotOf(tag: GwTag): GwTag | null {
  for (const [of, slot] of Object.entries(GW_VASSAL_SLOTS)) {
    if (slot === tag) return of as GwTag;
  }
  return null;
}

export function isGwTag(v: string): v is GwTag {
  return (GW_TAGS as readonly string[]).includes(v);
}

/** Seats with their own desk and people: the lobby offers these. */
export const GW_WRITTEN_TAGS = [
  "DEU",
  "GBR",
  "AUH",
  "RUS",
  "FRA",
] as const satisfies readonly GwTag[];
/**
 * The seats a friends' lobby offers: the written countries (owner's ww160
 * call 1; France the fifth, ww166 call 8). The rest are played by their AI.
 */
export const GW_SEAT_TAGS: readonly GwTag[] = GW_WRITTEN_TAGS;
export const GW_MAX_SEATS = GW_WRITTEN_TAGS.length;

export function isGwSeatTag(v: string): boolean {
  return (GW_SEAT_TAGS as readonly string[]).includes(v);
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
  OTT: {
    name: "Ottoman Empire",
    flag: "Ottoman Empire",
    color: [185, 145, 110],
  },
  SRB: { name: "Serbia", flag: "rs", color: [150, 70, 90] },
  MNE: { name: "Montenegro", flag: "me", color: [170, 110, 60] },
  ESP: { name: "Spain", flag: "spain", color: [195, 155, 75] },
  // ww199: new states 1936 has no row for. Flags: F in ww199-format.md.
  LVA: {
    name: "Baltic Duchy",
    flag: "Duchy of Courland and Semigallia",
    color: [155, 65, 75],
  },
  UKR: { name: "Ukraine", flag: "ua", color: [205, 185, 85] },
  GEO: { name: "Georgia", flag: "ge", color: [160, 70, 70] },
  HEJ: { name: "Hejaz", flag: "Arabia", color: [95, 140, 80] },
  CZE: { name: "Bohemia", flag: "cz", color: [100, 160, 210] },
  RHN: { name: "Rhineland", flag: "Rhenish Republic", color: [120, 165, 120] },
  FLA: { name: "Flanders", flag: "Flanders", color: [225, 200, 80] },
};

/** A country's name, flag and colour; 1936's row for a shared tag. */
export function gwCountry(tag: GwTag): GwCountryDef {
  // A vassal slot wears the colour and flag of the country it was cut from.
  const of = gwSlotOf(tag);
  if (of !== null)
    return { ...gwCountry(of), name: `${gwCountry(of).name} (dependency)` };
  const own = OWN[tag];
  if (own !== undefined) return own;
  if (!isCountryTag(tag)) throw new Error(`no row for country ${tag}`);
  const def = COUNTRIES[tag as CountryTag];
  return { name: def.name, flag: def.flag, color: def.color };
}
