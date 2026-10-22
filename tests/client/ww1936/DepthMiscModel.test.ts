// World War 1936 P6 (plan Task 14): the congress bar, the balance-of-power
// bars, the region lines and the raid picker read the depth view.
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../src/client/Utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/client/Utils")>()),
  translateText: (key: string, params?: Record<string, string | number>) =>
    params
      ? `[${key}] ${Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join(",")}`
      : `[${key}]`,
}));

vi.mock("../../../src/client/hud/ww1936/FogModel", () => ({
  fogModelOf: () => ({
    fogOff: () => false,
    regionView: () => ({ buildings: "exact", label: (n: number) => String(n) }),
  }),
}));

import {
  DepthMiscModel,
  depthNoticeParams,
  packFirst,
} from "../../../src/client/hud/ww1936/DepthMiscModel";
import { today } from "../../../src/client/hud/ww1936/WorldWarModel";
import { WwDepthView } from "../../../src/client/view/WwDepthView";

function model(tag: string, setup: (d: WwDepthView) => void, scenario = {}) {
  const depth = new WwDepthView();
  setup(depth);
  const view = {
    wwDepth: () => depth,
    myPlayer: () => ({ smallID: () => 1, countryTag: () => tag }),
    worldWarScenario: () => ({
      landmarksOf: (r: number) => (r === 7 ? ["lm_eiffel"] : []),
      damOf: (r: number) => (r === 8 ? 0 : -1),
      coalOf: () => 0,
      uraniumOf: () => 0,
      hydroOf: () => 0,
      tagOfSmallId: () => undefined,
      ...scenario,
    }),
    ticks: () => 100_000,
    wwEconomy: () => null,
    wwPolitics: () => null,
    wwLand: () => null,
    wwNavy: () => null,
    worldWarData: () => null,
    config: () => ({ historicalAi: () => true }),
  };
  return new DepthMiscModel(view as never);
}

describe("DepthMiscModel", () => {
  it("the congress bar marks 50, 60 and 70", () => {
    const m = model("USA", (d) =>
      d.apply({ congressBp: 5_500, fx: [], news: [] }),
    );
    const bar = m.congressBar()!;
    expect(bar.pct).toBe(55);
    expect(bar.marks.map((x) => x.pct)).toEqual([50, 60, 70]);
    expect(bar.marks.map((x) => x.passed)).toEqual([true, false, false]);
    expect(model("GER", () => {}).congressBar()).toBeNull();
  });

  it("a BoP bar shows its band and spirit", () => {
    const m = model("CHN", (d) =>
      d.apply({ bop: [[0, 700]], fx: [], news: [] }),
    );
    const bar = m.bopBar("CHN")!;
    expect(bar.band).toBe(4);
    expect(bar.spirit).toBe("bop_chn_warlords");
    expect(bar.pos).toBeCloseTo(0.85);
    expect(m.bopBar("JPN")).toBeNull();
  });

  it("region lines show landmark, dam, flood and nuked days", () => {
    const m = model("FRA", () => {});
    const day = today(m.view);
    m.view.wwDepth()!.apply({
      world: {
        nuked: [[7, day + 40]],
        flooded: [[8, day + 12]],
        scorched: [],
        harbors: [],
        damLevel: [3],
      },
      fx: [],
      news: [],
    });
    const ids = (r: number) => m.regionLines(r).map((l) => l.id);
    expect(ids(7)).toEqual(expect.arrayContaining(["lm_eiffel", "nuked"]));
    expect(ids(8)).toEqual(expect.arrayContaining(["dam", "flooded"]));
    expect(m.regionLines(7).find((l) => l.id === "nuked")!.text).toContain(
      "days=40",
    );
  });

  it("the raid picker hides facilities below close intel", () => {
    const row = (civil: number) => [0, 0, 0, 0, civil, 0, 0, 0];
    const targets = (civil: number) =>
      model("GER", (d) =>
        d.apply({
          intel: [{ observer: 1, row: row(civil) }],
          fx: [],
          news: [],
        }),
      )
        .raidTargets("raid_para", 1)
        .map((t) => t.building);
    expect(targets(30)).not.toContain("facility_nuclear");
    expect(targets(30)).toContain("radar");
    expect(targets(60)).toContain("facility_nuclear");
  });

  it("pack focuses are found in columns 20 to 35", () => {
    expect(
      packFirst([
        { x: 3, y: 0 },
        { x: 22, y: 4 },
        { x: 20, y: 4 },
      ]),
    ).toBe(2);
    expect(packFirst([{ x: 3, y: 0 }])).toBe(-1);
  });

  it("notice params name content ids", () => {
    const p = depthNoticeParams("events_display.ww1936_project_done", {
      project: "sp_atomic",
    });
    expect(p.project).toBe("[ww1936.project.sp_atomic]");
    expect(
      depthNoticeParams("events_display.other", { project: "x" }).project,
    ).toBe("x");
  });
});
