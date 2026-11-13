// ww210 W-FRA: France's money rows hold together. The credits come every six
// months, then every quarter; every line's owner, every earmark and every
// wing names a faction, community or person that exists; the prices that pay
// an earmark are their faction's; the pack has every earmark's name and the
// leaders' counter and threat lines.
import { GwPackSchema } from "@openfront/engine-api/ww1914/GwPack";
import { axesOf } from "@openfront/engine-api/ww1914/GwSociety";
import { gwContent } from "@openfront/engine-lib/ww1914/content/Content";
import { FRA_FACTIONS } from "@openfront/engine-lib/ww1914/content/house/fra";
import { FRA_MONEY } from "@openfront/engine-lib/ww1914/content/money/fra";
import { FRA_SOCIETY } from "@openfront/engine-lib/ww1914/content/society/fra";
import { readFileSync } from "fs";
import { describe, expect, test } from "vitest";

const pack = GwPackSchema.parse(
  JSON.parse(readFileSync("resources/ww1914/ko/FRA.house.json", "utf8")),
);
const factions = new Set(FRA_FACTIONS.map((f) => f.id));
const communities = new Set((FRA_SOCIETY.communities ?? []).map((c) => c.id));

describe("ww210 W-FRA money content", () => {
  test("the row: two chambers, six-month credits then quarters, owners that exist", () => {
    const [row] = FRA_MONEY.rows;
    expect(row.houses).toEqual(["chambre", "senat"]);
    expect(row.credits.map((c) => c.every)).toEqual([3, 6]);
    expect(row.credits[0].when).toBeDefined();
    expect(row.round).toBeUndefined();
    for (const [line, o] of Object.entries(row.owners ?? {})) {
      if (o.faction !== undefined) expect(factions, line).toContain(o.faction);
      if (o.community !== undefined)
        expect(communities, line).toContain(o.community);
    }
  });

  test("earmarks: their faction and community exist, the pack names them, prices pay their own", () => {
    const marks = new Map(FRA_MONEY.earmarks.map((m) => [m.id, m]));
    for (const m of FRA_MONEY.earmarks) {
      expect(m.tag).toBe("FRA");
      if (m.faction !== undefined) expect(factions, m.id).toContain(m.faction);
      if (m.community !== undefined)
        expect(communities, m.id).toContain(m.community);
      expect(pack.money?.mark?.[m.id]?.name, m.id).toBeTruthy();
    }
    for (const f of FRA_FACTIONS) {
      for (const w of f.wants ?? []) {
        if (w.earmark === undefined) continue;
        expect(marks.get(w.earmark)?.faction, `${f.id}.${w.id}`).toBe(f.id);
        const says = pack.scenes[`gw_lb_${f.id}`]?.nodes?.price?.says ?? {};
        expect(says[w.id], `${f.id}.${w.id}`).toBeTruthy();
      }
    }
  });

  test("wings: a real man, FRA's axes, and an out faction to split into", () => {
    const people = new Set(gwContent().people.map((p) => p.id));
    const wings = FRA_FACTIONS.filter((f) => f.wing !== undefined);
    expect(wings.map((f) => f.id).sort()).toEqual(["fra_radicals", "fra_sfio"]);
    for (const f of wings) {
      const w = f.wing!;
      expect(people, f.id).toContain(w.person);
      expect(Object.keys(w.ideals).sort()).toEqual([...axesOf("FRA")].sort());
      const into = FRA_FACTIONS.find((x) => x.id === w.into);
      expect(into?.start, f.id).toBe("out");
      expect(Object.keys(pack.factions?.[f.id]?.wing ?? {}).sort()).toEqual([
        "hello",
        "leave",
        "take",
      ]);
    }
  });

  test("every seated faction's leader answers counters and threats", () => {
    const keys = [
      "counter_more",
      "counter_refuse",
      "counter_take",
      "threat_condemn",
      "threat_dissolve",
      "threat_file",
      "threat_post",
      "threat_region",
    ];
    for (const f of FRA_FACTIONS) {
      if (Object.keys(f.seats).length === 0) continue;
      expect(
        Object.keys(pack.factions?.[f.id]?.says ?? {}).sort(),
        f.id,
      ).toEqual(keys);
    }
  });
});
