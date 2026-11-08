// Great War 1914: the house and its factions (brief ww158). One file of rows per
// country in content/house/<tag>.ts, text in resources/ww1914/ko/<TAG>.house.json:
// a later country adds rows, no code. engine/ww1914/House runs S1 (factions,
// the count, the whip, the way round); the S2 files run plots, the dossier and
// allies' asks. See /home/eser/dev/ww158-format.md.
import type {
  GwCamp,
  GwInstitution,
  GwOffice,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type {
  GwAround,
  GwAskKind,
  GwChamber,
  GwFactionStatus,
  GwWeakness,
} from "@openfront/engine-api/ww1914/GwHouse";
import type { GwBloc } from "@openfront/engine-api/ww1914/GwPress";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
} from "@openfront/engine-api/ww1914/SceneDsl";

/** -1 against, 0 stays away, +1 for. */
export type GwSide = -1 | 0 | 1;

/** A chamber of the country's house. */
export interface GwChamberRow {
  readonly id: GwChamber;
  /** Its mood in the count (`inst[...]`); none: 0. */
  readonly inst?: GwInstitution;
  /**
   * vote: the count passes or fails it. consent: the same, and it fails too
   * while `consent`'s side is 0 or less. lords: below zero it only delays a
   * bill, `GW_LORDS_DELAY` chapters, never a money bill.
   */
  readonly kind: "vote" | "consent" | "lords";
  readonly consent?: string;
  /** It sits now (a bill can't pass a chamber that doesn't); absent: always. */
  readonly sits?: GwCond;
  /** It can bring a bill by itself: a motion, a Duma bill. */
  readonly starts?: boolean;
  /** A bill meets it only if the bill's `houses` names it. */
  readonly optional?: boolean;
}

/** The way round the house, where the constitution has one. */
export interface GwAroundRow {
  readonly id: GwAround;
  /** The door is open now: the Duma not sitting, the Reichsrat closed. */
  readonly when?: GwCond;
  /** Authority it costs. */
  readonly price: number;
  /** The chamber's weight it costs. */
  readonly inst?: GwInstitution;
  readonly delta?: number;
  /** The chambers it goes past; the others still vote. */
  readonly skips: readonly GwChamber[];
  /** Factions it heats, and by how much. */
  readonly heats: readonly { readonly faction: string; readonly by: number }[];
}

/** A country's house: its chambers, its counter, its way round. */
export interface GwHouseRow {
  readonly tag: GwTag;
  /** In the order a bill meets them. */
  readonly chambers: readonly GwChamberRow[];
  /** The house's counter: the whip, Helfferich, Gulland, Tisza himself. */
  readonly whip: GwCastRule;
  readonly around?: GwAroundRow;
  /** S2: who brings files and plot signs (the police's chief). */
  readonly police?: GwCastRule;
  /** A bill the house passes goes to the sovereign to sign or refuse. */
  readonly signs?: boolean;
}

/** A line that moves a faction's strength, every `every` months while it holds. */
export interface GwGrowLine {
  readonly when: GwCond;
  readonly by: number;
  readonly every: number;
  /** Pack factions.<id>.why.<key>. */
  readonly key: string;
}

/** A line that heats (feeds) or cools a faction every month it holds. */
export interface GwTemperLine {
  readonly when: GwCond;
  readonly key: string;
  /** Heat a month; 1 if absent. */
  readonly by?: number;
}

/** What a leader asks for a bill: his price. */
export interface GwWant {
  /** `office_interior`, `amnesty`, `unions_next`: pack lobby talk says.<id>. */
  readonly id: string;
  /** He names it only while this holds. */
  readonly when?: GwCond;
  /** Taken: a promise to him, kept by itself the chapter this holds. */
  readonly keep?: GwCond;
  /** Chapters until it is due; 6 if absent. */
  readonly chapters?: number;
  /** Paid at once when taken. */
  readonly effects?: readonly GwEffect[];
  /** The scene he comes back with if it is broken; the common one if absent. */
  readonly back?: string;
}

export interface GwFactionRow {
  /** `deu_spd`. Text: pack factions.<id>. */
  readonly id: string;
  readonly tag: GwTag;
  /** Its bloc: the bloc's support is its mood. */
  readonly bloc: GwBloc;
  /** The first active one that fits leads it. */
  readonly leaders: readonly {
    readonly person: string;
    readonly when?: GwCond;
  }[];
  /** Who replaces the leader at temper 3 (the moderates give way). */
  readonly radical?: string;
  /** Its weight in each chamber it sits in. */
  readonly seats: Readonly<Partial<Record<GwChamber, number>>>;
  /** Where it starts. */
  readonly start: Exclude<GwFactionStatus, "merged">;
  /** Strength at the start, 0..4; 2 if absent. */
  readonly strength?: number;
  readonly grows?: readonly GwGrowLine[];
  readonly feeds?: readonly GwTemperLine[];
  readonly cools?: readonly GwTemperLine[];
  /**
   * Heat thresholds of tempers 2, 3 and 4 (4 only with a `plot`), each with its
   * scene (`scheduledOnly`). Below the first, any heat is temper 1.
   */
  readonly steps?: readonly { readonly at: number; readonly scene: string }[];
  /** Bills of its own: law ids. Its leader asks for them at strength 2+. */
  readonly bills?: readonly string[];
  /** Its price, in order: the first that holds is what he names. */
  readonly wants?: readonly GwWant[];
  /** Law id -> the text of that bill it would vote for: its amendment. */
  readonly amends?: Readonly<Record<string, string>>;
  /** It splits: the new faction goes `in` with its leader, taking strength. */
  readonly splits?: {
    readonly when: GwCond;
    readonly into: string;
    readonly takes: number;
    readonly scene?: string;
  };
  /** It joins others into a new one; parts again if `parts` holds. */
  readonly joins?: {
    readonly with: readonly string[];
    readonly when: GwCond;
    readonly into: string;
    readonly parts?: GwCond;
    readonly scene?: string;
  };
  /** S2: the plot behind it (a plot row id). */
  readonly plot?: string;
  /** Camps it shares with ministers: a sponsor of one warms it to his bill. */
  readonly camps?: readonly GwCamp[];
}

/** What the house makes of a bill: kept apart from the law row, by law id. */
export interface GwBillRow {
  /** A row of GW_LAWS. */
  readonly law: string;
  /** Each faction's side on the bill as drafted. */
  readonly stance: Readonly<Record<string, GwSide>>;
  /** Text id -> the factions whose side that text changes. */
  readonly texts?: Readonly<Record<string, Readonly<Record<string, GwSide>>>>;
  /** The chambers it must pass; absent: every chamber of the house. */
  readonly houses?: readonly GwChamber[];
  /** A money bill: the Lords can't delay it. */
  readonly money?: boolean;
  /** It can go round the house (the law row's `decree` must be true too). */
  readonly around?: boolean;
  /** Who drafts it: absent, the law row's first cast role. */
  readonly sponsor?: GwCastRule;
  /** A faction's own bill. */
  readonly by?: string;
  /** No term, only effects: a resolution (the peace resolution). */
  readonly resolution?: boolean;
}

// ---- S2 shapes: plots, the dossier, allies ----

/** A plot: a threat row (engine GovTable's shape) with signs and a warning. */
export interface GwPlotRow {
  readonly id: string;
  readonly tag: GwTag;
  readonly regimes: readonly string[];
  /** YYYY-MM: nothing before it. */
  readonly from: string;
  readonly unless?: string;
  readonly feeds: readonly {
    readonly when: GwCond;
    readonly key: string;
    readonly by?: number;
    readonly quiet?: boolean;
  }[];
  /** Scenes in order, each with the heat it comes at. */
  readonly steps: readonly { readonly at: number; readonly scene: string }[];
  readonly rest: number;
  /** Its last step can end the game: only for `end: "removed"`. */
  readonly fatal: boolean;
  readonly plot: {
    /** Its factions. */
    readonly by: readonly string[];
    /** Signs, each at a heat, through a paper, a talk or a police report. */
    readonly signs: readonly {
      readonly at: number;
      readonly scene: string;
      readonly via: "paper" | "talk" | "report";
    }[];
    /** The plain warning, at least two chapters before the fatal step. */
    readonly warn: string;
    /** removed: the ruler goes (court, army). gbr_table: the fall track. unrest: the ladder. */
    readonly end: "removed" | "gbr_table" | "unrest";
  };
}

/** A person's possible weaknesses: the seed decides which are true each game. */
export interface GwWeakRow {
  readonly person: string;
  /** Percent each is true. */
  readonly weak: readonly { readonly id: GwWeakness; readonly odds: number }[];
}

/** An ally's ask. */
export interface GwAskRow {
  readonly id: string;
  readonly tag: GwTag;
  /** The ally whose head asks. */
  readonly from: GwTag;
  readonly kind: GwAskKind;
  readonly when: GwCond;
  /** The letter or the ambassador's paper (`scheduledOnly`). */
  readonly scene: string;
  /** Kept by itself the chapter this holds. */
  readonly keep: GwCond;
  /** Chapters to keep it. */
  readonly chapters: number;
  /** kind `law`: the bill it starts with `ally` origin. */
  readonly law?: string;
  /** Paid when kept, and when broken. */
  readonly kept?: readonly GwEffect[];
  readonly broken?: readonly GwEffect[];
  /**
   * A conference (ww150 big scene, face to face): the envoy's word on the ally
   * is filed first, and the scene comes a chapter after it.
   */
  readonly conference?: boolean;
}

// ---- S2 rules ----

/** Signs a plot must have shown before its last step: the fair warning. */
export const GW_PLOT_SIGNS = 2;
/** Chapters between the warning and the last step, at least. */
export const GW_PLOT_WARN_GAP = 2;
/** Heat the cabal's end puts on Britain's fall track (`gbr_table`). */
export const GW_PLOT_TABLE_HEAT = 6;
/** Months between the police's word on a plot. */
export const GW_POLICE_EVERY = 3;
/** Months between files the police bring unasked. */
export const GW_POLICE_FILE_EVERY = 6;
/** Chapters a true file holds a faction's leader to the seat's word. */
export const GW_HELD_CHAPTERS = 2;
/** Percent a used file comes out: base, each use after the first, a cunning man. */
export const GW_EXPOSE_PCT = 10;
export const GW_EXPOSE_PER_USE = 10;
export const GW_EXPOSE_CUNNING = 15;
/** Percent the police's file act is found out by its man. */
export const GW_FILE_CAUGHT = 20;

/**
 * Never in a file: the head of state and the ruler's family (the owner's rule).
 * The head is also left out by the engine whoever he is.
 */
export const GW_NO_FILE: readonly string[] = [
  "deu_wilhelm",
  "deu_empress",
  "deu_heir",
  "gbr_george_v",
  "gbr_margot",
  "auh_franz_joseph",
  "auh_ff",
  "auh_karl",
  "auh_zita",
  "auh_friedrich",
  "auh_wilhelm",
  "auh_schratt",
  "rus_nicholas",
  "rus_alexandra",
  "rus_maria",
  "rus_olga",
  "rus_olga_a",
  "rus_ella",
  "rus_michael",
  "rus_nikolasha",
  "rus_dmitri",
  "rus_sandro",
  "rus_kr",
  "rus_sergei_m",
];

/** The dossier's papers, per country (text in `<TAG>.house.json`). */
export const dossierIds = {
  /** The schedule's entry: the police open a file on one man. */
  act: (tag: GwTag) => `${tag.toLowerCase()}_a_file`,
  /** The police's paper with the file asked for (cast police, target). */
  report: (tag: GwTag) => `gw_df_${tag.toLowerCase()}`,
  /** The police bring one unasked (cast police, target). */
  unasked: (tag: GwTag) => `gw_du_${tag.toLowerCase()}`,
  /** The man learns he was watched (cast target): a decision. */
  caught: (tag: GwTag) => `gw_dc_${tag.toLowerCase()}`,
  /** A file came out: the scandal (cast target). */
  scandal: (tag: GwTag) => `gw_dx_${tag.toLowerCase()}`,
} as const;

// ---- Rules ----

/** Extra calls a chapter for the moving bill's leaders (owner's call 2). */
export const GW_HOUSE_CALLS = 2;
/** Chapters the Lords can put a bill off. */
export const GW_LORDS_DELAY = 3;
/** Asks ignored that make a strong faction bring its bill itself (owner's call 6). */
export const GW_IGNORED_LIMIT = 2;
/** Strength a faction needs to ask for its bill, and to bring it itself. */
export const GW_ASK_STRENGTH = 2;
export const GW_BRING_STRENGTH = 3;
/** Chapters between a leader's asks. */
export const GW_ASK_GAP = 4;
/** Months one ignored ask fades. */
export const GW_IGNORED_FADE = 6;
/** Heat a refused ask adds. */
export const GW_REFUSED_HEAT = 2;
/** Percent the sponsor wins over the faction he works, by politics band 1..3. */
export const GW_SPONSOR_ODDS: readonly number[] = [25, 50, 75];
/** The whip's error, either way, by politics band 1..3. */
export const GW_WHIP_SPREAD: readonly number[] = [2, 1, 0];

/** Scene ids the house makes. */
export const houseIds = {
  draft: (law: string) => `gw_ld_${law}`,
  lobby: (faction: string) => `gw_lb_${faction}`,
  visit: (faction: string) => `gw_fv_${faction}`,
  result: (tag: GwTag) => `gw_lr_${tag.toLowerCase()}`,
  sign: (tag: GwTag) => `gw_ls_${tag.toLowerCase()}`,
} as const;

/** The office a cast rule names, if it names one (for the sponsor picker). */
export function ruleOffice(rule: GwCastRule): GwOffice | null {
  if ("office" in rule && !("tag" in rule)) return rule.office;
  if ("any_of" in rule) {
    for (const r of rule.any_of) {
      if ("office" in r && !("tag" in r)) return r.office;
    }
  }
  return null;
}

/** Every content shape of the house, as GwContent carries it. */
export interface GwHouseContent {
  readonly houses?: readonly GwHouseRow[];
  readonly factions?: readonly GwFactionRow[];
  readonly bills?: readonly GwBillRow[];
  readonly plots?: readonly GwPlotRow[];
  readonly weak?: readonly GwWeakRow[];
  readonly asks?: readonly GwAskRow[];
}

/**
 * Every scene the house lays on the desk itself, from the rows: a
 * scheduledOnly scene here has its scheduler (SceneCheck's `outside`).
 */
export function houseCalledScenes(rows: GwHouseContent): string[] {
  return [
    ...(rows.houses ?? []).map((h) => houseIds.result(h.tag)),
    ...(rows.houses ?? []).flatMap((h) =>
      h.signs === true ? [houseIds.sign(h.tag)] : [],
    ),
    ...(rows.factions ?? []).flatMap((f) => [
      ...((f.bills ?? []).length > 0 ? [houseIds.visit(f.id)] : []),
      ...(f.steps ?? []).map((s) => s.scene),
      ...(f.splits?.scene === undefined ? [] : [f.splits.scene]),
      ...(f.joins?.scene === undefined ? [] : [f.joins.scene]),
      ...(f.wants ?? []).flatMap((w) => (w.back === undefined ? [] : [w.back])),
    ]),
    ...(rows.plots ?? []).flatMap((p) => [
      ...p.steps.map((s) => s.scene),
      ...p.plot.signs.map((s) => s.scene),
      p.plot.warn,
    ]),
    ...(rows.asks ?? []).map((a) => a.scene),
    ...dossierTags(rows).flatMap((t) => [
      dossierIds.unasked(t),
      dossierIds.scandal(t),
    ]),
  ];
}

/** Countries with people the police can open files on, and a house to run them. */
export function dossierTags(rows: GwHouseContent): GwTag[] {
  return (rows.houses ?? [])
    .map((h) => h.tag)
    .filter((t) =>
      (rows.weak ?? []).some((w) => w.person.startsWith(`${t.toLowerCase()}_`)),
    );
}
