// Great War 1914: statecraft rows (brief ww157). One file of rows per country
// in content/craft/<tag>.ts, its text in resources/ww1914/ko/<TAG>.craft.json:
// a later country adds a file, no code. engine/ww1914/Craft runs them. See
// /home/eser/dev/ww157-format.md.
import type {
  GwGauge,
  GwInstitution,
  GwTech,
  GwTheatre,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import type { GwShortage } from "@openfront/engine-api/ww1914/GwCraft";
import type {
  GwCastRule,
  GwCond,
  GwEffect,
  GwVariant,
} from "@openfront/engine-api/ww1914/SceneDsl";

/** What a standing rule does on the war's months: `every` months, from `offset`. */
export interface GwCraftTerm {
  readonly gauge: GwGauge;
  readonly delta: number;
  readonly every: number;
  readonly offset?: number;
}

/**
 * An invention. Its four papers are made from the row (content/scenes/craft):
 * `<id>` the proposal (back / quiet / refuse), `<id>_ok` the trial worked
 * (field now / wait), `<id>_fail` it didn't (retry / drop), `<id>_used` how it
 * went at the front (variants `early`, `base`).
 */
export interface GwInventionRow {
  readonly id: string;
  readonly tag: GwTag;
  /** A person id: in the people files, or a row in the pack's `people`. */
  readonly inventor: string;
  /** The proposal comes the first chapter this holds. */
  readonly opens: GwCond;
  /** The body against it: backing it goes over them, at `price` authority. */
  readonly against?: GwInstitution;
  readonly price?: number;
  /** Chapters the prototype takes (twice that when backed quietly). */
  readonly build: number;
  /** Percent the trial works; each retry adds 20. */
  readonly trial: number;
  /** Chapters after a good trial before fielding it is no longer early. */
  readonly ripe: number;
  /** While fielded: percent on the odds in these theatres (all with none). */
  readonly edge?: {
    readonly theatres?: readonly GwTheatre[];
    readonly attack?: number;
    readonly defence?: number;
  };
  /** Counted as research reached once fielded: the period's own edge. */
  readonly tech?: GwTech;
  /** Shortages it answers for good once fielded. */
  readonly solves?: readonly GwShortage[];
  /** Once, when fielded: a sea edge, a gauge, a bloc. */
  readonly fielded?: readonly GwEffect[];
  /** More people for its papers; `inventor` is always cast. */
  readonly cast?: Readonly<Record<string, GwCastRule>>;
  /** Bodies of the proposal before the base. */
  readonly variants?: readonly GwVariant[];
}

/** Full edge lasts this long after a ripe fielding; then half, as the enemy learns. */
export const GW_SURPRISE_CHAPTERS = 4;
/** Authority backing an invention over its body costs, when the row sets none. */
export const GW_OVERRULE_PRICE = 10;
/** Percent a retry adds to the trial. */
export const GW_RETRY_BONUS = 20;

/**
 * One great project of the year. The pick is `<tag>_agenda`, made from the
 * rows. Its chapters are scenes the country's file writes: `<id>_prep`,
 * `<id>_opp`, `<id>_exec`, then `<id>_done` or `<id>_fail`. All are
 * `scheduledOnly`; the person in charge fills a `{ called: true }` role.
 */
export interface GwProjectRow {
  readonly id: string;
  readonly tag: GwTag;
  /** On the year's list (greyed when this doesn't hold). */
  readonly opens?: GwCond;
  /** Who is put in charge when it starts. */
  readonly lead: GwCastRule;
  /** Percent it gets done, before the chapters' choices. */
  readonly odds: number;
  /** National aims it serves: +15 while one of them is declared. */
  readonly aims?: readonly string[];
  /** Months between its chapters (2 if absent). */
  readonly months?: number;
  /** Once, when picked: what it asks of the blocs and the budget. */
  readonly start?: readonly GwEffect[];
  /** What it gets done. */
  readonly done: readonly GwEffect[];
  readonly failed?: readonly GwEffect[];
}

/** Percent for each step of the lead's admin skill above or below the middle. */
export const GW_PROJECT_SKILL = 10;
export const GW_PROJECT_AIM = 15;
/** What `push` and `slow` move the odds by. */
export const GW_PROJECT_PUSH = 15;

/** A country's two steps up: to the war economy, to total mobilisation. */
export interface GwFootingRow {
  readonly tag: GwTag;
  readonly steps: readonly [GwFootingStep, GwFootingStep];
}

export interface GwFootingStep {
  /** The big scene; its decide that raises runs `doWorld({do:"footing"})`. */
  readonly scene: string;
  /** The country tab can ask for it only while this holds. */
  readonly opens?: GwCond;
  /** In place of GW_FOOTING_TERMS for this country. */
  readonly raise?: readonly GwEffect[];
  readonly terms?: readonly GwCraftTerm[];
}

/** What each step does, unless the row says otherwise: [war economy, total]. */
export const GW_FOOTING_RAISE: readonly (readonly GwEffect[])[] = [
  [{ kind: "gauge", gauge: "order", delta: -1 }],
  [
    { kind: "gauge", gauge: "order", delta: -1 },
    { kind: "gauge", gauge: "bread", delta: -1 },
  ],
];
export const GW_FOOTING_TERMS: readonly (readonly GwCraftTerm[])[] = [
  [
    { gauge: "shells", delta: 1, every: 3 },
    { gauge: "bread", delta: -1, every: 6, offset: 2 },
  ],
  [
    { gauge: "shells", delta: 1, every: 2 },
    { gauge: "bread", delta: -1, every: 4, offset: 1 },
    { gauge: "order", delta: -1, every: 6, offset: 3 },
  ],
];

/** A raw material running short: the event comes, the drag runs until answered. */
export interface GwShortageRow {
  readonly id: GwShortage;
  readonly tag: GwTag;
  /** What brings it on: the blockade, trade cut, months of war. */
  readonly when: GwCond;
  /** The event (written in the country's file, `scheduledOnly`). */
  readonly scene: string;
  readonly drag: readonly GwCraftTerm[];
}

/** The chapters of a project, in the order they come. */
export const GW_PROJECT_SCENES = [
  "prep",
  "opp",
  "exec",
  "done",
  "fail",
] as const;

/**
 * Every scene the statecraft engine lays on the desk itself, from the rows: a
 * scheduledOnly scene here has its scheduler (SceneCheck's `outside`).
 */
export function craftCalledScenes(rows: {
  readonly inventions?: readonly GwInventionRow[];
  readonly projects?: readonly GwProjectRow[];
  readonly footing?: readonly GwFootingRow[];
  readonly shortages?: readonly GwShortageRow[];
}): string[] {
  const projects = rows.projects ?? [];
  const tags = [...new Set(projects.map((r) => r.tag))];
  return [
    ...(rows.inventions ?? []).flatMap((r) =>
      ["", "_ok", "_fail", "_used"].map((x) => `${r.id}${x}`),
    ),
    ...tags.map((t) => `${t.toLowerCase()}_agenda`),
    ...projects.flatMap((r) => GW_PROJECT_SCENES.map((x) => `${r.id}_${x}`)),
    ...(rows.footing ?? []).flatMap((r) => r.steps.map((s) => s.scene)),
    ...(rows.shortages ?? []).map((r) => r.scene),
  ];
}
