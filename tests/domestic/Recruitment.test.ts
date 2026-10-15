import { payRecruitment } from "@openfront/engine/domestic/DomesticEconomy";
import { PlayerExecution } from "@openfront/engine/execution/PlayerExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { executeTicks } from "../util/utils";
import { conquerSquare, domesticGame, grantTechs, HUMAN } from "./util";

async function readyPlayer(): Promise<{ game: Game; player: Player }> {
  const game = await domesticGame();
  const player = game.player(HUMAN.id);
  conquerSquare(game, player, 0, 0, 10);
  return { game, player };
}

describe("recruitment", () => {
  test("troop growth stops at the recruit target", async () => {
    const { game, player } = await readyPlayer();
    const config = game.config();
    const max = config.maxTroops(player);
    player.domestic()!.setRecruitTargetPct(50);
    player.setTroops(Math.ceil(max * 0.5));
    expect(config.troopIncreaseRate(player)).toBe(0);
    player.setTroops(Math.floor(max * 0.3));
    const inc = config.troopIncreaseRate(player);
    expect(inc).toBeGreaterThan(0);
    expect(player.troops() + inc).toBeLessThanOrEqual((max * 50) / 100);
  });

  test("conscription raises regrowth by 25%", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    const base = game.config().troopIncreaseRate(player);
    grantTechs(player, "conscription");
    expect(game.config().troopIncreaseRate(player)).toBeCloseTo(base * 1.25, 6);
  });

  test("recruiting costs 50 gold per 1000 troops (35 with conscription)", async () => {
    const { player } = await readyPlayer();
    player.addGold(1_000_000n);
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(999_900n);
    grantTechs(player, "conscription");
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(999_830n);
  });

  test("recruitment is limited by gold", async () => {
    const { player } = await readyPlayer();
    player.addGold(30n);
    expect(payRecruitment(player, 2000)).toBe(600);
    expect(player.gold()).toBe(0n);
    expect(payRecruitment(player, 2000)).toBe(0);
  });

  test("players without domestic state recruit for free", async () => {
    const game = await setup("plains", {}, [HUMAN]);
    const player = game.player(HUMAN.id);
    expect(payRecruitment(player, 2000)).toBe(2000);
    expect(player.gold()).toBe(0n);
  });

  test("PlayerExecution pays for troop growth", async () => {
    const { game, player } = await readyPlayer();
    player.setTroops(30_000);
    game.addExecution(new PlayerExecution(player));
    executeTicks(game, 21);
    // 20 ticks of 100 gold income, part of it spent on recruiting.
    expect(player.troops()).toBeGreaterThan(30_000);
    expect(player.gold()).toBeLessThan(2000n);
  });
});
