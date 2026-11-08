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
  chose,
  flag,
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
  either,
  gauge,
  held,
  inst,
  isText,
  lawTalk,
  men,
  office,
  person,
  war,
} from "../laws/kit";
import {
  cool,
  grow,
  heat,
  isLaw,
  leaderOf,
  low,
  temper,
  under,
  warAge,
} from "./kit";

// GBR's house: factions, what they make of each bill, their own bills, and
// (S2) plots, weaknesses and allies' asks (ww158-format.md). Text in
// resources/ww1914/ko/GBR.house.json. The house itself (chambers, whip, way
// round) is in ./houses.ts and comes into play once this file has factions.
//
// Leaders checked against en.wikipedia (Gulland, Addison, Dillon, Smillie,
// MacDonald, Ponsonby, Lansdowne, the Military Service Acts); Griffith and de
// Valera from memory. The played seat never changes here: Asquith leads the
// Liberals only once the chair has already gone to Lloyd George (f_pm_lg).

const NATION: GwScene["nation"] = ["GBR"];
const lg = flag("f_pm_lg");
const co = flag("f_coalition");
/** The bill isn't in the house or in force: a promise about it can still be kept. */
const toCome = (law: string): GwCond =>
  not(
    world({ is: "law", id: law, of: ["draft", "persuade", "vote", "force"] }),
  );
const irelandAt = (min: number): GwCond => ({
  kind: "pressure",
  topic: "ireland",
  min,
});
const bloc = (b: GwFactionRow["bloc"]): GwCond => ({
  kind: "bloc",
  bloc: b,
  max: -3,
});
const lead = role("lead");

export const GBR_FACTIONS: readonly GwFactionRow[] = [
  {
    id: "gbr_liberals",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { commons: 2, lords: 1 },
    leaders: [{ person: "gbr_asquith", when: lg }, { person: "gbr_mckenna" }],
    grows: [
      { when: all(co, warAge(20)), by: -1, every: 9, key: "coalition_wears" },
      {
        when: world({ is: "faction", id: "gbr_lg", of: ["in"] }),
        by: -1,
        every: 8,
        key: "lg_pulls",
      },
    ],
    feeds: [
      { when: bloc("parliament"), key: "house_cold" },
      { when: isText("gbr_conscription", "all_men"), key: "all_men_law" },
      { when: world({ is: "around", min: 2 }), key: "round_used" },
    ],
    cools: [
      { when: isLaw("gbr_franchise"), key: "franchise_law" },
      { when: flag("f_home_rule_lives"), key: "home_rule_alive" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_lib_2" },
      { at: 6, scene: "gbr_f_lib_3" },
    ],
    bills: ["gbr_franchise"],
    wants: [
      {
        id: "franchise_next",
        when: toCome("gbr_franchise"),
        keep: isLaw("gbr_franchise"),
        chapters: 10,
      },
      {
        id: "home_rule_next",
        when: not(flag("f_home_rule_lives")),
        keep: flag("f_home_rule_lives"),
        chapters: 10,
      },
    ],
    amends: {
      gbr_conscription: "conscience",
      gbr_dora: "civil_trial",
      gbr_munitions: "tribunals",
      gbr_married_men: "with_tribunals",
      gbr_wealth: "profits_duty",
    },
    splits: {
      when: any(
        lg,
        all(co, warAge(24), world({ is: "gov", id: "gbr_table", min: 3 })),
      ),
      into: "gbr_lg",
      takes: 1,
      scene: "gbr_f_lg",
    },
  },
  {
    id: "gbr_rebels",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 1,
    seats: { commons: 1 },
    leaders: [{ person: "gbr_simon" }, { person: "gbr_morley" }],
    radical: "gbr_i_ponsonby",
    grows: [
      {
        when: isLaw("gbr_conscription"),
        by: 1,
        every: 8,
        key: "conscription_rebels",
      },
      {
        when: all(warAge(24), world({ is: "casualties", min: 300 })),
        by: 1,
        every: 9,
        key: "long_lists",
      },
    ],
    feeds: [
      { when: isLaw("gbr_conscription"), key: "conscription_law" },
      { when: isText("gbr_dora", "courts_martial"), key: "courts_martial" },
    ],
    cools: [
      { when: flag("f_gbr_peace_aims"), key: "peace_aims" },
      { when: isLaw("gbr_war_aims"), key: "war_aims_law" },
      { when: flag("f_aims_moderate"), key: "aims_moderate" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_reb_2" },
      { at: 6, scene: "gbr_f_reb_3" },
    ],
    bills: ["gbr_war_aims"],
    wants: [
      {
        id: "war_aims_next",
        when: toCome("gbr_war_aims"),
        keep: isLaw("gbr_war_aims"),
        chapters: 10,
      },
      { id: "hear_conscience", keep: war, chapters: 2 },
    ],
    amends: {
      gbr_conscription: "conscience",
      gbr_dora: "civil_trial",
      gbr_war_aims: "no_annexation",
    },
  },
  {
    id: "gbr_lg",
    tag: "GBR",
    bloc: "press",
    start: "out",
    strength: 1,
    seats: { commons: 1 },
    leaders: [
      { person: "gbr_lloyd_george", when: not(lg) },
      { person: "gbr_i_addison" },
    ],
    grows: [
      {
        when: all(warAge(24), world({ is: "gov", id: "gbr_table", min: 3 })),
        by: 1,
        every: 6,
        key: "table_shakes",
      },
      { when: lg, by: 1, every: 6, key: "in_the_chair" },
    ],
    feeds: [
      {
        when: all(warAge(18), not(isLaw("gbr_conscription"))),
        key: "no_conscription",
      },
      { when: chose("gbr_h_committee", "refuse"), key: "committee_refused" },
    ],
    cools: [
      { when: flag("f_gbr_committee_lg"), key: "committee_given" },
      { when: isLaw("gbr_conscription"), key: "conscription_law" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_lg_2" },
      { at: 6, scene: "gbr_f_lg_3" },
    ],
    bills: ["gbr_food"],
    wants: [
      {
        id: "conscription_next",
        when: toCome("gbr_conscription"),
        keep: isLaw("gbr_conscription"),
        chapters: 8,
      },
      {
        id: "food_next",
        when: toCome("gbr_food"),
        keep: isLaw("gbr_food"),
        chapters: 8,
      },
    ],
    amends: {
      gbr_conscription: "all_men",
      gbr_food: "national_cards",
      gbr_wealth: "profits_duty",
    },
  },
  {
    id: "gbr_unionists",
    tag: "GBR",
    bloc: "business",
    start: "in",
    strength: 3,
    seats: { commons: 3 },
    leaders: [{ person: "gbr_bonar_law" }, { person: "gbr_balfour" }],
    grows: [
      {
        when: all(warAge(12), not(isLaw("gbr_conscription"))),
        by: 1,
        every: 9,
        key: "conscription_cry",
      },
      {
        when: world({ is: "casualties", min: 300 }),
        by: 1,
        every: 12,
        key: "long_lists",
      },
    ],
    feeds: [
      { when: bloc("business"), key: "city_turned" },
      { when: flag("f_home_rule_lives"), key: "home_rule_law" },
      { when: all(warAge(10), not(co)), key: "kept_out" },
    ],
    cools: [
      { when: co, key: "coalition_seats" },
      { when: isLaw("gbr_conscription"), key: "conscription_law" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_uni_2" },
      { at: 7, scene: "gbr_f_uni_3" },
    ],
    bills: ["gbr_conscription"],
    wants: [
      {
        id: "conscription_next",
        when: toCome("gbr_conscription"),
        keep: isLaw("gbr_conscription"),
        chapters: 8,
      },
      {
        id: "luxury_duties",
        keep: war,
        chapters: 2,
        effects: [heat("gbr_liberals", 1), heat("gbr_rebels", 1)],
      },
    ],
    amends: {
      gbr_conscription: "all_men",
      gbr_home_rule: "six_counties_out",
      gbr_dora: "courts_martial",
      gbr_franchise: "soldiers_only",
      gbr_rent: "rent_courts",
      gbr_wealth: "after_the_war",
    },
    splits: {
      when: all(
        warAge(16),
        not(isLaw("gbr_conscription")),
        any(
          temper("gbr_unionists", 2),
          world({ is: "gov", id: "gbr_unionists", min: 3 }),
        ),
      ),
      into: "gbr_uwc",
      takes: 1,
      scene: "gbr_f_uwc",
    },
  },
  {
    id: "gbr_uwc",
    tag: "GBR",
    bloc: "army",
    start: "out",
    strength: 1,
    seats: { commons: 1 },
    leaders: [{ person: "gbr_carson" }],
    grows: [
      {
        when: all(
          isLaw("gbr_conscription"),
          not(isText("gbr_conscription", "all_men")),
          not(isLaw("gbr_married_men")),
        ),
        by: 1,
        every: 6,
        key: "married_men_cry",
      },
      {
        when: world({ is: "casualties", min: 200 }),
        by: 1,
        every: 9,
        key: "long_lists",
      },
    ],
    feeds: [
      { when: not(isLaw("gbr_conscription")), key: "no_conscription" },
      { when: flag("f_home_rule_lives"), key: "home_rule_law", by: 2 },
    ],
    cools: [
      { when: isLaw("gbr_married_men"), key: "married_men_law" },
      { when: isText("gbr_conscription", "all_men"), key: "all_men_law" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_uwc_2" },
      { at: 6, scene: "gbr_f_uwc_3" },
    ],
    bills: ["gbr_married_men"],
    wants: [
      {
        id: "married_next",
        when: toCome("gbr_married_men"),
        keep: any(
          isLaw("gbr_married_men"),
          isText("gbr_conscription", "all_men"),
        ),
        chapters: 8,
      },
    ],
    amends: {
      gbr_conscription: "all_men",
      gbr_home_rule: "six_counties_out",
      gbr_married_men: "older_too",
    },
  },
  {
    id: "gbr_labour",
    tag: "GBR",
    bloc: "workers",
    start: "in",
    strength: 2,
    seats: { commons: 1 },
    leaders: [{ person: "gbr_henderson" }],
    radical: "gbr_i_smillie",
    grows: [
      { when: low("bread", 1), by: 1, every: 6, key: "bread_queues" },
      { when: flag("f_gbr_labour_in"), by: 1, every: 12, key: "in_office" },
      {
        when: world({ is: "unrest", min: 1 }),
        by: 1,
        every: 6,
        key: "factory_anger",
      },
    ],
    feeds: [
      { when: bloc("workers"), key: "unions_turned" },
      {
        when: isText("gbr_munitions", "leaving_papers"),
        key: "leaving_papers",
      },
      { when: flag("f_gbr_henderson_out"), key: "henderson_out", by: 2 },
    ],
    cools: [
      { when: flag("f_gbr_union_deal"), key: "treasury_deal" },
      { when: isLaw("gbr_rent"), key: "rent_law" },
      { when: flag("f_gbr_labour_in"), key: "labour_in" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_lab_2" },
      { at: 6, scene: "gbr_f_lab_3" },
    ],
    bills: ["gbr_wealth", "gbr_rent"],
    wants: [
      {
        id: "rent_next",
        when: toCome("gbr_rent"),
        keep: isLaw("gbr_rent"),
        chapters: 8,
      },
      {
        id: "wealth_next",
        when: toCome("gbr_wealth"),
        keep: isLaw("gbr_wealth"),
        chapters: 10,
      },
      {
        id: "pensions",
        keep: war,
        chapters: 2,
        effects: [gauge("money", -1)],
      },
    ],
    amends: {
      gbr_munitions: "tribunals",
      gbr_conscription: "conscience",
      gbr_food: "national_cards",
      gbr_franchise: "women_thirty",
      gbr_married_men: "with_tribunals",
      gbr_wealth: "capital_levy",
    },
    splits: {
      when: all(
        warAge(20),
        any(
          temper("gbr_labour", 2),
          isLaw("gbr_conscription"),
          flag("f_gbr_stockholm_no"),
        ),
      ),
      into: "gbr_ilp",
      takes: 1,
      scene: "gbr_f_ilp",
    },
  },
  {
    id: "gbr_ilp",
    tag: "GBR",
    bloc: "workers",
    start: "out",
    strength: 1,
    seats: { commons: 1 },
    leaders: [{ person: "gbr_i_macdonald" }],
    grows: [
      { when: low("bread", 1), by: 1, every: 6, key: "bread_queues" },
      {
        when: world({
          is: "regime",
          tag: "RUS",
          of: ["provisional", "rep", "soviet"],
        }),
        by: 1,
        every: 6,
        key: "russia_spring",
      },
    ],
    feeds: [
      { when: isLaw("gbr_conscription"), key: "conscription_law" },
      { when: isText("gbr_dora", "courts_martial"), key: "courts_martial" },
    ],
    cools: [
      { when: isLaw("gbr_war_aims"), key: "war_aims_law" },
      { when: flag("f_aims_moderate"), key: "aims_moderate" },
      { when: flag("f_gbr_peace_aims"), key: "peace_aims" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_ilp_2" },
      { at: 6, scene: "gbr_f_ilp_3" },
    ],
    bills: ["gbr_war_aims"],
    wants: [
      {
        id: "war_aims_next",
        when: toCome("gbr_war_aims"),
        keep: isLaw("gbr_war_aims"),
        chapters: 10,
      },
    ],
    amends: { gbr_conscription: "conscience", gbr_war_aims: "negotiate_now" },
  },
  {
    id: "gbr_irish",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { commons: 2 },
    leaders: [{ person: "gbr_redmond" }, { person: "gbr_i_dillon" }],
    grows: [
      {
        when: flag("f_home_rule_lives"),
        by: 1,
        every: 9,
        key: "home_rule_alive",
      },
      { when: flag("f_gbr_rising"), by: -1, every: 6, key: "after_rising" },
      { when: flag("f_gbr_irish_draft"), by: -1, every: 4, key: "irish_draft" },
    ],
    feeds: [
      { when: irelandAt(3), key: "ireland_boils" },
      { when: flag("f_gbr_irish_draft"), key: "irish_draft", by: 2 },
      { when: flag("f_gbr_carson_in"), key: "carson_in" },
    ],
    cools: [
      { when: flag("f_home_rule_lives"), key: "home_rule_alive" },
      { when: flag("f_gbr_courts_stopped"), key: "courts_stopped" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_iri_2" },
      { at: 6, scene: "gbr_f_iri_3" },
    ],
    bills: ["gbr_home_rule"],
    wants: [
      {
        id: "home_rule_next",
        when: not(flag("f_home_rule_lives")),
        keep: flag("f_home_rule_lives"),
        chapters: 10,
      },
      {
        id: "irish_money",
        keep: war,
        chapters: 2,
        effects: [
          gauge("money", -1),
          { kind: "pressure", topic: "ireland", delta: -1 },
        ],
      },
    ],
    amends: {
      gbr_home_rule: "all_ireland",
      gbr_drink: "short_hours",
      gbr_conscription: "conscience",
    },
    splits: {
      when: all(
        any(flag("f_gbr_rising"), flag("f_gbr_irish_draft")),
        irelandAt(3),
      ),
      into: "gbr_sinn_fein",
      takes: 1,
      scene: "gbr_f_sinn_fein",
    },
  },
  {
    id: "gbr_sinn_fein",
    tag: "GBR",
    bloc: "parliament",
    start: "out",
    strength: 1,
    // It wins seats and doesn't take them: it is never counted.
    seats: {},
    leaders: [
      { person: "gbr_i_de_valera", when: flag("f_gbr_rising") },
      { person: "gbr_i_griffith" },
    ],
    grows: [
      { when: flag("f_gbr_irish_draft"), by: 1, every: 3, key: "irish_draft" },
      { when: irelandAt(3), by: 1, every: 6, key: "ireland_boils" },
      {
        when: flag("f_home_rule_lives"),
        by: -1,
        every: 9,
        key: "home_rule_alive",
      },
    ],
    feeds: [
      { when: flag("f_gbr_irish_draft"), key: "irish_draft", by: 2 },
      { when: irelandAt(4), key: "ireland_boils" },
    ],
    cools: [
      { when: flag("f_gbr_courts_stopped"), key: "courts_stopped" },
      { when: flag("f_ireland_settled"), key: "settled" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_sf_2" },
      { at: 6, scene: "gbr_f_sf_3" },
    ],
  },
  {
    id: "gbr_peers",
    tag: "GBR",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: { lords: 2 },
    leaders: [
      { person: "gbr_i_lansdowne", when: not(lg) },
      { person: "gbr_i_curzon" },
    ],
    grows: [
      {
        when: flag("f_home_rule_lives"),
        by: 1,
        every: 12,
        key: "home_rule_law",
      },
    ],
    feeds: [
      { when: flag("f_home_rule_lives"), key: "home_rule_law" },
      { when: isText("gbr_franchise", "women_equal"), key: "women_equal" },
      { when: isText("gbr_rent", "freeze_all"), key: "rents_frozen" },
    ],
    cools: [{ when: co, key: "coalition_seats" }],
    steps: [
      { at: 3, scene: "gbr_f_peer_2" },
      { at: 6, scene: "gbr_f_peer_3" },
    ],
    wants: [{ id: "debate_time", keep: war, chapters: 2 }],
    amends: {
      gbr_franchise: "soldiers_only",
      gbr_rent: "rent_courts",
      gbr_home_rule: "six_counties_out",
      gbr_dora: "civil_trial",
    },
  },
  {
    id: "gbr_generals",
    tag: "GBR",
    bloc: "army",
    start: "in",
    strength: 2,
    // The army weighs in; it has no vote.
    seats: {},
    leaders: [
      { person: "gbr_robertson" },
      { person: "gbr_haig" },
      { person: "gbr_wilson" },
    ],
    grows: [
      {
        when: world({ is: "main", of: ["west"] }),
        by: 1,
        every: 9,
        key: "west_first",
      },
      { when: isLaw("gbr_conscription"), by: 1, every: 12, key: "men_come" },
    ],
    feeds: [
      {
        when: all(warAge(16), not(isLaw("gbr_conscription"))),
        key: "no_men",
      },
      { when: { kind: "inst", inst: "army", max: -2 }, key: "army_cold" },
    ],
    cools: [
      { when: isLaw("gbr_conscription"), key: "conscription_law" },
      { when: isLaw("gbr_married_men"), key: "married_men_law" },
    ],
    steps: [
      { at: 3, scene: "gbr_f_gen_2" },
      { at: 6, scene: "gbr_f_gen_3" },
    ],
  },
];

/** Stances on the bills, by law id: existing bills and the factions' own. */
export const GBR_BILLS: readonly GwBillRow[] = [
  {
    law: "gbr_dora",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: -1,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: 0,
      gbr_ilp: -1,
      gbr_irish: 1,
      gbr_peers: 1,
    },
    texts: {
      courts_martial: { gbr_labour: -1, gbr_liberals: 0, gbr_peers: 0 },
      civil_trial: { gbr_rebels: 0, gbr_labour: 1 },
    },
  },
  {
    law: "gbr_drink",
    around: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 0,
      gbr_lg: 1,
      gbr_unionists: -1,
      gbr_uwc: 0,
      gbr_labour: -1,
      gbr_ilp: 0,
      gbr_irish: -1,
      gbr_peers: -1,
    },
    texts: {
      short_hours: { gbr_unionists: 0, gbr_labour: 0, gbr_peers: 0 },
      kings_pledge: { gbr_rebels: -1, gbr_uwc: -1 },
    },
  },
  {
    law: "gbr_munitions",
    around: true,
    sponsor: either(office("munitions"), office("finance")),
    stance: {
      gbr_liberals: 1,
      gbr_rebels: -1,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: 0,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      treasury_terms: { gbr_labour: 1 },
      leaving_papers: { gbr_labour: -1, gbr_irish: -1 },
      tribunals: { gbr_labour: 1, gbr_rebels: 0 },
    },
  },
  {
    law: "gbr_register",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: -1,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: -1,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      plain_census: { gbr_labour: 0, gbr_rebels: 0 },
      canvass: { gbr_liberals: 0, gbr_irish: -1 },
    },
  },
  {
    law: "gbr_rent",
    around: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: 0,
      gbr_uwc: 0,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 1,
      gbr_peers: -1,
    },
    texts: {
      freeze_all: { gbr_unionists: -1, gbr_uwc: -1 },
      rent_courts: {
        gbr_unionists: 1,
        gbr_peers: 0,
        gbr_labour: 0,
        gbr_ilp: -1,
      },
    },
  },
  {
    law: "gbr_conscription",
    stance: {
      gbr_liberals: 0,
      gbr_rebels: -1,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: -1,
      gbr_ilp: -1,
      gbr_irish: -1,
      gbr_peers: 1,
    },
    texts: {
      all_men: { gbr_liberals: -1 },
      conscience: { gbr_liberals: 1, gbr_labour: 0, gbr_irish: 0 },
    },
  },
  {
    law: "gbr_food",
    around: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: 0,
      gbr_uwc: 0,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
      gbr_peers: 0,
    },
    texts: {
      national_cards: { gbr_unionists: -1, gbr_peers: -1 },
      price_only: { gbr_unionists: 1, gbr_labour: 0, gbr_ilp: -1 },
    },
  },
  {
    law: "gbr_franchise",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: 0,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
      gbr_peers: -1,
    },
    texts: {
      soldiers_only: {
        gbr_unionists: 1,
        gbr_uwc: 1,
        gbr_labour: -1,
        gbr_ilp: -1,
        gbr_peers: 0,
      },
      women_equal: { gbr_unionists: -1, gbr_liberals: 0, gbr_irish: -1 },
    },
  },
  {
    law: "gbr_home_rule",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 0,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 1,
      gbr_peers: -1,
    },
    texts: {
      six_counties_out: {
        gbr_unionists: 0,
        gbr_peers: 0,
        gbr_irish: 0,
        gbr_lg: 1,
      },
      all_ireland: { gbr_lg: -1, gbr_liberals: 0 },
    },
  },
  {
    law: "gbr_married_men",
    by: "gbr_uwc",
    stance: {
      gbr_liberals: 0,
      gbr_rebels: -1,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: -1,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      with_tribunals: { gbr_liberals: 1, gbr_labour: 0 },
      older_too: { gbr_liberals: -1, gbr_lg: 0 },
    },
  },
  {
    law: "gbr_war_aims",
    by: "gbr_rebels",
    resolution: true,
    houses: ["commons"],
    stance: {
      gbr_liberals: 0,
      gbr_rebels: 1,
      gbr_lg: -1,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
    },
    texts: {
      plain_aims: { gbr_liberals: 1, gbr_lg: 0, gbr_unionists: 0 },
      negotiate_now: { gbr_labour: 0, gbr_irish: -1 },
    },
  },
  {
    law: "gbr_wealth",
    by: "gbr_labour",
    money: true,
    stance: {
      gbr_liberals: 0,
      gbr_rebels: 1,
      gbr_lg: 0,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
      gbr_peers: -1,
    },
    texts: {
      profits_duty: { gbr_liberals: 1, gbr_lg: 1, gbr_unionists: 0 },
      capital_levy: { gbr_liberals: -1, gbr_lg: -1 },
      after_the_war: { gbr_liberals: 1, gbr_unionists: 0, gbr_labour: 0 },
    },
  },
];

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "GBR" });

/** The factions' own bills: rows like content/laws/gbr.ts, with no tells. */
export const GBR_HOUSE_LAWS: readonly GwLawRow[] = [
  // Carson's committee wants the married men too (the second Military Service
  // Act of May 1916, en.wikipedia Military Service Act 1916).
  row({
    id: "gbr_married_men",
    opens: all(
      war,
      isLaw("gbr_conscription"),
      not(isText("gbr_conscription", "all_men")),
    ),
    lean: 0,
    decree: false,
    cast: { sec: held("war") },
    draft: [
      draft("all_married", 0, [], [men(6)]),
      draft("with_tribunals", 1, [], [men(3)]),
      draft("older_too", -1, [], [men(9), gauge("order", -1)]),
    ],
    passed: [men(6), gauge("order", -1)],
    passedTell: [],
    term: [{ gauge: "manpower", delta: 1, every: 3 }],
    repeal: { authority: 25, tell: [], effects: [men(-6), gauge("order", 1)] },
    talk: lawTalk("gbr_married_men", {
      who: person("gbr_henderson"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  // The Commons is asked to say what Britain fights for: a motion, no law.
  row({
    id: "gbr_war_aims",
    opens: all(war, warAge(18)),
    lean: -1,
    decree: false,
    cast: { fm: held("foreign") },
    draft: [
      draft("plain_aims", 1, [], [gauge("order", 1)]),
      draft("no_annexation", 0, [], [gauge("order", 1), gauge("morale", -1)]),
      draft("negotiate_now", -2, [], [gauge("order", 2), gauge("morale", -2)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [],
    repeal: { authority: 5, tell: [], effects: [] },
    // The government's own statement of aims (gbr_f_war_aims, the foreign
    // share) already said it; once the motion is taken up, that paper waits.
    settled: any(flag("f_aims_moderate"), flag("f_aims_american")),
    replaces: ["gbr_f_war_aims"],
    talk: lawTalk("gbr_war_aims", {
      who: person("gbr_grey"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("cabinet", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
  }),
  // Labour's "conscription of wealth": a heavier tax on war profits, or a levy
  // on capital. The Excess Profits Duty itself was the Treasury's (50%, later
  // 80%: en.wikipedia Excess profits tax).
  row({
    id: "gbr_wealth",
    opens: all(war, warAge(12)),
    lean: -1,
    decree: false,
    cast: { fin: held("finance") },
    draft: [
      draft("profits_duty", 1, [], [gauge("money", 1)]),
      draft("capital_levy", -2, [], [gauge("money", 2), gauge("order", 1)]),
      draft("after_the_war", 0, [], [gauge("order", 1)]),
    ],
    passed: [gauge("money", 1), gauge("order", 1)],
    passedTell: [],
    term: [{ gauge: "money", delta: 1, every: 8 }],
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("gbr_wealth", {
      who: person("gbr_bonar_law"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("opposition", 1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
];

// ---- Scenes written by hand: tempers, splits ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
/** An option: no tell, its reason line after. */
const o = (id: string, scene: string, effects: GwEffect[]): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
});

/** A faction's temper rises: its leader (or its radical) comes. */
const step = (
  id: string,
  f: string,
  options: GwOption[],
  variants: GwVariant[] = [v("base")],
): GwScene => ({
  id,
  nation: NATION,
  kind: "audience",
  scheduledOnly: true,
  cast: { lead: leaderOf(f) },
  salience: 7,
  tags: ["home", "tension_up"],
  cooldown: 4,
  variants,
  fallback: options[options.length - 1].id,
  options,
});

/** A faction breaks off: the new one's leader comes. */
const split = (
  id: string,
  f: string,
  options: GwOption[],
  variants: GwVariant[] = [v("base")],
): GwScene => ({
  ...step(id, f, options, variants),
  once: true,
  salience: 8,
});

const S = (
  id: string,
  f: string,
  opts: [string, GwEffect[]][],
  vs?: GwVariant[],
) =>
  step(
    id,
    f,
    opts.map(([k, e]) => o(k, id, e)),
    vs,
  );
const P = (
  id: string,
  f: string,
  opts: [string, GwEffect[]][],
  vs?: GwVariant[],
) =>
  split(
    id,
    f,
    opts.map(([k, e]) => o(k, id, e)),
    vs,
  );

/** Step scenes, split and join scenes, demand and bill scenes written by hand. */
export const GBR_HOUSE_SCENES: readonly GwScene[] = [
  S("gbr_f_lib_2", "gbr_liberals", [
    ["party_meeting", [cool("gbr_liberals", 2), heat("gbr_unionists", 1)]],
    ["whip_hard", [cool("gbr_liberals", 1), inst("commons", -1)]],
    ["let_be", []],
  ]),
  S(
    "gbr_f_lib_3",
    "gbr_liberals",
    [
      ["posts_back", [cool("gbr_liberals", 2), inst("cabinet", -1)]],
      ["coalition_first", [grow("gbr_liberals", -1), cool("gbr_unionists", 1)]],
      ["let_be", []],
    ],
    [v("lg", lg), v("base")],
  ),
  S("gbr_f_reb_2", "gbr_rebels", [
    ["hear_them", [cool("gbr_rebels", 2), heat("gbr_uwc", 1)]],
    ["civil_courts", [cool("gbr_rebels", 1), inst("army", -1)]],
    ["let_be", []],
  ]),
  S("gbr_f_reb_3", "gbr_rebels", [
    ["write_aims", [cool("gbr_rebels", 2), heat("gbr_lg", 1)]],
    ["censor_them", [heat("gbr_rebels", 1), { kind: "censor", delta: 1 }]],
    ["let_be", [{ kind: "opinion", bloc: "press", delta: -1 }]],
  ]),
  S(
    "gbr_f_lg_2",
    "gbr_lg",
    [
      ["meet_him", [cool("gbr_lg", 2), heat("gbr_liberals", 1)]],
      ["more_hands", [cool("gbr_lg", 1), inst("army", -1)]],
      ["let_be", []],
    ],
    [v("lg", lg), v("base")],
  ),
  S(
    "gbr_f_lg_3",
    "gbr_lg",
    [
      ["committee", [cool("gbr_lg", 2), inst("cabinet", -1)]],
      ["count_back", [heat("gbr_lg", 1), cool("gbr_liberals", 1)]],
      ["let_be", []],
    ],
    [v("lg", lg), v("base")],
  ),
  S("gbr_f_uni_2", "gbr_unionists", [
    ["give_seat", [cool("gbr_unionists", 2), heat("gbr_liberals", 1)]],
    ["talk_alone", [cool("gbr_unionists", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S("gbr_f_uni_3", "gbr_unionists", [
    [
      "concede",
      [cool("gbr_unionists", 2), heat("gbr_rebels", 1), heat("gbr_labour", 1)],
    ],
    ["call_bluff", [heat("gbr_unionists", 1), cool("gbr_liberals", 1)]],
    ["let_be", []],
  ]),
  S("gbr_f_uwc_2", "gbr_uwc", [
    ["receive", [cool("gbr_uwc", 2), heat("gbr_irish", 1)]],
    ["war_office", [cool("gbr_uwc", 1), inst("army", 1), inst("cabinet", -1)]],
    ["let_be", []],
  ]),
  S("gbr_f_uwc_3", "gbr_uwc", [
    ["offer_office", [cool("gbr_uwc", 2), heat("gbr_irish", 2)]],
    ["debate", [cool("gbr_uwc", 1), inst("commons", -1)]],
    ["let_be", [heat("gbr_uwc", 1)]],
  ]),
  S("gbr_f_lab_2", "gbr_labour", [
    ["meet_unions", [cool("gbr_labour", 2), gauge("money", -1)]],
    ["henderson_goes", [cool("gbr_labour", 1), trustOf(lead, 1)]],
    ["hold_line", [heat("gbr_labour", 1)]],
  ]),
  S("gbr_f_lab_3", "gbr_labour", [
    ["take_mines", [cool("gbr_labour", 2), heat("gbr_unionists", 2)]],
    [
      "miners_terms",
      [cool("gbr_labour", 1), gauge("money", -1), heat("gbr_unionists", 1)],
    ],
    ["let_be", []],
  ]),
  S("gbr_f_ilp_2", "gbr_ilp", [
    ["answer_house", [cool("gbr_ilp", 1), heat("gbr_uwc", 1)]],
    ["close_halls", [heat("gbr_ilp", 2), { kind: "censor", delta: 1 }]],
    ["let_be", [cool("gbr_ilp", 1)]],
  ]),
  S("gbr_f_ilp_3", "gbr_ilp", [
    ["observer", [cool("gbr_ilp", 1)]],
    ["ban_hall", [heat("gbr_ilp", 1), gauge("order", -1)]],
    [
      "let_meet",
      [cool("gbr_ilp", 2), heat("gbr_uwc", 1), heat("gbr_unionists", 1)],
    ],
  ]),
  S("gbr_f_iri_2", "gbr_irish", [
    ["promise_bill", [cool("gbr_irish", 2), heat("gbr_unionists", 1)]],
    [
      "irish_brigade",
      [cool("gbr_irish", 1), { kind: "pressure", topic: "ireland", delta: -1 }],
    ],
    ["let_be", []],
  ]),
  S("gbr_f_iri_3", "gbr_irish", [
    ["dublin_talks", [cool("gbr_irish", 2), heat("gbr_uwc", 1)]],
    [
      "castle_holds",
      [heat("gbr_irish", 1), { kind: "pressure", topic: "ireland", delta: 1 }],
    ],
    ["let_be", []],
  ]),
  S("gbr_f_sf_2", "gbr_sinn_fein", [
    ["release", [cool("gbr_sinn_fein", 2), heat("gbr_unionists", 1)]],
    [
      "ban_drill",
      [
        heat("gbr_sinn_fein", 1),
        { kind: "pressure", topic: "ireland", delta: 1 },
      ],
    ],
    ["let_be", [cool("gbr_sinn_fein", 1)]],
  ]),
  S("gbr_f_sf_3", "gbr_sinn_fein", [
    [
      "drop_draft",
      [cool("gbr_sinn_fein", 2), heat("gbr_uwc", 2), heat("gbr_unionists", 1)],
    ],
    [
      "detain",
      [
        under("gbr_sinn_fein"),
        heat("gbr_irish", 2),
        { kind: "pressure", topic: "ireland", delta: 1 },
      ],
    ],
    ["let_be", []],
  ]),
  S("gbr_f_peer_2", "gbr_peers", [
    ["lords_time", [cool("gbr_peers", 2), heat("gbr_rebels", 1)]],
    ["send_paper", [cool("gbr_peers", 1), inst("cabinet", -1)]],
    ["let_be", []],
  ]),
  S("gbr_f_peer_3", "gbr_peers", [
    ["meet_him", [cool("gbr_peers", 2), heat("gbr_labour", 1)]],
    ["go_without", [heat("gbr_peers", 1), inst("commons", 1)]],
    ["let_be", []],
  ]),
  S("gbr_f_gen_2", "gbr_generals", [
    [
      "more_men",
      [cool("gbr_generals", 2), heat("gbr_rebels", 1), heat("gbr_labour", 1)],
    ],
    ["hear_him", [cool("gbr_generals", 1), inst("army", 1)]],
    ["let_be", []],
  ]),
  S("gbr_f_gen_3", "gbr_generals", [
    ["his_terms", [cool("gbr_generals", 2), inst("cabinet", -1)]],
    [
      "answer_papers",
      [cool("gbr_generals", 1), { kind: "opinion", bloc: "press", delta: -1 }],
    ],
    ["let_be", [heat("gbr_generals", 1)]],
  ]),
  // Splits.
  P(
    "gbr_f_lg",
    "gbr_lg",
    [
      ["welcome", [cool("gbr_lg", 1), heat("gbr_liberals", 1)]],
      ["mend", [cool("gbr_liberals", 1), heat("gbr_lg", 1)]],
      ["let_be", []],
    ],
    [v("lg", lg), v("base")],
  ),
  P("gbr_f_uwc", "gbr_uwc", [
    ["receive", [cool("gbr_uwc", 1), heat("gbr_rebels", 1)]],
    ["through_law", [cool("gbr_unionists", 1), heat("gbr_uwc", 1)]],
    ["let_be", []],
  ]),
  P("gbr_f_ilp", "gbr_ilp", [
    ["hear_him", [cool("gbr_ilp", 1), heat("gbr_uwc", 1)]],
    ["back_henderson", [cool("gbr_labour", 1), heat("gbr_ilp", 1)]],
    ["let_be", []],
  ]),
  P(
    "gbr_f_sinn_fein",
    "gbr_sinn_fein",
    [
      ["redmond_first", [cool("gbr_irish", 1), heat("gbr_sinn_fein", 1)]],
      ["castle_report", [{ kind: "pressure", topic: "ireland", delta: 1 }]],
      ["let_be", []],
    ],
    [v("draft", flag("f_gbr_irish_draft")), v("base")],
  ),
];

// ---- S2 ----
export const GBR_PLOTS: readonly GwPlotRow[] = [];
export const GBR_WEAK: readonly GwWeakRow[] = [];
export const GBR_ASKS: readonly GwAskRow[] = [];
/** Plot signs, warnings, steps and ends; dossier scenes; asks; conferences. */
export const GBR_PLOT_SCENES: readonly GwScene[] = [];
