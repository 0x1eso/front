// France's bills (LawRows.ts shapes; words in ./kit.ts). The door is
// GW_LAW_HOME.FRA (the Chamber, then the Senate; decree under the state of
// siege). Text in resources/ww1914/ko/FRA.laws.json. Lane W5 (ww166-format.md).
// No `tell` anywhere: what a bill did comes after, as reason lines.
import {
  all,
  memory,
  not,
} from "@openfront/engine-api/ww1914/SceneDsl";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  gauge,
  held,
  inst,
  lawTalk,
  low,
  men,
  person,
  since,
  until,
  war,
} from "./kit";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "FRA" });
const home = { home: held("interior") };
const purse = { fin: held("finance") };
const atWar = (from: string) => all(war, since(from));

/**
 * France's bills. Each goes to the Chamber, then to the Senate, which votes as
 * an equal; where `decree` is true, a decree under the state of siege goes
 * round both, and the Chamber remembers it.
 */
export const FRA_LAWS: readonly GwLawRow[] = [
  row({
    id: "fra_law_siege",
    opens: war,
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("war_zone", 1, [], [inst("army", 1)]),
      draft("whole_country", 0, [], [inst("army", 2), inst("chamber", -1)]),
      draft("civil_courts", -1, [], [inst("chamber", 1), inst("army", -1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "morale", delta: -1, every: 14, offset: 4 },
    ],
    flag: "f_law_siege",
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_siege", {
      who: person("fra_renaudel"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("chamber", 1)],
      wins: 2,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "fra_law_three_years",
    opens: all(not(war), until("1916-12")),
    lean: 0,
    decree: false,
    cast: { pm: held("chancellor"), war: held("war") },
    draft: [
      draft("keep_three", 1, [], [inst("army", 1)]),
      draft("thirty_months", 0, [], [inst("chamber", 1)]),
      draft("two_years", -2, [], [inst("chamber", 2), inst("army", -2)]),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "manpower", delta: 1, every: 6, text: ["keep_three"] },
      { gauge: "manpower", delta: -1, every: 6, text: ["two_years"] },
      { gauge: "money", delta: 1, every: 12, text: ["two_years"] },
    ],
    flag: "f_law_three_years",
    repeal: { authority: 10, tell: [], effects: [inst("army", -1)] },
    talk: lawTalk("fra_law_three_years", {
      who: person("fra_barthou"),
      ask: "warm",
      push: "frank",
      tell: [],
      price: [inst("army", 1)],
      wins: 2,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "fra_law_income_tax",
    opens: since("1914-08"),
    lean: -1,
    decree: false,
    cast: purse,
    draft: [
      draft("as_voted", 0, [], [gauge("money", 1)]),
      draft("higher_bands", -2, [], [gauge("money", 2), inst("senate", -1)]),
      draft(
        "caillaux_scale",
        1,
        [],
        [gauge("money", 1), inst("chamber", 1)],
        memory("k_cai_tax"),
      ),
    ],
    passed: [gauge("money", 1)],
    passedTell: [],
    term: [
      { gauge: "money", delta: 1, every: 8 },
      { gauge: "order", delta: -1, every: 16, offset: 6 },
    ],
    flag: "f_fra_income_tax",
    repeal: { authority: 20, tell: [], effects: [gauge("money", -2)] },
    talk: lawTalk("fra_law_income_tax", {
      who: person("fra_ribot"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("senate", 1)],
      wins: 2,
      tempers: ["weary"],
    }),
  }),
  row({
    id: "fra_law_dalbiez",
    opens: atWar("1915-05"),
    lean: 1,
    decree: false,
    cast: { war: held("war"), home: held("interior") },
    draft: [
      draft("review_boards", 1, [], [men(3)]),
      draft("young_first", 0, [], [men(5), gauge("shells", -1)]),
      draft("factory_lists", -1, [], [men(4), gauge("order", -1)]),
    ],
    passed: [men(6)],
    passedTell: [],
    term: [{ gauge: "manpower", delta: 1, every: 4 }],
    repeal: { authority: 10, tell: [], effects: [men(-4)] },
    talk: lawTalk("fra_law_dalbiez", {
      who: person("fra_thomas"),
      ask: "frank",
      push: "flatter",
      tell: [],
      price: [gauge("shells", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
    after: {
      chapters: 6,
      options: [
        { id: "boards_stand", tell: [], effects: [men(2), gauge("order", -1)] },
        {
          id: "skilled_back",
          tell: [],
          effects: [gauge("shells", 1), men(-2)],
        },
        {
          id: "deputies_check",
          tell: [],
          effects: [inst("chamber", 1), inst("army", -1)],
        },
      ],
    },
  }),
  row({
    id: "fra_law_war_profits",
    opens: atWar("1915-12"),
    lean: 0,
    decree: false,
    cast: purse,
    draft: [
      draft("half_excess", 1, [], [gauge("money", 1)]),
      draft("full_excess", -2, [], [gauge("money", 2), gauge("shells", -1)]),
      draft("contracts_only", 1, [], [gauge("order", 1)]),
    ],
    passed: [gauge("money", 1), gauge("order", 1)],
    passedTell: [],
    term: [
      { gauge: "money", delta: 1, every: 9 },
      { gauge: "shells", delta: -1, every: 15, offset: 5 },
    ],
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_war_profits", {
      who: person("fra_loucheur"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 2,
      tempers: ["cold"],
    }),
  }),
  row({
    id: "fra_law_rents",
    opens: atWar("1914-09"),
    lean: 1,
    decree: true,
    cast: home,
    draft: [
      draft("soldiers_families", 1, [], []),
      draft("all_small_rents", 0, [], [gauge("order", 1), gauge("money", -1)]),
      draft("rent_boards", -1, [], [gauge("order", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 8 },
      { gauge: "money", delta: -1, every: 14, offset: 6 },
    ],
    repeal: { authority: 20, tell: [], effects: [gauge("order", -2)] },
    talk: lawTalk("fra_law_rents", {
      who: person("fra_cochin"),
      ask: "warm",
      push: "frank",
      tell: [],
      price: [inst("senate", 1)],
      wins: 1,
    }),
    after: {
      chapters: 7,
      options: [
        {
          id: "extend_again",
          tell: [],
          effects: [gauge("order", 1), inst("senate", -1)],
        },
        {
          id: "state_pays_half",
          tell: [],
          effects: [gauge("money", -1), inst("senate", 1)],
        },
        { id: "let_it_lapse", tell: [], effects: [gauge("order", -1)] },
      ],
    },
  }),
  row({
    id: "fra_law_allowances",
    opens: war,
    lean: 1,
    decree: true,
    cast: purse,
    draft: [
      draft("needy_only", 1, [], []),
      draft("every_family", 0, [], [gauge("morale", 1), gauge("money", -1)]),
      draft("with_children", 0, [], [gauge("morale", 1)]),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [
      { gauge: "morale", delta: 1, every: 9 },
      { gauge: "money", delta: -1, every: 10, offset: 3 },
    ],
    repeal: { authority: 25, tell: [], effects: [gauge("morale", -2)] },
    talk: lawTalk("fra_law_allowances", {
      who: held("finance"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["anxious"],
    }),
  }),
  row({
    id: "fra_law_censorship",
    opens: war,
    lean: 1,
    decree: true,
    cast: home,
    draft: [
      draft("military_only", 1, [], [inst("army", 1)]),
      draft("political_too", 0, [], [gauge("order", 1), inst("chamber", -1)]),
      draft("white_spaces", 0, [], [gauge("morale", -1), inst("chamber", 1)]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 9 },
      { gauge: "morale", delta: -1, every: 12, offset: 4 },
    ],
    flag: "f_law_censor",
    censor: 1,
    repeal: { authority: 10, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("fra_law_censorship", {
      who: person("fra_clemenceau"),
      ask: "frank",
      push: "threat",
      tell: [],
      price: [inst("senate", 1), inst("army", -1)],
      wins: 2,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "fra_law_supply_decrees",
    opens: all(war, since("1917-09"), low("bread", 2)),
    lean: 0,
    decree: false,
    cast: { pm: held("chancellor"), ag: held("agriculture") },
    draft: [
      draft("penalties_only", 1, [], [gauge("bread", 1)]),
      draft("bread_cards", 0, [], [gauge("bread", 1), gauge("morale", -1)]),
      draft("chamber_reviews", 1, [], [inst("chamber", 1)]),
    ],
    passed: [gauge("bread", 1)],
    passedTell: [],
    term: [
      { gauge: "bread", delta: 1, every: 6 },
      { gauge: "morale", delta: -1, every: 13, offset: 3 },
    ],
    flag: "f_fra_supply_decrees",
    repeal: { authority: 10, tell: [], effects: [gauge("bread", -1)] },
    talk: lawTalk("fra_law_supply_decrees", {
      who: person("fra_jouhaux"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
];
