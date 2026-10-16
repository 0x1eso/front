import { IntentSchema } from "@openfront/engine-api/Schemas";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { QueueResearchExecution } from "@openfront/engine/domestic/QueueResearchExecution";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, HUMAN } from "./util";

const ERA1 = TECHS.currency.cost * MILLI;

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  game.addExecution(new DomesticExecution());
  return { game, player };
}

function queue(game: Game, player: Player, tech: "currency" | null): void {
  game.addExecution(new QueueResearchExecution(player, tech));
  executeTicks(game, 1);
}

describe("QueueResearchExecution", () => {
  test("sets and clears the slot", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    queue(game, player, "currency");
    expect(d.queuedTech()).toBe("currency");
    expect(d.toData().queuedTech).toBe("currency");
    queue(game, player, null);
    expect(d.queuedTech()).toBeNull();
    expect(d.toData().queuedTech).toBeUndefined();
  });

  test("ignored for the tech being researched or already done", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.beginResearch("currency", 50);
    queue(game, player, "currency");
    expect(d.queuedTech()).toBeNull();
    d.beginResearch("currency", 0);
    d.advanceResearch(10);
    queue(game, player, "currency");
    expect(d.queuedTech()).toBeNull();
  });

  test("starts by itself once science covers it, never paying gold", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    player.addGold(1_000_000n);
    d.beginResearch("academia", 10);
    queue(game, player, "currency");
    executeTicks(game, 30);
    // Academia ended; science is short, gold stays untouched.
    expect(d.hasTech("academia")).toBe(true);
    expect(d.currentResearch()).toBeNull();
    expect(d.queuedTech()).toBe("currency");
    expect(player.gold()).toBe(1_000_000n);

    d.addYield(ERA1, 0);
    executeTicks(game, 10);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(d.queuedTech()).toBeNull();
    expect(d.currentResearch()?.totalTicks).toBe(200);
  });

  test("a direct research of the queued tech clears the slot", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    queue(game, player, "currency");
    d.addYield(ERA1, 0);
    game.addExecution(new ResearchExecution(player, "currency", false));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("currency");
    expect(d.queuedTech()).toBeNull();
  });

  test("researching another tech directly keeps the slot", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    queue(game, player, "currency");
    d.addYield(ERA1, 0);
    game.addExecution(new ResearchExecution(player, "academia", false));
    executeTicks(game, 1);
    expect(d.currentResearch()?.tech).toBe("academia");
    expect(d.queuedTech()).toBe("currency");
  });

  test("a queued tech researched meanwhile is dropped", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    queue(game, player, "currency");
    d.beginResearch("currency", 0);
    d.advanceResearch(10);
    executeTicks(game, 10);
    expect(d.queuedTech()).toBeNull();
  });

  test("does nothing with domestic mode off", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    expect(player.domestic()).toBeNull();
    game.addExecution(new QueueResearchExecution(player, "currency"));
    executeTicks(game, 2);
    expect(player.domestic()).toBeNull();
  });

  test("survives a snapshot", async () => {
    const { game, player } = await readyPlayer();
    queue(game, player, "currency");
    const restored = await expectSnapshotRoundTrip(game, "plains", 30);
    expect(restored.player(HUMAN.id).domestic()!.queuedTech()).toBe("currency");
  });

  test("intent validates", () => {
    expect(
      IntentSchema.safeParse({ type: "queue_research", tech: null }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({ type: "queue_research", tech: "warp_drive" })
        .success,
    ).toBe(false);
  });
});
