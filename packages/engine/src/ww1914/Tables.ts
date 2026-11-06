// Great War 1914: the world's fixed numbers. Everything here is a starting
// guess at June 1914 (design §4); the seed moves it inside these bounds.
import {
  GW_THEATRES,
  GwGauge,
  GwPlan,
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
  DEU: { west: 5, east: 2, balkan: 1, sea: 3, colonies: 1 },
  AUH: { east: 2, balkan: 3, italy: 3 },
  RUS: { east: 3, caucasus: 3 },
  FRA: { west: 4, colonies: 1, straits: 1 },
  GBR: {
    west: 2,
    sea: 5,
    straits: 2,
    mesopotamia: 2,
    palestine: 2,
    colonies: 3,
  },
  ITA: { italy: 3 },
  OTT: { caucasus: 2, straits: 3, mesopotamia: 2, palestine: 2 },
  USA: { west: 3, sea: 2 },
  JPN: { colonies: 2 },
  SRB: { balkan: 3 },
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
  balkan: SIDES(["AUH", "BGR", "DEU"], ["SRB", "MNE", "GRC"]),
  italy: SIDES(["AUH"], ["ITA"]),
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
  DEU: ["west", "east", "sea"],
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
  AUH: { shells: 1, order: 2 },
  RUS: { shells: 1, bread: 3, order: 2, money: 1 },
  FRA: { shells: 2, morale: 4 },
  GBR: { money: 3, bread: 2, order: 4 },
  OTT: { shells: 1, money: 0, order: 2 },
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
}

/** Neutrals that can come in (design §10), in the order they are asked. */
export const GW_ENTRIES: readonly GwEntry[] = [
  { tag: "JPN", earliest: "1914-08-20", natural: "entente", start: 45 },
  { tag: "OTT", earliest: "1914-10-15", natural: "central", start: 40 },
  { tag: "ITA", earliest: "1915-03-01", natural: null, start: 20 },
  { tag: "BGR", earliest: "1915-08-01", natural: "central", start: 20 },
  { tag: "ROU", earliest: "1916-05-01", natural: "entente", start: 10 },
  { tag: "GRC", earliest: "1917-04-01", natural: "entente", start: 5 },
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
  Partial<Record<GwTag, { scene: string; wait: string }>>
> = {
  DEU: { scene: "deu_c_mobilise", wait: "wait_day" },
};

/** A scene's flag is the war plan signed: scenes set flags, the world reads. */
export const GW_PLAN_FLAGS: Readonly<Partial<Record<string, GwPlan>>> = {
  f_west_plan: "west",
  f_east_first: "east",
};
