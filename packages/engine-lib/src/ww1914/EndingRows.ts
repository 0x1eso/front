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

/** Whatever the war came to. */
const ANY_WAR: readonly GwEnding[] = [
  "deadline",
  "victory_peace",
  "armistice_conference",
  "compromise_peace",
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
      of: ["compromise_peace"],
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
    { id: "auh_e_dissolution", of: ["armistice_conference"] },
    { id: "auh_e_deadline", of: ["deadline"] },
  ],
  RUS: [
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
      of: ["compromise_peace"],
      when: seatOut("RUS"),
    },
    {
      id: "rus_straits_won",
      of: ["victory_peace"],
      when: all(
        regime("tsar", "crown"),
        any(
          world({ is: "front", theatre: "straits", from: "constantinople" }),
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

/** A country's endings, for the shelf's empty boxes. */
export function gwEndingsOf(tag: GwTag): readonly GwEnding[] {
  const rows = (GW_ENDING_ROWS[tag] ?? []).map((r) => r.id);
  if (rows.length === 0) return GW_ENDINGS.slice(1, 10);
  const own = `${tag.toLowerCase()}_r_`;
  const gone = GW_ENDINGS.filter((e) => e.startsWith(own));
  return [...new Set(rows), ...gone, ...FIRST_WINTER];
}
