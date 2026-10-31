import {
  FRA_BRANCHES,
  FRA_FOCUSES,
} from "@openfront/engine-lib/ww1936/content/focus/fra";
import { CONTENT } from "@openfront/engine-lib/ww1936/content/registry";
import { describe, expect, it } from "vitest";

describe("France's focus tree (w6)", () => {
  it("has about a hundred focuses, all grouped, with symmetric forks", () => {
    expect(CONTENT.treeFocuses.FRA.length).toBeGreaterThanOrEqual(95);
    const byId = new Map(FRA_FOCUSES.map((f) => [f.id, f]));
    for (const f of FRA_FOCUSES) {
      expect(f.group, f.id).toBeTruthy();
      for (const x of f.exclusive ?? []) {
        expect(byId.get(x)?.exclusive ?? [], `${x} / ${f.id}`).toContain(f.id);
      }
    }
    for (const id of [
      "fra_armistice_path",
      "fra_redoubt_breton",
      "fra_north_africa_move",
    ]) {
      expect(byId.get(id)!.exclusive).toHaveLength(2);
    }
    expect(
      FRA_BRANCHES.filter((b) => b.political).length,
    ).toBeGreaterThanOrEqual(3);
  });
});
