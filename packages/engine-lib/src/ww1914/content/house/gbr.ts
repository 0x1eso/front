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
  decide,
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
  GwWant,
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import { gbrAxes } from "../laws/gbr";
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
  answerAsk,
  askAt,
  beatPlot,
  cool,
  coolPlot,
  faction,
  grow,
  heat,
  heatPlot,
  isLaw,
  leaderOf,
  low,
  plotConfirmed,
  plotHot,
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
/** ww209: Lloyd George's men are still inside the Liberal party. */
const lgOut = faction("gbr_lg", { of: ["out"] });
/** ww203: his faction's bill is on the agenda (or law): a `next` price kept. */
const onAgenda = (law: string): GwCond => not(toCome(law));
/** ww203: his amendment in place of the bill's text (a `concession`). */
const own = (id: string): GwWant => ({
  id: "own_text",
  kind: "concession",
  when: world({ is: "amendable", id }),
});

export const GBR_FACTIONS: readonly GwFactionRow[] = [
  {
    id: "gbr_liberals",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 3,
    // ww207: Home Rule and the Liberal state; class left open (free trade and the New Liberalism).
    ideals: { union: 1, rule: 1 },
    trust: 1,
    ability: "gbr_pw_ab_liberals",
    // ww203: the Liberals' 271 (Dec 1910, with 9 Lib-Labs) less Simon's 34;
    // Liberal peers about 95 of some 620: approximate (ww204 M: no party
    // count of the 1914 Lords found; the Liberal peers peaked near 120).
    seats: { commons: 237, lords: 95 },
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
        kind: "next",
        when: toCome("gbr_franchise"),
        keep: onAgenda("gbr_franchise"),
        chapters: 2,
      },
      own("gbr_liberals"),
      {
        id: "home_rule_next",
        kind: "promise",
        when: not(flag("f_home_rule_lives")),
        keep: flag("f_home_rule_lives"),
        chapters: 10,
        // ww209: the Act on the book and suspended for the war (Sept 1914).
        terms: ["half", "war_end"],
      },
    ],
    amends: {
      gbr_conscription: "conscience",
      gbr_dora: "civil_trial",
      gbr_munitions: "tribunals",
      gbr_married_men: "with_tribunals",
      gbr_wealth: "profits_duty",
      gbr_navy_estimates: "holiday_clause",
    },
    // ww209: free trade and the People's Budget's supertax.
    purse: [{ taxes: { consumption: -1, income: 1 } }],
    // ww209: the Liberals who would follow Lloyd George; Addison canvassed
    // them in December 1916. Met apart, they vote as his men.
    wing: {
      person: "gbr_i_addison",
      ideals: { class: 1, rule: -1 },
      share: 3,
      when: lgOut,
      defies: false,
      into: "gbr_lg",
    },
    splits: {
      when: any(
        lg,
        all(co, warAge(24), world({ is: "gov", id: "gbr_table", min: 3 })),
      ),
      into: "gbr_lg",
      takes: 1,
      seats: { commons: 71 },
      scene: "gbr_f_lg",
    },
  },
  {
    id: "gbr_rebels",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 1,
    // ww207: the Liberals' own creed, held against the war state.
    ideals: { union: 1, rule: 1 },
    template: "peace",
    // ww203: the 34 Liberals who went with Simon against the Military
    // Service Bill (January 1916, liberalhistory.org.uk).
    seats: { commons: 34 },
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
        kind: "next",
        when: toCome("gbr_war_aims"),
        keep: onAgenda("gbr_war_aims"),
        chapters: 2,
      },
      own("gbr_rebels"),
      {
        id: "hear_conscience",
        kind: "promise",
        keep: war,
        chapters: 2,
        terms: ["session"],
      },
    ],
    amends: {
      gbr_conscription: "conscience",
      gbr_dora: "civil_trial",
      gbr_war_aims: "no_annexation",
      gbr_navy_estimates: "fewer_keels",
    },
    // ww209: the economists who fought Churchill's Navy Estimates (1914).
    purse: [{ lines: { army: -1, navy: -1 } }],
  },
  {
    id: "gbr_lg",
    tag: "GBR",
    bloc: "press",
    start: "out",
    strength: 1,
    // ww207: the war state and social reform.
    ideals: { class: 1, rule: -1 },
    ability: "gbr_pw_ab_lg",
    // ww203: the 71 Liberals who stood by him in the Maurice debate (May
    // 1918); they come out of the Liberals at the split.
    seats: { commons: 71 },
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
      // The war committee in his hands (December 1916): the post is the keep.
      {
        id: "committee",
        kind: "post",
        when: all(not(lg), not(flag("f_gbr_committee_lg"))),
        keep: flag("f_gbr_committee_lg"),
        chapters: 4,
      },
      {
        id: "conscription_next",
        kind: "promise",
        when: toCome("gbr_conscription"),
        keep: isLaw("gbr_conscription"),
        chapters: 8,
        terms: ["session", "half"],
      },
      {
        id: "food_next",
        kind: "next",
        when: toCome("gbr_food"),
        keep: onAgenda("gbr_food"),
        chapters: 2,
      },
      own("gbr_lg"),
    ],
    amends: {
      gbr_conscription: "all_men",
      gbr_food: "national_cards",
      gbr_wealth: "profits_duty",
    },
    // ww209: the munitions drive (May 1915).
    purse: [{ lines: { army: 1 } }],
  },
  {
    id: "gbr_unionists",
    tag: "GBR",
    bloc: "business",
    start: "in",
    strength: 3,
    // ww207: the Union and Empire, property, compulsion.
    ideals: { union: -1, class: -1, rule: -1 },
    trust: -1,
    ability: "gbr_pw_ab_unionists",
    // ww203: the Unionists' 272 (Dec 1910) less the Speaker, Lowther.
    seats: { commons: 271 },
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
      // Seats in a coalition cabinet (May 1915): the post is the keep.
      {
        id: "coalition_seats",
        kind: "post",
        when: all(war, not(co)),
        keep: co,
        chapters: 4,
      },
      {
        id: "conscription_next",
        kind: "next",
        when: toCome("gbr_conscription"),
        keep: onAgenda("gbr_conscription"),
        chapters: 2,
      },
      own("gbr_unionists"),
      {
        id: "luxury_duties",
        kind: "promise",
        keep: war,
        chapters: 2,
        effects: [heat("gbr_liberals", 1), heat("gbr_rebels", 1)],
        terms: ["session", "half"],
      },
      // ww209: his votes now, a favour owed him later.
      { id: "owe_later", kind: "favour", when: war },
    ],
    amends: {
      gbr_conscription: "all_men",
      gbr_home_rule: "six_counties_out",
      gbr_dora: "courts_martial",
      gbr_franchise: "soldiers_only",
      gbr_rent: "rent_courts",
      gbr_wealth: "after_the_war",
      gbr_navy_estimates: "full_programme",
    },
    // ww209: in peace the opposition votes against a Liberal budget (1909,
    // 1914); at war it votes the credits.
    purse: [
      { when: war, bill: "credits", side: 1 },
      { when: not(war), bill: "budget", side: -1 },
    ],
    // ww209: Carson's men; in the Nigeria debate (8 Nov 1916) he led them
    // against Bonar Law's own bench.
    wing: {
      person: "gbr_carson",
      ideals: { union: -1, rule: -1 },
      share: 3,
      when: faction("gbr_uwc", { of: ["out"] }),
      into: "gbr_uwc",
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
      // Approximate (ww204 M): 150 members on paper (March 1916), seventy at
      // its meeting of 13 April 1916; the seventy who acted together.
      seats: { commons: 70 },
      scene: "gbr_f_uwc",
    },
  },
  {
    id: "gbr_uwc",
    tag: "GBR",
    bloc: "army",
    start: "out",
    strength: 1,
    // ww207: Carson's committee: the Union and conscription.
    ideals: { union: -1, rule: -1 },
    trust: -1,
    template: "crown_army",
    // ww203: about 70 Unionist members met in Carson's committee (April
    // 1916); its full roll is not checked.
    seats: { commons: 70 },
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
      // Carson in the government (Attorney General, May 1915).
      {
        id: "carson_in",
        kind: "post",
        when: not(flag("f_gbr_carson_in")),
        keep: flag("f_gbr_carson_in"),
        chapters: 4,
      },
      {
        id: "married_next",
        kind: "next",
        when: toCome("gbr_married_men"),
        keep: any(
          onAgenda("gbr_married_men"),
          isText("gbr_conscription", "all_men"),
        ),
        chapters: 2,
      },
      own("gbr_uwc"),
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
    // ww207: the unions' party, for Home Rule.
    ideals: { union: 1, class: 1 },
    ability: "gbr_pw_ab_labour",
    // ww203: Labour's 42 (Dec 1910).
    seats: { commons: 42 },
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
      // Henderson in the cabinet (May 1915): the post is the keep.
      {
        id: "labour_in",
        kind: "post",
        when: all(war, not(flag("f_gbr_labour_in"))),
        keep: flag("f_gbr_labour_in"),
        chapters: 4,
      },
      {
        id: "rent_next",
        kind: "next",
        when: toCome("gbr_rent"),
        keep: onAgenda("gbr_rent"),
        chapters: 2,
      },
      own("gbr_labour"),
      {
        id: "wealth_next",
        kind: "next",
        when: toCome("gbr_wealth"),
        keep: onAgenda("gbr_wealth"),
        chapters: 2,
      },
      {
        id: "pensions",
        kind: "money",
        when: war,
        effects: [gauge("money", -1)],
        earmark: "gbr_separation",
      },
    ],
    amends: {
      gbr_munitions: "tribunals",
      gbr_conscription: "conscience",
      gbr_food: "national_cards",
      gbr_franchise: "women_thirty",
      gbr_married_men: "with_tribunals",
      gbr_wealth: "capital_levy",
      gbr_navy_estimates: "fewer_keels",
    },
    // ww209: the party backed the first £100 m on 5 Aug 1914.
    purse: [{ when: war, bill: "credits", side: 1 }],
    // ww209: the ILP's members inside the party; MacDonald gave up the chair
    // over the credits (5 Aug 1914). They vote no openly; they aren't bought.
    wing: {
      person: "gbr_i_macdonald",
      ideals: { union: 1, class: 1, rule: 1 },
      share: 1,
      when: faction("gbr_ilp", { of: ["out"] }),
      peels: false,
      into: "gbr_ilp",
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
      seats: { commons: 6 },
      scene: "gbr_f_ilp",
    },
  },
  {
    id: "gbr_ilp",
    tag: "GBR",
    bloc: "workers",
    start: "out",
    strength: 1,
    // ww207: the opposite of the Unionist War Committee.
    ideals: { union: 1, class: 1, rule: 1 },
    trust: -1,
    template: "peace",
    // ww203: the six or so Labour members of the ILP who stood against the
    // war (MacDonald, Snowden, Jowett, Hardie...).
    seats: { commons: 6 },
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
        kind: "next",
        when: toCome("gbr_war_aims"),
        keep: onAgenda("gbr_war_aims"),
        chapters: 2,
      },
      own("gbr_ilp"),
      // Passports for Stockholm (summer 1917): the government lets them go.
      {
        id: "stockholm",
        kind: "promise",
        when: all(
          world({ is: "date", from: "1917-05" }),
          not(flag("f_gbr_stockholm_no")),
        ),
        keep: war,
        chapters: 2,
        terms: ["session"],
      },
    ],
    amends: { gbr_conscription: "conscience", gbr_war_aims: "negotiate_now" },
    // ww209: against the war's money.
    purse: [{ when: war, bill: "credits", side: -1 }],
  },
  {
    id: "gbr_irish",
    tag: "GBR",
    bloc: "parliament",
    start: "in",
    strength: 3,
    // ww207: Home Rule, and no compulsion for Ireland.
    ideals: { union: 1, rule: 1 },
    trust: 1,
    ability: "gbr_pw_ab_irish",
    // ww203: the Irish Party's 74 (Dec 1910). O'Brien's 8 and the
    // independents sit as no faction's and stay away.
    seats: { commons: 74 },
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
        kind: "next",
        when: all(not(flag("f_home_rule_lives")), toCome("gbr_home_rule")),
        keep: onAgenda("gbr_home_rule"),
        chapters: 2,
      },
      own("gbr_irish"),
      {
        id: "irish_money",
        kind: "money",
        when: war,
        effects: [
          gauge("money", -1),
          { kind: "pressure", topic: "ireland", delta: -1 },
        ],
        earmark: "gbr_irish_land",
      },
      // ww209: Irish votes now, a favour for Ireland later.
      { id: "owe_later", kind: "favour" },
    ],
    amends: {
      gbr_home_rule: "all_ireland",
      gbr_drink: "short_hours",
      gbr_conscription: "conscience",
    },
    // ww209: the spirit duties hit the distilleries (1909).
    purse: [{ taxes: { consumption: -1 } }],
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
    // ww207: Ireland apart, against conscription; the 1919 Democratic Programme.
    ideals: { union: 1, class: 1, rule: 1 },
    trust: -2,
    template: "nation",
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
    // ww207: the Union and the land; sore from the Parliament Act.
    ideals: { union: -1, class: -1 },
    trust: -2,
    template: "crown_army",
    // ww203: the Unionist peers, some 500 of about 620: approximate (ww204 M:
    // no party count of the 1914 Lords found).
    seats: { lords: 500 },
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
    wants: [
      // A seat in the cabinet for the Lords' leader (Lansdowne, May 1915).
      {
        id: "peers_in",
        kind: "post",
        when: all(war, not(co)),
        keep: co,
        chapters: 4,
      },
      own("gbr_peers"),
      {
        id: "debate_time",
        kind: "promise",
        keep: war,
        chapters: 2,
        terms: ["session", "half"],
      },
    ],
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
    // ww207: the Curragh officers' Union, and an army that runs the war.
    ideals: { union: -1, rule: -1 },
    template: "crown_army",
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
    // ww203: the ILP holds a free press and a jury as articles of faith.
    // ww204 (T): the Liberal benches waver on the regulations (Simon, the
    // jury, the press).
    creed: ["gbr_ilp"],
    stance: {
      gbr_liberals: 0,
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
    // ww204 (T): the Liberal benches waver on tying men to their works.
    sponsor: either(office("munitions"), office("finance")),
    stance: {
      gbr_liberals: 0,
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
    // ww204 (T): the Liberal benches took the Register for the first step to
    // conscription: they waver.
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
    // ww203: compulsion is what Simon resigned over, and the ILP's no.
    creed: ["gbr_rebels", "gbr_ilp"],
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
    constitution: true,
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
    constitution: true,
    // ww203: Ulster's men don't bargain over Home Rule.
    creed: ["gbr_uwc"],
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
    creed: ["gbr_rebels", "gbr_ilp"],
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
    // ww203: Carson's committee won't talk of aims short of victory.
    creed: ["gbr_uwc"],
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
  // ww203: the peace years' naval estimates come to the House too (the
  // 1914 estimates: Churchill's programme against Lloyd George's Treasury
  // and the Radical economists).
  {
    law: "gbr_navy_estimates",
    money: true,
    creed: ["gbr_ilp"],
    stance: {
      gbr_liberals: 0,
      gbr_rebels: -1,
      gbr_lg: 0,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: -1,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      full_programme: { gbr_liberals: 0, gbr_lg: -1 },
      holiday_clause: { gbr_liberals: 1, gbr_rebels: 0, gbr_lg: 1 },
      fewer_keels: {
        gbr_liberals: 0,
        gbr_rebels: 1,
        gbr_lg: 1,
        gbr_labour: 1,
        gbr_unionists: -1,
        gbr_uwc: -1,
        gbr_peers: -1,
        gbr_irish: 1,
      },
    },
  },
  // ---- ww207: the peace bills and the factions' exclusive laws ----
  // The 1914 Budget: the Liberals' own benches balked at the land rating.
  {
    law: "gbr_budget_1914",
    money: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
      gbr_peers: -1,
    },
    texts: {
      site_rating: { gbr_liberals: 0 },
      taxes_only: { gbr_labour: 0 },
    },
  },
  // The 1911 Act widened: the unions and the friendly societies both have a stake.
  {
    law: "gbr_insurance",
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
      widows: { gbr_unionists: -1, gbr_peers: -1 },
      societies: { gbr_labour: 0, gbr_unionists: 1 },
    },
  },
  // The land campaign: the landed interest against.
  {
    law: "gbr_land",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 1,
      gbr_peers: -1,
    },
    texts: {
      ministry_only: { gbr_labour: 0, gbr_unionists: 0 },
    },
  },
  // Disestablishment: the chapels for, the Church and the Unionists against.
  {
    law: "gbr_welsh_church",
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 1,
      gbr_peers: -1,
    },
    texts: {
      keep_endowments: { gbr_unionists: 0 },
    },
  },
  // Home Rule All Round: Scotland first.
  {
    law: "gbr_devolution",
    constitution: true,
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
      councils: { gbr_unionists: 0, gbr_peers: 0 },
    },
  },
  // The Amending Bill: each text turns a different side.
  {
    law: "gbr_ulster",
    constitution: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 1,
      gbr_lg: 1,
      gbr_unionists: 0,
      gbr_uwc: 0,
      gbr_labour: 1,
      gbr_ilp: 0,
      gbr_irish: 0,
      gbr_peers: 0,
    },
    texts: {
      nine_counties: {
        gbr_unionists: 1,
        gbr_uwc: 1,
        gbr_peers: 1,
        gbr_irish: -1,
        gbr_liberals: 0,
        gbr_labour: 0,
      },
      no_exclusion: {
        gbr_unionists: -1,
        gbr_uwc: -1,
        gbr_peers: -1,
        gbr_irish: 1,
      },
    },
  },
  // Lengthening this Parliament: only the ILP stands against.
  {
    law: "gbr_postpone",
    constitution: true,
    stance: {
      gbr_liberals: 1,
      gbr_rebels: 0,
      gbr_lg: 1,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: 1,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      till_peace: { gbr_liberals: 0, gbr_labour: 0, gbr_irish: -1 },
    },
  },
  // The Liberals' own: an elected second chamber.
  {
    law: "gbr_x_senate",
    creed: ["gbr_peers"],
    constitution: true,
    by: "gbr_liberals",
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
      fewer_peers: { gbr_unionists: 0, gbr_peers: 0, gbr_labour: 0 },
    },
  },
  // The Unionists' own: Tariff Reform, against the Liberals' free trade.
  {
    law: "gbr_x_tariff",
    creed: ["gbr_liberals"],
    money: true,
    by: "gbr_unionists",
    stance: {
      gbr_liberals: -1,
      gbr_rebels: -1,
      gbr_lg: 0,
      gbr_unionists: 1,
      gbr_uwc: 1,
      gbr_labour: -1,
      gbr_ilp: -1,
      gbr_irish: 0,
      gbr_peers: 1,
    },
    texts: {
      no_food_taxes: { gbr_labour: 0, gbr_lg: 1 },
    },
  },
  // Labour's own: the mines and the railways to the nation.
  {
    law: "gbr_x_mines",
    creed: ["gbr_peers"],
    by: "gbr_labour",
    stance: {
      gbr_liberals: -1,
      gbr_rebels: 0,
      gbr_lg: 0,
      gbr_unionists: -1,
      gbr_uwc: -1,
      gbr_labour: 1,
      gbr_ilp: 1,
      gbr_irish: 0,
      gbr_peers: -1,
    },
    texts: {
      state_control: { gbr_lg: 1, gbr_liberals: 0, gbr_unionists: 0 },
      miners_share: { gbr_lg: 0 },
    },
  },
  // The Irish Party's own: Ireland's purse in Dublin.
  {
    law: "gbr_x_irish_purse",
    by: "gbr_irish",
    stance: {
      gbr_liberals: 0,
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
      joint_board: { gbr_liberals: 1 },
      own_customs: { gbr_liberals: -1 },
    },
  },
];

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "GBR" });

/** The factions' own bills: rows like content/laws/gbr.ts, with no tells. */
export const GBR_HOUSE_LAWS: readonly GwLawRow[] = gbrAxes([
  // Carson's committee wants the married men too (the second Military Service
  // Act of May 1916, en.wikipedia Military Service Act 1916).
  row({
    id: "gbr_married_men",
    chapter: "conscription",
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
    chapter: "war_aims",
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
    chapter: "war_finance",
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
]);

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

// ---- S2: plots, the dossier, allies ----

const quiet = (when: GwCond, key: string, by = 1) => ({
  when,
  key,
  by,
  quiet: true,
});
const ALL_REGIMES = ["liberal", "coalition", "war_cabinet", "national"];
const sideshow = world({
  is: "main",
  of: ["straits", "balkan", "palestine", "mesopotamia", "italy"],
});

export const GBR_PLOTS: readonly GwPlotRow[] = [
  // Lloyd George, Bonar Law, Carson and Northcliffe's papers: the December
  // crisis of 1916 as a state, not a date. It ends on the fall track.
  {
    id: "gbr_pl_cabal",
    tag: "GBR",
    regimes: ALL_REGIMES,
    from: "1915-06",
    unless: "f_pm_lg",
    feeds: [
      quiet(temper("gbr_lg", 2), "lg_hot"),
      quiet(temper("gbr_uwc", 2), "uwc_hot"),
      quiet(world({ is: "gov", id: "gbr_table", min: 3 }), "table_shakes"),
      quiet(chose("gbr_h_committee", "refuse"), "committee_refused"),
      quiet(all(warAge(18), not(isLaw("gbr_conscription"))), "no_men"),
      quiet({ kind: "gauge", gauge: "morale", max: 1 }, "low_morale"),
    ],
    steps: [
      { at: 6, scene: "gbr_pl_cabal_1" },
      { at: 10, scene: "gbr_pl_cabal_2" },
    ],
    rest: 10,
    fatal: false,
    plot: {
      by: ["gbr_lg", "gbr_uwc", "gbr_unionists"],
      signs: [
        { at: 2, scene: "gbr_pl_cabal_s1", via: "paper" },
        { at: 4, scene: "gbr_pl_cabal_s2", via: "talk" },
        { at: 8, scene: "gbr_pl_cabal_s3", via: "report" },
      ],
      warn: "gbr_pl_cabal_w",
      end: "gbr_table",
    },
  },
  // The generals and their friends in Fleet Street against the government's
  // hold on the war. Britain's generals can't remove the seat: the fall track.
  {
    id: "gbr_pl_generals",
    tag: "GBR",
    regimes: ALL_REGIMES,
    from: "1915-09",
    feeds: [
      quiet(temper("gbr_generals", 2), "generals_hot"),
      quiet(temper("gbr_generals", 3), "generals_silent"),
      quiet({ kind: "inst", inst: "army", max: -2 }, "army_cold"),
      quiet(all(warAge(12), sideshow), "sideshow"),
    ],
    steps: [
      { at: 6, scene: "gbr_pl_gen_1" },
      { at: 10, scene: "gbr_pl_gen_2" },
    ],
    rest: 12,
    fatal: false,
    plot: {
      by: ["gbr_generals", "gbr_uwc"],
      signs: [
        { at: 2, scene: "gbr_pl_gen_s1", via: "paper" },
        { at: 4, scene: "gbr_pl_gen_s2", via: "talk" },
        { at: 8, scene: "gbr_pl_gen_s3", via: "report" },
      ],
      warn: "gbr_pl_gen_w",
      end: "gbr_table",
    },
  },
  // The shop stewards of the Clyde and the ILP's halls: the unrest ladder.
  {
    id: "gbr_pl_red",
    tag: "GBR",
    regimes: ALL_REGIMES,
    from: "1915-03",
    feeds: [
      quiet(temper("gbr_labour", 2), "labour_hot"),
      quiet(temper("gbr_ilp", 2), "ilp_hot"),
      quiet(low("bread", 0), "no_bread"),
      quiet(world({ is: "unrest", min: 2 }), "streets"),
      quiet(isText("gbr_munitions", "leaving_papers"), "leaving_papers"),
      quiet(
        world({
          is: "regime",
          tag: "RUS",
          of: ["provisional", "rep", "soviet"],
        }),
        "russia",
      ),
    ],
    steps: [
      { at: 5, scene: "gbr_pl_red_1" },
      { at: 9, scene: "gbr_pl_red_2" },
    ],
    rest: 10,
    fatal: false,
    plot: {
      by: ["gbr_ilp", "gbr_labour"],
      signs: [
        { at: 2, scene: "gbr_pl_red_s1", via: "paper" },
        { at: 3, scene: "gbr_pl_red_s2", via: "talk" },
        { at: 7, scene: "gbr_pl_red_s3", via: "report" },
      ],
      warn: "gbr_pl_red_w",
      end: "unrest",
    },
  },
];

/** Our people's possible weaknesses; the seed decides which are true. */
export const GBR_WEAK: readonly GwWeakRow[] = [
  {
    person: "gbr_churchill",
    weak: [
      { id: "debts", odds: 50 },
      { id: "letters", odds: 20 },
    ],
  },
  {
    person: "gbr_bonar_law",
    weak: [
      { id: "industry_money", odds: 25 },
      { id: "health", odds: 20 },
    ],
  },
  {
    person: "gbr_carson",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "health", odds: 35 },
    ],
  },
  {
    person: "gbr_kitchener",
    weak: [
      { id: "health", odds: 20 },
      { id: "letters", odds: 15 },
    ],
  },
  {
    person: "gbr_mckenna",
    weak: [
      { id: "industry_money", odds: 25 },
      { id: "debts", odds: 10 },
    ],
  },
  {
    person: "gbr_simon",
    weak: [
      { id: "industry_money", odds: 15 },
      { id: "letters", odds: 15 },
    ],
  },
  {
    person: "gbr_henderson",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "debts", odds: 10 },
    ],
  },
  {
    person: "gbr_redmond",
    weak: [
      { id: "foreign_ties", odds: 30 },
      { id: "health", odds: 30 },
    ],
  },
  {
    person: "gbr_robertson",
    weak: [
      { id: "letters", odds: 40 },
      { id: "old_scandal", odds: 10 },
    ],
  },
  {
    person: "gbr_haig",
    weak: [
      { id: "letters", odds: 35 },
      { id: "health", odds: 10 },
    ],
  },
  {
    person: "gbr_northcliffe",
    weak: [
      { id: "health", odds: 30 },
      { id: "letters", odds: 20 },
    ],
  },
  {
    person: "gbr_fisher",
    weak: [
      { id: "letters", odds: 45 },
      { id: "health", odds: 25 },
    ],
  },
];

const westMain = world({ is: "main", of: ["west"] });

export const GBR_ASKS: readonly GwAskRow[] = [
  {
    id: "gbr_ask_conscription",
    tag: "GBR",
    from: "FRA",
    kind: "law",
    law: "gbr_conscription",
    when: all(warAge(16), not(isLaw("gbr_conscription"))),
    scene: "gbr_ask_conscription",
    keep: isLaw("gbr_conscription"),
    chapters: 6,
  },
  {
    id: "gbr_conf_chantilly",
    tag: "GBR",
    from: "FRA",
    kind: "offensive",
    conference: true,
    when: all(warAge(15), not(westMain)),
    scene: "gbr_conf_chantilly",
    keep: westMain,
    chapters: 6,
  },
  {
    id: "gbr_ask_verdun",
    tag: "GBR",
    from: "FRA",
    kind: "offensive",
    when: all(
      warAge(19),
      not(westMain),
      not(askAt("gbr_conf_chantilly", "yes", "kept")),
    ),
    scene: "gbr_ask_verdun",
    keep: westMain,
    chapters: 3,
  },
  {
    id: "gbr_ask_salonika",
    tag: "GBR",
    from: "FRA",
    kind: "front",
    when: all(
      war,
      world({ is: "entered", tag: "BGR" }),
      not(flag("f_salonika_held")),
    ),
    scene: "gbr_ask_salonika",
    keep: any(
      flag("f_salonika_held"),
      world({ is: "force", tag: "GBR", theatre: "balkan", min: 1 }),
    ),
    chapters: 4,
  },
  {
    id: "gbr_ask_rus_credit",
    tag: "GBR",
    from: "RUS",
    kind: "loan",
    when: all(warAge(10), world({ is: "regime", tag: "RUS", of: ["tsar"] })),
    scene: "gbr_ask_rus_credit",
    keep: war,
    chapters: 2,
    kept: [gauge("money", -1)],
  },
];

// Plot scenes.
const audience = (
  id: string,
  cast: GwScene["cast"],
  options: GwOption[],
  variants: GwVariant[] = [v("base")],
): GwScene => ({
  id,
  nation: NATION,
  kind: "audience",
  scheduledOnly: true,
  cast,
  salience: 8,
  tags: ["home", "tension_up"],
  variants,
  fallback: options[options.length - 1].id,
  options,
});
const A = (
  id: string,
  cast: GwScene["cast"],
  opts: [string, GwEffect[], GwCond?][],
  vs?: GwVariant[],
) =>
  audience(
    id,
    cast,
    opts.map(([k, e, w]) => ({ ...o(k, id, e), ...(w ? { when: w } : {}) })),
    vs,
  );
const paperSign = (id: string): GwScene => ({
  id,
  nation: NATION,
  kind: "wire",
  scheduledOnly: true,
  cast: {},
  salience: 5,
  tags: ["home"],
  variants: [v("base")],
});
const reportSign = (id: string): GwScene => ({
  ...paperSign(id),
  kind: "report",
  stamp: "unconfirmed",
  source: "police",
});
const talkSign = (id: string, who: GwScene["cast"][string]): GwScene => ({
  id,
  nation: NATION,
  kind: "talk",
  scheduledOnly: true,
  cast: { who },
  who: "who",
  salience: 6,
  tags: ["people", "home"],
  variants: [v("base")],
  start: "open",
  nodes: {
    open: {
      says: [v("base")],
      replies: [
        {
          id: "ask",
          stance: "frank",
          kind: "ask",
          tell: [],
          effects: [],
          next: "more",
        },
        {
          id: "leave",
          stance: "warm",
          kind: "leave",
          tell: [],
          effects: [],
          next: null,
        },
      ],
    },
    more: {
      says: [v("base")],
      replies: [
        {
          id: "end",
          stance: "warm",
          kind: "leave",
          tell: [],
          effects: [],
          next: null,
        },
      ],
    },
  },
});
const warning = (id: string): GwScene => ({
  ...paperSign(id),
  salience: 8,
  tags: ["home", "tension_up"],
});
const lgCast = either(person("gbr_lloyd_george"), leaderOf("gbr_lg"));
const lawCast = either(person("gbr_bonar_law"), leaderOf("gbr_unionists"));
const head = role("head");
const letter = (
  id: string,
  from: GwScene["cast"][string],
  ask: string,
): GwScene => ({
  id,
  nation: NATION,
  kind: "letter",
  who: "head",
  scheduledOnly: true,
  cast: { head: from },
  salience: 7,
  tags: ["foreign"],
  variants: [v("base")],
  fallback: "decline",
  options: [
    {
      id: "yes",
      tell: [],
      effects: [
        answerAsk(ask, true),
        { kind: "letter", who: head, tone: "warm" },
      ],
    },
    {
      id: "decline",
      tell: [],
      effects: [
        answerAsk(ask, false),
        { kind: "letter", who: head, tone: "cold" },
      ],
    },
  ],
});

/** Plot signs, warnings, steps and ends; dossier scenes; asks; conferences. */
export const GBR_PLOT_SCENES: readonly GwScene[] = [
  // The cabal.
  paperSign("gbr_pl_cabal_s1"),
  talkSign("gbr_pl_cabal_s2", person("gbr_hankey")),
  reportSign("gbr_pl_cabal_s3"),
  warning("gbr_pl_cabal_w"),
  A("gbr_pl_cabal_1", { lg: lgCast }, [
    [
      "war_committee",
      [coolPlot("gbr_pl_cabal", 4), cool("gbr_lg", 2), inst("cabinet", -1)],
    ],
    ["war_office", [coolPlot("gbr_pl_cabal", 3), heat("gbr_lg", 1)]],
    [
      "go_public",
      [beatPlot("gbr_pl_cabal"), heat("gbr_lg", 2), heat("gbr_uwc", 1)],
      plotConfirmed("gbr_pl_cabal"),
    ],
    ["wait", []],
  ]),
  A("gbr_pl_cabal_2", { lg: lgCast, law: lawCast }, [
    [
      "give_way",
      [
        beatPlot("gbr_pl_cabal"),
        cool("gbr_lg", 2),
        cool("gbr_uwc", 2),
        inst("cabinet", -2),
      ],
    ],
    [
      "fight",
      [
        beatPlot("gbr_pl_cabal"),
        heat("gbr_lg", 3),
        heat("gbr_unionists", 2),
        inst("commons", -1),
        heatPlot("gbr_pl_generals", 3),
      ],
    ],
    ["wait", []],
  ]),
  // The generals and the papers.
  paperSign("gbr_pl_gen_s1"),
  talkSign("gbr_pl_gen_s2", either(person("gbr_wilson"), person("gbr_french"))),
  reportSign("gbr_pl_gen_s3"),
  warning("gbr_pl_gen_w"),
  A("gbr_pl_gen_1", { cos: leaderOf("gbr_generals") }, [
    [
      "give_men",
      [coolPlot("gbr_pl_generals", 3), cool("gbr_generals", 2), men(-3)],
    ],
    ["post_away", [coolPlot("gbr_pl_generals", 4), heat("gbr_generals", 1)]],
    [
      "go_public",
      [
        beatPlot("gbr_pl_generals"),
        { kind: "opinion", bloc: "press", delta: -1 },
        heat("gbr_generals", 1),
      ],
      plotConfirmed("gbr_pl_generals"),
    ],
    ["wait", []],
  ]),
  A("gbr_pl_gen_2", { cos: leaderOf("gbr_generals") }, [
    [
      "his_way",
      [
        coolPlot("gbr_pl_generals", 5),
        cool("gbr_generals", 2),
        inst("cabinet", -2),
      ],
    ],
    [
      "replace_him",
      [
        beatPlot("gbr_pl_generals"),
        heat("gbr_generals", 2),
        heat("gbr_uwc", 1),
        heatPlot("gbr_pl_cabal", 3),
      ],
    ],
    ["wait", []],
  ]),
  // The shop stewards.
  paperSign("gbr_pl_red_s1"),
  talkSign("gbr_pl_red_s2", person("gbr_henderson")),
  reportSign("gbr_pl_red_s3"),
  warning("gbr_pl_red_w"),
  A("gbr_pl_red_1", { home: office("interior") }, [
    [
      "meet_stewards",
      [coolPlot("gbr_pl_red", 3), gauge("money", -1), cool("gbr_labour", 1)],
    ],
    [
      "arrest",
      [
        beatPlot("gbr_pl_red"),
        heat("gbr_ilp", 2),
        heat("gbr_labour", 1),
        {
          kind: "maybe",
          when: plotHot("gbr_pl_red", 0, 0),
          then: [heat("gbr_labour", 2), trustOf(role("home"), -1)],
        },
      ],
    ],
    ["wait", []],
  ]),
  A("gbr_pl_red_2", { home: office("interior") }, [
    [
      "concede",
      [coolPlot("gbr_pl_red", 5), cool("gbr_labour", 2), gauge("money", -1)],
    ],
    [
      "arrest",
      [
        beatPlot("gbr_pl_red"),
        heat("gbr_ilp", 2),
        heat("gbr_labour", 2),
        gauge("order", -1),
      ],
    ],
    ["wait", []],
  ]),
  // Allies' asks.
  letter("gbr_ask_conscription", { ruler_of: "FRA" }, "gbr_ask_conscription"),
  letter("gbr_ask_verdun", { ruler_of: "FRA" }, "gbr_ask_verdun"),
  letter("gbr_ask_salonika", { ruler_of: "FRA" }, "gbr_ask_salonika"),
  letter("gbr_ask_rus_credit", { ruler_of: "RUS" }, "gbr_ask_rus_credit"),
  // Chantilly: the allies' generals at Joffre's headquarters, face to face.
  {
    id: "gbr_conf_chantilly",
    nation: NATION,
    kind: "talk",
    big: true,
    once: true,
    scheduledOnly: true,
    salience: 8,
    tags: ["foreign", "war"],
    cast: { head: { ruler_of: "FRA" }, cos: office("chief_of_staff") },
    who: "head",
    variants: [v("base")],
    start: "n1",
    nodes: {
      n1: {
        says: [v("base")],
        replies: [
          {
            id: "ask",
            stance: "frank",
            kind: "ask",
            tell: [],
            effects: [],
            next: "n2",
          },
        ],
      },
      n2: {
        who: "cos",
        says: [v("base")],
        replies: [
          {
            id: "go_on",
            stance: "warm",
            kind: "ask",
            tell: [],
            effects: [],
            next: "n3",
          },
        ],
      },
      n3: {
        fallback: "own_time",
        says: [v("base")],
        replies: [
          decide("together", null, [answerAsk("gbr_conf_chantilly", true)]),
          decide("own_time", null, [answerAsk("gbr_conf_chantilly", false)]),
        ],
      },
    },
  },
];
