import { IntentSchema } from "@openfront/engine-api/Schemas";
import { GOLD_PER_POINT, MILLI } from "@openfront/engine-lib/domestic/Balance";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { SetRecruitTargetExecution } from "@openfront/engine/domestic/SetRecruitTargetExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

/** An era 1 tech's cost (currency, academia), in milli-points. */
const ERA1 = TECHS.currency.cost * MILLI;

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

describe("ResearchExecution", () => {
  test("spends science and starts research", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(ERA1 + 50_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toEqual({
      tech: "currency",
      ticksLeft: 200,
      totalTicks: 200,
    });
    expect(d.scienceMilliAvailable()).toBe(50_000);
  });

  test("a shortfall needs payWithGold and enough gold", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(40_000, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    // The missing points at GOLD_PER_POINT each.
    const shortfall = BigInt(((ERA1 - 40_000) / MILLI) * GOLD_PER_POINT);
    player.addGold(shortfall - 1n);
    game.addExecution(new ResearchExecution(player, "currency", true));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    player.addGold(1n);
    game.addExecution(new ResearchExecution(player, "currency", true));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(player.gold()).toBe(0n);
    expect(d.scienceMilliAvailable()).toBe(0);
  });

  test("refuses era-locked techs and a second research", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(1_000_000, 0);
    game.addExecution(new ResearchExecution(player, "railroad", false));
    executeTicks(game, 1);
    expect(d.currentResearch()).toBeNull();

    game.addExecution(new ResearchExecution(player, "currency", false));
    game.addExecution(new ResearchExecution(player, "academia", false));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(d.scienceMilliAvailable()).toBe(1_000_000 - ERA1);
  });

  test("scientific method shortens research by 30%", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "scientific_method");
    player.domestic()!.addYield(ERA1, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(player.domestic()!.currentResearch()?.totalTicks).toBe(140);
  });

  test("SetRecruitTargetExecution sets the target", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new SetRecruitTargetExecution(player, 40));
    executeTicks(game, 1);
    expect(player.domestic()!.recruitTargetPct()).toBe(40);
  });

  test("research survives a snapshot and continues identically", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new DomesticExecution());
    player.domestic()!.addYield(ERA1, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    const restored = await expectSnapshotRoundTrip(game, "plains", 30);
    expect(restored.player(HUMAN.id).domestic()!.currentResearch()?.tech).toBe(
      "currency",
    );
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "research_tech",
        tech: "radar",
        payWithGold: true,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "research_tech", tech: "warp_drive" })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "set_recruit_target", percent: 5 })
        .success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({ type: "set_recruit_target", percent: 60 })
        .success,
    ).toBe(true);
  });
});
