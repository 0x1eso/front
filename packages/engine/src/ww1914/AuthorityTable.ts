// Great War 1914: who can say no to the head of state (design §6). One row per
// form of government: a later country adds a row and its bodies, no code. Every
// rule is read by Authority.ts. `call` puts a scene on the desk; it is the only
// way a body speaks. Scenes that aren't written yet for a country simply never
// come: the rule waits on `gwContent()`.
import {
  GwGauge,
  GwInstitution,
  GwIssue,
  GwOffice,
  GwSecret,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwChamber } from "@openfront/engine-api/ww1914/GwHouse";
import { all, flag, GwCond, not } from "@openfront/engine-api/ww1914/SceneDsl";
import { world } from "@openfront/engine-api/ww1914/WorldDsl";
import { GW_LAW_BODIES, GwLawBody } from "@openfront/engine-lib/ww1914/LawRows";

export type GwInstRule =
  /** The body's weight moves with the months of war. */
  | {
      rule: "drift";
      inst: GwInstitution;
      delta: number;
      every: number;
      offset?: number;
      key: string;
      /** Only with this seat flag, or only without it. */
      flag?: string;
      unless?: string;
    }
  /** The body follows a person's trust; it writes a letter at the bottom. */
  | {
      rule: "tracks";
      inst: GwInstitution;
      office: GwOffice;
      letterAt: number;
      key: string;
    }
  /** The body cools when the country's order is this low. */
  | {
      rule: "low_order";
      inst: GwInstitution;
      at: number;
      delta: number;
      key: string;
    }
  /** A front lost in this chapter moves the body. */
  | { rule: "lost_front"; inst: GwInstitution; delta: number; key: string }
  /** A body this low with morale this low: men walk over, a band wears. */
  | {
      rule: "wear";
      inst: GwInstitution;
      max: number;
      morale: number;
      theatre: GwTheatre;
      /** A secret that says the fear was wrong: the rule sleeps. */
      unless: GwSecret;
      key: string;
    }
  /** A body this low costs the country something, on its months. */
  | {
      rule: "levy";
      inst: GwInstitution;
      max: number;
      gauge: GwGauge;
      delta: number;
      every: number;
      key: string;
    }
  /**
   * A scene comes: when `when` holds, every `every` months of war if named.
   * `first`: also in the war's first chapter of plans. `once`: never again.
   */
  | {
      rule: "call";
      scene: string;
      when?: GwCond;
      every?: number;
      offset?: number;
      first?: boolean;
      once?: boolean;
      /**
       * ww187: a vote in this chamber. Due while it doesn't sit, the paper
       * waits (a seat flag `wait_<scene>`) and comes once it sits again.
       */
      sits?: GwChamber;
    };

/** A paper a body won't let through: `kind` of paper, by its weight. */
export interface GwPaperBar {
  readonly inst: GwInstitution;
  readonly min?: number;
  readonly max?: number;
  readonly closes: readonly ("hold" | "other" | "ally" | "major")[];
  /** Text: gw.plan_why.<why>. */
  readonly why: string;
  /** A sovereign at the head of his army is past this body. */
  readonly unlessCommand?: boolean;
}

export interface GwAuthorityRow {
  /** The bodies and their weight when this form begins; they replace the old. */
  readonly inst: Readonly<Partial<Record<GwInstitution, number>>>;
  readonly rules: readonly GwInstRule[];
  readonly papers: readonly GwPaperBar[];
  /** What a dismissal does: a person of `camp` going moves `inst`. */
  readonly dismiss: readonly {
    /** A camp of GW_CAMPS, or "any". Nation lanes add camps to that list. */
    readonly camp: string;
    readonly inst: GwInstitution;
    readonly delta: number;
  }[];
  /** Who must pass a bill. Absent: nobody can stop one. */
  readonly law?: GwLawBody;
}

const NOBODY: GwAuthorityRow = { inst: {}, rules: [], papers: [], dismiss: [] };

/** Scenes every war government gets. */
const asked: GwInstRule[] = [
  {
    rule: "call",
    scene: "gw_sue",
    every: 3,
    when: all(
      world({ is: "score", max: -60 }),
      world({ is: "war_age", min: 40 }),
    ),
  },
];

const germanRules: GwInstRule[] = [
  {
    rule: "drift",
    inst: "army",
    delta: 1,
    every: 6,
    key: "army_grows",
    unless: "f_third_ohl",
  },
  {
    rule: "drift",
    inst: "army",
    delta: 1,
    every: 4,
    key: "army_grows",
    flag: "f_third_ohl",
  },
  {
    rule: "low_order",
    inst: "reichstag",
    at: 1,
    delta: -1,
    key: "reichstag_cools",
  },
  {
    rule: "tracks",
    inst: "countersign",
    office: "chancellor",
    letterAt: -3,
    key: "countersign_refused",
  },
  {
    rule: "call",
    scene: "gw_uboat_first",
    once: true,
    when: all(
      world({ is: "blockade", min: 3 }),
      world({ is: "uboat", max: 0 }),
    ),
  },
  {
    rule: "call",
    scene: "gw_uboat_second",
    every: 6,
    when: all(
      world({ is: "blockade", min: 6 }),
      world({ is: "uboat", min: 1, max: 1 }),
    ),
  },
  ...asked,
];

const britishPapers: GwPaperBar[] = [
  { inst: "cabinet", max: -3, closes: ["major"], why: "cabinet" },
  { inst: "commons", max: -4, closes: ["other"], why: "commons" },
];

/** War bills and a blockade are for a Britain that is in the war. */
const britainIn = world({ is: "entered", tag: "GBR" });

const britishRules: GwInstRule[] = [
  {
    rule: "low_order",
    inst: "commons",
    at: 1,
    delta: -1,
    key: "commons_cools",
  },
  { rule: "lost_front", inst: "cabinet", delta: -1, key: "cabinet_shaken" },
  {
    rule: "call",
    scene: "gw_blockade_paper",
    every: 8,
    offset: 3,
    when: { kind: "all", of: [britainIn, world({ is: "blockade", max: 8 })] },
  },
  {
    rule: "call",
    scene: "gw_gbr_conscription",
    once: true,
    when: all(
      world({ is: "manpower", max: 65 }),
      world({ is: "war_age", min: 10 }),
      not(flag("f_gbr_conscript")),
    ),
  },
  ...asked,
];

const austrianRules: GwInstRule[] = [
  { rule: "lost_front", inst: "nations", delta: -1, key: "nations_stir" },
  {
    rule: "low_order",
    inst: "hungary",
    at: 1,
    delta: -1,
    key: "hungary_cools",
  },
  {
    rule: "levy",
    inst: "hungary",
    max: -1,
    gauge: "bread",
    delta: -1,
    every: 4,
    key: "bread_hungary_holds",
  },
  {
    rule: "wear",
    inst: "nations",
    max: -2,
    morale: 2,
    theatre: "east",
    unless: "auh_czech_regiments_sound",
    key: "regiments_walk_over",
  },
  {
    rule: "levy",
    inst: "nations",
    max: -3,
    gauge: "morale",
    delta: -1,
    every: 3,
    key: "morale_regiments",
  },
  // ww190: every nine months, not six, so the quota isn't a monthly chore.
  { rule: "call", scene: "gw_auh_quota", every: 9, first: true },
  ...asked,
];

const russianRules: GwInstRule[] = [
  { rule: "drift", inst: "stavka", delta: 1, every: 8, key: "stavka_grows" },
  {
    rule: "drift",
    inst: "duma",
    delta: -1,
    every: 7,
    offset: 3,
    key: "duma_cools",
  },
  { rule: "lost_front", inst: "ministers", delta: -1, key: "ministers_shaken" },
  { rule: "low_order", inst: "duma", at: 1, delta: -1, key: "duma_cools" },
  {
    rule: "levy",
    inst: "duma",
    max: -3,
    gauge: "order",
    delta: -1,
    every: 4,
    key: "order_duma_shut",
  },
  { rule: "call", scene: "gw_rus_session", every: 6, offset: 4 },
  {
    rule: "call",
    scene: "gw_rus_command",
    once: true,
    when: world({ is: "front", theatre: "east", from: "warsaw", to: "kiev" }),
  },
  {
    rule: "call",
    scene: "gw_rus_court",
    every: 9,
    offset: 5,
    when: world({ is: "war_age", min: 8 }),
  },
  ...asked,
];

/**
 * France: the Chamber cools with order, a lost front shakes it, the premier's
 * signature follows his trust, and the GQG gathers power while the war runs
 * (Joffre's autonomy) until a premier takes it back.
 */
const frenchRules = (letterAt: number, gqg: boolean): GwInstRule[] => [
  {
    rule: "low_order",
    inst: "chamber",
    at: 1,
    delta: -1,
    key: "chamber_cools",
  },
  { rule: "lost_front", inst: "chamber", delta: -1, key: "chamber_shaken" },
  {
    rule: "tracks",
    inst: "countersign",
    office: "chancellor",
    letterAt,
    key: "countersign_refused",
  },
  ...(gqg
    ? [
        {
          rule: "drift",
          inst: "army",
          delta: 1,
          every: 8,
          key: "gqg_grows",
        } as const,
      ]
    : []),
  ...asked,
];

const frenchPapers: GwPaperBar[] = [
  { inst: "chamber", max: -4, closes: ["other"], why: "chamber" },
  { inst: "countersign", max: -3, closes: ["major"], why: "countersign" },
  { inst: "army", min: 4, closes: ["hold"], why: "army" },
];

/** Form of government -> who can say no. "" is a country with no row yet. */
const FORMS: Readonly<Record<string, GwAuthorityRow>> = {
  "": NOBODY,
  empire: {
    law: GW_LAW_BODIES.reichstag,
    inst: { army: 0, reichstag: 0, countersign: 0 },
    rules: germanRules,
    papers: [
      { inst: "army", min: 2, closes: ["hold"], why: "army" },
      { inst: "army", min: 3, closes: ["other", "ally"], why: "army" },
    ],
    dismiss: [{ camp: "military", inst: "army", delta: -1 }],
  },
  republic: {
    law: GW_LAW_BODIES.republic,
    inst: { army: -2, reichstag: 3 },
    rules: [
      {
        rule: "low_order",
        inst: "reichstag",
        at: 1,
        delta: -1,
        key: "reichstag_cools",
      },
    ],
    papers: [],
    dismiss: [{ camp: "military", inst: "army", delta: -1 }],
  },
  liberal: {
    law: GW_LAW_BODIES.commons,
    inst: { cabinet: 1, commons: 1, opposition: 0, irish: 1, army: 0 },
    rules: [
      ...britishRules,
      {
        rule: "drift",
        inst: "opposition",
        delta: -1,
        every: 5,
        key: "opposition_presses",
      },
      {
        rule: "call",
        scene: "gw_gbr_coalition",
        once: true,
        when: world({ is: "war_age", min: 6 }),
      },
    ],
    papers: britishPapers,
    dismiss: [{ camp: "civil", inst: "cabinet", delta: -1 }],
  },
  coalition: {
    law: GW_LAW_BODIES.commons,
    inst: { cabinet: 0, commons: 2, opposition: 2, irish: 0, army: 0 },
    rules: [
      ...britishRules,
      {
        rule: "call",
        scene: "gw_gbr_war_cabinet",
        once: true,
        when: world({ is: "war_age", min: 20 }),
      },
    ],
    papers: britishPapers,
    dismiss: [
      { camp: "civil", inst: "cabinet", delta: -1 },
      { camp: "hard", inst: "opposition", delta: -1 },
    ],
  },
  war_cabinet: {
    law: GW_LAW_BODIES.commons,
    inst: { cabinet: 2, commons: 1, opposition: 1, irish: -1, army: 0 },
    rules: britishRules,
    papers: [{ inst: "commons", max: -4, closes: ["other"], why: "commons" }],
    dismiss: [{ camp: "hard", inst: "opposition", delta: -1 }],
  },
  national: {
    law: GW_LAW_BODIES.commons,
    inst: { cabinet: 1, commons: 0, opposition: 3, irish: -2, army: 0 },
    rules: britishRules,
    papers: [],
    dismiss: [{ camp: "any", inst: "opposition", delta: -1 }],
  },
  dual_monarchy: {
    law: GW_LAW_BODIES.hungary,
    inst: { hungary: 1, council: 2, nations: 0, berlin: 0, army: 2 },
    rules: austrianRules,
    papers: [
      { inst: "hungary", max: -3, closes: ["major"], why: "hungary" },
      { inst: "council", max: -3, closes: ["other"], why: "council" },
    ],
    dismiss: [{ camp: "any", inst: "council", delta: -1 }],
  },
  ff_throne: {
    law: GW_LAW_BODIES.hungary,
    inst: { hungary: -1, council: 1, nations: 1, berlin: 0, army: 2 },
    rules: austrianRules,
    papers: [{ inst: "hungary", max: -3, closes: ["major"], why: "hungary" }],
    dismiss: [{ camp: "magyar", inst: "hungary", delta: 1 }],
  },
  karl: {
    law: GW_LAW_BODIES.hungary,
    inst: { hungary: -1, council: 0, nations: -1, berlin: 0, army: 0 },
    rules: [
      ...austrianRules,
      {
        rule: "call",
        scene: "gw_auh_feeler",
        every: 6,
        offset: 1,
        when: world({ is: "score", max: 10 }),
      },
    ],
    papers: [{ inst: "hungary", max: -3, closes: ["major"], why: "hungary" }],
    dismiss: [{ camp: "military", inst: "council", delta: -1 }],
  },
  federation: {
    law: GW_LAW_BODIES.hungary,
    inst: { hungary: -3, nations: 1, berlin: 0 },
    rules: asked,
    papers: [{ inst: "hungary", max: -2, closes: ["major"], why: "hungary" }],
    dismiss: [],
  },
  austria_republic: {
    inst: { nations: 0, berlin: 0 },
    rules: asked,
    papers: [],
    dismiss: [],
  },
  crown_remnant: {
    inst: { council: 0, berlin: 0 },
    rules: asked,
    papers: [],
    dismiss: [],
  },
  tsar: {
    law: GW_LAW_BODIES.tsar,
    inst: { court: 1, stavka: 1, duma: 0, ministers: 0 },
    rules: russianRules,
    papers: [
      {
        inst: "stavka",
        min: 3,
        closes: ["hold"],
        why: "stavka",
        unlessCommand: true,
      },
      { inst: "court", max: -3, closes: ["other"], why: "court" },
    ],
    dismiss: [
      { camp: "any", inst: "court", delta: 1 },
      { camp: "civil", inst: "duma", delta: -1 },
      { camp: "civil", inst: "ministers", delta: -1 },
      { camp: "military", inst: "stavka", delta: -1 },
    ],
  },
  crown: {
    law: GW_LAW_BODIES.duma,
    inst: { court: -1, stavka: 1, duma: 2, ministers: 1 },
    rules: russianRules,
    papers: [{ inst: "duma", max: -3, closes: ["major"], why: "duma" }],
    dismiss: [
      { camp: "duma", inst: "duma", delta: -1 },
      { camp: "military", inst: "stavka", delta: -1 },
    ],
  },
  regency: {
    law: GW_LAW_BODIES.duma,
    inst: { court: -2, stavka: 0, duma: 1, ministers: 0 },
    rules: russianRules,
    papers: [{ inst: "stavka", min: 3, closes: ["hold"], why: "stavka" }],
    dismiss: [{ camp: "any", inst: "duma", delta: -1 }],
  },
  rep: {
    law: GW_LAW_BODIES.duma,
    inst: { duma: 1, soviet: 2, stavka: -2 },
    rules: asked,
    papers: [{ inst: "soviet", min: 2, closes: ["major"], why: "soviet" }],
    dismiss: [{ camp: "any", inst: "soviet", delta: 1 }],
  },
  provisional: {
    law: GW_LAW_BODIES.duma,
    inst: { duma: 2, soviet: 0, stavka: -1 },
    rules: [
      {
        rule: "drift",
        inst: "soviet",
        delta: 1,
        every: 2,
        key: "soviet_grows",
      },
      { rule: "drift", inst: "stavka", delta: -1, every: 3, key: "army_melts" },
      {
        rule: "levy",
        inst: "stavka",
        max: -3,
        gauge: "morale",
        delta: -1,
        every: 2,
        key: "morale_committees",
      },
      ...asked,
    ],
    papers: [{ inst: "soviet", min: 2, closes: ["major"], why: "soviet" }],
    dismiss: [{ camp: "any", inst: "soviet", delta: 1 }],
  },
  // France (ww166). The President asks for a removal; the Chamber minds it.
  fra_republic: {
    law: GW_LAW_BODIES.chambre,
    inst: { chamber: 1, senate: 1, countersign: 1, army: 0 },
    rules: frenchRules(-3, true),
    papers: frenchPapers,
    dismiss: [{ camp: "any", inst: "chamber", delta: -1 }],
  },
  fra_union: {
    law: GW_LAW_BODIES.chambre,
    inst: { chamber: 2, senate: 1, countersign: 1, army: 1 },
    rules: frenchRules(-3, true),
    papers: frenchPapers,
    dismiss: [{ camp: "any", inst: "chamber", delta: -1 }],
  },
  // Clemenceau's government: the GQG answers to him, his signature is dear.
  fra_tiger: {
    law: GW_LAW_BODIES.chambre,
    inst: { chamber: 1, senate: 2, countersign: 2, army: -1 },
    rules: frenchRules(-2, false),
    papers: [
      { inst: "chamber", max: -4, closes: ["other"], why: "chamber" },
      {
        inst: "countersign",
        max: -1,
        closes: ["major", "other"],
        why: "countersign",
      },
    ],
    dismiss: [
      { camp: "any", inst: "chamber", delta: -1 },
      { camp: "any", inst: "countersign", delta: -1 },
    ],
  },
  fra_defeat: {
    law: GW_LAW_BODIES.chambre,
    inst: { chamber: -1, senate: 0, countersign: 0 },
    rules: asked,
    papers: [],
    dismiss: [{ camp: "any", inst: "chamber", delta: -1 }],
  },
};

/**
 * Form of government -> who can say no. ww208 merge: the utopias' forms
 * (Regimes.ts) take the bodies of the form nearest them.
 */
export const GW_AUTHORITY: Readonly<Record<string, GwAuthorityRow>> = {
  ...FORMS,
  deu_parl: FORMS.republic,
  deu_soviet: FORMS.republic,
  gbr_labour: FORMS.national,
  auh_federal_crown: FORMS.federation,
  auh_trial: FORMS.federation,
  rus_soviet: FORMS.rep,
  fra_crown: FORMS.fra_republic,
};

/** What each camp makes of a question laid before the cabinet. */
export const GW_ISSUE_TABLE: Readonly<
  Record<GwIssue, Readonly<Record<string, number>>>
> = {
  entry: { hard: 2, unionist: 2, military: 1, moderate: -1, liberal: -1 },
  bef: { hard: 2, military: 2, west: 1, moderate: -1 },
  straits: { east: 2, west: -2, hard: 1 },
  evacuate: { west: 2, east: -2, moderate: 1 },
  conscription: {
    hard: 2,
    military: 2,
    unionist: 2,
    liberal: -1,
    labour: -2,
    moderate: -1,
  },
  home_rule: { irish: 3, liberal: 1, moderate: 2, unionist: -3, hard: -2 },
  committee: { hard: 1, unionist: 1, liberal: -1 },
  flanders: { west: 2, military: 1, east: -1, moderate: -1 },
  coalition: { unionist: 2, hard: 1, moderate: -1, liberal: -1 },
  tighten_blockade: { hard: 2, moderate: -1 },
  peace_talks: { moderate: 2, labour: 2, hard: -2, military: -2 },
};
