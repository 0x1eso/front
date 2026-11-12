// Great War 1914: each country's endings (design §7). The world says how the
// game closed in general (Endings.ts); a row here says what that was for this
// country. The first row that fits wins, so the rarest come first. A later
// country adds a list; with none, the general ending stands.
import {
  GW_ENDINGS,
  GwEnding,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { all, any, flag, GwCond } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

export interface GwEndingRow {
  readonly id: GwEnding;
  /** The general endings it can stand for. */
  readonly of: readonly GwEnding[];
  readonly when?: GwCond;
}

const out = (tag: GwTag): GwCond => world({ is: "out", tag });
const regime = (...of: string[]): GwCond => world({ is: "regime", of });
const seatOut = (tag: GwTag): GwCond => world({ is: "out", tag });

/**
 * The general endings the state gives (ww172, design ww168 7A): a peace of
 * one's own, a war of the two won or lost, occupation held or suffered.
 * `deadline` is the war that goes on.
 */
export const GW_STATE_ENDINGS: readonly GwEnding[] = [
  "separate_peace",
  "pair_war_won",
  "pair_war_lost",
  "occupation_held",
  "under_occupation",
];

/** Whatever the war came to. */
const ANY_WAR: readonly GwEnding[] = [
  "deadline",
  "victory_peace",
  "armistice_conference",
  "compromise_peace",
  ...GW_STATE_ENDINGS,
];
const ANY_END: readonly GwEnding[] = [
  ...ANY_WAR,
  "home_collapse",
  "long_peace",
];

/** The short calendar's endings: every country can close on them. */
const FIRST_WINTER: readonly GwEnding[] = [
  "first_winter_ahead",
  "first_winter_level",
  "first_winter_behind",
];

export const GW_ENDING_ROWS: Readonly<
  Partial<Record<GwTag, readonly GwEndingRow[]>>
> = {
  DEU: [
    { id: "deu_end_abdicated", of: ["deu_end_abdicated"] },
    { id: "deu_end_set_aside", of: ["deu_end_set_aside"] },
    { id: "deu_paris_dictated", of: ["victory_peace"], when: out("FRA") },
    {
      id: "deu_east_won",
      of: ["victory_peace", "compromise_peace"],
      when: out("RUS"),
    },
    {
      id: "deu_peace_of_exhaustion",
      of: ["deadline"],
      when: world({ is: "score", min: -15, max: 15 }),
    },
    {
      id: "deu_republic_signs",
      of: ["armistice_conference"],
      when: regime("republic"),
    },
    {
      id: "deu_november",
      of: ["armistice_conference"],
      when: world({ is: "unrest", min: 3 }),
    },
    {
      id: "deu_hunger_peace",
      of: ["armistice_conference"],
      when: { kind: "gauge", gauge: "bread", max: 1 },
    },
  ],
  GBR: [
    { id: "gbr_end_resigned", of: ["gbr_end_resigned"] },
    { id: "gbr_end_turned_out", of: ["gbr_end_turned_out"] },
    { id: "gbr_end_polls", of: ["gbr_end_polls"] },
    {
      id: "gbr_end_outside",
      of: [...ANY_WAR, ...FIRST_WINTER],
      when: all(world({ is: "neutral", tag: "GBR" }), out("FRA")),
    },
    {
      id: "gbr_end_neutral",
      of: [...ANY_WAR, ...FIRST_WINTER],
      when: world({ is: "neutral", tag: "GBR" }),
    },
    { id: "gbr_end_long_peace", of: ["long_peace"] },
    { id: "gbr_end_fell", of: ["home_collapse"] },
    {
      id: "gbr_end_other_hands",
      of: ["victory_peace", "armistice_conference"],
      when: flag("f_pm_lg"),
    },
    {
      id: "gbr_end_master",
      of: ["victory_peace"],
      when: all(
        world({ is: "entered", tag: "USA", side: "entente" }),
        world({ is: "blockade", min: 5 }),
        { kind: "gauge", gauge: "money", min: 1 },
      ),
    },
    { id: "gbr_end_dear_win", of: ["victory_peace"] },
    {
      id: "gbr_end_island",
      of: ["deadline", "compromise_peace", "armistice_conference"],
      when: out("FRA"),
    },
    { id: "gbr_end_compromise", of: ["compromise_peace"] },
    { id: "gbr_end_deadline", of: ["deadline"] },
  ],
  AUH: [
    { id: "auh_e_abdicated", of: ["auh_e_abdicated"] },
    { id: "auh_e_regency", of: ["auh_e_regency"] },
    { id: "auh_e_federal", of: ANY_END, when: flag("f_auh_federal") },
    {
      id: "auh_e_personal_union",
      of: ANY_END,
      when: flag("f_auh_personal_union"),
    },
    {
      id: "auh_e_remnant",
      of: ANY_END,
      when: regime("austria_republic", "crown_remnant"),
    },
    {
      id: "auh_e_serbia_punished",
      of: ["long_peace", "compromise_peace", "victory_peace"],
      when: flag("f_auh_serbia_punished"),
    },
    { id: "auh_e_long_peace", of: ["long_peace"] },
    {
      id: "auh_e_separate_peace",
      of: ["compromise_peace", "separate_peace"],
      when: seatOut("AUH"),
    },
    {
      id: "auh_e_vassal",
      of: ["victory_peace"],
      when: { kind: "inst", inst: "berlin", min: 3 },
    },
    { id: "auh_e_victor_carried", of: ["victory_peace"] },
    { id: "auh_e_compromise", of: ["compromise_peace"] },
    {
      id: "auh_e_dissolution",
      of: ["home_collapse"],
      when: { kind: "inst", inst: "nations", max: -3 },
    },
    { id: "auh_e_army_gone", of: ["home_collapse"] },
    {
      id: "auh_e_dissolution",
      of: ["armistice_conference"],
      when: { kind: "inst", inst: "nations", max: -3 },
    },
    { id: "auh_e_conference", of: ["armistice_conference"] },
    { id: "auh_e_deadline", of: ["deadline"] },
  ],
  RUS: [
    { id: "rus_abdicated", of: ["rus_abdicated"] },
    { id: "rus_palace_coup", of: ["rus_palace_coup"] },
    {
      id: "rus_serbia_abandoned",
      of: ["long_peace"],
      when: world({ is: "aside" }),
    },
    {
      id: "rus_great_programme",
      of: ["long_peace"],
      when: flag("f_rus_programme"),
    },
    { id: "rus_civil_war", of: ANY_END, when: flag("f_rus_civil_war") },
    { id: "rus_assembly_republic", of: ANY_WAR, when: regime("rep") },
    {
      id: "rus_separate_peace",
      of: ["compromise_peace", "separate_peace"],
      when: seatOut("RUS"),
    },
    {
      id: "rus_straits_won",
      of: ["victory_peace"],
      when: all(
        regime("tsar", "crown"),
        any(
          world({
            is: "front",
            theatre: "straits",
            from: "constantinople",
            to: "constantinople",
          }),
          flag("f_rus_bosporus_landed"),
        ),
      ),
    },
    { id: "rus_boy_tsar", of: ANY_WAR, when: regime("regency") },
    {
      id: "rus_crown_of_duma",
      of: ["victory_peace", "compromise_peace"],
      when: regime("crown"),
    },
    {
      id: "rus_tsar_at_conference",
      of: ["victory_peace"],
      when: regime("tsar"),
    },
    { id: "rus_provisional_holds", of: ANY_WAR, when: regime("provisional") },
    {
      id: "rus_october",
      of: ["home_collapse"],
      when: regime("provisional", "rep"),
    },
    { id: "rus_tsar_falls", of: ["home_collapse"] },
  ],
  // France (ww166): the President stays to the end; what the end was.
  FRA: [
    { id: "fra_end_stood_down", of: ["fra_end_stood_down"] },
    { id: "fra_end_resigned", of: ["fra_end_resigned"] },
    {
      id: "fra_end_alliance",
      of: [...ANY_END, ...FIRST_WINTER],
      when: flag("f_alliance_broken"),
    },
    { id: "fra_end_long_peace", of: ["long_peace"] },
    { id: "fra_end_mutiny", of: ["home_collapse"] },
    {
      id: "fra_end_mutiny",
      of: ["compromise_peace", "armistice_conference"],
      when: any(
        { kind: "seen", scene: "fra_big_mutiny" },
        { kind: "inst", inst: "army", max: -3 },
      ),
    },
    {
      id: "fra_end_bordeaux",
      of: ANY_WAR,
      when: all(
        flag("f_gov_bordeaux"),
        world({ is: "front", theatre: "west", from: "marne", to: "paris" }),
      ),
    },
    {
      id: "fra_end_alone_west",
      of: ["deadline", "compromise_peace", "armistice_conference"],
      when: out("GBR"),
    },
    { id: "fra_end_bordeaux", of: ["armistice_conference"] },
    { id: "fra_end_white", of: ["compromise_peace"] },
    {
      id: "fra_end_rhine",
      of: ["victory_peace"],
      when: world({ is: "front", theatre: "west", from: "rhine", to: "rhine" }),
    },
    { id: "fra_end_tiger", of: ["victory_peace"], when: regime("fra_tiger") },
    {
      id: "fra_end_conference",
      of: ["victory_peace"],
      when: all(
        world({ is: "entered", tag: "USA", side: "entente" }),
        world({ is: "entered", tag: "GBR", side: "entente" }),
      ),
    },
    { id: "fra_end_alsace", of: ["victory_peace"] },
    { id: "fra_end_deadline", of: ["deadline"] },
  ],
};

/** A paragraph a country's memoir closes on: the first that holds. */
export const GW_ENDING_CODAS: Readonly<
  Partial<Record<GwTag, readonly { id: string; when: GwCond }[]>>
> = {
  GBR: [
    {
      id: "gbr_end_ireland_draft",
      when: { kind: "seen", scene: "gbr_h_irish_draft" },
    },
    {
      id: "gbr_end_ireland_easter",
      when: { kind: "seen", scene: "gbr_h_easter" },
    },
    { id: "gbr_end_ireland_lives", when: flag("f_home_rule_lives") },
  ],
};

/**
 * Memoir lines on the land (ww172): after a country's own coda, the first
 * that holds. Text in each seat's pack, `endings.<id>` of `<SEAT>.lands.json`;
 * a seat with no line for it shows none.
 */
export const GW_LAND_CODAS: readonly { id: string; when: GwCond }[] = [
  {
    id: "land_coda_capital_lost",
    when: world({ is: "land_lost", capital: true }),
  },
  {
    id: "land_coda_capital_taken",
    when: world({ is: "land_taken", capital: true }),
  },
  {
    id: "land_coda_pair_lost",
    when: world({ is: "pair_table", open: false, result: ["lost"] }),
  },
  {
    id: "land_coda_pair_won",
    when: world({ is: "pair_table", open: false, result: ["won"] }),
  },
  {
    id: "land_coda_pair_even",
    when: world({ is: "pair_table", open: false, result: ["even"] }),
  },
  { id: "land_coda_lost", when: world({ is: "land_lost" }) },
  { id: "land_coda_held", when: world({ is: "land_taken" }) },
];

/** A country's endings, for the shelf's empty boxes. */
export function gwEndingsOf(tag: GwTag): readonly GwEnding[] {
  const rows = (GW_ENDING_ROWS[tag] ?? []).map((r) => r.id);
  if (rows.length === 0) return GW_ENDINGS.slice(1, 10);
  const own = `${tag.toLowerCase()}_r_`;
  const gone = GW_ENDINGS.filter((e) => e.startsWith(own));
  return [...new Set(rows), ...gone, ...FIRST_WINTER, ...GW_STATE_ENDINGS];
}
