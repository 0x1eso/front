// World War 1936 P3 (spec §21.3): where the focus tree's cards and lines go
// on the drawer's canvas. Pure: no DOM, no engine — the canvas draws what
// these functions place, and the tests check them directly.
import type {
  FocusBranch,
  FocusDef,
  WwFocusCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

/** One grid cell at scale 1 (CSS px). */
export const GRID_W = 104;
export const GRID_H = 68;
/** A card inside its cell, centred. */
export const CARD_W = 96;
export const CARD_H = 60;
const PAD_X = (GRID_W - CARD_W) / 2;
const PAD_Y = (GRID_H - CARD_H) / 2;
/** Pinch zoom limits; a double tap returns to 1. */
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 1.25;

/** Card states (WwFocusCard.state). */
export const FOCUS_OPEN = 0;
export const FOCUS_DONE = 1;
export const FOCUS_BYPASSED = 2;
export const FOCUS_RUNNING = 3;
export const FOCUS_PREREQ = 4;
export const FOCUS_CONDITION = 5;
export const FOCUS_EXCLUSIVE = 6;
export const FOCUS_QUEUED = 7;

/**
 * The canvas's view of the tree: a tree point (x, y at scale 1) shows at
 * canvas point (x × scale + ox, y × scale + oy).
 */
export interface FocusViewport {
  ox: number;
  oy: number;
  scale: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type EdgeKind = "and" | "or" | "exclusive";

/** A line between two cards, by tree position (the index in `tree`). */
export interface FocusEdge {
  from: number;
  to: number;
  kind: EdgeKind;
}

/** A focus's card in tree space at `scale` (no pan). */
export function cardRect(f: Pick<FocusDef, "x" | "y">, scale: number): Rect {
  return {
    x: (f.x * GRID_W + PAD_X) * scale,
    y: (f.y * GRID_H + PAD_Y) * scale,
    w: CARD_W * scale,
    h: CARD_H * scale,
  };
}

/** The tree's size at scale 1: every used cell (columns 0..max, rows 0..max). */
export function treeSize(tree: readonly Pick<FocusDef, "x" | "y">[]): {
  w: number;
  h: number;
} {
  let cols = 1;
  let rows = 1;
  for (const f of tree) {
    cols = Math.max(cols, f.x + 1);
    rows = Math.max(rows, f.y + 1);
  }
  return { w: cols * GRID_W, h: rows * GRID_H };
}

/**
 * The lines (spec §21.3): one per prerequisite — solid ("and") when its
 * group holds one focus, dashed ("or") when the group offers two or more —
 * and one per exclusive pair (listed on both sides, drawn once).
 */
export function edges(
  tree: readonly Pick<FocusDef, "id" | "prereq" | "exclusive">[],
): FocusEdge[] {
  const pos = new Map<string, number>();
  tree.forEach((f, i) => pos.set(f.id, i));
  const out: FocusEdge[] = [];
  tree.forEach((f, to) => {
    for (const group of f.prereq ?? []) {
      const kind: EdgeKind = group.length > 1 ? "or" : "and";
      for (const id of group) {
        const from = pos.get(id);
        if (from !== undefined) out.push({ from, to, kind });
      }
    }
  });
  const seen = new Set<string>();
  tree.forEach((f, a) => {
    for (const id of f.exclusive ?? []) {
      const b = pos.get(id);
      if (b === undefined || b === a) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const key = `${lo}:${hi}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ from: lo, to: hi, kind: "exclusive" });
    }
  });
  return out;
}

/** The tree position of the card under canvas point (x, y), or -1. */
export function hitCard(
  tree: readonly Pick<FocusDef, "x" | "y">[],
  x: number,
  y: number,
  view: FocusViewport,
): number {
  const tx = (x - view.ox) / view.scale;
  const ty = (y - view.oy) / view.scale;
  for (let i = 0; i < tree.length; i++) {
    const r = cardRect(tree[i], 1);
    if (tx >= r.x && tx <= r.x + r.w && ty >= r.y && ty <= r.y + r.h) return i;
  }
  return -1;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * The view kept inside the tree: the scale within ZOOM_MIN..ZOOM_MAX; a tree
 * wider (taller) than the canvas covers it edge to edge, a smaller one stays
 * whole inside it.
 */
export function clampView(
  view: FocusViewport,
  tree: readonly Pick<FocusDef, "x" | "y">[],
  w: number,
  h: number,
): FocusViewport {
  const scale = clamp(view.scale, ZOOM_MIN, ZOOM_MAX);
  const size = treeSize(tree);
  const sx = w - size.w * scale;
  const sy = h - size.h * scale;
  return {
    scale,
    ox: clamp(view.ox, Math.min(0, sx), Math.max(0, sx)),
    oy: clamp(view.oy, Math.min(0, sy), Math.max(0, sy)),
  };
}

/** A view at `scale` with the card at tree position `pos` in the canvas's middle (clamped). */
export function centerOn(
  tree: readonly Pick<FocusDef, "x" | "y">[],
  pos: number,
  w: number,
  h: number,
  scale = 1,
): FocusViewport {
  const f = tree[pos];
  if (f === undefined) return clampView({ ox: 0, oy: 0, scale }, tree, w, h);
  const r = cardRect(f, scale);
  return clampView(
    { ox: w / 2 - (r.x + r.w / 2), oy: h / 2 - (r.y + r.h / 2), scale },
    tree,
    w,
    h,
  );
}

/** The view scaled to `scale` (clamped) about canvas point (cx, cy), which stays put. */
export function zoomAt(
  view: FocusViewport,
  scale: number,
  cx: number,
  cy: number,
): FocusViewport {
  const s = clamp(scale, ZOOM_MIN, ZOOM_MAX);
  const k = s / view.scale;
  return {
    scale: s,
    ox: cx - (cx - view.ox) * k,
    oy: cy - (cy - view.oy) * k,
  };
}

/**
 * Where the drawer opens (spec §21.3): the running focus's card, else the
 * first open one (card order); -1 when there is neither.
 */
export function initialCenter(cards: readonly WwFocusCard[]): number {
  const running = cards.find((c) => c.state === FOCUS_RUNNING);
  if (running !== undefined) return running.idx;
  const open = cards.find((c) => c.state === FOCUS_OPEN);
  return open === undefined ? -1 : open.idx;
}

/** The branch chips (spec §21.3): all, then the seven branches with air and navy as one. */
export type FocusChip =
  | "all"
  | "politics"
  | "diplomacy"
  | "industry"
  | "research"
  | "army"
  | "air_navy";
export const FOCUS_CHIPS: readonly FocusChip[] = [
  "all",
  "politics",
  "diplomacy",
  "industry",
  "research",
  "army",
  "air_navy",
];

function chipHas(chip: FocusChip, b: FocusBranch): boolean {
  if (chip === "all") return true;
  if (chip === "air_navy") return b === "air" || b === "navy";
  return chip === b;
}

/** A chip's first card: the top row's leftmost card of its branches; -1 if none. */
export function chipFirst(
  tree: readonly Pick<FocusDef, "x" | "y" | "branch">[],
  chip: FocusChip,
): number {
  let best = -1;
  tree.forEach((f, i) => {
    if (!chipHas(chip, f.branch)) return;
    const b = tree[best];
    if (best === -1 || f.y < b.y || (f.y === b.y && f.x < b.x)) best = i;
  });
  return best;
}
