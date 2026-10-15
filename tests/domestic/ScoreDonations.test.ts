import {
  GameMode,
  PlayerInfo,
  PlayerType,
  Team,
} from "@openfront/engine-api/game/GameTypes";
import { domesticScores } from "@openfront/engine-lib/domestic/Score";
import { domesticScoreInput } from "@openfront/engine/domestic/DomesticWinCheck";
import { PlayerDomestic } from "@openfront/engine/domestic/PlayerDomestic";
import { Game, Player } from "@openfront/engine/game/Game";
import type { GameView, PlayerView } from "../../src/client/view";
import { domesticScoreMap } from "../../src/client/view/DomesticScores";
import { conquerRect, domesticGame } from "./util";

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

/** The engine's scores (the 30-minute judgement), in `players` order. */
function engineTotals(players: Player[]): number[] {
  return domesticScores(players.map(domesticScoreInput)).map((s) => s.total);
}

/** What the client sees of an engine player: its goldEarned and its last domestic update. */
function viewOf(p: Player): PlayerView {
  return {
    smallID: () => p.smallID(),
    type: () => p.type(),
    isAlive: () => true,
    numTilesOwned: () => p.numTilesOwned(),
    goldEarned: () => Number(p.goldEarned()),
    domesticData: () => p.domestic()!.toData(),
  } as unknown as PlayerView;
}

/** The client's live leaderboard scores, in `players` order. */
function clientTotals(players: Player[], tick: number): number[] {
  const game = {
    playerViews: () => players.map(viewOf),
    ticks: () => tick,
  } as unknown as GameView;
  const scores = domesticScoreMap(game);
  return players.map((p) => scores.get(p.smallID())!.total);
}

async function twoPlayers(): Promise<[Game, Player, Player]> {
  const game = await domesticGame({ donateGold: true }, [ALICE, BOB]);
  const alice = game.player(ALICE.id);
  const bob = game.player(BOB.id);
  conquerRect(game, alice, 0, 0, 30, 100);
  conquerRect(game, bob, 30, 0, 30, 100);
  // Produced income: alice a quarter of it, bob three quarters.
  alice.addGold(10_000n);
  bob.addGold(30_000n);
  return [game, alice, bob];
}

describe("donated gold never scores (spec §8.2: gold earned)", () => {
  test("passing gold back and forth leaves both scores unchanged", async () => {
    const [, alice, bob] = await twoPlayers();
    const before = engineTotals([alice, bob]);
    expect(before[0]).toBeLessThan(before[1]);

    expect(alice.donateGold(bob, 5_000n)).toBe(true);
    expect(bob.donateGold(alice, 8_000n)).toBe(true);
    expect(alice.donateGold(bob, 2_000n)).toBe(true);

    expect(engineTotals([alice, bob])).toEqual(before);
  });

  test("the client's live leaderboard ignores donations the same way", async () => {
    const [, alice, bob] = await twoPlayers();
    const before = clientTotals([alice, bob], 1);
    expect(before).toEqual(engineTotals([alice, bob]));

    alice.donateGold(bob, 5_000n);
    bob.donateGold(alice, 8_000n);

    expect(alice.domestic()!.toData().donationGoldReceived).toBe(8_000);
    expect(bob.domestic()!.toData().donationGoldReceived).toBe(5_000);
    expect(clientTotals([alice, bob], 2)).toEqual(before);
  });

  test("a team's summed score doesn't count a donation twice", async () => {
    const game = await domesticGame(
      { gameMode: GameMode.Team, playerTeams: 2, donateGold: true },
      FOUR,
    );
    const players = FOUR.map((i) => game.player(i.id));
    players.forEach((p, i) => {
      conquerRect(game, p, i * 20, 0, 20, 100);
      p.addGold(BigInt((i + 1) * 10_000));
    });
    const teamTotals = (): Map<Team, number> => {
      const totals = engineTotals(players);
      const byTeam = new Map<Team, number>();
      players.forEach((p, i) =>
        byTeam.set(p.team()!, (byTeam.get(p.team()!) ?? 0) + totals[i]),
      );
      return byTeam;
    };
    const before = teamTotals();
    const [first] = players;
    const mate = players.find((p) => p !== first && p.team() === first.team())!;
    const rival = players.find((p) => p.team() !== first.team())!;

    first.donateGold(mate, 7_000n);
    mate.donateGold(first, 3_000n);
    rival.donateGold(first, 4_000n);

    const after = teamTotals();
    for (const [team, total] of before) {
      expect(after.get(team)).toBeCloseTo(total, 9);
    }
  });

  test("donation gold received survives a snapshot; older snapshots read 0", async () => {
    const [, alice, bob] = await twoPlayers();
    bob.donateGold(alice, 6_000n);
    const d = alice.domestic()!;
    expect(d.donationGoldReceived()).toBe(6_000n);

    const restored = PlayerDomestic.restore(d.snapshot());
    expect(restored.donationGoldReceived()).toBe(6_000n);
    expect(restored.snapshot()).toEqual(d.snapshot());

    const older = d.snapshot();
    delete older.donationGoldReceived;
    expect(PlayerDomestic.restore(older).donationGoldReceived()).toBe(0n);
  });
});
