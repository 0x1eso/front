import {
  LAW_IDS,
  TECH_IDS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { nationDomesticTick } from "@openfront/engine/execution/nation/NationDomesticBehavior";
import {
  BALANCED_RESEARCH_ORDER,
  buildDomesticPlan,
  NationDomesticPlan,
  nationDomesticPlan,
  PERSONALITIES,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantLaws } from "./util";

const NATION = new PlayerInfo("nation", PlayerType.Nation, null, "nation_id");

const TEST_PLAN: NationDomesticPlan = {
  personality: "merchant",
  techOrder: BALANCED_RESEARCH_ORDER,
  lawOrder: [
    { law: "nuclear", option: "A" },
    { law: "opinion", option: "A" },
    { law: "trade", option: "A" },
  ],
  governments: ["republic", "democracy"],
  instituteRatio: 0.35,
  officeRatio: 0.35,
};

async function nationGame(): Promise<{ game: Game; nation: Player }> {
  const game = await domesticGame({}, []);
  const nation = game.addPlayer(NATION);
  conquerSquare(game, nation, 0, 0, 40); // 16% of the land
  return { game, nation };
}

function check(game: Game, nation: Player, plan: NationDomesticPlan): void {
  nationDomesticTick(game, nation, plan);
  executeTicks(game, 1);
}

describe("personality plans", () => {
  test("a plan is fixed by the player id; all four personalities occur", () => {
    expect(nationDomesticPlan("abc")).toEqual(nationDomesticPlan("abc"));
    const seen = new Set<Personality>();
    for (let i = 0; i < 200; i++) {
      seen.add(nationDomesticPlan(`nation_${i}`).personality);
    }
    expect([...seen].sort()).toEqual([...PERSONALITIES].sort());
  });

  test.each(PERSONALITIES)(
    "%s: every tech once and every law category once",
    (personality) => {
      const plan = buildDomesticPlan(personality, new PseudoRandom(3));
      expect([...plan.techOrder].sort()).toEqual([...TECH_IDS].sort());
      expect(plan.lawOrder.map((c) => c.law).sort()).toEqual(
        [...LAW_IDS].sort(),
      );
    },
  );

  test("priorities come first, lightly shuffled (scholar)", () => {
    const plan = buildDomesticPlan("scholar", new PseudoRandom(3));
    expect([...plan.techOrder.slice(0, 4)].sort()).toEqual(
      ["academia", "computers", "scientific_method", "space_program"].sort(),
    );
    expect(
      plan.lawOrder
        .slice(0, 3)
        .map((c) => `${c.law}:${c.option}`)
        .sort(),
    ).toEqual(["learning:A", "opinion:B", "religion:B"]);
  });

  test("governments, building ratios and isolationism follow the table", () => {
    const plans = Object.fromEntries(
      PERSONALITIES.map((p) => [p, buildDomesticPlan(p, new PseudoRandom(5))]),
    ) as Record<Personality, NationDomesticPlan>;
    expect(plans.conqueror.governments).toEqual(["monarchy", "fascism"]);
    expect(plans.merchant.governments).toEqual(["republic", "democracy"]);
    expect(plans.scholar.governments).toEqual(["republic", "communism"]);
    expect(plans.zealot.governments).toEqual(["theocracy", "democracy"]);
    expect(plans.scholar.instituteRatio).toBeGreaterThan(
      plans.scholar.officeRatio,
    );
    expect(plans.zealot.officeRatio).toBeGreaterThan(
      plans.zealot.instituteRatio,
    );
    for (const p of PERSONALITIES) {
      const isolationist = plans[p].lawOrder.some(
        (c) => c.law === "diplomacy" && c.option === "B",
      );
      expect(isolationist, p).toBe(p === "zealot");
    }
  });
});

describe("nationDomesticTick with a plan", () => {
  test("proclaims the first law it can, skipping laws it can't yet", async () => {
    const { game, nation } = await nationGame();
    nation.domestic()!.addYield(0, 100_000);
    check(game, nation, TEST_PLAN);
    expect(nation.domestic()!.proclaimedLaws().get("opinion")).toBe("A");
    expect(nation.domestic()!.proclaimedLaws().has("nuclear")).toBe(false);
  });

  test("waits out the cooldown instead of skipping laws", async () => {
    const { game, nation } = await nationGame();
    const d = nation.domestic()!;
    d.addYield(0, 100_000);
    check(game, nation, TEST_PLAN);
    d.addYield(0, 1_000_000);
    check(game, nation, TEST_PLAN);
    expect(d.proclaimedLaws().has("trade")).toBe(false);
    executeTicks(game, LAW_COOLDOWN_TICKS);
    check(game, nation, TEST_PLAN);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
  });

  test("adopts its government before proclaiming a law", async () => {
    const { game, nation } = await nationGame();
    const d = nation.domestic()!;
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    check(game, nation, TEST_PLAN);
    expect(d.currentGovernment()).toBe("republic");
    expect(d.proclaimedLaws().size).toBe(0);
  });

  test("theocracy falls back to monarchy without state religion", async () => {
    const plan: NationDomesticPlan = {
      ...TEST_PLAN,
      governments: ["theocracy", "democracy"],
    };
    const first = await nationGame();
    first.nation.domestic()!.addYield(0, 300_000);
    first.nation.domestic()!.refreshGovernmentTier();
    check(first.game, first.nation, plan);
    expect(first.nation.domestic()!.currentGovernment()).toBe("monarchy");

    const second = await nationGame();
    second.nation.domestic()!.addYield(0, 300_000);
    second.nation.domestic()!.refreshGovernmentTier();
    grantLaws(second.nation, { religion: "A" });
    check(second.game, second.nation, plan);
    expect(second.nation.domestic()!.currentGovernment()).toBe("theocracy");
  });

  test.each(PERSONALITIES)(
    "%s researches, legislates and governs over five minutes",
    async (personality) => {
      const { game, nation } = await nationGame();
      const plan = buildDomesticPlan(personality, new PseudoRandom(7));
      game.addExecution(new DomesticExecution());
      for (let t = 0; t < 3000; t += 50) {
        nationDomesticTick(game, nation, plan);
        executeTicks(game, 50);
      }
      const d = nation.domestic()!;
      expect(d.researchedTechs().size).toBeGreaterThanOrEqual(2);
      expect(d.proclaimedLaws().size).toBeGreaterThanOrEqual(2);
      expect(d.governmentTier()).toBeGreaterThanOrEqual(1);
      expect(d.currentGovernment()).not.toBe("chiefdom");
    },
  );
});
