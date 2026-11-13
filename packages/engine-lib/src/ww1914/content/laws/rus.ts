import { any, chose, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  either,
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

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "RUS" });
const allOf = (...of: GwLawRow["opens"][]): GwLawRow["opens"] => ({
  kind: "all",
  of,
});
/** While there is a sovereign to sign. */
const crowned = world({ is: "regime", of: ["tsar", "crown", "regency"] });
/** ww190: the peace years, once a crisis has passed without a war. */
const peaceYears = allOf(
  world({ is: "peace_months", min: 0 }),
  not(world({ is: "war_months", min: 0 })),
);
const arms = (delta: number) => doWorld({ do: "arms", line: "army", delta });
const mix = (source: "taxes" | "loans", delta: number) =>
  doWorld({ do: "budget_mix", source, delta });

/**
 * Russia's bills. A bill can go to the Duma, which may say no. Or the Tsar
 * signs under Article 87 while it isn't sitting: nothing stops him, and the
 * Duma remembers. That is the whole game here: what the decree costs later.
 */
export const RUS_LAWS: readonly GwLawRow[] = [
  row({
    id: "rus_press",
    chapter: "censorship",
    opens: allOf(war, crowned),
    lean: 0,
    decree: true,
    cast: { interior: held("interior"), cos: held("chief_of_staff") },
    draft: [
      draft("stavka_reads", 0, ["stavka:+1"], [inst("stavka", 1)]),
      draft("war_news_only", 1, []),
      draft(
        "duma_speeches_free",
        -1,
        ["duma:+1", "court:-1"],
        [inst("duma", 1), inst("court", -1)],
      ),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1", "censor:+1"],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "morale", delta: -1, every: 12, offset: 2 },
    ],
    flag: "f_law_censor",
    censor: 1,
    repeal: {
      authority: 10,
      tell: ["duma:+1", "court:-1"],
      effects: [inst("duma", 1), inst("court", -1)],
    },
    talk: lawTalk("rus_press", {
      who: person("rus_milyukov"),
      ask: "frank",
      push: "cold",
      tell: ["court:-1"],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  row({
    id: "rus_dry",
    chapter: "food",
    opens: allOf(war, crowned, until("1915-12")),
    lean: 1,
    decree: true,
    cast: { fin: held("finance") },
    draft: [
      draft("for_the_war", 1, ["money:-1"], [gauge("money", -1)]),
      draft(
        "for_ever",
        0,
        ["court:+1", "money:-2"],
        [inst("court", 1), gauge("money", -2)],
      ),
      draft("wine_and_beer", 1, ["order:-1"], [gauge("order", -1)]),
    ],
    passed: [gauge("order", 1), gauge("shells", 1)],
    passedTell: ["order:+1", "shells:+1"],
    term: [
      { gauge: "money", delta: -1, every: 10 },
      { gauge: "order", delta: 1, every: 13, offset: 4 },
    ],
    settled: any(
      chose("gw_bm_rus_1914", "dry_law"),
      chose("rus_c_vodka", "whole_war"),
      chose("rus_c_vodka", "whole_war_tax"),
    ),
    replaces: ["rus_c_vodka"],
    repeal: {
      authority: 15,
      tell: ["money:+1", "court:-1"],
      effects: [gauge("money", 1), inst("court", -1)],
    },
    talk: lawTalk("rus_dry", {
      who: held("finance"),
      ask: "cold",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
  }),
  row({
    id: "rus_ratniki",
    chapter: "conscription",
    opens: allOf(war, crowned, since("1915-05")),
    lean: -1,
    decree: true,
    cast: { war: held("war") },
    draft: [
      draft(
        "second_class",
        0,
        ["manpower:+4", "order:-1"],
        [men(4), gauge("order", -1)],
      ),
      draft("not_only_sons", 2, ["manpower:-3"], [men(-3)]),
      draft(
        "land_after",
        1,
        ["duma:+1", "court:-1"],
        [inst("duma", 1), inst("court", -1)],
      ),
    ],
    passed: [men(12), gauge("order", -1)],
    passedTell: ["manpower:+12", "order:-1"],
    term: [
      { gauge: "manpower", delta: 1, every: 4 },
      { gauge: "bread", delta: -1, every: 9, offset: 3 },
    ],
    repeal: {
      authority: 20,
      tell: ["manpower:-8", "order:+1"],
      effects: [men(-8), gauge("order", 1)],
    },
    talk: lawTalk("rus_ratniki", {
      who: either(person("rus_polivanov"), held("war")),
      ask: "frank",
      push: "cold",
      tell: ["stavka:-1"],
      price: [inst("stavka", -1)],
      wins: 2,
    }),
    after: {
      chapters: 6,
      options: [
        {
          id: "take_them",
          tell: ["manpower:+3", "order:-1"],
          effects: [men(3), gauge("order", -1)],
        },
        {
          id: "leave_harvest",
          tell: ["bread:+1", "stavka:-1"],
          effects: [gauge("bread", 1), inst("stavka", -1)],
        },
      ],
    },
  }),
  row({
    id: "rus_councils",
    chapter: "labour",
    opens: allOf(war, crowned, since("1915-05")),
    lean: 1,
    decree: true,
    cast: { war: held("war"), chancellor: held("chancellor") },
    draft: [
      draft("four_councils", 1, ["court:-1"], [inst("court", -1)]),
      draft("defence_alone", 0, []),
      draft(
        "with_zemgor",
        1,
        ["duma:+1", "ministers:-1"],
        [inst("duma", 1), inst("ministers", -1)],
      ),
    ],
    passed: [gauge("shells", 1), inst("duma", 1)],
    passedTell: ["shells:+1", "duma:+1"],
    term: [{ gauge: "shells", delta: 1, every: 5 }],
    repeal: {
      authority: 25,
      tell: ["duma:-2", "shells:-1"],
      effects: [inst("duma", -2), gauge("shells", -1)],
    },
    talk: lawTalk("rus_councils", {
      who: person("rus_guchkov"),
      ask: "frank",
      push: "flatter",
      tell: ["court:-1"],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
    after: {
      chapters: 8,
      options: [
        {
          id: "let_them_buy",
          tell: ["shells:+1", "court:-1"],
          effects: [gauge("shells", 1), inst("court", -1)],
        },
        {
          id: "minister_chairs",
          tell: ["court:+1", "duma:-1"],
          effects: [inst("court", 1), inst("duma", -1)],
        },
      ],
    },
  }),
  row({
    id: "rus_factories",
    chapter: "labour",
    opens: allOf(war, crowned, since("1915-09")),
    lean: -2,
    decree: true,
    cast: { war: held("war"), interior: held("interior") },
    draft: [
      draft(
        "under_arms",
        0,
        ["stavka:+1", "order:-1"],
        [inst("stavka", 1), gauge("order", -1)],
      ),
      draft(
        "workers_group",
        2,
        ["duma:+1", "court:-1"],
        [inst("duma", 1), inst("court", -1)],
      ),
      draft("strike_courts", 1, []),
    ],
    passed: [gauge("shells", 1)],
    passedTell: ["shells:+1"],
    term: [
      { gauge: "shells", delta: 1, every: 6 },
      { gauge: "order", delta: -1, every: 7, offset: 2 },
    ],
    flag: "f_law_strike_ban",
    repeal: {
      authority: 15,
      tell: ["order:+1", "shells:-1"],
      effects: [gauge("order", 1), gauge("shells", -1)],
    },
    talk: lawTalk("rus_factories", {
      who: person("rus_chkheidze"),
      ask: "cold",
      push: "threat",
      tell: ["duma:+1", "court:-1"],
      price: [inst("duma", 1), inst("court", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "rus_grain",
    chapter: "food",
    opens: allOf(war, since("1916-06"), low("bread", 2)),
    lean: 0,
    decree: true,
    cast: { agri: held("agriculture") },
    draft: [
      draft("fixed_price", 1, ["order:-1"], [gauge("order", -1)]),
      draft(
        "quota_levy",
        0,
        ["bread:+1", "duma:-1"],
        [gauge("bread", 1), inst("duma", -1)],
      ),
      draft("trains_first", 1, ["shells:-1"], [gauge("shells", -1)]),
    ],
    passed: [gauge("bread", 1)],
    passedTell: ["bread:+1"],
    term: [
      { gauge: "bread", delta: 1, every: 5 },
      { gauge: "order", delta: -1, every: 8, offset: 1 },
    ],
    repeal: {
      authority: 10,
      tell: ["bread:-1", "order:+1"],
      effects: [gauge("bread", -1), gauge("order", 1)],
    },
    talk: lawTalk("rus_grain", {
      who: either(person("rus_rittikh"), held("agriculture")),
      ask: "frank",
      push: "cold",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
  row({
    id: "rus_poland",
    chapter: "nations",
    opens: allOf(war, crowned, since("1915-01")),
    lean: 0,
    decree: true,
    cast: { foreign: held("foreign") },
    draft: [
      draft("autonomy_word", 1, []),
      draft("charter", 0, ["court:-1"], [inst("court", -1)]),
      draft(
        "crown_of_poland",
        -1,
        ["fra:+1", "court:-2"],
        [{ kind: "trust", tag: "FRA", delta: 1 }, inst("court", -2)],
      ),
    ],
    passed: [
      { kind: "pressure", topic: "poland", delta: -2 },
      gauge("morale", 1),
    ],
    passedTell: ["morale:+1"],
    term: [],
    settled: any(
      chose("rus_h_poland_charter", "charter"),
      chose("rus_h_poland_charter", "crown_of_poland"),
    ),
    replaces: ["rus_h_poland_charter"],
    repeal: {
      authority: 25,
      tell: ["court:+1", "morale:-1"],
      effects: [inst("court", 1), gauge("morale", -1)],
    },
    talk: lawTalk("rus_poland", {
      who: held("foreign"),
      ask: "warm",
      push: "cold",
      tell: ["court:-1"],
      price: [inst("court", -1)],
      wins: 2,
      tempers: ["anxious"],
    }),
  }),
  row({
    id: "rus_finland",
    chapter: "nations",
    opens: allOf(war, crowned, since("1915-08")),
    lean: 0,
    decree: true,
    cast: { chancellor: held("chancellor") },
    draft: [
      draft("stop_the_programme", 1, ["court:-1"], [inst("court", -1)]),
      draft(
        "diet_recalled",
        -1,
        ["duma:+1", "court:-2"],
        [inst("duma", 1), inst("court", -2)],
      ),
      draft("quiet_governor", 1, []),
    ],
    passed: [gauge("order", 1), inst("duma", 1)],
    passedTell: ["order:+1", "duma:+1"],
    term: [],
    repeal: {
      authority: 15,
      tell: ["duma:-1", "court:+1"],
      effects: [inst("duma", -1), inst("court", 1)],
    },
    talk: lawTalk("rus_finland", {
      who: person("rus_milyukov"),
      ask: "frank",
      push: "cold",
      tell: ["court:-1"],
      price: [inst("court", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "rus_pale",
    chapter: "nations",
    opens: allOf(war, crowned, since("1915-08")),
    lean: 0,
    decree: true,
    cast: { interior: held("interior"), fin: held("finance") },
    draft: [
      draft("towns_circular", 1, ["court:-1"], [inst("court", -1)]),
      draft(
        "whole_pale",
        -1,
        ["duma:+1", "court:-2", "money:+1"],
        [inst("duma", 1), inst("court", -2), gauge("money", 1)],
      ),
      draft("refugees_only", 2, []),
    ],
    passed: [
      doWorld({ do: "readiness", tag: "USA", delta: 2 }),
      gauge("money", 1),
    ],
    passedTell: ["money:+1", "america:+1"],
    term: [],
    repeal: {
      authority: 20,
      tell: ["money:-1", "duma:-1"],
      effects: [gauge("money", -1), inst("duma", -1)],
    },
    talk: lawTalk("rus_pale", {
      who: person("rus_shingarev"),
      ask: "frank",
      push: "cold",
      tell: ["court:-1"],
      price: [inst("court", -1)],
      wins: 2,
    }),
  }),
  row({
    // ww190: the "Great Programme" for the army, passed in the summer of 1914
    // (larger peacetime army and artillery, finished by 1917). A peace bill:
    // its drafts tilt the budget to the army and say who pays.
    id: "rus_great_programme",
    chapter: "arms",
    opens: allOf(peaceYears, crowned),
    lean: 1,
    decree: true,
    cast: { war: held("war"), fin: held("finance") },
    draft: [
      draft(
        "whole_by_taxes",
        0,
        ["army_line:+10", "tax_rate:+1"],
        [arms(10), mix("taxes", 10)],
      ),
      draft(
        "whole_by_loans",
        1,
        ["army_line:+10", "loans_ask:+1"],
        [arms(10), mix("loans", 10)],
      ),
      draft("guns_first", 1, ["army_line:+5"], [arms(5)]),
    ],
    passed: [inst("stavka", 1)],
    passedTell: ["stavka:+1"],
    term: [{ gauge: "money", delta: -1, every: 9, offset: 3 }],
    repeal: {
      authority: 15,
      tell: ["stavka:-1", "money:+1"],
      effects: [inst("stavka", -1), gauge("money", 1)],
    },
    talk: lawTalk("rus_great_programme", {
      who: person("rus_rodzianko"),
      ask: "warm",
      push: "frank",
      tell: ["duma:+1"],
      price: [inst("duma", 1)],
      wins: 1,
    }),
  }),
  // + check (ww203): the war's taxes. Bark's income tax passed the Duma and
  // the State Council (signed 6 April 1916, levied from 1917); a war-profits
  // tax followed on 13 May 1916. Three bills: borrow only, the income tax,
  // a tax on war profits.
  row({
    id: "rus_war_tax",
    chapter: "war_finance",
    opens: allOf(war, crowned, since("1915-02")),
    lean: 0,
    decree: true,
    cast: { fin: held("finance") },
    draft: [
      draft("loans_only", 1, ["loans_ask:+1"], [mix("loans", 10)]),
      draft(
        "income_tax",
        0,
        ["tax_rate:+1", "duma:+1", "court:-1"],
        [mix("taxes", 10), inst("duma", 1), inst("court", -1)],
      ),
      draft(
        "war_profits",
        1,
        ["money:+1", "shells:-1"],
        [gauge("money", 1), gauge("shells", -1)],
      ),
    ],
    passed: [gauge("money", 1)],
    passedTell: ["money:+1"],
    term: [{ gauge: "money", delta: 1, every: 8, offset: 2 }],
    repeal: {
      authority: 10,
      tell: ["money:-1"],
      effects: [gauge("money", -1)],
    },
    talk: lawTalk("rus_war_tax", {
      who: either(person("rus_bark"), held("finance")),
      ask: "frank",
      push: "cold",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  // + check (ww203): who rules the army's zone. The Field Regulations of
  // 16 July 1914 gave the front provinces to the generals; in the retreat of
  // 1915 Stavka drove whole peoples east and the Council of Ministers fought
  // it. Three bills: the generals rule, the civil governors answer to the
  // Interior, the army keeps the zone but expels no one without the Council.
  row({
    id: "rus_army_zone",
    chapter: "siege",
    opens: allOf(war, crowned, since("1915-06")),
    lean: 0,
    decree: true,
    cast: { interior: held("interior"), cos: held("chief_of_staff") },
    draft: [
      draft(
        "stavka_rules",
        1,
        ["stavka:+1", "ministers:-1"],
        [inst("stavka", 1), inst("ministers", -1)],
      ),
      draft(
        "civil_governors",
        0,
        ["ministers:+1", "stavka:-1"],
        [inst("ministers", 1), inst("stavka", -1)],
      ),
      draft(
        "no_expulsions",
        1,
        ["duma:+1", "stavka:-1"],
        [inst("duma", 1), inst("stavka", -1)],
      ),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1"],
    term: [{ gauge: "order", delta: 1, every: 9, offset: 3 }],
    repeal: {
      authority: 15,
      tell: ["order:-1"],
      effects: [gauge("order", -1)],
    },
    talk: lawTalk("rus_army_zone", {
      who: either(person("rus_krivoshein"), held("chancellor")),
      ask: "frank",
      push: "cold",
      tell: ["stavka:-1"],
      price: [inst("stavka", -1)],
      wins: 1,
    }),
  }),
];
