import {
  Condition,
  CONDITIONS,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  activeConditions,
  processDomesticSecond,
} from "@openfront/engine/domestic/DomesticEconomy";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  HUMAN,
} from "./util";

const OTHER = new PlayerInfo("other", PlayerType.Human, null, "other_id");

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10); // 1% of the land
  return { game, player };
}

/** A at (0,0) 10x10 next to B at (10,0) 20x20, so A can attack B. */
async function neighbours(): Promise<{ game: Game; a: Player; b: Player }> {
  const game = await domesticGame({}, [HUMAN, OTHER]);
  const a = game.player(HUMAN.id);
  const b = game.player(OTHER.id);
  conquerSquare(game, a, 0, 0, 10);
  conquerSquare(game, b, 10, 0, 20);
  a.setTroops(50_000);
  return { game, a, b };
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("conditions", () => {
  test("not attacking, and troops at most half of max", async () => {
    const { game, player } = await readyPlayer();
    const max = game.config().maxTroops(player);
    player.setTroops(Math.floor(max / 2));
    expect([...activeConditions(player, max)]).toEqual([
      "notAttacking",
      "troopsAtMostHalf",
    ]);
    player.setTroops(max);
    expect([...activeConditions(player, max)]).toEqual(["notAttacking"]);
  });

  test("attacking another nation counts; unclaimed land and retreats don't", async () => {
    const { game, a, b } = await neighbours();
    const max = game.config().maxTroops(a);

    game.addExecution(
      new AttackExecution(1000, a, game.terraNullius().id(), null),
    );
    executeTicks(game, 1);
    expect(a.outgoingAttacks()).toHaveLength(1);
    expect(activeConditions(a, max).has("notAttacking")).toBe(true);

    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 1);
    expect(activeConditions(a, max).has("attacking")).toBe(true);

    for (const attack of a.outgoingAttacks()) attack.orderRetreat();
    expect(activeConditions(a, max).has("attacking")).toBe(false);
  });

  test("democracy: +30% political power in peace, -50% while attacking", async () => {
    const { game, a, b } = await neighbours();
    grantGovernment(a, "democracy");
    second(game, a);
    expect(a.domestic()!.pct("political")).toBe(30);
    game.addExecution(new AttackExecution(1000, a, b.id(), null));
    executeTicks(game, 1);
    second(game, a);
    expect(a.domestic()!.pct("political")).toBe(-50);
    expect(a.domestic()!.toData().conditions).toContain("attacking");
  });

  test("the condition set is built in the CONDITIONS order", async () => {
    const { game, a, b } = await neighbours();
    a.setTroops(1000);
    game.addExecution(new AttackExecution(10, a, b.id(), null));
    executeTicks(game, 1);
    const max = game.config().maxTroops(a);
    const order = [...activeConditions(a, max)];
    expect(order).toEqual(CONDITIONS.filter((c) => order.includes(c)));
    expect(order).toEqual(["attacking", "troopsAtMostHalf"]);
    second(game, a);
    expect(a.domestic()!.toData().conditions).toEqual(order);
  });

  test("conditions flow into gold income (fascism's war economy)", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "fascism");
    const d = player.domestic()!;
    d.setConditions(new Set<Condition>(["attacking"]));
    expect(game.config().goldAdditionRate(player)).toBe(130n);
    d.setConditions(new Set<Condition>(["notAttacking"]));
    expect(game.config().goldAdditionRate(player)).toBe(90n);
  });

  test("total mobilization doubles troop growth at or below half", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    const base = game.config().troopIncreaseRate(player);
    grantLaws(player, { mobilization: "A" });
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base, 6);
    player
      .domestic()!
      .setConditions(new Set<Condition>(["notAttacking", "troopsAtMostHalf"]));
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base * 2, 6);
  });
});

// readyPlayer holds 1% of the land, so each second yields the base 1 plus
// 1.5 × sqrt(1) = 2.5 science and political power before modifiers.
describe("special effects", () => {
  test("research subsidy turns 300 gold into 0.5 science a second", async () => {
    const { game, player } = await readyPlayer();
    grantLaws(player, { learning: "A" });
    player.addGold(1000n);
    second(game, player);
    expect(player.gold()).toBe(700n);
    // (2.5 + 0.5) × 1000
    expect(player.domestic()!.scienceMilliAvailable()).toBe(3000);
  });

  test("research subsidy needs the full 300 gold", async () => {
    const { game, player } = await readyPlayer();
    grantLaws(player, { learning: "A" });
    player.addGold(299n);
    second(game, player);
    expect(player.gold()).toBe(299n);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(2500);
  });

  test("feudalism: +0.2 political power per city level (monarchy)", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.City, game.ref(5, 5), {});
    grantGovernment(player, "monarchy");
    second(game, player);
    // (2.5 + 1 city level × 0.2) × 1000
    expect(player.domestic()!.politicalMilliAvailable()).toBe(2700);
    // Monarchy's science -15%: round(2.5 × 0.85 × 1000)
    expect(player.domestic()!.scienceMilliAvailable()).toBe(2125);
  });

  test("tithe: 100 × sqrt(land share %) gold a second (theocracy)", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "theocracy");
    second(game, player);
    expect(player.gold()).toBe(100n);
    // Theocracy's political +30%: 2.5 × 1.3 × 1000
    expect(player.domestic()!.politicalMilliAvailable()).toBe(3250);
  });

  test("communism runs institutes without upkeep", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    expect(player.gold()).toBe(0n);
    grantGovernment(player, "communism");
    second(game, player);
    // Five-year plan: (2.5 + 1 institute level × 1.5) × 1000
    expect(player.domestic()!.scienceMilliAvailable()).toBe(4000);
    expect(player.gold()).toBe(0n);
  });
});

describe("government tiers", () => {
  test("reaching a tier is announced once", async () => {
    const { game, player } = await readyPlayer();
    const spy = vi.spyOn(game, "displayMessage");
    const d = player.domestic()!;
    // One second adds 2,500 milli-points: exactly the 800-point threshold.
    d.addYield(0, 797_500);
    second(game, player);
    expect(d.governmentTier()).toBe(1);
    expect(spy).toHaveBeenCalledWith(
      "events_display.government_tier_reached",
      MessageType.GOVERNMENT_TIER_REACHED,
      player.id(),
      undefined,
      { tier: 1 },
    );
    second(game, player);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
