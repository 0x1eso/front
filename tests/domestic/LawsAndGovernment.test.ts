import {
  GovernmentId,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { IntentSchema } from "@openfront/engine-api/Schemas";
import { LAW_COOLDOWN_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { ChooseGovernmentExecution } from "@openfront/engine/domestic/ChooseGovernmentExecution";
import { ProclaimLawExecution } from "@openfront/engine/domestic/ProclaimLawExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { expectSnapshotRoundTrip } from "../util/Snapshot";
import { executeTicks } from "../util/utils";
import {
  conquerSquare,
  domesticGame,
  grantGovernment,
  grantLaws,
  grantTechs,
  HUMAN,
} from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

function proclaim(
  game: Game,
  player: Player,
  law: LawId,
  option: LawOption,
  payWithGold = false,
): void {
  game.addExecution(new ProclaimLawExecution(player, law, option, payWithGold));
  executeTicks(game, 1);
}

function choose(game: Game, player: Player, government: GovernmentId): void {
  game.addExecution(new ChooseGovernmentExecution(player, government));
  executeTicks(game, 1);
}

describe("ProclaimLawExecution", () => {
  test("spends political power, keeps the cumulative total, applies the law", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 250_000);
    const t0 = game.ticks();
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(150_000);
    expect(d.cumulativePoliticalMilli()).toBe(250_000);
    expect(d.pct("trade")).toBe(40);
    expect(d.lawCooldownUntilTick()).toBe(t0 + LAW_COOLDOWN_TICKS);
  });

  test("each law costs more: the second costs 150", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 249_000);
    proclaim(game, player, "trade", "A");
    executeTicks(game, LAW_COOLDOWN_TICKS);
    proclaim(game, player, "opinion", "A");
    expect(d.proclaimedLaws().has("opinion")).toBe(false);
    d.addYield(0, 1_000);
    proclaim(game, player, "opinion", "A");
    expect(d.proclaimedLaws().get("opinion")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(0);
  });

  test("the cooldown blocks the next law for 45 seconds", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "trade", "A"); // at tick t0
    executeTicks(game, LAW_COOLDOWN_TICKS - 2);
    proclaim(game, player, "opinion", "A"); // at t0 + 449
    expect(d.proclaimedLaws().has("opinion")).toBe(false);
    proclaim(game, player, "opinion", "A"); // at t0 + 450
    expect(d.proclaimedLaws().get("opinion")).toBe("A");
  });

  test("the other option of a proclaimed law is closed forever", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "trade", "A");
    executeTicks(game, LAW_COOLDOWN_TICKS);
    const before = d.politicalMilliAvailable();
    proclaim(game, player, "trade", "B");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(before);
  });

  test("the nuclear law needs the Manhattan Project", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 1_000_000);
    proclaim(game, player, "nuclear", "B");
    expect(d.proclaimedLaws().has("nuclear")).toBe(false);
    expect(d.politicalMilliAvailable()).toBe(1_000_000);
    grantTechs(player, "rocketry", "manhattan_project");
    proclaim(game, player, "nuclear", "B");
    expect(d.proclaimedLaws().get("nuclear")).toBe("B");
  });

  test("a shortfall needs payWithGold and enough gold", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 40_000);
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().size).toBe(0);
    player.addGold(59_999n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().size).toBe(0);
    player.addGold(1n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(player.gold()).toBe(0n);
    expect(d.politicalMilliAvailable()).toBe(0);
  });

  test("democracy halves the gold price of a shortfall", async () => {
    const { game, player } = await readyPlayer();
    grantGovernment(player, "democracy");
    const d = player.domestic()!;
    d.addYield(0, 40_000);
    player.addGold(30_000n);
    proclaim(game, player, "trade", "A", true);
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(player.gold()).toBe(0n);
  });

  test("printing press makes laws 15% cheaper", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "printing_press");
    const d = player.domestic()!;
    d.addYield(0, 85_000);
    proclaim(game, player, "trade", "A");
    expect(d.proclaimedLaws().get("trade")).toBe("A");
    expect(d.politicalMilliAvailable()).toBe(0);
  });
});

describe("ChooseGovernmentExecution", () => {
  test("needs the tier and locks the choice until the next tier", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    choose(game, player, "monarchy");
    expect(d.currentGovernment()).toBe("chiefdom");

    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    choose(game, player, "monarchy");
    expect(d.currentGovernment()).toBe("monarchy");
    expect(d.pct("maxTroops")).toBe(20);
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("monarchy");

    d.addYield(0, 1_200_000);
    d.refreshGovernmentTier();
    choose(game, player, "democracy");
    expect(d.currentGovernment()).toBe("democracy");
    expect(d.pct("maxTroops")).toBe(0);
    expect(d.pct("goldIncome")).toBe(30);
  });

  test("theocracy needs state religion", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 300_000);
    d.refreshGovernmentTier();
    choose(game, player, "theocracy");
    expect(d.currentGovernment()).toBe("chiefdom");
    grantLaws(player, { religion: "A" });
    choose(game, player, "theocracy");
    expect(d.currentGovernment()).toBe("theocracy");
    expect(d.hasFlag("tithe")).toBe(true);
  });

  test("choosing a government ignores the law cooldown but restarts it", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 400_000);
    d.refreshGovernmentTier();
    proclaim(game, player, "trade", "A");
    const t1 = game.ticks();
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("republic");
    expect(d.lawCooldownUntilTick()).toBe(t1 + LAW_COOLDOWN_TICKS);
  });

  test("tier 3 still lets a player adopt a tier-2 government", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 3_500_000);
    d.refreshGovernmentTier();
    choose(game, player, "republic");
    expect(d.currentGovernment()).toBe("chiefdom");
    choose(game, player, "fascism");
    expect(d.currentGovernment()).toBe("fascism");
  });
});

describe("laws and governments across snapshots and the wire", () => {
  test("laws, government and pending orders survive a snapshot", async () => {
    const { game, player } = await readyPlayer();
    const d = player.domestic()!;
    d.addYield(0, 600_000);
    d.refreshGovernmentTier();
    proclaim(game, player, "religion", "A");
    // Still pending when the snapshot is taken.
    game.addExecution(new ChooseGovernmentExecution(player, "theocracy"));

    const restored = await expectSnapshotRoundTrip(game, "plains", 5);
    const rd = restored.player(HUMAN.id).domestic()!;
    expect(rd.proclaimedLaws().get("religion")).toBe("A");
    expect(rd.currentGovernment()).toBe("theocracy");
    expect(rd.lawCooldownUntilTick()).toBe(d.lawCooldownUntilTick());
  });

  test("intents validate", () => {
    expect(
      IntentSchema.safeParse({
        type: "proclaim_law",
        law: "trade",
        option: "B",
        payWithGold: true,
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({
        type: "proclaim_law",
        law: "taxes",
        option: "A",
      }).success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({
        type: "proclaim_law",
        law: "trade",
        option: "C",
      }).success,
    ).toBe(false);
    expect(
      IntentSchema.safeParse({
        type: "choose_government",
        government: "fascism",
      }).success,
    ).toBe(true);
    expect(
      IntentSchema.safeParse({
        type: "choose_government",
        government: "anarchy",
      }).success,
    ).toBe(false);
  });
});
