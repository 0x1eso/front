import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FocusCanvas,
  FocusCanvasModel,
  wrapLines,
} from "../../../src/client/hud/ww1936/FocusCanvas";
import {
  CARD_H,
  CARD_W,
  cardRect,
  centerOn,
  chipFirst,
  clampView,
  edges,
  GRID_H,
  hitCard,
  initialCenter,
  layoutOf,
  TOP_PAD,
  treeSize,
  ZOOM_MAX,
  ZOOM_MIN,
  zoomAt,
} from "../../../src/client/hud/ww1936/FocusLayout";

type F = Pick<FocusDef, "id" | "x" | "y" | "branch" | "prereq" | "exclusive">;

/**
 *   a(0,0)        b(2,0)
 *   c(0,1)=a      d(2,1)=a|b ⨯ e
 *                 e(3,1)=b
 *   f(1,2)=c & (d|e)
 */
const TREE: F[] = [
  { id: "a", x: 0, y: 0, branch: "industry" },
  { id: "b", x: 2, y: 0, branch: "politics" },
  { id: "c", x: 0, y: 1, branch: "industry", prereq: [["a"]] },
  {
    id: "d",
    x: 2,
    y: 1,
    branch: "politics",
    prereq: [["a", "b"]],
    exclusive: ["e"],
  },
  { id: "e", x: 3, y: 1, branch: "navy", prereq: [["b"]], exclusive: ["d"] },
  { id: "f", x: 1, y: 2, branch: "army", prereq: [["c"], ["d", "e"]] },
];

const DEU = CONTENT.treeFocuses.DEU.map((i) => CONTENT.focuses[i]);
const LT = layoutOf(TREE);
const LD = layoutOf(DEU);
/** The row-0 card nearest the left edge: always on a 400 × 200 canvas at the origin. */
const FIRST = LD.row.reduce(
  (best, r, i) => (r === 0 && (best < 0 || LD.x[i] < LD.x[best]) ? i : best),
  -1,
);

describe("focus tree layout (spec §21.3)", () => {
  it("edges mark AND, OR and exclusive pairs", () => {
    expect(edges(TREE)).toEqual([
      { from: 0, to: 2, kind: "and" },
      { from: 0, to: 3, kind: "or" },
      { from: 1, to: 3, kind: "or" },
      { from: 1, to: 4, kind: "and" },
      { from: 2, to: 5, kind: "and" },
      { from: 3, to: 5, kind: "or" },
      { from: 4, to: 5, kind: "or" },
      // d ⨯ e is listed on both cards, drawn once.
      { from: 3, to: 4, kind: "exclusive" },
    ]);
    // The real trees: every exclusive pair once, every prerequisite a line.
    const real = edges(DEU);
    const ex = real.filter((e) => e.kind === "exclusive");
    const keys = ex.map((e) => `${e.from}:${e.to}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const e of ex) expect(e.from).toBeLessThan(e.to);
    const prereqs = DEU.reduce(
      (n, f) => n + (f.prereq ?? []).reduce((m, g) => m + g.length, 0),
      0,
    );
    expect(real.length - ex.length).toBe(prereqs);
  });

  it("hit testing finds the card under a point at every zoom", () => {
    for (const scale of [ZOOM_MIN, 0.8, 1, ZOOM_MAX]) {
      const view = { ox: 37, oy: -12, scale };
      TREE.forEach((f, i) => {
        const r = cardRect(LT, i, scale);
        const cx = r.x + r.w / 2 + view.ox;
        const cy = r.y + r.h / 2 + view.oy;
        expect(hitCard(LT, cx, cy, view), `${f.id} @${scale}`).toBe(i);
        // Corners are on the card; just outside it is not.
        expect(hitCard(LT, r.x + view.ox + 1, r.y + view.oy + 1, view)).toBe(i);
        expect(
          hitCard(LT, r.x + view.ox - 2 * scale, cy, view),
          `${f.id} gutter @${scale}`,
        ).toBe(-1);
      });
    }
    // A card is 140 × 84 and the rows are at least 110 apart.
    expect(cardRect(LT, 0, 1)).toMatchObject({ w: CARD_W, h: CARD_H });
    expect(CARD_W).toBe(140);
    expect(CARD_H).toBe(84);
    expect(GRID_H).toBe(110);
    // The header strip is no card.
    expect(hitCard(LT, 1, 1, { ox: 0, oy: 0, scale: 1 })).toBe(-1);
  });

  it("the view stays inside the tree", () => {
    const size = treeSize(LD);
    expect(size).toEqual({ w: LD.width, h: LD.height });
    expect(size.w).toBeGreaterThan(500);
    const w = 500;
    const h = 200;
    // Zoom is clamped.
    expect(clampView({ ox: 0, oy: 0, scale: 3 }, LD, w, h).scale).toBe(
      ZOOM_MAX,
    );
    expect(clampView({ ox: 0, oy: 0, scale: 0.1 }, LD, w, h).scale).toBe(
      ZOOM_MIN,
    );
    // Dragged far past any edge, the tree still covers the canvas.
    for (const scale of [ZOOM_MIN, 1, ZOOM_MAX]) {
      for (const [ox, oy] of [
        [5000, 5000],
        [-5000, -5000],
        [5000, -5000],
        [-5000, 5000],
      ]) {
        const v = clampView({ ox, oy, scale }, LD, w, h);
        expect(v.ox).toBeLessThanOrEqual(0);
        expect(v.oy).toBeLessThanOrEqual(0);
        expect(v.ox + size.w * v.scale).toBeGreaterThanOrEqual(w);
        expect(v.oy + size.h * v.scale).toBeGreaterThanOrEqual(h);
      }
    }
    // A tree smaller than the canvas stays whole inside it.
    const small = treeSize(LT);
    for (const [ox, oy] of [
      [-900, -900],
      [900, 900],
    ]) {
      const v = clampView({ ox, oy, scale: 1 }, LT, 4000, 1500);
      expect(v.ox).toBeGreaterThanOrEqual(0);
      expect(v.oy).toBeGreaterThanOrEqual(0);
      expect(v.ox + small.w).toBeLessThanOrEqual(4000);
      expect(v.oy + small.h).toBeLessThanOrEqual(1500);
    }
    // Zooming about a point keeps that point still.
    const z = zoomAt({ ox: -100, oy: -40, scale: 1 }, 1.2, 250, 100);
    expect((250 - z.ox) / z.scale).toBeCloseTo((250 + 100) / 1);
    expect((100 - z.oy) / z.scale).toBeCloseTo((100 + 40) / 1);
    // Centring on a card puts it in the middle when the tree allows it.
    const mid = Math.floor(DEU.length / 2);
    const c = centerOn(LD, mid, w, h);
    const r = cardRect(LD, mid, 1);
    expect(r.x + r.w / 2 + c.ox).toBeCloseTo(w / 2);
    expect(r.y + r.h / 2 + c.oy).toBeCloseTo(h / 2);
  });

  it("opens on the running card, else the first open one", () => {
    const card = (idx: number, state: number) => ({ idx, state, failing: [] });
    expect(initialCenter([card(0, 1), card(1, 0), card(2, 3)])).toBe(2);
    expect(
      initialCenter([card(0, 1), card(1, 4), card(2, 0), card(3, 0)]),
    ).toBe(2);
    expect(initialCenter([card(0, 1), card(1, 4)])).toBe(-1);
    expect(initialCenter([])).toBe(-1);
  });

  it("a branch chip finds its top-left card", () => {
    expect(chipFirst(LT, TREE, "all")).toBe(0);
    expect(chipFirst(LT, TREE, "politics")).toBe(1);
    expect(chipFirst(LT, TREE, "air_navy")).toBe(4);
    expect(chipFirst(LT, TREE, "research")).toBe(-1);
  });

  it("names wrap to two lines and end in an ellipsis when cut", () => {
    // One unit per character, eight to a line.
    const m = (t: string) => t.length;
    expect(wrapLines(m, "Four Year Plan", 8, 2)).toEqual(["Four", "Year…"]);
    expect(wrapLines(m, "An Axis", 8, 2)).toEqual(["An Axis"]);
    expect(wrapLines(m, "Rhineland Remilitarization", 12, 2)).toEqual([
      "Rhineland",
      "Remilitariz…",
    ]);
    expect(wrapLines(m, "Remilitarization", 12, 2)).toEqual([
      "Remilitariza",
      "tion",
    ]);
    expect(wrapLines(m, "", 8, 2)).toEqual([]);
  });

  it("a tap on the canvas picks the card under it, a double tap returns to 1×", () => {
    const canvas = document.createElement("canvas");
    const picked: number[] = [];
    const fc = new FocusCanvas(canvas, (p) => picked.push(p));
    fc.setModel({
      key: "k",
      tree: TREE as FocusDef[],
      states: TREE.map(() => 0),
      progress: 0,
      selected: -1,
      names: TREE.map((f) => f.id),
      daysChips: TREE.map(() => "70"),
      bypassed: "skipped",
    });
    const r = cardRect(LT, 3, 1);
    fc.tap(r.x + 10, r.y + 10, 1_000);
    expect(picked).toEqual([3]);
    // Empty space picks nothing while nothing is picked.
    fc.tap(2, TOP_PAD + 3, 5_000);
    expect(picked).toEqual([3]);
    // Twice quickly: back to 1× about that point, nothing more picked.
    (
      fc as unknown as { view: { ox: number; oy: number; scale: number } }
    ).view = { ox: 0, oy: 0, scale: 0.6 };
    fc.tap(1, TOP_PAD * 0.6 + 2, 9_000);
    fc.tap(2, TOP_PAD * 0.6 + 3, 9_200);
    expect(fc.viewport().scale).toBe(1);
    expect(picked).toEqual([3]);
    fc.destroy();
  });
});

describe("the focus canvas's input and redraws (spec §21.3)", () => {
  // A 400 × 200 canvas over the German tree (2,080 × 544 at 1×), frames run by hand.
  let frames: FrameRequestCallback[] = [];
  const flush = () => {
    const run = frames;
    frames = [];
    for (const f of run) f(0);
  };

  function setup() {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 200 }) as DOMRect;
    document.body.appendChild(canvas);
    const picked: number[] = [];
    const fc = new FocusCanvas(canvas, (p) => picked.push(p));
    flush();
    fc.setModel(model("k1"));
    flush();
    const ptr = (type: string, id: number, x: number, y: number) =>
      canvas.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
      );
    return { canvas, fc, picked, ptr };
  }

  const model = (key: string): FocusCanvasModel => ({
    key,
    tree: DEU,
    states: DEU.map(() => 0),
    progress: 0,
    selected: -1,
    names: DEU.map((f) => f.id),
    daysChips: DEU.map(() => "70"),
    bypassed: "skipped",
  });

  const RHINE = FIRST;
  const c0 = cardRect(LD, RHINE, 1);
  const px = c0.x + 20;
  const py = c0.y + 20;

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("one finger pans the tree; a drag never taps", () => {
    const { fc, picked, ptr } = setup();
    expect(px).toBeLessThan(400);
    // A press that hardly moves is a tap on the card under it.
    ptr("pointerdown", 1, px, py);
    ptr("pointermove", 1, px + 2, py + 1);
    ptr("pointerup", 1, px + 2, py + 1);
    expect(picked).toEqual([RHINE]);
    expect(fc.viewport()).toEqual({ ox: 0, oy: 0, scale: 1 });
    // A drag from the same card moves the view with the finger, and picks nothing.
    ptr("pointerdown", 1, px, py);
    ptr("pointermove", 1, px - 30, py - 5);
    ptr("pointermove", 1, px - 50, py - 10);
    ptr("pointerup", 1, px - 50, py - 10);
    expect(fc.viewport()).toEqual({ ox: -50, oy: -10, scale: 1 });
    expect(picked).toEqual([RHINE]);
    // Dragged past the tree's edge, the view stops at it.
    ptr("pointerdown", 1, 100, 100);
    ptr("pointermove", 1, 600, 400);
    ptr("pointerup", 1, 600, 400);
    expect(fc.viewport()).toEqual({ ox: 0, oy: 0, scale: 1 });
  });

  it("two fingers zoom; a pinch end never taps", () => {
    const { fc, picked, ptr } = setup();
    // Finger 1 rests on the Rhineland card, finger 2 spreads away from it.
    ptr("pointerdown", 1, 330, 30);
    ptr("pointerdown", 2, 230, 30);
    ptr("pointermove", 2, 205, 30);
    // 100 → 125 px apart: 1.25× about the pinch.
    expect(fc.viewport().scale).toBeCloseTo(1.25);
    ptr("pointermove", 2, 30, 30);
    // Further apart stays at the limit.
    expect(fc.viewport().scale).toBe(ZOOM_MAX);
    // Lifting one finger: the other pans from there and never taps.
    ptr("pointerup", 2, 30, 30);
    const before = fc.viewport();
    ptr("pointermove", 1, 300, 30);
    expect(fc.viewport().ox).toBeCloseTo(before.ox - 30);
    ptr("pointerup", 1, 300, 30);
    expect(picked).toEqual([]);
    // Both fingers still, released together: still no tap.
    ptr("pointerdown", 1, 330, 30);
    ptr("pointerdown", 2, 230, 30);
    ptr("pointerup", 2, 230, 30);
    ptr("pointerup", 1, 330, 30);
    expect(picked).toEqual([]);
    // Pinching in stops at the minimum.
    ptr("pointerdown", 1, 300, 100);
    ptr("pointerdown", 2, 100, 100);
    ptr("pointermove", 2, 290, 100);
    expect(fc.viewport().scale).toBe(ZOOM_MIN);
    ptr("pointerup", 2, 290, 100);
    ptr("pointerup", 1, 300, 100);
    expect(picked).toEqual([]);
  });

  it("it redraws only when the model changes or on input", () => {
    const draw = vi.spyOn(
      FocusCanvas.prototype as unknown as { draw: () => void },
      "draw",
    );
    const { fc, ptr } = setup();
    draw.mockClear();
    flush();
    expect(draw).not.toHaveBeenCalled();
    // The same key again (a new object, e.g. after a politics update that changed nothing shown).
    fc.setModel(model("k1"));
    flush();
    expect(draw).not.toHaveBeenCalled();
    // Two changes before the next frame: one redraw.
    fc.setModel(model("k2"));
    fc.setModel(model("k3"));
    flush();
    expect(draw).toHaveBeenCalledTimes(1);
    // Input redraws, once a frame.
    ptr("pointerdown", 1, 200, 100);
    ptr("pointermove", 1, 180, 100);
    ptr("pointermove", 1, 160, 100);
    ptr("pointerup", 1, 160, 100);
    flush();
    expect(draw).toHaveBeenCalledTimes(2);
    flush();
    expect(draw).toHaveBeenCalledTimes(2);
  });
});
