import { ResolutionId } from "@openfront/engine-api/congress/CongressTypes";
import { LawId, LawOption } from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  ModifierFacts,
  resolutionBans,
  resolutionBuildCostPct,
  resolutionBuildTimePct,
  resolutionModifiers,
  resolutionNukeTimePct,
} from "@openfront/engine-lib/congress/ResolutionEffects";

const ME = 1;
const facts: ModifierFacts = {
  smallID: ME,
  government: "monarchy",
  laws: new Map<LawId, LawOption>([["doctrine", "B"]]),
};
const r = (
  resolution: ResolutionId,
  option: "A" | "B",
  targets: number[] = [],
  param: string | null = null,
) => ({ resolution, option, targets, param });

describe("resolution modifiers (spec §8)", () => {
  test.each([
    [
      "sanction A on me",
      r("sanction", "A", [ME]),
      [{ stat: "allGold", pct: -20 }],
    ],
    ["sanction A on another", r("sanction", "A", [2]), []],
    [
      "sanction B on me",
      r("sanction", "B", [ME]),
      [{ stat: "trade", pct: 30 }],
    ],
    [
      "war tax A",
      r("war_tax", "A"),
      [
        { stat: "allGold", pct: -30, when: "aggressing" },
        { stat: "troopUpkeep", pct: 50, when: "aggressing" },
      ],
    ],
    [
      "war tax B",
      r("war_tax", "B"),
      [{ stat: "allGold", pct: 20, when: "aggressing" }],
    ],
    [
      "arms treaty A",
      r("arms_treaty", "A"),
      [
        { stat: "maxTroops", pct: -15 },
        { stat: "goldIncome", pct: 15 },
      ],
    ],
    [
      "arms treaty B",
      r("arms_treaty", "B"),
      [
        { stat: "maxTroops", pct: 15 },
        { stat: "goldIncome", pct: -10 },
      ],
    ],
    [
      "military aid",
      r("arms_embargo", "B", [ME]),
      [{ stat: "siloSamCost", pct: -30 }],
    ],
    ["arms embargo A", r("arms_embargo", "A", [ME]), []],
    [
      "development race",
      r("non_proliferation", "B"),
      [{ stat: "nukeCost", pct: -25 }],
    ],
    [
      "hegemony check A",
      r("hegemony_check", "A", [ME]),
      [
        { stat: "science", pct: -20 },
        { stat: "political", pct: -20 },
      ],
    ],
    [
      "recognized leader",
      r("hegemony_check", "B", [ME]),
      [{ stat: "goldIncome", pct: 15 }],
    ],
    [
      "trade pact A trains",
      r("trade_pact", "A", [], "train"),
      [{ stat: "train", pct: 50 }],
    ],
    [
      "trade pact B ships",
      r("trade_pact", "B", [], "tradeShip"),
      [{ stat: "tradeShip", pct: -50 }],
    ],
    [
      "research fund A",
      r("research_fund", "A"),
      [
        { stat: "science", pct: 20 },
        { stat: "political", pct: -10 },
      ],
    ],
    [
      "research fund B",
      r("research_fund", "B"),
      [
        { stat: "political", pct: 20 },
        { stat: "science", pct: -10 },
      ],
    ],
    [
      "support my government",
      r("government_resolution", "A", [], "monarchy"),
      [{ stat: "political", pct: 25 }],
    ],
    [
      "condemn my government",
      r("government_resolution", "B", [], "monarchy"),
      [{ stat: "political", pct: -25 }],
    ],
    ["another government", r("government_resolution", "A", [], "republic"), []],
    [
      "recommend my law",
      r("law_review", "A", [], "doctrine:B"),
      [
        { stat: "attackSpeed", pct: 15 },
        { stat: "defenseLoss", pct: 5 },
      ],
    ],
    [
      "suspend my law",
      r("law_review", "B", [], "doctrine:B"),
      [
        { stat: "attackSpeed", pct: -30 },
        { stat: "defenseLoss", pct: -10 },
      ],
    ],
    ["a law I don't have", r("law_review", "B", [], "service:A"), []],
    [
      "hegemony survived",
      r("emergency", "B", [ME], "hegemony"),
      [{ stat: "goldIncome", pct: 10 }],
    ],
    ["a truce", r("truce", "A", [ME, 2]), []],
  ])("%s", (_, res, expected) => {
    expect(resolutionModifiers(res, facts)).toEqual(expected);
  });
});

describe("bans, costs and times (spec §8)", () => {
  test("a building ban names one structure for everyone", () => {
    const active = [r("building_pact", "B", [], "city")];
    expect(resolutionBans(active, ME, UnitType.City)).toBe(true);
    expect(resolutionBans(active, 2, UnitType.City)).toBe(true);
    expect(resolutionBans(active, ME, UnitType.Port)).toBe(false);
  });

  test("an arms embargo bans its target's strategic arms and silos only", () => {
    const active = [r("arms_embargo", "A", [ME])];
    for (const t of [
      UnitType.AtomBomb,
      UnitType.HydrogenBomb,
      UnitType.MIRV,
      UnitType.ConventionalMissile,
      UnitType.Satellite,
      UnitType.Bomber,
      UnitType.CoastalBarrage,
      UnitType.MissileSilo,
    ]) {
      expect(resolutionBans(active, ME, t), t).toBe(true);
    }
    expect(resolutionBans(active, ME, UnitType.SAMLauncher)).toBe(false);
    expect(resolutionBans(active, 2, UnitType.AtomBomb)).toBe(false);
  });

  test("non-proliferation bans the three nukes for everyone", () => {
    const active = [r("non_proliferation", "A")];
    expect(resolutionBans(active, 2, UnitType.MIRV)).toBe(true);
    expect(resolutionBans(active, 2, UnitType.ConventionalMissile)).toBe(false);
  });

  test("promotion: -40% cost and -50% time for the named structure", () => {
    const active = [r("building_pact", "A", [], "factory")];
    expect(resolutionBuildCostPct(active, UnitType.Factory)).toBe(-40);
    expect(resolutionBuildTimePct(active, UnitType.Factory)).toBe(-50);
    expect(resolutionBuildCostPct(active, UnitType.City)).toBe(0);
  });

  test("military aid and the development race halve nuke production, adding up", () => {
    expect(resolutionNukeTimePct([r("arms_embargo", "B", [ME])], ME)).toBe(-50);
    expect(resolutionNukeTimePct([r("arms_embargo", "B", [2])], ME)).toBe(0);
    expect(
      resolutionNukeTimePct(
        [r("arms_embargo", "B", [ME]), r("non_proliferation", "B")],
        ME,
      ),
    ).toBe(-100);
  });
});
