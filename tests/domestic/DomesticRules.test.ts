import {
  DomesticView,
  StatKey,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  isLockedByTech,
  requiredTech,
} from "@openfront/engine-lib/domestic/Locks";
import {
  capCombinedPct,
  capPct,
  ModifierTotals,
  techModifiers,
} from "@openfront/engine-lib/domestic/Modifiers";
import {
  researchBlock,
  researchTicks,
  shortfallGold,
} from "@openfront/engine-lib/domestic/Research";

function viewWith(techs: TechId[]): DomesticView {
  const set = new Set(techs);
  const totals = new ModifierTotals(techModifiers(techs));
  return {
    pct: (stat: StatKey) => totals.pct(stat),
    hasTech: (tech: TechId) => set.has(tech),
    recruitTargetPct: () => 100,
  };
}

describe("ModifierTotals", () => {
  test("sums modifiers of the same stat", () => {
    const t = new ModifierTotals([
      { stat: "science", pct: 15 },
      { stat: "science", pct: 30 },
    ]);
    expect(t.pct("science")).toBe(45);
    expect(t.pct("political")).toBe(0);
  });

  test("conditional modifiers apply only while their condition is active", () => {
    const t = new ModifierTotals([
      { stat: "political", pct: 30, when: "notAttacking" },
    ]);
    expect(t.pct("political")).toBe(0);
    expect(t.pct("political", new Set(["notAttacking"] as const))).toBe(30);
  });

  test("caps: combat losses -50, other reductions -60, increases +200", () => {
    expect(capPct("defenseLoss", -70)).toBe(-50);
    expect(capPct("buildCost", -90)).toBe(-60);
    expect(capPct("science", 500)).toBe(200);
    expect(capCombinedPct(-85)).toBe(-60);
    expect(capCombinedPct(250)).toBe(200);
  });

  test("tech modifiers come from the tech table", () => {
    const t = new ModifierTotals(
      techModifiers(["scientific_method", "computers"]),
    );
    expect(t.pct("science")).toBe(45);
    expect(t.pct("researchTime")).toBe(-30);
  });
});

describe("researchBlock", () => {
  test("era 1 is open from the start", () => {
    expect(researchBlock(new Set(), false, "currency")).toBeNull();
  });

  test("era 2 needs two era-1 techs", () => {
    expect(researchBlock(new Set(["currency"]), false, "railroad")).toBe("era");
    expect(
      researchBlock(new Set(["currency", "academia"]), false, "railroad"),
    ).toBeNull();
  });

  test("explicit prerequisites", () => {
    const done = new Set<TechId>([
      "currency",
      "academia",
      "railroad",
      "banking",
    ]);
    expect(researchBlock(done, false, "manhattan_project")).toBe("prereq");
    done.add("rocketry");
    expect(researchBlock(done, false, "manhattan_project")).toBeNull();
  });

  test("already researched comes before busy", () => {
    expect(researchBlock(new Set(), true, "currency")).toBe("busy");
    expect(researchBlock(new Set(["currency"]), true, "currency")).toBe(
      "researched",
    );
  });
});

describe("research helpers", () => {
  test("researchTicks applies researchTime and never goes below one second", () => {
    expect(researchTicks("currency", 0)).toBe(200);
    expect(researchTicks("currency", -30)).toBe(140);
    expect(researchTicks("currency", -100)).toBe(10);
  });

  test("shortfallGold rounds missing points up and applies goldPaymentCost", () => {
    expect(shortfallGold(0, 0)).toBe(0n);
    expect(shortfallGold(1, 0)).toBe(1000n);
    expect(shortfallGold(2500, -50)).toBe(1500n);
  });
});

describe("locks", () => {
  test("required techs", () => {
    expect(requiredTech(UnitType.AtomBomb)).toBe("manhattan_project");
    expect(requiredTech(UnitType.City)).toBeNull();
  });

  test("no domestic view means nothing is locked", () => {
    expect(isLockedByTech(null, UnitType.AtomBomb)).toBe(false);
  });

  test("locked until researched", () => {
    expect(isLockedByTech(viewWith([]), UnitType.Factory)).toBe(true);
    expect(isLockedByTech(viewWith(["railroad"]), UnitType.Factory)).toBe(
      false,
    );
    expect(isLockedByTech(viewWith([]), UnitType.City)).toBe(false);
  });
});
