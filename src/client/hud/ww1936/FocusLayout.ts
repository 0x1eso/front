// World War 1936 (spec §21.3): where the focus tree's cards and lines go on
// the drawer's canvas. Pure: no DOM, no engine. The layout is automatic and
// client-only (nothing here is sent or hashed): ONE tree flowing top to
// bottom; a card's row is its prerequisite depth over the whole tree (the
// longest chain from a root), the order in a row is seeded by group and
// refined by barycenter sweeps (exclusive siblings side by side), the
// authored x/y only break ties. Every prerequisite is an orthogonal route
// with its own bus lane in the gap under its parent; routes that skip rows
// run down the channel between two columns.
import type {
  FocusBranch,
  FocusDef,
  WwFocusCard,
} from "@openfront/engine-api/ww1936/PoliticsTypes";

/** One grid cell at scale 1 (CSS px): a card's column slot and its row pitch. */
export const GRID_W = 164;
export const GRID_H = 110;
/** A card inside its cell. */
export const CARD_W = 140;
export const CARD_H = 84;
const PAD_X = (GRID_W - CARD_W) / 2;
/** Margin left and right of the tree, and above the first row. */
const MARGIN_X = 20;
export const TOP_PAD = 24;
/** Distance between two bus lanes in a row gap. */
const LANE_STEP = 8;
const MIN_GAP = GRID_H - CARD_H + 10;
/** Group colour tags (r,g,b), by group index. */
export const GROUP_TINTS = [
  "96,165,250",
  "52,211,153",
  "251,191,36",
  "244,114,182",
  "167,139,250",
  "45,212,191",
  "251,146,60",
  "163,230,53",
];
/** Zoom limits; a double tap returns to 1. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 1.6;

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

type LayoutDef = Pick<
  FocusDef,
  "id" | "x" | "y" | "branch" | "group" | "prereq" | "exclusive"
>;

/** The collapse key of a focus: its `group`, else its branch. */
export function groupKey(f: Pick<FocusDef, "group" | "branch">): string {
  return f.group ?? `branch:${f.branch}`;
}

/** One prerequisite line, routed: flat [x0, y0, x1, y1, ...] in tree space, ending at the child's top. */
export interface RoutedEdge {
  from: number;
  to: number;
  kind: "and" | "or";
  pts: number[];
  /** The y of the parent's bus (its lane in the gap under the parent's row). */
  lane: number;
}

/** An exclusive pair, drawn once: the ⊘ sits at (x, y). */
export interface ExclusivePair {
  a: number;
  b: number;
  x: number;
  y: number;
  /** Facing points on the two cards. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface FocusGroupSpan {
  key: string;
  /** Tree positions, in tree order. */
  members: number[];
}

export interface FocusLayout {
  n: number;
  /** Card top-left by tree position. */
  x: number[];
  y: number[];
  row: number[];
  slot: number[];
  /** Group index by tree position (the colour tag). */
  group: number[];
  groups: FocusGroupSpan[];
  routes: RoutedEdge[];
  pairs: ExclusivePair[];
  /** Cards that merge an OR group: the "or" badge sits at (x, y). */
  orBadges: { to: number; x: number; y: number }[];
  parents: number[][];
  children: number[][];
  width: number;
  height: number;
}

const byNum = (a: number, b: number) => a - b;

/** The layout of a tree; deterministic. */
export function computeLayout(tree: readonly LayoutDef[]): FocusLayout {
  const n = tree.length;
  const idx = new Map<string, number>();
  tree.forEach((f, i) => idx.set(f.id, i));
  const parents: number[][] = tree.map(() => []);
  const children: number[][] = tree.map(() => []);
  const kinds = new Map<number, "and" | "or">();
  const order: [number, number][] = [];
  tree.forEach((f, c) => {
    for (const g of f.prereq ?? []) {
      for (const id of g) {
        const p = idx.get(id);
        if (p === undefined || p === c) continue;
        const key = p * n + c;
        const kind = g.length > 1 ? "or" : "and";
        const had = kinds.get(key);
        if (had === undefined) {
          kinds.set(key, kind);
          order.push([p, c]);
          parents[c].push(p);
          children[p].push(c);
        } else if (kind === "and") kinds.set(key, "and");
      }
    }
  });
  // Groups in order of first appearance (a colour tag, never a column).
  const groupIdx = new Map<string, number>();
  const group: number[] = [];
  const groups: FocusGroupSpan[] = [];
  tree.forEach((f, i) => {
    const k = groupKey(f);
    let b = groupIdx.get(k);
    if (b === undefined) {
      b = groups.length;
      groupIdx.set(k, b);
      groups.push({ key: k, members: [] });
    }
    group[i] = b;
    groups[b].members.push(i);
  });
  // Row = longest prerequisite chain over the whole tree.
  const row: number[] = new Array(n).fill(-1);
  const busy = new Array<boolean>(n).fill(false);
  const depth = (i: number): number => {
    if (row[i] >= 0) return row[i];
    if (busy[i]) return 0;
    busy[i] = true;
    let d = 0;
    for (const p of parents[i]) d = Math.max(d, depth(p) + 1);
    busy[i] = false;
    row[i] = d;
    return d;
  };
  for (let i = 0; i < n; i++) depth(i);
  const rows = (row.reduce((m, r) => Math.max(m, r), -1) + 1) | 0;
  const excl: number[][] = tree.map((f) =>
    (f.exclusive ?? [])
      .map((id) => idx.get(id))
      .filter((j): j is number => j !== undefined)
      .sort(byNum),
  );
  // Order inside each row: seeded by group, then authored position; then
  // barycenter sweeps (down on parents, up on children) over the x of the
  // neighbours. Exclusive partners stay side by side.
  const lines: number[][] = [];
  for (let r = 0; r < rows; r++) lines.push([]);
  for (let i = 0; i < n; i++) lines[row[i]].push(i);
  const px: number[] = new Array(n).fill(0);
  const settle = (line: number[]) => {
    const out: number[] = [];
    const seen = new Set<number>();
    for (const i of line) {
      if (seen.has(i)) continue;
      seen.add(i);
      out.push(i);
      for (const j of excl[i]) {
        if (!seen.has(j) && row[j] === row[i]) {
          seen.add(j);
          out.push(j);
        }
      }
    }
    return out;
  };
  const place = (line: number[]) => {
    line.forEach((i, k) => (px[i] = k));
  };
  for (let r = 0; r < rows; r++) {
    lines[r].sort(
      (a, b) =>
        group[a] - group[b] ||
        tree[a].x - tree[b].x ||
        tree[a].y - tree[b].y ||
        a - b,
    );
    lines[r] = settle(lines[r]);
    place(lines[r]);
  }
  // Rows differ in width: compare positions relative to the widest row.
  const widest = lines.reduce((m, l) => Math.max(m, l.length), 1);
  const norm = (i: number) => px[i] + (widest - lines[row[i]].length) / 2;
  const sweep = (r: number, nb: number[][]) => {
    const k = new Map<number, number>();
    for (const i of lines[r]) {
      const ns = nb[i];
      k.set(
        i,
        ns.length === 0
          ? norm(i)
          : ns.reduce((s, j) => s + norm(j), 0) / ns.length,
      );
    }
    const before = new Map<number, number>();
    for (const i of lines[r]) before.set(i, px[i]);
    lines[r] = settle(
      [...lines[r]].sort(
        (a, b) =>
          (k.get(a) ?? 0) - (k.get(b) ?? 0) ||
          (before.get(a) ?? 0) - (before.get(b) ?? 0),
      ),
    );
    place(lines[r]);
  };
  for (let pass = 0; pass < 6; pass++) {
    for (let r = 1; r < rows; r++) sweep(r, parents);
    for (let r = rows - 2; r >= 0; r--) sweep(r, children);
  }
  // Slots: parents centred over their children where the row has room.
  const slot: number[] = new Array(n).fill(0);
  const pack = (r: number, nb: number[][] | null) => {
    // Wants are the neighbours' mean; the row keeps its order and a card
    // apart, at the least squared displacement (pool adjacent violators).
    const line = lines[r];
    const blocks: { sum: number; cnt: number }[] = [];
    line.forEach((i, k) => {
      const ns = nb === null ? [] : nb[i];
      const want =
        ns.length === 0
          ? slot[i]
          : ns.reduce((s, j) => s + slot[j], 0) / ns.length;
      blocks.push({ sum: want - k, cnt: 1 });
      while (blocks.length > 1) {
        const b2 = blocks[blocks.length - 1];
        const b1 = blocks[blocks.length - 2];
        if (b1.sum / b1.cnt <= b2.sum / b2.cnt) break;
        blocks.splice(blocks.length - 2, 2, {
          sum: b1.sum + b2.sum,
          cnt: b1.cnt + b2.cnt,
        });
      }
    });
    let k = 0;
    for (const bl of blocks) {
      const base = Math.round(bl.sum / bl.cnt);
      for (let q = 0; q < bl.cnt; q++, k++) slot[line[k]] = base + k;
    }
  };
  for (let r = 0; r < rows; r++) {
    lines[r].forEach((i, k) => (slot[i] = k));
    const shift = Math.floor((widest - lines[r].length) / 2);
    for (const i of lines[r]) slot[i] += shift;
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let r = 1; r < rows; r++) pack(r, parents);
    for (let r = rows - 2; r >= 0; r--) pack(r, children);
  }
  for (let r = 1; r < rows; r++) pack(r, parents);
  let cols = 1;
  if (n > 0) {
    const minSlot = Math.min(...slot);
    for (let i = 0; i < n; i++) {
      slot[i] -= minSlot;
      cols = Math.max(cols, slot[i] + 1);
    }
  }
  const x = tree.map((_, i) => MARGIN_X + slot[i] * GRID_W + PAD_X);
  const width = MARGIN_X * 2 + cols * GRID_W;
  const cx = (i: number) => x[i] + CARD_W / 2;
  // Bus lanes: one per parent (and one per child that long routes enter),
  // in the gap under a row (index g + 1; gap -1 is above row 0).
  const owners: Map<string, number>[] = [];
  for (let g = 0; g <= rows; g++) owners.push(new Map());
  for (const [p, c] of order) {
    owners[row[p] + 1].set(`p${p}`, cx(p));
    if (row[c] !== row[p] + 1) owners[row[c]].set(`c${c}`, cx(c));
  }
  const gapH: number[] = [];
  const laneSlot = new Map<string, number>();
  owners.forEach((m, gi) => {
    const keys = [...m.keys()].sort(
      (a, b) => (m.get(a) ?? 0) - (m.get(b) ?? 0) || (a < b ? -1 : 1),
    );
    keys.forEach((k, j) => laneSlot.set(`${gi}:${k}`, j + 1));
    gapH.push(Math.max(MIN_GAP, (keys.length + 1) * LANE_STEP));
  });
  const rowTop: number[] = [];
  const gapTop: number[] = [TOP_PAD];
  let yy = TOP_PAD;
  for (let r = 0; r < rows; r++) {
    yy += gapH[r];
    rowTop.push(yy);
    yy += CARD_H;
    gapTop.push(yy);
  }
  const height = yy + gapH[rows] + 6;
  const laneY = (g: number, key: string) => {
    const m = owners[g + 1];
    const k = laneSlot.get(`${g + 1}:${key}`) ?? 1;
    return gapTop[g + 1] + (k * gapH[g + 1]) / (m.size + 1);
  };
  const y = tree.map((_, i) => rowTop[row[i]]);
  // Long edges run down the channel between two slot columns (never through
  // a card); edges sharing a channel are spread across it.
  const chanUse = new Map<number, number>();
  const chanTotal = new Map<number, number>();
  const chanOf = (p: number, c: number) =>
    MARGIN_X + (cx(p) < cx(c) ? slot[c] : slot[c] + 1) * GRID_W;
  for (const [p, c] of order) {
    if (row[c] === row[p] + 1) continue;
    const k = chanOf(p, c);
    chanTotal.set(k, (chanTotal.get(k) ?? 0) + 1);
  }
  const routes: RoutedEdge[] = [];
  const orTo = new Set<number>();
  order.forEach(([p, c]) => {
    const kind = kinds.get(p * n + c) ?? "and";
    if (kind === "or") orTo.add(c);
    const pb = y[p] + CARD_H;
    const ct = y[c];
    const lp = laneY(row[p], `p${p}`);
    let pts: number[];
    if (row[c] === row[p] + 1) {
      pts = [cx(p), pb, cx(p), lp, cx(c), lp, cx(c), ct];
    } else {
      const k = chanOf(p, c);
      const j = chanUse.get(k) ?? 0;
      chanUse.set(k, j + 1);
      const t = chanTotal.get(k) ?? 1;
      const ch = k + (j - (t - 1) / 2) * Math.min(4, 16 / Math.max(1, t - 1));
      const le = laneY(row[c] - 1, `c${c}`);
      pts = [cx(p), pb, cx(p), lp, ch, lp, ch, le, cx(c), le, cx(c), ct];
    }
    routes.push({ from: p, to: c, kind, pts: simplify(pts), lane: lp });
  });
  const pairs: ExclusivePair[] = [];
  const seen = new Set<number>();
  for (let a = 0; a < n; a++) {
    for (const b of excl[a]) {
      if (b === a) continue;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (seen.has(lo * n + hi)) continue;
      seen.add(lo * n + hi);
      const same = row[lo] === row[hi];
      const [l, r] = x[lo] <= x[hi] ? [lo, hi] : [hi, lo];
      const x0 = same ? x[l] + CARD_W : cx(lo);
      const y0 = same ? y[l] + CARD_H / 2 : y[lo] + CARD_H / 2;
      const x1 = same ? x[r] : cx(hi);
      const y1 = same ? y[r] + CARD_H / 2 : y[hi] + CARD_H / 2;
      pairs.push({
        a: lo,
        b: hi,
        x: (x0 + x1) / 2,
        y: (y0 + y1) / 2,
        x0,
        y0,
        x1,
        y1,
      });
    }
  }
  return {
    n,
    x,
    y,
    row,
    slot,
    group,
    groups,
    routes,
    pairs,
    orBadges: [...orTo]
      .sort(byNum)
      .map((c) => ({ to: c, x: cx(c), y: y[c] - 12 })),
    parents,
    children,
    width,
    height,
  };
}

/** Drops repeated points and the middle of straight runs. */
function simplify(p: number[]): number[] {
  const pts: number[] = [];
  for (let i = 0; i < p.length; i += 2) {
    const l = pts.length;
    if (l >= 2 && pts[l - 2] === p[i] && pts[l - 1] === p[i + 1]) continue;
    pts.push(p[i], p[i + 1]);
  }
  const out: number[] = pts.slice(0, 2);
  for (let i = 2; i + 2 < pts.length; i += 2) {
    const [ax, ay] = [out[out.length - 2], out[out.length - 1]];
    const straight =
      (ax === pts[i] && pts[i] === pts[i + 2]) ||
      (ay === pts[i + 1] && pts[i + 1] === pts[i + 3]);
    if (!straight) out.push(pts[i], pts[i + 1]);
  }
  out.push(pts[pts.length - 2], pts[pts.length - 1]);
  return out;
}

const layouts = new WeakMap<object, FocusLayout>();

/** The layout of `tree`, computed once per tree array. */
export function layoutOf(tree: readonly LayoutDef[]): FocusLayout {
  let l = layouts.get(tree);
  if (l === undefined) {
    l = computeLayout(tree);
    layouts.set(tree, l);
  }
  return l;
}

/** The tree position's ancestors (everything it needs) and descendants (everything it opens). */
export function relatives(
  L: Pick<FocusLayout, "parents" | "children">,
  pos: number,
): { up: Set<number>; down: Set<number> } {
  const walk = (next: number[][]) => {
    const seen = new Set<number>();
    const stack = [pos];
    while (stack.length > 0) {
      for (const j of next[stack.pop() as number] ?? []) {
        if (j !== pos && !seen.has(j)) {
          seen.add(j);
          stack.push(j);
        }
      }
    }
    return seen;
  };
  return { up: walk(L.parents), down: walk(L.children) };
}

/** A card in tree space at `scale` (no pan). */
export function cardRect(L: FocusLayout, i: number, scale: number): Rect {
  return {
    x: L.x[i] * scale,
    y: L.y[i] * scale,
    w: CARD_W * scale,
    h: CARD_H * scale,
  };
}

/** The tree's size at scale 1. */
export function treeSize(L: Pick<FocusLayout, "width" | "height">): {
  w: number;
  h: number;
} {
  return { w: Math.max(1, L.width), h: Math.max(1, L.height) };
}

/**
 * The lines (spec §21.3), flat: one per prerequisite — "and" when its group
 * holds one focus, "or" when the group offers two or more — and one per
 * exclusive pair (listed on both sides, drawn once).
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
  L: FocusLayout,
  x: number,
  y: number,
  view: FocusViewport,
): number {
  const tx = (x - view.ox) / view.scale;
  const ty = (y - view.oy) / view.scale;
  for (let i = 0; i < L.n; i++) {
    if (tx >= L.x[i] && tx <= L.x[i] + CARD_W) {
      if (ty >= L.y[i] && ty <= L.y[i] + CARD_H) return i;
    }
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
  L: FocusLayout,
  w: number,
  h: number,
): FocusViewport {
  const scale = clamp(view.scale, ZOOM_MIN, ZOOM_MAX);
  const size = treeSize(L);
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
  L: FocusLayout,
  pos: number,
  w: number,
  h: number,
  scale = 1,
): FocusViewport {
  if (pos < 0 || pos >= L.n) {
    return clampView({ ox: 0, oy: 0, scale }, L, w, h);
  }
  const r = cardRect(L, pos, scale);
  return clampView(
    { ox: w / 2 - (r.x + r.w / 2), oy: h / 2 - (r.y + r.h / 2), scale },
    L,
    w,
    h,
  );
}

/** The whole tree in view. */
export function fitAll(L: FocusLayout, w: number, h: number): FocusViewport {
  const s = Math.min(w / treeSize(L).w, h / treeSize(L).h);
  const scale = clamp(s, ZOOM_MIN, ZOOM_MAX);
  return clampView(
    {
      scale,
      ox: (w - L.width * scale) / 2,
      oy: (h - L.height * scale) / 2,
    },
    L,
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
  L: Pick<FocusLayout, "row" | "x">,
  tree: readonly Pick<FocusDef, "branch">[],
  chip: FocusChip,
): number {
  let best = -1;
  tree.forEach((f, i) => {
    if (!chipHas(chip, f.branch)) return;
    if (
      best === -1 ||
      L.row[i] < L.row[best] ||
      (L.row[i] === L.row[best] && L.x[i] < L.x[best])
    ) {
      best = i;
    }
  });
  return best;
}

/** A group's first card: the top row's leftmost one; -1 if none. */
export function groupFirst(
  L: Pick<FocusLayout, "row" | "x" | "groups">,
  g: number,
): number {
  let best = -1;
  for (const i of L.groups[g]?.members ?? []) {
    if (
      best === -1 ||
      L.row[i] < L.row[best] ||
      (L.row[i] === L.row[best] && L.x[i] < L.x[best])
    ) {
      best = i;
    }
  }
  return best;
}
