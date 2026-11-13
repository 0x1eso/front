import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
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
/**
 * ww207: each text's axis push laid on the rows; a text the table leaves out
 * keeps none.
 */
export function withAxes(
  rows: readonly GwLawRow[],
  table: Readonly<Record<string, Readonly<Record<string, GwAxisPush>>>>,
): GwLawRow[] {
  return rows.map((r) => {
    const t = table[r.id];
    if (t === undefined) return r;
    return {
      ...r,
      draft: r.draft.map((d) =>
        t[d.id] === undefined ? d : { ...d, axes: t[d.id] },
      ),
    };
  });
}

/** ww207: peace is not(war): the crisis weeks, the peace years, neutrality, after the armistice. */
const notWar: GwLawRow["opens"] = { kind: "not", of: war };

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
const DEU_LAW_ROWS: readonly GwLawRow[] = [
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
    // ww207: a schools-and-church article, open in peace too (the law of 4
    // July 1872; its §2 went on 8 March 1904, the rest on 19 April 1917).
    chapter: "schools",
    opens: any(notWar, allOf(war, since("1916-06"))),
    peace: true,
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
    // ww207: in peace too, once the reform is asked for (Bethmann's 1910
    // bill died in the Prussian house).
    opens: allOf(
      any(notWar, allOf(war, since("1916-06"))),
      any(
        flag("f_franchise_word"),
        flag("f_franchise_draft"),
        memory("k_beth_reform"),
        chose("deu_k_easter_message", "equal_vote_word"),
        world({ is: "unrest", min: 1 }),
      ),
    ),
    peace: true,
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

  // ---- ww207: the peace articles (peace: true; open while not at war) ----
  // The army bill of 1913 was paid by the Wehrbeitrag (law of 3 July 1913: a
  // levy once, on fortunes over 10,000 marks at 0.15 to 1.5 percent, about
  // a billion marks) and a Reich tax on the growth of property; most of the
  // SPD group voted for the tax bills, against the army bill.
  row({
    id: "deu_defence_levy",
    chapter: "tax",
    opens: notWar,
    peace: true,
    lean: 0,
    decree: false,
    cast: { finance: held("finance"), chancellor: held("chancellor") },
    draft: [
      draft("property_levy", 0, [], [inst("reichstag", 1)]),
      draft("consumption", 1, []),
      draft("states_pay", 1, []),
    ],
    passed: [
      onText(
        "deu_defence_levy",
        "property_levy",
        gauge("money", 2),
        opinion("business", -1),
        opinion("workers", 1),
      ),
      onText(
        "deu_defence_levy",
        "consumption",
        gauge("money", 1),
        opinion("workers", -1),
      ),
      onText("deu_defence_levy", "states_pay", gauge("money", 1)),
    ],
    passedTell: [],
    term: [{ gauge: "money", delta: 1, every: 12, offset: 6 }],
    repeal: { authority: 15, tell: [], effects: [gauge("money", -1)] },
    talk: lawTalk("deu_defence_levy", {
      who: either(person("deu_erzberger"), held("finance")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("reichstag", 1)],
      wins: 1,
      tempers: ["cunning"],
    }),
  }),
  // The grain duties of the 1902 tariff (law of 25 December 1902; rye 5
  // marks), in force with the trade treaties of 1906. Their renewal was the
  // next great fight (the treaties' end, 1917: not checked).
  row({
    id: "deu_grain_tariff",
    chapter: "land",
    opens: notWar,
    peace: true,
    lean: 0,
    decree: false,
    cast: home,
    draft: [
      draft("keep_duties", 1, []),
      draft("raise_duties", 0, []),
      draft("cut_duties", -1, []),
    ],
    passed: [
      onText("deu_grain_tariff", "keep_duties", opinion("business", 1)),
      onText(
        "deu_grain_tariff",
        "raise_duties",
        opinion("workers", -1),
        gauge("money", 1),
      ),
      onText(
        "deu_grain_tariff",
        "cut_duties",
        opinion("workers", 1),
        gauge("bread", 1),
      ),
    ],
    passedTell: [],
    term: [
      { gauge: "bread", delta: -1, every: 12, text: ["raise_duties"] },
      { gauge: "bread", delta: 1, every: 12, text: ["cut_duties"] },
    ],
    repeal: { authority: 15, tell: [], effects: [opinion("business", -1)] },
    talk: lawTalk("deu_grain_tariff", {
      who: either(held("interior"), held("chancellor")),
      ask: "cold",
      push: "threat",
      tell: [],
      price: [opinion("workers", -1)],
      wins: 1,
    }),
  }),
  // The strike-breakers' law the right asked for: the Kartell der schaffenden
  // Stände (industry, the small masters and the Agrarian League, Leipzig,
  // 24 August 1913) wanted pickets banned; the Reichstag's majority refused
  // it up to 1914. Labour chambers were the other side's answer (a bill went
  // through the Reichstag in December 1910 and no further: not checked).
  row({
    id: "deu_pickets",
    chapter: "social",
    opens: notWar,
    peace: true,
    lean: -1,
    decree: false,
    cast: home,
    draft: [
      draft("ban_pickets", -1, [], [inst("army", 1)]),
      draft("joint_chambers", 1, []),
      draft("labour_chambers", 0, [], [inst("reichstag", 1)]),
    ],
    passed: [
      onText(
        "deu_pickets",
        "ban_pickets",
        gauge("order", 1),
        opinion("workers", -2),
        opinion("business", 1),
      ),
      onText("deu_pickets", "joint_chambers", opinion("workers", 1)),
      onText(
        "deu_pickets",
        "labour_chambers",
        opinion("workers", 1),
        opinion("business", -1),
      ),
    ],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 12, text: ["joint_chambers"] },
      { gauge: "morale", delta: -1, every: 12, text: ["ban_pickets"] },
    ],
    repeal: { authority: 15, tell: [], effects: [opinion("workers", -1)] },
    talk: lawTalk("deu_pickets", {
      who: either(person("deu_ebert"), held("interior")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [opinion("business", -1)],
      wins: 1,
    }),
  }),
  // Zabern: a lieutenant's insults, then the garrison's arrests (November
  // 1913); the Reichstag's vote of no confidence, 293 to 54 (4 December
  // 1913), which Bethmann ignored. A new order on the army's use of arms
  // followed in March 1914 (the date not checked).
  row({
    id: "deu_zabern",
    chapter: "local",
    opens: notWar,
    peace: true,
    lean: -1,
    decree: false,
    cast: { chancellor: held("chancellor"), war: held("war") },
    draft: [
      draft("civil_request", 1, [], [inst("army", -1)]),
      draft("crown_command", 0, [], [inst("army", 1), inst("reichstag", -1)]),
      draft(
        "reichsland_rights",
        -1,
        [],
        [inst("army", -1), inst("reichstag", 1)],
      ),
    ],
    passed: [
      onText("deu_zabern", "civil_request", gauge("order", 1)),
      onText("deu_zabern", "crown_command", opinion("workers", -1)),
      onText("deu_zabern", "reichsland_rights", {
        kind: "pressure",
        topic: "alsace",
        delta: -1,
      }),
    ],
    passedTell: [],
    term: [],
    repeal: { authority: 20, tell: [], effects: [inst("army", 1)] },
    talk: lawTalk("deu_zabern", {
      who: either(held("war"), held("chancellor")),
      ask: "cold",
      push: "threat",
      tell: [],
      price: [inst("army", 1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
];

/**
 * ww207: what each text moves when it passes, in notches (one a bill): rule
 * 왕권 -/의회 +, class 재산 -/노동 +, force 무력 -/협조 +.
 */
const DEU_LAW_AXES: Readonly<Record<string, Record<string, GwAxisPush>>> = {
  deu_censor: {
    generals_keep: { rule: -1, force: -1 },
    one_office: { rule: -1 },
    reichstag_reads: { rule: 1 },
  },
  deu_bread_cards: {
    city_cards: { class: 1 },
    reich_grain: { class: 1, rule: -1 },
    war_bread: { force: -1 },
  },
  deu_food_office: {
    food_dictator: { class: 1 },
    states_keep: { class: -1 },
    army_seat: { rule: -1, force: -1 },
  },
  deu_strike_ban: {
    corps_commanders: { class: -1, rule: -1 },
    arbitration: { class: 1 },
    courts_only: { class: -1 },
  },
  deu_aux: {
    army_text: { class: -1, force: -1 },
    unions_text: { class: 1 },
  },
  deu_unions: {
    youth_clause: { class: 1 },
    paragraph_153: { class: 1, rule: 1 },
    words_only: { class: 1 },
  },
  deu_jesuits: {
    whole_law: { force: 1, rule: 1 },
    houses_only: { force: 1 },
  },
  deu_three_class: {
    plural_vote: { rule: 1 },
    equal_vote: { rule: 1, class: 1 },
    after_the_peace: { rule: -1 },
  },
  deu_alsace: {
    federal_state: { rule: 1, force: 1 },
    share_out: { force: -1 },
    to_prussia: { rule: -1, force: -1 },
  },
  deu_army_bill: {
    cadres: { force: -1 },
    corps: { force: -1, class: -1 },
    full_service: { force: -1, rule: -1 },
  },
  deu_war_tax: {
    loans_only: { class: -1 },
    war_profits: { class: 1 },
    property_tax: { class: 1, rule: 1 },
  },
  deu_siege: {
    corps_commanders: { rule: -1 },
    civil_review: { rule: 1 },
  },
  deu_defence_levy: {
    property_levy: { class: 1 },
    consumption: { class: -1 },
    states_pay: { rule: -1 },
  },
  deu_grain_tariff: {
    keep_duties: { class: -1 },
    raise_duties: { class: -1, force: -1 },
    cut_duties: { class: 1 },
  },
  deu_pickets: {
    ban_pickets: { class: -1, rule: -1 },
    joint_chambers: { class: 1 },
    labour_chambers: { class: 1, rule: 1 },
  },
  deu_zabern: {
    civil_request: { rule: 1 },
    crown_command: { rule: -1, force: -1 },
    reichsland_rights: { rule: 1, force: 1 },
  },
};

/** Germany's bills, each text with its axis push. */
export const DEU_LAWS: readonly GwLawRow[] = withAxes(
  DEU_LAW_ROWS,
  DEU_LAW_AXES,
);
