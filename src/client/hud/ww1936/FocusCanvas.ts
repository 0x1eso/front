// World War 1936 P3 (spec §21.3): the focus tree drawn on a Canvas 2D at the
// device's pixel ratio — lines, then cards (state border, dimming, lock,
// red slash, ✓, "skipped"), each with its white icon, a two-line name and
// a days chip. One finger pans, two fingers zoom, a double tap returns to
// 1×, a tap picks a card. It redraws only when the model's key changes or
// on input, at most once a frame.
import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { assetUrl } from "@openfront/shared/AssetUrls";
import {
  CARD_H,
  CARD_W,
  cardRect,
  centerOn,
  clampView,
  edges,
  FOCUS_BYPASSED,
  FOCUS_CONDITION,
  FOCUS_DONE,
  FOCUS_EXCLUSIVE,
  FOCUS_OPEN,
  FOCUS_PREREQ,
  FOCUS_QUEUED,
  FOCUS_RUNNING,
  FocusEdge,
  FocusViewport,
  hitCard,
  Rect,
  treeSize,
  ZOOM_MIN,
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
  [FOCUS_OPEN]: { border: "#fde047", fill: "#1f2937", alpha: 1 },
  [FOCUS_DONE]: { border: "#10b981", fill: "#022c22", alpha: 1 },
  [FOCUS_BYPASSED]: { border: "#6b7280", fill: "#1f2937", alpha: 0.7 },
  [FOCUS_RUNNING]: { border: "#67e8f9", fill: "#083344", alpha: 1 },
  [FOCUS_PREREQ]: { border: "#4b5563", fill: "#111827", alpha: 0.5 },
  [FOCUS_CONDITION]: { border: "#4b5563", fill: "#111827", alpha: 0.5 },
  [FOCUS_EXCLUSIVE]: { border: "#7f1d1d", fill: "#111827", alpha: 0.6 },
  [FOCUS_QUEUED]: { border: "#67e8f9", fill: "#1f2937", alpha: 1 },
};
const LINE_DIM = "rgba(255,255,255,0.28)";
const LINE_LIT = "rgba(255,255,255,0.85)";
const RED = "#ef4444";

/** Done or skipped: a line from it is lit, and it counts as done. */
const isDone = (s: number) => s === FOCUS_DONE || s === FOCUS_BYPASSED;

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
  private lines: FocusEdge[] = [];
  private linesOf: readonly FocusDef[] | null = null;
  private view: FocusViewport = { ox: 0, oy: 0, scale: 1 };
  private w = 0;
  private h = 0;
  private frame = 0;
  /** A card to centre once the canvas has a size. */
  private pendingCenter: number | "all" | null = null;
  private readonly pointers = new Map<number, Pointer>();
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

  setModel(m: FocusCanvasModel): void {
    if (this.model !== null && this.model.key === m.key) return;
    this.model = m;
    if (this.linesOf !== m.tree) {
      this.linesOf = m.tree;
      this.lines = edges(m.tree);
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

  /** Move to the card at `pos`, keeping the zoom. */
  panTo(pos: number): void {
    if (this.model === null || this.w === 0) {
      this.centerOn(pos);
      return;
    }
    this.view = centerOn(this.model.tree, pos, this.w, this.h, this.view.scale);
    this.requestDraw();
  }

  private applyCenter(): void {
    const m = this.model;
    if (m === null || this.w === 0 || this.h === 0) return;
    const c = this.pendingCenter;
    this.pendingCenter = null;
    if (c === "all") {
      const size = treeSize(m.tree);
      this.view = clampView(
        {
          scale: ZOOM_MIN,
          ox: (this.w - size.w * ZOOM_MIN) / 2,
          oy: (this.h - size.h * ZOOM_MIN) / 2,
        },
        m.tree,
        this.w,
        this.h,
      );
    } else if (c !== null) {
      this.view = centerOn(m.tree, c, this.w, this.h, 1);
    }
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
      this.view = clampView(this.view, this.model.tree, this.w, this.h);
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
    this.view = clampView(v, this.model.tree, this.w, this.h);
    this.requestDraw();
  }

  private readonly down = (e: PointerEvent) => {
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
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
    this.drag = null;
    this.pinch = null;
    if (this.pinched || d === null || d.moved) return;
    this.tap(p.x, p.y, e.timeStamp);
  };

  private readonly cancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) {
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

  /** A tap at canvas point (x, y): a double tap returns to 1×, a tap picks the card there. */
  tap(x: number, y: number, at: number): void {
    const last = this.lastTap;
    if (
      last !== null &&
      at - last.at < DOUBLE_TAP_MS &&
      Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_PX
    ) {
      this.lastTap = null;
      this.setView(zoomAt(this.view, 1, x, y));
      return;
    }
    this.lastTap = { x, y, at };
    if (this.model === null) return;
    const pos = hitCard(this.model.tree, x, y, this.view);
    if (pos >= 0) this.onPick(pos);
  }

  // ---- Drawing ----

  private screenRect(f: FocusDef): Rect {
    const r = cardRect(f, this.view.scale);
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
    const rects = m.tree.map((f) => this.screenRect(f));
    // Lines under the cards.
    for (const e of this.lines) {
      if (e.kind === "exclusive") continue;
      this.drawPrereq(
        ctx,
        rects[e.from],
        rects[e.to],
        e.kind === "or",
        isDone(m.states[e.from] ?? FOCUS_PREREQ),
        s,
      );
    }
    for (const e of this.lines) {
      if (e.kind === "exclusive")
        this.drawExclusive(ctx, rects[e.from], rects[e.to], s);
    }
    const font =
      getComputedStyle(this.canvas).fontFamily || "system-ui, sans-serif";
    m.tree.forEach((f, i) => {
      const r = rects[i];
      if (r.x > this.w || r.y > this.h || r.x + r.w < 0 || r.y + r.h < 0) {
        return;
      }
      this.drawCard(ctx, m, f, i, r, s, font);
    });
  }

  private drawPrereq(
    ctx: CanvasRenderingContext2D,
    a: Rect,
    b: Rect,
    dashed: boolean,
    lit: boolean,
    s: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = lit ? LINE_LIT : LINE_DIM;
    ctx.lineWidth = 2 * s;
    ctx.setLineDash(dashed ? [6 * s, 4 * s] : []);
    ctx.beginPath();
    const ax = a.x + a.w / 2;
    const bx = b.x + b.w / 2;
    if (a.y + a.h <= b.y) {
      // Down from the earlier card, across in the gutter below it, down into the later one.
      const gy = a.y + a.h + 4 * s;
      ctx.moveTo(ax, a.y + a.h);
      ctx.lineTo(ax, gy);
      ctx.lineTo(bx, gy);
      ctx.lineTo(bx, b.y);
    } else {
      ctx.moveTo(ax, a.y + a.h / 2);
      ctx.lineTo(bx, b.y + b.h / 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  private drawExclusive(
    ctx: CanvasRenderingContext2D,
    a: Rect,
    b: Rect,
    s: number,
  ): void {
    // Between the facing edges of the two cards, a red double line and ⨯.
    const acx = a.x + a.w / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const dx = bcx - acx;
    const dy = bcy - acy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const exit = (r: Rect) => {
      const tx = dx === 0 ? Infinity : r.w / 2 / Math.abs(dx);
      const ty = dy === 0 ? Infinity : r.h / 2 / Math.abs(dy);
      return Math.min(tx, ty);
    };
    const t0 = exit(a);
    const t1 = 1 - exit(b);
    if (t1 <= t0) return;
    const x0 = acx + dx * t0;
    const y0 = acy + dy * t0;
    const x1 = acx + dx * t1;
    const y1 = acy + dy * t1;
    const nx = (-dy / len) * 2 * s;
    const ny = (dx / len) * 2 * s;
    ctx.save();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(x0 + nx, y0 + ny);
    ctx.lineTo(x1 + nx, y1 + ny);
    ctx.moveTo(x0 - nx, y0 - ny);
    ctx.lineTo(x1 - nx, y1 - ny);
    ctx.stroke();
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const k = 4 * s;
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(mx, my, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(mx - k, my - k);
    ctx.lineTo(mx + k, my + k);
    ctx.moveTo(mx + k, my - k);
    ctx.lineTo(mx - k, my + k);
    ctx.stroke();
    ctx.restore();
  }

  private drawCard(
    ctx: CanvasRenderingContext2D,
    m: FocusCanvasModel,
    f: FocusDef,
    i: number,
    r: Rect,
    s: number,
    font: string,
  ): void {
    const state = m.states[i] ?? FOCUS_PREREQ;
    const look = LOOK[state] ?? LOOK[FOCUS_PREREQ];
    const radius = 6 * s;
    ctx.save();
    ctx.globalAlpha = look.alpha;
    // Body and border.
    if (state === FOCUS_OPEN) {
      ctx.shadowColor = "rgba(253,224,71,0.55)";
      ctx.shadowBlur = 8 * s;
    }
    ctx.fillStyle = look.fill;
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = look.border;
    ctx.lineWidth =
      (state === FOCUS_OPEN || state === FOCUS_RUNNING ? 2 : 1.5) * s;
    ctx.setLineDash(state === FOCUS_QUEUED ? [5 * s, 3 * s] : []);
    roundRect(ctx, r.x, r.y, r.w, r.h, radius);
    ctx.stroke();
    ctx.setLineDash([]);
    // Icon (24 px), with the running ring around it.
    const ix = r.x + 6 * s;
    const iy = r.y + 5 * s;
    const is = 24 * s;
    const img = iconImage(f.icon);
    if (img !== null) ctx.drawImage(img, ix, iy, is, is);
    if (state === FOCUS_RUNNING) {
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(ix + is / 2, iy + is / 2, is / 2 + 3 * s, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(
        ix + is / 2,
        iy + is / 2,
        is / 2 + 3 * s,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * Math.min(1, Math.max(0, m.progress)),
      );
      ctx.stroke();
    }
    // The days chip, or "skipped", at the top right; a mark beside it.
    ctx.font = `600 ${10 * s}px ${font}`;
    ctx.textBaseline = "middle";
    const chip = state === FOCUS_BYPASSED ? m.bypassed : (m.daysChips[i] ?? "");
    const cw = ctx.measureText(chip).width + 8 * s;
    const cx = r.x + r.w - cw - 5 * s;
    const cy = r.y + 5 * s;
    ctx.fillStyle =
      state === FOCUS_BYPASSED ? "#4b5563" : "rgba(255,255,255,0.12)";
    roundRect(ctx, cx, cy, cw, 14 * s, 7 * s);
    ctx.fill();
    ctx.fillStyle =
      state === FOCUS_BYPASSED ? "#e5e7eb" : "rgba(255,255,255,0.8)";
    ctx.textAlign = "center";
    ctx.fillText(chip, cx + cw / 2, cy + 7 * s);
    const markX = cx - 9 * s;
    const markY = cy + 7 * s;
    if (state === FOCUS_DONE) {
      ctx.strokeStyle = "#34d399";
      ctx.lineWidth = 2.2 * s;
      ctx.beginPath();
      ctx.moveTo(markX - 5 * s, markY);
      ctx.lineTo(markX - 1.5 * s, markY + 3.5 * s);
      ctx.lineTo(markX + 5 * s, markY - 4 * s);
      ctx.stroke();
    } else if (state === FOCUS_CONDITION) {
      drawLock(ctx, markX, markY, s);
    }
    // The name, two lines of text-xs, cut with an ellipsis.
    ctx.font = `600 ${FONT_PX * s}px ${font}`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    const lines = wrapLines(
      (t) => ctx.measureText(t).width,
      m.names[i] ?? "",
      CARD_W * s - 8 * s,
      2,
    );
    // Baselines: two lines at 42 and 56 (of 60), one line between them.
    const top = r.y + (lines.length === 1 ? 49 : 42) * s;
    lines.forEach((l, li) =>
      ctx.fillText(l, r.x + r.w / 2, top + li * LINE_PX * s),
    );
    ctx.restore();
    // Blocked by an exclusive choice: a red slash across the card.
    if (state === FOCUS_EXCLUSIVE) {
      ctx.save();
      ctx.strokeStyle = RED;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.moveTo(r.x + 4 * s, r.y + r.h - 4 * s);
      ctx.lineTo(r.x + r.w - 4 * s, r.y + 4 * s);
      ctx.stroke();
      ctx.restore();
    }
    if (i === m.selected) {
      ctx.save();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2 * s;
      roundRect(
        ctx,
        r.x - 3 * s,
        r.y - 3 * s,
        r.w + 6 * s,
        r.h + 6 * s,
        radius + 2 * s,
      );
      ctx.stroke();
      ctx.restore();
    }
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
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#e5e7eb";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.arc(x, y - 2 * s, 3 * s, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x - 4.5 * s, y - 2 * s, 9 * s, 7 * s);
  ctx.restore();
}

/** Card size (for the panel's layout maths). */
export const FOCUS_CARD = { w: CARD_W, h: CARD_H } as const;
