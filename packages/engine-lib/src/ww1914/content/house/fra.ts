// France's house (ww158 shapes, HouseRows.ts; words in ./kit.ts). The chambers,
// whip and way round are FRA_HOUSE in ./houses.ts; the house comes into play
// the moment FRA_FACTIONS has rows. Text in resources/ww1914/ko/FRA.house.json.
// Lane W6 (ww166-format.md, plan ww166-plan-fra-scenes.md §11.2).
//
// The Chamber of May 1914 (en.wikipedia 1914 French legislative election):
// Radicals 140 (Caillaux), SFIO 103 (Jaurès), Republican Federation 96
// (Ribot), Independent Radicals 96 (Clemenceau), ALP and the right 73,
// Democratic Republican Alliance 57, Republican-Socialists 27. Seats here are
// weights 0..4, not those numbers. Clemenceau chaired the Senate's army
// commission in 1915 and from 1916 to November 1917 (senat.fr list of its
// presidents) and accused Malvy in the Senate on 22 July 1917; Malvy went on
// 31 August 1917 and the Senate as High Court gave him five years'
// banishment on 6 August 1918 (fr.wikipedia Louis Malvy). Merrheim of the
// metalworkers went to Zimmerwald, 5-8 September 1915 (en.wikipedia).
//
// The bills on W5's laws (content/laws/fra.ts) are kept here and come into
// play only once those laws exist (`known`): the rows never name a law that
// isn't there.
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
  GwWeakRow,
} from "../../HouseRows";
import type { GwLawRow } from "../../LawRows";
import { FRA_LAWS } from "../laws/fra";
import {
  draft,
  either,
  gauge,
  held,
  inst,
  lawTalk,
  office,
  person,
  since,
  war,
} from "../laws/kit";
import {
  answerAsk,
  aroundUsed,
  beatPlot,
  cool,
  coolPlot,
  heat,
  heatPlot,
  isLaw,
  leaderOf,
  low,
  plotConfirmed,
  plotHot,
  temper,
  warAge,
} from "./kit";

const NATION: GwScene["nation"] = ["FRA"];
const tiger = flag("f_pm_clemenceau");
const union = world({ is: "regime", tag: "FRA", of: ["fra_union"] });
const holder = (o: "chief_of_staff" | "interior", p: string): GwCond => ({
  kind: "holder",
  office: o,
  person: p,
});
const bloc = (b: GwFactionRow["bloc"]): GwCond => ({
  kind: "bloc",
  bloc: b,
  max: -3,
});
const casualties = (min: number): GwCond => world({ is: "casualties", min });
const score = (max: number): GwCond => world({ is: "score", max });
const unrest = (min: number): GwCond => world({ is: "unrest", min });
const tsar = world({ is: "regime", tag: "RUS", of: ["tsar"] });
const russiaFell = world({
  is: "regime",
  tag: "RUS",
  of: ["provisional", "rep", "soviet"],
});
/** The bill isn't in the house or in force: a promise about it can still be kept. */
const toCome = (law: string): GwCond =>
  not(
    world({ is: "law", id: law, of: ["draft", "persuade", "vote", "force"] }),
  );

// ---- The bills: W5's nine and the factions' three ----

const W5 = {
  siege: "fra_law_siege",
  threeYears: "fra_law_three_years",
  incomeTax: "fra_law_income_tax",
  dalbiez: "fra_law_dalbiez",
  warProfits: "fra_law_war_profits",
  rents: "fra_law_rents",
  allowances: "fra_law_allowances",
  censorship: "fra_law_censorship",
  supply: "fra_law_supply_decrees",
} as const;
const PROPORTIONAL = "fra_law_proportional";
const ARMY_COMMISSION = "fra_law_army_commission";
const AMNESTY = "fra_law_amnesty";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "FRA" });

/** The factions' own bills: rows like content/laws/fra.ts, with no tells. */
export const FRA_HOUSE_LAWS: readonly GwLawRow[] = [
  // Proportional representation, Briand's cause before the war (memory).
  row({
    id: PROPORTIONAL,
    opens: since("1915-06"),
    lean: -1,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      draft("list_vote", 0, [], [inst("chamber", 1)]),
      draft("majority_bonus", 1, [], []),
      draft("after_war", 1, [], [gauge("order", 1)]),
    ],
    passed: [inst("chamber", 1), gauge("order", -1)],
    passedTell: [],
    term: [],
    repeal: { authority: 10, tell: [], effects: [inst("chamber", -1)] },
    talk: lawTalk(PROPORTIONAL, {
      who: either(leaderOf("fra_radicals"), office("interior")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("countersign", -1)],
      wins: 1,
      tempers: ["cunning"],
    }),
  }),
  // The Senate's army commission wants to see the front for itself, not the
  // papers the GQG sends.
  row({
    id: ARMY_COMMISSION,
    opens: all(war, warAge(6)),
    lean: 0,
    decree: false,
    cast: { war: held("war") },
    draft: [
      draft("visit_front", -1, [], [inst("army", -1)]),
      draft("papers_only", 1, [], []),
      draft("with_gqg_leave", 0, [], [inst("army", 1)]),
    ],
    passed: [inst("senate", 1), inst("army", -1)],
    passedTell: [],
    term: [],
    repeal: {
      authority: 15,
      tell: [],
      effects: [inst("senate", -1), inst("army", 1)],
    },
    talk: lawTalk(ARMY_COMMISSION, {
      who: held("chief_of_staff"),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("senate", -1)],
      wins: 1,
      tempers: ["arrogant"],
    }),
  }),
  // An amnesty for what the state of siege punished: strikes, articles, words.
  row({
    id: AMNESTY,
    opens: all(war, warAge(24)),
    lean: -1,
    decree: false,
    cast: { int: held("interior") },
    draft: [
      draft("strikers", -1, [], [gauge("order", 1), inst("army", -1)]),
      draft("press_only", 1, [], [{ kind: "censor", delta: -1 }]),
      draft("after_victory", 0, [], []),
    ],
    passed: [gauge("order", 1), inst("army", -1)],
    passedTell: [],
    term: [],
    repeal: { authority: 10, tell: [], effects: [gauge("order", -1)] },
    talk: lawTalk(AMNESTY, {
      who: either(person("fra_ribot"), leaderOf("fra_fed_rep")),
      ask: "warm",
      push: "cold",
      tell: [],
      price: [inst("chamber", -1)],
      wins: 1,
      tempers: ["weary"],
    }),
  }),
];

const LAW_IDS = new Set([
  ...FRA_LAWS.map((l) => l.id),
  ...FRA_HOUSE_LAWS.map((l) => l.id),
]);
/** Only the laws that exist: W5's come in with their file. */
const known = (...laws: string[]): string[] =>
  laws.filter((l) => LAW_IDS.has(l));

/** Each faction's side, in the order of FRA_FACTIONS' seated rows. */
const sides = (
  radicals: -1 | 0 | 1,
  caillaux: -1 | 0 | 1,
  repsoc: -1 | 0 | 1,
  sfio: -1 | 0 | 1,
  minority: -1 | 0 | 1,
  leftRep: -1 | 0 | 1,
  fedRep: -1 | 0 | 1,
  catholics: -1 | 0 | 1,
  tigerSide: -1 | 0 | 1,
): GwBillRow["stance"] => ({
  fra_radicals: radicals,
  fra_caillaux: caillaux,
  fra_repsoc: repsoc,
  fra_sfio: sfio,
  fra_minority: minority,
  fra_left_rep: leftRep,
  fra_fed_rep: fedRep,
  fra_catholics: catholics,
  fra_tiger: tigerSide,
});

const ALL_BILLS: readonly GwBillRow[] = [
  { law: W5.siege, stance: sides(1, 0, 1, 0, -1, 1, 1, 1, 1) },
  { law: W5.threeYears, stance: sides(0, -1, 0, -1, -1, 1, 1, 1, 1) },
  {
    law: W5.incomeTax,
    money: true,
    stance: sides(1, 1, 1, 1, 1, 0, -1, -1, 0),
  },
  { law: W5.dalbiez, stance: sides(1, 0, 1, 1, 0, 1, 0, 0, 1) },
  {
    law: W5.warProfits,
    money: true,
    stance: sides(1, 1, 1, 1, 1, 0, -1, 0, 0),
  },
  { law: W5.rents, around: true, stance: sides(1, 1, 1, 1, 1, 0, -1, 0, 0) },
  {
    law: W5.allowances,
    money: true,
    stance: sides(1, 1, 1, 1, 1, 1, 0, 1, 0),
  },
  {
    law: W5.censorship,
    around: true,
    stance: sides(0, -1, 1, -1, -1, 1, 1, 1, -1),
  },
  { law: W5.supply, around: true, stance: sides(1, 0, 1, 1, 0, 0, -1, 0, 1) },
  {
    law: PROPORTIONAL,
    by: "fra_repsoc",
    stance: sides(-1, -1, 1, 1, 1, 1, 1, 1, -1),
    texts: {
      majority_bonus: { fra_radicals: 0, fra_tiger: 0 },
      after_war: { fra_radicals: 0, fra_sfio: 0, fra_minority: 0 },
    },
  },
  {
    law: ARMY_COMMISSION,
    by: "fra_tiger",
    stance: sides(1, 0, 0, 1, 1, 0, -1, -1, 1),
    texts: {
      visit_front: { fra_repsoc: -1, fra_left_rep: -1 },
      with_gqg_leave: {
        fra_repsoc: 1,
        fra_fed_rep: 0,
        fra_catholics: 0,
        fra_tiger: 0,
      },
    },
  },
  {
    law: AMNESTY,
    by: "fra_minority",
    stance: sides(0, 1, 0, 1, 1, -1, -1, -1, -1),
    texts: {
      press_only: { fra_radicals: 1, fra_left_rep: 0, fra_tiger: 0 },
      after_victory: {
        fra_radicals: 1,
        fra_fed_rep: 0,
        fra_catholics: 0,
        fra_minority: -1,
      },
    },
  },
];

/** Stances on the bills, by law id: W5's (once written) and the factions' own. */
export const FRA_BILLS: readonly GwBillRow[] = ALL_BILLS.filter((b) =>
  LAW_IDS.has(b.law),
);

// ---- The factions ----

export const FRA_FACTIONS: readonly GwFactionRow[] = [
  {
    id: "fra_radicals",
    tag: "FRA",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { chambre: 3, senat: 3 },
    leaders: [
      { person: "fra_malvy", when: holder("interior", "fra_malvy") },
      { person: "fra_doumergue" },
      { person: "fra_bourgeois" },
    ],
    radical: "fra_caillaux",
    camps: ["radical"],
    grows: [
      {
        when: all(warAge(24), casualties(600)),
        by: -1,
        every: 9,
        key: "long_lists",
      },
    ],
    feeds: [
      { when: bloc("parliament"), key: "chamber_cold" },
      { when: aroundUsed(2), key: "decrees" },
      { when: tiger, key: "tiger_in", by: 2 },
    ],
    cools: [
      { when: isLaw(W5.incomeTax), key: "income_tax_law" },
      { when: union, key: "union" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_rad_2" },
      { at: 6, scene: "fra_hs_rad_3" },
    ],
    bills: known(W5.incomeTax, W5.dalbiez),
    wants: [
      {
        id: "income_tax_next",
        when: toCome(W5.incomeTax),
        keep: isLaw(W5.incomeTax),
        chapters: 10,
      },
      {
        id: "prefects",
        keep: war,
        chapters: 2,
        effects: [heat("fra_fed_rep", 1), heat("fra_catholics", 1)],
      },
    ],
    amends: { [PROPORTIONAL]: "after_war", [AMNESTY]: "press_only" },
    splits: {
      when: all(
        warAge(18),
        any(temper("fra_radicals", 2), score(-15), casualties(900)),
      ),
      into: "fra_caillaux",
      takes: 1,
      scene: "fra_hs_caillaux",
    },
  },
  {
    id: "fra_caillaux",
    tag: "FRA",
    bloc: "parliament",
    start: "out",
    strength: 1,
    seats: { chambre: 1 },
    leaders: [{ person: "fra_caillaux" }],
    camps: ["radical"],
    grows: [
      { when: score(-20), by: 1, every: 6, key: "war_bad" },
      { when: casualties(1200), by: 1, every: 9, key: "long_lists" },
      { when: tiger, by: -1, every: 6, key: "tiger_in" },
    ],
    feeds: [
      { when: tiger, key: "tiger_in", by: 2 },
      { when: isLaw(W5.censorship), key: "censor_law" },
    ],
    cools: [
      { when: isLaw(W5.incomeTax), key: "income_tax_law" },
      { when: isLaw(AMNESTY), key: "amnesty_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_cai_2" },
      { at: 6, scene: "fra_hs_cai_3" },
    ],
    bills: known(W5.incomeTax, AMNESTY),
    wants: [
      {
        id: "income_tax_next",
        when: toCome(W5.incomeTax),
        keep: isLaw(W5.incomeTax),
        chapters: 8,
      },
      {
        id: "quiet_police",
        keep: war,
        chapters: 2,
        effects: [heat("fra_tiger", 2), heat("fra_af", 1)],
      },
    ],
    amends: { [AMNESTY]: "strikers", [PROPORTIONAL]: "after_war" },
  },
  {
    id: "fra_repsoc",
    tag: "FRA",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { chambre: 1 },
    leaders: [
      { person: "fra_briand" },
      { person: "fra_painleve" },
      { person: "fra_viviani" },
    ],
    camps: ["radical"],
    grows: [
      {
        when: any(flag("f_pm_briand"), flag("f_pm_painleve")),
        by: 1,
        every: 8,
        key: "in_the_chair",
      },
    ],
    feeds: [
      { when: bloc("parliament"), key: "chamber_cold" },
      { when: all(warAge(20), toCome(PROPORTIONAL)), key: "no_reform" },
    ],
    cools: [
      { when: isLaw(PROPORTIONAL), key: "reform_law" },
      { when: any(flag("f_pm_briand"), flag("f_pm_painleve")), key: "chair" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_rs_2" },
      { at: 6, scene: "fra_hs_rs_3" },
    ],
    bills: known(PROPORTIONAL),
    wants: [
      {
        id: "proportional_next",
        when: toCome(PROPORTIONAL),
        keep: isLaw(PROPORTIONAL),
        chapters: 10,
      },
      {
        id: "portfolio",
        keep: war,
        chapters: 2,
        effects: [heat("fra_radicals", 1)],
      },
    ],
    amends: {
      [PROPORTIONAL]: "majority_bonus",
      [ARMY_COMMISSION]: "with_gqg_leave",
    },
  },
  {
    id: "fra_sfio",
    tag: "FRA",
    bloc: "workers",
    start: "in",
    strength: 3,
    seats: { chambre: 2 },
    leaders: [
      { person: "fra_jaures" },
      { person: "fra_renaudel" },
      { person: "fra_sembat" },
      { person: "fra_guesde" },
    ],
    radical: "fra_longuet",
    camps: ["socialist"],
    grows: [
      { when: low("bread", 1), by: 1, every: 6, key: "bread_queues" },
      { when: unrest(1), by: 1, every: 6, key: "factory_anger" },
      { when: tiger, by: -1, every: 8, key: "tiger_in" },
    ],
    feeds: [
      { when: bloc("workers"), key: "unions_turned" },
      { when: aroundUsed(2), key: "decrees" },
      { when: isLaw(W5.censorship), key: "censor_law" },
      { when: tiger, key: "tiger_in", by: 2 },
    ],
    cools: [
      { when: union, key: "union" },
      { when: isLaw(W5.allowances), key: "allowances_law" },
      { when: isLaw(W5.rents), key: "rents_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_sfio_2" },
      { at: 6, scene: "fra_hs_sfio_3" },
    ],
    bills: known(W5.warProfits, W5.rents),
    wants: [
      {
        id: "rents_next",
        when: toCome(W5.rents),
        keep: isLaw(W5.rents),
        chapters: 8,
      },
      {
        id: "allowances_next",
        when: toCome(W5.allowances),
        keep: isLaw(W5.allowances),
        chapters: 8,
      },
      {
        id: "civil_courts",
        keep: war,
        chapters: 2,
        effects: [inst("army", -1)],
      },
    ],
    amends: { [AMNESTY]: "strikers", [PROPORTIONAL]: "list_vote" },
    splits: {
      when: all(
        since("1915-06"),
        any(temper("fra_sfio", 2), casualties(500), low("bread", 1)),
      ),
      into: "fra_minority",
      takes: 1,
      scene: "fra_hs_minority",
    },
  },
  {
    id: "fra_minority",
    tag: "FRA",
    bloc: "workers",
    start: "out",
    strength: 1,
    seats: { chambre: 1 },
    leaders: [{ person: "fra_longuet" }],
    radical: "fra_i_merrheim",
    camps: ["socialist"],
    grows: [
      { when: low("bread", 1), by: 1, every: 6, key: "bread_queues" },
      { when: russiaFell, by: 1, every: 6, key: "russia_spring" },
      { when: casualties(1000), by: 1, every: 9, key: "long_lists" },
    ],
    feeds: [
      { when: isLaw(W5.censorship), key: "censor_law" },
      { when: tiger, key: "tiger_in", by: 2 },
      { when: unrest(2), key: "streets" },
    ],
    cools: [
      { when: isLaw(AMNESTY), key: "amnesty_law" },
      { when: isLaw(W5.warProfits), key: "profits_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_min_2" },
      { at: 6, scene: "fra_hs_min_3" },
    ],
    bills: known(AMNESTY),
    wants: [
      {
        id: "amnesty_next",
        when: toCome(AMNESTY),
        keep: isLaw(AMNESTY),
        chapters: 8,
      },
      {
        id: "passports",
        keep: war,
        chapters: 2,
        effects: [heat("fra_af", 1), heat("fra_tiger", 1)],
      },
    ],
    amends: { [AMNESTY]: "strikers", [ARMY_COMMISSION]: "visit_front" },
  },
  {
    id: "fra_left_rep",
    tag: "FRA",
    bloc: "business",
    start: "in",
    strength: 2,
    seats: { chambre: 1, senat: 2 },
    leaders: [{ person: "fra_barthou" }, { person: "fra_ferry" }],
    camps: ["centre"],
    grows: [
      {
        when: world({ is: "score", min: 15 }),
        by: 1,
        every: 9,
        key: "war_good",
      },
    ],
    feeds: [
      { when: bloc("business"), key: "business_turned" },
      { when: isLaw(W5.incomeTax), key: "income_tax_law" },
    ],
    cools: [
      { when: union, key: "union" },
      { when: flag("f_pm_barthou"), key: "chair" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_lr_2" },
      { at: 6, scene: "fra_hs_lr_3" },
    ],
    wants: [
      {
        id: "proportional_next",
        when: toCome(PROPORTIONAL),
        keep: isLaw(PROPORTIONAL),
        chapters: 10,
      },
      {
        id: "loan_terms",
        keep: war,
        chapters: 2,
        effects: [gauge("money", -1)],
      },
    ],
    amends: {
      [PROPORTIONAL]: "majority_bonus",
      [ARMY_COMMISSION]: "with_gqg_leave",
      [AMNESTY]: "after_victory",
    },
  },
  {
    id: "fra_fed_rep",
    tag: "FRA",
    bloc: "business",
    start: "in",
    strength: 2,
    seats: { chambre: 2, senat: 1 },
    leaders: [{ person: "fra_ribot" }, { person: "fra_barres" }],
    camps: ["right"],
    grows: [{ when: casualties(400), by: 1, every: 12, key: "long_lists" }],
    feeds: [
      { when: bloc("business"), key: "business_turned" },
      { when: isLaw(W5.warProfits), key: "profits_law" },
      { when: isLaw(AMNESTY), key: "amnesty_law" },
    ],
    cools: [
      { when: union, key: "union" },
      { when: flag("f_pm_ribot"), key: "chair" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_fr_2" },
      { at: 7, scene: "fra_hs_fr_3" },
    ],
    bills: known(W5.dalbiez),
    wants: [
      {
        id: "dalbiez_next",
        when: toCome(W5.dalbiez),
        keep: isLaw(W5.dalbiez),
        chapters: 8,
      },
      {
        id: "no_new_tax",
        keep: war,
        chapters: 2,
        effects: [heat("fra_sfio", 1)],
      },
    ],
    amends: { [PROPORTIONAL]: "list_vote", [AMNESTY]: "after_victory" },
  },
  {
    id: "fra_catholics",
    tag: "FRA",
    bloc: "court",
    start: "in",
    strength: 2,
    seats: { chambre: 1, senat: 1 },
    leaders: [{ person: "fra_cochin" }],
    camps: ["right"],
    grows: [{ when: union, by: 1, every: 12, key: "union" }],
    feeds: [
      { when: bloc("court"), key: "church_cold" },
      { when: isLaw(W5.incomeTax), key: "income_tax_law" },
    ],
    cools: [
      { when: union, key: "union" },
      { when: isLaw(W5.allowances), key: "allowances_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_cath_2" },
      { at: 6, scene: "fra_hs_cath_3" },
    ],
    bills: known(W5.allowances),
    wants: [
      {
        id: "allowances_next",
        when: toCome(W5.allowances),
        keep: isLaw(W5.allowances),
        chapters: 10,
      },
      {
        id: "chaplains",
        keep: war,
        chapters: 2,
        effects: [heat("fra_radicals", 1), heat("fra_sfio", 1)],
      },
    ],
    amends: { [PROPORTIONAL]: "list_vote", [AMNESTY]: "after_victory" },
  },
  {
    id: "fra_af",
    tag: "FRA",
    bloc: "press",
    start: "in",
    strength: 1,
    // A paper and its leagues: loud in the street, no seat in either house.
    seats: {},
    leaders: [{ person: "fra_daudet" }, { person: "fra_i_maurras" }],
    camps: ["right"],
    grows: [
      { when: score(-10), by: 1, every: 9, key: "war_bad" },
      { when: tiger, by: -1, every: 6, key: "tiger_in" },
    ],
    feeds: [
      {
        when: all(since("1917-01"), holder("interior", "fra_malvy")),
        key: "malvy_stays",
      },
      { when: isLaw(AMNESTY), key: "amnesty_law", by: 2 },
      { when: temper("fra_minority", 2), key: "pacifists" },
    ],
    cools: [{ when: tiger, key: "tiger_in", by: 2 }],
    steps: [
      { at: 3, scene: "fra_hs_af_2" },
      { at: 6, scene: "fra_hs_af_3" },
    ],
  },
  {
    id: "fra_tiger",
    tag: "FRA",
    bloc: "press",
    start: "in",
    strength: 2,
    seats: { senat: 1 },
    leaders: [
      { person: "fra_clemenceau", when: not(tiger) },
      { person: "fra_mandel" },
    ],
    camps: ["hard"],
    grows: [
      { when: score(-10), by: 1, every: 8, key: "war_bad" },
      { when: low("shells", 1), by: 1, every: 8, key: "no_shells" },
    ],
    feeds: [
      { when: isLaw(W5.censorship), key: "censor_law" },
      { when: { kind: "inst", inst: "army", min: 3 }, key: "gqg_free" },
      {
        when: all(since("1917-01"), holder("interior", "fra_malvy")),
        key: "malvy_stays",
      },
    ],
    cools: [
      { when: tiger, key: "in_the_chair", by: 3 },
      { when: isLaw(ARMY_COMMISSION), key: "commission_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_tig_2" },
      { at: 6, scene: "fra_hs_tig_3" },
    ],
    bills: known(ARMY_COMMISSION),
    wants: [
      {
        id: "commission_next",
        when: toCome(ARMY_COMMISSION),
        keep: isLaw(ARMY_COMMISSION),
        chapters: 8,
      },
      {
        id: "papers_free",
        keep: war,
        chapters: 2,
        effects: [{ kind: "censor", delta: -1 }],
      },
    ],
    amends: { [ARMY_COMMISSION]: "visit_front", [AMNESTY]: "press_only" },
  },
  {
    id: "fra_gqg",
    tag: "FRA",
    bloc: "army",
    start: "in",
    strength: 2,
    // The GQG weighs in; it has no vote.
    seats: {},
    leaders: [
      { person: "fra_joffre", when: holder("chief_of_staff", "fra_joffre") },
      { person: "fra_nivelle", when: holder("chief_of_staff", "fra_nivelle") },
      { person: "fra_petain", when: holder("chief_of_staff", "fra_petain") },
      { person: "fra_foch" },
    ],
    camps: ["military"],
    grows: [
      {
        when: world({ is: "main", of: ["west"] }),
        by: 1,
        every: 9,
        key: "west_first",
      },
      { when: tiger, by: -1, every: 8, key: "tiger_in" },
    ],
    feeds: [
      { when: { kind: "inst", inst: "army", max: -2 }, key: "army_cold" },
      { when: isLaw(ARMY_COMMISSION), key: "commission_law", by: 2 },
      {
        when: world({ is: "main", of: ["balkan", "straits"] }),
        key: "orient",
      },
    ],
    cools: [
      { when: isLaw(W5.dalbiez), key: "dalbiez_law" },
      { when: isLaw(W5.censorship), key: "censor_law" },
    ],
    steps: [
      { at: 3, scene: "fra_hs_gqg_2" },
      { at: 6, scene: "fra_hs_gqg_3" },
    ],
  },
];

// ---- Scenes written by hand: tempers, splits ----

const v = (id: string, when?: GwCond): GwVariant =>
  when === undefined ? { id } : { id, when };
/** An option: no tell, its reason line after. */
const o = (
  id: string,
  scene: string,
  effects: GwEffect[],
  when?: GwCond,
): GwOption => ({
  id,
  tell: [],
  effects: [...effects, reason(`${scene}_${id}`)],
  ...(when === undefined ? {} : { when }),
});
const lead = role("lead");
const press = (delta: number): GwEffect => ({
  kind: "opinion",
  bloc: "press",
  delta,
});
const censor = (delta: number): GwEffect => ({ kind: "censor", delta });

/** A faction's temper rises: its leader (or its radical) comes. */
const S = (
  id: string,
  f: string,
  opts: [string, GwEffect[]][],
  variants: GwVariant[] = [v("base")],
): GwScene => {
  const options = opts.map(([k, e]) => o(k, id, e));
  return {
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
  };
};
/** A faction breaks off: the new one's leader comes. */
const P = (
  id: string,
  f: string,
  opts: [string, GwEffect[]][],
  variants?: GwVariant[],
): GwScene => ({ ...S(id, f, opts, variants), once: true, salience: 8 });

/** Step scenes and split scenes. */
export const FRA_HOUSE_SCENES: readonly GwScene[] = [
  S("fra_hs_rad_2", "fra_radicals", [
    ["group_meeting", [cool("fra_radicals", 2), heat("fra_fed_rep", 1)]],
    ["prefects", [cool("fra_radicals", 1), inst("countersign", -1)]],
    ["let_be", []],
  ]),
  S(
    "fra_hs_rad_3",
    "fra_radicals",
    [
      ["more_seats", [cool("fra_radicals", 2), heat("fra_left_rep", 1)]],
      ["hold_pm", [cool("fra_radicals", 1), inst("chamber", -1)]],
      ["let_be", []],
    ],
    [v("tiger", tiger), v("base")],
  ),
  S("fra_hs_cai_2", "fra_caillaux", [
    ["receive", [cool("fra_caillaux", 2), heat("fra_tiger", 1)]],
    ["send_word", [cool("fra_caillaux", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S(
    "fra_hs_cai_3",
    "fra_caillaux",
    [
      ["hear_terms", [cool("fra_caillaux", 2), heat("fra_af", 2)]],
      ["warn_off", [heat("fra_caillaux", 1), cool("fra_tiger", 1)]],
      ["let_be", []],
    ],
    [v("rubicon", { kind: "secret", id: "fra_rubicon_papers" }), v("base")],
  ),
  S("fra_hs_rs_2", "fra_repsoc", [
    ["reform_word", [cool("fra_repsoc", 2), heat("fra_radicals", 1)]],
    ["dinner", [cool("fra_repsoc", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S("fra_hs_rs_3", "fra_repsoc", [
    ["mission", [cool("fra_repsoc", 2), inst("countersign", -1)]],
    ["keep_close", [cool("fra_repsoc", 1), heat("fra_radicals", 1)]],
    ["let_be", []],
  ]),
  S(
    "fra_hs_sfio_2",
    "fra_sfio",
    [
      ["hear_party", [cool("fra_sfio", 2), heat("fra_fed_rep", 1)]],
      ["pm_meets", [cool("fra_sfio", 1), inst("countersign", -1)]],
      ["let_be", []],
    ],
    [v("union", union), v("base")],
  ),
  S(
    "fra_hs_sfio_3",
    "fra_sfio",
    [
      [
        "offer_more",
        [cool("fra_sfio", 2), heat("fra_fed_rep", 1), heat("fra_af", 1)],
      ],
      ["plead", [cool("fra_sfio", 1), trustOf(lead, 1)]],
      ["let_be", [heat("fra_minority", 1)]],
    ],
    [v("union", union), v("base")],
  ),
  S("fra_hs_min_2", "fra_minority", [
    ["answer", [cool("fra_minority", 1), heat("fra_af", 1)]],
    ["censor", [heat("fra_minority", 2), censor(1)]],
    ["let_be", [cool("fra_minority", 1)]],
  ]),
  S(
    "fra_hs_min_3",
    "fra_minority",
    [
      ["passports", [cool("fra_minority", 2), heat("fra_tiger", 1)]],
      ["refuse", [heat("fra_minority", 1), cool("fra_af", 1)]],
      ["let_be", [press(-1)]],
    ],
    [v("russia", russiaFell), v("base")],
  ),
  S("fra_hs_lr_2", "fra_left_rep", [
    ["loan_word", [cool("fra_left_rep", 2), gauge("money", -1)]],
    ["dinner", [cool("fra_left_rep", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S("fra_hs_lr_3", "fra_left_rep", [
    ["firm_govt", [cool("fra_left_rep", 2), heat("fra_sfio", 1)]],
    ["own_name", [cool("fra_left_rep", 1), inst("countersign", -1)]],
    ["let_be", []],
  ]),
  S("fra_hs_fr_2", "fra_fed_rep", [
    ["shirkers", [cool("fra_fed_rep", 2), heat("fra_sfio", 1)]],
    ["hear_him", [cool("fra_fed_rep", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S("fra_hs_fr_3", "fra_fed_rep", [
    [
      "concede",
      [cool("fra_fed_rep", 2), heat("fra_sfio", 1), heat("fra_radicals", 1)],
    ],
    ["call_bluff", [heat("fra_fed_rep", 1), cool("fra_radicals", 1)]],
    ["let_be", []],
  ]),
  S("fra_hs_cath_2", "fra_catholics", [
    ["chaplains", [cool("fra_catholics", 2), heat("fra_radicals", 1)]],
    ["letter", [cool("fra_catholics", 1), trustOf(lead, 1)]],
    ["let_be", []],
  ]),
  S("fra_hs_cath_3", "fra_catholics", [
    [
      "congregations",
      [cool("fra_catholics", 2), heat("fra_radicals", 2), heat("fra_sfio", 1)],
    ],
    ["union_word", [cool("fra_catholics", 1), press(1)]],
    ["let_be", []],
  ]),
  S("fra_hs_af_2", "fra_af", [
    ["ignore", [heat("fra_af", 1)]],
    ["censor", [cool("fra_af", 1), heat("fra_tiger", 1), censor(1)]],
    ["let_be", [press(-1)]],
  ]),
  S("fra_hs_af_3", "fra_af", [
    ["inquiry", [cool("fra_af", 2), heat("fra_radicals", 2)]],
    ["seize_issue", [cool("fra_af", 1), heat("fra_catholics", 1), press(-1)]],
    ["let_be", [press(-1)]],
  ]),
  S("fra_hs_tig_2", "fra_tiger", [
    ["receive", [cool("fra_tiger", 2), heat("fra_radicals", 1)]],
    ["papers", [cool("fra_tiger", 1), inst("army", -1)]],
    ["let_be", []],
  ]),
  S("fra_hs_tig_3", "fra_tiger", [
    ["front_visit", [cool("fra_tiger", 2), inst("army", -1)]],
    ["answer_senate", [cool("fra_tiger", 1), inst("senate", -1)]],
    ["let_be", [heat("fra_tiger", 1), press(-1)]],
  ]),
  S("fra_hs_gqg_2", "fra_gqg", [
    ["men", [cool("fra_gqg", 2), heat("fra_sfio", 1), heat("fra_radicals", 1)]],
    ["hear_him", [cool("fra_gqg", 1), inst("army", 1)]],
    ["let_be", []],
  ]),
  S(
    "fra_hs_gqg_3",
    "fra_gqg",
    [
      ["his_terms", [cool("fra_gqg", 2), inst("chamber", -1)]],
      ["minister_answers", [cool("fra_gqg", 1), inst("army", -1)]],
      ["let_be", [heat("fra_gqg", 1)]],
    ],
    [v("tiger", tiger), v("base")],
  ),
  // Splits.
  P("fra_hs_caillaux", "fra_caillaux", [
    ["hear_him", [cool("fra_caillaux", 1), heat("fra_tiger", 1)]],
    ["back_group", [cool("fra_radicals", 1), heat("fra_caillaux", 1)]],
    ["let_be", []],
  ]),
  P("fra_hs_minority", "fra_minority", [
    ["hear_him", [cool("fra_minority", 1), heat("fra_af", 1)]],
    ["back_majority", [cool("fra_sfio", 1), heat("fra_minority", 1)]],
    ["let_be", []],
  ]),
];

// ---- S2: plots, the dossier, allies ----

const quiet = (when: GwCond, key: string, by = 1) => ({
  when,
  key,
  by,
  quiet: true,
});
const ALL_REGIMES = ["fra_republic", "fra_union", "fra_tiger"];

export const FRA_PLOTS: readonly GwPlotRow[] = [
  // Caillaux's peace: a cabinet that would talk to Berlin, and a President
  // who would have to go. A Clemenceau government ends it (he had Caillaux
  // arrested, plan §7).
  {
    id: "fra_pl_caillaux",
    tag: "FRA",
    regimes: ["fra_republic", "fra_union"],
    from: "1916-06",
    unless: "f_pm_clemenceau",
    feeds: [
      quiet(temper("fra_caillaux", 2), "caillaux_hot"),
      quiet(temper("fra_minority", 2), "minority_hot"),
      quiet(score(-20), "war_bad"),
      quiet(casualties(1200), "long_lists"),
      quiet({ kind: "gauge", gauge: "morale", max: 1 }, "low_morale"),
    ],
    steps: [
      { at: 6, scene: "fra_pl_caillaux_1" },
      { at: 12, scene: "fra_pl_caillaux_2" },
    ],
    rest: 12,
    fatal: true,
    plot: {
      by: ["fra_caillaux", "fra_minority"],
      signs: [
        { at: 2, scene: "fra_pl_caillaux_s1", via: "paper" },
        { at: 4, scene: "fra_pl_caillaux_s2", via: "talk" },
        { at: 8, scene: "fra_pl_caillaux_s3", via: "report" },
      ],
      warn: "fra_pl_caillaux_w",
      end: "removed",
    },
  },
  // The majorities' campaign against the Élysée: no cabinet will serve under
  // him, as Grévy (1887) and Millerand (1924) were made to go.
  {
    id: "fra_pl_elysee",
    tag: "FRA",
    regimes: ALL_REGIMES,
    from: "1915-06",
    feeds: [
      quiet({ kind: "inst", inst: "chamber", max: -2 }, "chamber_cold"),
      quiet({ kind: "inst", inst: "senate", max: -2 }, "senate_cold"),
      quiet(temper("fra_radicals", 2), "radicals_hot"),
      quiet(temper("fra_tiger", 2), "tiger_hot"),
      quiet(aroundUsed(3), "decrees"),
      quiet(score(-25), "war_bad"),
    ],
    steps: [
      { at: 6, scene: "fra_pl_elysee_1" },
      { at: 12, scene: "fra_pl_elysee_2" },
    ],
    rest: 12,
    fatal: true,
    plot: {
      by: ["fra_radicals", "fra_tiger", "fra_sfio"],
      signs: [
        { at: 2, scene: "fra_pl_elysee_s1", via: "paper" },
        { at: 4, scene: "fra_pl_elysee_s2", via: "talk" },
        { at: 8, scene: "fra_pl_elysee_s3", via: "report" },
      ],
      warn: "fra_pl_elysee_w",
      end: "removed",
    },
  },
  // The CGT's general strike, the metalworkers and the munitions works: the
  // unrest ladder.
  {
    id: "fra_pl_cgt",
    tag: "FRA",
    regimes: ALL_REGIMES,
    from: "1915-09",
    feeds: [
      quiet(temper("fra_minority", 2), "minority_hot"),
      quiet(temper("fra_sfio", 2), "sfio_hot"),
      quiet(low("bread", 0), "no_bread"),
      quiet(unrest(2), "streets"),
      quiet(russiaFell, "russia"),
    ],
    steps: [
      { at: 5, scene: "fra_pl_cgt_1" },
      { at: 9, scene: "fra_pl_cgt_2" },
    ],
    rest: 10,
    fatal: false,
    plot: {
      by: ["fra_minority", "fra_sfio"],
      signs: [
        { at: 2, scene: "fra_pl_cgt_s1", via: "paper" },
        { at: 3, scene: "fra_pl_cgt_s2", via: "talk" },
        { at: 7, scene: "fra_pl_cgt_s3", via: "report" },
      ],
      warn: "fra_pl_cgt_w",
      end: "unrest",
    },
  },
];

/**
 * Our people's possible weaknesses; the seed decides which are true. Low
 * odds, and only where there was talk at the time (plan §11.2; Messimy's and
 * Painlevé's rows had nothing behind them and went to Clemenceau and Jouhaux).
 */
export const FRA_WEAK: readonly GwWeakRow[] = [
  {
    person: "fra_malvy",
    weak: [
      { id: "letters", odds: 40 },
      { id: "foreign_ties", odds: 10 },
    ],
  },
  {
    person: "fra_caillaux",
    weak: [
      { id: "foreign_ties", odds: 35 },
      { id: "letters", odds: 30 },
    ],
  },
  { person: "fra_viviani", weak: [{ id: "health", odds: 30 }] },
  { person: "fra_millerand", weak: [{ id: "industry_money", odds: 20 }] },
  { person: "fra_loucheur", weak: [{ id: "industry_money", odds: 35 }] },
  { person: "fra_delcasse", weak: [{ id: "health", odds: 30 }] },
  { person: "fra_ribot", weak: [{ id: "health", odds: 20 }] },
  { person: "fra_briand", weak: [{ id: "old_scandal", odds: 20 }] },
  { person: "fra_sarrail", weak: [{ id: "letters", odds: 35 }] },
  { person: "fra_doumergue", weak: [{ id: "letters", odds: 20 }] },
  { person: "fra_clemenceau", weak: [{ id: "old_scandal", odds: 25 }] },
  { person: "fra_jouhaux", weak: [{ id: "letters", odds: 20 }] },
];

const westMain = world({ is: "main", of: ["west"] });

export const FRA_ASKS: readonly GwAskRow[] = [
  // The Tsar's side asks the allies to strike at the Turks (January 1915,
  // memory). W4's fra_f_straits_deal is the other thing: Constantinople.
  {
    id: "fra_ask_straits",
    tag: "FRA",
    from: "RUS",
    kind: "front",
    when: all(
      war,
      since("1915-01"),
      world({ is: "entered", tag: "OTT" }),
      tsar,
    ),
    scene: "fra_ask_straits",
    keep: any(
      world({ is: "main", of: ["straits"] }),
      world({ is: "force", tag: "FRA", theatre: "straits", min: 1 }),
    ),
    chapters: 4,
  },
  // London wants out of Salonika (late 1915, memory).
  {
    id: "fra_ask_salonika",
    tag: "FRA",
    from: "GBR",
    kind: "front",
    when: all(war, since("1915-11"), world({ is: "entered", tag: "BGR" })),
    scene: "fra_ask_salonika",
    keep: world({ is: "force", tag: "FRA", theatre: "balkan", max: 0 }),
    chapters: 4,
  },
  // Washington wants its army to fight as an army, not in French brigades.
  {
    id: "fra_ask_pershing",
    tag: "FRA",
    from: "USA",
    kind: "front",
    when: all(war, since("1917-06"), world({ is: "entered", tag: "USA" })),
    scene: "fra_ask_pershing",
    keep: war,
    chapters: 6,
  },
  // Rome wants France behind its Adriatic claims at the peace (the London
  // treaty of April 1915, memory).
  {
    id: "fra_ask_dalmatia",
    tag: "FRA",
    from: "ITA",
    kind: "front",
    when: all(war, world({ is: "entered", tag: "ITA", side: "entente" })),
    scene: "fra_ask_dalmatia",
    keep: war,
    chapters: 6,
  },
  // Chantilly: the allies' generals at Joffre's headquarters; Russia asks the
  // west to strike in the same month (December 1915, memory).
  {
    id: "fra_conf_chantilly",
    tag: "FRA",
    from: "RUS",
    kind: "offensive",
    conference: true,
    when: all(warAge(15), since("1915-11"), not(westMain), tsar),
    scene: "fra_conf_chantilly",
    keep: westMain,
    chapters: 6,
  },
];

// Plot scenes.
const A = (
  id: string,
  cast: GwScene["cast"],
  opts: [string, GwEffect[], GwCond?][],
  variants: GwVariant[] = [v("base")],
): GwScene => {
  const options = opts.map(([k, e, w]) => o(k, id, e, w));
  return {
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
  };
};
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
const police = either(office("interior"), office("chancellor"));
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
/** An arrest on a sign that may be false: a cold plot makes it a wrong. */
const onFalseSign = (id: string, f: string, who: string): GwEffect => ({
  kind: "maybe",
  when: plotHot(id, 0, 0),
  then: [heat(f, 2), trustOf(role(who), -1)],
});

/** Plot signs, warnings, steps; the asks' letters and the conference. */
export const FRA_PLOT_SCENES: readonly GwScene[] = [
  // Caillaux's peace.
  paperSign("fra_pl_caillaux_s1"),
  talkSign(
    "fra_pl_caillaux_s2",
    either(leaderOf("fra_radicals"), office("interior")),
  ),
  reportSign("fra_pl_caillaux_s3"),
  warning("fra_pl_caillaux_w"),
  A(
    "fra_pl_caillaux_1",
    { police },
    [
      [
        "speak_to_him",
        [coolPlot("fra_pl_caillaux", 3), cool("fra_caillaux", 1)],
      ],
      [
        "war_aims",
        [
          coolPlot("fra_pl_caillaux", 4),
          cool("fra_minority", 1),
          heat("fra_af", 1),
        ],
      ],
      [
        "go_public",
        [beatPlot("fra_pl_caillaux"), heat("fra_caillaux", 2), press(1)],
        plotConfirmed("fra_pl_caillaux"),
      ],
      ["wait", []],
    ],
    [v("rubicon", { kind: "secret", id: "fra_rubicon_papers" }), v("base")],
  ),
  A("fra_pl_caillaux_2", { pm: office("chancellor") }, [
    [
      "chamber_vote",
      [
        beatPlot("fra_pl_caillaux"),
        heat("fra_caillaux", 2),
        inst("chamber", -1),
      ],
    ],
    [
      "justice",
      [
        beatPlot("fra_pl_caillaux"),
        heat("fra_caillaux", 3),
        heat("fra_minority", 2),
        heatPlot("fra_pl_cgt", 3),
        onFalseSign("fra_pl_caillaux", "fra_radicals", "pm"),
      ],
    ],
    ["wait", []],
  ]),
  // The Élysée.
  paperSign("fra_pl_elysee_s1"),
  talkSign(
    "fra_pl_elysee_s2",
    either(person("fra_deschanel"), person("fra_dubost")),
  ),
  reportSign("fra_pl_elysee_s3"),
  warning("fra_pl_elysee_w"),
  A("fra_pl_elysee_1", { pm: office("chancellor") }, [
    [
      "message",
      [
        coolPlot("fra_pl_elysee", 3),
        inst("chamber", 1),
        inst("countersign", -1),
      ],
    ],
    [
      "leaders",
      [
        coolPlot("fra_pl_elysee", 4),
        cool("fra_radicals", 1),
        heat("fra_fed_rep", 1),
      ],
    ],
    [
      "go_public",
      [beatPlot("fra_pl_elysee"), heat("fra_tiger", 1), press(1)],
      plotConfirmed("fra_pl_elysee"),
    ],
    ["wait", []],
  ]),
  A(
    "fra_pl_elysee_2",
    {
      pm: office("chancellor"),
      ch: either(person("fra_deschanel"), person("fra_dubost")),
    },
    [
      [
        "give_way",
        [
          coolPlot("fra_pl_elysee", 6),
          cool("fra_radicals", 2),
          cool("fra_tiger", 1),
          inst("countersign", -2),
        ],
      ],
      [
        "stand",
        [
          beatPlot("fra_pl_elysee"),
          heat("fra_radicals", 2),
          heat("fra_tiger", 2),
          inst("chamber", -1),
        ],
      ],
      ["wait", []],
    ],
  ),
  // The CGT.
  paperSign("fra_pl_cgt_s1"),
  talkSign(
    "fra_pl_cgt_s2",
    either(person("fra_jouhaux"), person("fra_thomas")),
  ),
  reportSign("fra_pl_cgt_s3"),
  warning("fra_pl_cgt_w"),
  A("fra_pl_cgt_1", { home: office("interior") }, [
    [
      "meet_unions",
      [coolPlot("fra_pl_cgt", 3), gauge("money", -1), cool("fra_sfio", 1)],
    ],
    [
      "arrest",
      [
        beatPlot("fra_pl_cgt"),
        heat("fra_minority", 2),
        heat("fra_sfio", 1),
        onFalseSign("fra_pl_cgt", "fra_sfio", "home"),
      ],
    ],
    ["wait", []],
  ]),
  A(
    "fra_pl_cgt_2",
    {
      home: office("interior"),
      mun: either(office("munitions"), person("fra_thomas")),
    },
    [
      [
        "arbitration",
        [
          coolPlot("fra_pl_cgt", 5),
          cool("fra_minority", 1),
          gauge("money", -1),
        ],
      ],
      [
        "call_up",
        [
          beatPlot("fra_pl_cgt"),
          heat("fra_minority", 2),
          heat("fra_sfio", 2),
          gauge("order", -1),
        ],
      ],
      ["wait", []],
    ],
  ),
  // Allies' asks.
  letter("fra_ask_straits", { ruler_of: "RUS" }, "fra_ask_straits"),
  letter("fra_ask_salonika", { ruler_of: "GBR" }, "fra_ask_salonika"),
  letter("fra_ask_pershing", { ruler_of: "USA" }, "fra_ask_pershing"),
  letter("fra_ask_dalmatia", { ruler_of: "ITA" }, "fra_ask_dalmatia"),
  // Chantilly: the allies' generals at the GQG, the President at the last sitting.
  {
    id: "fra_conf_chantilly",
    nation: NATION,
    kind: "talk",
    big: true,
    once: true,
    scheduledOnly: true,
    salience: 9,
    tags: ["foreign", "war"],
    cast: {
      envoy: either({ office: "ambassador_paris", tag: "RUS" }),
      cos: held("chief_of_staff"),
    },
    who: "envoy",
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
        replies: [decide("hear", "n3")],
      },
      n3: {
        who: "envoy",
        fallback: "own_time",
        says: [v("base")],
        replies: [
          decide("together", null, [
            answerAsk("fra_conf_chantilly", true),
            reason("fra_conf_chantilly_together"),
          ]),
          decide("own_time", null, [
            answerAsk("fra_conf_chantilly", false),
            reason("fra_conf_chantilly_own_time"),
          ]),
        ],
      },
    },
  },
];
