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
  isBopDecision,
  packFirst,
} from "../../../src/client/hud/ww1936/DepthMiscModel";
import { today } from "../../../src/client/hud/ww1936/WorldWarModel";
import { WwDepthView } from "../../../src/client/view/WwDepthView";
import { depthDetail } from "./DepthU4Fixture";

function model(
  tag: string,
  setup: (d: WwDepthView) => void,
  scenario = {},
  extra: Record<string, unknown> = {},
) {
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
    ...extra,
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

  it("balance-of-power decisions are K5's ids; only the band spirits carry bop_", () => {
    expect(isBopDecision("CHN", "chn_central_officers")).toBe(true);
    expect(isBopDecision("CHN", "chn_regional_appeasement")).toBe(true);
    expect(isBopDecision("JPN", "jpn_army_budget")).toBe(true);
    expect(isBopDecision("JPN", "jpn_navy_budget")).toBe(true);
    expect(isBopDecision("FRA", "fra_social_reform")).toBe(true);
    expect(isBopDecision("FRA", "fra_rearmament_act")).toBe(true);
    expect(isBopDecision("CHN", "bop_chn_warlords")).toBe(false);
    expect(isBopDecision("FRA", "jpn_army_budget")).toBe(false);
    expect(isBopDecision("USA", "usa_lobby_congress")).toBe(false);
  });

  it("faction goal slots: -1 is empty, a met goal frees its slot and leaves the options", () => {
    const politics = {
      factionIdx: () => 0,
      global: { factions: [{ idx: 0, leader: 1 }] },
    };
    // W3's row: [faction, slots, achieved]; fg_members (0) was met.
    const m = model(
      "DEU",
      (d) =>
        d.apply({ factionGoals: [[0, [-1, 4, -1], 1 << 0]], fx: [], news: [] }),
      {},
      { wwPolitics: () => politics },
    );
    const slots = m.goalSlots();
    expect(slots.map((s) => s.goal)).toEqual([null, "fg_industry", null]);
    expect(slots.map((s) => s.canPick)).toEqual([true, false, true]);
    expect(slots[0].options).not.toContain("fg_members");
    expect(slots[0].options).not.toContain("fg_industry");
    expect(slots[0].options).toContain("fg_research");
  });

  it("the continuous-focus chips follow W3's cfocusBlock: locked days, the running one", () => {
    const politics = { detail: () => ({ cards: [] }) };
    const band = (lockIn: number) => {
      const view = model("DEU", () => {}, {}, { wwPolitics: () => politics });
      const day = today(view.view as never);
      const d = new WwDepthView();
      d.apply({
        details: [
          depthDetail("DEU", {
            smallID: 1,
            mech: {
              ...depthDetail("DEU").mech,
              cfocus: 2,
              cfocusLock: day + lockIn,
            },
          }),
        ],
        fx: [],
        news: [],
      });
      return model(
        "DEU",
        () => {},
        {},
        {
          wwPolitics: () => politics,
          wwDepth: () => d,
        },
      ).cfocusBand()!;
    };
    // Long past 1939-01-01: open by date. Locked for 10 days: only the
    // running one (2) can be tapped (to clear it).
    const locked = band(10);
    expect(locked.open).toBe(true);
    expect(locked.lockLeft).toBe(10);
    expect(locked.chips.map((c) => c.disabled)).toEqual(
      locked.chips.map((_, n) => n !== 2),
    );
    const free = band(0);
    expect(free.lockLeft).toBe(0);
    expect(free.chips.every((c) => !c.disabled)).toBe(true);
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

  it("notice params: each id arg of the manifest is translated, other args pass", () => {
    const args: [string, string, string][] = [
      ["ww1936_mastery_level", "domain", "[ww1936.doctrine.tab_land]"],
      ["ww1936_mastery_level", "track", "[ww1936.track.armor]"],
      ["ww1936_mio_size", "mio", "[ww1936.mio_family.tank]"],
      ["ww1936_market_sale", "item", "[ww1936.equip.infantry]"],
      ["ww1936_licence_granted", "design", "[ww1936.base.light_1]"],
      ["ww1936_operation_done", "op", "[ww1936.op.coup]"],
      ["ww1936_project_done", "project", "[ww1936.project.sp_atomic]"],
      ["ww1936_faction_goal", "goal", "[ww1936.faction_goal.fg_members]"],
      ["ww1936_trait_unlocked", "trait", "[ww1936.general_trait.commando]"],
    ];
    const ids: Record<string, string> = {
      domain: "land",
      track: "armor",
      mio: "tank",
      item: "infantry",
      design: "light_1",
      op: "coup",
      project: "sp_atomic",
      goal: "fg_members",
      trait: "commando",
    };
    for (const [msg, k, want] of args) {
      expect(
        depthNoticeParams(`events_display.${msg}`, { [k]: ids[k] })[k],
      ).toBe(want);
    }
    // A text arg (already translated) and other messages pass unchanged.
    expect(
      depthNoticeParams("events_display.ww1936_design_saved", {
        name: "Tiger 2",
      }).name,
    ).toBe("Tiger 2");
    expect(
      depthNoticeParams("events_display.ww1936_licence_granted", {
        design: "Light Tank",
      }).design,
    ).toBe("Light Tank");
    expect(
      depthNoticeParams("events_display.other", { project: "x" }).project,
    ).toBe("x");
  });
});

import { TREATY_LIMITED_MODULES } from "@openfront/engine-lib/ww1936/DesignRules";
import { renderCongressBar } from "../../../src/client/hud/ww1936/WwCongressTab";

describe("U5 screens", () => {
  it("the congress label carries its percentage once", () => {
    const m = model("USA", (d) =>
      d.apply({ congressBp: 4_200, fx: [], news: [] }),
    );
    const tpl = JSON.stringify(
      renderCongressBar(m.congressBar()!) as unknown as object,
    );
    expect(tpl).toContain("ww1936.congress.support");
    expect(tpl).toContain("pct=42");
    expect(tpl).not.toContain('"42%"');
  });

  it("the treaty limits come from the engine-lib rule", () => {
    expect(TREATY_LIMITED_MODULES.always).toEqual(["shbb_hull"]);
    expect(TREATY_LIMITED_MODULES.untilEscalated).toEqual(["main_heavy"]);
  });
});
