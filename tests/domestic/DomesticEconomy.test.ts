import {
  MessageType,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { processDomesticSecond } from "@openfront/engine/domestic/DomesticEconomy";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { vi } from "vitest";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10); // 100 of 10,000 land tiles = 1%
  return { game, player };
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("domestic economy, one second", () => {
  test("base 1/s plus territory 1.5 * sqrt(land share %) of each resource", async () => {
    const { game, player } = await readyPlayer();
    second(game, player);
    const d = player.domestic()!;
    expect(d.scienceMilliAvailable()).toBe(2500);
    expect(d.politicalMilliAvailable()).toBe(2500);
    expect(d.cumulativeScienceMilli()).toBe(2500);
  });

  test("the base yield needs no territory", async () => {
    const { game, player } = await readyPlayer();
    const empty = game.addPlayer(
      new PlayerInfo("empty", PlayerType.Human, null, "empty_id"),
    );
    expect(empty.numTilesOwned()).toBe(0);
    second(game, empty);
    expect(empty.domestic()!.scienceMilliAvailable()).toBe(1000);
    expect(empty.domestic()!.politicalMilliAvailable()).toBe(1000);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(0);
  });

  test("nations' output scales with difficulty (Medium x0.85)", async () => {
    const game = await domesticGame();
    const nation = game.addPlayer(
      new PlayerInfo("nation", PlayerType.Nation, null, "nation_id"),
    );
    conquerSquare(game, nation, 50, 50, 10);
    second(game, nation);
    expect(nation.domestic()!.scienceMilliAvailable()).toBe(2125);
  });

  test("an institute adds 1/s for 50 gold/s; academia adds 40%", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    grantTechs(player, "academia");
    const goldBefore = player.gold();
    second(game, player);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(3900);
    expect(player.domestic()!.politicalMilliAvailable()).toBe(2500);
    expect(player.gold()).toBe(goldBefore - 50n);
  });

  test("institutes stop when upkeep can't be paid", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000n);
    player.buildUnit(UnitType.ResearchInstitute, game.ref(5, 5), {});
    expect(player.gold()).toBe(0n);
    second(game, player);
    expect(player.domestic()!.scienceMilliAvailable()).toBe(2500);
    expect(player.gold()).toBe(0n);
  });

  test("troops above 40% of max cost 1.5 gold per 1000 per second", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(1_000_000n);
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    const excess = player.troops() - (max * 40) / 100;
    const due = BigInt(Math.ceil((excess / 1000) * 1.5));
    second(game, player);
    expect(player.gold()).toBe(1_000_000n - due);
  });

  test("desertion: without gold, 1% of the excess leaves each second", async () => {
    const { game, player } = await readyPlayer();
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    const before = player.troops();
    const excess = before - (max * 40) / 100;
    second(game, player);
    expect(player.troops()).toBe(before - Math.ceil(excess / 100));
    expect(player.gold()).toBe(0n);
  });

  test("demobilizes 1% of the excess per second, never below target", async () => {
    const { game, player } = await readyPlayer();
    player.addGold(100_000_000n);
    const max = game.config().maxTroops(player);
    player.setTroops(max);
    player.domestic()!.setRecruitTargetPct(50);
    const before = player.troops();
    const over = before - (max * 50) / 100;
    second(game, player);
    expect(player.troops()).toBe(
      before - Math.min(Math.floor(over), Math.ceil(over / 100)),
    );
    expect(player.troops()).toBeGreaterThanOrEqual((max * 50) / 100);
  });

  test("banking: 2% per minute interest, capped at 1500/s", async () => {
    const { game, player } = await readyPlayer();
    grantTechs(player, "banking");
    player.addGold(3_000_000n);
    second(game, player);
    expect(player.gold()).toBe(3_001_000n);
    player.addGold(5_999_000n); // 9,000,000
    second(game, player);
    expect(player.gold()).toBe(9_001_500n);
  });

  test("research advances a second at a time and announces completion", async () => {
    const { game, player } = await readyPlayer();
    const spy = vi.spyOn(game, "displayMessage");
    player.domestic()!.beginResearch("currency", 20);
    second(game, player);
    expect(player.domestic()!.hasTech("currency")).toBe(false);
    second(game, player);
    expect(player.domestic()!.hasTech("currency")).toBe(true);
    expect(spy).toHaveBeenCalledWith(
      "events_display.research_complete",
      MessageType.RESEARCH_COMPLETE,
      player.id(),
      undefined,
      { tech: "currency" },
    );
  });
});

describe("DomesticExecution", () => {
  test("processes every domestic player once per 10 ticks", async () => {
    const { game, player } = await readyPlayer();
    game.addExecution(new DomesticExecution());
    executeTicks(game, 1); // init
    executeTicks(game, 10);
    expect(player.domestic()!.cumulativeScienceMilli()).toBe(2500);
    executeTicks(game, 10);
    expect(player.domestic()!.cumulativeScienceMilli()).toBe(5000);
  });
});
