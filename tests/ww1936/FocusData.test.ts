// World War 1936 P3 (spec §11, §24.2): the focus trees' data. Passes on
// empty tables; the content lanes fill them (plan Task 1 Step 15).
import {
  WwConditionSchema,
  WwEffectSchema,
} from "@openfront/engine-api/ww1936/PoliticsDsl";
import { FOCUS_TREES } from "@openfront/engine-api/ww1936/PoliticsTypes";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { FOCUS_ICONS } from "@openfront/engine-lib/ww1936/content/types";
import fs from "fs";
import { CONTENT_TARGETS, hasKey } from "./contentUtil";

/** Task 7 draws the icons; until it merges a missing file is fine. */
const ICONS_PENDING = false;

describe("focus data", () => {
  const { focuses, treeFocuses, focusIdx } = CONTENT;

  it("every focus passes the schemas", () => {
    for (const f of focuses) {
      for (const e of f.effects) WwEffectSchema.parse(e);
      for (const c of [f.available, f.bypass, f.cancelIf]) {
        if (c) WwConditionSchema.parse(c);
      }
      for (const m of f.ai?.mods ?? []) WwConditionSchema.parse(m.if);
    }
  });

  it("ids are unique across focuses, events, decisions and spirits", () => {
    const ids = [
      ...focuses.map((f) => f.id),
      ...CONTENT.events.map((e) => e.id),
      ...CONTENT.decisions.map((d) => d.id),
      ...CONTENT.spirits.map((s) => s.id),
    ];
    expect(ids.filter((x, i) => ids.indexOf(x) !== i)).toEqual([]);
  });

  it("ids carry their tree prefix", () => {
    for (const f of focuses) {
      const prefix = f.tree === "generic" ? "gen_" : `${f.tree.toLowerCase()}_`;
      expect(f.id.startsWith(prefix), f.id).toBe(true);
    }
  });

  it("cells are on the grid and do not overlap within a tree", () => {
    for (const t of FOCUS_TREES) {
      const seen = new Set<string>();
      for (const i of treeFocuses[t]) {
        const f = focuses[i];
        expect(f.x >= 0 && f.x <= 19 && f.y >= 0 && f.y <= 14, f.id).toBe(true);
        expect(seen.has(`${f.x},${f.y}`), f.id).toBe(false);
        seen.add(`${f.x},${f.y}`);
      }
    }
  });

  it("prerequisites are in the same tree, above, and acyclic", () => {
    for (const f of focuses) {
      for (const group of f.prereq ?? []) {
        for (const p of group) {
          const q = focuses[focusIdx.get(p) ?? -1];
          expect(q, `${f.id} needs ${p}`).toBeDefined();
          expect(q.tree).toBe(f.tree);
          // Strictly above: no cycle can form.
          expect(q.y, `${f.id} needs ${p}`).toBeLessThan(f.y);
        }
      }
    }
  });

  it("exclusive pairs are symmetric, same tree, and never prerequisites of each other", () => {
    for (const f of focuses) {
      for (const x of f.exclusive ?? []) {
        const q = focuses[focusIdx.get(x) ?? -1];
        expect(q, `${f.id} excludes ${x}`).toBeDefined();
        expect(q.exclusive ?? [], `${x} excludes ${f.id}`).toContain(f.id);
        expect(q.tree).toBe(f.tree);
        expect((f.prereq ?? []).flat()).not.toContain(x);
      }
    }
  });

  it("days are 35, 70 or 105 and the trees have their sizes", () => {
    for (const f of focuses) expect([35, 70, 105]).toContain(f.days);
    for (const t of FOCUS_TREES) {
      expect([0, CONTENT_TARGETS[t]], t).toContain(treeFocuses[t].length);
    }
  });

  it("each history path is valid: known ids, prerequisites earlier, no exclusive pair together", () => {
    for (const t of FOCUS_TREES) {
      // "@ideo" / "@ideo_ally" are the generic path's ideology slots (Task 2).
      const path = (CONTENT.paths[t] ?? []).filter((x) => !x.startsWith("@"));
      const seen = new Set<string>();
      for (const id of path) {
        const f = focuses[focusIdx.get(id) ?? -1];
        expect(f?.tree, `${t} path ${id}`).toBe(t);
        for (const group of f.prereq ?? []) {
          const met = group.some(
            (p) => seen.has(p) || (t === "generic" && p.startsWith("gen_pol_")),
          );
          expect(met, `${id} before its prerequisite`).toBe(true);
        }
        for (const x of f.exclusive ?? []) expect(seen.has(x)).toBe(false);
        seen.add(id);
      }
    }
  });

  it("branch points name a historical focus and exclusive alternatives", () => {
    for (const t of FOCUS_TREES) {
      for (const bp of CONTENT.branchPoints[t] ?? []) {
        for (const a of bp.alternatives) {
          expect(focusIdx.has(a), `${bp.id}: ${a}`).toBe(true);
        }
        if (bp.historical.startsWith("@")) {
          // An "@" slot (Task 2 expands it): the alternatives exclude each other.
          for (const a of bp.alternatives) {
            const f = focuses[focusIdx.get(a)!];
            for (const b of bp.alternatives) {
              if (b !== a)
                expect(f.exclusive ?? [], `${a} / ${b}`).toContain(b);
            }
          }
          continue;
        }
        const h = focuses[focusIdx.get(bp.historical) ?? -1];
        expect(h, `${bp.id}: ${bp.historical}`).toBeDefined();
        for (const a of bp.alternatives) {
          expect(h.exclusive ?? [], `${bp.id}: ${a}`).toContain(a);
        }
      }
    }
  });

  it("every focus has its name, description and icon", () => {
    for (const f of focuses) {
      expect(hasKey(`ww1936.focus.${f.id}`), f.id).toBe(true);
      expect(hasKey(`ww1936.focus_desc.${f.id}`), f.id).toBe(true);
      expect(FOCUS_ICONS as readonly string[], f.id).toContain(f.icon);
      expect(
        fs.existsSync(`resources/images/ww1936/focus/${f.icon}.svg`) ||
          ICONS_PENDING,
        f.icon,
      ).toBe(true);
    }
  });
});
