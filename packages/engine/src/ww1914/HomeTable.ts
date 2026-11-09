// Great War 1914: how each country comes apart (design §4.6, §7). The ladder is
// the same for all: strikes, riots, army unrest, revolution, each one piled on
// the last, each with a concession offered. What fills it differs: a row here is
// a country's own strains and the scenes of its four rungs. A later country adds
// a row; without one it gets the common scene.
import {
  GwGauge,
  GwInstitution,
  GwSecret,
  GwThread,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { GwTag } from "@openfront/engine-api/ww1914/GwCountries";

export interface GwStrain {
  readonly gauge: GwGauge;
  readonly delta: number;
  /** Every so many months of war. */
  readonly every: number;
  readonly offset?: number;
  /** From this month of war on. */
  readonly from?: number;
  /** Text: gw.line.<key>. */
  readonly key: string;
  /** Only in a game where this thread runs hot, or this secret is true. */
  readonly thread?: GwThread;
  readonly secret?: GwSecret;
  /** Not while this body stands this high. */
  readonly unless?: { readonly inst: GwInstitution; readonly min: number };
}

export interface GwHomeRow {
  /** The scene of each rung, 1..4, on a seat's desk. */
  readonly rungs: readonly [string, string, string, string];
  /** Form of government -> its own scene for the top, once it is written. */
  readonly top?: Readonly<Record<string, string>>;
  /** Months of war before the top rung can come: the ladder waits on rung 3. */
  readonly topFrom?: number;
  readonly strains: readonly GwStrain[];
  /** Percent chance an AI government calms a rung it can pay for. */
  readonly concedes: number;
}

const rungs = (tag: string): GwHomeRow["rungs"] => [
  `gw_home_${tag}_1`,
  `gw_home_${tag}_2`,
  `gw_home_${tag}_3`,
  `gw_home_${tag}_4`,
];

const COMMON: GwHomeRow["rungs"] = [
  "gw_unrest",
  "gw_unrest",
  "gw_unrest",
  "gw_unrest",
];

export const GW_HOME: Readonly<Partial<Record<GwTag, GwHomeRow>>> = {
  DEU: {
    rungs: rungs("deu"),
    top: { empire: "deu_k_republic" },
    // Rungs count chapters; a `full` chapter is a month. Eight months at the
    // bottom ended a winning Germany in July 1915.
    topFrom: 30,
    concedes: 60,
    strains: [
      { gauge: "order", delta: -1, every: 8, from: 30, key: "order_weary" },
      { gauge: "morale", delta: -1, every: 9, from: 34, key: "morale_weary" },
      {
        gauge: "order",
        delta: -1,
        every: 12,
        from: 24,
        key: "order_left_splits",
        thread: "reichstag_left",
      },
    ],
  },
  GBR: {
    rungs: rungs("gbr"),
    concedes: 85,
    strains: [
      {
        gauge: "order",
        delta: -1,
        every: 12,
        from: 18,
        key: "order_shop_floor",
      },
      {
        gauge: "order",
        delta: -1,
        every: 10,
        from: 12,
        key: "order_ireland",
        thread: "ireland",
      },
      { gauge: "money", delta: -1, every: 8, from: 12, key: "money_dollars" },
      {
        gauge: "money",
        delta: -1,
        every: 10,
        from: 24,
        key: "money_credit_cliff",
        secret: "usa_credit_cliff",
      },
    ],
  },
  AUH: {
    rungs: rungs("auh"),
    top: {
      dual_monarchy: "auh_k_new_form",
      karl: "auh_k_new_form",
      ff_throne: "auh_k_new_form",
    },
    concedes: 45,
    strains: [
      { gauge: "order", delta: -1, every: 8, from: 14, key: "order_nations" },
      {
        gauge: "bread",
        delta: -1,
        every: 9,
        from: 12,
        key: "bread_two_halves",
        unless: { inst: "hungary", min: 2 },
      },
      {
        gauge: "morale",
        delta: -1,
        every: 8,
        from: 16,
        key: "morale_regiments",
      },
    ],
  },
  RUS: {
    rungs: rungs("rus"),
    top: {
      tsar: "rus_r_abdication",
      crown: "rus_r_abdication",
      regency: "rus_r_abdication",
      provisional: "rus_r_october",
      rep: "rus_r_october",
    },
    concedes: 40,
    strains: [
      { gauge: "bread", delta: -1, every: 7, from: 12, key: "bread_rail" },
      { gauge: "order", delta: -1, every: 6, from: 14, key: "order_capital" },
      {
        gauge: "shells",
        delta: -1,
        every: 8,
        from: 6,
        key: "shells_no_factories",
      },
      {
        gauge: "bread",
        delta: -1,
        every: 12,
        from: 18,
        key: "bread_rail",
        thread: "rus_rail",
      },
    ],
  },
  FRA: {
    rungs: COMMON,
    // The top of the ladder for a French seat, once written (lane W3).
    top: {
      fra_republic: "fra_h_top",
      fra_union: "fra_h_top",
      fra_tiger: "fra_h_top",
    },
    concedes: 70,
    strains: [
      { gauge: "order", delta: -1, every: 9, from: 24, key: "order_weary" },
      { gauge: "morale", delta: -1, every: 9, from: 28, key: "morale_weary" },
      {
        gauge: "morale",
        delta: -1,
        every: 6,
        from: 30,
        key: "morale_refusals",
        secret: "fra_army_refusals",
      },
    ],
  },
  ITA: {
    rungs: COMMON,
    concedes: 60,
    strains: [
      { gauge: "order", delta: -1, every: 8, from: 8, key: "order_weary" },
    ],
  },
  OTT: {
    rungs: COMMON,
    concedes: 75,
    strains: [
      { gauge: "order", delta: -1, every: 10, from: 24, key: "order_weary" },
      { gauge: "bread", delta: -1, every: 12, from: 18, key: "bread_rail" },
    ],
  },
  BGR: {
    rungs: COMMON,
    concedes: 50,
    strains: [
      { gauge: "order", delta: -1, every: 7, from: 8, key: "order_weary" },
    ],
  },
  SRB: { rungs: COMMON, concedes: 60, strains: [] },
};

/** Percent of AI governments' try at a rung with no row. */
export const GW_CONCEDES = 60;
