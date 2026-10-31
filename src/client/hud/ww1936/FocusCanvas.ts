// World War 1936 (spec §21.3): the focus tree drawn on a Canvas 2D at the
// device's pixel ratio — tinted group bands with headers, routed lines
// (colour by state, AND solid, OR dashed with a badge, exclusive pairs as a
// red ⊘), then cards (icon, two-line name, days, badges, progress bar). A
// tap picks a card and lights its ancestors (gold) and descendants (blue);
// a tap on empty space clears it. One finger or the mouse pans, two fingers
// or the wheel zoom, a double tap returns to 1× (on a band header: fits the
// band), the minimap pans on a tap. It redraws only when the model's key
// changes or on input, at most once a frame.
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import {
  CARD_H,
  CARD_W,
  cardRect,
  centerOn,
  clampView,
  fitAll,
  fitBand,
  FOCUS_BYPASSED,
  FOCUS_CONDITION,
  FOCUS_DONE,
  FOCUS_EXCLUSIVE,
  FOCUS_OPEN,
  FOCUS_PREREQ,
  FOCUS_QUEUED,
  FOCUS_RUNNING,
  FocusLayout,
  FocusViewport,
  HEAD_H,
  hitBand,
  hitCard,
  layoutOf,
  Rect,
  relatives,
  treeSize,
  zoomAt,
} from "./FocusLayout";

/** What the canvas shows; `key` changes whenever anything in it does. */
export interface FocusCanvasModel {
  key: string;
  tree: readonly FocusDef[];
  /** Card state by tree position (WwFocusCard.state). */
  states: readonly number[];
  /** The running card's progress, 0..1. */
  progress: number;
  /** The picked card's tree position, or -1. */
  selected: number;
  names: readonly string[];
  daysChips: readonly string[];
  /** The label of a skipped card ("Skipped"). */
  bypassed: string;
  /** Cards of a collapsed group (not drawn, not tappable). */
  hidden?: readonly boolean[];
  /** Search matches (ringed). */
  found?: readonly boolean[];
  /** The recommend star's card, or -1. */
  star?: number;
  /** Cards the view filters fade out (still tappable). */
  faded?: readonly boolean[];
  /** Cards on the historical path (a small ★). */
  history?: readonly boolean[];
  /** Band header texts by band key (name and done count). */
  bandNames?: Readonly<Record<string, string>>;
  /** Small badge texts. */
  texts?: { or: string; pick: string };
}

// ---- Icons: each SVG is read once into an Image and shared ----

const icons = new Map<string, HTMLImageElement>();
const iconWaiters = new Set<() => void>();

/** The focus icon's file (resources/images/ww1936/focus/<icon>.svg). */
export function focusIconUrl(icon: string): string {
  return assetUrl(`images/ww1936/focus/${icon}.svg`);
}

function iconImage(icon: string): HTMLImageElement | null {
  let img = icons.get(icon);
  if (img === undefined) {
    if (typeof Image === "undefined") return null;
    img = new Image();
    img.decoding = "async";
    img.onload = () => {
      for (const w of iconWaiters) w();
    };
    img.src = focusIconUrl(icon);
    icons.set(icon, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

// ---- Looks ----

const FONT_PX = 12; // text-xs
const LINE_PX = 14;
const LOOK: Readonly<
  Record<number, { border: string; fill: string; alpha: number }>
> = {
  [FOCUS_OPEN]: { border: "#ffffff", fill: "#1f2937", alpha: 1 },
  [FOCUS_DONE]: { border: "#10b981", fill: "#064e3b", alpha: 1 },
  [FOCUS_BYPASSED]: { border: "#6b7280", fill: "#1f2937", alpha: 0.7 },
  [FOCUS_RUNNING]: { border: "#facc15", fill: "#422006", alpha: 1 },
  [FOCUS_PREREQ]: { border: "#4b5563", fill: "#111827", alpha: 0.6 },
  [FOCUS_CONDITION]: { border: "#4b5563", fill: "#111827", alpha: 0.6 },
  [FOCUS_EXCLUSIVE]: { border: "#7f1d1d", fill: "#111827", alpha: 0.65 },
  [FOCUS_QUEUED]: { border: "#facc15", fill: "#1f2937", alpha: 1 },
};
const C_DIM = "#4b5563";
const C_OPEN = "#f9fafb";
const C_DONE = "#34d399";
const C_UP = "#fbbf24";
const C_DOWN = "#60a5fa";
const RED = "#ef4444";
const BAND_TINTS = [
  "96,165,250",
  "52,211,153",
  "251,191,36",
  "244,114,182",
  "167,139,250",
  "45,212,191",
  "251,146,60",
  "163,230,53",
];
const FADE = 0.14;
const MINI_W = 120;
const MINI_H = 72;
const MINI_PAD = 8;

/** Done or skipped: a line from it is lit, and it counts as done. */
const isDone = (s: number) => s === FOCUS_DONE || s === FOCUS_BYPASSED;
const isNext = (s: number) =>
  s === FOCUS_OPEN || s === FOCUS_RUNNING || s === FOCUS_QUEUED;

/** A route's colour class by the states at its ends: 2 green, 1 white (the path open now), 0 dim. */
export function routeLook(from: number, to: number): 0 | 1 | 2 {
  if (!isDone(from)) return 0;
  if (isDone(to)) return 2;
  return isNext(to) ? 1 : 0;
}

/** `text` cut to lines of at most `width`, the last one ending in "…" when cut. */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    if (measure(word) > width) {
      // A word wider than a line starts a line of its own and breaks
      // between characters.
      if (cur !== "") lines.push(cur);
      let line = "";
      for (const ch of word) {
        if (line.trim() !== "" && measure(line + ch) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        line += ch;
      }
      cur = line;
      continue;
    }
    const next = cur === "" ? word : `${cur} ${word}`;
    if (measure(next) <= width) {
      cur = next;
      continue;
    }
    if (cur !== "") lines.push(cur);
    cur = word;
  }
  if (cur !== "") lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = ellipsize(measure, kept[maxLines - 1], width);
  return kept;
}

function ellipsize(
  measure: (s: string) => number,
  s: string,
  width: number,
): string {
  let t = s;
  while (t.length > 0 && measure(`${t}…`) > width) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

interface Pointer {
  x: number;
  y: number;
}

/** A tap is a press that moved less than this (CSS px)... */
const TAP_SLOP = 8;
/** ...and a second tap within this time and distance doubles it. */
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 28;

export class FocusCanvas {
  private readonly ctx: CanvasRenderingContext2D | null;
  private model: FocusCanvasModel | null = null;
  private L: FocusLayout = layoutOf([]);
  private lit: {
    sel: number;
    up: Set<number>;
    down: Set<number>;
  } | null = null;
  private view: FocusViewport = { ox: 0, oy: 0, scale: 1 };
  private w = 0;
  private h = 0;
  private frame = 0;
  /** A card to centre once the canvas has a size. */
  private pendingCenter: number | "all" | null = null;
  private readonly pointers = new Map<number, Pointer>();
  private miniId: number | null = null;
  private drag: {
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null = null;
  private pinch: {
    dist: number;
    scale: number;
    mx: number;
    my: number;
    ox: number;
    oy: number;
  } | null = null;
  /** A pinch happened since the first finger went down: no tap. */
  private pinched = false;
  private lastTap: { x: number; y: number; at: number } | null = null;
  private readonly resizeObserver: ResizeObserver | null;
  private readonly redrawOnIcon = () => this.requestDraw();

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly onPick: (pos: number) => void,
  ) {
    this.ctx = canvas.getContext("2d");
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", this.down);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.up);
    canvas.addEventListener("pointercancel", this.cancel);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
    iconWaiters.add(this.redrawOnIcon);
    if (typeof ResizeObserver !== "undefined") {
      // Measured on the next frame: resizing inside the observer's callback
      // would report a ResizeObserver loop.
      this.resizeObserver = new ResizeObserver(() =>
        requestAnimationFrame(() => this.resize()),
      );
      this.resizeObserver.observe(canvas);
    } else {
      this.resizeObserver = null;
      window.addEventListener("resize", this.resize);
    }
    this.resize();
  }

  destroy(): void {
    this.canvas.removeEventListener("pointerdown", this.down);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.up);
    this.canvas.removeEventListener("pointercancel", this.cancel);
    this.canvas.removeEventListener("wheel", this.wheel);
    iconWaiters.delete(this.redrawOnIcon);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.resize);
    if (this.frame !== 0) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  /** The view (for tests and the panel). */
  viewport(): FocusViewport {
    return { ...this.view };
  }

  /** The tree's layout (cached per tree). */
  layout(): FocusLayout {
    return this.L;
  }

  setModel(m: FocusCanvasModel): void {
    if (this.model !== null && this.model.key === m.key) return;
    this.model = m;
    this.L = layoutOf(m.tree);
    if (this.lit?.sel !== m.selected) {
      this.lit =
        m.selected >= 0 && m.selected < this.L.n
          ? { sel: m.selected, ...relatives(this.L, m.selected) }
          : null;
    }
    this.requestDraw();
  }

  /** Put the card at tree position `pos` in the middle, at 1× (or at once when sized). */
  centerOn(pos: number): void {
    this.pendingCenter = pos;
    this.applyCenter();
  }

  /** The whole tree, zoomed out. */
  showAll(): void {
    this.pendingCenter = "all";
    this.applyCenter();
  }

  /** Band `b` fitted to the canvas. */
  fitBand(b: number): void {
    if (this.w === 0) return;
    this.view = fitBand(this.L, b, this.w, this.h);
    this.requestDraw();
  }

  /** Move to the card at `pos`, keeping the zoom. */
  panTo(pos: number): void {
    if (this.model === null || this.w === 0) {
      this.centerOn(pos);
      return;
    }
    this.view = centerOn(this.L, pos, this.w, this.h, this.view.scale);
    this.requestDraw();
  }

  private applyCenter(): void {
    const m = this.model;
    if (m === null || this.w === 0 || this.h === 0) return;
    const c = this.pendingCenter;
    this.pendingCenter = null;
    if (c === "all") this.view = fitAll(this.L, this.w, this.h);
    else if (c !== null) this.view = centerOn(this.L, c, this.w, this.h, 1);
    this.requestDraw();
  }

  private readonly resize = () => {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.w = r.width;
    this.h = r.height;
    const pw = Math.max(1, Math.round(r.width * dpr));
    const ph = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== pw) this.canvas.width = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;
    if (this.pendingCenter !== null) this.applyCenter();
    else if (this.model !== null && this.w > 0) {
      this.view = clampView(this.view, this.L, this.w, this.h);
    }
    this.requestDraw();
  };

  private requestDraw(): void {
    if (this.frame !== 0 || typeof requestAnimationFrame === "undefined") {
      return;
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  // ---- Input ----

  private local(e: PointerEvent | WheelEvent): Pointer {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private setView(v: FocusViewport): void {
    if (this.model === null) return;
    this.view = clampView(v, this.L, this.w, this.h);
    this.requestDraw();
  }

  /** The minimap's rect on the canvas, or null when the whole tree is in view. */
  private mini(): (Rect & { k: number }) | null {
    const size = treeSize(this.L);
    if (
      this.w === 0 ||
      (size.w * this.view.scale <= this.w && size.h * this.view.scale <= this.h)
    ) {
      return null;
    }
    const k = Math.min(MINI_W / size.w, MINI_H / size.h);
    const w = size.w * k;
    const h = size.h * k;
    return { x: this.w - w - MINI_PAD, y: this.h - h - MINI_PAD, w, h, k };
  }

  /** A minimap press or drag: centre the view on that tree point. */
  private miniTo(p: Pointer): void {
    const mr = this.mini();
    if (mr === null) return;
    const tx = (p.x - mr.x) / mr.k;
    const ty = (p.y - mr.y) / mr.k;
    this.setView({
      scale: this.view.scale,
      ox: this.w / 2 - tx * this.view.scale,
      oy: this.h / 2 - ty * this.view.scale,
    });
  }

  private readonly down = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    const mr = this.mini();
    if (
      mr !== null &&
      this.pointers.size === 0 &&
      p.x >= mr.x - 4 &&
      p.x <= mr.x + mr.w + 4 &&
      p.y >= mr.y - 4 &&
      p.y <= mr.y + mr.h + 4
    ) {
      this.miniId = e.pointerId;
      this.miniTo(p);
      return;
    }
    this.canvas.style.cursor = "grabbing";
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.pinched = false;
      this.drag = { ...p, ox: this.view.ox, oy: this.view.oy, moved: false };
      this.pinch = null;
    } else if (this.pointers.size === 2) {
      this.startPinch();
    }
  };

  private startPinch(): void {
    const [a, b] = [...this.pointers.values()];
    this.pinched = true;
    this.drag = null;
    this.pinch = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      scale: this.view.scale,
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
      ox: this.view.ox,
      oy: this.view.oy,
    };
  }

  private readonly move = (e: PointerEvent) => {
    if (this.miniId === e.pointerId) {
      this.miniTo(this.local(e));
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    if (this.pinch !== null && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const pi = this.pinch;
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      // Zoom about the pinch's first midpoint, then follow the fingers.
      const z = zoomAt(
        { ox: pi.ox, oy: pi.oy, scale: pi.scale },
        (pi.scale * dist) / pi.dist,
        pi.mx,
        pi.my,
      );
      this.setView({ ...z, ox: z.ox + mx - pi.mx, oy: z.oy + my - pi.my });
      return;
    }
    const d = this.drag;
    if (d === null) return;
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_SLOP) return;
    d.moved = true;
    this.setView({ ...this.view, ox: d.ox + dx, oy: d.oy + dy });
  };

  private readonly up = (e: PointerEvent) => {
    if (this.miniId === e.pointerId) {
      this.miniId = null;
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    this.pointers.delete(e.pointerId);
    const d = this.drag;
    if (this.pointers.size === 1) {
      // One finger left after a pinch: it pans from here, never taps.
      const [rest] = [...this.pointers.values()];
      this.pinch = null;
      this.drag = {
        ...rest,
        ox: this.view.ox,
        oy: this.view.oy,
        moved: true,
      };
      return;
    }
    if (this.pointers.size > 0) return;
    this.canvas.style.cursor = "grab";
    this.drag = null;
    this.pinch = null;
    if (this.pinched || d === null || d.moved) return;
    this.tap(p.x, p.y, e.timeStamp);
  };

  private readonly cancel = (e: PointerEvent) => {
    if (this.miniId === e.pointerId) this.miniId = null;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
      this.canvas.style.cursor = "grab";
      this.drag = null;
      this.pinch = null;
    }
  };

  private readonly wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.local(e);
    // Client-side view only (no engine): Math.exp is fine here.
    const k = Math.exp(-e.deltaY * 0.0015);
    this.setView(zoomAt(this.view, this.view.scale * k, p.x, p.y));
  };

  /**
   * A tap at canvas point (x, y): a double tap returns to 1× (on a band
   * header: fits the band), a tap picks the card there, a tap on empty
   * space clears the pick.
   */
  tap(x: number, y: number, at: number): void {
    const tx = (x - this.view.ox) / this.view.scale;
    const ty = (y - this.view.oy) / this.view.scale;
    const head = hitBand(this.L, tx, ty);
    const last = this.lastTap;
    if (
      last !== null &&
      at - last.at < DOUBLE_TAP_MS &&
      Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_PX
    ) {
      this.lastTap = null;
      if (head >= 0) this.fitBand(head);
      else this.setView(zoomAt(this.view, 1, x, y));
      return;
    }
    this.lastTap = { x, y, at };
    if (this.model === null || head >= 0) return;
    const pos = hitCard(this.L, x, y, this.view);
    if (pos >= 0 && this.model.hidden?.[pos] !== true) this.onPick(pos);
    else if (pos < 0 && this.model.selected >= 0) this.onPick(-1);
  }

  // ---- Drawing ----

  private screenRect(i: number): Rect {
    const r = cardRect(this.L, i, this.view.scale);
    return { ...r, x: r.x + this.view.ox, y: r.y + this.view.oy };
  }

  private draw(): void {
    const ctx = this.ctx;
    const m = this.model;
    if (ctx === null || m === null || this.w === 0) return;
    const dpr = this.canvas.width / this.w;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    const s = this.view.scale;
    const font =
      getComputedStyle(this.canvas).fontFamily || "system-ui, sans-serif";
    this.drawBands(ctx, m, s, font);
    this.drawRoutes(ctx, m, s);
    this.drawPairs(ctx, m, s, font);
    const L = this.L;
    const hid = (i: number) => m.hidden?.[i] === true;
    for (let i = 0; i < L.n; i++) {
      if (hid(i)) continue;
      const r = this.screenRect(i);
      if (r.x > this.w || r.y > this.h || r.x + r.w < 0 || r.y + r.h < 0) {
        continue;
      }
      this.drawCard(ctx, m, i, r, s, font);
    }
    this.drawMini(ctx, m);
  }

  /** 0..1 opacity of card `i` against filters and the tap highlight. */
  private fade(m: FocusCanvasModel, i: number): number {
    let a = m.faded?.[i] === true ? FADE : 1;
    const lit = this.lit;
    if (lit !== null && i !== lit.sel && !lit.up.has(i) && !lit.down.has(i)) {
      a = Math.min(a, 0.25);
    }
    return a;
  }

  private drawBands(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    s: number,
    font: string,
  ): void {
    const L = this.L;
    const top = this.view.oy;
    L.bands.forEach((b, bi) => {
      const x = b.x * s + this.view.ox;
      const w = b.w * s;
      if (x > this.w || x + w < 0) return;
      const tint = BAND_TINTS[bi % BAND_TINTS.length];
      const collapsed = b.members.every((i) => m.hidden?.[i] === true);
      ctx.save();
      ctx.fillStyle = `rgba(${tint},${collapsed ? 0.03 : 0.07})`;
      roundRect(ctx, x, top, w, L.height * s, 10 * s);
      ctx.fill();
      ctx.fillStyle = `rgba(${tint},0.22)`;
      roundRect(ctx, x, top, w, HEAD_H * s, 10 * s);
      ctx.fill();
      if (s >= 0.3) {
        ctx.fillStyle = "#f3f4f6";
        ctx.font = `700 ${Math.max(11, 13 * s)}px ${font}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        // Keep the label in view while the band is wider than the canvas.
        const lx = Math.max(x + 10 * s, Math.min(8, x + w - 120));
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, top, w, HEAD_H * s);
        ctx.clip();
        ctx.fillText(m.bandNames?.[b.key] ?? b.key, lx, top + (HEAD_H * s) / 2);
        ctx.restore();
      }
      ctx.restore();
    });
  }

  private routePath(
    ctx: CanvasRenderingContext2D,
    pts: number[],
    s: number,
  ): void {
    const { ox, oy } = this.view;
    const X = (i: number) => pts[i] * s + ox;
    const Y = (i: number) => pts[i + 1] * s + oy;
    ctx.beginPath();
    ctx.moveTo(X(0), Y(0));
    const R = 8 * s;
    for (let i = 2; i + 2 < pts.length; i += 2) {
      const r = Math.min(
        R,
        Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]) * s * 0.5,
        Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]) * s * 0.5,
      );
      ctx.arcTo(X(i), Y(i), X(i + 2), Y(i + 2), r);
    }
    ctx.lineTo(X(pts.length - 2), Y(pts.length - 2));
  }

  private drawRoutes(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    s: number,
  ): void {
    const L = this.L;
    const lit = this.lit;
    // Dim first, the open path above it, done on top; the tap highlight last.
    const rank = (k: number, i: number) => {
      const e = L.routes[i];
      if (lit !== null) {
        const inUp = (j: number) => j === lit.sel || lit.up.has(j);
        const inDown = (j: number) => j === lit.sel || lit.down.has(j);
        if (inUp(e.from) && inUp(e.to)) return k === 4 ? 1 : -1;
        if (inDown(e.from) && inDown(e.to)) return k === 3 ? 1 : -1;
        return k === 0 ? 1 : -1;
      }
      return routeLook(
        m.states[e.from] ?? FOCUS_PREREQ,
        m.states[e.to] ?? 0,
      ) === k
        ? 1
        : -1;
    };
    const color = [C_DIM, C_OPEN, C_DONE, C_DOWN, C_UP];
    const passes = lit !== null ? [0, 3, 4] : [0, 1, 2];
    ctx.save();
    ctx.lineJoin = "round";
    for (const k of passes) {
      ctx.strokeStyle = color[k];
      ctx.fillStyle = color[k];
      ctx.lineWidth = (k === 0 ? 1.5 : 2.2) * s;
      for (let i = 0; i < L.routes.length; i++) {
        if (rank(k, i) < 0) continue;
        const e = L.routes[i];
        if (m.hidden?.[e.from] === true || m.hidden?.[e.to] === true) continue;
        const faded = m.faded?.[e.from] === true || m.faded?.[e.to] === true;
        ctx.globalAlpha =
          lit !== null && k === 0 ? 0.25 : faded ? FADE : k === 0 ? 0.8 : 1;
        ctx.setLineDash(e.kind === "or" ? [6 * s, 4 * s] : []);
        this.routePath(ctx, e.pts, s);
        ctx.stroke();
        ctx.setLineDash([]);
        const n = e.pts.length;
        const ax = e.pts[n - 2] * s + this.view.ox;
        const ay = e.pts[n - 1] * s + this.view.oy;
        const a = 5 * s;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - a, ay - 1.6 * a);
        ctx.lineTo(ax + a, ay - 1.6 * a);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The "or" badge where alternatives merge.
    if (s >= 0.45 && m.texts !== undefined) {
      ctx.font = `700 ${9 * s}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const b of L.orBadges) {
        if (m.hidden?.[b.to] === true) continue;
        ctx.globalAlpha = this.fade(m, b.to);
        const bw = ctx.measureText(m.texts.or).width + 8 * s;
        const bx = b.x * s + this.view.ox;
        const by = b.y * s + this.view.oy;
        ctx.fillStyle = "#111827";
        ctx.strokeStyle = "#9ca3af";
        ctx.lineWidth = 1 * s;
        roundRect(ctx, bx - bw / 2, by - 7 * s, bw, 14 * s, 7 * s);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#e5e7eb";
        ctx.fillText(m.texts.or, bx, by);
      }
    }
    ctx.restore();
  }

  private drawPairs(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    s: number,
    font: string,
  ): void {
    const { ox, oy } = this.view;
    for (const p of this.L.pairs) {
      if (m.hidden?.[p.a] === true || m.hidden?.[p.b] === true) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(this.fade(m, p.a), this.fade(m, p.b));
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(p.x0 * s + ox, p.y0 * s + oy);
      ctx.lineTo(p.x1 * s + ox, p.y1 * s + oy);
      ctx.stroke();
      // The ⊘ connector, once per pair, with a "pick one" badge.
      const mx = p.x * s + ox;
      const my = p.y * s + oy;
      const r = 8 * s;
      ctx.fillStyle = "#111827";
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      const k = r * 0.7;
      ctx.beginPath();
      ctx.moveTo(mx - k, my + k);
      ctx.lineTo(mx + k, my - k);
      ctx.stroke();
      if (s >= 0.45 && m.texts !== undefined) {
        ctx.font = `700 ${9 * s}px ${font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const bw = ctx.measureText(m.texts.pick).width + 8 * s;
        ctx.fillStyle = "#7f1d1d";
        roundRect(ctx, mx - bw / 2, my + r + 2 * s, bw, 13 * s, 6.5 * s);
        ctx.fill();
        ctx.fillStyle = "#fecaca";
        ctx.fillText(m.texts.pick, mx, my + r + 8.5 * s);
      }
      ctx.restore();
    }
  }

  private drawCard(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    i: number,
    r: Rect,
    s: number,
    font: string,
  ): void {
    const state = m.states[i] ?? FOCUS_PREREQ;
    const look = LOOK[state] ?? LOOK[FOCUS_PREREQ];
    const f = m.tree[i];
    const radius = 8 * s;
    const fade = this.fade(m, i);
    ctx.save();
    ctx.globalAlpha = look.alpha * fade;
    if (state === FOCUS_OPEN) {
      ctx.shadowColor = "rgba(255,255,255,0.35)";
      ctx.shadowBlur = 8 * s;
    }
    ctx.fillStyle = look.fill;
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = look.border;
    ctx.lineWidth =
      (state === FOCUS_OPEN || state === FOCUS_RUNNING ? 2.5 : 1.5) * s;
    ctx.setLineDash(state === FOCUS_QUEUED ? [5 * s, 3 * s] : []);
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.stroke();
    ctx.setLineDash([]);
    if (s < 0.45) {
      ctx.restore();
      this.drawRings(ctx, m, i, r, s);
      return;
    }
    // Blocked by an exclusive choice: a red stripe down the left side.
    if (state === FOCUS_EXCLUSIVE) {
      ctx.fillStyle = RED;
      roundRect(ctx, r.x, r.y, 6 * s, r.h, radius);
      ctx.fill();
    }
    // Icon (28 px).
    const ix = r.x + 10 * s;
    const iy = r.y + 8 * s;
    const is = 28 * s;
    const img = iconImage(f.icon);
    if (img !== null) ctx.drawImage(img, ix, iy, is, is);
    // The days chip, or "skipped", at the top right; a mark beside it.
    ctx.font = `600 ${11 * s}px ${font}`;
    ctx.textBaseline = "middle";
    const chip = state === FOCUS_BYPASSED ? m.bypassed : (m.daysChips[i] ?? "");
    const cw = ctx.measureText(chip).width + 10 * s;
    const cx = r.x + r.w - cw - 8 * s;
    const cy = r.y + 9 * s;
    ctx.fillStyle =
      state === FOCUS_BYPASSED ? "#4b5563" : "rgba(255,255,255,0.14)";
    roundRect(ctx, cx, cy, cw, 16 * s, 8 * s);
    ctx.fill();
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.fillText(chip, cx + cw / 2, cy + 8 * s);
    // Badges after the icon: ★ history, 택1 for an exclusive choice.
    let bx = ix + is + 6 * s;
    const by = r.y + 17 * s;
    if (m.history?.[i] === true) {
      ctx.fillStyle = "#facc15";
      ctx.font = `700 ${13 * s}px ${font}`;
      ctx.textAlign = "left";
      ctx.fillText("★", bx, by);
      bx += 16 * s;
    }
    if ((f.exclusive?.length ?? 0) > 0 && m.texts !== undefined) {
      ctx.font = `700 ${9 * s}px ${font}`;
      const pw = ctx.measureText(m.texts.pick).width + 8 * s;
      if (bx + pw < cx - 2 * s) {
        ctx.fillStyle = "#7f1d1d";
        roundRect(ctx, bx, by - 6.5 * s, pw, 13 * s, 6.5 * s);
        ctx.fill();
        ctx.fillStyle = "#fecaca";
        ctx.textAlign = "center";
        ctx.fillText(m.texts.pick, bx + pw / 2, by);
      }
    }
    const markX = r.x + r.w - 14 * s;
    const markY = r.y + r.h - 14 * s;
    if (state === FOCUS_DONE) {
      ctx.strokeStyle = C_DONE;
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(markX - 5 * s, markY);
      ctx.lineTo(markX - 1.5 * s, markY + 3.5 * s);
      ctx.lineTo(markX + 5 * s, markY - 4 * s);
      ctx.stroke();
    } else if (state === FOCUS_CONDITION || state === FOCUS_PREREQ) {
      drawLock(ctx, markX, markY, s);
    }
    // The name: two lines, cut with an ellipsis.
    ctx.font = `600 ${FONT_PX * s}px ${font}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const lines = wrapLines(
      (t) => ctx.measureText(t).width,
      m.names[i] ?? "",
      CARD_W * s - 36 * s,
      2,
    );
    const nx = r.x + 10 * s;
    const top = r.y + (lines.length === 1 ? 62 : 55) * s;
    lines.forEach((l, li) => ctx.fillText(l, nx, top + li * LINE_PX * s));
    // Progress bar of the running focus.
    if (state === FOCUS_RUNNING) {
      const bw = r.w - 20 * s;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      roundRect(ctx, r.x + 10 * s, r.y + r.h - 9 * s, bw, 5 * s, 2.5 * s);
      ctx.fill();
      ctx.fillStyle = "#facc15";
      const p = Math.min(1, Math.max(0, m.progress));
      if (p > 0) {
        roundRect(
          ctx,
          r.x + 10 * s,
          r.y + r.h - 9 * s,
          Math.max(5 * s, bw * p),
          5 * s,
          2.5 * s,
        );
        ctx.fill();
      }
    }
    ctx.restore();
    this.drawRings(ctx, m, i, r, s);
  }

  /** Rings over a card: tap highlight (gold ancestors, blue descendants), search match, the pick, the star. */
  private drawRings(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    i: number,
    r: Rect,
    s: number,
  ): void {
    const ring = (color: string, width: number, grow: number) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width * s;
      roundRect(
        ctx,
        r.x - grow * s,
        r.y - grow * s,
        r.w + 2 * grow * s,
        r.h + 2 * grow * s,
        (8 + grow) * s,
      );
      ctx.stroke();
      ctx.restore();
    };
    const lit = this.lit;
    if (lit?.up.has(i) === true) ring(C_UP, 3, 2);
    else if (lit?.down.has(i) === true) ring(C_DOWN, 3, 2);
    if (m.found?.[i] === true) ring("#f472b6", 3, 5);
    if (i === m.selected) ring("#ffffff", 3, 3);
    if (m.star === i) {
      ctx.save();
      ctx.fillStyle = "#facc15";
      ctx.font = `700 ${18 * s}px system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText("★", r.x - 4 * s, r.y - 14 * s);
      ctx.restore();
    }
  }

  /** The minimap: bands, card dots and the view's frame (a tap pans). */
  private drawMini(ctx: CanvasRenderingContext2D, m: FocusCanvasModel): void {
    const mr = this.mini();
    if (mr === null) return;
    const L = this.L;
    ctx.save();
    ctx.fillStyle = "rgba(17,24,39,0.82)";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    roundRect(ctx, mr.x - 3, mr.y - 3, mr.w + 6, mr.h + 6, 6);
    ctx.fill();
    ctx.stroke();
    L.bands.forEach((b, bi) => {
      ctx.fillStyle = `rgba(${BAND_TINTS[bi % BAND_TINTS.length]},0.28)`;
      ctx.fillRect(mr.x + b.x * mr.k, mr.y, b.w * mr.k, mr.h);
    });
    for (let i = 0; i < L.n; i++) {
      const st = m.states[i] ?? FOCUS_PREREQ;
      ctx.fillStyle = isDone(st) ? C_DONE : isNext(st) ? C_OPEN : "#6b7280";
      ctx.fillRect(
        mr.x + L.x[i] * mr.k,
        mr.y + L.y[i] * mr.k,
        Math.max(1.5, CARD_W * mr.k),
        Math.max(1.5, CARD_H * mr.k),
      );
    }
    const v = this.view;
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
      mr.x + (-v.ox / v.scale) * mr.k,
      mr.y + (-v.oy / v.scale) * mr.k,
      (this.w / v.scale) * mr.k,
      (this.h / v.scale) * mr.k,
    );
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A small padlock centred at (x, y). */
function drawLock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
): void {
  ctx.save();
  ctx.fillStyle = "#9ca3af";
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.arc(x, y - 2 * s, 3 * s, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x - 4.5 * s, y - 2 * s, 9 * s, 7 * s);
  ctx.restore();
}

/** Card size (for the panel's layout maths). */
export const FOCUS_CARD = { w: CARD_W, h: CARD_H } as const;
