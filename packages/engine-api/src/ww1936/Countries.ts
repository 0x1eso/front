/**
 * World War 1936 (spec §5.1): the countries of 1 January 1936. The order is
 * the player order: a country's smallID is its index among the countries
 * present in the loaded scenario, plus one (plan decision 2). Tags follow
 * ISO 3166-1 alpha-3 where one exists and are this fork's own otherwise.
 * Names and leaders on screen come from resources/lang
 * (`ww1936.country.<TAG>`, `ww1936.leader.<TAG>`).
 *
 * APPEND ONLY, NEVER REORDER OR REMOVE: this list is a wire enum
 * (`z.enum(COUNTRY_TAGS)` in PlayerSchema.country, countryPicks,
 * pick_country and scenario.json; zbin encodes the index), and its order
 * defines every country's smallID, hence the simulation and its replays.
 */
export const COUNTRY_TAGS = [
  // Majors
  "DEU",
  "ITA",
  "JPN",
  "GBR",
  "FRA",
  "USA",
  "SUN",
  // Europe
  "POL",
  "CSK",
  "AUT",
  "HUN",
  "ROU",
  "YUG",
  "BGR",
  "GRC",
  "ALB",
  "TUR",
  "BEL",
  "NLD",
  "LUX",
  "CHE",
  "ESR",
  "ESN",
  "PRT",
  "IRL",
  "DNK",
  "ISL",
  "NOR",
  "SWE",
  "FIN",
  "EST",
  "LVA",
  "LTU",
  "DZG",
  // Middle East and Asia
  "IRQ",
  "IRN",
  "SAU",
  "YEM",
  "AFG",
  "CHN",
  "CCP",
  "GXC",
  "SXI",
  "YUN",
  "XBM",
  "SIK",
  "TIB",
  "MCK",
  "MNG",
  "TTU",
  "THA",
  "NPL",
  "RAJ",
  // Africa
  "ETH",
  "LBR",
  "ZAF",
  // Americas
  "CAN",
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
  // Oceania
  "AUS",
  "NZL",
  // P5 (P5 spec §3.2): dormant slots, players from tick 0 with no land.
  // Never picked in the lobby (scenarioTags / PICK_ORDER leave them out).
  "SVK",
  "HRV",
  "VIC",
  "RSI",
  "RNG",
  "MEN",
  "BRM",
  "PHL",
  "CW1",
  "CW2",
  "CW3",
  "CW4",
  "CW5",
  "CW6",
] as const;
export type CountryTag = (typeof COUNTRY_TAGS)[number];

export function isCountryTag(v: string): v is CountryTag {
  return (COUNTRY_TAGS as readonly string[]).includes(v);
}

/** P5 spec §3.2: the named dormant countries (woken by events or peace treaties). */
export const NAMED_DORMANT_TAGS = [
  "SVK",
  "HRV",
  "VIC",
  "RSI",
  "RNG",
  "MEN",
  "BRM",
  "PHL",
] as const;
/** P5 spec §3.5, §15: the civil-war slots (a breakaway side's country). */
export const CIVIL_WAR_SLOTS = [
  "CW1",
  "CW2",
  "CW3",
  "CW4",
  "CW5",
  "CW6",
] as const;
/** P5 spec §3.2: every dormant slot, in COUNTRY_TAGS order (the last 14 tags). */
export const DORMANT_TAGS = [
  ...NAMED_DORMANT_TAGS,
  ...CIVIL_WAR_SLOTS,
] as const;
export function isDormantTag(t: string): boolean {
  return (DORMANT_TAGS as readonly string[]).includes(t);
}

/** The starting factions (spec §5.2), in camp order (Score.campRank). */
export const FACTION_IDS = ["axis", "allies", "comintern"] as const;
export type FactionId = (typeof FACTION_IDS)[number];

/** Lobby list sections (spec §8.1). */
export const COUNTRY_GROUPS = [
  "europe",
  "asia",
  "americas",
  "africa_oceania",
] as const;
export type CountryGroup = (typeof COUNTRY_GROUPS)[number];

export interface CountryDef {
  /** English name: the player's name, and the label drawn on the map. */
  readonly name: string;
  /** File name stem in resources/flags (drawn as /flags/<flag>.svg). */
  readonly flag: string;
  /** Territory colour, RGB. */
  readonly color: readonly [number, number, number];
  readonly faction: FactionId | null;
  readonly major: boolean;
  /** Share of its starting victory points (percent) lost at which it capitulates. */
  readonly surrenderPct: number;
  readonly group: CountryGroup;
}

type Extra = Partial<Pick<CountryDef, "faction" | "major" | "surrenderPct">>;

function def(
  name: string,
  flag: string,
  color: readonly [number, number, number],
  group: CountryGroup,
  extra: Extra = {},
): CountryDef {
  return {
    name,
    flag,
    color,
    group,
    faction: extra.faction ?? null,
    major: extra.major ?? false,
    surrenderPct: extra.surrenderPct ?? 80,
  };
}

const AXIS = { faction: "axis" } as const;
const ALLIES = { faction: "allies" } as const;
const COMINTERN = { faction: "comintern" } as const;

export const COUNTRIES: Readonly<Record<CountryTag, CountryDef>> = {
  DEU: def("Germany", "German Empire", [110, 110, 110], "europe", {
    ...AXIS,
    major: true,
  }),
  ITA: def("Italy", "italy", [64, 140, 70], "europe", { ...AXIS, major: true }),
  JPN: def("Japan", "jp", [226, 205, 140], "asia", { ...AXIS, major: true }),
  GBR: def("United Kingdom", "gb", [200, 60, 70], "europe", {
    ...ALLIES,
    major: true,
  }),
  // P2 Task 11 (controller ruling): HOI4-style per-country surrender
  // limits for the colonial empires, about 80% of their homeland's share
  // of their points (France 62 of 162, Belgium 6 of 19, the Netherlands 9
  // of 28 are homeland; the rest lie in colonies).
  FRA: def("France", "fr", [60, 95, 200], "europe", {
    ...ALLIES,
    major: true,
    surrenderPct: 31,
  }),
  USA: def("United States", "us", [75, 120, 175], "americas", { major: true }),
  SUN: def("Soviet Union", "ussr", [150, 30, 30], "europe", {
    ...COMINTERN,
    major: true,
    surrenderPct: 90,
  }),
  POL: def("Poland", "pl", [210, 100, 130], "europe"),
  CSK: def("Czechoslovakia", "cz", [100, 160, 210], "europe"),
  AUT: def("Austria", "at", [215, 215, 225], "europe"),
  HUN: def("Hungary", "Kingdom of Hungary", [150, 175, 120], "europe"),
  ROU: def("Romania", "ro", [215, 190, 70], "europe"),
  YUG: def("Yugoslavia", "ww1936_YUG", [110, 120, 180], "europe"),
  BGR: def("Bulgaria", "bg", [90, 145, 95], "europe"),
  GRC: def("Greece", "gr", [120, 180, 220], "europe"),
  ALB: def("Albania", "al", [175, 70, 70], "europe"),
  TUR: def("Turkey", "tr", [185, 145, 110], "europe"),
  BEL: def("Belgium", "be", [205, 175, 60], "europe", { surrenderPct: 25 }),
  NLD: def("Netherlands", "nl", [235, 140, 45], "europe", {
    surrenderPct: 26,
  }),
  LUX: def("Luxembourg", "lu", [130, 175, 225], "europe"),
  CHE: def("Switzerland", "ch", [205, 85, 85], "europe"),
  ESR: def(
    "Spanish Republic",
    "Second Spanish Republic",
    [155, 95, 165],
    "europe",
  ),
  // Final balance (P5 Spain targets): Nationalist Spain's points are Burgos
  // (2) and Spanish Guinea (4), out of the Republic's reach, so at 80% a
  // beaten Nationalist Spain never surrendered and the war ran to 1945. The
  // colonial-empire rule above: 80% of its homeland's share (2 of 6).
  ESN: def("Nationalist Spain", "ww1936_ESN", [195, 155, 75], "europe", {
    surrenderPct: 27,
  }),
  PRT: def("Portugal", "pt", [65, 145, 95], "europe"),
  IRL: def("Ireland", "ie", [90, 175, 95], "europe"),
  DNK: def("Denmark", "dk", [195, 85, 85], "europe"),
  ISL: def("Iceland", "is", [115, 145, 205], "europe"),
  NOR: def("Norway", "no", [175, 95, 95], "europe"),
  SWE: def("Sweden", "se", [75, 125, 195], "europe"),
  FIN: def("Finland", "fi", [200, 215, 235], "europe"),
  EST: def("Estonia", "ee", [85, 115, 175], "europe"),
  LVA: def("Latvia", "lv", [155, 65, 75], "europe"),
  LTU: def("Lithuania", "lt", [215, 185, 65], "europe"),
  DZG: def("Danzig", "Danzig", [205, 125, 85], "europe"),
  IRQ: def("Iraq", "Kingdom_of_Iraq", [135, 165, 95], "asia"),
  IRN: def("Iran", "Pahlavi Iran", [95, 165, 115], "asia"),
  SAU: def("Saudi Arabia", "sa", [65, 125, 65], "asia"),
  YEM: def("Yemen", "Kingdom of Yemen", [185, 95, 95], "asia"),
  AFG: def("Afghanistan", "af", [125, 125, 75], "asia"),
  CHN: def("China", "tw", [215, 195, 125], "asia", { surrenderPct: 90 }),
  CCP: def("Chinese Communists", "Communist flag", [175, 45, 45], "asia"),
  GXC: def("Guangxi Clique", "tw", [125, 165, 125], "asia"),
  SXI: def("Shanxi Clique", "tw", [155, 135, 95], "asia"),
  YUN: def("Yunnan Clique", "tw", [115, 155, 155], "asia"),
  XBM: def("Ma Clique", "tw", [175, 155, 115], "asia"),
  SIK: def("Xinjiang", "tw", [135, 105, 165], "asia"),
  TIB: def("Tibet", "tibet", [195, 165, 95], "asia"),
  MCK: def("Manchukuo", "Flag_of_Manchukuo", [205, 185, 95], "asia", AXIS),
  MNG: def("Mongolia", "mn", [165, 85, 85], "asia", COMINTERN),
  TTU: def("Tannu Tuva", "tannutuva", [175, 115, 95], "asia", COMINTERN),
  THA: def("Siam", "th", [105, 145, 195], "asia"),
  NPL: def("Nepal", "np", [185, 85, 105], "asia"),
  RAJ: def("British Raj", "ww1936_RAJ", [215, 125, 85], "asia", ALLIES),
  ETH: def("Ethiopia", "Ethiopian Empire", [115, 165, 85], "africa_oceania"),
  LBR: def("Liberia", "lr", [155, 115, 155], "africa_oceania"),
  ZAF: def(
    "South Africa",
    "ww1936_ZAF",
    [195, 145, 75],
    "africa_oceania",
    ALLIES,
  ),
  CAN: def("Canada", "ca", [205, 95, 95], "americas", ALLIES),
  MEX: def("Mexico", "mx", [95, 155, 95], "americas"),
  GTM: def("Guatemala", "gt", [125, 175, 215], "americas"),
  HND: def("Honduras", "hn", [95, 125, 195], "americas"),
  SLV: def("El Salvador", "sv", [75, 115, 185], "americas"),
  NIC: def("Nicaragua", "ni", [115, 145, 205], "americas"),
  CRI: def("Costa Rica", "cr", [165, 95, 125], "americas"),
  PAN: def("Panama", "pa", [155, 155, 195], "americas"),
  CUB: def("Cuba", "cu", [95, 125, 175], "americas"),
  HTI: def("Haiti", "ht", [125, 95, 155], "americas"),
  DOM: def("Dominican Republic", "do", [145, 115, 175], "americas"),
  COL: def("Colombia", "co", [205, 185, 85], "americas"),
  VEN: def("Venezuela", "ve", [185, 145, 65], "americas"),
  ECU: def("Ecuador", "ec", [195, 175, 95], "americas"),
  PER: def("Peru", "pe", [195, 95, 95], "americas"),
  BOL: def("Bolivia", "bo", [175, 135, 85], "americas"),
  BRA: def("Brazil", "br", [85, 165, 85], "americas"),
  PRY: def("Paraguay", "py", [165, 115, 115], "americas"),
  URY: def("Uruguay", "uy", [135, 175, 215], "americas"),
  ARG: def("Argentina", "ar", [145, 195, 225], "americas"),
  CHL: def("Chile", "cl", [175, 75, 95], "americas"),
  AUS: def("Australia", "au", [65, 135, 115], "africa_oceania", ALLIES),
  NZL: def("New Zealand", "nz", [75, 95, 155], "africa_oceania", ALLIES),
  // P5 (spec §3.2; colours (내 판단): distinct from their neighbours on the 1936 map).
  SVK: def("Slovakia", "ww_svk", [90, 120, 200], "europe"),
  HRV: def("Croatia", "ww_hrv", [180, 70, 80], "europe"),
  VIC: def("Vichy France", "fr", [130, 140, 190], "europe"),
  RSI: def("Italian Social Republic", "ww_rsi", [90, 110, 70], "europe"),
  RNG: def("Reorganized National Government", "ww_rng", [190, 170, 90], "asia"),
  MEN: def("Mengjiang", "ww_men", [200, 160, 70], "asia"),
  BRM: def("Burma", "ww_brm", [200, 180, 60], "asia"),
  PHL: def("Philippines", "ph", [90, 140, 210], "asia"),
  CW1: def("Breakaway State 1", "ww_cw_neutral", [128, 128, 128], "europe"),
  CW2: def("Breakaway State 2", "ww_cw_neutral", [128, 128, 128], "europe"),
  CW3: def("Breakaway State 3", "ww_cw_neutral", [128, 128, 128], "europe"),
  CW4: def("Breakaway State 4", "ww_cw_neutral", [128, 128, 128], "europe"),
  CW5: def("Breakaway State 5", "ww_cw_neutral", [128, 128, 128], "europe"),
  CW6: def("Breakaway State 6", "ww_cw_neutral", [128, 128, 128], "europe"),
};

export const FACTION_LEADER: Readonly<Record<FactionId, CountryTag>> = {
  axis: "DEU",
  allies: "GBR",
  comintern: "SUN",
};

export const MAJOR_TAGS: readonly CountryTag[] = COUNTRY_TAGS.filter(
  (t) => COUNTRIES[t].major,
);

/** Unpicked humans get the first free country in this order (spec §7.1). */
export const PICK_ORDER: readonly CountryTag[] = (() => {
  const first: CountryTag[] = ["DEU", "GBR", "SUN", "USA", "FRA", "ITA", "JPN"];
  // P5 plan decision 3: the dormant slots are never assigned to anyone.
  return [
    ...first,
    ...COUNTRY_TAGS.filter((t) => !isDormantTag(t) && !first.includes(t)),
  ];
})();
