// Great War 1914: the vote scene's plan (ww203 §5). From the engine's ballot
// record, each chamber's seats as dots in its shape (a hemicycle, the
// Commons' facing benches and lobbies, the Bundesrat's table), the time each
// block casts, the tally at any moment, the moment the line is crossed and
// (ww215) the chair's declaration once the count is done.
// Pure: GwVote draws it.
import type {
  GwBallotBlock,
  GwBallotCast,
  GwBallotChamber,
  GwChamber,
} from "@openfront/engine-api/ww1914/GwHouse";
import { BLOC_COLOR, BLOC_SEATING, NO_BLOC_COLOR } from "./GwStyle";

export type GwSeatShape = "arc" | "benches" | "table";

/** Nine chambers, three shapes: the rest are hemicycles of their size. */
export const CHAMBER_SHAPE: Readonly<Record<GwChamber, GwSeatShape>> = {
  reichstag: "arc",
  bundesrat: "table",
  commons: "benches",
  lords: "benches",
  duma: "arc",
  council: "arc",
  reichsrat: "arc",
  budapest: "arc",
  chambre: "arc",
  senat: "arc",
};

/** The shape's box, in SVG units. */
export const VOTE_W = 200;
export const VOTE_H = 108;

/** One seat: where it sits, where it walks to (the lobbies), when it casts. */
export interface GwVoteDot {
  x: number;
  y: number;
  /** The lobby it walks into (benches only). */
  to: { x: number; y: number } | null;
  /** Its block in the record's casting order; -1 an empty seat. */
  block: number;
  /** Ms from the chamber's start when it casts; Infinity never. */
  at: number;
  /** A broken promise: it shows as for from here until `at`. */
  from: number | null;
  cast: GwBallotCast | null;
  color: string;
  /** Waverers sit grey and pulse until they decide. */
  waver: boolean;
}

/** A block as the scene tells it, in the record's order. */
export interface GwVoteLine {
  block: GwBallotBlock;
  /** Ms when it begins to cast. */
  at: number;
}

export interface GwVotePlan {
  shape: GwSeatShape;
  /** A dot's radius. */
  r: number;
  dots: GwVoteDot[];
  lines: GwVoteLine[];
  /** Seats cast for or against: the majority line is half of these. */
  present: number;
  /** For must reach this to carry it (more than half of those present). */
  need: number;
  /** Ms when the outcome is settled (the line crossed, or out of reach); null if the count never settles it. */
  crossAt: number | null;
  /** ww215: ms when the chair declares the result, a pause after the last seat. */
  sayAt: number;
  /** Ms the chamber takes, the declaration held to be read. */
  end: number;
  pass: boolean;
  delay: boolean;
}

// ---- Times (ms; the second chamber plays the same, shorter) ----
// ww215: about 1.8x the first cut, so it reads as a count, not a flicker.
const OUTLINE = 900;
/**
 * firm, waver, the lobbied (swing and betray), then a wing defying its line:
 * the party has cast, and its men who stand up against it come last, alone,
 * so the log can name them ("리프크네히트, 반대").
 */
const PHASE = [4500, 2700, 1800, 1600] as const;
/** A block's seats fill over this share of its slot. */
const FILL = 0.7;
/** A broken promise flips this far into its slot. */
const FLIP = 0.6;
/** The hush between the last seat and the chair's declaration. */
const PAUSE = 1500;
/** The declaration held, to be read before the scene moves on. */
const HOLD = 2600;

const PHASE_OF: Readonly<Record<GwBallotBlock["beat"], number>> = {
  firm: 0,
  waver: 1,
  swing: 2,
  betray: 2,
  defy: 3,
};

/** When each block begins, and how long its slot is. */
function slots(
  blocks: readonly GwBallotBlock[],
  scale: number,
): { at: number; len: number }[] {
  const out: { at: number; len: number }[] = blocks.map(() => ({
    at: 0,
    len: 0,
  }));
  let t = OUTLINE * scale;
  for (let p = 0; p < PHASE.length; p++) {
    const idx = blocks
      .map((b, i) => (PHASE_OF[b.beat] === p ? i : -1))
      .filter((i) => i >= 0);
    if (idx.length === 0) continue;
    const len = (PHASE[p] * scale) / idx.length;
    idx.forEach((i, k) => (out[i] = { at: t + k * len, len }));
    t += PHASE[p] * scale;
  }
  return out;
}

// ---- Shapes ----
interface Layout {
  pts: { x: number; y: number }[];
  r: number;
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** A hemicycle: rows of seats, left to right by angle so blocs make wedges. */
export function arcSeats(n: number): Layout {
  const cx = VOTE_W / 2;
  const cy = VOTE_H - 6;
  const r1 = 96;
  const r0 = 34;
  let rows = 1;
  for (; rows < 40; rows++) {
    const d = (r1 - r0) / rows;
    let cap = 0;
    for (let k = 0; k < rows; k++) {
      cap += Math.floor((Math.PI * (r0 + d * (k + 0.5))) / d);
    }
    if (cap >= n) break;
  }
  const d = (r1 - r0) / rows;
  const radii = Array.from({ length: rows }, (_, k) => r0 + d * (k + 0.5));
  const sum = radii.reduce((a, b) => a + b, 0);
  // Seats per row by its length, the remainders to the longest.
  const exact = radii.map((r) => (n * r) / sum);
  const counts = exact.map(Math.floor);
  let left = n - counts.reduce((a, b) => a + b, 0);
  const byRest = exact
    .map((e, k) => ({ k, rest: e - Math.floor(e) }))
    .sort((a, b) => b.rest - a.rest || b.k - a.k);
  for (let i = 0; left > 0; i = (i + 1) % rows, left--) counts[byRest[i].k]++;
  const pts: { x: number; y: number; a: number; r: number }[] = [];
  radii.forEach((r, k) => {
    const m = counts[k];
    for (let j = 0; j < m; j++) {
      const a = m === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (m - 1);
      pts.push({
        x: round(cx + r * Math.cos(a)),
        y: round(cy - r * Math.sin(a)),
        a,
        r,
      });
    }
  });
  pts.sort((p, q) => q.a - p.a || p.r - q.r);
  return { pts: pts.map(({ x, y }) => ({ x, y })), r: round(d * 0.36) };
}

/** `n` seats in a box, column by column from the left. */
function grid(
  n: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): { pts: { x: number; y: number }[]; step: number } {
  if (n <= 0) return { pts: [], step: Math.min(w, h) };
  const cols = Math.max(1, Math.ceil(Math.sqrt((n * w) / h)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const sx = w / cols;
  const sy = h / rows;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = Math.floor(i / rows);
    const r = i % rows;
    pts.push({ x: round(x0 + sx * (c + 0.5)), y: round(y0 + sy * (r + 0.5)) });
  }
  return { pts, step: Math.min(sx, sy) };
}

/** The Commons and Lords: two benches facing across the aisle. */
export function benchSeats(n: number): Layout & {
  lobby: (cast: "for" | "against", count: number) => Layout;
} {
  const top = Math.ceil(n / 2);
  const a = grid(top, 46, 8, 108, 38);
  const b = grid(n - top, 46, 62, 108, 38);
  const r = round(Math.min(a.step, b.step || a.step) * 0.36);
  return {
    pts: [...a.pts, ...b.pts],
    r,
    // 찬성 to the right of the chair, 반대 to the left.
    lobby: (cast, count) => {
      const g = grid(count, cast === "for" ? 160 : 2, 8, 38, 86);
      return { pts: g.pts, r: round(g.step * 0.36) };
    },
  };
}

/** The Bundesrat: the states' plenipotentiaries round a table. */
export function tableSeats(n: number): Layout {
  const x0 = 34;
  const y0 = 20;
  const w = 132;
  const h = 70;
  const per = 2 * (w + h);
  const step = per / Math.max(1, n);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    let s = step * (i + 0.5);
    let x: number;
    let y: number;
    if (s < w) {
      x = x0 + s;
      y = y0;
    } else if ((s -= w) < h) {
      x = x0 + w;
      y = y0 + s;
    } else if ((s -= h) < w) {
      x = x0 + w - s;
      y = y0 + h;
    } else {
      s -= w;
      x = x0;
      y = y0 + h - s;
    }
    pts.push({ x: round(x), y: round(y) });
  }
  return { pts, r: round(Math.min(step * 0.32, 3)) };
}

/**
 * ww204: a state voting as one (Prussia's 17) sits as one block at the head
 * of the table, its seats packed together: `n` points, `cols` to a row.
 */
export function stateBlockSeats(
  n: number,
  cols = 6,
): { x: number; y: number }[] {
  const step = 6.6;
  const rows = Math.ceil(n / cols);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    pts.push({
      x: round(100 + (col - (inRow - 1) / 2) * step),
      y: round(55 + (row - (rows - 1) / 2) * step),
    });
  }
  return pts;
}

/** Left to right as a house seats them; a faction's blocks side by side. */
function seating(
  blocks: readonly GwBallotBlock[],
  blocOf: (faction: string) => string | null,
): number[] {
  const rank = (b: GwBallotBlock): number => {
    // A state voting as one takes its place first (the table's head).
    if (b.state !== undefined) return -1;
    if (b.faction === null) return BLOC_SEATING.length;
    const bloc = blocOf(b.faction);
    const i = bloc === null ? -1 : BLOC_SEATING.indexOf(bloc);
    return i < 0 ? BLOC_SEATING.length : i;
  };
  return blocks
    .map((b, i) => ({ i, r: rank(b), f: b.faction ?? "" }))
    .sort((p, q) => p.r - q.r || (p.f < q.f ? -1 : p.f > q.f ? 1 : p.i - q.i))
    .map((x) => x.i);
}

/** The chamber's play: dots, block times, the declaration's moment. */
export function votePlan(
  ch: GwBallotChamber,
  blocOf: (faction: string) => string | null,
  scale = 1,
): GwVotePlan {
  const blocks = ch.blocks;
  const filled = blocks.reduce((a, b) => a + Math.max(0, b.seats), 0);
  const size = Math.max(ch.size, filled, 1);
  const shape = CHAMBER_SHAPE[ch.chamber];
  const bench = shape === "benches" ? benchSeats(size) : null;
  const statesN =
    shape === "table"
      ? blocks.reduce((a, b) => a + (b.state === undefined ? 0 : b.seats), 0)
      : 0;
  const ring = shape === "table" ? tableSeats(size - statesN) : null;
  const layout =
    bench ??
    (ring !== null
      ? { pts: [...stateBlockSeats(statesN), ...ring.pts], r: ring.r }
      : arcSeats(size));
  const times = slots(blocks, scale);
  const dots: GwVoteDot[] = [];
  let seat = 0;
  for (const i of seating(blocks, blocOf)) {
    const b = blocks[i];
    const bloc = b.faction === null ? null : blocOf(b.faction);
    const color =
      bloc === null ? NO_BLOC_COLOR : (BLOC_COLOR[bloc] ?? NO_BLOC_COLOR);
    const { at, len } = times[i];
    for (let j = 0; j < b.seats && seat < layout.pts.length; j++, seat++) {
      const p = layout.pts[seat];
      const betray = b.beat === "betray";
      dots.push({
        x: p.x,
        y: p.y,
        to: null,
        block: i,
        at: betray ? at + len * FLIP : at + (len * FILL * j) / b.seats,
        from: betray ? at + (len * FILL * j) / b.seats / 2 : null,
        cast: b.cast,
        color,
        waver: b.beat === "waver",
      });
    }
  }
  for (; seat < layout.pts.length; seat++) {
    const p = layout.pts[seat];
    dots.push({
      ...p,
      to: null,
      block: -1,
      at: Infinity,
      from: null,
      cast: null,
      color: NO_BLOC_COLOR,
      waver: false,
    });
  }
  let r = layout.r;
  if (bench !== null) {
    // Into the lobbies, in the order they cast.
    for (const cast of ["for", "against"] as const) {
      const going = dots
        .filter((d) => d.cast === cast)
        .sort((p, q) => p.at - q.at);
      const lobby = bench.lobby(cast, going.length);
      going.forEach((d, k) => (d.to = lobby.pts[k]));
      if (going.length > 0) r = Math.min(r, lobby.r);
    }
  }
  const present = dots.filter(
    (d) => d.cast === "for" || d.cast === "against",
  ).length;
  const need = Math.floor(present / 2) + 1;
  const last = dots.reduce(
    (m, d) => (d.at === Infinity ? m : Math.max(m, d.at)),
    0,
  );
  const sayAt = last + PAUSE * scale;
  return {
    shape,
    r,
    dots,
    lines: blocks.map((block, i) => ({ block, at: times[i].at })),
    present,
    need,
    crossAt: crossing(dots, present, need, ch),
    sayAt,
    end: sayAt + HOLD * scale,
    pass: ch.pass,
    delay: ch.delay,
  };
}

/**
 * The moment the outcome is settled: for reaches the line, or against makes
 * it out of reach (or reaches the Bundesrat's block). Null when the count
 * never settles it as the record says (Budapest's own rule, the Lords).
 */
function crossing(
  dots: readonly GwVoteDot[],
  present: number,
  need: number,
  ch: GwBallotChamber,
): number | null {
  const order = dots
    .filter((d) => d.at !== Infinity)
    .sort((p, q) => p.at - q.at);
  let yes = 0;
  let no = 0;
  for (const d of order) {
    if (d.cast === "for") yes++;
    else if (d.cast === "against") no++;
    else continue;
    const left = present - yes - no;
    if (ch.pass) {
      if (yes >= need && (ch.block <= 0 || no + left < ch.block)) return d.at;
    } else if (no >= present - need + 1 || (ch.block > 0 && no >= ch.block)) {
      return d.at;
    }
  }
  return null;
}

/** The count as it stands `t` ms in: what the dots show. */
export function tallyAt(
  plan: GwVotePlan,
  t: number,
): { for: number; against: number; away: number } {
  const out = { for: 0, against: 0, away: 0 };
  for (const d of plan.dots) {
    if (d.cast === null) continue;
    if (d.at <= t) out[d.cast]++;
    else if (d.from !== null && d.from <= t) out.for++;
  }
  return out;
}
