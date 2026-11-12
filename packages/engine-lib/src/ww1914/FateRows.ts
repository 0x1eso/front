// Great War 1914 (ww199): the rows a beaten country's fate reads. The new
// states a table can found, their thrones' real candidates, the terms of
// military government, and how each character of AI winner deals out fates.
// Rules in engine/ww1914/Fate; types in engine-api/ww1914/GwFate.
import type { GwSide } from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwClient,
  GwClientForm,
  GwFate,
  GwFateTerm,
} from "@openfront/engine-api/ww1914/GwFate";
import type { GwPlace } from "@openfront/engine-api/ww1914/GwPlaces";

/**
 * A throne's candidate. `house`: the country whose ruling house he is of
 * (putting the founder's own house on the throne goes against the ally and
 * the neutrals); null for a native pick. Text `gw.fate.crown.<id>` and the
 * pack's crown papers. "regency" (섭정회의에 맡긴다) is always open besides.
 */
export interface GwCrownRow {
  readonly id: string;
  readonly house: GwTag | null;
}

/**
 * A new state a table can found: `of` the country it is cut from, `tag` its
 * player (its own colour and name), the places that make it, its forms (the
 * first is the one it starts with), the candidates, the sides that may found
 * it, and whether its people asked for it (a principled winner founds only
 * those). `grain`: a granary that sends bread to its founder.
 */
export interface GwClientRow {
  readonly id: GwClient;
  readonly of: GwTag;
  readonly tag: GwTag;
  readonly places: readonly GwPlace[];
  readonly forms: readonly GwClientForm[];
  readonly crowns: readonly GwCrownRow[];
  readonly sides: readonly GwSide[];
  readonly asked: boolean;
  readonly grain?: boolean;
}

/**
 * Candidates (F, ww199-format.md): Archduke Karl Stephan for Poland (Act of 5
 * November 1916; the Regency Council from 1917); Wilhelm of Urach, elected
 * Mindaugas II on 11 July 1918; Adolf Friedrich of Mecklenburg for the Baltic
 * Duchy (Nov 1918); Hetman Skoropadsky (29 April 1918) and Archduke Wilhelm
 * (Vasyl Vyshyvanyi); Wilhelm of Wied, Prince of Albania 1914; Hussein bin
 * Ali, King of the Hejaz from 1916; the Czechoslovak National Council
 * (Masaryk); the Raad van Vlaanderen (Dec 1917); Dorten's Rhenish Republic
 * (1919); the Georgian National Council (26 May 1918).
 */
export const GW_CLIENT_ROWS: readonly GwClientRow[] = [
  {
    id: "poland",
    of: "RUS",
    tag: "POL",
    places: [
      "bialystok",
      "chelm",
      "czestochowa",
      "kalisz",
      "kielce",
      "lodz",
      "lomza",
      "lublin",
      "plock",
      "radom",
      "siedlce",
      "suwalki",
      "warsaw",
    ],
    forms: ["regency", "kingdom"],
    crowns: [{ id: "karl_stephan", house: "AUH" }],
    sides: ["central"],
    asked: true,
  },
  {
    id: "lithuania",
    of: "RUS",
    tag: "LTU",
    places: [
      "kovno",
      "marijampole",
      "panevezys",
      "siauliai",
      "telsiai",
      "vilna",
    ],
    forms: ["kingdom", "regency"],
    crowns: [
      { id: "urach", house: "DEU" },
      { id: "prussia", house: "DEU" },
    ],
    sides: ["central"],
    asked: true,
  },
  {
    id: "ukraine",
    of: "RUS",
    tag: "UKR",
    places: [
      "kamenets",
      "kiev",
      "odessa",
      "sevastopol",
      "vinnitsa",
      "zhitomir",
    ],
    forms: ["hetmanate", "republic"],
    crowns: [
      { id: "skoropadsky", house: null },
      { id: "archduke_wilhelm", house: "AUH" },
    ],
    sides: ["central"],
    asked: false,
    grain: true,
  },
  {
    id: "flanders",
    of: "BEL",
    tag: "FLA",
    places: ["antwerp", "ghent", "ostend", "ypres"],
    forms: ["regency", "republic"],
    crowns: [{ id: "raad", house: null }],
    sides: ["central"],
    asked: true,
  },
  {
    id: "albania",
    of: "ALB",
    tag: "ALB",
    places: ["durazzo", "scutari", "valona"],
    forms: ["principality", "protectorate"],
    crowns: [{ id: "wied", house: "DEU" }],
    sides: ["central", "entente"],
    asked: false,
  },
  {
    id: "serbia",
    of: "SRB",
    tag: "SRB",
    places: [
      "belgrade",
      "kragujevac",
      "nis",
      "pristina",
      "uzice",
      "valjevo",
      "zajecar",
    ],
    forms: ["kingdom", "regency"],
    crowns: [],
    sides: ["central"],
    asked: false,
  },
  {
    id: "baltic_duchy",
    of: "RUS",
    tag: "LVA",
    places: ["riga", "mitau", "dvinsk", "windau"],
    forms: ["duchy", "regency"],
    crowns: [
      { id: "adolf_friedrich", house: "DEU" },
      { id: "prussia", house: "DEU" },
    ],
    sides: ["central"],
    asked: false,
  },
  {
    id: "georgia",
    of: "RUS",
    tag: "GEO",
    places: ["tiflis"],
    forms: ["republic"],
    crowns: [{ id: "georgian_council", house: null }],
    sides: ["central"],
    asked: false,
  },
  {
    id: "hejaz",
    of: "OTT",
    tag: "HEJ",
    places: ["mecca", "medina"],
    forms: ["kingdom"],
    crowns: [{ id: "hussein", house: null }],
    sides: ["entente"],
    asked: true,
  },
  {
    id: "bohemia",
    of: "AUH",
    tag: "CZE",
    places: ["budweis", "koniggratz", "pilsen", "prague", "reichenberg"],
    forms: ["republic"],
    crowns: [{ id: "national_council", house: null }],
    sides: ["entente"],
    asked: true,
  },
  {
    id: "rhineland",
    of: "DEU",
    tag: "RHN",
    places: ["aachen", "rhineland", "saarbrucken"],
    forms: ["republic"],
    crowns: [{ id: "dorten", house: null }],
    sides: ["entente"],
    asked: false,
  },
];

export function gwClientRow(id: GwClient): GwClientRow {
  return GW_CLIENT_ROWS.find((r) => r.id === id)!;
}

/** The state a place belongs to, of those cut from its owner; null for none. */
export function gwClientOfPlace(place: GwPlace): GwClientRow | null {
  return GW_CLIENT_ROWS.find((r) => r.places.includes(place)) ?? null;
}

/** The crown pick for a regency council: open on every state. */
export const GW_REGENCY = "regency";

/** Days a military government lasts by its term: 2 years and 5 (design §2.2). */
export const GW_FATE_TERM_DAYS: Readonly<Record<GwFateTerm, number>> = {
  short: 730,
  long: 1826,
};

/** A new state's loyalty at founding, and the most. */
export const GW_CLIENT_LOYALTY = 2;
/** Months between two drifts of loyalty; of bread from a granary; of legions. */
export const GW_CLIENT_DRIFT_MONTHS = 6;
export const GW_CLIENT_BREAD_MONTHS = 3;
/** A founder's side losing this badly turns its states (warScore). */
export const GW_CLIENT_LOSING = -30;
/** Months a beaten country holds a grudge for land annexed (10 years). */
export const GW_REVANCHE_MONTHS = 120;
/** Each place lost counts this on warCase's desire, up to the most. */
export const GW_REVANCHE_EACH = 12;
export const GW_REVANCHE_MOST = 36;
/** Annexed land: its resistance rises every this many months. */
export const GW_ANNEX_RESIST_MONTHS = 9;
/** America's readiness a heart annexed or an own-house throne adds while neutral. */
export const GW_FATE_OUTRAGE = 5;
/** A vassal's tribute: money and bread every this many months. */
export const GW_VASSAL_TRIBUTE_MONTHS = 6;

/**
 * How each AI character deals out a beaten country's land (design §3).
 * `annexAims`: its known case (GW_TABLE_AIMS) and hearts; `annexMost`: how many
 * at most (-1 any); `annexCapitals`: a capital too. `states`: "aim" where an
 * aim lies, "all" every open one, "asked" those whose people asked, "none".
 * `ownHouse`: crowns its own house where it can. `rest`: the fate of what
 * it holds beyond. `term`: of an occupation. `vassal`: makes the beaten a
 * vassal where it holds the capital of a country that is not a great power.
 */
export interface GwAiFates {
  readonly annexAims: boolean;
  readonly annexPorts: boolean;
  readonly annexMost: number;
  readonly annexCapitals: boolean;
  readonly states: "aim" | "all" | "asked" | "none";
  readonly ownHouse: boolean;
  readonly rest: GwFate;
  readonly term: GwFateTerm;
  readonly vassal: boolean;
}

export const GW_AI_FATES: Readonly<
  Record<"hardline" | "opportunist" | "cautious" | "principled", GwAiFates>
> = {
  hardline: {
    annexAims: true,
    annexPorts: false,
    annexMost: -1,
    annexCapitals: true,
    states: "aim",
    ownHouse: true,
    rest: "occupy",
    term: "long",
    vassal: true,
  },
  opportunist: {
    annexAims: false,
    annexPorts: true,
    annexMost: -1,
    annexCapitals: false,
    states: "all",
    ownHouse: true,
    rest: "occupy",
    term: "short",
    vassal: true,
  },
  cautious: {
    annexAims: true,
    annexPorts: false,
    annexMost: 2,
    annexCapitals: false,
    states: "none",
    ownHouse: false,
    rest: "return",
    term: "short",
    vassal: false,
  },
  principled: {
    annexAims: false,
    annexPorts: false,
    annexMost: 0,
    annexCapitals: false,
    states: "asked",
    ownHouse: false,
    rest: "return",
    term: "short",
    vassal: false,
  },
};
