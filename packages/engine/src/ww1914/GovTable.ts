// Great War 1914: who can bring the seat's government down (brief ww142). One
// row per threat, read by Government.ts: a later country adds rows, no code.
// Every month that a `feeds` line holds the threat runs hotter, and every month
// none does it cools. At each step's heat its scene comes to the desk; what the
// seat does there moves the heat, beats the threat or loses the game. A threat
// never changes who the seat is: a `fatal` row's last scene can end the game.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { flag, GwCond, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";

export interface GwGovFeed {
  readonly when: GwCond;
  /** Text: gw.gov.feed.<key>, in the country tab. */
  readonly key: string;
  /** Heat a month; 1 if absent. */
  readonly by?: number;
  /** Fed by something the seat may not know: it isn't listed. */
  readonly quiet?: boolean;
}

export interface GwGovRow {
  /** Text: gw.gov.name.<id>; reasons gov_<id>_<step>, gov_<id>_calm. */
  readonly id: string;
  readonly tag: GwTag;
  /** Forms of government it can come in. */
  readonly regimes: readonly string[];
  /** YYYY-MM: nothing before it. */
  readonly from: string;
  /** A seat flag that puts the threat out of the game. */
  readonly unless?: string;
  readonly feeds: readonly GwGovFeed[];
  /**
   * Scenes in order, each with the heat it comes at; months, whatever the
   * calendar. `again`: a talk that comes each time it is reached, though seen
   * (France's consultations: a cabinet can fall more than once).
   */
  readonly steps: readonly {
    readonly at: number;
    readonly scene: string;
    readonly again?: boolean;
  }[];
  /** Months it lies quiet once beaten. */
  readonly rest: number;
  /** Its last scene can lose the game. */
  readonly fatal: boolean;
}

/** An election's arithmetic: what the whips can see, in seats. */
export interface GwElectionRow {
  /** The row of GW_GOV it belongs to. */
  readonly id: string;
  readonly total: number;
  readonly need: number;
  /** The party's seats now. */
  readonly base: number;
  /** Who else counts towards a majority, when they do. Text: gw.gov.party.<id>. */
  readonly friends: readonly {
    readonly id: string;
    readonly seats: number;
    readonly when: GwCond;
  }[];
  /** What moves the seats. Text: gw.gov.swing.<key>. */
  readonly swings: readonly {
    readonly when: GwCond;
    readonly seats: number;
    readonly key: string;
  }[];
}

const inst = (
  i: Extract<GwCond, { kind: "inst" }>["inst"],
  range: { min?: number; max?: number },
): GwCond => ({ kind: "inst", inst: i, ...range });
const gaugeMax = (
  g: Extract<GwCond, { kind: "gauge" }>["gauge"],
  max: number,
): GwCond => ({ kind: "gauge", gauge: g, max });
const unrest = world({ is: "unrest", min: 2 });
const beaten = world({ is: "score", max: -20 });
const inOffice = (o: "chancellor"): GwCond => ({
  kind: "in_office",
  who: { office: o },
});

const steps = (id: string, ...at: number[]) =>
  at.map((a, i) => ({ at: a, scene: `gov_${id}_${i + 1}` }));

/** France: a cabinet's fall ends in the President's consultations. */
export const GW_FRA_CONSULT = "gov_fra_consult";
const FRA_REGIMES = ["fra_republic", "fra_union", "fra_tiger"];
const dateFrom = (from: string) => world({ is: "date", from });

export const GW_GOV: readonly GwGovRow[] = [
  {
    id: "gbr_table",
    tag: "GBR",
    regimes: ["liberal", "coalition", "war_cabinet", "national"],
    from: "1914-10",
    unless: "f_pm_lg",
    feeds: [
      { when: inst("cabinet", { max: -1 }), key: "gbr_cabinet" },
      { when: inst("commons", { max: -1 }), key: "gbr_commons" },
      { when: inst("opposition", { max: -3 }), key: "gbr_opposition" },
      { when: beaten, key: "war_bad" },
      { when: unrest, key: "streets" },
    ],
    steps: steps("gbr_table", 3, 7, 11),
    rest: 10,
    fatal: true,
  },
  {
    id: "gbr_unionists",
    tag: "GBR",
    regimes: ["coalition", "war_cabinet"],
    from: "1915-01",
    unless: "f_pm_lg",
    feeds: [
      { when: inst("opposition", { max: 0 }), key: "gbr_unionists" },
      { when: inst("cabinet", { max: -2 }), key: "gbr_cabinet" },
      {
        when: {
          kind: "all",
          of: [world({ is: "war_age", min: 16 }), not(flag("f_gbr_conscript"))],
        },
        key: "gbr_no_conscription",
      },
    ],
    steps: steps("gbr_unionists", 3, 7),
    rest: 10,
    fatal: false,
  },
  {
    id: "gbr_election",
    tag: "GBR",
    regimes: ["liberal", "coalition", "war_cabinet", "national"],
    from: "1915-01",
    unless: "f_pm_lg",
    feeds: [
      {
        when: {
          kind: "all",
          of: [
            world({ is: "date", from: "1915-07" }),
            not(flag("f_gbr_parliament_extended")),
            not(flag("f_gov_new_parliament")),
          ],
        },
        key: "gbr_term",
      },
      { when: flag("f_gbr_war_election"), key: "gbr_called", by: 2 },
      { when: flag("f_gov_writ"), key: "gbr_called", by: 2 },
    ],
    steps: [
      { at: 1, scene: "gov_gbr_writ" },
      { at: 3, scene: "gov_gbr_pact" },
      { at: 5, scene: "gov_gbr_cry" },
      { at: 7, scene: "gov_gbr_poll" },
    ],
    rest: 48,
    fatal: true,
  },
  {
    id: "deu_chancellor",
    tag: "DEU",
    regimes: ["empire"],
    from: "1914-10",
    feeds: [
      {
        when: {
          kind: "all",
          of: [inOffice("chancellor"), inst("countersign", { max: -1 })],
        },
        key: "deu_countersign",
      },
      {
        when: {
          kind: "all",
          of: [inOffice("chancellor"), inst("reichstag", { max: -1 })],
        },
        key: "deu_reichstag",
      },
      {
        when: {
          kind: "all",
          of: [inOffice("chancellor"), inst("army", { min: 3 })],
        },
        key: "deu_army",
      },
    ],
    steps: steps("deu_chancellor", 4, 8, 13),
    rest: 10,
    fatal: false,
  },
  {
    id: "deu_parliament",
    tag: "DEU",
    regimes: ["empire"],
    from: "1915-09",
    feeds: [
      { when: inst("reichstag", { max: -2 }), key: "deu_reichstag" },
      { when: gaugeMax("order", 1), key: "order_low" },
      { when: gaugeMax("bread", 1), key: "bread_low" },
      { when: beaten, key: "war_bad" },
    ],
    steps: steps("deu_parliament", 6, 12, 20),
    rest: 12,
    fatal: true,
  },
  {
    id: "auh_cabinet",
    tag: "AUH",
    regimes: ["dual_monarchy", "karl", "ff_throne"],
    from: "1914-10",
    feeds: [
      { when: inst("council", { max: -1 }), key: "auh_council" },
      { when: inst("hungary", { max: -1 }), key: "auh_hungary" },
      { when: inst("nations", { max: -3 }), key: "auh_nations" },
    ],
    steps: steps("auh_cabinet", 3, 6, 10),
    rest: 10,
    fatal: false,
  },
  {
    id: "auh_court",
    tag: "AUH",
    regimes: ["dual_monarchy", "karl", "ff_throne"],
    from: "1915-06",
    feeds: [
      { when: inst("hungary", { max: -2 }), key: "auh_hungary" },
      { when: inst("council", { max: -2 }), key: "auh_council" },
      { when: inst("berlin", { min: 3 }), key: "auh_berlin" },
      { when: gaugeMax("order", 1), key: "order_low" },
      { when: gaugeMax("morale", 1), key: "morale_low" },
    ],
    steps: steps("auh_court", 5, 10, 16),
    rest: 12,
    fatal: true,
  },
  {
    id: "rus_cabinet",
    tag: "RUS",
    regimes: ["tsar"],
    from: "1914-10",
    feeds: [
      { when: inst("ministers", { max: -1 }), key: "rus_ministers" },
      { when: inst("duma", { max: -2 }), key: "rus_duma" },
    ],
    steps: steps("rus_cabinet", 4, 8, 13),
    rest: 8,
    fatal: false,
  },
  {
    id: "rus_duma",
    tag: "RUS",
    regimes: ["tsar"],
    from: "1914-12",
    // An abolished Duma can't bring a ministry down (rus_pw_abolish_duma).
    unless: "f_rus_duma_abolished",
    feeds: [
      { when: inst("duma", { max: -1 }), key: "rus_duma" },
      { when: gaugeMax("shells", 1), key: "rus_shells" },
    ],
    steps: steps("rus_duma", 4, 9, 14),
    rest: 10,
    fatal: false,
  },
  {
    id: "rus_court",
    tag: "RUS",
    regimes: ["tsar"],
    from: "1916-03",
    feeds: [
      { when: inst("court", { max: -2 }), key: "rus_court" },
      { when: inst("duma", { max: -2 }), key: "rus_duma" },
      { when: inst("ministers", { max: -2 }), key: "rus_ministers" },
      { when: gaugeMax("order", 1), key: "order_low" },
      {
        when: { kind: "secret", id: "rus_palace_plot" },
        key: "rus_plot",
        quiet: true,
      },
    ],
    steps: steps("rus_court", 6, 12, 20),
    rest: 12,
    fatal: true,
  },
  // France (ww166 plan §1). A fallen cabinet is not a lost game: the last step
  // of the Chamber's and the Senate's rows is the consultations, where the
  // President calls the next premier. Only the Élysée row can end the game.
  {
    id: "fra_chamber",
    tag: "FRA",
    regimes: FRA_REGIMES,
    from: "1914-12",
    feeds: [
      { when: inst("chamber", { max: -1 }), key: "fra_chamber" },
      {
        when: {
          kind: "all",
          of: [dateFrom("1916-06"), inst("chamber", { max: 0 })],
        },
        key: "fra_secret_committee",
      },
      { when: beaten, key: "war_bad" },
      { when: unrest, key: "streets" },
    ],
    steps: [
      ...steps("fra_chamber", 3, 7),
      { at: 11, scene: GW_FRA_CONSULT, again: true },
    ],
    rest: 8,
    fatal: false,
  },
  {
    id: "fra_senate",
    tag: "FRA",
    regimes: ["fra_republic", "fra_union"],
    from: "1915-01",
    // The Tiger chaired the Senate's army commission: in office, he is it.
    unless: "f_pm_clemenceau",
    feeds: [
      { when: inst("senate", { max: -1 }), key: "fra_senate" },
      { when: gaugeMax("shells", 1), key: "fra_shells" },
      { when: inst("army", { min: 3 }), key: "fra_gqg" },
    ],
    steps: [
      ...steps("fra_senate", 3, 7),
      { at: 11, scene: GW_FRA_CONSULT, again: true },
    ],
    rest: 10,
    fatal: false,
  },
  {
    id: "fra_elysee",
    tag: "FRA",
    regimes: FRA_REGIMES,
    from: "1915-06",
    feeds: [
      { when: inst("chamber", { max: -3 }), key: "fra_chamber_hostile" },
      { when: inst("senate", { max: -3 }), key: "fra_senate_hostile" },
      { when: inst("countersign", { max: -3 }), key: "fra_countersign" },
      { when: world({ is: "score", max: -40 }), key: "war_bad" },
      // The President's own name worn thin (his ruler card): the talk of an
      // idle Élysée is what the majorities would use against him.
      {
        when: { kind: "ruler", side: "reputation", max: 1 },
        key: "fra_idle",
      },
    ],
    steps: steps("fra_elysee", 6, 12, 20),
    rest: 12,
    fatal: true,
  },
];

/** The Commons as December 1910 left it, 670 seats. */
export const GW_ELECTIONS: readonly GwElectionRow[] = [
  {
    id: "gbr_election",
    total: 670,
    need: 336,
    base: 272,
    friends: [
      { id: "irish", seats: 84, when: inst("irish", { min: 0 }) },
      { id: "labour", seats: 42, when: flag("f_gov_lib_lab") },
    ],
    swings: [
      { when: inst("commons", { min: 2 }), seats: 14, key: "commons_firm" },
      { when: inst("commons", { max: -1 }), seats: -16, key: "commons_low" },
      { when: inst("cabinet", { max: -2 }), seats: -12, key: "table_split" },
      { when: gaugeMax("order", 1), seats: -14, key: "order_low" },
      { when: gaugeMax("bread", 1), seats: -10, key: "bread_low" },
      { when: world({ is: "score", min: 15 }), seats: 18, key: "war_good" },
      { when: world({ is: "score", max: -15 }), seats: -26, key: "war_bad" },
      { when: not(flag("f_gov_lib_lab")), seats: -18, key: "no_pact" },
      { when: flag("f_gov_cry_home"), seats: 10, key: "cry_home" },
      { when: flag("f_gov_cry_war"), seats: 16, key: "cry_war" },
      { when: flag("f_gov_cry_peace"), seats: 8, key: "cry_peace" },
    ],
  },
];
