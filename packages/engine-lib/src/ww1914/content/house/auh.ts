import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCond,
  GwEffect,
  GwOption,
  GwScene,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";
import {
  all,
  any,
  flag,
  memory,
  not,
  reason,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  gauge,
  held,
  inst,
  isText,
  lawTalk,
  office,
  since,
  war,
} from "../laws/kit";
import {
  cool,
  faction,
  heat,
  isLaw,
  leaderOf,
  low,
  startLaw,
  temper,
  warAge,
} from "./kit";

// AUH's house: factions, what they make of each bill, their own bills, and
// (S2) plots, weaknesses and allies' asks (ww158-format.md). Text in
// resources/ww1914/ko/AUH.house.json. The house itself (chambers, whip, way
// round) is in ./houses.ts and comes into play once this file has factions.
//
// Vienna's factions sit in the Reichsrat, shut until 1917; Budapest's in the
// Diet, where nothing passes against the Party of Work (Tisza). The army and
// the court have no seats: they have tempers and steps only.
//
// Leaders (checked unless marked): Gross chaired the German National
// Association from 1911, House president 1917-18 (en.wikipedia Gustav Groß);
// Wolf one of its vice presidents, and it broke up in 1917 (en.wikipedia
// Deutscher Nationalverband); Hauser governor of Upper Austria 1908-27, a
// priest, party chairman 1918-20 (en.wikipedia Johann Nepomuk Hauser); Staněk,
// Agrarian, chaired the Czech Union 1916-18 and presented its state-rights
// declaration in May 1917 (cs.wikipedia František Staněk); Biliński chaired
// the Polish Club 17 Feb 1915 - May 1917, Leo before him from 1911 or 1912
// (J. Gaul, SHS 7, 2013, via search); Bauer back from Russian captivity Sept
// 1917, on the party's left (en.wikipedia Otto Bauer); Károlyi left his party
// in July 1916 for his own (search: Károlyi biographies); Apponyi party
// president from 1914 (hu.wikipedia Függetlenségi és 48-as Párt, which also
// names Károlyi in 1916). Unchecked: Renner as the party's second man; the
// 1917 suffrage bloc as one body; the Christian Socials as the house-owners'
// party against rent control.

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "AUH" });

/** The Reichsrat sits: called by the realm scene, by Karl, or by the bill. */
const REICHSRAT_OPEN = any(
  flag("f_auh_reichsrat_open"),
  flag("f_auh_house_open"),
  isLaw("auh_reichsrat"),
);
const TISZA_IN: GwCond = {
  kind: "holder",
  office: "hun_pm",
  person: "auh_tisza",
};
const turned = (bloc: GwBloc): GwCond => ({ kind: "bloc", bloc, max: -3 });
const blocAt = (bloc: GwBloc, min: number): GwCond => ({
  kind: "bloc",
  bloc,
  min,
});
const instAt = (
  i: "nations" | "hungary" | "army" | "berlin",
  r: { min?: number; max?: number },
): GwCond => ({ kind: "inst", inst: i, ...r });
const score = (r: { min?: number; max?: number }): GwCond =>
  world({ is: "score", ...r });
/** That pick, these last chapters only: an old wrong fades. */
const lately = (scene: string, pick: string, within: number): GwCond => ({
  kind: "chose",
  scene,
  pick,
  within,
});
const moving = (law: string): GwCond =>
  world({ is: "law", id: law, of: ["persuade", "vote"] });
/** A price paid at once: the promise keeps itself. */
const paid = since("1900-01");
const trustDeu = (delta: number): GwEffect => ({
  kind: "trust",
  tag: "DEU",
  delta,
});

export const AUH_FACTIONS: readonly GwFactionRow[] = [
  // ---- Vienna: the Reichsrat ----
  {
    id: "auh_germans",
    tag: "AUH",
    bloc: "press",
    start: "in",
    strength: 3,
    seats: { reichsrat: 2 },
    leaders: [{ person: "auh_i_gross" }],
    radical: "auh_i_wolf",
    grows: [
      {
        when: instAt("nations", { min: 2 }),
        by: 1,
        every: 6,
        key: "slavs_rise",
      },
      {
        when: all(low("bread", 0), warAge(24)),
        by: -1,
        every: 6,
        key: "hunger",
      },
    ],
    feeds: [
      { when: turned("press"), key: "press_turned" },
      { when: lately("auh_k_amnesty", "full_amnesty", 6), key: "amnesty" },
      { when: flag("f_auh_bohemia_crown"), key: "bohemian_crown", by: 2 },
    ],
    cools: [
      { when: isLaw("auh_oktroi"), key: "oktroi", by: 2 },
      { when: isLaw("auh_galicia"), key: "galicia" },
    ],
    steps: [
      { at: 3, scene: "auh_f_germans_2" },
      { at: 6, scene: "auh_f_germans_3" },
    ],
    bills: ["auh_oktroi"],
    amends: {
      auh_press: "surveillance_office",
      auh_factories: "military_direction",
      auh_rents: "soldiers_families",
    },
    wants: [
      {
        id: "oktroi_first",
        when: not(isLaw("auh_oktroi")),
        keep: isLaw("auh_oktroi"),
        chapters: 8,
      },
      {
        id: "german_officials",
        keep: paid,
        effects: [heat("auh_czech", 1), heat("auh_slavs", 1)],
      },
    ],
  },
  {
    id: "auh_csoc",
    tag: "AUH",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: { reichsrat: 2 },
    leaders: [{ person: "auh_i_hauser" }],
    grows: [
      { when: blocAt("court", 2), by: 1, every: 8, key: "loyal_mood" },
      {
        when: all(low("bread", 0), warAge(18)),
        by: -1,
        every: 8,
        key: "vienna_hungry",
      },
    ],
    feeds: [
      { when: turned("court"), key: "court_turned" },
      { when: low("bread", 0), key: "bread" },
      { when: isText("auh_rents", "all_flats"), key: "rents_all" },
    ],
    cools: [
      { when: isLaw("auh_war_aid"), key: "war_aid", by: 2 },
      { when: blocAt("court", 2), key: "loyal" },
    ],
    steps: [
      { at: 3, scene: "auh_f_csoc_2" },
      { at: 6, scene: "auh_f_csoc_3" },
    ],
    bills: ["auh_war_aid"],
    amends: {
      auh_factories: "complaint_boards",
      auh_rents: "soldiers_families",
    },
    wants: [
      {
        id: "war_aid_next",
        when: not(isLaw("auh_war_aid")),
        keep: isLaw("auh_war_aid"),
        chapters: 8,
      },
      { id: "vienna_flour", keep: paid, effects: [gauge("money", -1)] },
    ],
  },
  {
    id: "auh_czech",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { reichsrat: 2 },
    leaders: [
      {
        person: "auh_kramar",
        when: any(not(flag("f_auh_kramar_held")), flag("f_auh_amnesty")),
      },
      { person: "auh_i_stanek" },
    ],
    grows: [
      {
        when: lately("auh_h_kramar_arrest", "leave_to_court", 12),
        by: 1,
        every: 8,
        key: "martyr",
      },
      {
        when: all(instAt("nations", { max: -2 }), warAge(18)),
        by: 1,
        every: 6,
        key: "bitter",
      },
    ],
    feeds: [
      { when: turned("parliament"), key: "parliament_turned" },
      {
        when: lately("auh_h_kramar_arrest", "leave_to_court", 8),
        key: "kramar_held",
      },
      {
        when: lately("auh_h_regiment28", "strike_it_off", 6),
        key: "regiment28",
      },
      { when: lately("auh_h_bohemia_rule", "let_army", 8), key: "army_rule" },
      { when: isLaw("auh_oktroi"), key: "oktroi", by: 2 },
    ],
    cools: [
      { when: flag("f_auh_amnesty"), key: "amnesty", by: 2 },
      { when: REICHSRAT_OPEN, key: "house_open" },
    ],
    steps: [
      { at: 3, scene: "auh_f_czech_2" },
      { at: 7, scene: "auh_f_czech_3" },
    ],
    amends: { auh_press: "civil_censors", auh_landsturm: "harvest_leave" },
    wants: [
      {
        id: "amnesty",
        when: not(flag("f_auh_amnesty")),
        keep: flag("f_auh_amnesty"),
        chapters: 10,
      },
      {
        id: "house_open",
        when: not(REICHSRAT_OPEN),
        keep: REICHSRAT_OPEN,
        chapters: 8,
      },
      { id: "czech_schools", keep: paid, effects: [heat("auh_germans", 1)] },
    ],
  },
  {
    id: "auh_poles",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { reichsrat: 2 },
    leaders: [{ person: "auh_bilinski" }, { person: "auh_i_leo" }],
    grows: [
      {
        when: flag("f_auh_poland_claimed"),
        by: 1,
        every: 8,
        key: "poland_hope",
      },
    ],
    feeds: [
      { when: flag("f_auh_poland_traded"), key: "poland_traded", by: 2 },
      { when: flag("f_auh_chelm_given"), key: "chelm", by: 3 },
      { when: turned("parliament"), key: "parliament_turned" },
    ],
    cools: [
      { when: isLaw("auh_galicia"), key: "galicia", by: 2 },
      { when: flag("f_auh_poland_claimed"), key: "poland_claimed" },
    ],
    steps: [
      { at: 3, scene: "auh_f_poles_2" },
      { at: 6, scene: "auh_f_poles_3" },
    ],
    bills: ["auh_galicia"],
    amends: { auh_landsturm: "to_forty_five", auh_press: "front_zone" },
    wants: [
      {
        id: "galicia_next",
        when: not(isLaw("auh_galicia")),
        keep: isLaw("auh_galicia"),
        chapters: 8,
      },
      { id: "galicia_aid", keep: paid, effects: [gauge("money", -1)] },
    ],
  },
  {
    id: "auh_slavs",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 1,
    seats: { reichsrat: 1 },
    leaders: [{ person: "auh_korosec" }],
    grows: [
      { when: REICHSRAT_OPEN, by: 1, every: 6, key: "club_formed" },
      { when: flag("f_auh_may_draft"), by: 1, every: 8, key: "declaration" },
    ],
    feeds: [
      { when: turned("parliament"), key: "parliament_turned" },
      { when: instAt("hungary", { min: 3 }), key: "magyar_hold" },
      { when: low("bread", 0), key: "bread" },
    ],
    cools: [
      { when: flag("f_auh_manifesto"), key: "manifesto", by: 2 },
      { when: flag("f_auh_amnesty"), key: "amnesty" },
    ],
    steps: [
      { at: 3, scene: "auh_f_slavs_2" },
      { at: 6, scene: "auh_f_slavs_3" },
    ],
    amends: { auh_press: "civil_censors" },
    wants: [
      {
        id: "amnesty",
        when: not(flag("f_auh_amnesty")),
        keep: flag("f_auh_amnesty"),
        chapters: 10,
      },
      { id: "croatia_heard", keep: paid, effects: [heat("auh_work", 1)] },
    ],
  },
  {
    id: "auh_sd",
    tag: "AUH",
    bloc: "workers",
    start: "in",
    strength: 3,
    seats: { reichsrat: 2 },
    leaders: [{ person: "auh_adler" }, { person: "auh_i_renner" }],
    radical: "auh_i_bauer",
    grows: [
      {
        when: all(low("bread", 0), warAge(24)),
        by: 1,
        every: 6,
        key: "bread_queue",
      },
      {
        when: lately("auh_h_strike_1", "army_in_plants", 8),
        by: 1,
        every: 8,
        key: "plants_army",
      },
    ],
    feeds: [
      { when: turned("workers"), key: "workers_turned" },
      {
        when: isText("auh_factories", "military_direction"),
        key: "factory_law",
      },
      {
        when: lately("auh_h_strike_1", "army_in_plants", 6),
        key: "troops_in_plants",
        by: 2,
      },
      {
        when: lately("auh_k_jan_strike", "call_troops", 6),
        key: "troops_called",
        by: 2,
      },
    ],
    cools: [
      { when: isLaw("auh_rents"), key: "rents", by: 2 },
      { when: flag("f_auh_workers_council"), key: "council_heard" },
      { when: REICHSRAT_OPEN, key: "house_open" },
    ],
    steps: [
      { at: 3, scene: "auh_f_sd_2" },
      { at: 6, scene: "auh_f_sd_3" },
    ],
    bills: ["auh_rents"],
    amends: { auh_factories: "complaint_boards", auh_press: "civil_censors" },
    wants: [
      {
        id: "house_open",
        when: not(REICHSRAT_OPEN),
        keep: REICHSRAT_OPEN,
        chapters: 10,
      },
      {
        id: "rents_next",
        when: not(isLaw("auh_rents")),
        keep: isLaw("auh_rents"),
        chapters: 8,
      },
      { id: "flour_ration", keep: paid, effects: [gauge("money", -1)] },
    ],
  },
  // ---- Budapest: the Diet ----
  {
    id: "auh_work",
    tag: "AUH",
    bloc: "business",
    start: "in",
    strength: 4,
    seats: { budapest: 3 },
    leaders: [{ person: "auh_tisza" }],
    grows: [
      { when: not(TISZA_IN), by: -1, every: 8, key: "tisza_out" },
      {
        when: all(low("bread", 0), warAge(30)),
        by: -1,
        every: 8,
        key: "hunger",
      },
    ],
    feeds: [
      { when: instAt("hungary", { max: -3 }), key: "hungary_slighted" },
      { when: isText("auh_food", "common_committee"), key: "grain_taken" },
      { when: flag("f_auh_oath_delayed"), key: "oath_delayed" },
      { when: isLaw("auh_franchise"), key: "franchise" },
    ],
    cools: [
      { when: flag("f_auh_sworn"), key: "crowned" },
      { when: instAt("hungary", { min: 3 }), key: "hungary_heard" },
    ],
    steps: [
      { at: 4, scene: "auh_f_work_2" },
      { at: 8, scene: "auh_f_work_3" },
    ],
    amends: {
      auh_food: "hungarian_price",
      auh_transylvania: "schools",
      auh_franchise: "soldiers_vote",
    },
    wants: [
      {
        id: "grain_price",
        when: moving("auh_food"),
        keep: paid,
        effects: [gauge("money", -1)],
      },
      {
        id: "honved_home",
        when: moving("auh_landsturm"),
        keep: paid,
        effects: [inst("hungary", 1), inst("army", -1)],
      },
      {
        id: "hungary_first",
        keep: paid,
        effects: [inst("hungary", 1), inst("nations", -1)],
      },
    ],
  },
  {
    id: "auh_indep",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { budapest: 1 },
    leaders: [
      { person: "auh_karolyi", when: faction("auh_karolyi", { of: ["out"] }) },
      { person: "auh_i_apponyi" },
    ],
    grows: [
      {
        when: all(low("bread", 0), warAge(18)),
        by: 1,
        every: 6,
        key: "hunger",
      },
      { when: score({ max: -15 }), by: 1, every: 6, key: "defeats" },
    ],
    feeds: [
      { when: turned("parliament"), key: "parliament_turned" },
      { when: instAt("hungary", { max: -2 }), key: "hungary_slighted" },
      { when: flag("f_auh_customs_signed"), key: "customs" },
    ],
    cools: [{ when: isLaw("auh_franchise"), key: "franchise", by: 2 }],
    steps: [
      { at: 3, scene: "auh_f_indep_2" },
      { at: 6, scene: "auh_f_indep_3" },
    ],
    bills: ["auh_franchise"],
    amends: { auh_landsturm: "harvest_leave", auh_franchise: "universal" },
    wants: [
      {
        id: "franchise_next",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
      {
        id: "magyar_command",
        keep: paid,
        effects: [inst("hungary", 1), inst("army", -1)],
      },
    ],
    // Károlyi takes the Entente's side out of the party, by state.
    splits: {
      when: all(warAge(20), any(temper("auh_indep", 2), score({ max: -10 }))),
      into: "auh_karolyi",
      takes: 1,
      scene: "auh_f_karolyi_split",
    },
    // What is left of it goes in with Andrássy against Tisza.
    joins: {
      with: ["auh_const"],
      when: all(
        TISZA_IN,
        warAge(28),
        not(faction("auh_karolyi", { of: ["out"] })),
        any(
          flag("f_auh_suffrage_word"),
          memory("k_kar_vote"),
          low("morale", 2),
        ),
      ),
      into: "auh_suffrage",
      parts: any(isLaw("auh_franchise"), not(TISZA_IN)),
      scene: "auh_f_suffrage_join",
    },
  },
  {
    id: "auh_karolyi",
    tag: "AUH",
    bloc: "parliament",
    start: "out",
    strength: 1,
    seats: { budapest: 1 },
    leaders: [{ person: "auh_karolyi" }],
    grows: [
      { when: score({ max: -15 }), by: 1, every: 6, key: "defeats" },
      {
        when: all(low("bread", 0), warAge(24)),
        by: 1,
        every: 6,
        key: "hunger",
      },
    ],
    feeds: [
      { when: flag("f_auh_customs_signed"), key: "customs", by: 2 },
      { when: instAt("berlin", { min: 3 }), key: "berlin_debt" },
      { when: turned("parliament"), key: "parliament_turned" },
    ],
    cools: [
      { when: flag("f_auh_peace_word"), key: "peace_word", by: 2 },
      { when: isLaw("auh_peace_motion"), key: "peace_motion", by: 2 },
    ],
    steps: [
      { at: 3, scene: "auh_f_karolyi_2" },
      { at: 6, scene: "auh_f_karolyi_3" },
    ],
    bills: ["auh_peace_motion"],
    amends: { auh_franchise: "universal", auh_peace_motion: "talks_now" },
    wants: [
      {
        id: "peace_word",
        when: not(flag("f_auh_peace_word")),
        keep: flag("f_auh_peace_word"),
        chapters: 8,
      },
      {
        id: "franchise_next",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
    ],
  },
  {
    id: "auh_const",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 1,
    seats: { budapest: 1 },
    leaders: [{ person: "auh_andrassy" }],
    grows: [
      {
        when: all(TISZA_IN, warAge(24)),
        by: 1,
        every: 10,
        key: "against_tisza",
      },
    ],
    feeds: [
      { when: instAt("hungary", { max: -3 }), key: "hungary_slighted" },
      { when: turned("parliament"), key: "parliament_turned" },
    ],
    cools: [
      { when: isLaw("auh_franchise"), key: "franchise" },
      { when: flag("f_auh_peace_word"), key: "peace_word" },
    ],
    steps: [
      { at: 3, scene: "auh_f_const_2" },
      { at: 6, scene: "auh_f_const_3" },
    ],
    bills: ["auh_franchise"],
    amends: { auh_franchise: "literate_vote", auh_landsturm: "harvest_leave" },
    wants: [
      {
        id: "franchise_promise",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 12,
      },
      { id: "peace_soundings", keep: paid, effects: [trustDeu(-1)] },
    ],
  },
  // The opposition against Tisza, once it stands together (no steps of its
  // own: its members' scenes carry it).
  {
    id: "auh_suffrage",
    tag: "AUH",
    bloc: "parliament",
    start: "out",
    strength: 2,
    seats: { budapest: 2 },
    leaders: [{ person: "auh_andrassy" }, { person: "auh_i_apponyi" }],
    feeds: [{ when: TISZA_IN, key: "tisza_holds" }],
    cools: [{ when: isLaw("auh_franchise"), key: "franchise", by: 2 }],
    amends: { auh_franchise: "universal" },
    wants: [
      {
        id: "franchise_promise",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
      { id: "peace_soundings", keep: paid, effects: [trustDeu(-1)] },
    ],
  },
  // ---- Outside the house ----
  {
    id: "auh_aok",
    tag: "AUH",
    bloc: "army",
    start: "in",
    strength: 3,
    seats: {},
    leaders: [
      {
        person: "auh_conrad",
        when: {
          kind: "holder",
          office: "chief_of_staff",
          person: "auh_conrad",
        },
      },
      { person: "auh_arz" },
      { person: "auh_conrad" },
    ],
    grows: [
      { when: score({ min: 10 }), by: 1, every: 6, key: "victories" },
      { when: score({ max: -15 }), by: -1, every: 6, key: "defeats" },
    ],
    feeds: [
      { when: turned("army"), key: "army_turned" },
      { when: isText("auh_press", "civil_censors"), key: "civil_censors" },
      {
        when: lately("auh_k_amnesty", "full_amnesty", 6),
        key: "amnesty",
        by: 2,
      },
      {
        when: lately("auh_h_bohemia_rule", "civil_stays", 6),
        key: "bohemia_civil",
      },
    ],
    cools: [
      { when: isLaw("auh_factories"), key: "factories" },
      { when: instAt("army", { min: 3 }), key: "army_heard" },
    ],
    steps: [
      { at: 3, scene: "auh_f_aok_2" },
      { at: 6, scene: "auh_f_aok_3" },
    ],
  },
  {
    id: "auh_court",
    tag: "AUH",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: {},
    leaders: [{ person: "auh_montenuovo" }, { person: "auh_bolfras" }],
    feeds: [
      { when: turned("court"), key: "court_turned" },
      { when: flag("f_auh_bohemia_crown"), key: "bohemian_crown" },
      { when: isText("auh_franchise", "universal"), key: "universal_vote" },
      {
        when: lately("auh_k_new_men", "new_court", 6),
        key: "new_court",
        by: 2,
      },
    ],
    cools: [{ when: blocAt("court", 2), key: "court_content" }],
    steps: [
      { at: 3, scene: "auh_f_court_2" },
      { at: 6, scene: "auh_f_court_3" },
    ],
  },
];

const VIENNA = ["reichsrat"] as const;
const BOTH = ["reichsrat", "budapest"] as const;
const BUDAPEST = ["budapest"] as const;

/**
 * Stances on the bills, by law id: existing bills and the factions' own.
 * `auh_reichsrat` has no row: calling the Reichsrat is the crown's act, no
 * chamber votes on it, and it runs as before, by the council.
 */
export const AUH_BILLS: readonly GwBillRow[] = [
  {
    law: "auh_press",
    houses: VIENNA,
    around: true,
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: -1,
      auh_poles: 0,
      auh_slavs: -1,
      auh_sd: -1,
    },
    texts: {
      front_zone: { auh_poles: 1 },
      civil_censors: {
        auh_czech: 0,
        auh_slavs: 0,
        auh_sd: 0,
        auh_germans: 0,
      },
    },
  },
  {
    law: "auh_landsturm",
    houses: BOTH,
    around: true,
    sponsor: office("war"),
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: -1,
      auh_poles: 0,
      auh_slavs: 0,
      auh_sd: -1,
      auh_work: 1,
      auh_indep: -1,
      auh_karolyi: -1,
      auh_const: 0,
      auh_suffrage: 0,
    },
    texts: {
      to_forty_five: { auh_poles: 1, auh_slavs: 1 },
      harvest_leave: {
        auh_czech: 0,
        auh_indep: 1,
        auh_const: 1,
        auh_suffrage: 1,
      },
    },
  },
  {
    law: "auh_factories",
    houses: VIENNA,
    around: true,
    stance: {
      auh_germans: 1,
      auh_csoc: 0,
      auh_czech: -1,
      auh_poles: 0,
      auh_slavs: -1,
      auh_sd: -1,
    },
    texts: {
      complaint_boards: { auh_sd: 1, auh_csoc: 1, auh_czech: 0 },
      wage_floor: { auh_sd: 1, auh_slavs: 0, auh_germans: -1 },
    },
  },
  {
    law: "auh_food",
    houses: BOTH,
    around: true,
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: 1,
      auh_poles: 1,
      auh_slavs: 0,
      auh_sd: 1,
      auh_work: -1,
      auh_indep: -1,
      auh_karolyi: -1,
      auh_const: 0,
      auh_suffrage: 0,
    },
    texts: {
      hungarian_price: { auh_work: 1 },
      army_first: { auh_sd: -1, auh_czech: -1 },
    },
  },
  {
    law: "auh_galicia",
    houses: VIENNA,
    around: true,
    stance: {
      auh_germans: 1,
      auh_csoc: 0,
      auh_czech: -1,
      auh_poles: 1,
      auh_slavs: -1,
      auh_sd: 0,
    },
    texts: {
      after_the_war: { auh_poles: 0, auh_germans: 0 },
      east_divided: { auh_poles: -1, auh_sd: 1 },
    },
  },
  {
    law: "auh_transylvania",
    houses: BUDAPEST,
    sponsor: held("hun_pm"),
    stance: {
      auh_work: 0,
      auh_indep: -1,
      auh_karolyi: 0,
      auh_const: -1,
      auh_suffrage: -1,
    },
    texts: {
      schools: { auh_work: 1 },
      language_and_seats: { auh_work: -1, auh_karolyi: 1 },
      words_to_bucharest: { auh_work: 1 },
    },
  },
  {
    law: "auh_oktroi",
    houses: VIENNA,
    around: true,
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: -1,
      auh_poles: 0,
      auh_slavs: -1,
      auh_sd: -1,
    },
    texts: { state_language: { auh_csoc: 0, auh_poles: -1 } },
  },
  {
    law: "auh_franchise",
    houses: BUDAPEST,
    sponsor: held("hun_pm"),
    stance: {
      auh_work: -1,
      auh_indep: 1,
      auh_karolyi: 1,
      auh_const: 1,
      auh_suffrage: 1,
    },
    texts: {
      soldiers_vote: { auh_work: 1, auh_karolyi: 0 },
      universal: { auh_work: -1, auh_const: -1 },
    },
  },
  // ---- The factions' own ----
  {
    law: "auh_rents",
    by: "auh_sd",
    houses: VIENNA,
    around: true,
    stance: {
      auh_sd: 1,
      auh_czech: 1,
      auh_slavs: 1,
      auh_poles: 0,
      auh_germans: 0,
      auh_csoc: -1,
    },
    texts: {
      all_flats: { auh_germans: -1, auh_poles: -1 },
      soldiers_families: { auh_csoc: 1, auh_germans: 1 },
    },
  },
  {
    law: "auh_war_aid",
    by: "auh_csoc",
    houses: VIENNA,
    around: true,
    money: true,
    stance: {
      auh_csoc: 1,
      auh_germans: 1,
      auh_sd: 1,
      auh_poles: 1,
      auh_czech: 0,
      auh_slavs: 0,
    },
    texts: { in_kind: { auh_sd: -1, auh_czech: 1, auh_slavs: 1 } },
  },
  {
    law: "auh_peace_motion",
    by: "auh_karolyi",
    houses: BUDAPEST,
    resolution: true,
    stance: {
      auh_work: -1,
      auh_indep: 0,
      auh_karolyi: 1,
      auh_const: 1,
      auh_suffrage: 1,
    },
    texts: {
      talks_now: { auh_const: 0, auh_indep: -1 },
      with_allies: { auh_work: 0, auh_indep: 1 },
    },
  },
];

/** A talk with no prices shown: the house's rule. */
function noTell(t: GwLawRow["talk"]): GwLawRow["talk"] {
  const nodes = Object.fromEntries(
    Object.entries(t.nodes).map(([id, n]) => [
      id,
      { ...n, replies: n.replies.map((r) => ({ ...r, tell: [] })) },
    ]),
  );
  return { ...t, nodes };
}

const vienna = { chancellor: held("chancellor") };

/** The factions' own bills: rows like content/laws/auh.ts, with no tells. */
export const AUH_HOUSE_LAWS: readonly GwLawRow[] = [
  // The Social Democrats' rent bill: in history a decree under paragraph 14,
  // 26 January 1917 (univie.ac.at exposé; austria-forum Mietrecht).
  row({
    id: "auh_rents",
    opens: all(war, since("1916-06")),
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("small_flats", 1, []),
      draft("all_flats", 0, [], [gauge("money", -1)]),
      draft("soldiers_families", 1, []),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 10 }],
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: noTell(
      lawTalk("auh_rents", {
        who: leaderOf("auh_csoc"),
        ask: "frank",
        push: "cold",
        tell: [],
        price: [gauge("money", -1)],
        wins: 1,
      }),
    ),
  }),
  // The Christian Socials' allowance for soldiers' families (the allowance
  // existed; the party's push for more is the game's).
  row({
    id: "auh_war_aid",
    opens: all(war, since("1915-06")),
    lean: 0,
    decree: true,
    body: "council",
    cast: vienna,
    draft: [
      draft("per_child", 1, [], [gauge("money", -1)]),
      draft("flat_raise", 0, [], [gauge("money", -1)]),
      draft("in_kind", 1, []),
    ],
    passed: [gauge("morale", 1), gauge("money", -1)],
    passedTell: [],
    term: [
      { gauge: "morale", delta: 1, every: 12 },
      { gauge: "money", delta: -1, every: 12, offset: 6 },
    ],
    repeal: { authority: 20, tell: [], effects: [gauge("morale", -1)] },
    talk: noTell(
      lawTalk("auh_war_aid", {
        who: leaderOf("auh_sd"),
        ask: "warm",
        push: "frank",
        tell: [],
        price: [gauge("money", -1)],
        wins: 1,
      }),
    ),
  }),
  // Károlyi's motion in the Diet: peace without annexations. A resolution.
  row({
    id: "auh_peace_motion",
    opens: all(war, warAge(18)),
    lean: -1,
    decree: false,
    cast: { hun: held("hun_pm") },
    draft: [
      draft("no_annexations", 0, []),
      draft("talks_now", -1, []),
      draft("with_allies", 1, []),
    ],
    passed: [trustDeu(-1), inst("army", -1), gauge("morale", 1)],
    passedTell: [],
    term: [],
    repeal: { authority: 5, tell: [], effects: [] },
    talk: noTell(
      lawTalk("auh_peace_motion", {
        who: leaderOf("auh_work"),
        ask: "frank",
        push: "warm",
        tell: [],
        price: [inst("hungary", 1)],
        wins: 2,
        tempers: ["stubborn"],
      }),
    ),
  }),
];

// ---- Scenes written by hand: tempers 2 and 3, the split and the join ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
const opt = (id: string, effects: GwEffect[], when?: GwCond): GwOption =>
  when === undefined
    ? { id, tell: [], effects }
    : { id, when, tell: [], effects };
const why = (key: string): GwEffect => reason(`auh_hs_${key}`);

/** The leader comes himself. */
function visit(
  id: string,
  f: string,
  variants: GwVariant[],
  options: GwOption[],
  extra: Partial<GwScene> = {},
): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "audience",
    scheduledOnly: true,
    cast: { who: leaderOf(f) },
    salience: 6,
    tags: ["home", "people", "tension_up"],
    variants: [...variants, v("base")],
    fallback: options[0].id,
    options,
    ...extra,
  };
}

/** A paper about a faction, brought by the minister it concerns. */
function paper(
  id: string,
  f: string,
  minister: "chancellor" | "hun_pm" | "court",
  variants: GwVariant[],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "proposal",
    scheduledOnly: true,
    cast: { min: held(minister), who: leaderOf(f) },
    salience: 6,
    tags: ["home", "tension_up"],
    variants: [...variants, v("base")],
    fallback: options[0].id,
    options,
  };
}

/** News only: read and put down. */
function news(id: string, variants: GwVariant[] = []): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "wire",
    scheduledOnly: true,
    cast: {},
    salience: 5,
    tags: ["home", "tension_up"],
    variants: [...variants, v("base")],
  };
}

export const AUH_HOUSE_SCENES: readonly GwScene[] = [
  // German Nationals
  visit(
    "auh_f_germans_2",
    "auh_germans",
    [v("open", REICHSRAT_OPEN)],
    [
      opt("take_memo", [
        cool("auh_germans", 2),
        heat("auh_czech", 1),
        why("germans_memo"),
      ]),
      opt("after_war", [heat("auh_germans", 1), why("germans_after")]),
      opt("to_premier", [cool("auh_germans", 1), why("germans_premier")]),
    ],
  ),
  paper(
    "auh_f_germans_3",
    "auh_germans",
    "chancellor",
    [v("open", REICHSRAT_OPEN)],
    [
      opt("lunch_moderates", [cool("auh_germans", 1), why("germans_lunch")]),
      opt("let_them", [why("germans_let")]),
      opt("warn_paper", [
        heat("auh_germans", 1),
        cool("auh_aok", 1),
        why("germans_warned"),
      ]),
    ],
  ),
  // Christian Socials
  visit(
    "auh_f_csoc_2",
    "auh_csoc",
    [v("hungry", low("bread", 0))],
    [
      opt("flour", [
        gauge("money", -1),
        cool("auh_csoc", 2),
        why("csoc_flour"),
      ]),
      opt("hear_club", [cool("auh_csoc", 1), why("csoc_heard")]),
      opt("no_more", [heat("auh_csoc", 1), why("csoc_refused")]),
    ],
  ),
  visit(
    "auh_f_csoc_3",
    "auh_csoc",
    [],
    [
      opt("mass_together", [
        cool("auh_csoc", 2),
        heat("auh_sd", 1),
        why("csoc_mass"),
      ]),
      opt("let_paper", [why("csoc_let")]),
    ],
  ),
  // Czech Union
  visit(
    "auh_f_czech_2",
    "auh_czech",
    [v("held", all(flag("f_auh_kramar_held"), not(flag("f_auh_amnesty"))))],
    [
      opt("look_at_cases", [
        cool("auh_czech", 1),
        heat("auh_aok", 1),
        why("czech_cases"),
      ]),
      opt("courts_decide", [
        heat("auh_czech", 1),
        cool("auh_aok", 1),
        why("czech_courts"),
      ]),
      opt(
        "house_will_open",
        [cool("auh_czech", 2), why("czech_house")],
        not(REICHSRAT_OPEN),
      ),
    ],
  ),
  paper(
    "auh_f_czech_3",
    "auh_czech",
    "chancellor",
    [],
    [
      opt("ban_meetings", [
        heat("auh_czech", 2),
        cool("auh_aok", 1),
        why("czech_banned"),
      ]),
      opt("allow_meetings", [
        cool("auh_czech", 1),
        heat("auh_aok", 1),
        why("czech_allowed"),
      ]),
      opt("call_union", [
        cool("auh_czech", 1),
        heat("auh_germans", 1),
        why("czech_called"),
      ]),
    ],
  ),
  // Polish Club
  visit(
    "auh_f_poles_2",
    "auh_poles",
    [
      v("chelm", flag("f_auh_chelm_given")),
      v("traded", flag("f_auh_poland_traded")),
    ],
    [
      opt("crown_word", [
        cool("auh_poles", 2),
        trustDeu(-1),
        why("poles_crown"),
      ]),
      opt("wait_peace", [heat("auh_poles", 1), why("poles_wait")]),
      opt("to_foreign", [cool("auh_poles", 1), why("poles_foreign")]),
    ],
  ),
  paper(
    "auh_f_poles_3",
    "auh_poles",
    "chancellor",
    [v("chelm", flag("f_auh_chelm_given"))],
    [
      opt(
        "galicia_bill",
        [
          startLaw("auh_galicia", "faction"),
          cool("auh_poles", 1),
          why("poles_bill"),
        ],
        all(not(isLaw("auh_galicia")), since("1916-06")),
      ),
      opt("call_back", [cool("auh_poles", 1), why("poles_called")]),
      opt("let_oppose", [why("poles_let")]),
    ],
  ),
  // South Slav Club
  visit(
    "auh_f_slavs_2",
    "auh_slavs",
    [v("open", REICHSRAT_OPEN)],
    [
      opt("press_budapest", [
        cool("auh_slavs", 2),
        inst("hungary", -1),
        heat("auh_work", 1),
        why("slavs_budapest"),
      ]),
      opt("not_now", [heat("auh_slavs", 1), why("slavs_not_now")]),
      opt(
        "say_it_in_house",
        [cool("auh_slavs", 1), why("slavs_house")],
        REICHSRAT_OPEN,
      ),
    ],
  ),
  paper(
    "auh_f_slavs_3",
    "auh_slavs",
    "chancellor",
    [],
    [
      opt("stop_lists", [
        heat("auh_slavs", 2),
        cool("auh_aok", 1),
        why("slavs_stopped"),
      ]),
      opt("let_lists", [
        cool("auh_slavs", 1),
        heat("auh_work", 1),
        why("slavs_let"),
      ]),
    ],
  ),
  // Social Democrats
  visit(
    "auh_f_sd_2",
    "auh_sd",
    [v("hungry", low("bread", 0))],
    [
      opt("flour", [gauge("money", -1), cool("auh_sd", 2), why("sd_flour")]),
      opt("boards", [cool("auh_sd", 1), heat("auh_aok", 1), why("sd_boards")]),
      opt("hold_on", [heat("auh_sd", 1), why("sd_hold")]),
    ],
  ),
  paper(
    "auh_f_sd_3",
    "auh_sd",
    "chancellor",
    [v("strike", world({ is: "unrest", min: 2 }))],
    [
      opt("talk_party", [cool("auh_sd", 1), why("sd_talk")]),
      opt("watch_halls", [
        heat("auh_sd", 2),
        cool("auh_aok", 1),
        why("sd_watched"),
      ]),
      opt("leave_congress", [why("sd_let")]),
    ],
  ),
  // Party of Work
  visit(
    "auh_f_work_2",
    "auh_work",
    [v("out", not(TISZA_IN))],
    [
      opt("hear_terms", [
        inst("hungary", 1),
        inst("nations", -1),
        cool("auh_work", 2),
        why("work_terms"),
      ]),
      opt("stand_firm", [heat("auh_work", 1), why("work_firm")]),
      opt("ask_time", [cool("auh_work", 1), why("work_time")]),
    ],
  ),
  paper(
    "auh_f_work_3",
    "auh_work",
    "hun_pm",
    [v("out", not(TISZA_IN))],
    [
      opt("give_way", [
        inst("hungary", 2),
        inst("nations", -1),
        cool("auh_work", 2),
        why("work_gave"),
      ]),
      opt("wait_out", [why("work_wait")]),
    ],
  ),
  // Independence
  visit(
    "auh_f_indep_2",
    "auh_indep",
    [],
    [
      opt("franchise_word", [
        cool("auh_indep", 2),
        heat("auh_work", 1),
        why("indep_franchise"),
      ]),
      opt("command_no", [heat("auh_indep", 1), why("indep_no")]),
      opt("to_premier", [cool("auh_indep", 1), why("indep_premier")]),
    ],
  ),
  news("auh_f_indep_3"),
  // Károlyi's party
  visit(
    "auh_f_karolyi_2",
    "auh_karolyi",
    [v("customs", flag("f_auh_customs_signed"))],
    [
      opt("let_speak", [
        cool("auh_karolyi", 2),
        trustDeu(-1),
        why("karolyi_speak"),
      ]),
      opt("not_now", [heat("auh_karolyi", 1), why("karolyi_not_now")]),
      opt("hear_privately", [cool("auh_karolyi", 1), why("karolyi_private")]),
    ],
  ),
  news("auh_f_karolyi_3"),
  // Constitution Party
  visit(
    "auh_f_const_2",
    "auh_const",
    [v("out", not(TISZA_IN))],
    [
      opt("soundings", [
        cool("auh_const", 2),
        trustDeu(-1),
        why("const_soundings"),
      ]),
      opt("franchise_later", [
        cool("auh_const", 1),
        heat("auh_work", 1),
        why("const_franchise"),
      ]),
      opt("thank_him", [heat("auh_const", 1), why("const_thanked")]),
    ],
  ),
  news("auh_f_const_3"),
  // Army High Command
  visit(
    "auh_f_aok_2",
    "auh_aok",
    [v("bohemia", flag("f_auh_bohemia_civil"))],
    [
      opt("grant_zone", [
        cool("auh_aok", 2),
        inst("army", 1),
        heat("auh_czech", 1),
        why("aok_granted"),
      ]),
      opt("civil_stays", [heat("auh_aok", 1), why("aok_refused")]),
      opt("governor_only", [cool("auh_aok", 1), why("aok_governor")]),
    ],
    { tags: ["home", "war", "people", "tension_up"] },
  ),
  paper(
    "auh_f_aok_3",
    "auh_aok",
    "court",
    [],
    [
      opt("summon_chief", [
        cool("auh_aok", 1),
        trustOf(role("who"), -1),
        why("aok_summoned"),
      ]),
      opt("give_rail", [
        cool("auh_aok", 2),
        gauge("bread", -1),
        why("aok_rail"),
      ]),
      opt("let_sit", [why("aok_let")]),
    ],
  ),
  // The court
  visit(
    "auh_f_court_2",
    "auh_court",
    [],
    [
      opt("keep_form", [cool("auh_court", 2), why("court_form")]),
      opt("my_house", [heat("auh_court", 1), why("court_mine")]),
    ],
    { tags: ["home", "people"] },
  ),
  news("auh_f_court_3"),
  // The split and the join
  news("auh_f_karolyi_split", [v("defeats", score({ max: -10 }))]),
  news("auh_f_suffrage_join"),
];

// ---- S2 ----
export const AUH_PLOTS: readonly GwPlotRow[] = [];
export const AUH_WEAK: readonly GwWeakRow[] = [];
export const AUH_ASKS: readonly GwAskRow[] = [];
/** Plot signs, warnings, steps and ends; dossier scenes; asks; conferences. */
export const AUH_PLOT_SCENES: readonly GwScene[] = [];
