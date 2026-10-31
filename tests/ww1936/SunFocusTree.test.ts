// The Soviet tree after the expansion: size, exclusive forks and groups.
import {
  SUN_BRANCHES,
  SUN_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/sun";
import { describe, expect, it } from "vitest";

describe("SUN focus tree", () => {
  const byId = new Map<string, (typeof SUN_FOCUSES)[number]>(
    SUN_FOCUSES.map((f) => [f.id, f]),
  );

  it("has about 100 focuses and every new focus has a group", () => {
    expect(SUN_FOCUSES.length).toBe(97);
    expect(SUN_FOCUSES.filter((f) => "group" in f).length).toBe(50);
  });

  it("branch points are real, and their forks are exclusive both ways", () => {
    expect(SUN_BRANCHES.length).toBeGreaterThanOrEqual(8);
    for (const b of SUN_BRANCHES) {
      const h = byId.get(b.historical);
      expect(h, b.id).toBeDefined();
      for (const a of b.alternatives) {
        const alt = byId.get(a);
        expect(alt, a).toBeDefined();
        const hx = (h as { exclusive?: string[] }).exclusive ?? [];
        const ax = (alt as { exclusive?: string[] }).exclusive ?? [];
        expect(hx, `${h?.id} excludes ${a}`).toContain(a);
        expect(ax, `${a} excludes ${h?.id}`).toContain(b.historical);
      }
    }
  });
});
