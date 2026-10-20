import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { describe, expect, it } from "vitest";
import {
  FocusCanvas,
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
  GRID_W,
  hitCard,
  initialCenter,
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
        const r = cardRect(f, scale);
        const cx = r.x + r.w / 2 + view.ox;
        const cy = r.y + r.h / 2 + view.oy;
        expect(hitCard(TREE, cx, cy, view), `${f.id} @${scale}`).toBe(i);
        // Corners are on the card; the gutter between cells is not.
        expect(hitCard(TREE, r.x + view.ox + 1, r.y + view.oy + 1, view)).toBe(
          i,
        );
        expect(
          hitCard(TREE, r.x + view.ox - 2 * scale, cy, view),
          `${f.id} gutter @${scale}`,
        ).toBe(-1);
      });
    }
    // A card is 96 × 60 inside a 104 × 68 cell.
    expect(cardRect({ x: 2, y: 1 }, 1)).toEqual({
      x: 2 * GRID_W + 4,
      y: GRID_H + 4,
      w: CARD_W,
      h: CARD_H,
    });
    // Empty cells hit nothing.
    expect(
      hitCard(TREE, GRID_W * 1.5, GRID_H * 0.5, { ox: 0, oy: 0, scale: 1 }),
    ).toBe(-1);
  });

  it("the view stays inside the tree", () => {
    const size = treeSize(DEU);
    expect(size).toEqual({ w: 20 * GRID_W, h: 8 * GRID_H });
    const w = 500;
    const h = 200;
    // Zoom is clamped.
    expect(clampView({ ox: 0, oy: 0, scale: 3 }, DEU, w, h).scale).toBe(
      ZOOM_MAX,
    );
    expect(clampView({ ox: 0, oy: 0, scale: 0.1 }, DEU, w, h).scale).toBe(
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
        const v = clampView({ ox, oy, scale }, DEU, w, h);
        expect(v.ox).toBeLessThanOrEqual(0);
        expect(v.oy).toBeLessThanOrEqual(0);
        expect(v.ox + size.w * v.scale).toBeGreaterThanOrEqual(w);
        expect(v.oy + size.h * v.scale).toBeGreaterThanOrEqual(h);
      }
    }
    // A tree smaller than the canvas stays whole inside it.
    const small = treeSize(TREE);
    for (const [ox, oy] of [
      [-900, -900],
      [900, 900],
    ]) {
      const v = clampView({ ox, oy, scale: 1 }, TREE, 1000, 600);
      expect(v.ox).toBeGreaterThanOrEqual(0);
      expect(v.oy).toBeGreaterThanOrEqual(0);
      expect(v.ox + small.w).toBeLessThanOrEqual(1000);
      expect(v.oy + small.h).toBeLessThanOrEqual(600);
    }
    // Zooming about a point keeps that point still.
    const z = zoomAt({ ox: -100, oy: -40, scale: 1 }, 1.2, 250, 100);
    expect((250 - z.ox) / z.scale).toBeCloseTo((250 + 100) / 1);
    expect((100 - z.oy) / z.scale).toBeCloseTo((100 + 40) / 1);
    // Centring on a card puts it in the middle when the tree allows it.
    const mid = DEU.findIndex((f) => f.x === 10 && f.y === 2);
    expect(mid).toBeGreaterThanOrEqual(0);
    const c = centerOn(DEU, mid, w, h);
    const r = cardRect(DEU[mid], 1);
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
    expect(chipFirst(TREE, "all")).toBe(0);
    expect(chipFirst(TREE, "politics")).toBe(1);
    expect(chipFirst(TREE, "air_navy")).toBe(4);
    expect(chipFirst(TREE, "research")).toBe(-1);
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
    const r = cardRect(TREE[3], 1);
    fc.tap(r.x + 10, r.y + 10, 1_000);
    expect(picked).toEqual([3]);
    // A gutter is no card.
    fc.tap(GRID_W * 1.5, GRID_H * 0.5, 5_000);
    expect(picked).toEqual([3]);
    // Twice quickly: back to 1× about that point, nothing more picked.
    (
      fc as unknown as { view: { ox: number; oy: number; scale: number } }
    ).view = { ox: 0, oy: 0, scale: 0.6 };
    fc.tap(50, 30, 9_000);
    fc.tap(52, 31, 9_200);
    expect(fc.viewport().scale).toBe(1);
    expect(picked).toEqual([3, 0]);
    fc.destroy();
  });
});
