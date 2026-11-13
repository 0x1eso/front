// ww208 W-GBR: Britain's society rows hold together: ideals on GBR's axes,
// a push on every bill, communities and births that name real rows, trees
// whose law and ability nodes point back at their faction, the pack's words,
// and marks only for GBR's factions.
import { axesOf } from "@openfront/engine-api/ww1914/GwSociety";
import {
  GBR_BILLS,
  GBR_FACTIONS,
  GBR_HOUSE_LAWS,
} from "@openfront/engine-lib/ww1914/content/house/gbr";
import {
  GBR_AXIS_PUSHES,
  GBR_LAWS,
} from "@openfront/engine-lib/ww1914/content/laws/gbr";
import { GBR_POWERS } from "@openfront/engine-lib/ww1914/content/powers/gbr";
import { GBR_SOCIETY } from "@openfront/engine-lib/ww1914/content/society/gbr";
import { GBR_UTOPIA } from "@openfront/engine-lib/ww1914/content/utopia/gbr";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { GBR_MARKS } from "../../src/client/hud/ww1914/marks/gbr";

const pack = JSON.parse(
  readFileSync("resources/ww1914/ko/GBR.house.json", "utf8"),
) as {
  factions: Record<string, { short?: string }>;
  communities: Record<string, { name: string; note?: string }>;
  utopia: Record<string, { name: string; nodes?: Record<string, unknown> }>;
};
const AXES = axesOf("GBR");
const LAWS = [...GBR_LAWS, ...GBR_HOUSE_LAWS];
const faction = (id: string) => GBR_FACTIONS.find((f) => f.id === id);
const NODES = ["m1", "m2", "m3", "b1", "b2", "b3", "x1", "x2", "x3"];

describe("GBR society rows", () => {
  test("ideals sit on GBR's axes; every bill moves them; no stale push", () => {
    for (const f of GBR_FACTIONS) {
      expect(f.ideals, f.id).toBeDefined();
      for (const a of Object.keys(f.ideals!)) expect(AXES, f.id).toContain(a);
      expect(pack.factions[f.id]?.short, f.id).toMatch(/^[가-힣]{2,3}$/);
    }
    for (const r of LAWS) {
      expect(
        r.draft.some((d) => d.axes !== undefined),
        r.id,
      ).toBe(true);
      for (const d of r.draft) {
        for (const a of Object.keys(d.axes ?? {})) expect(AXES).toContain(a);
      }
    }
    for (const [law, texts] of Object.entries(GBR_AXIS_PUSHES)) {
      const row = LAWS.find((r) => r.id === law);
      expect(row, law).toBeDefined();
      for (const t of Object.keys(texts)) {
        expect(
          row!.draft.map((d) => d.id),
          law,
        ).toContain(t);
      }
    }
    // Peace bills open with no war, and the house has a line on each.
    const peace = GBR_LAWS.filter((r) => r.peace === true);
    expect(peace.length).toBeGreaterThanOrEqual(5);
    for (const r of LAWS) {
      expect(
        GBR_BILLS.some((b) => b.law === r.id),
        r.id,
      ).toBe(true);
    }
  });

  test("communities and births name real rows and have their words", () => {
    const ids = (GBR_SOCIETY.communities ?? []).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of GBR_SOCIETY.communities ?? []) {
      expect(AXES).toContain(c.ideal.axis);
      expect(pack.communities[c.id]?.name, c.id).toBeTruthy();
    }
    // Every axis has a community on each side.
    for (const a of AXES) {
      for (const side of [-1, 1]) {
        expect(
          (GBR_SOCIETY.communities ?? []).some(
            (c) => c.ideal.axis === a && c.ideal.side === side,
          ),
          `${a} ${side}`,
        ).toBe(true);
      }
    }
    for (const b of GBR_SOCIETY.births ?? []) {
      expect(faction(b.faction)?.start, b.faction).toBe("out");
      expect(ids).toContain(b.from);
      if (b.opposite !== undefined) expect(faction(b.opposite)).toBeDefined();
    }
  });

  test("trees: nodes bent or replaced, laws and abilities point back", () => {
    for (const t of GBR_UTOPIA.trees ?? []) {
      expect(faction(t.faction), t.faction).toBeDefined();
      const own = t.own ?? [];
      for (const k of Object.keys(t.bend ?? {})) expect(NODES).toContain(k);
      for (const o of own) expect(NODES).toContain(o.replaces);
      const named = [
        ...NODES.filter((n) => !own.some((o) => o.replaces === n)),
        ...own.map((o) => o.id),
      ];
      const words = pack.utopia[t.utopia];
      expect(words?.name, t.utopia).toBeTruthy();
      expect(Object.keys(words.nodes ?? {}).sort()).toEqual(named.sort());
      for (const [node, b] of Object.entries(t.bend ?? {})) {
        if (b.law !== undefined) {
          const row = LAWS.find((r) => r.id === b.law);
          expect(row?.exclusive, b.law).toEqual({ faction: t.faction, node });
        }
        if (b.power !== undefined) {
          const p = GBR_POWERS.find((r) => r.id === b.power);
          expect(p?.ability?.faction, b.power).toBe(t.faction);
          expect(faction(t.faction)?.ability).toBe(b.power);
        }
      }
    }
  });

  test("marks belong to GBR's factions and carry no script", () => {
    for (const m of GBR_MARKS) {
      expect(faction(m.faction), m.faction).toBeDefined();
      expect(m.svg).not.toMatch(/<script|<image|href|url\(/i);
    }
  });
});
