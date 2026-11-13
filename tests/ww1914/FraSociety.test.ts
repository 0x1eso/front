// ww208 W-FRA: France's society content holds together: every faction has
// its three Cornerstones on FRA's axes, every bill text moves an axis, the
// communities cover both sides of each axis, the trees' law nodes name
// exclusive laws of their own faction, the abilities name their faction.
import { axesOf } from "@openfront/engine-api/ww1914/GwSociety";
import { FRA_FACTIONS } from "@openfront/engine-lib/ww1914/content/house/fra";
import { FRA_POWERS } from "@openfront/engine-lib/ww1914/content/powers/fra";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { FRA_SOCIETY } from "@openfront/engine-lib/ww1914/content/society/fra";
import { FRA_UTOPIA } from "@openfront/engine-lib/ww1914/content/utopia/fra";
import { describe, expect, test } from "vitest";

const AXES = axesOf("FRA");

describe("ww208 W-FRA society content", () => {
  test("factions: ideals on FRA's axes, a tree or a template, abilities that exist", () => {
    const trees = new Set((FRA_UTOPIA.trees ?? []).map((t) => t.faction));
    for (const f of FRA_FACTIONS) {
      expect(Object.keys(f.ideals ?? {}).sort(), f.id).toEqual(
        [...AXES].sort(),
      );
      expect(trees.has(f.id) || f.template !== undefined, f.id).toBe(true);
      if (f.ability !== undefined) {
        const p = FRA_POWERS.find((r) => r.id === f.ability);
        expect(p?.ability?.faction, f.id).toBe(f.id);
      }
    }
  });

  test("every FRA bill text moves an axis; peace rows open in a peace chapter", () => {
    const fra = GW_LAWS.filter((l) => l.tag === "FRA");
    for (const l of fra) {
      for (const d of l.draft) {
        const keys = Object.keys(d.axes ?? {});
        expect(keys.length, `${l.id}/${d.id}`).toBeGreaterThan(0);
        for (const k of keys) expect(AXES, `${l.id}/${d.id}`).toContain(k);
      }
    }
    expect(fra.filter((l) => l.peace === true).length).toBeGreaterThanOrEqual(
      6,
    );
  });

  test("communities cover both sides of each axis; births come from them", () => {
    const rows = FRA_SOCIETY.communities ?? [];
    for (const a of AXES) {
      for (const side of [-1, 1]) {
        expect(
          rows.some((c) => c.ideal.axis === a && c.ideal.side === side),
          `${a} ${side}`,
        ).toBe(true);
      }
    }
    const ids = new Set(rows.map((c) => c.id));
    for (const b of FRA_SOCIETY.births ?? []) {
      expect(ids.has(b.from), b.faction).toBe(true);
      expect(FRA_FACTIONS.find((f) => f.id === b.faction)?.start).toBe("out");
    }
  });

  test("each tree's law node names an exclusive law of its own faction", () => {
    for (const t of FRA_UTOPIA.trees ?? []) {
      const node = (t.own ?? []).find((n) => n.kind === "law");
      expect(node, t.faction).toBeDefined();
      const law = GW_LAWS.find((l) => l.id === node!.law);
      expect(law?.exclusive, t.faction).toEqual({
        faction: t.faction,
        node: node!.id,
      });
    }
  });
});
