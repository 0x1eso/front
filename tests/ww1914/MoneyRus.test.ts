// ww210 W-RUS: Russia's money rows hold together. The credits come by
// supreme command (Fundamental Laws Art. 117), a lost budget runs on (Art.
// 116), Art. 87 is the way round; every owner, earmark, wing and want names
// a faction, community, person or scene that exists, and each has its words.
import { GW_CONTENT } from "@openfront/engine-lib/ww1914/content/Content";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const pack = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "../../resources/ww1914/ko/RUS.house.json"),
    "utf8",
  ),
);

describe("ww210 W-RUS money rows", () => {
  const money = GW_CONTENT.money!;
  const row = money.rows.find((r) => r.tag === "RUS")!;
  const factions = new Map((GW_CONTENT.factions ?? []).map((f) => [f.id, f]));
  const communities = new Set(
    (GW_CONTENT.society?.communities ?? []).map((c) => c.id),
  );
  const people = new Set(GW_CONTENT.people.map((p) => p.id));
  const scenes = new Set(GW_CONTENT.scenes.map((s) => s.id));
  const marks = money.earmarks.filter((m) => m.tag === "RUS");

  test("the money row: command credits, last year's budget runs on, Art. 87", () => {
    expect(row.houses).toEqual(["duma", "council"]);
    expect(row.credits.every((c) => c.by === "command")).toBe(true);
    expect(row.fail).toBe("runs_on");
    expect(row.round).toEqual({ around: "art87" });
    for (const o of Object.values(row.owners ?? {})) {
      if (o?.faction !== undefined) expect(factions.has(o.faction)).toBe(true);
      if (o?.community !== undefined) {
        expect(communities.has(o.community)).toBe(true);
      }
    }
    expect(scenes.has(row.fleet!.low!)).toBe(true);
    expect(scenes.has(row.fleet!.high!)).toBe(true);
  });

  test("earmarks belong to real factions and communities and have words", () => {
    expect(marks.length).toBeGreaterThan(0);
    for (const m of marks) {
      if (m.faction !== undefined) expect(factions.has(m.faction)).toBe(true);
      if (m.community !== undefined) {
        expect(communities.has(m.community)).toBe(true);
      }
      expect(pack.money.mark[m.id].name, m.id).toBeTruthy();
    }
  });

  test("purses, wings and the new wants hold together", () => {
    const ids = new Set(marks.map((m) => m.id));
    const rus = [...factions.values()].filter((f) => f.tag === "RUS");
    for (const f of rus) {
      for (const w of f.wants ?? []) {
        if (w.earmark !== undefined)
          expect(ids.has(w.earmark), w.id).toBe(true);
      }
      if (f.wing !== undefined) {
        // A person row, or a pack-only outsider (`rus_i_<name>`).
        const known =
          people.has(f.wing.person) || pack.people[f.wing.person] !== undefined;
        expect(known, f.id).toBe(true);
        if (f.wing.into !== undefined) {
          expect(factions.has(f.wing.into)).toBe(true);
        }
        for (const k of ["hello", "take", "leave"]) {
          expect(pack.factions[f.id].wing[k], `${f.id} ${k}`).toBeTruthy();
        }
      }
    }
    // The left votes no on the Tsar's money; the Rights vote the credits.
    expect(factions.get("rus_bolsh")!.purse).toEqual([{ side: -1 }]);
    expect(factions.get("rus_sd")!.purse![0].side).toBe(-1);
    expect(factions.get("rus_rights")!.purse![0]).toMatchObject({
      bill: "credits",
      side: 1,
    });
    expect(rus.filter((f) => f.wing !== undefined).map((f) => f.id)).toEqual([
      "rus_rights",
      "rus_octob",
      "rus_kadets",
    ]);
  });
});
