import {
  any,
  byName,
  chose,
  flag,
  keepPromise,
  memory,
  setFlag,
} from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawRow } from "../../LawRows";
import {
  draft,
  either,
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

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "DEU" });
const home = { interior: held("interior"), chancellor: held("chancellor") };
const allOf = (...of: GwLawRow["opens"][]): GwLawRow["opens"] => ({
  kind: "all",
  of,
});

/** ww190: the peace years, no great war anywhere. */
const peaceYears = (months: number): GwLawRow["opens"] => ({
  kind: "all",
  of: [
    world({ is: "peace_months", min: months }),
    { kind: "not", of: world({ is: "war_months", min: 0 }) },
  ],
});
/** What a text of the bill brings once it is law. */
const onText = (
  law: string,
  text: string,
  ...then: GwLawRow["passed"][number][]
): GwLawRow["passed"][number] => ({
  kind: "maybe",
  when: isText(law, text),
  then: [...then],
});
const armsBy = (delta: number) => doWorld({ do: "arms", line: "army", delta });
const treasury = (pct: number) =>
  doWorld({ do: "budget_item", item: "treasury", pct });
const opinion = (bloc: "business" | "workers", delta: number) =>
  ({ kind: "opinion", bloc, delta }) as const;

/**
 * Germany's bills. The door is the Reichstag. In war the Bundesrat can rule on
 * the economy past it, by the powers it was given on 4 August; what touches the
 * constitution or the vote, it can't.
 */
export const DEU_LAWS: readonly GwLawRow[] = [
  row({
    id: "deu_censor",
    chapter: "censorship",
    // The siege law gave the corps commanders the censor in August 1914.
    opens: allOf(war, since("1914-10")),
    lean: 0,
    decree: true,
    cast: home,
    draft: [
      draft("generals_keep", 1, ["army:+1"], [inst("army", 1)]),
      draft("one_office", 0, ["army:-1"], [inst("army", -1)]),
      draft(
        "reichstag_reads",
        -1,
        ["reichstag:+1", "army:-1"],
        [inst("reichstag", 1), inst("army", -1)],
      ),
    ],
    passed: [gauge("order", 1)],
    passedTell: ["order:+1", "censor:+1"],
    term: [
      { gauge: "order", delta: 1, every: 10 },
      { gauge: "morale", delta: -1, every: 14, offset: 4 },
    ],
    flag: "f_law_censor",
    censor: 1,
    settled: any(
      chose("deu_h_censor", "one_censor"),
      chose("deu_h_censor", "press_office"),
    ),
    replaces: ["deu_h_censor"],
    repeal: {
      authority: 15,
      tell: ["army:-1", "reichstag:+1"],
      effects: [inst("army", -1), inst("reichstag", 1)],
    },
    talk: lawTalk("deu_censor", {
      who: either(person("deu_erzberger"), person("deu_haase")),
      ask: "frank",
      push: "cold",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 1,
      tempers: ["cunning"],
    }),
  }),
  row({
    id: "deu_bread_cards",
    chapter: "food",
    opens: allOf(war, since("1915-01")),
    lean: 1,
    decree: true,
    cast: home,
    draft: [
      draft("city_cards", 1, []),
      draft(
        "reich_grain",
        0,
        ["bread:+1", "reichstag:-1"],
        [gauge("bread", 1), inst("reichstag", -1)],
      ),
      draft("war_bread", 1, ["morale:-1"], [gauge("morale", -1)]),
    ],
    passed: [gauge("bread", 1)],
    passedTell: ["bread:+1"],
    term: [
      { gauge: "bread", delta: 1, every: 6 },
      { gauge: "morale", delta: -1, every: 13, offset: 3 },
    ],
    repeal: {
      authority: 15,
      tell: ["bread:-2"],
      effects: [gauge("bread", -2)],
    },
    talk: lawTalk("deu_bread_cards", {
      who: held("interior"),
      ask: "cold",
      push: "frank",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
    after: {
      chapters: 8,
      options: [
        {
          id: "cut_ration",
          tell: ["bread:+1", "morale:-1"],
          effects: [gauge("bread", 1), gauge("morale", -1)],
        },
        {
          id: "seize_farms",
          tell: ["bread:+1", "reichstag:-1", "order:-1"],
          effects: [
            gauge("bread", 1),
            inst("reichstag", -1),
            gauge("order", -1),
          ],
        },
        {
          id: "wink_at_it",
          tell: ["order:+1", "bread:-1"],
          effects: [gauge("order", 1), gauge("bread", -1)],
        },
      ],
    },
  }),
  row({
    id: "deu_food_office",
    chapter: "food",
    opens: allOf(war, since("1916-02"), low("bread", 2)),
    lean: 1,
    decree: true,
    cast: home,
    draft: [
      draft("food_dictator", 1, ["reichstag:+1"], [inst("reichstag", 1)]),
      draft("states_keep", 0, []),
      draft(
        "army_seat",
        0,
        ["army:+1", "bread:+1"],
        [inst("army", 1), gauge("bread", 1)],
      ),
    ],
    passed: [gauge("bread", 1)],
    passedTell: ["bread:+1"],
    term: [{ gauge: "bread", delta: 1, every: 8 }],
    repeal: {
      authority: 10,
      tell: ["bread:-1"],
      effects: [gauge("bread", -1)],
    },
    talk: lawTalk("deu_food_office", {
      who: either(person("deu_batocki"), held("interior")),
      ask: "frank",
      push: "cold",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 1,
      tempers: ["cold"],
    }),
  }),
  row({
    id: "deu_strike_ban",
    chapter: "labour",
    opens: allOf(war, since("1915-06")),
    lean: -1,
    decree: true,
    cast: { chancellor: held("chancellor"), war: held("war") },
    draft: [
      draft("corps_commanders", 0, ["army:+1"], [inst("army", 1)]),
      draft("arbitration", 2, ["shells:-1"], [gauge("shells", -1)]),
      draft("courts_only", 1, []),
    ],
    passed: [gauge("shells", 1)],
    passedTell: ["shells:+1"],
    term: [
      { gauge: "shells", delta: 1, every: 8 },
      { gauge: "order", delta: -1, every: 8, offset: 3 },
    ],
    flag: "f_law_strike_ban",
    repeal: {
      authority: 15,
      tell: ["order:+1", "army:-1"],
      effects: [gauge("order", 1), inst("army", -1)],
    },
    talk: lawTalk("deu_strike_ban", {
      who: either(person("deu_ebert"), person("deu_haase")),
      ask: "frank",
      push: "threat",
      tell: ["reichstag:+1", "army:-1"],
      price: [inst("reichstag", 1), inst("army", -1)],
      wins: 2,
    }),
    after: {
      chapters: 9,
      options: [
        {
          id: "uniform_them",
          tell: ["shells:+1", "order:-1"],
          effects: [gauge("shells", 1), gauge("order", -1)],
        },
        {
          id: "talk_to_shop",
          tell: ["order:+1", "army:-1"],
          effects: [gauge("order", 1), inst("army", -1)],
        },
      ],
    },
  }),
  row({
    id: "deu_aux",
    chapter: "conscription",
    opens: allOf(war, since("1916-08")),
    lean: 0,
    decree: false,
    cast: home,
    draft: [
      draft("army_text", -1, ["army:+1"], [inst("army", 1)]),
      draft(
        "unions_text",
        2,
        ["army:-1"],
        [inst("army", -1), setFlag("f_aux_unions")],
      ),
    ],
    passed: [men(3), gauge("shells", 1)],
    passedTell: ["manpower:+3", "shells:+1"],
    term: [
      { gauge: "manpower", delta: 1, every: 4 },
      { gauge: "shells", delta: 1, every: 8 },
    ],
    settled: any(
      chose("deu_h_aux_service", "army_text"),
      chose("deu_h_aux_service", "unions_text"),
    ),
    replaces: ["deu_h_aux_service"],
    repeal: {
      authority: 20,
      tell: ["manpower:-3", "order:+1"],
      effects: [men(-3), gauge("order", 1)],
    },
    talk: lawTalk("deu_aux", {
      who: person("deu_groener"),
      ask: "frank",
      push: "cold",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 2,
    }),
  }),
  row({
    id: "deu_unions",
    chapter: "labour",
    opens: allOf(war, since("1916-01")),
    lean: 1,
    decree: false,
    cast: home,
    draft: [
      draft("youth_clause", 1, []),
      draft(
        "paragraph_153",
        0,
        ["order:+1", "army:-1"],
        [gauge("order", 1), inst("army", -1)],
      ),
      draft("words_only", 1, ["order:-1"], [gauge("order", -1)]),
    ],
    passed: [inst("reichstag", 1), inst("army", -1)],
    passedTell: ["reichstag:+1", "army:-1"],
    term: [{ gauge: "order", delta: 1, every: 10 }],
    repeal: {
      authority: 25,
      tell: ["order:-2", "reichstag:-1"],
      effects: [gauge("order", -2), inst("reichstag", -1)],
    },
    talk: lawTalk("deu_unions", {
      who: either(person("deu_ebert"), person("deu_scheidemann")),
      ask: "warm",
      push: "frank",
      tell: ["army:-1"],
      price: [inst("army", -1)],
      wins: 1,
    }),
  }),
  row({
    id: "deu_jesuits",
    chapter: "nations",
    opens: allOf(war, since("1916-06")),
    lean: 0,
    decree: false,
    cast: { chancellor: held("chancellor") },
    draft: [
      draft("whole_law", 1, ["countersign:-1"], [inst("countersign", -1)]),
      draft("houses_only", 0, []),
    ],
    passed: [inst("reichstag", 1), gauge("morale", 1)],
    passedTell: ["reichstag:+1", "morale:+1"],
    term: [],
    repeal: {
      authority: 25,
      tell: ["reichstag:-2"],
      effects: [inst("reichstag", -2)],
    },
    talk: lawTalk("deu_jesuits", {
      who: either(person("deu_erzberger"), person("deu_hertling")),
      ask: "warm",
      push: "cold",
      tell: ["countersign:-1"],
      price: [inst("countersign", -1)],
      wins: 2,
      tempers: ["cunning"],
    }),
  }),
  row({
    id: "deu_three_class",
    chapter: "franchise",
    opens: allOf(
      war,
      since("1916-06"),
      any(
        flag("f_franchise_word"),
        flag("f_franchise_draft"),
        memory("k_beth_reform"),
        chose("deu_k_easter_message", "equal_vote_word"),
        world({ is: "unrest", min: 1 }),
      ),
    ),
    lean: -3,
    decree: false,
    cast: home,
    draft: [
      draft("plural_vote", 1, []),
      draft(
        "equal_vote",
        0,
        ["order:+1", "army:-1"],
        [gauge("order", 1), inst("army", -1)],
      ),
      draft("after_the_peace", 2, ["order:-1"], [gauge("order", -1)]),
    ],
    passed: [
      gauge("order", 2),
      gauge("morale", 1),
      inst("army", -1),
      keepPromise(byName("deu_bethmann"), "p_beth_reform"),
      keepPromise(byName("deu_ebert"), "p_ebert_franchise"),
    ],
    passedTell: ["order:+2", "morale:+1", "army:-1"],
    term: [],
    repeal: {
      authority: 45,
      tell: ["order:-3"],
      effects: [gauge("order", -3)],
    },
    talk: lawTalk("deu_three_class", {
      who: held("chancellor"),
      ask: "frank",
      push: "cold",
      tell: ["army:-1", "countersign:+1"],
      price: [inst("army", -1), inst("countersign", 1)],
      wins: 2,
      tempers: ["weary"],
    }),
  }),
  row({
    id: "deu_alsace",
    chapter: "nations",
    opens: allOf(war, since("1917-01")),
    lean: -1,
    decree: false,
    cast: { chancellor: held("chancellor"), cos: held("chief_of_staff") },
    draft: [
      draft("federal_state", 0, ["army:-1"], [inst("army", -1)]),
      draft(
        "share_out",
        1,
        ["army:+1", "order:-1"],
        [inst("army", 1), gauge("order", -1)],
      ),
      draft("to_prussia", 1, ["reichstag:-1"], [inst("reichstag", -1)]),
    ],
    passed: [{ kind: "pressure", topic: "alsace", delta: -2 }],
    passedTell: ["alsace_eases"],
    term: [],
    repeal: { authority: 20, tell: ["army:+1"], effects: [inst("army", 1)] },
    talk: lawTalk("deu_alsace", {
      who: held("war"),
      ask: "cold",
      push: "threat",
      tell: ["reichstag:-1"],
      price: [inst("reichstag", -1)],
      wins: 1,
    }),
  }),
  // ww190 §1: the peace years' bill. A new army bill after 1913's; each text
  // tilts the plan by its own measure and brings the tax that pays for it
  // (Laws.test keeps a nation at ten bills, so the levy rides in the texts).
  row({
    id: "deu_army_bill",
    chapter: "arms",
    opens: allOf(
      peaceYears(6),
      any(
        world({ is: "arms_race", tag: "FRA" }),
        world({ is: "arms_race", tag: "RUS" }),
        { kind: "temp", min: 5 },
      ),
    ),
    lean: 0,
    decree: false,
    cast: { war: held("war"), chancellor: held("chancellor") },
    draft: [
      draft("cadres", 2, ["army_line:+1"]),
      draft(
        "corps",
        0,
        ["army_line:+2", "money:+1", "reichstag:-1"],
        [inst("reichstag", -1)],
      ),
      draft(
        "full_service",
        -2,
        ["army_line:+3", "money:+1", "order:-1"],
        [gauge("order", -1)],
      ),
    ],
    passed: [
      onText("deu_army_bill", "cadres", armsBy(2)),
      onText(
        "deu_army_bill",
        "corps",
        armsBy(4),
        treasury(8),
        opinion("business", -1),
      ),
      onText(
        "deu_army_bill",
        "full_service",
        armsBy(6),
        treasury(7),
        opinion("workers", -1),
      ),
      inst("army", 1),
    ],
    passedTell: ["army:+1"],
    term: [
      {
        gauge: "manpower",
        delta: 1,
        every: 6,
        text: ["corps", "full_service"],
      },
      { gauge: "money", delta: -1, every: 10, offset: 4 },
    ],
    repeal: {
      authority: 20,
      tell: ["army:-1", "army_line:-1"],
      effects: [inst("army", -1), armsBy(-3)],
    },
    talk: lawTalk("deu_army_bill", {
      who: either(person("deu_erzberger"), held("finance")),
      ask: "frank",
      push: "cold",
      tell: ["money:-1"],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["cunning"],
    }),
  }),
  // ww203 + check: the war's money. Helfferich paid the war with loans and
  // the hope of the enemy's indemnity; the Kriegssteuergesetz of 21 June 1916
  // taxed the war's gains; the left asked for a Reich tax on property.
  row({
    id: "deu_war_tax",
    chapter: "war_finance",
    opens: allOf(war, since("1916-01")),
    lean: 0,
    decree: false,
    cast: { finance: held("finance"), chancellor: held("chancellor") },
    draft: [
      draft("loans_only", 1, []),
      draft("war_profits", 0, []),
      draft("property_tax", -2, [], [inst("reichstag", 1)]),
    ],
    passed: [
      onText("deu_war_tax", "loans_only", opinion("business", 1)),
      onText("deu_war_tax", "war_profits", gauge("money", 1)),
      onText(
        "deu_war_tax",
        "property_tax",
        gauge("money", 2),
        opinion("business", -1),
      ),
    ],
    passedTell: [],
    term: [
      { gauge: "money", delta: -1, every: 10, text: ["loans_only"] },
      {
        gauge: "money",
        delta: 1,
        every: 10,
        text: ["war_profits", "property_tax"],
      },
    ],
    repeal: { authority: 15, tell: [], effects: [gauge("money", -1)] },
    talk: lawTalk("deu_war_tax", {
      who: either(person("deu_helfferich"), held("finance")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  // ww203 + check: the state of siege. The corps commanders ruled the home
  // districts under the Prussian siege law of 1851; the Reichstag won the
  // Schutzhaft law of 4 December 1916 (custody with an appeal, three months).
  row({
    id: "deu_siege",
    chapter: "siege",
    opens: allOf(war, since("1916-06")),
    lean: 0,
    decree: false,
    cast: home,
    draft: [
      draft("corps_commanders", 1, [], [inst("army", 1)]),
      draft("civil_review", 0, [], [inst("reichstag", 1), inst("army", -1)]),
    ],
    passed: [
      onText("deu_siege", "corps_commanders", gauge("order", 1)),
      onText("deu_siege", "civil_review", gauge("morale", 1)),
    ],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12, text: ["corps_commanders"] }],
    repeal: { authority: 15, tell: [], effects: [inst("army", -1)] },
    talk: lawTalk("deu_siege", {
      who: either(person("deu_haase"), held("interior")),
      ask: "frank",
      push: "threat",
      tell: [],
      price: [inst("army", -1)],
      wins: 1,
    }),
  }),
];
