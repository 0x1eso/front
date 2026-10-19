import {
  DomesticData,
  GOVERNMENT_IDS,
  LAW_IDS,
  TECH_IDS,
  TechId,
  VICTORY_PROJECT_KINDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  LAW_COOLDOWN_TICKS,
  MILLI,
  TECHS_REQUIRED_FROM_PREVIOUS_ERA,
} from "@openfront/engine-lib/domestic/Balance";
import { governmentBlock } from "@openfront/engine-lib/domestic/Governments";
import { lawBlock, lawCost } from "@openfront/engine-lib/domestic/Laws";
import { researchBlock } from "@openfront/engine-lib/domestic/Research";
import { projectProgress } from "@openfront/engine-lib/domestic/Score";
import { Branch, Era, TECHS } from "@openfront/engine-lib/domestic/Techs";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import type { DomesticClientView } from "../../view/DomesticClientView";

// What the domestic dials and screens show, worked out from the last
// DomesticData the worker sent. No rendering here, so it can be tested alone.

const TICKS_PER_SECOND = 10;

/** One emoji per technology: the dial, the tree node and the detail sheet. */
export const TECH_ICONS: Readonly<Record<TechId, string>> = {
  currency: "🪙",
  navigation: "⛵",
  fortification: "🏰",
  academia: "🎓",
  bureaucracy: "📋",
  railroad: "🚂",
  banking: "🏦",
  steel_ships: "🚢",
  conscription: "🪖",
  scientific_method: "🧪",
  printing_press: "📰",
  industrialization: "🏭",
  global_trade: "🌐",
  rocketry: "🚀",
  radar: "📡",
  manhattan_project: "☢️",
  computers: "💻",
  globalization: "🌍",
  thermonuclear: "💥",
  mirv: "🎯",
  space_program: "🛰️",
};

export const TREE_ERAS: readonly Era[] = [1, 2, 3, 4];
export const TREE_BRANCHES: readonly Branch[] = [
  "economy",
  "military",
  "learning",
];

/**
 * The research tree, top to bottom: each era's techs per branch column. A
 * prerequisite sits right above the tech that needs it (in the same era, or
 * last in the era above), so one short line joins them.
 */
export const TECH_TREE: Readonly<
  Record<Era, Readonly<Record<Branch, readonly TechId[]>>>
> = {
  1: {
    economy: ["currency", "navigation"],
    military: ["fortification"],
    learning: ["academia", "bureaucracy"],
  },
  2: {
    economy: ["railroad", "banking"],
    military: ["steel_ships", "conscription"],
    learning: ["scientific_method", "printing_press"],
  },
  3: {
    economy: ["industrialization", "global_trade"],
    military: ["radar", "rocketry", "manhattan_project"],
    learning: ["computers"],
  },
  4: {
    economy: ["globalization"],
    military: ["thermonuclear", "mirv"],
    learning: ["space_program"],
  },
};

/** The tech drawn right above `id` in its column (across an era gate), or null. */
export function techAbove(id: TechId): TechId | null {
  const { era, branch } = TECHS[id];
  const column = TECH_TREE[era][branch];
  const i = column.indexOf(id);
  if (i > 0) return column[i - 1];
  if (era === 1) return null;
  const prev = TECH_TREE[(era - 1) as Era][branch];
  return prev.length > 0 ? prev[prev.length - 1] : null;
}

/** Whether a prerequisite line joins `id` to the tech right above it. */
export function linkedToAbove(id: TechId): boolean {
  const above = techAbove(id);
  return above !== null && TECHS[id].prereqs.includes(above);
}

/** Whether a prerequisite line leaves `id` for the tech right below it. */
export function linkedToBelow(id: TechId): boolean {
  return TECH_IDS.some((t) => techAbove(t) === id && linkedToAbove(t));
}

/** Whole seconds until `missing` points come in at `perSec`; null if they never do. */
export function secondsUntil(missing: number, perSec: number): number | null {
  if (missing <= 0) return 0;
  if (!(perSec > 0)) return null;
  return Math.ceil(missing / perSec);
}

export type TechNodeKind =
  | "done"
  | "researching"
  | "available"
  | "short"
  | "locked";

export interface TechNodeState {
  kind: TechNodeKind;
  /** locked: the era gate, or a missing prerequisite. */
  lock: "era" | "prereq" | null;
  /** locked by "prereq": the first prerequisite still missing. */
  missing: TechId | null;
  /** short: seconds until the science is in at today's rate (null: never). */
  secondsUntil: number | null;
  /** It is the reserved next research. */
  queued: boolean;
}

/**
 * A tree node's state. "available" and "short" ignore a running research:
 * they say whether the tech is open and paid for, so the player sees what
 * can follow it.
 */
export function techNodeState(
  d: DomesticData,
  researched: ReadonlySet<TechId>,
  id: TechId,
  cost: number = TECHS[id].cost,
): TechNodeState {
  const state: TechNodeState = {
    kind: "available",
    lock: null,
    missing: null,
    secondsUntil: null,
    queued: (d.queuedTech ?? null) === id,
  };
  if (researched.has(id)) return { ...state, kind: "done" };
  if (d.research?.tech === id) return { ...state, kind: "researching" };
  const block = researchBlock(researched, false, id);
  if (block === "era") return { ...state, kind: "locked", lock: "era" };
  if (block === "prereq") {
    return {
      ...state,
      kind: "locked",
      lock: "prereq",
      missing: TECHS[id].prereqs.find((p) => !researched.has(p)) ?? null,
    };
  }
  if (d.science >= cost) return state;
  return {
    ...state,
    kind: "short",
    secondsUntil: secondsUntil(cost - d.science, d.sciencePerSec),
  };
}

/** Techs of `era` researched, against the TECHS_REQUIRED_FROM_PREVIOUS_ERA gate. */
export function eraGate(
  researched: ReadonlySet<TechId>,
  era: Era,
): { have: number; need: number } {
  let have = 0;
  for (const t of researched) if (TECHS[t].era === era) have++;
  return { have, need: TECHS_REQUIRED_FROM_PREVIOUS_ERA };
}

export interface ResearchDial {
  /**
   * researching: a research runs; available: idle and an open tech is paid
   * for; short: idle, the cheapest open tech still needs science; none:
   * nothing left to research.
   */
  kind: "researching" | "available" | "short" | "none";
  /** Ring fill, 0..1: the research done, or the science toward the cheapest open tech. */
  progress: number;
  /** researching: the tech and its seconds left. */
  tech: TechId | null;
  secondsLeft: number | null;
  queued: TechId | null;
}

export function researchDial(d: DomesticData): ResearchDial {
  const queued = d.queuedTech ?? null;
  const r = d.research;
  if (r !== null) {
    return {
      kind: "researching",
      progress: r.totalTicks > 0 ? 1 - r.ticksLeft / r.totalTicks : 1,
      tech: r.tech,
      secondsLeft: Math.ceil(r.ticksLeft / TICKS_PER_SECOND),
      queued,
    };
  }
  const researched = new Set<TechId>(d.techs);
  let cheapest: number | null = null;
  for (const id of TECH_IDS) {
    if (researchBlock(researched, false, id) !== null) continue;
    cheapest = Math.min(cheapest ?? Infinity, TECHS[id].cost);
  }
  const idle = { tech: null, secondsLeft: null, queued };
  if (cheapest === null) return { ...idle, kind: "none", progress: 0 };
  if (d.science >= cheapest) return { ...idle, kind: "available", progress: 1 };
  return { ...idle, kind: "short", progress: d.science / cheapest };
}

/** Whether some government of the reached tier can be adopted now. */
export function canChooseGovernment(view: DomesticClientView): boolean {
  const d = view.data;
  return GOVERNMENT_IDS.some(
    (g) =>
      governmentBlock(d.governmentTier, d.government, view.laws(), g) === null,
  );
}

export interface LawsDial {
  /**
   * cooldown: no law for a while after the last law or government; available:
   * a law is open and paid for; short: open but the political power isn't in
   * yet; none: no law is open (all proclaimed, or the rest need a tech).
   */
  kind: "cooldown" | "available" | "short" | "none";
  /** cooldown: the share of the cooldown still to run; short: power toward the cost. */
  progress: number;
  /** cooldown: seconds left; short: seconds until the power is in (null: never). */
  seconds: number | null;
  /** The next law's political power cost. */
  cost: number;
  /** A new government can be chosen: the dial wears a badge. */
  government: boolean;
}

export function lawsDial(view: DomesticClientView, nowTick: number): LawsDial {
  const d = view.data;
  const cost = lawCost(view.laws().size, view.pct("lawCost"));
  const government = canChooseGovernment(view);
  const cooldown = d.lawCooldownUntilTick - nowTick;
  if (cooldown > 0) {
    return {
      kind: "cooldown",
      progress: Math.min(1, cooldown / LAW_COOLDOWN_TICKS),
      seconds: Math.ceil(cooldown / TICKS_PER_SECOND),
      cost,
      government,
    };
  }
  const open = LAW_IDS.some(
    (law) =>
      lawBlock(law, view.laws().get(law), view.researchedTechs(), 0, 0) ===
      null,
  );
  if (!open)
    return { kind: "none", progress: 0, seconds: null, cost, government };
  if (d.political >= cost) {
    return { kind: "available", progress: 1, seconds: null, cost, government };
  }
  return {
    kind: "short",
    progress: d.political / cost,
    seconds: secondsUntil(cost - d.political, d.politicalPerSec),
    cost,
    government,
  };
}

/** What the victory dial reads of the player. */
export interface ProjectHostSource {
  gold(): bigint;
  units(type: UnitType): readonly {
    level(): number;
    isUnderConstruction(): boolean;
  }[];
}

export interface VictoryDial {
  /**
   * running: my project runs (or just finished); ready: a project can start
   * now; qualified: a project's requirement is met, but a host, gold or
   * political power is still missing.
   */
  kind: "running" | "ready" | "qualified";
  progress: number;
  /** running: held back while attacking (political project). */
  paused: boolean;
}

/** The trophy dial, or null while no victory project is open or running. */
export function victoryDial(
  d: DomesticData,
  me: ProjectHostSource,
  infiniteGold: boolean,
): VictoryDial | null {
  if (d.project !== undefined) {
    return {
      kind: "running",
      progress: projectProgress(d.project),
      paused: d.project.paused,
    };
  }
  let qualified = false;
  let ready = false;
  for (const kind of VICTORY_PROJECT_KINDS) {
    if (
      !projectQualified(
        kind,
        d.techs.includes("space_program"),
        d.governmentTier,
      )
    ) {
      continue;
    }
    qualified = true;
    const def = VICTORY_PROJECTS[kind];
    for (const host of me.units(def.hostType)) {
      if (host.isUnderConstruction()) continue;
      const block = victoryProjectBlock(kind, {
        busy: false,
        qualified: true,
        hostLevel: host.level(),
        // Like VictoryProjectExecution: infinite gold always pays.
        gold: infiniteGold ? def.goldCost : me.gold(),
        politicalMilli: d.political * MILLI,
      });
      if (block === null) ready = true;
    }
  }
  if (!qualified) return null;
  return { kind: ready ? "ready" : "qualified", progress: 0, paused: false };
}
