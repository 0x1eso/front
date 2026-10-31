// The expanded British focus tree: about 100 focuses, grouped, with its
// big either/or forks exclusive both ways and registered as branch points.
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { expect, test } from "vitest";

test("the GBR focus tree is grouped and its forks are exclusive", () => {
  const tree = CONTENT.focuses.filter((f) => f.tree === "GBR");
  expect(tree.length).toBe(98);
  const byId = new Map(tree.map((f) => [f.id, f]));
  const fresh = tree.filter((f) => f.group !== undefined);
  expect(fresh.length).toBe(50);
  for (const f of tree) {
    for (const x of f.exclusive ?? []) {
      expect(byId.get(x)?.exclusive ?? [], `${f.id} / ${x}`).toContain(f.id);
    }
  }
  const forks = CONTENT.branchPoints.GBR ?? [];
  expect(forks.map((b) => b.id)).toContain("gbr_wartime_leader");
  expect(forks.filter((b) => b.political).length).toBeGreaterThanOrEqual(2);
});
