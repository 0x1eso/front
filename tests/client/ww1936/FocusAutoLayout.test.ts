import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { describe, expect, it } from "vitest";
import { routeLook } from "../../../src/client/hud/ww1936/FocusCanvas";
import {
  fadedCards,
  focusGroups,
} from "../../../src/client/hud/ww1936/FocusGroups";
import {
  CARD_H,
  CARD_W,
  computeLayout,
  FOCUS_DONE,
  FOCUS_OPEN,
  FOCUS_PREREQ,
  FOCUS_RUNNING,
  relatives,
} from "../../../src/client/hud/ww1936/FocusLayout";

const DEU = CONTENT.treeFocuses.DEU.map((i) => CONTENT.focuses[i]);
const L = computeLayout(DEU);

describe("focus tree auto layout", () => {
  it("is deterministic, overlap-free and in group order", () => {
    expect(JSON.stringify(computeLayout(DEU))).toBe(JSON.stringify(L));
    for (let a = 0; a < L.n; a++) {
      for (let b = a + 1; b < L.n; b++) {
        const apart =
          L.x[a] + CARD_W <= L.x[b] ||
          L.x[b] + CARD_W <= L.x[a] ||
          L.y[a] + CARD_H <= L.y[b] ||
          L.y[b] + CARD_H <= L.y[a];
        expect(apart, `${DEU[a].id} / ${DEU[b].id}`).toBe(true);
      }
    }
    const groups = focusGroups(
      DEU,
      DEU.map(() => 0),
    ).map((g) => g.key);
    expect(L.bands.map((b) => b.key)).toEqual(groups);
    // Bands are columns left to right, and every card sits inside its band.
    L.bands.forEach((b, i) => {
      if (i > 0)
        expect(b.x).toBeGreaterThan(L.bands[i - 1].x + L.bands[i - 1].w - 1);
      for (const m of b.members) {
        expect(L.x[m]).toBeGreaterThanOrEqual(b.x);
        expect(L.x[m] + CARD_W).toBeLessThanOrEqual(b.x + b.w);
      }
    });
    // A prerequisite in the same band sits in an earlier row.
    DEU.forEach((_, c) => {
      for (const p of L.parents[c]) {
        if (L.band[p] === L.band[c]) expect(L.row[p]).toBeLessThan(L.row[c]);
      }
    });
  });

  it("routes every prerequisite from parent to child, one bus lane per parent", () => {
    const prereqs = new Set<string>();
    DEU.forEach((f, c) =>
      f.prereq?.forEach((g) =>
        g.forEach((id) => {
          const p = DEU.findIndex((d) => d.id === id);
          if (p >= 0) prereqs.add(`${p}>${c}`);
        }),
      ),
    );
    expect(L.routes.length).toBe(prereqs.size);
    const lanes = new Map<string, Set<number>>();
    for (const e of L.routes) {
      const n = e.pts.length;
      expect(e.pts[0]).toBe(L.x[e.from] + CARD_W / 2);
      expect(e.pts[1]).toBe(L.y[e.from] + CARD_H);
      expect(e.pts[n - 2]).toBe(L.x[e.to] + CARD_W / 2);
      expect(e.pts[n - 1]).toBe(L.y[e.to]);
      // Orthogonal: every segment is horizontal or vertical.
      for (let i = 2; i < n; i += 2) {
        expect(e.pts[i] === e.pts[i - 2] || e.pts[i + 1] === e.pts[i - 1]).toBe(
          true,
        );
      }
      // The bus lies in the gap under the parent's row.
      expect(e.lane).toBeGreaterThan(L.y[e.from] + CARD_H);
      expect(e.lane).toBeLessThan(L.y[e.from] + CARD_H + 400);
      const k = `${L.row[e.from]}`;
      const set = lanes.get(k) ?? new Set();
      set.add(e.from);
      lanes.set(k, set);
    }
    // Two parents of one row never share a lane y.
    const seen = new Map<string, number>();
    for (const e of L.routes) {
      const key = `${L.row[e.from]}:${e.lane}`;
      const owner = seen.get(key);
      if (owner !== undefined) expect(owner).toBe(e.from);
      seen.set(key, e.from);
    }
    // A pair shows once, with its ⊘ between the cards.
    expect(new Set(L.pairs.map((p) => `${p.a}:${p.b}`)).size).toBe(
      L.pairs.length,
    );
    // Line colours: done to done green (2), done to next white (1), else dim.
    expect(routeLook(FOCUS_DONE, FOCUS_DONE)).toBe(2);
    expect(routeLook(FOCUS_DONE, FOCUS_OPEN)).toBe(1);
    expect(routeLook(FOCUS_OPEN, FOCUS_PREREQ)).toBe(0);
  });

  it("the tap highlight finds the whole chain up and down", () => {
    const chain = [
      { id: "a", x: 0, y: 0, branch: "army" as const },
      { id: "b", x: 0, y: 1, branch: "army" as const, prereq: [["a"]] },
      { id: "c", x: 0, y: 2, branch: "army" as const, prereq: [["b"]] },
      { id: "d", x: 1, y: 2, branch: "army" as const, prereq: [["b"]] },
      { id: "z", x: 5, y: 2, branch: "navy" as const },
    ];
    const l = computeLayout(chain);
    const r = relatives(l, 1);
    expect([...r.up]).toEqual([0]);
    expect([...r.down].sort()).toEqual([2, 3]);
    const top = relatives(l, 0);
    expect(top.up.size).toBe(0);
    expect(top.down.size).toBe(3);
    expect(relatives(l, 4).up.size + relatives(l, 4).down.size).toBe(0);
  });

  it("the filters fade the right cards and keep the picked one", () => {
    const tree = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const states = [FOCUS_DONE, FOCUS_OPEN, FOCUS_PREREQ, FOCUS_RUNNING];
    const none = { available: false, history: false, hideDone: false };
    const keep = new Set<number>();
    expect(fadedCards(tree, states, none, undefined, keep)).toEqual([
      false,
      false,
      false,
      false,
    ]);
    expect(
      fadedCards(tree, states, { ...none, available: true }, undefined, keep),
    ).toEqual([true, false, true, false]);
    expect(
      fadedCards(tree, states, { ...none, hideDone: true }, undefined, keep),
    ).toEqual([true, false, false, false]);
    expect(
      fadedCards(tree, states, { ...none, history: true }, ["b", "c"], keep),
    ).toEqual([true, false, false, true]);
    // The picked card stays, whatever the filters say.
    expect(
      fadedCards(
        tree,
        states,
        { available: true, history: true, hideDone: true },
        ["b"],
        new Set([0]),
      ),
    ).toEqual([false, false, true, true]);
  });
});
