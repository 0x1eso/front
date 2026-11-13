// ww210 W-AUH: Austria-Hungary's money rows hang together: every earmark,
// owner, wing and fleet scene names something real, and has its words.
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { AUH_FACTIONS } from "@openfront/engine-lib/ww1914/content/house/auh";
import { AUH_MONEY } from "@openfront/engine-lib/ww1914/content/money/auh";
import { AUH_SOCIETY } from "@openfront/engine-lib/ww1914/content/society/auh";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const file = path.join(__dirname, "../../resources/ww1914/ko/AUH.house.json");
const pack = GwPackSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
const factions = new Map(AUH_FACTIONS.map((f) => [f.id, f]));
const communities = new Set((AUH_SOCIETY.communities ?? []).map((c) => c.id));

describe("ww210 AUH money content", () => {
  test("earmarks, owners and the fleet name real things, with words", () => {
    const marks = new Set(AUH_MONEY.earmarks.map((e) => e.id));
    for (const e of AUH_MONEY.earmarks) {
      expect(pack.money?.mark?.[e.id], e.id).toBeDefined();
      if (e.faction !== undefined) expect(factions.has(e.faction)).toBe(true);
      if (e.community !== undefined)
        expect(communities.has(e.community)).toBe(true);
    }
    for (const f of AUH_FACTIONS) {
      for (const w of f.wants ?? []) {
        if (w.earmark !== undefined)
          expect(marks.has(w.earmark), w.id).toBe(true);
      }
    }
    const row = AUH_MONEY.rows[0];
    for (const o of Object.values(row.owners ?? {})) {
      if (o.faction !== undefined) expect(factions.has(o.faction)).toBe(true);
      if (o.community !== undefined)
        expect(communities.has(o.community)).toBe(true);
    }
    const ids = new Set(gwContent().scenes.map((s) => s.id));
    expect(ids.has(row.fleet!.low!)).toBe(true);
    expect(ids.has(row.fleet!.high!)).toBe(true);
  });

  test("seated leaders answer counters and threats; wing men have names", () => {
    for (const f of AUH_FACTIONS) {
      const words = pack.factions?.[f.id];
      if (Object.keys(f.seats).length > 0) {
        for (const k of ["take", "refuse", "more"]) {
          expect(words?.says?.[`counter_${k}`], `${f.id} ${k}`).toBeDefined();
        }
        for (const k of ["file", "dissolve", "condemn", "post", "region"]) {
          expect(words?.says?.[`threat_${k}`], `${f.id} ${k}`).toBeDefined();
        }
      }
      if (f.wing !== undefined) {
        expect(pack.people[f.wing.person], f.wing.person).toBeDefined();
        expect(words?.wing?.defy, f.id).toBeDefined();
        if (f.wing.into !== undefined)
          expect(factions.has(f.wing.into)).toBe(true);
      }
    }
  });
});
