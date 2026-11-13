// ww210 W-GBR: Britain's money rows, earmarks, purses and wings point at real
// rows and have their words; no law row takes a money bill's id.
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { GW_LAWS } from "@openfront/engine-lib/ww1914/content/scenes/laws";
import { moneyBillOf } from "@openfront/engine-lib/ww1914/MoneyRows";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const pack = JSON.parse(
  readFileSync("resources/ww1914/ko/GBR.house.json", "utf8"),
) as {
  factions: Record<
    string,
    { says?: Record<string, string>; wing?: Record<string, string> }
  >;
  people: Record<string, unknown>;
  money?: { mark?: Record<string, { name: string; note?: string }> };
  scenes: Record<
    string,
    { nodes?: Record<string, { says?: Record<string, string> }> }
  >;
};

describe("GBR money (ww210 W-GBR)", () => {
  const c = gwContent();
  const factions = (c.factions ?? []).filter((f) => f.tag === "GBR");
  const ids = new Set(factions.map((f) => f.id));
  const communities = new Set((c.society?.communities ?? []).map((x) => x.id));
  // Pack-only outsiders (`gbr_i_<name>`) have no row: the pack names them.
  const people = new Set([
    ...c.people.map((p) => p.id),
    ...Object.keys(pack.people),
  ]);
  const marks = (c.money?.earmarks ?? []).filter((e) => e.tag === "GBR");

  test("no law row is a money bill (the 1914 Budget is gbr_budget_1914)", () => {
    expect(GW_LAWS.filter((l) => moneyBillOf(l.id) !== null)).toEqual([]);
    expect(GW_LAWS.some((l) => l.id === "gbr_budget_1914")).toBe(true);
  });

  test("earmarks, wants and wings point at real rows and have words", () => {
    expect(marks.length).toBeGreaterThan(0);
    for (const e of marks) {
      if (e.faction !== undefined) expect(ids, e.id).toContain(e.faction);
      if (e.community !== undefined) {
        expect(communities, e.id).toContain(e.community);
      }
      expect(pack.money?.mark?.[e.id]?.name, e.id).toBeTruthy();
    }
    const markIds = new Set(marks.map((e) => e.id));
    for (const f of factions) {
      for (const w of f.wants ?? []) {
        if (w.earmark !== undefined) expect(markIds).toContain(w.earmark);
        const says = pack.scenes[`gw_lb_${f.id}`]?.nodes?.price?.says ?? {};
        expect(says[w.id], `${f.id}.${w.id}`).toBeTruthy();
      }
      if (f.wing !== undefined) {
        expect(people, f.id).toContain(f.wing.person);
        if (f.wing.into !== undefined) expect(ids).toContain(f.wing.into);
        if (f.wing.peels !== false) {
          for (const k of ["hello", "take", "leave"]) {
            expect(pack.factions[f.id].wing?.[k], `${f.id} ${k}`).toBeTruthy();
          }
        }
      }
      if ((f.wants ?? []).length > 0) {
        for (const k of ["counter_take", "counter_refuse", "counter_more"]) {
          expect(pack.factions[f.id].says?.[k], `${f.id} ${k}`).toBeTruthy();
        }
      }
    }
    const row = c.money!.rows.find((r) => r.tag === "GBR")!;
    for (const o of Object.values(row.owners ?? {})) {
      if (o?.faction !== undefined) expect(ids).toContain(o.faction);
      if (o?.community !== undefined)
        expect(communities).toContain(o.community);
    }
  });
});
