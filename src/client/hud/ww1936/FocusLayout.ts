// World War 1936 (spec §21.3): where the focus tree's cards and lines go on
// the drawer's canvas. Pure: no DOM, no engine. The layout is automatic and
// client-only (nothing here is sent or hashed): every `group` (else branch)
// is a vertical band; inside a band a card's row is its prerequisite depth,
// the order in a row is chosen by barycenter passes (exclusive siblings
// side by side) and the authored x/y only break ties. Every prerequisite is
// an orthogonal route with its own bus lane in the gap under its parent.
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
/** Band padding, the gap between bands and the header strip. */
export const BAND_PAD = 14;
export const BAND_GAP = 10;
export const HEAD_H = 34;
/** Distance between two bus lanes in a row gap. */
const LANE_STEP = 7;
const MIN_GAP = GRID_H - CARD_H;
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

export interface FocusBand {
  key: string;
  /** Tree positions, in tree order. */
  members: number[];
  x: number;
  w: number;
  slots: number;
}

export interface FocusLayout {
  n: number;
  /** Card top-left by tree position. */
  x: number[];
  y: number[];
  row: number[];
  slot: number[];
  band: number[];
  bands: FocusBand[];
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
  // Bands in order of first appearance.
  const bandIdx = new Map<string, number>();
  const band: number[] = [];
  const bands: FocusBand[] = [];
  tree.forEach((f, i) => {
    const k = groupKey(f);
    let b = bandIdx.get(k);
    if (b === undefined) {
      b = bands.length;
      bandIdx.set(k, b);
      bands.push({ key: k, members: [], x: 0, w: 0, slots: 1 });
    }
    band[i] = b;
    bands[b].members.push(i);
  });
  // Row = longest prerequisite chain inside the band.
  const row: number[] = new Array(n).fill(-1);
  const busy = new Array<boolean>(n).fill(false);
  const depth = (i: number): number => {
    if (row[i] >= 0) return row[i];
    if (busy[i]) return 0;
    busy[i] = true;
    let d = 0;
    for (const p of parents[i]) {
      if (band[p] === band[i]) d = Math.max(d, depth(p) + 1);
    }
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
  // Order inside each band's rows: authored position first, then barycenters.
  const slot: number[] = new Array(n).fill(0);
  for (const bd of bands) {
    const lines: number[][] = [];
    for (let r = 0; r < rows; r++) lines.push([]);
    for (const i of bd.members) lines[row[i]].push(i);
    const ord = new Map<number, number>();
    const settle = (line: number[]) => {
      // Exclusive partners sit right next to each other.
      const out: number[] = [];
      const seen = new Set<number>();
      for (const i of line) {
        if (seen.has(i)) continue;
        seen.add(i);
        out.push(i);
        for (const j of excl[i]) {
          if (!seen.has(j) && line.includes(j)) {
            seen.add(j);
            out.push(j);
          }
        }
      }
      out.forEach((i, k) => ord.set(i, k));
      return out;
    };
    for (let r = 0; r < rows; r++) {
      lines[r].sort(
        (a, b) => tree[a].y - tree[b].y || tree[a].x - tree[b].x || a - b,
      );
      lines[r] = settle(lines[r]);
    }
    const sweep = (r: number, nb: number[][]) => {
      const key = (i: number) => {
        const ns = nb[i].filter((j) => band[j] === band[i] && row[j] !== r);
        if (ns.length === 0) return ord.get(i) ?? 0;
        return ns.reduce((s, j) => s + (ord.get(j) ?? 0), 0) / ns.length;
      };
      const k = new Map<number, number>();
      for (const i of lines[r]) k.set(i, key(i));
      lines[r] = settle(
        [...lines[r]].sort(
          (a, b) =>
            (k.get(a) ?? 0) - (k.get(b) ?? 0) ||
            (ord.get(a) ?? 0) - (ord.get(b) ?? 0),
        ),
      );
    };
    for (let pass = 0; pass < 4; pass++) {
      for (let r = 1; r < rows; r++) sweep(r, parents);
      for (let r = rows - 2; r >= 0; r--) sweep(r, children);
    }
    // Slots: under the parents' mean where the row has room.
    let cols = 1;
    for (let r = 0; r < rows; r++) {
      let prev = -1;
      for (const i of lines[r]) {
        const ps = parents[i].filter((p) => band[p] === band[i]);
        const want =
          ps.length === 0
            ? prev + 1
            : Math.round(ps.reduce((s, p) => s + slot[p], 0) / ps.length);
        slot[i] = Math.max(prev + 1, want);
        prev = slot[i];
        cols = Math.max(cols, prev + 1);
      }
    }
    bd.slots = cols;
  }
  let bx = BAND_GAP;
  for (const bd of bands) {
    bd.x = bx;
    bd.w = BAND_PAD * 2 + bd.slots * GRID_W;
    bx += bd.w + BAND_GAP;
  }
  const x = tree.map(
    (_, i) => bands[band[i]].x + BAND_PAD + slot[i] * GRID_W + PAD_X,
  );
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
  const gapTop: number[] = [HEAD_H];
  let yy = HEAD_H;
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
  const routes: RoutedEdge[] = [];
  const orTo = new Set<number>();
  order.forEach(([p, c], ei) => {
    const kind = kinds.get(p * n + c) ?? "and";
    if (kind === "or") orTo.add(c);
    const pb = y[p] + CARD_H;
    const ct = y[c];
    const lp = laneY(row[p], `p${p}`);
    let pts: number[];
    if (row[c] === row[p] + 1) {
      pts = [cx(p), pb, cx(p), lp, cx(c), lp, cx(c), ct];
    } else {
      const bd = bands[band[c]];
      const left = bd.x + BAND_PAD + slot[c] * GRID_W;
      const ch = (cx(p) < cx(c) ? left : left + GRID_W) + ((ei % 5) - 2) * 3;
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
    band,
    bands,
    routes,
    pairs,
    orBadges: [...orTo]
      .sort(byNum)
      .map((c) => ({ to: c, x: cx(c), y: y[c] - 12 })),
    parents,
    children,
    width: bx,
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

/** The band whose header strip holds tree point (tx, ty), or -1. */
export function hitBand(L: FocusLayout, tx: number, ty: number): number {
  if (ty < 0 || ty > HEAD_H) return -1;
  return L.bands.findIndex((b) => tx >= b.x && tx <= b.x + b.w);
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

/** Band `b` fitted to the canvas (its width, else its height), centred. */
export function fitBand(
  L: FocusLayout,
  b: number,
  w: number,
  h: number,
): FocusViewport {
  const bd = L.bands[b];
  if (bd === undefined) return fitAll(L, w, h);
  const scale = clamp(
    Math.min(w / (bd.w + 2 * BAND_GAP), h / L.height),
    ZOOM_MIN,
    ZOOM_MAX,
  );
  return clampView(
    {
      scale,
      ox: w / 2 - (bd.x + bd.w / 2) * scale,
      oy: 0,
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
