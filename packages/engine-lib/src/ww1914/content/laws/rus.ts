import type { GwAxisPush } from "@openfront/engine-api/ww1914/GwSociety";
import { any, chose, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { doWorld, world } from "@openfront/engine-api/ww1914/WorldDsl";
import type { GwLawDraft, GwLawRow } from "../../LawRows";
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
const RUS_WAR_LAWS: readonly GwLawRow[] = [
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

// ---- ww207 (W-RUS): the society's pushes, the peace bills, the franchise ----

/**
 * Axis notches each text moves when it passes (rule: 전제 -1 / 의회 +1;
 * class: 지주·자본 -1 / 농민·노동 +1; nations: 하나의 러시아 -1 / 민족들 +1).
 * Every bill text has one. The house laws' are in house/rus.ts.
 */
export const RUS_LAW_AXES: Readonly<
  Record<string, Readonly<Record<string, GwAxisPush>>>
> = {
  rus_press: {
    stavka_reads: { rule: -1, nations: -1 },
    war_news_only: { rule: -1 },
    duma_speeches_free: { rule: 1 },
  },
  rus_dry: {
    for_the_war: { nations: -1 },
    for_ever: { rule: -1, nations: -1 },
    wine_and_beer: { class: -1 },
  },
  rus_ratniki: {
    second_class: { rule: -1 },
    not_only_sons: { rule: 1 },
    land_after: { class: 1 },
  },
  rus_councils: {
    four_councils: { rule: 1, class: -1 },
    defence_alone: { rule: -1 },
    with_zemgor: { rule: 1 },
  },
  rus_factories: {
    under_arms: { rule: -1, class: -1 },
    workers_group: { class: 1 },
    strike_courts: { class: -1 },
  },
  rus_grain: {
    fixed_price: { class: 1 },
    quota_levy: { rule: -1 },
    trains_first: { class: -1 },
  },
  rus_poland: {
    autonomy_word: { nations: 1 },
    charter: { rule: 1, nations: 1 },
    crown_of_poland: { rule: -1, nations: 1 },
  },
  rus_finland: {
    stop_the_programme: { nations: 1 },
    diet_recalled: { rule: 1, nations: 1 },
    quiet_governor: { nations: -1 },
  },
  rus_pale: {
    towns_circular: { rule: -1, nations: 1 },
    whole_pale: { rule: 1, nations: 1 },
    refugees_only: { nations: 1 },
  },
  rus_great_programme: {
    whole_by_taxes: { nations: -1 },
    whole_by_loans: { class: -1, nations: -1 },
    guns_first: { rule: -1 },
  },
  rus_war_tax: {
    loans_only: { class: -1 },
    income_tax: { class: 1 },
    war_profits: { rule: 1, class: 1 },
  },
  rus_army_zone: {
    stavka_rules: { rule: -1 },
    civil_governors: { rule: 1 },
    no_expulsions: { nations: 1 },
  },
};

/** Lays the axis table over rows written before ww207. */
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

/** A text with its push; no tell before the pick. */
const text = (
  id: string,
  support: number,
  axes: GwAxisPush,
  effects: GwLawDraft["effects"] = [],
  more: Partial<GwLawDraft> = {},
): GwLawDraft => ({ ...draft(id, support, [], [...effects]), axes, ...more });

/** Not at war: the crisis weeks, the peace years, after the armistice. */
const notWar = not(war);
/** Whoever reigns or governs: an exclusive law opens once its node is open. */
const anyForm = since("1914-01");

export const RUS_PEACE_LAWS: readonly GwLawRow[] = [
  // + check: Stolypin's land laws: the ukaz of 9 Nov 1906, the law of 14 June
  // 1910 (leaving the commune), the land-settlement law of 29 May 1911. The
  // Peasant Land Bank bought estates for peasants; the Kadets' and the
  // Trudoviks' programmes took the estates for the tillers, with or without
  // payment.
  row({
    id: "rus_land",
    chapter: "land",
    peace: true,
    opens: allOf(crowned, notWar),
    lean: 0,
    decree: true,
    cast: { agri: held("agriculture") },
    draft: [
      text("separation", 1, { class: -1 }, [gauge("bread", 1)]),
      text("land_bank", 1, { class: 1 }, [gauge("money", -1)]),
      text("alienation", -1, { rule: 1, class: 1 }, [inst("court", -1)]),
    ],
    passed: [gauge("bread", 1)],
    passedTell: [],
    term: [{ gauge: "bread", delta: 1, every: 12, offset: 3 }],
    flag: "f_law_rus_land",
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("rus_land", {
      who: either(person("rus_krivoshein"), held("agriculture")),
      ask: "warm",
      push: "frank",
      tell: [],
      price: [inst("duma", 1)],
      wins: 1,
    }),
  }),
  // + check: the law of 3 May 1908 (O.S.): free primary school for every
  // child within ten years, by 1917, through state money to the zemstvos.
  // The Holy Synod's parish schools ran beside them; the borderlands asked
  // for schooling in their own tongue.
  row({
    id: "rus_schools",
    chapter: "schools",
    peace: true,
    opens: allOf(crowned, notWar),
    lean: 1,
    decree: true,
    cast: { interior: held("interior"), fin: held("finance") },
    draft: [
      text("zemstvo_schools", 1, { rule: 1 }),
      text("parish_schools", 1, { nations: -1 }, [inst("court", 1)]),
      text("mother_tongue", -1, { nations: 1 }),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [{ gauge: "money", delta: -1, every: 12, offset: 5 }],
    flag: "f_law_rus_schools",
    repeal: { authority: 15, tell: [], effects: [gauge("morale", -1)] },
    talk: lawTalk("rus_schools", {
      who: person("rus_rodzianko"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("duma", 1)],
      wins: 1,
    }),
  }),
  // + check: the insurance laws of 23 June 1912 (O.S.): sickness and accident
  // funds for the workers of the large factories, mines and railways, paid
  // by workers and owners, with workers sitting on the boards.
  row({
    id: "rus_insurance",
    chapter: "social",
    peace: true,
    opens: allOf(crowned, notWar),
    lean: 0,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("sick_funds", 1, { class: 1 }),
      text("workers_boards", 0, { rule: 1, class: 1 }),
      text("owners_run", 1, { class: -1 }),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [
      { gauge: "order", delta: 1, every: 12, offset: 2 },
      { gauge: "money", delta: -1, every: 14, offset: 7 },
    ],
    flag: "f_law_rus_insurance",
    repeal: { authority: 15, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk("rus_insurance", {
      who: either(person("rus_chkheidze"), held("interior")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
    }),
  }),
  // Peace-time taxes: an income tax had waited in the Duma since 1907 (it
  // came only in the war, signed 6 April 1916); the treasury lived on the
  // vodka monopoly and the excises.
  row({
    id: "rus_tax_reform",
    chapter: "tax",
    peace: true,
    opens: allOf(crowned, notWar),
    lean: 0,
    decree: true,
    cast: { fin: held("finance") },
    draft: [
      text("income_tax", 0, { class: 1 }, [inst("court", -1)]),
      text("excise_up", 1, { class: -1 }, [gauge("order", -1)]),
      text("estates_tax", -1, { rule: 1, class: 1 }, [inst("court", -1)]),
    ],
    passed: [gauge("money", 1)],
    passedTell: [],
    term: [{ gauge: "money", delta: 1, every: 10, offset: 4 }],
    flag: "f_law_rus_tax",
    repeal: { authority: 10, tell: [], effects: [gauge("money", -1)] },
    talk: lawTalk("rus_tax_reform", {
      who: held("finance"),
      ask: "cold",
      push: "frank",
      tell: [],
      price: [gauge("money", -1)],
      wins: 1,
    }),
  }),
  // The electoral law of 3 June 1907 weighted the curiae for the landowners;
  // the Kadets and the left asked for the "four-tail" vote (universal, equal,
  // direct, secret). Each text sets the Duma's franchise for the next
  // election. Open in war and peace.
  row({
    id: "rus_franchise",
    chapter: "franchise",
    opens: crowned,
    lean: -1,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("four_tails", -1, { rule: 1, class: 1 }, [inst("court", -1)], {
        franchise: { chamber: "duma", to: "equal" },
      }),
      text("wider_curiae", 0, { rule: 1 }, [], {
        franchise: { chamber: "duma", to: "wide" },
      }),
      text("estates_only", 0, { rule: -1, class: -1 }, [inst("duma", -1)], {
        franchise: { chamber: "duma", to: "estates" },
      }),
    ],
    passed: [],
    passedTell: [],
    term: [],
    flag: "f_law_rus_franchise",
    repeal: { authority: 20, tell: [], effects: [inst("duma", -1)] },
    talk: lawTalk("rus_franchise", {
      who: person("rus_milyukov"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  // The Fourth Duma's five years end in the autumn of 1917 (elected 1912,
  // opened 15 November 1912 O.S.). No law put its election off in the real
  // war; here the war can.
  row({
    id: "rus_duma_postpone",
    chapter: "franchise",
    opens: allOf(war, crowned, since("1916-06")),
    lean: 0,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("one_year", 1, { rule: -1 }),
      text("till_peace", 0, { rule: -1, nations: -1 }, [inst("duma", -1)]),
      text("duma_consents", 1, { rule: 1 }),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [],
    flag: "f_law_rus_postpone",
    repeal: { authority: 10, tell: [], effects: [] },
    talk: lawTalk("rus_duma_postpone", {
      who: person("rus_rodzianko"),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("duma", 1)],
      wins: 1,
    }),
  }),
  // ---- the factions' exclusive laws (a node of their tree opens them) ----
  // The Octobrists: the freedoms of the 17 October 1905 manifesto in law.
  row({
    id: "rus_x_liberties",
    chapter: "franchise",
    exclusive: { faction: "rus_octob", node: "rus_octob_law" },
    opens: anyForm,
    lean: 0,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("all_freedoms", 0, { rule: 1 }, [inst("court", -1)]),
      text("freedoms_in_order", 1, { rule: 1, class: -1 }),
    ],
    passed: [inst("duma", 1), gauge("morale", 1)],
    passedTell: [],
    term: [{ gauge: "morale", delta: 1, every: 14, offset: 4 }],
    flag: "f_law_rus_liberties",
    repeal: { authority: 20, tell: [], effects: [inst("duma", -2)] },
    talk: lawTalk("rus_x_liberties", {
      who: person("rus_guchkov"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
    }),
  }),
  // The Kadets: ministers answer to the Duma, not the Tsar.
  row({
    id: "rus_x_ministry",
    chapter: "franchise",
    exclusive: { faction: "rus_kadets", node: "rus_kadets_law" },
    opens: anyForm,
    lean: -1,
    decree: true,
    cast: { chancellor: held("chancellor") },
    draft: [
      text("responsible", -1, { rule: 1 }, [
        inst("court", -2),
        inst("duma", 1),
      ]),
      text("public_confidence", 0, { rule: 1 }, [inst("court", -1)]),
    ],
    passed: [inst("duma", 1)],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 12, offset: 6 }],
    flag: "f_law_rus_ministry",
    repeal: { authority: 25, tell: [], effects: [inst("duma", -2)] },
    talk: lawTalk("rus_x_ministry", {
      who: person("rus_milyukov"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  // The Rights: the Duma back to an advisory body, as they asked since 1907.
  row({
    id: "rus_x_advisory",
    chapter: "franchise",
    exclusive: { faction: "rus_rights", node: "rus_rights_law" },
    opens: crowned,
    lean: -1,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("advisory_duma", 0, { rule: -1 }, [
        inst("duma", -2),
        inst("court", 1),
      ]),
      text("estates_duma", 0, { rule: -1, class: -1 }, [inst("duma", -1)]),
    ],
    passed: [inst("court", 1)],
    passedTell: [],
    term: [{ gauge: "order", delta: 1, every: 10, offset: 3 }],
    flag: "f_law_rus_advisory",
    repeal: { authority: 15, tell: [], effects: [inst("court", -1)] },
    talk: lawTalk("rus_x_advisory", {
      who: either(person("rus_khvostov"), person("rus_durnovo")),
      ask: "warm",
      push: "frank",
      tell: [],
      price: [inst("duma", -1)],
      wins: 1,
    }),
  }),
  // The Trudoviks: the land to those who work it.
  row({
    id: "rus_x_land",
    chapter: "land",
    exclusive: { faction: "rus_trud", node: "rus_trud_law" },
    opens: anyForm,
    lean: -1,
    decree: true,
    cast: { agri: held("agriculture") },
    draft: [
      text("to_the_tillers", -1, { class: 1 }, [inst("court", -2)]),
      text("with_payment", 0, { class: 1 }, [gauge("money", -1)]),
    ],
    passed: [gauge("morale", 1), gauge("order", 1)],
    passedTell: [],
    term: [{ gauge: "bread", delta: -1, every: 12, offset: 2 }],
    flag: "f_law_rus_land_tillers",
    repeal: { authority: 25, tell: [], effects: [gauge("order", -2)] },
    talk: lawTalk("rus_x_land", {
      who: person("rus_kerensky"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
      tempers: ["anxious"],
    }),
  }),
  // The Bolsheviks: the eight-hour day and the factory committees.
  row({
    id: "rus_x_eight_hours",
    chapter: "labour",
    exclusive: { faction: "rus_bolsh", node: "rus_bolsh_law" },
    opens: anyForm,
    lean: -2,
    decree: true,
    cast: { interior: held("interior") },
    draft: [
      text("eight_hours", -1, { class: 1 }, [gauge("shells", -1)]),
      text("workers_control", -2, { class: 1, nations: 1 }, [
        gauge("shells", -1),
      ]),
    ],
    passed: [gauge("order", 1)],
    passedTell: [],
    term: [{ gauge: "shells", delta: -1, every: 10, offset: 2 }],
    flag: "f_law_rus_eight_hours",
    repeal: { authority: 20, tell: [], effects: [gauge("order", -2)] },
    talk: lawTalk("rus_x_eight_hours", {
      who: either(person("rus_lenin"), held("interior")),
      ask: "cold",
      push: "cold",
      tell: [],
      price: [inst("court", -1)],
      wins: 1,
    }),
  }),
];

/** Russia's bills: the war rows with their pushes, and the ww207 rows. */
export const RUS_LAWS: readonly GwLawRow[] = [
  ...withAxes(RUS_WAR_LAWS, RUS_LAW_AXES),
  ...RUS_PEACE_LAWS,
];
