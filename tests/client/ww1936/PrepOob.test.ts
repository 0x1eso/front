import { WW_MAX_ARMY_DIVISIONS } from "@openfront/engine-api/ww1936/LandTypes";
import { START_OOB } from "@openfront/engine-lib/ww1936/LandStart";
import fs from "fs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

import {
  clearPrepTemplate,
  PREP_KEY,
  prepArmiesOf,
  prepPlanOf,
  setPrepArmies,
  setPrepTemplate,
} from "../../../src/client/components/ww1936/PrepPlan";
import {
  defaultArmies,
  fillRemaining,
  normalizeArmies,
  oobModel,
  withCount,
} from "../../../src/client/hud/ww1936/PrepOob";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe("the stored start army plan", () => {
  it("loads an old v1 file as template edits on the default armies", () => {
    localStorage.setItem(
      PREP_KEY,
      JSON.stringify({
        v: 1,
        byCountry: {
          DEU: [
            {
              key: "infantry",
              name: "Old",
              battalions: ["infantry", "infantry"],
              support: [],
            },
          ],
        },
      }),
    );
    expect(prepPlanOf("DEU").map((t) => t.name)).toEqual(["Old"]);
    expect(prepArmiesOf("DEU")).toBeNull();
    const m = oobModel("DEU", prepPlanOf("DEU"), prepArmiesOf("DEU"))!;
    expect(m.armies.map((a) => a.original)).toEqual([23, 18, 20]);
    expect(m.armies.map((a) => a.total)).toEqual([23, 18, 20]);
  });

  it("round-trips armies and new templates; bad data cannot break it", () => {
    setPrepTemplate("DEU", {
      key: "new:1",
      name: "Mine",
      battalions: ["infantry", "infantry"],
      support: [],
    });
    setPrepArmies("DEU", [
      [{ key: "new:1", count: 4 }],
      [],
      [{ key: "infantry", count: 2 }],
    ]);
    expect(prepArmiesOf("DEU")).toEqual([
      [{ key: "new:1", count: 4 }],
      [],
      [{ key: "infantry", count: 2 }],
    ]);
    // Removing the template takes it out of the armies.
    clearPrepTemplate("DEU", "new:1");
    expect(prepArmiesOf("DEU")![0]).toEqual([]);
    for (const bad of [
      "{",
      '{"v":2,"byCountry":{"DEU":{"templates":7,"armies":"x"}}}',
      '{"v":2,"byCountry":{"DEU":{"armies":[[{"key":"x","count":-4}],[{"key":"x","count":99}],5]}}}',
      '{"v":9}',
    ]) {
      localStorage.setItem(PREP_KEY, bad);
      expect(() => prepArmiesOf("DEU")).not.toThrow();
      const m = oobModel("DEU", prepPlanOf("DEU"), prepArmiesOf("DEU"));
      expect(m).not.toBeNull();
      expect(m!.armies).toHaveLength(START_OOB.DEU!.length);
    }
  });

  it("stores nothing when the plan equals the 1936 start", () => {
    expect(normalizeArmies("DEU", defaultArmies("DEU"))).toBeNull();
    expect(
      normalizeArmies("DEU", [[{ key: "infantry", count: 1 }], [], []]),
    ).not.toBeNull();
  });
});

describe("planning", () => {
  it("steppers move one count, clamp at 24, and keep an operation army staffed", () => {
    const m = oobModel("ITA", [], null)!;
    const army = m.armies.findIndex((a) => a.required);
    expect(m.armies.filter((a) => a.required)).toHaveLength(2);
    const key = "colonial";
    const k = m.templates.findIndex((t) => t.key === key);
    const next = withCount(m, army, key, m.armies[army].counts[k] + 1)!;
    expect(next[army].find((i) => i.key === key)!.count).toBe(
      m.armies[army].counts[k] + 1,
    );
    // 24 is the most an army holds.
    const full = withCount(m, 4, "binary", 99)!;
    expect(full[4].reduce((n, i) => n + i.count, 0)).toBe(
      WW_MAX_ARMY_DIVISIONS,
    );
    // An army with a running operation can't be emptied: not by the last
    // division, not by clearing every row.
    let cur = m;
    for (const t of m.templates) {
      const n = withCount(cur, 0, t.key, 0);
      if (n === null) break;
      cur = oobModel("ITA", [], n)!;
    }
    expect(cur.armies[0].total).toBeGreaterThan(0);
    expect(cur.problems).toEqual([]);
    const empty = defaultArmies("ITA");
    empty[0] = [];
    expect(oobModel("ITA", [], empty)!.problems).toHaveLength(1);
  });

  it("[fill with remaining men] adds what the budget and stock allow, no more", () => {
    // Everything out of army 0 except one division: the men are free.
    const base = oobModel("DEU", [], null)!;
    const armies = defaultArmies("DEU");
    armies[0] = [{ key: "infantry", count: 1 }];
    const m = oobModel("DEU", [], armies)!;
    const next = fillRemaining(m, 0, "infantry")!;
    expect(next).not.toBeNull();
    const after = oobModel("DEU", [], next)!;
    // All of it is fielded (nothing cut), within 24 and within the men.
    expect(after.armies[0].fieldedTotal).toBe(after.armies[0].total);
    expect(after.armies[0].total).toBeGreaterThan(1);
    expect(after.armies[0].total).toBeLessThanOrEqual(WW_MAX_ARMY_DIVISIONS);
    expect(after.result.menUsed).toBeLessThanOrEqual(after.result.menBudget);
    // One more division of it would not all be fielded.
    const k = after.templates.findIndex((t) => t.key === "infantry");
    if (after.armies[0].total < WW_MAX_ARMY_DIVISIONS) {
      const more = withCount(
        after,
        0,
        "infantry",
        after.armies[0].counts[k] + 1,
      )!;
      const o = oobModel("DEU", [], more)!;
      expect(
        o.result.cutAny || o.armies[0].fieldedTotal < o.armies[0].total,
      ).toBe(true);
    }
    expect(base.result.groupStock.length).toBe(after.result.groupStock.length);
  });
});

describe("the start regions' names", () => {
  it("cover every START_OOB region and match the shipped scenario", async () => {
    const { START_REGION_IDS, startRegionName } =
      await import("../../../src/client/hud/ww1936/StartRegionNames");
    const sc = JSON.parse(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../../resources/maps/world1936/scenario.json",
        ),
        "utf8",
      ),
    ) as { regions: { id: number; name: string; nameKo: string }[] };
    const by = new Map(sc.regions.map((r) => [r.id, r]));
    const used = new Set(
      Object.values(START_OOB).flatMap((o) => o.flatMap((a) => [...a.regions])),
    );
    for (const id of used) expect(START_REGION_IDS, `${id}`).toContain(id);
    for (const id of START_REGION_IDS) {
      expect(startRegionName(id, false)).toBe(by.get(id)!.name);
      expect(startRegionName(id, true)).toBe(by.get(id)!.nameKo);
    }
  });
});

describe("the special battalion cap in the lobby plan", () => {
  it("every major's default plan is within it; an over-cap plan says why", () => {
    for (const tag of Object.keys(START_OOB) as (keyof typeof START_OOB)[]) {
      const m = oobModel(tag, [], null)!;
      expect(m.result.specialCut, tag).toBe(false);
      expect(m.problems, tag).toEqual([]);
    }
    const base = oobModel("SUN", [], null)!;
    const k = base.templates.findIndex((t) => t.special > 0);
    const over = base.armies.map(() => [
      { key: base.templates[k].key, count: WW_MAX_ARMY_DIVISIONS },
    ]);
    const m = oobModel("SUN", [], over)!;
    expect(m.result.specialCut).toBe(true);
    expect(m.problems[0]).toContain("ww1936.prep.oob_special_cap");
  });
});
