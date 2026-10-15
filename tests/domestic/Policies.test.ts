import {
  Condition,
  GOVERNMENT_IDS,
  LAW_IDS,
  LawId,
  LawOption,
  TechId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  GOVERNMENTS,
  GOVERNMENTS_BY_TIER,
  governmentBlock,
  governmentTier,
} from "@openfront/engine-lib/domestic/Governments";
import {
  LAWS,
  lawBaseCost,
  lawBlock,
  lawCost,
  lawMapOf,
} from "@openfront/engine-lib/domestic/Laws";
import { ModifierTotals } from "@openfront/engine-lib/domestic/Modifiers";
import {
  policyFlags,
  policyModifiers,
} from "@openfront/engine-lib/domestic/Policies";

function lawsOf(
  ...entries: [LawId, LawOption][]
): ReadonlyMap<LawId, LawOption> {
  return new Map(entries);
}

function when(...conditions: Condition[]): ReadonlySet<Condition> {
  return new Set(conditions);
}

const NO_LAWS = lawsOf();
const NO_TECHS: ReadonlySet<TechId> = new Set();

describe("law data", () => {
  test("every law id has a definition with a matching id", () => {
    expect(Object.keys(LAWS).sort()).toEqual([...LAW_IDS].sort());
    for (const id of LAW_IDS) {
      expect(LAWS[id].id).toBe(id);
    }
  });

  test("only the nuclear law needs a tech: the Manhattan Project", () => {
    expect(LAW_IDS.filter((id) => LAWS[id].requires !== null)).toEqual([
      "nuclear",
    ]);
    expect(LAWS.nuclear.requires).toBe("manhattan_project");
  });

  test("cost is round(100 × 1.5^k)", () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(lawBaseCost)).toEqual([
      100, 150, 225, 338, 506, 759, 1139,
    ]);
  });

  test("lawCost applies the lawCost percent and rounds half up", () => {
    expect(lawCost(0, 0)).toBe(100);
    expect(lawCost(0, -15)).toBe(85);
    expect(lawCost(1, -15)).toBe(128);
    expect(lawCost(2, -15)).toBe(191);
  });

  test("lawBlock: proclaimed, then a missing tech, then the cooldown", () => {
    expect(lawBlock("trade", "A", NO_TECHS, 0, 0)).toBe("proclaimed");
    expect(lawBlock("nuclear", undefined, NO_TECHS, 0, 0)).toBe("requires");
    expect(
      lawBlock(
        "nuclear",
        undefined,
        new Set<TechId>(["manhattan_project"]),
        0,
        0,
      ),
    ).toBeNull();
    expect(lawBlock("trade", undefined, NO_TECHS, 450, 449)).toBe("cooldown");
    expect(lawBlock("trade", undefined, NO_TECHS, 450, 450)).toBeNull();
  });

  test("lawMapOf keeps LAW_IDS order", () => {
    expect([...lawMapOf({ religion: "B", trade: "A" })]).toEqual([
      ["trade", "A"],
      ["religion", "B"],
    ]);
  });
});

describe("government data", () => {
  test("chiefdom at tier 0, three governments at tiers 1 and 2", () => {
    expect(Object.keys(GOVERNMENTS).sort()).toEqual([...GOVERNMENT_IDS].sort());
    expect(GOVERNMENTS_BY_TIER).toEqual([
      ["chiefdom"],
      ["monarchy", "republic", "theocracy"],
      ["democracy", "fascism", "communism"],
    ]);
    GOVERNMENTS_BY_TIER.forEach((ids, tier) => {
      for (const id of ids) {
        expect(GOVERNMENTS[id].tier).toBe(tier);
      }
    });
  });

  test("tiers start at 300 / 1,500 / 3,500 cumulative political power", () => {
    expect(governmentTier(299_999)).toBe(0);
    expect(governmentTier(300_000)).toBe(1);
    expect(governmentTier(1_499_999)).toBe(1);
    expect(governmentTier(1_500_000)).toBe(2);
    expect(governmentTier(3_499_999)).toBe(2);
    expect(governmentTier(3_500_000)).toBe(3);
  });

  test("a tier's governments open once it is reached", () => {
    expect(governmentBlock(0, "chiefdom", NO_LAWS, "monarchy")).toBe(
      "tierNotReached",
    );
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "monarchy")).toBeNull();
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "democracy")).toBe(
      "tierNotReached",
    );
  });

  test("a chosen government is locked until the next tier", () => {
    expect(governmentBlock(1, "monarchy", NO_LAWS, "republic")).toBe("chosen");
    expect(governmentBlock(1, "monarchy", NO_LAWS, "monarchy")).toBe("chosen");
    expect(governmentBlock(2, "monarchy", NO_LAWS, "democracy")).toBeNull();
  });

  test("skipped tier-1 governments stay closed; tier 3 still offers tier 2", () => {
    expect(governmentBlock(2, "chiefdom", NO_LAWS, "republic")).toBe(
      "tierPassed",
    );
    expect(governmentBlock(3, "monarchy", NO_LAWS, "fascism")).toBeNull();
    expect(governmentBlock(3, "fascism", NO_LAWS, "democracy")).toBe("chosen");
    expect(governmentBlock(3, "fascism", NO_LAWS, "chiefdom")).toBe(
      "tierPassed",
    );
  });

  test("theocracy needs state religion", () => {
    expect(governmentBlock(1, "chiefdom", NO_LAWS, "theocracy")).toBe(
      "requires",
    );
    expect(
      governmentBlock(1, "chiefdom", lawsOf(["religion", "B"]), "theocracy"),
    ).toBe("requires");
    expect(
      governmentBlock(1, "chiefdom", lawsOf(["religion", "A"]), "theocracy"),
    ).toBeNull();
  });
});

describe("policy modifiers and flags", () => {
  test("laws and the government add up per stat", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["trade", "A"], ["service", "B"]), "republic"),
    );
    expect(totals.pct("trade")).toBe(65);
    expect(totals.pct("attackLoss")).toBe(-15);
    expect(totals.pct("cityBuildTime")).toBe(-50);
  });

  test("democracy: peace dividend and war weariness", () => {
    const totals = new ModifierTotals(policyModifiers(NO_LAWS, "democracy"));
    expect(totals.pct("political")).toBe(0);
    expect(totals.pct("political", when("notAttacking"))).toBe(30);
    expect(totals.pct("political", when("attacking"))).toBe(-50);
    expect(totals.pct("goldIncome")).toBe(30);
  });

  test("fascism: war economy", () => {
    const totals = new ModifierTotals(policyModifiers(NO_LAWS, "fascism"));
    expect(totals.pct("goldIncome", when("attacking"))).toBe(30);
    expect(totals.pct("goldIncome", when("notAttacking"))).toBe(-10);
  });

  test("total mobilization only while troops are at most half", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["mobilization", "A"]), "chiefdom"),
    );
    expect(totals.pct("troopRegen")).toBe(0);
    expect(totals.pct("troopRegen", when("troopsAtMostHalf"))).toBe(100);
  });

  test("special effects are flags", () => {
    expect([...policyFlags(lawsOf(["diplomacy", "B"]), "chiefdom")]).toEqual([
      "noForeignTrade",
    ]);
    expect([...policyFlags(lawsOf(["learning", "A"]), "communism")]).toEqual([
      "researchSubsidy",
      "noProductionUpkeep",
    ]);
    expect(policyFlags(NO_LAWS, "monarchy").has("feudal")).toBe(true);
    expect(policyFlags(NO_LAWS, "theocracy").has("tithe")).toBe(true);
  });

  test("stacked cuts are capped at -60%", () => {
    const totals = new ModifierTotals(
      policyModifiers(lawsOf(["construction", "B"]), "communism"),
    );
    expect(totals.pct("buildTime")).toBe(-60);
  });
});
