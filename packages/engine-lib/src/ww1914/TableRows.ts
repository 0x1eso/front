// Great War 1914: what the countries bring to the peace table. Plain data, read
// by engine/ww1914/Table and by the screens. History is a guide: these are what
// each country came for, most wanted first, and the map decides what it gets.
import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";

/** Months of the peace: `CONFERENCE_CHAPTERS` in Peace.ts must agree. */
export const GW_TABLE_SESSIONS = 3;
/** Times round the table in a month. */
export const GW_TABLE_ROUNDS = 3;

/** Who speaks first on each side. */
export const GW_TABLE_ORDER: Readonly<Record<GwSide, readonly GwTag[]>> = {
  entente: [
    "FRA",
    "GBR",
    "USA",
    "ITA",
    "RUS",
    "JPN",
    "SRB",
    "ROU",
    "GRC",
    "BEL",
    "MNE",
  ],
  central: ["DEU", "AUH", "OTT", "BGR"],
};

/** What each country came for, most wanted first. Own land is never here. */
export const GW_TABLE_AIMS: Readonly<
  Partial<Record<GwTag, readonly GwPlace[]>>
> = {
  FRA: [
    "metz",
    "strasbourg",
    "mulhouse",
    "saarbrucken",
    "beirut",
    "damascus",
    "togo",
    "kamerun",
    "aleppo",
  ],
  GBR: [
    "baghdad",
    "basra",
    "jerusalem",
    "dar_es_salaam",
    "mosul",
    "gaza",
    "amman",
    "windhoek",
    "kamerun",
  ],
  RUS: [
    "constantinople",
    "gallipoli",
    "canakkale",
    "lemberg",
    "czernowitz",
    "erzurum",
    "trabzon",
    "tarnopol",
    "van",
    "bitlis",
  ],
  ITA: [
    "trento",
    "trieste",
    "bozen",
    "gorizia",
    "pola",
    "zara",
    "valona",
    "split",
  ],
  SRB: ["sarajevo", "mostar", "banja_luka", "novi_sad", "split", "zagreb"],
  ROU: [
    "kolozsvar",
    "brasso",
    "nagyszeben",
    "temesvar",
    "nagyvarad",
    "czernowitz",
  ],
  GRC: ["edirne", "rodosto", "dedeagach"],
  MNE: ["scutari", "mostar"],
  DEU: [
    "liege",
    "antwerp",
    "namur",
    "ostend",
    "verdun",
    "sedan",
    "riga",
    "kovno",
    "warsaw",
    "lodz",
    "vilna",
    "mitau",
  ],
  AUH: [
    "belgrade",
    "valjevo",
    "cetinje",
    "lublin",
    "kielce",
    "uzice",
    "radom",
    "pec",
  ],
  OTT: ["kars", "ardahan", "akkerman"],
  BGR: ["skopje", "bitola", "nis", "pristina", "salonika", "constanta"],
};

/** Where a free port makes sense. */
export const GW_TABLE_PORTS: readonly GwPlace[] = [
  "antwerp",
  "ostend",
  "calais",
  "hamburg",
  "danzig",
  "konigsberg",
  "memel",
  "riga",
  "windau",
  "trieste",
  "fiume",
  "pola",
  "split",
  "zara",
  "durazzo",
  "valona",
  "salonika",
  "constantinople",
  "beirut",
  "basra",
  "varna",
  "constanta",
  "venice",
];

/** A capital: nobody gives it up at a table. */
export const GW_TABLE_CAPITALS: readonly GwPlace[] = [
  "berlin",
  "vienna",
  "budapest",
  "paris",
  "petrograd",
  "moscow",
  "constantinople",
  "sofia",
  "bucharest",
  "belgrade",
  "athens",
  "brussels",
];

/** Land a country counts as itself, not as something it holds. */
export const GW_TABLE_HEART: Readonly<
  Partial<Record<GwTag, readonly string[]>>
> = {
  DEU: ["germany", "rhineland", "silesia", "east_prussia", "west_prussia"],
  AUH: ["austria", "hungary", "bohemia", "moravia"],
  RUS: ["russia", "baltic", "west_russia", "ukraine"],
  FRA: ["france", "western_front"],
  ITA: ["piave"],
  OTT: ["straits"],
  SRB: ["serbia"],
  BEL: ["belgium", "flanders"],
  ROU: ["romania"],
  BGR: ["bulgaria"],
  GRC: ["greece"],
};
