// France's bills (LawRows.ts shapes; words in ./kit.ts). The door is
// GW_LAW_HOME.FRA (the Chamber, then the Senate; decree under the state of
// siege). Text in resources/ww1914/ko/FRA.laws.json. Lane W5 (ww166-format.md).
// No `tell` anywhere: what a bill did comes after, as reason lines.
import { all, memory, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawRow } from "../../LawRows";
import { withAxes } from "./fraAxes";
import { FRA_PEACE_LAWS } from "./fraPeace";
import {
  draft,
  either,
  gauge,
  held,
  inst,
  lawTalk,
  low,
  men,
  office,
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
const FRA_LAW_ROWS: readonly GwLawRow[] = [
  row({
    id: "fra_law_siege",
    chapter: "siege",
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
    // Lifted, the President's own decree of siege goes with it (ww171).
    repeal: {
      authority: 15,
      tell: [],
      effects: [gauge("order", -1), { kind: "unflag", flag: "f_fra_pw_siege" }],
    },
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
    chapter: "conscription",
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
    chapter: "war_finance",
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
    chapter: "conscription",
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
  // + check. ww203: the labour article beside Dalbiez's factory lists: the
  // men sent back to the works stay soldiers. A decree of 17 January 1917
  // forbade strikes in the private works making arms (Labour Ministry
  // history, travail-emploi.gouv.fr); the wage boards and the shop delegates
  // of Thomas's ministry that year are not checked.
  row({
    id: "fra_law_labour",
    chapter: "labour",
    opens: atWar("1915-09"),
    lean: 0,
    decree: true,
    cast: { arms: either(office("munitions"), held("war")) },
    draft: [
      draft("strike_ban", 1, [], [gauge("shells", 1)]),
      draft("wage_boards", 0, [], [gauge("order", 1), gauge("money", -1)]),
      draft("shop_delegates", -1, [], [gauge("order", 1), inst("army", -1)]),
    ],
    passed: [gauge("shells", 1)],
    passedTell: [],
    term: [
      { gauge: "shells", delta: 1, every: 8 },
      { gauge: "order", delta: -1, every: 12, offset: 4, text: ["strike_ban"] },
      {
        gauge: "order",
        delta: 1,
        every: 12,
        text: ["wage_boards", "shop_delegates"],
      },
    ],
    repeal: { authority: 15, tell: [], effects: [gauge("shells", -1)] },
    talk: lawTalk("fra_law_labour", {
      who: person("fra_jouhaux"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
  row({
    id: "fra_law_war_profits",
    chapter: "war_finance",
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
    chapter: "food",
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
    chapter: "food",
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
    chapter: "censorship",
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
    chapter: "food",
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
  // ww190 §1: the peace years' bill beside the three-year law, the navy
  // programme of 1912 pushed on. Opens only while the war hasn't come.
  row({
    id: "fra_law_navy",
    chapter: "arms",
    opens: all(not(war), world({ is: "peace_months", min: 3 })),
    lean: 0,
    decree: false,
    cast: { navy: held("navy"), fin: held("finance") },
    draft: [
      draft("full_programme", 0, [], [navyArms(5), gauge("money", -1)]),
      draft("with_levy", -1, [], [navyArms(5), inst("senate", -1)]),
      draft("slower", 1, [], [navyArms(3)]),
    ],
    passed: [],
    passedTell: [],
    term: [
      { gauge: "money", delta: -1, every: 12, text: ["full_programme"] },
      { gauge: "money", delta: 1, every: 12, text: ["with_levy"] },
    ],
    flag: "f_fra_law_navy",
    repeal: { authority: 10, tell: [], effects: [navyArms(-5)] },
    talk: lawTalk("fra_law_navy", {
      who: person("fra_delcasse"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("army", -1)],
      wins: 2,
      tempers: ["arrogant"],
    }),
  }),
];

/** ww207: every text with its axis push (./fraAxes). */
export const FRA_LAWS: readonly GwLawRow[] = [
  ...FRA_LAW_ROWS,
  ...FRA_PEACE_LAWS,
].map(withAxes);

/** The arms effect on the running plan's navy share (ww190 PeaceYears). */
function navyArms(delta: number) {
  return doWorld({ do: "arms", line: "navy", delta });
}
