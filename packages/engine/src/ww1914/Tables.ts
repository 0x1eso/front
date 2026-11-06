// Great War 1914: the world's fixed numbers. Everything here is a starting
// guess at June 1914 (design §4); the seed moves it inside these bounds.
import {
  GW_THEATRES,
  GwGauge,
  GwOpening,
  GwPlan,
  GwResearch,
  GwSide,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

/** Countries the war needs, on the map or not (the test map has five). */
export const GW_ACTORS: readonly GwTag[] = [
  "DEU",
  "AUH",
  "RUS",
  "FRA",
  "GBR",
  "ITA",
  "OTT",
  "USA",
  "JPN",
  "SRB",
  "MNE",
  "BEL",
  "ROU",
  "BGR",
  "GRC",
];

/** Strength bands 1..5 where a country fights; the seed moves each by one. */
export const GW_FORCE: Readonly<
  Partial<Record<GwTag, Partial<Record<GwTheatre, number>>>>
> = {
  DEU: { west: 5, east: 2, balkan: 1, italy: 1, sea: 3, colonies: 1 },
  AUH: { east: 3, balkan: 2, italy: 3 },
  RUS: { east: 4, caucasus: 3 },
  FRA: { west: 4, balkan: 1, colonies: 1, straits: 1 },
  GBR: {
    west: 2,
    sea: 5,
    balkan: 1,
    straits: 2,
    mesopotamia: 1,
    palestine: 1,
    colonies: 3,
  },
  ITA: { italy: 3 },
  OTT: { caucasus: 2, straits: 3, mesopotamia: 2, palestine: 2 },
  USA: { west: 1, sea: 2 },
  JPN: { colonies: 2 },
  SRB: { balkan: 2 },
  MNE: { balkan: 1 },
  BEL: { west: 1 },
  ROU: { east: 2 },
  BGR: { balkan: 3 },
  GRC: { balkan: 1 },
};

const SIDES = (central: GwTag[], entente: GwTag[]) => ({ central, entente });

/** Who fights in a theatre, the lead first. */
export const GW_THEATRE_SIDES: Readonly<
  Record<GwTheatre, Readonly<Record<GwSide, readonly GwTag[]>>>
> = {
  west: SIDES(["DEU"], ["FRA", "GBR", "BEL", "USA"]),
  east: SIDES(["DEU", "AUH"], ["RUS", "ROU"]),
  // Behind Serbia stands whoever lands at Salonika.
  balkan: SIDES(["AUH", "BGR", "DEU"], ["SRB", "MNE", "GRC", "FRA", "GBR"]),
  italy: SIDES(["AUH", "DEU"], ["ITA"]),
  caucasus: SIDES(["OTT"], ["RUS"]),
  straits: SIDES(["OTT"], ["GBR", "FRA"]),
  mesopotamia: SIDES(["OTT"], ["GBR"]),
  palestine: SIDES(["OTT"], ["GBR"]),
  sea: SIDES(["DEU"], ["GBR", "USA"]),
  colonies: SIDES(["DEU"], ["GBR", "FRA", "JPN"]),
};

export function theatresOf(tag: GwTag): GwTheatre[] {
  return GW_THEATRES.filter(
    (t) =>
      GW_THEATRE_SIDES[t].central.includes(tag) ||
      GW_THEATRE_SIDES[t].entente.includes(tag),
  );
}

/** The AI's order of theatres to put its main effort in. */
export const GW_AI_MAIN: Readonly<
  Partial<Record<GwTag, readonly GwTheatre[]>>
> = {
  DEU: ["west", "east", "balkan", "italy"],
  AUH: ["balkan", "east", "italy"],
  RUS: ["east", "caucasus"],
  FRA: ["west", "straits"],
  GBR: ["west", "straits", "mesopotamia", "palestine", "sea"],
  ITA: ["italy"],
  OTT: ["caucasus", "straits", "palestine", "mesopotamia"],
  USA: ["west"],
  JPN: ["colonies"],
  SRB: ["balkan"],
  MNE: ["balkan"],
  BEL: ["west"],
  ROU: ["east"],
  BGR: ["balkan"],
  GRC: ["balkan"],
};

/** What each trains its research on, a year at a time, round and round. */
export const GW_AI_RESEARCH: Readonly<
  Partial<Record<GwTag, readonly GwResearch[]>>
> = {
  DEU: ["artillery", "infantry", "sea", "infantry"],
  GBR: ["artillery", "sea", "infantry", "sea"],
  FRA: ["artillery", "infantry"],
  USA: ["sea", "infantry"],
  AUH: ["artillery", "infantry"],
  RUS: ["artillery", "infantry"],
};

/**
 * New armies: a band more, the given months after a country came in. Kitchener's
 * men, conscription, the Americans crossing: a rule of time and of nothing else.
 */
export const GW_NEW_ARMIES: readonly {
  readonly tag: GwTag;
  readonly theatre: GwTheatre;
  readonly months: readonly number[];
}[] = [
  { tag: "GBR", theatre: "west", months: [8, 15, 22] },
  { tag: "USA", theatre: "west", months: [6, 9, 12, 15] },
  { tag: "DEU", theatre: "east", months: [8] },
  { tag: "RUS", theatre: "east", months: [10] },
  { tag: "ITA", theatre: "italy", months: [12] },
  { tag: "GBR", theatre: "palestine", months: [20] },
  { tag: "GBR", theatre: "mesopotamia", months: [24] },
];

/**
 * Who comes to a theatre only once another has gone from it: the armies landed
 * at Salonika stand behind Serbia, not beside it.
 */
export const GW_BEHIND: Readonly<
  Partial<Record<GwTheatre, { tags: readonly GwTag[]; once: GwTag }>>
> = {
  balkan: { tags: ["FRA", "GBR"], once: "SRB" },
};

/** A front that went quiet sends its divisions elsewhere. */
export const GW_TRANSFERS: readonly {
  /** The country whose leaving frees them. */
  readonly out: GwTag;
  readonly tag: GwTag;
  readonly to: GwTheatre;
  readonly bands: number;
}[] = [
  { out: "RUS", tag: "DEU", to: "west", bands: 2 },
  { out: "RUS", tag: "AUH", to: "italy", bands: 1 },
  { out: "RUS", tag: "OTT", to: "palestine", bands: 1 },
  { out: "SRB", tag: "AUH", to: "east", bands: 1 },
  { out: "ITA", tag: "AUH", to: "east", bands: 1 },
  { out: "FRA", tag: "DEU", to: "east", bands: 2 },
];

export interface GwBeaten {
  readonly tag: GwTag;
  readonly theatre: GwTheatre;
  /** Falls at or past this line of the theatre. */
  readonly from?: string;
  /** Falls at or behind this line. */
  readonly to?: string;
  /** Chapters it stands before the line can decide it. */
  readonly after: number;
  /** Counts only once this country has gone: the front has turned round. */
  readonly behind?: GwTag;
}

/** A country loses the war when its ground goes. */
export const GW_BEATEN: readonly GwBeaten[] = [
  { tag: "FRA", theatre: "west", from: "paris", after: 2 },
  { tag: "RUS", theatre: "east", from: "kiev", after: 24 },
  { tag: "SRB", theatre: "balkan", from: "nis", after: 3 },
  { tag: "MNE", theatre: "balkan", from: "nis", after: 3 },
  { tag: "ROU", theatre: "east", from: "warsaw", after: 3 },
  { tag: "GRC", theatre: "balkan", from: "salonika", after: 3 },
  { tag: "ITA", theatre: "italy", from: "adige", after: 12 },
  { tag: "OTT", theatre: "straits", from: "constantinople", after: 12 },
  { tag: "OTT", theatre: "palestine", from: "damascus", after: 24 },
  { tag: "BGR", theatre: "balkan", to: "belgrade", after: 6, behind: "SRB" },
  { tag: "DEU", theatre: "west", to: "rhine", after: 30 },
];

export const GW_MANPOWER: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 80,
  AUH: 60,
  RUS: 100,
  FRA: 65,
  GBR: 70,
  ITA: 50,
  OTT: 45,
  USA: 100,
  JPN: 40,
  SRB: 30,
  MNE: 10,
  BEL: 15,
  ROU: 25,
  BGR: 25,
  GRC: 20,
};

/** Gauges of June 1914 that differ from the plain start. */
export const GW_GAUGES_1914: Readonly<
  Partial<Record<GwTag, Partial<Record<GwGauge, number>>>>
> = {
  DEU: { shells: 3, morale: 4 },
  AUH: { shells: 1, order: 3 },
  RUS: { shells: 1, bread: 3, order: 3, money: 2 },
  FRA: { shells: 2, morale: 4 },
  GBR: { money: 3, bread: 2, order: 4 },
  OTT: { shells: 2, money: 1, order: 3 },
  USA: { money: 3, bread: 3, order: 4 },
  SRB: { money: 0, shells: 1, morale: 4 },
};

/** What an army makes of its numbers, percent, in attack and defence. */
export const GW_ARMY_QUALITY: Readonly<Partial<Record<GwTag, number>>> = {
  DEU: 112,
  GBR: 105,
  SRB: 100,
  FRA: 100,
  USA: 95,
  BEL: 90,
  BGR: 95,
  RUS: 85,
  AUH: 85,
  OTT: 85,
  ITA: 85,
  ROU: 80,
  GRC: 85,
};

export interface GwEntry {
  readonly tag: GwTag;
  /** The earliest date it can come in, YYYY-MM-DD. */
  readonly earliest: string;
  /** Who it joins with no price and no lean: null, the likelier winner. */
  readonly natural: GwSide | null;
  /** Readiness at the start. */
  readonly start: number;
  /** The most each side can honestly offer it (design §10). */
  readonly offers: Readonly<Record<GwSide, number>>;
  /** Where it watches the war: a side going forward here draws it. */
  readonly watches: GwTheatre;
  /** The scene a seat is asked its price on. */
  readonly scene: string;
}

/** Neutrals that can come in (design §10), in the order they are asked. */
export const GW_ENTRIES: readonly GwEntry[] = [
  {
    tag: "JPN",
    earliest: "1914-08-20",
    natural: "entente",
    start: 45,
    offers: { central: 1, entente: 3 },
    watches: "colonies",
    scene: "gw_price_jpn",
  },
  {
    tag: "OTT",
    earliest: "1914-10-15",
    natural: "central",
    start: 40,
    offers: { central: 4, entente: 2 },
    watches: "east",
    scene: "gw_price_ott",
  },
  {
    tag: "ITA",
    earliest: "1915-03-01",
    natural: null,
    start: 20,
    offers: { central: 2, entente: 4 },
    watches: "east",
    scene: "gw_price_ita",
  },
  {
    tag: "BGR",
    earliest: "1915-08-01",
    natural: "central",
    start: 20,
    offers: { central: 4, entente: 2 },
    watches: "balkan",
    scene: "gw_price_bgr",
  },
  {
    tag: "ROU",
    earliest: "1916-05-01",
    natural: "entente",
    start: 10,
    offers: { central: 2, entente: 4 },
    watches: "east",
    scene: "gw_price_rou",
  },
  {
    tag: "GRC",
    earliest: "1917-04-01",
    natural: "entente",
    start: 5,
    offers: { central: 1, entente: 3 },
    watches: "balkan",
    scene: "gw_price_grc",
  },
];

/** Readiness a neutral needs, by character (design §10). */
export const GW_ENTRY_BAR = {
  cautious: 80,
  hardline: 50,
  opportunist: 60,
  principled: 70,
} as const;

/**
 * The scene a country signs mobilisation on, and the option that puts it off.
 * Twice put off, the world decides (Crises.ts): scene plan §1.
 */
export const GW_MOBILISE: Readonly<
  Partial<
    Record<
      GwTag,
      {
        scene: string;
        wait: string;
        /** Who moves first if the seat won't, and the news of it. */
        first: readonly GwTag[];
        news: string;
      }
    >
  >
> = {
  DEU: {
    scene: "deu_c_mobilise",
    wait: "wait_day",
    first: ["RUS", "FRA"],
    news: "mob_first",
  },
  RUS: {
    scene: "rus_c_general_mob",
    wait: "wait_day",
    first: ["DEU", "AUH"],
    news: "mob_first_central",
  },
};

/** How a seat's own ultimatum heats the crisis (auh_c_note_draft). */
export const GW_NOTE_FLAGS: Readonly<Partial<Record<string, number>>> = {
  f_auh_note_soft: -1,
  f_auh_note_hard: 0,
  f_auh_note_brutal: 2,
};

/** People the opening has already killed. */
export const GW_OPENING_DEAD: readonly {
  readonly person: string;
  readonly openings: readonly GwOpening[];
}[] = [{ person: "auh_ff", openings: ["sarajevo", "sarajevo_delayed"] }];

/** Court people who don't take an army, whatever their rank. */
export const GW_NO_COMMAND: readonly string[] = [
  "auh_karl",
  "auh_ff",
  "auh_friedrich",
];

/** Countries whose long cast shows only those the seat has come across. */
export const GW_HIDE_UNMET: readonly GwTag[] = ["RUS"];

/** The head of state as a person: off the cast tab for that seat. */
export const GW_SEAT_PERSON: Readonly<
  Partial<Record<GwTag, readonly { person: string; flag?: string }[]>>
> = {
  GBR: [{ person: "gbr_lloyd_george", flag: "f_pm_lg" }, { person: "gbr_asquith" }],
  RUS: [{ person: "rus_nicholas" }],
};

/** A scene's flag is the war plan signed: scenes set flags, the world reads. */
export const GW_PLAN_FLAGS: Readonly<Partial<Record<string, GwPlan>>> = {
  f_west_plan: "west",
  f_east_first: "east",
};
