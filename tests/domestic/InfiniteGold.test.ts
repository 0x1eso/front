import {
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import {
  payRecruitment,
  processDomesticSecond,
} from "@openfront/engine/domestic/DomesticEconomy";
import { ResearchExecution } from "@openfront/engine/domestic/ResearchExecution";
import { VictoryProjectExecution } from "@openfront/engine/domestic/VictoryProjectExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { executeTicks } from "../util/utils";
import {
  buildLevel,
  conquerRect,
  conquerSquare,
  domesticGame,
  grantLaws,
  grantTechs,
} from "./util";

// Infinite gold (the lobby's setting, or the host's cheat for the lobby
// creator) makes units free; it makes domestic gold costs free too.
const HOST = new PlayerInfo(
  "host",
  PlayerType.Human,
  "client_host",
  "host_id",
  true, // lobby creator
);
const GUEST = new PlayerInfo(
  "guest",
  PlayerType.Human,
  "client_guest",
  "guest_id",
);

/** host has the infinite-gold cheat, guest doesn't; both hold 1% of the land and no gold. */
async function cheatGame(
  config: Partial<GameConfig> = {},
): Promise<[Game, Player, Player]> {
  const game = await domesticGame(
    { hostCheats: { infiniteGold: true }, ...config },
    [HOST, GUEST],
  );
  const host = game.player(HOST.id);
  const guest = game.player(GUEST.id);
  conquerSquare(game, host, 0, 0, 10);
  conquerSquare(game, guest, 50, 50, 10);
  return [game, host, guest];
}

function second(game: Game, player: Player): void {
  processDomesticSecond(game, player, player.domestic()!);
}

describe("infinite gold skips domestic gold costs", () => {
  test("recruitment", async () => {
    const [game, host, guest] = await cheatGame();
    expect(payRecruitment(game, host, 2000)).toBe(2000);
    expect(payRecruitment(game, guest, 2000)).toBe(0);
  });

  test("the lobby-wide setting covers every human", async () => {
    const [game, host, guest] = await cheatGame({
      hostCheats: {},
      infiniteGold: true,
    });
    expect(payRecruitment(game, host, 2000)).toBe(2000);
    expect(payRecruitment(game, guest, 2000)).toBe(2000);
  });

  test("troop upkeep: no charge and no desertion", async () => {
    const [game, host, guest] = await cheatGame();
    for (const p of [host, guest]) {
      p.setTroops(game.config().maxTroops(p));
    }
    const hostTroops = host.troops();
    const guestTroops = guest.troops();
    second(game, host);
    second(game, guest);
    expect(host.troops()).toBe(hostTroops);
    expect(guest.troops()).toBeLessThan(guestTroops);
  });

  test("building upkeep and the research subsidy", async () => {
    const [game, host, guest] = await cheatGame();
    for (const p of [host, guest]) {
      p.addGold(100_000n); // the guest's institute
      buildLevel(
        game,
        p,
        UnitType.ResearchInstitute,
        p === host ? 5 : 55,
        5,
        1,
      );
      grantLaws(p, { learning: "A" }); // subsidy: 300 gold → 0.5 science
    }
    host.removeGold(host.gold());
    expect(guest.gold()).toBe(0n);
    second(game, host);
    second(game, guest);
    // (2.5 land + 1 institute level + 0.5 subsidy) × 1000; the guest's
    // institute idles and it gets no subsidy.
    expect(host.domestic()!.scienceMilliAvailable()).toBe(4000);
    expect(guest.domestic()!.scienceMilliAvailable()).toBe(2500);
    expect(host.gold()).toBe(0n);
  });

  test("a research shortfall paid in gold", async () => {
    const [game, host, guest] = await cheatGame();
    for (const p of [host, guest]) {
      p.domestic()!.addYield(40_000, 0);
      game.addExecution(new ResearchExecution(p, "currency", true));
    }
    executeTicks(game, 1);
    expect(host.domestic()!.currentResearch()?.tech).toBe("currency");
    expect(host.domestic()!.scienceMilliAvailable()).toBe(0);
    expect(guest.domestic()!.currentResearch()).toBeNull();
    expect(TECHS.currency.cost * MILLI).toBeGreaterThan(40_000);
  });

  test("a victory project's gold cost", async () => {
    const [game, host, guest] = await cheatGame();
    conquerRect(game, host, 0, 0, 40, 100);
    conquerRect(game, guest, 40, 0, 40, 100);
    const units = [host, guest].map((p) => {
      p.addGold(1_000_000n); // the guest's institute
      const unit = buildLevel(
        game,
        p,
        UnitType.ResearchInstitute,
        p === host ? 5 : 45,
        50,
        3,
      );
      grantTechs(p, "space_program");
      return unit;
    });
    host.removeGold(host.gold());
    guest.removeGold(guest.gold());
    game.addExecution(
      new VictoryProjectExecution(host, "science", units[0].id()),
      new VictoryProjectExecution(guest, "science", units[1].id()),
    );
    executeTicks(game, 1);
    expect(host.domestic()!.victoryProject()?.kind).toBe("science");
    expect(guest.domestic()!.victoryProject()).toBeNull();
  });
});
