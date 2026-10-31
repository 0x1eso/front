// Research overhaul phase 2 (changes §4, §6): the research tree's model —
// the layout of one tab (year axis, rows, prerequisite lines), the node
// looks and badges, the bonus sources, the "next" suggestion. Pure: no DOM.
import {
  RESEARCH_LEANS,
  TECH_BRANCHES,
  WW_TECH_IDS,
  WwCountryDetail,
  WwTechId,
} from "@openfront/engine-api/ww1936/EconomyTypes";
import { aheadPct } from "@openfront/engine-lib/ww1936/EconomyRules";
import { researchScores } from "@openfront/engine-lib/ww1936/ResearchScore";
import { WW_TECHS } from "@openfront/engine-lib/ww1936/WwTechs";
import {
  researchBlock,
  ResearchCard,
  researchCards,
  researchSpeedPct,
} from "./EconomyModel";

export const FIRST_YEAR = 1936;
export const LAST_YEAR = 1945;
export const COL_W = 148;
export const ROW_H = 58;
export const NODE_W = 132;
export const NODE_H = 46;
export const PAD = 12;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.4;
/** Days per year on the axis (the calendar's mean). */
const DAYS_PER_YEAR = 365.25;

export type NodeLook =
  | "done"
  | "running"
  | "saved"
  | "available"
  | "prereq"
  | "exclusive"
  | "project"
  | "doctrine";

/** One research bonus the country holds: a source and a percent. */
export interface BonusSource {
  /** A tech id or a branch. */
  key: string;
  pct: number;
  uses: number;
}

export interface NodeBadges {
  /** Ahead-of-time penalty %, 0: none. */
  ahead: number;
  /** The first matching held bonus % (the one a start takes), 0: none. */
  bonus: number;
  /** Faction joint research %, 0: none. */
  joint: number;
  /** Saved progress %, 0: none. */
  saved: number;
  project: boolean;
  exclusive: boolean;
}

export interface TreeNode {
  card: ResearchCard;
  look: NodeLook;
  badges: NodeBadges;
  col: number;
  row: number;
  x: number;
  y: number;
  /** A prerequisite on another tab (the node's "↖" tag), or null. */
  crossTab: WwTechId | null;
}

export interface TreeEdge {
  from: WwTechId;
  to: WwTechId;
}

export interface TreeLayout {
  nodes: TreeNode[];
  edges: TreeEdge[];
  width: number;
  height: number;
  /** Today's x on the axis. */
  todayX: number;
}

export function yearX(year: number): number {
  return PAD + (year - FIRST_YEAR) * COL_W;
}

export function todayX(day: number): number {
  return PAD + (Math.max(0, day) / DAYS_PER_YEAR) * COL_W;
}

export function nodeLook(card: ResearchCard): NodeLook {
  if (card.state === "done") return "done";
  if (card.state === "running") return "running";
  if (card.state === "prereq") return "prereq";
  if (card.state === "doctrine") return "doctrine";
  if (card.block === "exclusive") return "exclusive";
  if (card.block === "no_project") return "project";
  return card.saved > 0 ? "saved" : "available";
}

/** The held bonus a start of `tech` would take (the first for its id or branch). */
export function bonusFor(
  bonuses: readonly BonusSource[],
  tech: WwTechId,
): BonusSource | null {
  const branch = WW_TECHS[tech].branch;
  return bonuses.find((b) => b.key === tech || b.key === branch) ?? null;
}

export function jointPct(d: WwCountryDetail, tech: WwTechId): number {
  return d.sharedResearch?.find((r) => r[0] === tech)?.[1] ?? 0;
}

/** The base research speed % of a tech (techs, laws), without bonus and joint research. */
export function baseSpeedPct(d: WwCountryDetail, tech: WwTechId): number {
  return researchSpeedPct(d, tech, 0) - jointPct(d, tech);
}

/**
 * One tab laid out: x by year (the axis runs 1936 to 1945 left to right),
 * rows stacked per year, a node on its first same-tab prerequisite's row
 * when that row is free.
 */
export function treeLayout(
  d: WwCountryDetail,
  branch: (typeof TECH_BRANCHES)[number],
  day: number,
  bonuses: readonly BonusSource[],
): TreeLayout {
  const cards = researchCards(d, branch, day);
  const ids = new Set(cards.map((c) => c.id));
  const byYear = [...cards].sort(
    (a, b) =>
      a.year - b.year || WW_TECH_IDS.indexOf(a.id) - WW_TECH_IDS.indexOf(b.id),
  );
  const used = new Set<string>();
  const rowOf = new Map<WwTechId, number>();
  const nodes: TreeNode[] = [];
  const edges: TreeEdge[] = [];
  let rows = 0;
  for (const card of byYear) {
    const def = WW_TECHS[card.id];
    const col =
      Math.min(LAST_YEAR, Math.max(FIRST_YEAR, card.year)) - FIRST_YEAR;
    const near = def.prereqs.find((p) => ids.has(p));
    let row = near === undefined ? 0 : (rowOf.get(near) ?? 0);
    // The wanted row, else the nearest free one (below first).
    for (let k = 1; used.has(`${col}:${row}`); k++) {
      const want = near === undefined ? 0 : (rowOf.get(near) ?? 0);
      row = want + (k % 2 === 1 ? (k + 1) / 2 : -k / 2);
      if (row < 0) row = firstFree(used, col);
    }
    used.add(`${col}:${row}`);
    rowOf.set(card.id, row);
    rows = Math.max(rows, row + 1);
    for (const p of def.prereqs)
      if (ids.has(p)) edges.push({ from: p, to: card.id });
    const cross = def.prereqs.find((p) => !ids.has(p)) ?? null;
    const held = bonusFor(bonuses, card.id);
    nodes.push({
      card,
      look: nodeLook(card),
      badges: {
        ahead: card.state === "done" ? 0 : aheadPct(card.year, day),
        bonus: card.state === "done" || held === null ? 0 : held.pct,
        joint: card.state === "done" ? 0 : jointPct(d, card.id),
        saved: Math.floor(card.saved * 100),
        project: card.block === "no_project",
        exclusive: def.exclusive !== undefined,
      },
      col,
      row,
      x: PAD + col * COL_W,
      y: PAD + row * ROW_H,
      crossTab: cross,
    });
  }
  return {
    nodes,
    edges,
    width: PAD * 2 + (LAST_YEAR - FIRST_YEAR + 1) * COL_W,
    height: PAD * 2 + Math.max(1, rows) * ROW_H,
    todayX: todayX(day),
  };
}

function firstFree(used: Set<string>, col: number): number {
  let r = 0;
  while (used.has(`${col}:${r}`)) r++;
  return r;
}

/** The held bonuses (the politics view's researchBonuses). */
export function bonusSources(
  held: readonly { branch: string; pct: number; uses: number }[] | undefined,
): BonusSource[] {
  return (held ?? []).map((b) => ({ key: b.branch, pct: b.pct, uses: b.uses }));
}

/** Techs researched, running or open in the tab: the tab summary's numbers. */
export function tabSummary(
  layout: TreeLayout,
  bonuses: readonly BonusSource[],
  branch: string,
) {
  const n = layout.nodes;
  return {
    done: n.filter((x) => x.look === "done").length,
    total: n.length,
    running: n.filter((x) => x.look === "running").length,
    bonuses: bonuses.filter(
      (b) => b.key === branch || WW_TECHS[b.key as WwTechId]?.branch === branch,
    ).length,
  };
}

/** The next free slot's number (1-based), or 0 when every slot is busy. */
export function freeSlotNumber(d: WwCountryDetail): number {
  for (let i = 0; i < d.slotCount; i++)
    if ((d.slots[i] ?? null) === null) return i + 1;
  return 0;
}

export interface RecommendInput {
  seed?: number;
  tag: string;
  day: number;
  smallID: number;
  coastal?: boolean;
}

/**
 * The "next" card's pick (changes §6 idea 2): the best researchScores entry
 * of a human input that can start now, in the AI's ahead-of-time tiers
 * (50%, 75%, then any).
 */
export function recommendNext(
  d: WwCountryDetail,
  i: RecommendInput,
): WwTechId | null {
  const equip: Partial<Record<string, number>> = {};
  for (const l of d.lines)
    equip[l.equipment] = (equip[l.equipment] ?? 0) + l.factories;
  const researched = new Set(d.researched);
  const running = d.slots.map((s) => s?.tech ?? null);
  const scores = researchScores({
    seed: i.seed ?? 0,
    smallID: i.smallID,
    tag: i.tag as never,
    persona: "democracy",
    day: i.day,
    human: true,
    lean: d.researchLean ?? 0,
    coastal: i.coastal ?? true,
    lineFactories: equip,
    navalLines: 0,
    bonusKeys: [],
    shared: d.sharedResearch ?? [],
    researched,
    running,
  });
  const ranked = WW_TECH_IDS.map((id, k) => ({ id, s: scores[k] }))
    .filter((x): x is { id: WwTechId; s: number } => x.s !== null)
    .sort((a, b) => b.s - a.s);
  const open = ranked.filter((x) => researchBlock(d, x.id) === null);
  for (const cap of [50, 75, Infinity]) {
    const hit = open.find((x) => aheadPct(WW_TECHS[x.id].year, i.day) <= cap);
    if (hit !== undefined) return hit.id;
  }
  return null;
}

export const LEAN_KEYS: Readonly<
  Record<(typeof RESEARCH_LEANS)[number], string>
> = {
  balanced: "ww1936.rtree.lean_balanced",
  army: "ww1936.rtree.lean_army",
  navy: "ww1936.rtree.lean_navy",
  air: "ww1936.rtree.lean_air",
  industry: "ww1936.rtree.lean_industry",
};
