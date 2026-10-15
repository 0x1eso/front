import {
  GameMode,
  PlayerInfo,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  GameUpdateType,
  WinUpdate,
} from "@openfront/engine-api/game/GameUpdates";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { WinCheckExecution } from "@openfront/engine/execution/WinCheckExecution";
import { Game, Player } from "@openfront/engine/game/Game";
import { setup } from "../util/Setup";
import { buildLevel, conquerRect, domesticGame } from "./util";

const ALICE = new PlayerInfo(
  "alice",
  PlayerType.Human,
  "client_alice",
  "alice_id",
);
const BOB = new PlayerInfo("bob", PlayerType.Human, "client_bob", "bob_id");
const FOUR = [1, 2, 3, 4].map(
  (n) =>
    new PlayerInfo(`player${n}`, PlayerType.Human, `client${n}`, `p${n}_id`),
);

function pair(game: Game): [Player, Player] {
  return [game.player(ALICE.id), game.player(BOB.id)];
}

function startWinCheck(game: Game): void {
  game.addExecution(new WinCheckExecution());
}

function tickWins(game: Game, ticks: number): WinUpdate[] {
  const wins: WinUpdate[] = [];
  for (let i = 0; i < ticks; i++) {
    wins.push(...game.executeNextTick()[GameUpdateType.Win]);
  }
  return wins;
}

describe("domestic victory", () => {
  test("a completed project wins, with its reason", async () => {
    const game = await domesticGame({}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 30, 100);
    conquerRect(game, bob, 30, 0, 60, 100);
    const host = buildLevel(game, alice, UnitType.ResearchInstitute, 5, 50, 3);
    alice.domestic()!.beginVictoryProject("science", host.id(), 20);
    game.addExecution(new DomesticExecution());
    startWinCheck(game);

    const wins = tickWins(game, 50);

    expect(wins).toHaveLength(1);
    expect(wins[0].winner).toEqual(["player", "client_alice"]);
    expect(wins[0].reason).toBe("science");
    expect(game.getWinner()).toBe(alice);
  });

  test("in team games a project wins for the team", async () => {
    const game = await domesticGame(
      { gameMode: GameMode.Team, playerTeams: 2 },
      FOUR,
    );
    const players = FOUR.map((i) => game.player(i.id));
    players.forEach((p, i) => conquerRect(game, p, i * 20, 0, 20, 100));
    const host = buildLevel(game, players[0], UnitType.AdminOffice, 5, 50, 3);
    players[0].domestic()!.beginVictoryProject("political", host.id(), 10);
    game.addExecution(new DomesticExecution());
    startWinCheck(game);

    const wins = tickWins(game, 40);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("political");
    expect(game.getWinner()).toBe(players[0].team());
  });

  test("conquest needs more than 70% of the land", async () => {
    const game = await domesticGame({}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 70, 100);
    conquerRect(game, bob, 70, 0, 30, 100);
    startWinCheck(game);
    expect(tickWins(game, 20)).toHaveLength(0);

    alice.conquer(game.ref(70, 0));
    const wins = tickWins(game, 20);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("conquest");
    expect(game.getWinner()).toBe(alice);
  });

  test("the lobby's conquestPercent applies", async () => {
    const game = await domesticGame({ conquestPercent: 60 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 61, 100);
    conquerRect(game, bob, 61, 0, 39, 100);
    startWinCheck(game);

    const wins = tickWins(game, 20);

    expect(wins[0].reason).toBe("conquest");
    expect(game.getWinner()).toBe(alice);
  });

  test("at the time limit the score leader wins, not the land leader", async () => {
    const game = await domesticGame({ maxTimerValue: 1 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 60, 100);
    conquerRect(game, bob, 60, 0, 10, 100);
    bob.domestic()!.addYield(1_000_000, 1_000_000);
    startWinCheck(game);

    expect(tickWins(game, 590)).toHaveLength(0);
    const wins = tickWins(game, 30);

    expect(wins).toHaveLength(1);
    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(bob);
  });

  test("score ties go to the side with more land", async () => {
    // alice: 40% land, 60% science; bob: 60% land, 40% science -> 25 : 25.
    const game = await domesticGame({ maxTimerValue: 1 }, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 40, 100);
    conquerRect(game, bob, 40, 0, 60, 100);
    alice.domestic()!.addYield(600_000, 0);
    bob.domestic()!.addYield(400_000, 0);
    startWinCheck(game);

    const wins = tickWins(game, 620);

    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(bob);
  });

  test("team games compare summed scores", async () => {
    const game = await domesticGame(
      { gameMode: GameMode.Team, playerTeams: 2, maxTimerValue: 1 },
      FOUR,
    );
    const players = FOUR.map((i) => game.player(i.id));
    const red = players.filter((p) => p.team() === players[0].team());
    const blue = players.filter((p) => p.team() !== players[0].team());
    expect(red).toHaveLength(2);
    expect(blue).toHaveLength(2);
    // Red holds most of the land; blue produced all the science and politics.
    conquerRect(game, red[0], 0, 0, 30, 100);
    conquerRect(game, red[1], 30, 0, 30, 100);
    conquerRect(game, blue[0], 60, 0, 10, 100);
    conquerRect(game, blue[1], 70, 0, 10, 100);
    blue[0].domestic()!.addYield(500_000, 500_000);
    blue[1].domestic()!.addYield(500_000, 500_000);
    startWinCheck(game);

    const wins = tickWins(game, 620);

    expect(wins[0].reason).toBe("score");
    expect(game.getWinner()).toBe(blue[0].team());
  });

  test("vanilla wins carry no reason", async () => {
    const game = await setup("plains", {}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 81, 100);
    conquerRect(game, bob, 81, 0, 19, 100);
    startWinCheck(game);

    const wins = tickWins(game, 20);

    expect(wins).toHaveLength(1);
    expect("reason" in wins[0]).toBe(false);
    expect(game.getWinner()).toBe(alice);
  });

  test("vanilla still needs 80%", async () => {
    const game = await setup("plains", {}, [ALICE, BOB]);
    const [alice, bob] = pair(game);
    conquerRect(game, alice, 0, 0, 75, 100);
    conquerRect(game, bob, 75, 0, 25, 100);
    startWinCheck(game);
    expect(tickWins(game, 20)).toHaveLength(0);
  });
});
