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
  decide,
  flag,
  memory,
  not,
  reason,
  role,
  trustOf,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type {
  GwAskRow,
  GwBillRow,
  GwFactionRow,
  GwPlotRow,
  GwWant,
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
  answerAsk,
  beatPlot,
  cool,
  coolPlot,
  faction,
  heat,
  heatPlot,
  isLaw,
  leaderOf,
  low,
  plotConfirmed,
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
//
// ww203 seats (real, by club). Reichsrat 1911, 516 (en.wikipedia 1911
// Cisleithanian legislative election, its club table): German National
// Association 100, Bohemian Club 84, Christian Social Union 73, Polish Club
// 70, Social Democrats 83 (German 49, Bohemian 25, Polish 9), South Slavs 34
// (Croatian-Slovenian Club 27, Dalmatian Club 7); the Ukrainian Association
// 28, the Latin Union 21 and 23 independents have no faction here and stay
// away. Diet 1910, 413 (en.wikipedia 1910 Hungarian parliamentary election):
// Party of Work 256, Kossuth's Independence party 54 (the infobox says 51)
// and Justh's 44, one party again from 1913 (98). Unchecked: Andrássy's
// Constitution Party of September 1913 at about 20, taken from the Party of
// Work's 256 (hu.wikipedia gives no count after 1906); Károlyi's party of
// July 1916 at about 20 (one source: "only 20 members in Parliament").
//
// ww203 prices: each leader names up to three, first first (`kind`). A
// concession is his `amends` text for the bill (`amend_text`). Burián at the
// Ballhausplatz was Tisza's man, foreign minister 13 Jan 1915 (people_auh).

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
const BURIAN_FOREIGN: GwCond = {
  kind: "holder",
  office: "foreign",
  person: "auh_burian",
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
/** ww203: the leader's own wording of the bill (his `amends` text). */
const amendFor = (f: string): GwWant => ({
  id: "amend_text",
  kind: "concession",
  when: world({ is: "amendable", id: f }),
  keep: paid,
  effects: [doWorld({ do: "amend", id: f })],
});

export const AUH_FACTIONS: readonly GwFactionRow[] = [
  // ---- Vienna: the Reichsrat ----
  {
    id: "auh_germans",
    tag: "AUH",
    bloc: "press",
    start: "in",
    strength: 3,
    seats: { reichsrat: 100 },
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
        kind: "next",
        when: not(isLaw("auh_oktroi")),
        keep: isLaw("auh_oktroi"),
        chapters: 8,
      },
      {
        id: "german_officials",
        kind: "post",
        keep: paid,
        effects: [heat("auh_czech", 1), heat("auh_slavs", 1)],
      },
      amendFor("auh_germans"),
    ],
  },
  {
    id: "auh_csoc",
    tag: "AUH",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: { reichsrat: 73 },
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
        kind: "next",
        when: not(isLaw("auh_war_aid")),
        keep: isLaw("auh_war_aid"),
        chapters: 8,
      },
      {
        id: "vienna_flour",
        kind: "money",
        keep: paid,
        effects: [gauge("money", -1)],
      },
      amendFor("auh_csoc"),
    ],
  },
  {
    id: "auh_czech",
    tag: "AUH",
    plot: "auh_pl_nations",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { reichsrat: 84 },
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
        kind: "promise",
        when: not(flag("f_auh_amnesty")),
        keep: flag("f_auh_amnesty"),
        chapters: 10,
      },
      {
        id: "house_open",
        kind: "promise",
        when: not(REICHSRAT_OPEN),
        keep: REICHSRAT_OPEN,
        chapters: 8,
      },
      {
        id: "czech_schools",
        kind: "money",
        keep: paid,
        effects: [heat("auh_germans", 1)],
      },
      amendFor("auh_czech"),
    ],
  },
  {
    id: "auh_poles",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { reichsrat: 70 },
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
        kind: "next",
        when: not(isLaw("auh_galicia")),
        keep: isLaw("auh_galicia"),
        chapters: 8,
      },
      // + check: a Pole as the minister for Galicia (the post was always a
      // Pole's; its holders in the war not checked).
      {
        id: "galicia_minister",
        kind: "post",
        keep: paid,
        effects: [inst("nations", 1), inst("council", -1)],
      },
      {
        id: "galicia_aid",
        kind: "money",
        keep: paid,
        effects: [gauge("money", -1)],
      },
      amendFor("auh_poles"),
    ],
  },
  {
    id: "auh_slavs",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 1,
    seats: { reichsrat: 34 },
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
        kind: "promise",
        when: not(flag("f_auh_amnesty")),
        keep: flag("f_auh_amnesty"),
        chapters: 10,
      },
      {
        id: "croatia_heard",
        kind: "promise",
        keep: paid,
        effects: [heat("auh_work", 1)],
      },
      amendFor("auh_slavs"),
    ],
  },
  {
    id: "auh_sd",
    tag: "AUH",
    bloc: "workers",
    start: "in",
    strength: 3,
    seats: { reichsrat: 83 },
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
        kind: "promise",
        when: not(REICHSRAT_OPEN),
        keep: REICHSRAT_OPEN,
        chapters: 10,
      },
      {
        id: "rents_next",
        kind: "next",
        when: not(isLaw("auh_rents")),
        keep: isLaw("auh_rents"),
        chapters: 8,
      },
      {
        id: "flour_ration",
        kind: "money",
        keep: paid,
        effects: [gauge("money", -1)],
      },
      amendFor("auh_sd"),
    ],
  },
  // ---- Budapest: the Diet ----
  {
    id: "auh_work",
    tag: "AUH",
    bloc: "business",
    start: "in",
    strength: 4,
    seats: { budapest: 236 },
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
      { when: instAt("hungary", { max: -4 }), key: "hungary_slighted" },
      { when: isText("auh_food", "common_committee"), key: "grain_taken" },
      { when: flag("f_auh_oath_delayed"), key: "oath_delayed" },
      { when: isLaw("auh_franchise"), key: "franchise" },
    ],
    cools: [
      { when: flag("f_auh_sworn"), key: "crowned" },
      { when: instAt("hungary", { min: 3 }), key: "hungary_heard" },
    ],
    // ww204 (T): Tisza's majority was slow to turn on the Crown: 8 and 12.
    steps: [
      { at: 8, scene: "auh_f_work_2" },
      { at: 12, scene: "auh_f_work_3" },
    ],
    amends: {
      auh_food: "hungarian_price",
      auh_transylvania: "schools",
      auh_franchise: "soldiers_vote",
    },
    wants: [
      {
        id: "grain_price",
        kind: "money",
        when: moving("auh_food"),
        keep: paid,
        effects: [gauge("money", -1)],
      },
      {
        id: "honved_home",
        kind: "promise",
        when: moving("auh_landsturm"),
        keep: paid,
        effects: [inst("hungary", 1), inst("army", -1)],
      },
      // Burián at the Ballhausplatz, Tisza's man (he was, January 1915).
      {
        id: "burian_foreign",
        kind: "post",
        when: all(TISZA_IN, not(BURIAN_FOREIGN)),
        keep: BURIAN_FOREIGN,
        chapters: 4,
      },
      {
        id: "hungary_first",
        kind: "promise",
        keep: paid,
        effects: [inst("hungary", 1), inst("nations", -1)],
      },
      amendFor("auh_work"),
    ],
  },
  {
    id: "auh_indep",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { budapest: 98 },
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
        kind: "next",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
      {
        id: "magyar_command",
        kind: "promise",
        keep: paid,
        effects: [inst("hungary", 1), inst("army", -1)],
      },
      amendFor("auh_indep"),
    ],
    // Károlyi takes the Entente's side out of the party, by state.
    splits: {
      when: all(warAge(20), any(temper("auh_indep", 2), score({ max: -10 }))),
      into: "auh_karolyi",
      takes: 1,
      // Approximate (ww204 M): about 20, from one source.
      seats: { budapest: 20 },
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
    plot: "auh_pl_magyar",
    bloc: "parliament",
    start: "out",
    strength: 1,
    seats: { budapest: 20 },
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
        kind: "promise",
        when: not(flag("f_auh_peace_word")),
        keep: flag("f_auh_peace_word"),
        chapters: 8,
      },
      {
        id: "motion_next",
        kind: "next",
        when: not(isLaw("auh_peace_motion")),
        keep: isLaw("auh_peace_motion"),
        chapters: 10,
      },
      {
        id: "franchise_next",
        kind: "promise",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
      amendFor("auh_karolyi"),
    ],
  },
  {
    id: "auh_const",
    tag: "AUH",
    bloc: "parliament",
    start: "in",
    strength: 1,
    // Approximate (ww204 M): Andrássy's Constitution Party after 1913.
    seats: { budapest: 20 },
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
      { when: instAt("hungary", { max: -4 }), key: "hungary_slighted" },
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
        kind: "next",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 12,
      },
      {
        id: "peace_soundings",
        kind: "promise",
        keep: paid,
        effects: [trustDeu(-1)],
      },
      amendFor("auh_const"),
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
    seats: { budapest: 98 },
    leaders: [{ person: "auh_andrassy" }, { person: "auh_i_apponyi" }],
    feeds: [{ when: TISZA_IN, key: "tisza_holds" }],
    cools: [{ when: isLaw("auh_franchise"), key: "franchise", by: 2 }],
    amends: { auh_franchise: "universal" },
    wants: [
      {
        id: "franchise_promise",
        kind: "promise",
        when: not(isLaw("auh_franchise")),
        keep: isLaw("auh_franchise"),
        chapters: 10,
      },
      {
        id: "peace_soundings",
        kind: "promise",
        keep: paid,
        effects: [trustDeu(-1)],
      },
      amendFor("auh_suffrage"),
    ],
  },
  // ---- Outside the house ----
  {
    id: "auh_aok",
    tag: "AUH",
    plot: "auh_pl_army",
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
    plot: "auh_pl_army",
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
    // ww203: Romanian seats and schools in Transylvania: the '48ers' creed.
    creed: ["auh_indep"],
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
    // ww203: German as the state language and Bohemia cut in two by decree.
    constitution: true,
    creed: ["auh_czech", "auh_slavs"],
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
    constitution: true,
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
  // ww203 (+): the war tax, Austria's half.
  {
    law: "auh_war_tax",
    houses: VIENNA,
    around: true,
    money: true,
    sponsor: office("finance"),
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: 0,
      auh_poles: 1,
      auh_slavs: 0,
      auh_sd: -1,
    },
    texts: {
      profits_tax: {
        auh_germans: -1,
        auh_czech: 1,
        auh_slavs: 1,
        auh_sd: 1,
        auh_poles: 0,
      },
      surcharge: {
        auh_germans: 0,
        auh_csoc: -1,
        auh_czech: -1,
        auh_poles: -1,
        auh_slavs: -1,
        auh_sd: 0,
      },
    },
  },
  // ww203 (+): who tries civilians in the war.
  {
    law: "auh_war_zone",
    houses: VIENNA,
    around: true,
    sponsor: office("war"),
    stance: {
      auh_germans: 1,
      auh_csoc: 1,
      auh_czech: -1,
      auh_poles: 0,
      auh_slavs: -1,
      auh_sd: -1,
    },
    texts: {
      war_zone_only: { auh_czech: 0, auh_slavs: 0, auh_sd: 0, auh_poles: -1 },
      civil_courts: {
        auh_germans: -1,
        auh_csoc: 0,
        auh_czech: 1,
        auh_poles: 1,
        auh_slavs: 1,
        auh_sd: 1,
      },
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
    chapter: "food",
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
    chapter: "food",
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
    chapter: "war_aims",
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

// ---- S2: plots, the dossier, allies (ww158-format.md, S2 addendum) ----
//
// Three plots, from design §8. The army's: the High Command and the court's
// hard men set the ministers aside (no archduke in it: never the ruler's
// family); it can end the reign. Budapest's: Károlyi's men and a national
// council take Hungary its own way; the nations': committees in Prague,
// Zagreb and Ljubljana make themselves the government. Both feed the unrest
// ladder. The answers sit in the steps' options; none ends the game itself.

const REGIMES = ["dual_monarchy", "karl", "ff_throne"];
const COS = { office: "chief_of_staff" } as const;

export const AUH_PLOTS: readonly GwPlotRow[] = [
  {
    id: "auh_pl_army",
    tag: "AUH",
    regimes: REGIMES,
    from: "1915-06",
    rest: 12,
    fatal: true,
    feeds: [
      { when: temper("auh_aok", 3), key: "aok_silent", by: 2, quiet: true },
      { when: temper("auh_court", 3), key: "court_cold", quiet: true },
      {
        when: lately("auh_k_amnesty", "full_amnesty", 6),
        key: "amnesty",
        by: 2,
        quiet: true,
      },
      {
        when: all(REICHSRAT_OPEN, temper("auh_aok", 2)),
        key: "house_open",
        quiet: true,
      },
      { when: score({ max: -20 }), key: "defeats", quiet: true },
    ],
    steps: [
      { at: 6, scene: "auh_pl_army_1" },
      { at: 12, scene: "auh_pl_army_2" },
    ],
    plot: {
      by: ["auh_aok", "auh_court"],
      signs: [
        { at: 2, scene: "auh_pl_army_s1", via: "paper" },
        { at: 4, scene: "auh_pl_army_s2", via: "talk" },
        { at: 8, scene: "auh_pl_army_s3", via: "report" },
      ],
      warn: "auh_pl_army_w",
      end: "removed",
    },
  },
  {
    id: "auh_pl_magyar",
    tag: "AUH",
    regimes: REGIMES,
    from: "1916-01",
    rest: 10,
    fatal: false,
    feeds: [
      {
        when: temper("auh_karolyi", 3),
        key: "karolyi_silent",
        by: 2,
        quiet: true,
      },
      { when: temper("auh_indep", 3), key: "indep_out", quiet: true },
      {
        when: instAt("hungary", { max: -4 }),
        key: "hungary_slighted",
        quiet: true,
      },
      { when: all(low("bread", 0), warAge(30)), key: "hunger", quiet: true },
      { when: score({ max: -20 }), key: "defeats", quiet: true },
    ],
    steps: [
      { at: 6, scene: "auh_pl_magyar_1" },
      { at: 12, scene: "auh_pl_magyar_2" },
    ],
    plot: {
      by: ["auh_karolyi", "auh_indep"],
      signs: [
        { at: 2, scene: "auh_pl_magyar_s1", via: "paper" },
        { at: 4, scene: "auh_pl_magyar_s2", via: "talk" },
        { at: 8, scene: "auh_pl_magyar_s3", via: "report" },
      ],
      warn: "auh_pl_magyar_w",
      end: "unrest",
    },
  },
  {
    id: "auh_pl_nations",
    tag: "AUH",
    regimes: REGIMES,
    from: "1916-06",
    rest: 10,
    fatal: false,
    feeds: [
      { when: temper("auh_czech", 3), key: "czech_silent", by: 2, quiet: true },
      { when: temper("auh_slavs", 3), key: "slavs_silent", quiet: true },
      { when: temper("auh_poles", 3), key: "poles_silent", quiet: true },
      {
        when: instAt("nations", { max: -4 }),
        key: "nations_bitter",
        quiet: true,
      },
      { when: flag("f_auh_house_shut"), key: "house_shut", quiet: true },
      { when: score({ max: -20 }), key: "defeats", quiet: true },
    ],
    steps: [
      { at: 6, scene: "auh_pl_nations_1" },
      { at: 12, scene: "auh_pl_nations_2" },
    ],
    plot: {
      by: ["auh_czech", "auh_slavs", "auh_poles"],
      signs: [
        { at: 2, scene: "auh_pl_nations_s1", via: "paper" },
        { at: 4, scene: "auh_pl_nations_s2", via: "talk" },
        { at: 8, scene: "auh_pl_nations_s3", via: "report" },
      ],
      warn: "auh_pl_nations_w",
      end: "unrest",
    },
  },
];

/**
 * Our people's possible weaknesses: the seed decides each game which are
 * true. Grounded where the record allows (Conrad's letters to Gina von
 * Reininghaus, Kramář's Russian ties, Károlyi's French ones, Czernin's nerves);
 * the rest is the game's guess at a man of his place, and the file may lie.
 */
export const AUH_WEAK: readonly GwWeakRow[] = [
  {
    person: "auh_tisza",
    weak: [
      { id: "old_scandal", odds: 30 },
      { id: "letters", odds: 15 },
    ],
  },
  {
    person: "auh_karolyi",
    weak: [
      { id: "foreign_ties", odds: 50 },
      { id: "debts", odds: 30 },
    ],
  },
  {
    person: "auh_andrassy",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "letters", odds: 20 },
    ],
  },
  {
    person: "auh_kramar",
    weak: [
      { id: "foreign_ties", odds: 60 },
      { id: "letters", odds: 30 },
    ],
  },
  { person: "auh_korosec", weak: [{ id: "foreign_ties", odds: 35 }] },
  {
    person: "auh_adler",
    weak: [
      { id: "health", odds: 40 },
      { id: "letters", odds: 15 },
    ],
  },
  {
    person: "auh_bilinski",
    weak: [
      { id: "industry_money", odds: 35 },
      { id: "old_scandal", odds: 20 },
    ],
  },
  {
    person: "auh_conrad",
    weak: [
      { id: "letters", odds: 60 },
      { id: "old_scandal", odds: 30 },
    ],
  },
  {
    person: "auh_sturgkh",
    weak: [
      { id: "health", odds: 20 },
      { id: "old_scandal", odds: 15 },
    ],
  },
  { person: "auh_krobatin", weak: [{ id: "industry_money", odds: 40 }] },
  {
    person: "auh_czernin",
    weak: [
      { id: "health", odds: 40 },
      { id: "foreign_ties", odds: 20 },
    ],
  },
  {
    person: "auh_berchtold",
    weak: [
      { id: "debts", odds: 15 },
      { id: "letters", odds: 25 },
    ],
  },
  { person: "auh_montenuovo", weak: [{ id: "old_scandal", odds: 25 }] },
  { person: "auh_bolfras", weak: [{ id: "health", odds: 35 }] },
];

const trustBgr = (delta: number): GwEffect => ({
  kind: "trust",
  tag: "BGR",
  delta,
});
const tone = (t: "warm" | "cold"): GwEffect => ({
  kind: "letter",
  who: role("head"),
  tone: t,
});

/** Allies' asks (design §10): Berlin three times, Sofia once. */
export const AUH_ASKS: readonly GwAskRow[] = [
  // Berlin presses for grain to Austria and Germany: the joint food bill.
  {
    id: "auh_ask_grain",
    tag: "AUH",
    from: "DEU",
    kind: "law",
    law: "auh_food",
    when: all(war, since("1916-02"), low("bread", 2), not(isLaw("auh_food"))),
    scene: "auh_ask_grain",
    keep: isLaw("auh_food"),
    chapters: 6,
    kept: [trustDeu(1), gauge("shells", 1)],
    broken: [trustDeu(-1)],
  },
  // Berlin wants Austria's weight in the east, not against Italy.
  {
    id: "auh_ask_east",
    tag: "AUH",
    from: "DEU",
    kind: "front",
    when: all(war, world({ is: "entered", tag: "ITA" }), warAge(12)),
    scene: "auh_ask_east",
    keep: world({ is: "main", of: ["east"] }),
    chapters: 2,
    kept: [trustDeu(1), gauge("shells", 1)],
    broken: [trustDeu(-1)],
  },
  // Sofia asks for the push on Serbia together.
  {
    id: "auh_ask_serbia",
    tag: "AUH",
    from: "BGR",
    kind: "offensive",
    when: all(
      war,
      world({ is: "entered", tag: "BGR", side: "central" }),
      not(world({ is: "out", tag: "SRB" })),
    ),
    scene: "auh_ask_serbia",
    keep: world({ is: "main", of: ["balkan"] }),
    chapters: 2,
    kept: [trustBgr(1)],
    broken: [trustBgr(-1)],
  },
  // Pless, after Romania came in: one supreme command under the Kaiser.
  {
    id: "auh_ask_pless",
    tag: "AUH",
    from: "DEU",
    kind: "front",
    conference: true,
    when: all(war, world({ is: "entered", tag: "ROU" }), since("1916-08")),
    scene: "auh_ask_pless",
    keep: paid,
    chapters: 2,
    kept: [trustDeu(2), gauge("shells", 1)],
    broken: [trustDeu(-1)],
  },
];

/** A decision about a plot, brought by the minister it concerns. */
function plotPaper(
  id: string,
  cast: GwScene["cast"],
  options: GwOption[],
): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "proposal",
    scheduledOnly: true,
    cast,
    salience: 7,
    tags: ["home", "tension_up"],
    variants: [v("base")],
    fallback: options[options.length - 1].id,
    options,
  };
}
/** A sign in the paper: a gap, a rumour. */
function signPaper(id: string): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "wire",
    scheduledOnly: true,
    cast: {},
    salience: 5,
    tags: ["home"],
    variants: [v("base")],
  };
}
/** A sign through the police: stamped, and it may be wrong. */
function signReport(id: string): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "report",
    scheduledOnly: true,
    cast: {},
    salience: 6,
    tags: ["home"],
    stamp: "unconfirmed",
    source: "police",
    variants: [v("base")],
  };
}
/** A sign in a talk: someone says too much. */
function signTalk(id: string, who: GwScene["cast"][string]): GwScene {
  return {
    id,
    nation: ["AUH"],
    kind: "audience",
    scheduledOnly: true,
    cast: { who },
    salience: 6,
    tags: ["home", "people"],
    variants: [v("base")],
    fallback: "let_pass",
    options: [opt("ask_more", [why("sign_asked")]), opt("let_pass", [])],
  };
}
const dismissCos: GwEffect = { kind: "dismiss", who: role("cos") };
const reply = (id: string, next: string) => ({
  id,
  stance: "frank" as const,
  kind: "ask" as const,
  tell: [],
  effects: [],
  next,
});

export const AUH_PLOT_SCENES: readonly GwScene[] = [
  // ---- The army ----
  signPaper("auh_pl_army_s1"),
  signTalk("auh_pl_army_s2", { office: "court" }),
  signReport("auh_pl_army_s3"),
  plotPaper("auh_pl_army_w", { cos: COS, min: held("chancellor") }, [
    opt("rebuke_cos", [
      coolPlot("auh_pl_army", 2),
      trustOf(role("cos"), -1),
      why("army_rebuked"),
    ]),
    opt("army_say", [
      coolPlot("auh_pl_army", 3),
      inst("army", 1),
      heat("auh_czech", 1),
      why("army_say"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_army_1", { cos: COS, min: held("chancellor") }, [
    opt("grant_bohemia", [
      coolPlot("auh_pl_army", 4),
      cool("auh_aok", 2),
      inst("army", 1),
      heat("auh_czech", 2),
      why("army_bohemia"),
    ]),
    opt("post_away", [
      dismissCos,
      coolPlot("auh_pl_army", 5),
      inst("army", -1),
      why("army_posted"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_army_2", { cos: COS, court: held("court") }, [
    opt("relieve", [
      beatPlot("auh_pl_army"),
      heatPlot("auh_pl_nations", 3),
      dismissCos,
      inst("army", -2),
      why("army_relieved"),
    ]),
    opt(
      "make_public",
      [
        beatPlot("auh_pl_army"),
        inst("army", -1),
        heat("auh_aok", 2),
        why("army_public"),
      ],
      plotConfirmed("auh_pl_army"),
    ),
    opt("give_way", [
      coolPlot("auh_pl_army", 8),
      inst("army", 2),
      inst("nations", -2),
      heat("auh_czech", 2),
      heat("auh_sd", 2),
      why("army_gave"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  // ---- Budapest ----
  signPaper("auh_pl_magyar_s1"),
  signTalk("auh_pl_magyar_s2", leaderOf("auh_const")),
  signReport("auh_pl_magyar_s3"),
  plotPaper("auh_pl_magyar_w", { hun: held("hun_pm") }, [
    opt(
      "franchise_now",
      [
        startLaw("auh_franchise", "seat"),
        coolPlot("auh_pl_magyar", 2),
        why("magyar_franchise"),
      ],
      not(isLaw("auh_franchise")),
    ),
    opt("talk_karolyi", [
      coolPlot("auh_pl_magyar", 2),
      cool("auh_karolyi", 1),
      why("magyar_talked"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_magyar_1", { hun: held("hun_pm") }, [
    opt("allow_meeting", [
      coolPlot("auh_pl_magyar", 3),
      cool("auh_karolyi", 2),
      trustDeu(-1),
      why("magyar_allowed"),
    ]),
    opt("ban_meeting", [
      coolPlot("auh_pl_magyar", 2),
      heat("auh_karolyi", 2),
      why("magyar_banned"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_magyar_2", { hun: held("hun_pm") }, [
    opt("arrest", [
      beatPlot("auh_pl_magyar"),
      heatPlot("auh_pl_nations", 3),
      heat("auh_karolyi", 2),
      heat("auh_indep", 1),
      why("magyar_arrested"),
    ]),
    opt(
      "make_public",
      [beatPlot("auh_pl_magyar"), heat("auh_karolyi", 1), why("magyar_public")],
      plotConfirmed("auh_pl_magyar"),
    ),
    opt("give_way", [
      coolPlot("auh_pl_magyar", 8),
      inst("hungary", 2),
      trustDeu(-2),
      heat("auh_work", 2),
      why("magyar_gave"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  // ---- The nations ----
  signPaper("auh_pl_nations_s1"),
  signTalk("auh_pl_nations_s2", leaderOf("auh_poles")),
  signReport("auh_pl_nations_s3"),
  plotPaper("auh_pl_nations_w", { min: held("chancellor") }, [
    opt("federal_word", [
      coolPlot("auh_pl_nations", 3),
      inst("nations", 1),
      heat("auh_germans", 2),
      why("nations_word"),
    ]),
    opt("talk_leaders", [
      coolPlot("auh_pl_nations", 2),
      cool("auh_czech", 1),
      why("nations_talked"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_nations_1", { min: held("chancellor") }, [
    opt("talk_committees", [
      coolPlot("auh_pl_nations", 3),
      cool("auh_czech", 1),
      why("nations_committees"),
    ]),
    opt("ban_committees", [
      coolPlot("auh_pl_nations", 2),
      heat("auh_czech", 2),
      heat("auh_slavs", 1),
      why("nations_banned"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  plotPaper("auh_pl_nations_2", { min: held("chancellor") }, [
    opt("arrest", [
      beatPlot("auh_pl_nations"),
      heatPlot("auh_pl_magyar", 3),
      heat("auh_czech", 2),
      heat("auh_slavs", 2),
      why("nations_arrested"),
    ]),
    opt(
      "make_public",
      [beatPlot("auh_pl_nations"), inst("nations", -1), why("nations_public")],
      plotConfirmed("auh_pl_nations"),
    ),
    opt("give_way", [
      coolPlot("auh_pl_nations", 8),
      inst("nations", 2),
      inst("hungary", -2),
      heat("auh_germans", 2),
      why("nations_gave"),
    ]),
    opt("wait", [why("plot_waited")]),
  ]),
  // ---- Allies' asks ----
  {
    id: "auh_ask_grain",
    nation: ["AUH"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    cast: { head: { ruler_of: "DEU" } },
    salience: 7,
    tags: ["foreign"],
    variants: [v("base")],
    fallback: "yes",
    options: [
      opt("yes", [answerAsk("auh_ask_grain", true), tone("warm")]),
      opt("no", [
        answerAsk("auh_ask_grain", false),
        tone("cold"),
        cool("auh_work", 1),
      ]),
    ],
  },
  {
    id: "auh_ask_east",
    nation: ["AUH"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    cast: { head: { ruler_of: "DEU" } },
    salience: 7,
    tags: ["foreign", "war"],
    variants: [v("base")],
    fallback: "yes",
    options: [
      opt("yes", [
        answerAsk("auh_ask_east", true),
        tone("warm"),
        heat("auh_aok", 1),
      ]),
      opt("no", [answerAsk("auh_ask_east", false), tone("cold")]),
    ],
  },
  {
    id: "auh_ask_serbia",
    nation: ["AUH"],
    kind: "letter",
    who: "head",
    scheduledOnly: true,
    cast: { head: { ruler_of: "BGR" } },
    salience: 7,
    tags: ["foreign", "war"],
    variants: [v("base")],
    fallback: "yes",
    options: [
      opt("yes", [answerAsk("auh_ask_serbia", true), tone("warm")]),
      opt("no", [answerAsk("auh_ask_serbia", false), tone("cold")]),
    ],
  },
  {
    id: "auh_ask_pless",
    nation: ["AUH"],
    kind: "talk",
    big: true,
    once: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["foreign", "war"],
    cast: { head: { ruler_of: "DEU" }, cos: COS },
    who: "head",
    start: "n1",
    variants: [v("base")],
    nodes: {
      n1: { says: [{ id: "base" }], replies: [reply("hear", "n2")] },
      n2: { who: "cos", says: [{ id: "base" }], replies: [reply("on", "n3")] },
      n3: {
        who: "head",
        fallback: "yes",
        says: [{ id: "base" }],
        replies: [
          decide("yes", null, [
            answerAsk("auh_ask_pless", true),
            inst("army", -1),
            trustOf(role("cos"), -1),
            why("pless_yes"),
          ]),
          decide("no", null, [
            answerAsk("auh_ask_pless", false),
            inst("army", 1),
            why("pless_no"),
          ]),
        ],
      },
    },
  },
];
