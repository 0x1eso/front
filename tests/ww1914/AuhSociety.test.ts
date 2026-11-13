// ww208 W-AUH: Austria-Hungary's society content holds together: every bill
// text moves an axis, the factions have ideals, births and trees point at
// real rows, abilities and marks name AUH factions.
import { axesOf } from "@openfront/engine-api/ww1914/GwSociety";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { describe, expect, test } from "vitest";
import { AUH_MARKS } from "../../src/client/hud/ww1914/marks/auh";

const c = gwContent();
const factions = (c.factions ?? []).filter((f) => f.tag === "AUH");
const factionIds = new Set(factions.map((f) => f.id));
const laws = GW_LAWS.filter((l) => l.tag === "AUH");

describe("ww208 AUH society content", () => {
  test("every AUH bill text pushes an axis of AUH's", () => {
    const own = new Set(axesOf("AUH"));
    for (const l of laws) {
      for (const d of l.draft) {
        const axes = Object.keys(d.axes ?? {});
        expect(axes.length, `${l.id}.${d.id}`).toBeGreaterThan(0);
        for (const a of axes) expect(own.has(a as never), a).toBe(true);
      }
    }
    const peace = laws.filter((l) => l.peace === true).map((l) => l.chapter);
    expect(new Set(peace)).toEqual(
      new Set(["tax", "social", "land", "schools", "local"]),
    );
  });

  test("factions have ideals; births and communities line up", () => {
    for (const f of factions) expect(f.ideals, f.id).toBeDefined();
    const comms = (c.society?.communities ?? []).filter((x) => x.tag === "AUH");
    const ids = new Set(comms.map((x) => x.id));
    expect(ids.size).toBe(comms.length);
    for (const a of axesOf("AUH")) {
      for (const side of [-1, 1]) {
        expect(
          comms.some((x) => x.ideal.axis === a && x.ideal.side === side),
          `${a} ${side}`,
        ).toBe(true);
      }
    }
    for (const b of (c.society?.births ?? []).filter((x) => x.tag === "AUH")) {
      const row = factions.find((f) => f.id === b.faction);
      expect(row?.start, b.faction).toBe("out");
      expect(ids.has(b.from), b.from).toBe(true);
    }
  });

  test("trees' law nodes are their exclusive laws; abilities and marks name AUH factions", () => {
    const trees = (c.utopia?.trees ?? []).filter((t) =>
      factionIds.has(t.faction),
    );
    expect(trees.length).toBeGreaterThan(5);
    for (const t of trees) {
      for (const [node, bend] of Object.entries(t.bend ?? {})) {
        if (bend.law === undefined) continue;
        const law = laws.find((l) => l.id === bend.law);
        expect(law?.exclusive, bend.law).toEqual({
          faction: t.faction,
          node,
        });
      }
    }
    const powers = (c.powers ?? []).filter((p) => p.ability !== undefined);
    for (const f of factions.filter((x) => x.ability !== undefined)) {
      const p = powers.find((x) => x.id === f.ability);
      expect(p?.ability?.faction, f.id).toBe(f.id);
    }
    for (const m of AUH_MARKS)
      expect(factionIds.has(m.faction), m.faction).toBe(true);
    const chambers = (c.houses ?? []).find((h) => h.tag === "AUH")!.chambers;
    for (const ch of chambers.filter((x) => x.elect !== undefined)) {
      expect(laws.some((l) => l.id === ch.elect!.postpone)).toBe(true);
    }
  });
});
