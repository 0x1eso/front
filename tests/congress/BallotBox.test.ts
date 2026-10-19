import { PlayerInfo, PlayerType } from "@openfront/engine-api/game/GameTypes";
import { StampedIntent } from "@openfront/engine-api/Schemas";
import { Executor } from "@openfront/engine/execution/ExecutionManager";
import { Game, Player } from "@openfront/engine/game/Game";
import {
  BLUE,
  congressGame,
  congressOf,
  giveInfluence,
  GREEN,
  influence,
  item,
  own,
  RED,
  runTicks,
  seatAll,
} from "./util";

async function three(): Promise<{
  game: Game;
  red: Player;
  blue: Player;
  green: Player;
}> {
  const game = await congressGame({}, [RED, BLUE, GREEN]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 35, 0, 30, 100);
  const green = own(game, GREEN.id, 70, 0, 30, 100);
  game.executeNextTick(); // the congress clock starts
  return { game, red, blue, green };
}

describe("the ballot box", () => {
  test("a seat or one of the item's targets may vote; nobody else", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    const s = c.openSession(
      "regular",
      [item("sanction", [green.smallID()]), item("research_fund")],
      game.ticks(),
    );
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
    expect(c.castBallot(green, s.id, 0, "B", 0)).toBeNull();
    expect(c.castBallot(green, s.id, 1, "A", 0)).toBe("seat");
    expect(c.castBallot(red, s.id, 2, "A", 0)).toBe("item");
    expect(c.session()!.items.map((i) => i.voters)).toEqual([2, 0]);
  });

  test("extra votes cost 10, 30, 60, 100, 150 in all and only go up", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 200);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 1)).toBeNull();
    expect(influence(red)).toBe(190);
    expect(c.castBallot(red, s.id, 0, "A", 3)).toBeNull();
    expect(influence(red)).toBe(140);
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("lower");
    expect(influence(red)).toBe(140);
    expect(c.castBallot(red, s.id, 0, "A", 5)).toBeNull();
    expect(influence(red)).toBe(50);
    expect(red.congress()!.ballot(s.id, 0)).toEqual({
      sessionId: s.id,
      item: 0,
      option: "A",
      extra: 5,
      costMilli: 150_000,
    });
    expect(c.session()!.items[0].voters).toBe(1);
  });

  test("a side can't change, and a raise needs the influence", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 20);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
    expect(c.castBallot(red, s.id, 0, "B", 1)).toBe("side");
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("influence");
    expect(influence(red)).toBe(20);
  });

  test("a ballot for a closed or earlier session is refused and costs nothing", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 100);
    const s1 = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s1.id, 0, "A", 1)).toBeNull();
    c.closeSession();
    expect(influence(red)).toBe(90); // A won 2 : 0, so the 10 is spent
    expect(c.castBallot(red, s1.id, 0, "A", 2)).toBe("closed");
    const s2 = c.openSession("regular", [item("war_tax")], game.ticks());
    expect(c.castBallot(red, s1.id, 0, "A", 1)).toBe("closed");
    expect(influence(red)).toBe(90);
    expect(c.castBallot(red, s2.id, 0, "A", 0)).toBeNull();
  });

  test("a raise processed before the close tick counts; at the close tick it doesn't", async () => {
    const { game, red, blue } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID()]);
    giveInfluence(red, 100);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    runTicks(game, s.closeTick - 1 - game.ticks());
    expect(c.castBallot(red, s.id, 0, "A", 1)).toBeNull();
    game.executeNextTick();
    expect(c.castBallot(red, s.id, 0, "A", 2)).toBe("closed");
    game.executeNextTick(); // the clock tallies at closeTick
    expect(c.session()).toBeNull();
    const history = c.history();
    expect(history[history.length - 1]).toMatchObject({
      sessionId: s.id,
      a: 2,
      b: 0,
      adopted: "A",
    });
  });

  test("the tally: more votes win, a tie adopts nothing, losers and ties get their influence back", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID(), green.smallID()]);
    for (const p of [red, blue, green]) giveInfluence(p, 100);
    const s = c.openSession(
      "regular",
      [item("research_fund"), item("war_tax"), item("arms_treaty")],
      game.ticks(),
    );
    c.castBallot(red, s.id, 0, "A", 1);
    c.castBallot(blue, s.id, 0, "B", 0);
    c.castBallot(red, s.id, 1, "A", 0);
    c.castBallot(blue, s.id, 1, "B", 2);
    c.castBallot(red, s.id, 2, "A", 1);
    c.castBallot(blue, s.id, 2, "B", 1);
    const results = c.closeSession();
    expect(results.map((r) => [r.a, r.b, r.adopted])).toEqual([
      [2, 1, "A"],
      [1, 3, "B"],
      [2, 2, null],
    ]);
    expect(results[0].aVoters).toEqual([red.smallID()]);
    expect(results[0].bVoters).toEqual([blue.smallID()]);
    // red won item 0 (10 spent) and tied item 2 (10 back).
    expect(influence(red)).toBe(90);
    // blue won item 1 (30 spent) and tied item 2 (10 back).
    expect(influence(blue)).toBe(70);
    expect(influence(green)).toBe(100);
    expect(c.history().map((h) => h.adopted)).toEqual(["A", "B", null]);
    expect(red.congress()!.ballotsFor(s.id)).toEqual([]);
  });

  test("emergency items: the target and its allies may only oppose", async () => {
    const { game, red, blue, green } = await three();
    const c = congressOf(game);
    c.setSeats([red.smallID(), blue.smallID(), green.smallID()]);
    green.createAllianceRequest(blue)?.accept();
    const s = c.openSession(
      "emergency",
      [item("emergency", [blue.smallID()], "nuclear", "convened")],
      game.ticks(),
    );
    expect(s.closeTick - s.openTick).toBe(200);
    expect(c.castBallot(blue, s.id, 0, "A", 0)).toBe("b_only");
    expect(c.castBallot(green, s.id, 0, "A", 0)).toBe("b_only");
    expect(c.castBallot(green, s.id, 0, "B", 0)).toBeNull();
    expect(c.castBallot(red, s.id, 0, "A", 0)).toBeNull();
  });

  // Review focus 1, through the real path: an intent becomes a
  // CongressVoteExecution before the tick runs (GameRunner), and the clock
  // ticks before new executions init.
  test("a congress_vote intent processed at closeTick - 1 counts; one at closeTick is refused and costs nothing", async () => {
    const early = new PlayerInfo(
      "early",
      PlayerType.Human,
      "EARLY001",
      "early_id",
    );
    const late = new PlayerInfo(
      "late",
      PlayerType.Human,
      "LATE0001",
      "late_id",
    );
    const game = await congressGame({}, [early, late]);
    const a = own(game, early.id, 0, 0, 30, 100);
    const b = own(game, late.id, 35, 0, 30, 100);
    game.executeNextTick();
    const c = congressOf(game);
    seatAll(game);
    giveInfluence(a, 100);
    giveInfluence(b, 100);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    const executor = new Executor(game, "game_id", undefined);
    const vote = (clientID: string): StampedIntent => ({
      type: "congress_vote",
      clientID,
      session: s.id,
      item: 0,
      option: "A",
      extra: 2,
    });

    runTicks(game, s.closeTick - 1 - game.ticks());
    expect(game.ticks()).toBe(s.closeTick - 1);
    // Influence accrues every tick: assert the 30 charge on top of at most a
    // few points of accrual, not an absolute number.
    const ACCRUAL_SLACK = 5;
    const aBefore = influence(a);
    game.addExecution(executor.createExec(vote("EARLY001")));
    game.executeNextTick(); // tick closeTick - 1
    expect(c.session()!.items[0].voters).toBe(1);
    expect(influence(a)).toBeGreaterThanOrEqual(aBefore - 30);
    expect(influence(a)).toBeLessThanOrEqual(aBefore - 30 + ACCRUAL_SLACK);
    const aCharged = influence(a);
    const bBefore = influence(b);

    game.addExecution(executor.createExec(vote("LATE0001")));
    game.executeNextTick(); // tick closeTick: tallied, then the ballot comes too late
    expect(c.session()).toBeNull();
    const history = c.history();
    expect(history[history.length - 1]).toMatchObject({
      sessionId: s.id,
      a: 3,
      b: 0,
      adopted: "A",
    });
    // won: the extra votes stay spent (only accrual moved it)
    expect(influence(a)).toBeGreaterThanOrEqual(aCharged);
    expect(influence(a)).toBeLessThanOrEqual(aCharged + ACCRUAL_SLACK);
    // the late ballot charged nothing: b only gained
    expect(influence(b)).toBeGreaterThanOrEqual(bBefore);
    expect(influence(b)).toBeLessThanOrEqual(bBefore + ACCRUAL_SLACK);
    expect(b.congress()!.ballotsFor(s.id)).toEqual([]);
  });
});
