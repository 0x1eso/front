import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
import {
  all,
  any,
  byName,
  flag,
  keepPromise,
  not,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  gauge,
  held,
  inst,
  isText,
  lawTalk,
  low,
  men,
  person,
  since,
  war,
} from "./kit";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "GBR" });
const home = { home: held("interior") };
const treasury = { fin: held("finance") };
/** ww207: no war: the crisis weeks, the peace years, after the armistice. */
const peace = not(war);
/** ww190: the peace years' bill tilts the running plan's navy share. */
const navyShare = (delta: number) =>
  doWorld({ do: "arms", line: "navy", delta });

/**
 * ww207: what each bill text pushes, by law and text (notches; one a
 * bill). GBR's axes: union (연합 - / 자치 +), class (재산 - / 노동 +), rule
 * (통제 - / 자유 +). A text with no row here moves nothing.
 */
export const GBR_AXIS_PUSHES: Readonly<
  Record<string, Readonly<Record<string, GwAxisPush>>>
> = {
  gbr_dora: { press_bureau: { rule: -1 }, courts_martial: { rule: -1 } },
  gbr_drink: {
    short_hours: { rule: -1 },
    control_board: { rule: -1, class: 1 },
    kings_pledge: { rule: -1 },
  },
  gbr_munitions: {
    treasury_terms: { rule: -1 },
    leaving_papers: { rule: -1, class: -1 },
    tribunals: { rule: -1 },
  },
  gbr_register: {
    plain_census: { rule: -1 },
    with_trades: { rule: -1 },
    canvass: { rule: -1 },
  },
  gbr_rent: {
    freeze_all: { class: 1 },
    munitions_towns: { class: 1 },
    rent_courts: { rule: -1 },
  },
  gbr_conscription: {
    single_men: { rule: -1 },
    all_men: { rule: -1, union: -1 },
    conscience: { rule: -1 },
  },
  gbr_food: {
    sugar_first: { rule: -1 },
    national_cards: { rule: -1, class: 1 },
    price_only: { rule: -1 },
  },
  gbr_franchise: {
    soldiers_only: { rule: 1 },
    women_thirty: { rule: 1 },
    women_equal: { rule: 1, class: 1 },
  },
  gbr_home_rule: {
    six_counties_out: { union: 1 },
    convention: { union: 1 },
    all_ireland: { union: 1 },
  },
  gbr_navy_estimates: {
    full_programme: { union: -1 },
    holiday_clause: { rule: 1 },
    fewer_keels: { class: 1 },
  },
  gbr_married_men: {
    all_married: { rule: -1 },
    with_tribunals: { rule: -1 },
    older_too: { rule: -1 },
  },
  gbr_war_aims: {
    plain_aims: { union: -1 },
    no_annexation: { rule: 1 },
    negotiate_now: { rule: 1 },
  },
  gbr_wealth: {
    profits_duty: { class: 1 },
    capital_levy: { class: 1 },
    after_the_war: { class: 1 },
  },
  gbr_budget_1914: {
    supertax: { class: 1 },
    site_rating: { class: 1 },
    taxes_only: { rule: 1 },
  },
  gbr_insurance: {
    more_trades: { class: 1 },
    widows: { class: 1 },
    societies: { rule: 1 },
  },
  gbr_land: {
    wage_boards: { class: 1 },
    land_courts: { class: 1 },
    ministry_only: { rule: -1 },
  },
  gbr_welsh_church: {
    disendow: { union: 1 },
    keep_endowments: { union: 1 },
    tithes_to_councils: { union: 1 },
  },
  gbr_devolution: {
    scotland: { union: 1 },
    all_round: { union: 1 },
    councils: { rule: 1 },
  },
  gbr_ulster: {
    county_option: { union: 1 },
    nine_counties: { union: -1 },
    no_exclusion: { union: 1 },
  },
  gbr_postpone: {
    eight_months: { rule: -1 },
    year_by_year: { rule: -1 },
    till_peace: { rule: -1 },
  },
  gbr_x_senate: {
    elected_senate: { rule: 1 },
    bryce_plan: { rule: 1 },
    fewer_peers: { rule: 1 },
  },
  gbr_x_tariff: {
    imperial_preference: { union: -1 },
    full_tariff: { union: -1 },
    no_food_taxes: { union: -1 },
  },
  gbr_x_mines: {
    mines_railways: { class: 1 },
    miners_share: { class: 1 },
    state_control: { rule: -1 },
  },
  gbr_x_irish_purse: {
    own_taxes: { union: 1 },
    own_customs: { union: 1 },
    joint_board: { union: 1 },
  },
};

/** Lays GBR_AXIS_PUSHES on the rows' texts. */
export function gbrAxes(rows: readonly GwLawRow[]): readonly GwLawRow[] {
  return rows.map((r) => {
    const by = GBR_AXIS_PUSHES[r.id];
    if (by === undefined) return r;
    return {
      ...r,
      draft: r.draft.map((d) =>
        by[d.id] === undefined ? d : { ...d, axes: by[d.id] },
      ),
    };
  });
}

/**
 * Britain's bills. The door is the Commons, the cabinet behind it; a regulation
 * under the Defence of the Realm Act reaches only what `decree` says it can.
 */
export const GBR_LAWS: readonly GwLawRow[] = gbrAxes([
  row({
    id: "gbr_dora",
    chapter: "censorship",
    opens: war,
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("press_bureau", 0, ["morale:+1"], [gauge("morale", 1)]),
      draft(
        "courts_martial",
        1,
        ["army:+1", "commons:-1"],
        [inst("commons", -1)],
      ),
      draft("civil_trial", -1, ["commons:+1"], [inst("commons", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1", "censor:+1"],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "morale", delta: -1, every: 14, offset: 3 },
    ],
    flag: "f_law_censor",
    censor: 1,
    repeal: {
      authority: 10,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("gbr_dora", {
      who: person("gbr_simon"),
      ask: "frank",
      push: "cold",
      tell: ["commons:+1"],
      price: [inst("commons", 1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
  row({
    id: "gbr_drink",
    chapter: "food",
    opens: { kind: "all", of: [war, since("1915-03")] },
    lean: 0,
    decree: true,
    cast: treasury,
    draft: [
      draft("short_hours", 1, []),
      draft(
        "control_board",
        0,
        ["shells:+1", "money:-1"],
        [gauge("shells", 1), gauge("money", -1)],
      ),
      draft(
        "kings_pledge",
        -2,
        ["shells:+1", "morale:-1"],
        [gauge("shells", 1), gauge("morale", -1)],
      ),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "shells", delta: 1, every: 9 },
      { gauge: "morale", delta: -1, every: 12, offset: 5 },
    ],
    repeal: {
      authority: 5,
      tell: ["morale:+1", "shells:-1"],
      effects: [gauge("morale", 1), gauge("shells", -1)],
    },
    talk: lawTalk("gbr_drink", {
      who: person("gbr_redmond"),
      ask: "warm",
      push: "flatter",
      tell: ["irish:-1"],
      price: [inst("irish", -1)],
      wins: 2,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "gbr_munitions",
    chapter: "labour",
    opens: { kind: "all", of: [war, since("1915-04")] },
    lean: 0,
    decree: false,
    cast: treasury,
    draft: [
      draft("treasury_terms", 1, ["money:-1"], [gauge("money", -1)]),
      draft(
        "leaving_papers",
        -1,
        ["shells:+1", "order:-1"],
        [gauge("shells", 1), gauge("order", -1)],
      ),
      draft("tribunals", 0, ["commons:+1"], [inst("commons", 1)]),
    ],
    passed: [gauge("shells", 1)],
    passedTell: ["shells:+1"],
    term: [
      { gauge: "shells", delta: 1, every: 6 },
      { gauge: "order", delta: -1, every: 9, offset: 2 },
    ],
    flag: "f_law_strike_ban",
    repeal: {
      authority: 15,
      tell: ["order:+1", "shells:-1"],
      effects: [gauge("order", 1), gauge("shells", -1)],
    },
    talk: lawTalk("gbr_munitions", {
      who: person("gbr_henderson"),
      ask: "frank",
      push: "cold",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 2,
    }),
    after: {
      chapters: 7,
      options: [
        {
          id: "hold_firm",
          tell: ["shells:+1", "order:-1"],
          effects: [gauge("shells", 1), gauge("order", -1)],
        },
        {
          id: "hear_them",
          tell: ["order:+1", "shells:-1"],
          effects: [gauge("order", 1), gauge("shells", -1)],
        },
        {
          id: "send_stewards_off",
          tell: ["order:-1", "commons:-1"],
          effects: [gauge("order", -1), inst("commons", -1)],
        },
      ],
    },
  }),
  row({
    id: "gbr_register",
    chapter: "conscription",
    opens: { kind: "all", of: [war, since("1915-05")] },
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("plain_census", 1, []),
      draft("with_trades", 0, ["shells:+1"], [gauge("shells", 1)]),
      draft(
        "canvass",
        -1,
        ["manpower:+3", "cabinet:-1"],
        [men(3), inst("cabinet", -1)],
      ),
    ],
    passed: [men(3)],
    passedTell: ["manpower:+3"],
    term: [{ gauge: "manpower", delta: 1, every: 6 }],
    repeal: { authority: 5, tell: ["manpower:-3"], effects: [men(-3)] },
    talk: lawTalk("gbr_register", {
      who: person("gbr_kitchener"),
      ask: "cold",
      push: "threat",
      tell: ["opposition:+1"],
      price: [inst("opposition", 1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "gbr_rent",
    chapter: "food",
    opens: {
      kind: "any",
      of: [
        { kind: "all", of: [war, since("1915-09")] },
        { kind: "all", of: [war, low("order", 2)] },
      ],
    },
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("freeze_all", 0, ["opposition:-1"], [inst("opposition", -1)]),
      draft("munitions_towns", 1, []),
      draft("rent_courts", -1, ["order:+1"], [gauge("order", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1"],
    term: [
      { gauge: "order", delta: 1, every: 8 },
      { gauge: "money", delta: -1, every: 14, offset: 6 },
    ],
    repeal: {
      authority: 20,
      tell: ["order:-2"],
      effects: [gauge("order", -2)],
    },
    talk: lawTalk("gbr_rent", {
      who: person("gbr_bonar_law"),
      ask: "frank",
      push: "flatter",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_conscription",
    chapter: "conscription",
    opens: {
      kind: "all",
      of: [war, since("1915-08"), world({ is: "manpower", max: 75 })],
    },
    lean: -1,
    decree: false,
    issue: "conscription",
    cast: { sec: held("war"), home: held("interior") },
    draft: [
      draft("single_men", 1, []),
      draft(
        "all_men",
        -1,
        ["manpower:+8", "order:-1"],
        [men(8), gauge("order", -1)],
      ),
      draft("conscience", 2, ["manpower:-3"], [men(-3)]),
    ],
    passed: [men(10), gauge("order", -1)],
    passedTell: ["manpower:+10", "order:-1"],
    term: [
      { gauge: "manpower", delta: 1, every: 3 },
      { gauge: "order", delta: -1, every: 11, offset: 4 },
    ],
    flag: "f_gbr_conscript",
    settled: flag("f_gbr_conscript"),
    replaces: ["gbr_h_conscription", "gw_gbr_conscription"],
    repeal: {
      authority: 25,
      tell: ["manpower:-10", "order:+1"],
      effects: [men(-10), gauge("order", 1)],
    },
    talk: lawTalk("gbr_conscription", {
      who: person("gbr_simon"),
      ask: "frank",
      push: "threat",
      tell: ["cabinet:-1"],
      price: [inst("cabinet", -1)],
      wins: 2,
      tempers: ["stubborn", "anxious"],
    }),
    after: {
      chapters: 6,
      options: [
        {
          id: "tribunals_stand",
          tell: ["manpower:+3", "commons:-1"],
          effects: [men(3), inst("commons", -1)],
        },
        {
          id: "alternative_work",
          tell: ["order:+1", "manpower:-2"],
          effects: [gauge("order", 1), men(-2)],
        },
      ],
    },
  }),
  row({
    id: "gbr_food",
    chapter: "food",
    opens: { kind: "all", of: [war, since("1916-12"), low("bread", 2)] },
    lean: 1,
    decree: true,
    cast: home,
    draft: [
      draft("sugar_first", 1, []),
      draft(
        "national_cards",
        0,
        ["bread:+1", "money:-1"],
        [gauge("bread", 1), gauge("money", -1)],
      ),
      draft(
        "price_only",
        1,
        ["order:+1", "bread:-1"],
        [gauge("order", 1), gauge("bread", -1)],
      ),
    ],
    passed: [gauge("bread", 1)],
    passedTell: ["bread:+1"],
    term: [
      { gauge: "bread", delta: 1, every: 5 },
      { gauge: "morale", delta: -1, every: 13, offset: 2 },
    ],
    flag: "f_gbr_rationing",
    settled: flag("f_gbr_rationing"),
    replaces: ["gbr_h_food"],
    repeal: {
      authority: 10,
      tell: ["bread:-1", "morale:+1"],
      effects: [gauge("bread", -1), gauge("morale", 1)],
    },
    talk: lawTalk("gbr_food", {
      who: person("gbr_milner"),
      ask: "cold",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_franchise",
    chapter: "franchise",
    opens: { kind: "all", of: [war, since("1916-09")] },
    lean: 0,
    decree: false,
    cast: home,
    draft: [
      draft("soldiers_only", 1, ["morale:+1"], [gauge("morale", 1)]),
      draft("women_thirty", 0, ["order:+1"], [gauge("order", 1)]),
      draft(
        "women_equal",
        -2,
        ["order:+1", "opposition:-1"],
        [gauge("order", 1), inst("opposition", -1)],
      ),
    ],
    passed: [
      gauge("morale", 1),
      {
        kind: "maybe",
        when: isText("gbr_franchise", "soldiers_only"),
        then: [setFlag("f_gbr_soldiers_vote")],
      },
      {
        kind: "maybe",
        when: isText("gbr_franchise", "women_thirty"),
        then: [
          setFlag("f_gbr_women_thirty"),
          keepPromise(byName("gbr_henderson"), "p_hen_franchise"),
        ],
      },
      {
        kind: "maybe",
        when: isText("gbr_franchise", "women_equal"),
        then: [
          setFlag("f_gbr_women_equal"),
          keepPromise(byName("gbr_henderson"), "p_hen_franchise"),
        ],
      },
    ],
    passedTell: ["morale:+1"],
    term: [],
    settled: any(
      flag("f_gbr_soldiers_vote"),
      flag("f_gbr_women_thirty"),
      flag("f_gbr_women_equal"),
    ),
    replaces: ["gbr_h_franchise"],
    repeal: {
      authority: 40,
      tell: ["order:-2", "commons:-2"],
      effects: [gauge("order", -2), inst("commons", -2)],
    },
    talk: lawTalk("gbr_franchise", {
      who: person("gbr_bonar_law"),
      ask: "warm",
      push: "cold",
      tell: ["opposition:+1", "cabinet:-1"],
      price: [inst("opposition", 1), inst("cabinet", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "gbr_home_rule",
    chapter: "nations",
    opens: {
      kind: "all",
      of: [war, since("1916-05"), not(flag("f_home_rule_lives"))],
    },
    lean: -1,
    decree: false,
    issue: "home_rule",
    cast: { ireland: held("ireland") },
    draft: [
      draft("six_counties_out", 1, ["irish:-1"], [inst("irish", -1)]),
      draft("convention", 0, ["cabinet:+1"], [inst("cabinet", 1)]),
      draft(
        "all_ireland",
        -2,
        ["irish:+2", "opposition:-2"],
        [inst("irish", 2), inst("opposition", -2)],
      ),
    ],
    passed: [
      inst("irish", 2),
      inst("opposition", -1),
      setFlag("f_home_rule_lives"),
      { kind: "pressure", topic: "ireland", delta: -2 },
    ],
    passedTell: ["irish:+2", "opposition:-1"],
    term: [{ gauge: "order", delta: 1, every: 11 }],
    settled: flag("f_home_rule_lives"),
    replaces: ["gbr_h_ireland_talks"],
    repeal: {
      authority: 30,
      tell: ["irish:-3", "order:-1"],
      effects: [
        inst("irish", -3),
        gauge("order", -1),
        { kind: "unflag", flag: "f_home_rule_lives" },
      ],
    },
    talk: lawTalk("gbr_home_rule", {
      who: person("gbr_carson"),
      ask: "frank",
      push: "threat",
      tell: ["opposition:+1", "irish:-1"],
      price: [inst("opposition", 1), inst("irish", -1)],
      wins: 2,
      tempers: ["stubborn"],
    }),
  }),
  // ww190 §1: the peace bill. The naval estimates go to the Commons in a
  // year with no war; the drafts carry the navy's share and how it is paid.
  row({
    id: "gbr_navy_estimates",
    chapter: "arms",
    opens: {
      kind: "all",
      of: [not(war), world({ is: "peace_months", min: 1 })],
    },
    lean: 0,
    decree: false,
    cast: { first: held("navy") },
    draft: [
      draft(
        "full_programme",
        0,
        ["navy_line:+5", "money:-1"],
        [
          navyShare(5),
          doWorld({ do: "budget_mix", source: "taxes", delta: 5 }),
        ],
      ),
      draft(
        "holiday_clause",
        1,
        ["navy_line:+5"],
        [navyShare(5), doWorld({ do: "accord", kind: "naval", tag: "DEU" })],
      ),
      draft(
        "fewer_keels",
        -1,
        ["navy_line:-5", "money:+1"],
        [navyShare(-5), gauge("money", 1)],
      ),
    ],
    passed: [],
    passedTell: [],
    term: [],
    replaces: ["gbr_y_arms_bill"],
    repeal: {
      authority: 10,
      tell: ["navy_line:-5"],
      effects: [navyShare(-5)],
    },
    talk: lawTalk("gbr_navy_estimates", {
      who: person("gbr_lloyd_george"),
      ask: "frank",
      push: "cold",
      tell: ["cabinet:-1"],
      price: [inst("cabinet", -1)],
      wins: 2,
    }),
  }),
  // ---- ww207: the peace years' bills (rows `peace: true`) ----
  // Checked on the web (W-GBR, 2026-11-13): the 1914 Budget's land value
  // rating and new grants to the councils, dropped in June 1914 under the
  // Liberals' own revolt (Albion, "Battered and Shattered"); Lloyd George's
  // land campaign opened at Bedford on 11 Oct 1913; the Government of
  // Scotland Bill read a second time on 30 May 1913 by 204 to 159 and brought
  // back on 15 May 1914; the Amending Bill brought into the Lords on 23 June
  // 1914 and sent back with all nine counties out on 8 July, the Buckingham
  // Palace Conference of 21-24 July 1914 ending with no agreement; the
  // Parliament and Registration Act of January 1916 lengthening the
  // Parliament by eight months. From memory (F): the county option with a
  // six-year exclusion (March 1914); the Welsh Church Act's assent on 18 Sep
  // 1914, suspended for the war; the farm labourers' minimum wage and the
  // land courts in the land campaign; the 1911 Act's insurance trades.
  row({
    id: "gbr_budget_1914",
    chapter: "tax",
    peace: true,
    opens: peace,
    lean: 0,
    decree: false,
    cast: treasury,
    draft: [
      draft(
        "supertax",
        0,
        ["money:+1", "opposition:-1"],
        [gauge("money", 1), inst("opposition", -1)],
      ),
      draft(
        "site_rating",
        -1,
        ["money:+1", "commons:-1"],
        [gauge("money", 1), inst("commons", -1)],
      ),
      draft("taxes_only", 1, ["cabinet:-1"], [inst("cabinet", -1)]),
    ],
    passed: [gauge("money", 1)],
    passedTell: ["money:+1"],
    term: [{ gauge: "money", delta: 1, every: 10 }],
    repeal: {
      authority: 10,
      tell: ["money:-1"],
      effects: [gauge("money", -1)],
    },
    talk: lawTalk("gbr_budget_1914", {
      who: person("gbr_bonar_law"),
      ask: "frank",
      push: "cold",
      tell: ["opposition:+1"],
      price: [inst("opposition", 1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
  row({
    id: "gbr_insurance",
    chapter: "social",
    peace: true,
    opens: peace,
    lean: 0,
    decree: false,
    cast: treasury,
    draft: [
      draft("more_trades", 1, ["order:+1"], [gauge("order", 1)]),
      draft(
        "widows",
        -1,
        ["order:+1", "money:-1"],
        [gauge("order", 1), gauge("money", -1)],
      ),
      draft("societies", 1, []),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1"],
    term: [
      { gauge: "order", delta: 1, every: 12 },
      { gauge: "money", delta: -1, every: 12, offset: 6 },
    ],
    repeal: {
      authority: 15,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("gbr_insurance", {
      who: person("gbr_henderson"),
      ask: "warm",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_land",
    chapter: "land",
    peace: true,
    opens: peace,
    lean: -1,
    decree: false,
    cast: treasury,
    draft: [
      draft(
        "wage_boards",
        0,
        ["morale:+1", "opposition:-1"],
        [gauge("morale", 1), inst("opposition", -1)],
      ),
      draft(
        "land_courts",
        -1,
        ["bread:+1", "opposition:-1"],
        [gauge("bread", 1), inst("opposition", -1)],
      ),
      draft("ministry_only", 1, []),
    ],
    passed: [gauge("morale", 1)],
    passedTell: ["morale:+1"],
    term: [{ gauge: "bread", delta: 1, every: 14 }],
    repeal: {
      authority: 15,
      tell: ["morale:-1"],
      effects: [gauge("morale", -1)],
    },
    talk: lawTalk("gbr_land", {
      who: person("gbr_derby"),
      ask: "cold",
      push: "frank",
      tell: ["opposition:+1"],
      price: [inst("opposition", 1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "gbr_welsh_church",
    chapter: "schools",
    peace: true,
    opens: all(peace, not(flag("f_gbr_welsh_church"))),
    lean: 0,
    decree: false,
    cast: home,
    draft: [
      draft("disendow", -1, ["opposition:-1"], [inst("opposition", -1)]),
      draft("keep_endowments", 1, []),
      draft("tithes_to_councils", 0, ["money:+1"], [gauge("money", 1)]),
    ],
    passed: [inst("opposition", -1)],
    passedTell: ["opposition:-1"],
    term: [],
    flag: "f_gbr_welsh_church",
    settled: flag("f_gbr_welsh_church"),
    repeal: {
      authority: 20,
      tell: ["commons:-1"],
      effects: [inst("commons", -1)],
    },
    talk: lawTalk("gbr_welsh_church", {
      who: person("gbr_balfour"),
      ask: "warm",
      push: "cold",
      tell: ["opposition:+1"],
      price: [inst("opposition", 1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_devolution",
    chapter: "local",
    peace: true,
    opens: peace,
    lean: -1,
    decree: false,
    cast: home,
    draft: [
      draft("scotland", 0, ["commons:+1"], [inst("commons", 1)]),
      draft(
        "all_round",
        -1,
        ["irish:+1", "opposition:-1"],
        [inst("irish", 1), inst("opposition", -1)],
      ),
      draft("councils", 1, ["order:+1"], [gauge("order", 1)]),
    ],
    passed: [inst("commons", 1)],
    passedTell: ["commons:+1"],
    term: [{ gauge: "order", delta: 1, every: 14 }],
    repeal: {
      authority: 20,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("gbr_devolution", {
      who: person("gbr_churchill"),
      ask: "warm",
      push: "flatter",
      tell: ["cabinet:+1"],
      price: [inst("cabinet", 1)],
      wins: 1,
    }),
  }),
  // The Amending Bill: how Ulster stands outside the Home Rule Act.
  row({
    id: "gbr_ulster",
    chapter: "nations",
    peace: true,
    opens: all(
      peace,
      not(flag("f_home_rule_lives")),
      not(flag("f_gbr_ulster_settled")),
    ),
    lean: -1,
    decree: false,
    issue: "home_rule",
    cast: { ireland: held("ireland") },
    draft: [
      draft(
        "county_option",
        0,
        ["irish:-1", "opposition:+1"],
        [inst("irish", -1), inst("opposition", 1)],
      ),
      draft(
        "nine_counties",
        1,
        ["irish:-2", "opposition:+2"],
        [inst("irish", -2), inst("opposition", 2)],
      ),
      draft(
        "no_exclusion",
        -2,
        ["irish:+1", "opposition:-2"],
        [inst("irish", 1), inst("opposition", -2)],
      ),
    ],
    passed: [{ kind: "pressure", topic: "ireland", delta: -1 }],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12 }],
    flag: "f_gbr_ulster_settled",
    settled: any(flag("f_gbr_ulster_settled"), flag("f_home_rule_lives")),
    repeal: {
      authority: 25,
      tell: ["order:-1"],
      effects: [
        gauge("order", -1),
        { kind: "pressure", topic: "ireland", delta: 1 },
      ],
    },
    talk: lawTalk("gbr_ulster", {
      who: person("gbr_carson"),
      ask: "frank",
      push: "threat",
      tell: ["irish:-1"],
      price: [inst("irish", -1)],
      wins: 2,
      tempers: ["stubborn"],
    }),
  }),
  // ww207: the war's bill that puts off the general election (the elect
  // row's `postpone`). Its flag is the one the power gbr_pw_extend and the
  // gov scenes set, so any of the three ways counts.
  row({
    id: "gbr_postpone",
    chapter: "franchise",
    opens: all(war, since("1915-07"), not(flag("f_gbr_parliament_extended"))),
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("eight_months", 1, []),
      draft("year_by_year", 0, ["commons:-1"], [inst("commons", -1)]),
      draft(
        "till_peace",
        -1,
        ["commons:-1", "opposition:-1"],
        [inst("commons", -1), inst("opposition", -1)],
      ),
    ],
    passed: [doWorld({ do: "gov_beaten", id: "gbr_election" })],
    passedTell: [],
    term: [],
    flag: "f_gbr_parliament_extended",
    settled: flag("f_gbr_parliament_extended"),
    repeal: {
      authority: 10,
      tell: ["commons:+1"],
      effects: [inst("commons", 1)],
    },
    talk: lawTalk("gbr_postpone", {
      who: person("gbr_bonar_law"),
      ask: "frank",
      push: "cold",
      tell: ["opposition:+1"],
      price: [inst("opposition", 1)],
      wins: 1,
    }),
  }),
  // ---- ww207: the factions' exclusive laws (a tree node opens each) ----
  // The Parliament Act 1911's preamble: a second chamber "constituted on a
  // popular instead of hereditary basis"; the Bryce Conference of 1917-18
  // (part chosen by the Commons). Tariff Reform and imperial preference
  // (Chamberlain, 1903; Bonar Law dropped the food taxes in January 1913).
  // Labour and the New Social Order (1918): the mines and the railways to the
  // nation; the Sankey Commission (1919) on the miners' share. Ireland's own
  // customs and taxes: the Irish Party's dominion demand (F).
  row({
    id: "gbr_x_senate",
    chapter: "franchise",
    exclusive: { faction: "gbr_liberals", node: "b1" },
    opens: not(flag("f_gbr_senate")),
    lean: -1,
    decree: false,
    cast: home,
    draft: [
      draft(
        "elected_senate",
        -1,
        ["commons:+1", "opposition:-2"],
        [inst("commons", 1), inst("opposition", -2)],
      ),
      draft("bryce_plan", 0, ["opposition:-1"], [inst("opposition", -1)]),
      draft("fewer_peers", 1, []),
    ],
    passed: [doWorld({ do: "faction", id: "gbr_peers", delta: 1 })],
    passedTell: [],
    term: [],
    flag: "f_gbr_senate",
    settled: flag("f_gbr_senate"),
    repeal: {
      authority: 30,
      tell: ["commons:-1"],
      effects: [inst("commons", -1)],
    },
    talk: lawTalk("gbr_x_senate", {
      who: person("gbr_haldane"),
      ask: "warm",
      push: "frank",
      tell: ["cabinet:+1"],
      price: [inst("cabinet", 1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_x_tariff",
    chapter: "tax",
    exclusive: { faction: "gbr_unionists", node: "b1" },
    opens: not(flag("f_gbr_tariff")),
    lean: -1,
    decree: false,
    cast: treasury,
    draft: [
      draft(
        "imperial_preference",
        0,
        ["money:+1", "commons:-1"],
        [gauge("money", 1), inst("commons", -1)],
      ),
      draft(
        "full_tariff",
        -1,
        ["money:+2", "bread:-1"],
        [gauge("money", 2), gauge("bread", -1)],
      ),
      draft("no_food_taxes", 1, ["money:+1"], [gauge("money", 1)]),
    ],
    passed: [gauge("money", 1)],
    passedTell: ["money:+1"],
    term: [
      { gauge: "money", delta: 1, every: 8 },
      { gauge: "bread", delta: -1, every: 12, offset: 4 },
    ],
    flag: "f_gbr_tariff",
    settled: flag("f_gbr_tariff"),
    repeal: {
      authority: 15,
      tell: ["money:-1"],
      effects: [gauge("money", -1)],
    },
    talk: lawTalk("gbr_x_tariff", {
      who: person("gbr_simon"),
      ask: "frank",
      push: "cold",
      tell: ["commons:-1"],
      price: [inst("commons", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "gbr_x_mines",
    chapter: "labour",
    exclusive: { faction: "gbr_labour", node: "b1" },
    opens: not(flag("f_gbr_mines")),
    lean: -1,
    decree: false,
    cast: treasury,
    draft: [
      draft(
        "mines_railways",
        -1,
        ["shells:+1", "money:-1"],
        [gauge("shells", 1), gauge("money", -1)],
      ),
      draft("miners_share", 0, ["order:+1"], [gauge("order", 1)]),
      draft("state_control", 1, ["shells:+1"], [gauge("shells", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1"],
    term: [{ gauge: "shells", delta: 1, every: 10 }],
    flag: "f_gbr_mines",
    settled: flag("f_gbr_mines"),
    repeal: {
      authority: 25,
      tell: ["order:-2"],
      effects: [gauge("order", -2)],
    },
    talk: lawTalk("gbr_x_mines", {
      who: person("gbr_lloyd_george"),
      ask: "frank",
      push: "flatter",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "gbr_x_irish_purse",
    chapter: "nations",
    exclusive: { faction: "gbr_irish", node: "b1" },
    opens: not(flag("f_gbr_irish_purse")),
    lean: -1,
    decree: false,
    cast: { ireland: held("ireland") },
    draft: [
      draft("own_taxes", 0, ["irish:+1"], [inst("irish", 1)]),
      draft(
        "own_customs",
        -1,
        ["irish:+2", "opposition:-1"],
        [inst("irish", 2), inst("opposition", -1)],
      ),
      draft("joint_board", 1, []),
    ],
    passed: [
      inst("irish", 1),
      { kind: "pressure", topic: "ireland", delta: -1 },
    ],
    passedTell: ["irish:+1"],
    term: [],
    flag: "f_gbr_irish_purse",
    settled: flag("f_gbr_irish_purse"),
    repeal: {
      authority: 25,
      tell: ["irish:-2"],
      effects: [inst("irish", -2)],
    },
    talk: lawTalk("gbr_x_irish_purse", {
      who: person("gbr_mckenna"),
      ask: "cold",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
]);
