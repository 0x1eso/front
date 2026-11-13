import {
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
/** ww190: the peace years' bill tilts the running plan's navy share. */
const navyShare = (delta: number) =>
  doWorld({ do: "arms", line: "navy", delta });

/**
 * Britain's bills. The door is the Commons, the cabinet behind it; a regulation
 * under the Defence of the Realm Act reaches only what `decree` says it can.
 */
export const GBR_LAWS: readonly GwLawRow[] = [
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
];
