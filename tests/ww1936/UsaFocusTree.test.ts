// The United States' expanded national focus tree: size, forks and groups.
import {
  USA_BRANCHES,
  USA_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/usa";
import { describe, expect, it } from "vitest";

describe("USA focus tree", () => {
  it("has about 100 focuses, grouped, with symmetric forks", () => {
    expect(USA_FOCUSES.length).toBeGreaterThanOrEqual(95);
    const byId = new Map(USA_FOCUSES.map((f) => [f.id, f]));
    expect(byId.size).toBe(USA_FOCUSES.length);
    for (const f of USA_FOCUSES) {
      for (const e of f.exclusive ?? []) {
        expect(byId.get(e)?.exclusive).toContain(f.id);
      }
    }
    const added = USA_FOCUSES.filter((f) => f.group);
    expect(added.length).toBeGreaterThanOrEqual(50);
    expect(new Set(added.map((f) => f.group)).size).toBe(6);
    for (const b of USA_BRANCHES) {
      expect(byId.has(b.historical)).toBe(true);
      for (const a of b.alternatives) {
        expect(byId.get(b.historical)?.exclusive).toContain(a);
      }
    }
  });
});
