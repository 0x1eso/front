// France's house (ww158 shapes, HouseRows.ts; words in ./kit.ts). The chambers,
// whip and way round are FRA_HOUSE in ./houses.ts; the house comes into play
// the moment FRA_FACTIONS has rows. Text in resources/ww1914/ko/FRA.house.json.
// Lane W6 (ww166-format.md, plan ww166-plan-fra-scenes.md §11.2).
//
// ww203: real seats. The Chamber's groups in 1914 (fr.wikipedia, XIe
// législature, "Répartition des députés par groupes en 1914", 602 filled):
// Radicals and Radical-Socialists 173, Socialists 104, Gauche radicale 69,
// Républicains de gauche 56, Fédération républicaine 37, Gauche démocratique
// 31, Republican-Socialists 25, Action libérale 24, Union républicaine
// radicale et socialiste 18, Droites 15, unattached 50. Here: fra_radicals
// 173 + 18, fra_left_rep the three centre groups 69 + 56 + 31, fra_fed_rep
// 37, fra_catholics 24 + 15, fra_repsoc 25, fra_sfio 104; the unattached stay
// away. The Senate after the 1912 renewal (fr.wikipedia, élections
// sénatoriales de 1912; no renewal in the war): Gauche démocratique 166,
// Union républicaine 58, Gauche républicaine 44, Droite 22, unattached 13
// (the page sums to 303 of 300). Here: fra_radicals 146 and fra_tiger 20 of
// the Gauche démocratique, fra_left_rep 58, fra_fed_rep 44, fra_catholics 22,
// 10 away. Not checked: the Tiger's 20, Caillaux's 40 who split off with
// him, and the socialist minority's 30 (Longuet's men in the Chamber).
// Clemenceau chaired the Senate's army
// commission in 1915 and from 1916 to November 1917 (senat.fr list of its
// presidents) and accused Malvy in the Senate on 22 July 1917; Malvy went on
// 31 August 1917 and the Senate as High Court gave him five years'
// banishment on 6 August 1918 (fr.wikipedia Louis Malvy). Merrheim of the
// metalworkers went to Zimmerwald, 5-8 September 1915 (en.wikipedia).
//
// The bills on W5's laws (content/laws/fra.ts) are kept here and come into
// play only once those laws exist (`known`): the rows never name a law that
// isn't there.
import type { GwAssumes } from "@openfront/engine-api/ww1914/GwAssumes";
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
import { withAxes } from "../laws/fraAxes";
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
  faction,
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
  labour: "fra_law_labour",
} as const;
const PROPORTIONAL = "fra_law_proportional";
const ARMY_COMMISSION = "fra_law_army_commission";
const AMNESTY = "fra_law_amnesty";
/** ww203: the war aims article (a resolution), + check. */
const WAR_AIMS = "fra_war_aims";
/** ww190 §1: the peace years' navy bill (content/laws/fra.ts). */
const NAVY = "fra_law_navy";

const row = (r: Omit<GwLawRow, "tag">): GwLawRow => ({ ...r, tag: "FRA" });

/** The factions' own bills: rows like content/laws/fra.ts, with no tells. */
const FRA_HOUSE_LAW_ROWS: readonly GwLawRow[] = [
  // Proportional representation, Briand's cause before the war (memory).
  row({
    id: PROPORTIONAL,
    chapter: "franchise",
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
    chapter: "franchise",
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
    chapter: "nations",
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
  // + check. ww203: the war aims article. On 6 June 1917 the Chamber voted
  // an order of the day on the aims and the Senate confirmed it unanimously
  // (Paris press of 7 June 1917, Alsace-Lorraine back). The left bank's guard
  // is Briand's letter to Cambon of 12 January 1917, and peace without
  // annexations the socialist minority's word for Stockholm (both not
  // checked here). A resolution: it says, it doesn't run.
  row({
    id: WAR_AIMS,
    chapter: "war_aims",
    opens: all(war, since("1916-12")),
    lean: 0,
    decree: false,
    cast: { pm: held("chancellor") },
    draft: [
      draft("alsace_back", 1, [], [gauge("morale", 1)]),
      draft("rhine_guard", 0, [], [inst("army", 1), gauge("order", -1)]),
      draft("no_annexation", -1, [], [gauge("order", 1), gauge("morale", -1)]),
    ],
    passed: [gauge("morale", 1)],
    passedTell: [],
    term: [],
    repeal: { authority: 5, tell: [], effects: [] },
    talk: lawTalk(WAR_AIMS, {
      who: either(leaderOf("fra_minority"), person("fra_renaudel")),
      ask: "frank",
      push: "cold",
      tell: [],
      price: [inst("chamber", -1)],
      wins: 1,
      tempers: ["stubborn"],
    }),
  }),
];

/** ww207: every text with its axis push (../laws/fraAxes). */
export const FRA_HOUSE_LAWS: readonly GwLawRow[] =
  FRA_HOUSE_LAW_ROWS.map(withAxes);

const LAW_IDS = new Set([
  ...FRA_LAWS.map((l) => l.id),
  ...FRA_HOUSE_LAWS.map((l) => l.id),
]);
/** Only the laws that exist: W5's come in with their file. */
const known = (...laws: string[]): string[] =>
  laws.filter((l) => LAW_IDS.has(l));

const LAW_DRAFTS = new Map(
  [...FRA_LAWS, ...FRA_HOUSE_LAWS].map((l) => [
    l.id,
    new Set(l.draft.map((d) => d.id)),
  ]),
);
/** A faction's amendments, only on laws and texts that exist. */
const amend = (m: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(m).filter(([law, t]) => LAW_DRAFTS.get(law)?.has(t)),
  );

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
  {
    law: W5.siege,
    // ww204 (T): the Radicals resented the soldiers' courts: they waver.
    stance: sides(0, 0, 1, 0, -1, 1, 1, 1, 1),
    texts: {
      whole_country: { fra_radicals: 0, fra_repsoc: 0, fra_sfio: -1 },
      civil_courts: {
        fra_sfio: 1,
        fra_minority: 1,
        fra_fed_rep: 0,
        fra_tiger: 0,
      },
    },
  },
  {
    law: W5.threeYears,
    // Jaurès's party fought the three years; it is against its creed.
    creed: ["fra_sfio"],
    // ww204 (T): the Radicals fought the three years in 1913 (Caillaux's
    // Pau congress); only a shorter term brings them.
    stance: sides(-1, -1, 0, -1, -1, 1, 1, 1, 1),
    texts: {
      thirty_months: {
        fra_radicals: 1,
        fra_repsoc: 1,
        fra_sfio: 0,
        fra_minority: 0,
        fra_left_rep: 0,
        fra_fed_rep: 0,
      },
      two_years: {
        fra_radicals: 1,
        fra_caillaux: 1,
        fra_sfio: 1,
        fra_minority: 1,
        fra_left_rep: -1,
        fra_fed_rep: -1,
        fra_catholics: -1,
        fra_tiger: -1,
      },
    },
  },
  {
    law: W5.incomeTax,
    money: true,
    stance: sides(1, 1, 1, 1, 1, 0, -1, -1, 0),
    texts: {
      as_voted: { fra_left_rep: 1 },
      higher_bands: { fra_left_rep: -1, fra_repsoc: 0 },
      caillaux_scale: { fra_left_rep: -1, fra_tiger: -1 },
    },
  },
  {
    law: W5.dalbiez,
    // ww204 (T): the centre-right waver on combing the depots against the GQG.
    stance: sides(1, 0, 1, 1, 0, 0, 0, 0, 1),
    texts: {
      young_first: { fra_sfio: -1, fra_left_rep: 0, fra_fed_rep: 1 },
      factory_lists: { fra_fed_rep: -1, fra_minority: -1 },
    },
  },
  {
    law: W5.warProfits,
    money: true,
    stance: sides(1, 1, 1, 1, 1, 0, -1, 0, 0),
    texts: {
      full_excess: { fra_radicals: 0, fra_catholics: -1 },
      contracts_only: {
        fra_left_rep: 1,
        fra_fed_rep: 1,
        fra_catholics: 1,
        fra_tiger: 1,
        fra_minority: 0,
      },
    },
  },
  {
    law: W5.rents,
    around: true,
    // ww204 (T): the Radicals divided on the moratorium (the law came only in
    // March 1918): they waver; the centre-right stood by the landlords.
    stance: sides(0, 1, 1, 1, 1, -1, -1, 0, 0),
    texts: {
      all_small_rents: { fra_left_rep: -1, fra_catholics: -1 },
      rent_boards: { fra_fed_rep: 0, fra_left_rep: 1 },
    },
  },
  {
    law: W5.allowances,
    money: true,
    around: true,
    // ww204 (T): the centre-right waver on the allowances' cost.
    stance: sides(1, 1, 1, 1, 1, 0, 0, 1, 0),
    texts: {
      every_family: { fra_fed_rep: -1 },
      with_children: { fra_fed_rep: 1, fra_catholics: 1 },
    },
  },
  {
    law: W5.censorship,
    around: true,
    // Clemenceau's paper was cut by the censor and renamed itself for it.
    creed: ["fra_tiger"],
    stance: sides(0, -1, 1, -1, -1, 1, 1, 1, -1),
    texts: {
      military_only: { fra_radicals: 1 },
      political_too: { fra_radicals: -1, fra_repsoc: 0 },
      white_spaces: {
        fra_radicals: 1,
        fra_caillaux: 1,
        fra_minority: 1,
        fra_tiger: 1,
        fra_fed_rep: 0,
      },
    },
  },
  {
    law: W5.supply,
    // ww204 (T): the Radicals waver on the supply decrees; the liberal
    // centre-right is against fixing prices.
    stance: sides(0, 0, 1, 1, 0, -1, -1, 0, 1),
    texts: {
      bread_cards: { fra_radicals: 0, fra_tiger: 0 },
      chamber_reviews: { fra_fed_rep: 0, fra_minority: 1, fra_caillaux: 1 },
    },
  },
  {
    // ww190: the 1912 programme pushed on. The right and the centre build;
    // the socialists and Caillaux's men count the schools a dreadnought costs.
    law: NAVY,
    stance: sides(0, -1, 1, -1, -1, 1, 1, 1, 1),
    texts: {
      with_levy: {
        fra_radicals: 1,
        fra_caillaux: 0,
        fra_fed_rep: -1,
        fra_catholics: -1,
      },
      slower: { fra_radicals: 1, fra_caillaux: 0, fra_tiger: -1 },
    },
  },
  {
    law: PROPORTIONAL,
    by: "fra_repsoc",
    // The district vote is how the Radicals win: "our party's grave".
    creed: ["fra_radicals"],
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
    // Ribot's men: an amnesty in the war calls the next crime.
    creed: ["fra_fed_rep"],
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
  {
    // + check. ww203: the labour article. The centre and the right keep the
    // works quiet; the socialists want the men a voice.
    law: W5.labour,
    around: true,
    // ww204 (T): the Radicals waver on a strike ban.
    stance: sides(0, 0, 1, 0, -1, 1, 1, 1, 1),
    texts: {
      wage_boards: {
        fra_caillaux: 1,
        fra_sfio: 1,
        fra_minority: 0,
        fra_left_rep: 0,
        fra_fed_rep: -1,
        fra_catholics: 0,
        fra_tiger: 0,
      },
      shop_delegates: {
        fra_radicals: 0,
        fra_caillaux: 1,
        fra_repsoc: 0,
        fra_sfio: 1,
        fra_minority: 1,
        fra_left_rep: -1,
        fra_fed_rep: -1,
        fra_catholics: -1,
        fra_tiger: -1,
      },
    },
  },
  {
    // + check. ww203: the war aims, the right's motion (Barrès's Rhine).
    law: WAR_AIMS,
    by: "fra_fed_rep",
    resolution: true,
    stance: sides(1, 0, 1, 1, 0, 1, 1, 1, 1),
    texts: {
      rhine_guard: {
        fra_radicals: 0,
        fra_caillaux: -1,
        fra_sfio: -1,
        fra_minority: -1,
      },
      no_annexation: {
        fra_radicals: -1,
        fra_caillaux: 1,
        fra_repsoc: -1,
        fra_sfio: 0,
        fra_minority: 1,
        fra_left_rep: -1,
        fra_fed_rep: -1,
        fra_catholics: -1,
        fra_tiger: -1,
      },
    },
  },
  // ---- ww207 (W-FRA): the peace years' bills, the postponement, the node laws ----
  {
    // The 1914 Chamber sat on to 1919; Caillaux's and Longuet's men want the
    // country asked.
    law: "fra_law_postpone",
    stance: sides(1, 0, 1, 1, -1, 1, 1, 1, 1),
    texts: { soldiers_vote: { fra_minority: 1, fra_sfio: 0, fra_tiger: -1 } },
  },
  {
    // The CGT's cause since its May Day of 1906; the right counts the cost.
    law: "fra_law_eight_hours",
    stance: sides(0, 1, 0, 1, 1, -1, -1, 0, -1),
    texts: {
      by_trade: { fra_radicals: 1, fra_left_rep: 0, fra_catholics: 1 },
      english_week: { fra_left_rep: 1, fra_catholics: 1, fra_minority: 0 },
    },
  },
  {
    // The Radical senators feared the priest's vote (1919-22, checked).
    law: "fra_law_women_vote",
    stance: sides(-1, 0, 0, 1, 1, 0, 1, 1, -1),
    texts: {
      local_only: { fra_radicals: 0, fra_left_rep: 1 },
      war_widows: { fra_sfio: -1, fra_minority: -1, fra_tiger: 0 },
    },
  },
  {
    law: "fra_law_lay_school",
    by: "fra_radicals",
    creed: ["fra_catholics"],
    stance: sides(1, 1, 1, 1, 1, 0, -1, -1, 1),
    texts: {
      school_truce: {
        fra_radicals: -1,
        fra_sfio: -1,
        fra_fed_rep: 1,
        fra_left_rep: 1,
      },
    },
  },
  {
    law: "fra_law_grain",
    stance: sides(0, -1, 0, -1, -1, 1, 1, 1, 0),
    texts: {
      farm_credit: { fra_radicals: 1, fra_sfio: 0, fra_caillaux: 1 },
      consolidation: { fra_radicals: 1, fra_repsoc: 1 },
    },
  },
  {
    law: "fra_law_capital_levy",
    by: "fra_sfio",
    creed: ["fra_fed_rep"],
    stance: sides(-1, 1, -1, 1, 1, -1, -1, -1, -1),
    texts: {
      inheritance: { fra_radicals: 1, fra_repsoc: 0 },
      turnover: {
        fra_sfio: -1,
        fra_caillaux: -1,
        fra_left_rep: 1,
        fra_catholics: 0,
      },
    },
  },
  {
    law: "fra_law_regions",
    stance: sides(-1, 0, 0, -1, 0, 1, 1, 1, -1),
    texts: {
      elected_councils: { fra_sfio: 0, fra_tiger: -1, fra_left_rep: 0 },
      prefects_stay: { fra_radicals: 1, fra_tiger: 1, fra_catholics: -1 },
    },
  },
  {
    law: "fra_law_free_school",
    by: "fra_radicals",
    stance: sides(1, 1, 1, 1, 1, 0, -1, -1, 0),
  },
  {
    law: "fra_law_nationalise",
    by: "fra_sfio",
    creed: ["fra_fed_rep"],
    stance: sides(-1, 0, -1, 1, 1, -1, -1, -1, -1),
    texts: {
      mixed_boards: { fra_radicals: 0, fra_repsoc: 1, fra_caillaux: 1 },
    },
  },
  {
    law: "fra_law_colonies",
    by: "fra_left_rep",
    stance: sides(1, -1, 1, -1, -1, 1, 1, 1, 1),
    texts: { native_councils: { fra_sfio: 0, fra_fed_rep: 0, fra_tiger: -1 } },
  },
  {
    law: "fra_law_congregations",
    by: "fra_catholics",
    creed: ["fra_sfio"],
    stance: sides(-1, -1, -1, -1, -1, 0, 1, 1, -1),
    texts: { veterans_monks: { fra_left_rep: 1, fra_repsoc: 0 } },
  },
  {
    law: "fra_law_exile",
    stance: sides(-1, -1, -1, -1, -1, -1, 0, 1, -1),
  },
  {
    law: "fra_law_full_powers",
    by: "fra_tiger",
    stance: sides(-1, -1, 0, -1, -1, 0, 1, 1, 1),
    texts: { with_commission: { fra_radicals: 0, fra_repsoc: 1 } },
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
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 1, class: -1, church: 1 },
    ability: "fra_pw_ab_radicals",
    bloc: "parliament",
    start: "in",
    strength: 3,
    seats: { chambre: 191, senat: 146 },
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
        kind: "next",
        when: toCome(W5.incomeTax),
        keep: isLaw(W5.incomeTax),
        chapters: 10,
      },
      {
        id: "prefects",
        kind: "post",
        keep: war,
        chapters: 2,
        effects: [heat("fra_fed_rep", 1), heat("fra_catholics", 1)],
      },
      {
        id: "rad_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_radicals" }),
      },
      // ww209: the party of the comités owes and is owed; the farms and the
      // schools are its mayors' (content/money/fra.ts).
      { id: "rad_favour", kind: "favour" },
      { id: "farm_hands", kind: "money", when: war, earmark: "fra_farm_hands" },
      {
        id: "teachers",
        kind: "money",
        when: not(war),
        earmark: "fra_teachers",
      },
    ],
    amends: amend({
      [PROPORTIONAL]: "after_war",
      [AMNESTY]: "press_only",
      [W5.siege]: "war_zone",
      [W5.censorship]: "military_only",
      [W5.threeYears]: "thirty_months",
      [W5.incomeTax]: "as_voted",
      [W5.labour]: "wage_boards",
    }),
    splits: {
      when: all(
        warAge(18),
        any(temper("fra_radicals", 2), score(-15), casualties(900)),
      ),
      into: "fra_caillaux",
      takes: 1,
      // Approximate (ww204 M): Caillaux's following, no roll call found.
      seats: { chambre: 40 },
      scene: "fra_hs_caillaux",
    },
    // ww209: the income tax is the Radicals' own (Caillaux's law of 15 July
    // 1914), whatever their small owners think of property; the war profits
    // tax of 1 July 1916 too.
    purse: [{ taxes: { income: 1, profits: 1 } }],
    // ww209: Caillaux's men in the party before they leave it (the split
    // above): they never voted against the credits, but can be met apart.
    wing: {
      person: "fra_caillaux",
      ideals: { rule: 1, class: 1, church: 0 },
      share: 2,
      when: faction("fra_caillaux", { of: ["out"] }),
      defies: false,
      into: "fra_caillaux",
    },
  },
  {
    id: "fra_caillaux",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 1, class: 1, church: 0 },
    template: "peace",
    bloc: "parliament",
    start: "out",
    strength: 1,
    seats: { chambre: 40 },
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
        kind: "next",
        when: toCome(W5.incomeTax),
        keep: isLaw(W5.incomeTax),
        chapters: 8,
      },
      {
        id: "quiet_police",
        kind: "promise",
        keep: war,
        chapters: 2,
        terms: ["session"],
        effects: [heat("fra_tiger", 2), heat("fra_af", 1)],
      },
      {
        id: "cai_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_caillaux" }),
      },
    ],
    amends: amend({
      [AMNESTY]: "strikers",
      [PROPORTIONAL]: "after_war",
      [W5.incomeTax]: "caillaux_scale",
      [W5.censorship]: "white_spaces",
      [W5.warProfits]: "full_excess",
      [W5.labour]: "shop_delegates",
      [WAR_AIMS]: "no_annexation",
    }),
    // ww209: a negotiated peace's men: fewer guns, more bread, the rich pay.
    purse: [
      { lines: { army: -1, relief: 1 }, taxes: { income: 1, profits: 1 } },
    ],
  },
  {
    id: "fra_repsoc",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 1, class: 0, church: 1 },
    template: "parliament",
    bloc: "parliament",
    start: "in",
    strength: 2,
    seats: { chambre: 25 },
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
        kind: "next",
        when: toCome(PROPORTIONAL),
        keep: isLaw(PROPORTIONAL),
        chapters: 10,
      },
      {
        id: "portfolio",
        kind: "post",
        keep: war,
        chapters: 2,
        effects: [heat("fra_radicals", 1)],
      },
      {
        id: "rs_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_repsoc" }),
      },
      // ww209: Briand's way: a vote now, a debt to call later.
      { id: "rs_favour", kind: "favour" },
    ],
    amends: amend({
      [PROPORTIONAL]: "majority_bonus",
      [ARMY_COMMISSION]: "with_gqg_leave",
      [W5.censorship]: "military_only",
      [W5.threeYears]: "thirty_months",
    }),
  },
  {
    id: "fra_sfio",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 1, class: 1, church: 1 },
    ability: "fra_pw_ab_sfio",
    bloc: "workers",
    start: "in",
    strength: 3,
    seats: { chambre: 104 },
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
    bills: known(W5.warProfits, W5.rents, W5.labour),
    wants: [
      {
        id: "rents_next",
        kind: "next",
        when: toCome(W5.rents),
        keep: isLaw(W5.rents),
        chapters: 8,
      },
      {
        id: "civil_courts",
        kind: "promise",
        keep: war,
        chapters: 2,
        effects: [inst("army", -1)],
        // The courts are the war's: it won't wait for the peace.
        terms: ["session", "half"],
      },
      {
        id: "canteens",
        kind: "money",
        effects: [gauge("money", -1), gauge("morale", 1)],
        earmark: "fra_canteens",
      },
      {
        id: "allowances_next",
        kind: "promise",
        when: toCome(W5.allowances),
        keep: isLaw(W5.allowances),
        chapters: 8,
      },
      {
        id: "sfio_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_sfio" }),
      },
    ],
    amends: amend({
      [AMNESTY]: "strikers",
      [PROPORTIONAL]: "list_vote",
      [W5.siege]: "civil_courts",
      [W5.rents]: "all_small_rents",
      [W5.warProfits]: "full_excess",
      [W5.allowances]: "every_family",
      [W5.dalbiez]: "review_boards",
      [W5.labour]: "wage_boards",
    }),
    splits: {
      when: all(
        since("1915-06"),
        any(temper("fra_sfio", 2), casualties(500), low("bread", 1)),
      ),
      into: "fra_minority",
      takes: 1,
      // Approximate (ww204 M): the SFIO minority's deputies, not counted.
      seats: { chambre: 30 },
      scene: "fra_hs_minority",
    },
    // ww209: the unity charter of 1905 bound the group to refuse "l'ensemble
    // du budget" (marxists.org, principes SFIO 1905): in peace it votes
    // against every budget. On 4 August 1914 it voted the war credits, and
    // the majority went on voting them; only a party past bearing it stops.
    purse: [
      { when: not(war), bill: "budget", side: -1 },
      {
        when: all(war, not(temper("fra_sfio", 3))),
        bill: "credits",
        side: 1,
      },
    ],
    // ww209: Longuet's minority inside the party, from the Haute-Vienne's
    // motion of 1915 to the split above. Defying: the first socialist no
    // votes on the credits were Brizon, Raffin-Dugens and Blanc, 24 June 1916
    // (fr.wikipedia Pierre Brizon); the log names the minority's man.
    wing: {
      person: "fra_longuet",
      ideals: { rule: 0, class: 1, church: 1 },
      share: 3,
      when: all(since("1915-05"), faction("fra_minority", { of: ["out"] })),
      into: "fra_minority",
    },
  },
  {
    id: "fra_minority",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 0, class: 1, church: 1 },
    template: "peace",
    trust: -1,
    bloc: "workers",
    start: "out",
    strength: 1,
    seats: { chambre: 30 },
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
        kind: "next",
        when: toCome(AMNESTY),
        keep: isLaw(AMNESTY),
        chapters: 8,
      },
      {
        id: "passports",
        kind: "promise",
        keep: war,
        chapters: 2,
        terms: ["session"],
        effects: [heat("fra_af", 1), heat("fra_tiger", 1)],
      },
      {
        id: "min_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_minority" }),
      },
    ],
    amends: amend({
      [AMNESTY]: "strikers",
      [ARMY_COMMISSION]: "visit_front",
      [W5.siege]: "civil_courts",
      [W5.warProfits]: "full_excess",
      [W5.censorship]: "white_spaces",
      [W5.labour]: "shop_delegates",
      [WAR_AIMS]: "no_annexation",
    }),
    // ww209: most of the minority still voted the credits (448:4 in
    // September 1916); a minority past bearing it votes no.
    purse: [
      {
        when: all(war, temper("fra_minority", 3)),
        bill: "credits",
        side: -1,
      },
    ],
  },
  {
    id: "fra_left_rep",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 1, class: -1, church: 0 },
    bloc: "business",
    start: "in",
    strength: 2,
    seats: { chambre: 156, senat: 58 },
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
        id: "loan_terms",
        kind: "money",
        effects: [gauge("money", -1)],
      },
      // ww209: the invaded departments' rebuilding (content/money/fra.ts).
      {
        id: "war_damages",
        kind: "money",
        when: since("1914-12"),
        earmark: "fra_war_damages",
      },
      {
        id: "proportional_next",
        kind: "promise",
        when: toCome(PROPORTIONAL),
        keep: isLaw(PROPORTIONAL),
        chapters: 10,
      },
      {
        id: "lr_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_left_rep" }),
      },
    ],
    amends: amend({
      [PROPORTIONAL]: "majority_bonus",
      [ARMY_COMMISSION]: "with_gqg_leave",
      [AMNESTY]: "after_victory",
      [W5.incomeTax]: "as_voted",
      [W5.warProfits]: "contracts_only",
      [W5.rents]: "rent_boards",
      [W5.labour]: "strike_ban",
    }),
  },
  {
    id: "fra_fed_rep",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: 0, class: -1, church: -1 },
    template: "nation",
    bloc: "business",
    start: "in",
    strength: 2,
    seats: { chambre: 37, senat: 44 },
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
    bills: known(W5.dalbiez, WAR_AIMS),
    wants: [
      {
        id: "dalbiez_next",
        kind: "next",
        when: toCome(W5.dalbiez),
        keep: isLaw(W5.dalbiez),
        chapters: 8,
      },
      {
        id: "aims_next",
        kind: "next",
        when: toCome(WAR_AIMS),
        keep: isLaw(WAR_AIMS),
        chapters: 10,
      },
      {
        id: "no_new_tax",
        kind: "promise",
        keep: war,
        chapters: 2,
        effects: [heat("fra_sfio", 1)],
      },
      // ww209: the invaded east and north (content/money/fra.ts); Louis Marin
      // of Meurthe-et-Moselle sat with this group (his refugee work F).
      { id: "refugees", kind: "money", when: war, earmark: "fra_refugees" },
      {
        id: "fr_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_fed_rep" }),
      },
    ],
    amends: amend({
      [PROPORTIONAL]: "list_vote",
      [AMNESTY]: "after_victory",
      [W5.dalbiez]: "young_first",
      [W5.warProfits]: "contracts_only",
      [W5.allowances]: "with_children",
      [W5.labour]: "strike_ban",
      [WAR_AIMS]: "rhine_guard",
    }),
    // ww209: the three years' and the fleet's party.
    purse: [{ lines: { army: 1, navy: 1 } }],
  },
  {
    id: "fra_catholics",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: -1, class: 0, church: -1 },
    ability: "fra_pw_ab_catholics",
    trust: -1,
    bloc: "court",
    start: "in",
    strength: 2,
    seats: { chambre: 39, senat: 22 },
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
        kind: "next",
        when: toCome(W5.allowances),
        keep: isLaw(W5.allowances),
        chapters: 10,
      },
      {
        id: "chaplains",
        kind: "promise",
        keep: war,
        chapters: 2,
        effects: [heat("fra_radicals", 1), heat("fra_sfio", 1)],
      },
      {
        id: "orphans",
        kind: "money",
        effects: [gauge("money", -1), gauge("morale", 1)],
        earmark: "fra_war_wards",
      },
      {
        id: "cath_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_catholics" }),
      },
    ],
    amends: amend({
      [PROPORTIONAL]: "list_vote",
      [AMNESTY]: "after_victory",
      [W5.allowances]: "with_children",
      [W5.warProfits]: "contracts_only",
    }),
    // ww209: the Catholic right fought the income tax (its bill row's -1).
    purse: [{ taxes: { income: -1, property: -1 } }],
  },
  {
    id: "fra_af",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: -1, class: -1, church: -1 },
    ability: "fra_pw_ab_af",
    trust: -1,
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
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: -1, class: -1, church: 1 },
    ability: "fra_pw_ab_tiger",
    bloc: "press",
    start: "in",
    strength: 2,
    // Approximate (ww204 M): Clemenceau's friends in the Senate.
    seats: { senat: 20 },
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
        kind: "next",
        when: toCome(ARMY_COMMISSION),
        keep: isLaw(ARMY_COMMISSION),
        chapters: 8,
      },
      {
        id: "papers_free",
        kind: "promise",
        keep: war,
        chapters: 2,
        terms: ["session", "half"],
        effects: [{ kind: "censor", delta: -1 }],
      },
      {
        id: "tig_text",
        kind: "concession",
        when: world({ is: "amendable", id: "fra_tiger" }),
      },
    ],
    amends: amend({
      [ARMY_COMMISSION]: "visit_front",
      [AMNESTY]: "press_only",
      [W5.censorship]: "white_spaces",
      [W5.dalbiez]: "factory_lists",
      [W5.supply]: "penalties_only",
    }),
    // ww209: "je fais la guerre": the guns first.
    purse: [{ lines: { army: 1 } }],
  },
  {
    id: "fra_gqg",
    tag: "FRA",
    // ww207 (W-FRA): its three Cornerstones on 권위↔공화, 재산↔노동, 교회↔세속.
    ideals: { rule: -1, class: -1, church: 0 },
    template: "crown_army",
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
/** ww187: what a scene's text takes for granted (the builders take no tags). */
const ASSUMES_FRA_HOUSE_SCENES: Readonly<Record<string, GwAssumes>> = {
  // "forty of ours in the Senate stay away from the next vote"
  fra_hs_lr_3: { sits: ["senat"] },
};

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
].map((s) =>
  ASSUMES_FRA_HOUSE_SCENES[s.id] === undefined
    ? s
    : { ...s, assumes: ASSUMES_FRA_HOUSE_SCENES[s.id] },
);

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
