import {
  Cell,
  Difficulty,
  Nation,
  PlayerInfo,
  PlayerType,
} from "@openfront/engine-api/game/GameTypes";
import { aiVoteDelayTicks } from "@openfront/engine-lib/congress/CongressBalance";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { conveneEmergency } from "@openfront/engine/congress/Emergencies";
import { DomesticExecution } from "@openfront/engine/domestic/DomesticExecution";
import { NationExecution } from "@openfront/engine/execution/NationExecution";
import {
  affordableExtra,
  nationBallot,
  nationCongressTick,
} from "@openfront/engine/execution/nation/NationCongressBehavior";
import {
  nationDomesticPlan,
  Personality,
} from "@openfront/engine/execution/nation/NationPersonality";
import { Game, Player } from "@openfront/engine/game/Game";
import { grantGovernment } from "../domestic/util";
import {
  BLUE,
  congressGame,
  congressOf,
  giveInfluence,
  item,
  own,
  RED,
  seatAll,
} from "./util";

/** A nation id whose personality is `p` (personality is a pure function of the id). */
function idWith(p: Personality): string {
  for (let i = 0; i < 500; i++) {
    const id = `nat${i}`;
    if (nationDomesticPlan(id).personality === p) return id;
  }
  throw new Error(`no ${p}`);
}

function nationOf(p: Personality): PlayerInfo {
  const id = idWith(p);
  return new PlayerInfo(id, PlayerType.Nation, null, id);
}

// red x 0-29, blue x 30-59, the nation x 60-89.
async function withNation(
  p: Personality,
  difficulty = Difficulty.Hard,
): Promise<{ game: Game; red: Player; blue: Player; nation: Player }> {
  const info = nationOf(p);
  const game = await congressGame({ difficulty }, [RED, BLUE, info]);
  const red = own(game, RED.id, 0, 0, 30, 100);
  const blue = own(game, BLUE.id, 30, 0, 30, 100);
  const nation = own(game, info.id, 60, 0, 30, 100);
  game.executeNextTick();
  seatAll(game);
  return { game, red, blue, nation };
}

const ballot = (game: Game, nation: Player, i: ReturnType<typeof item>) =>
  nationBallot(game, congressOf(game), nation, { ...i, voters: 0 });

/** Exactly `points` influence now (influence accrues every second on its own). */
function setInfluence(player: Player, points: number, milli = 0): void {
  const pc = player.congress()!;
  const want = points * MILLI + milli;
  const have = pc.influenceMilli();
  if (have > want) pc.spend(have - want);
  else pc.grant(want - have);
}

/** One tick of the nation's congress part, then of the game, as NationExecution runs it. */
function step(game: Game, nation: Player): void {
  nationCongressTick(game, nation);
  game.executeNextTick();
}

describe("nation ballots (spec §11.1)", () => {
  test("extra votes: within the difficulty cap and 70% of the influence", () => {
    expect(affordableExtra(1_000_000, 5)).toBe(5);
    expect(affordableExtra(100_000, 5)).toBe(3); // 60 ≤ 70, 100 > 70
    expect(affordableExtra(0, 5)).toBe(0);
    expect(affordableExtra(1_000_000, 0)).toBe(0);
    // What other items of the session already committed comes off the 70%.
    expect(affordableExtra(100_000, 5, 60_000)).toBe(1); // 10 left
    expect(affordableExtra(100_000, 5, 70_000)).toBe(0);
    expect(affordableExtra(100_000, 5, 90_000)).toBe(0);
  });

  test("its own case: the favourable side with every extra vote it can afford", async () => {
    const { game, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    expect(ballot(game, nation, item("sanction", [nation.smallID()]))).toEqual({
      option: "B",
      extra: 3,
    });
    expect(
      ballot(game, nation, item("protectorate", [nation.smallID()])),
    ).toEqual({ option: "A", extra: 3 });
  });

  test("a truce on itself: duel when winning, truce when losing", async () => {
    const { game, red, nation } = await withNation("conqueror");
    const c = congressOf(game);
    for (let i = 0; i < 5; i++) {
      c.touchPair(nation.smallID(), red.smallID(), game.ticks());
    }
    const truce = item(
      "truce",
      [red.smallID(), nation.smallID()].sort((a, b) => a - b),
    );
    expect(ballot(game, nation, truce)!.option).toBe("B");
    for (let i = 0; i < 9; i++) {
      c.touchPair(red.smallID(), nation.smallID(), game.ticks());
    }
    expect(ballot(game, nation, truce)!.option).toBe("A");
  });

  test("an ally gets the favourable side, an enemy the other, with half the cap", async () => {
    const { game, red, blue, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    nation.createAllianceRequest(red)?.accept();
    expect(ballot(game, nation, item("sanction", [red.smallID()]))).toEqual({
      option: "B",
      extra: 2,
    });
    // blue took land from the nation lately.
    nation.congress()!.recordHitBy(blue.smallID(), game.ticks());
    expect(ballot(game, nation, item("sanction", [blue.smallID()]))).toEqual({
      option: "A",
      extra: 2,
    });
  });

  test("an enemy is forgotten after 180 s, even though the hit list prunes lazily", async () => {
    const { game, blue, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    nation.congress()!.recordHitBy(blue.smallID(), game.ticks());
    for (let t = 0; t < 1801; t++) game.executeNextTick();
    // Still on the list (nobody hit the nation since), but too old.
    expect(nation.congress()!.lastHitTick(blue.smallID())).not.toBeNull();
    // A merchant's personality answer: sanctions are fine, nothing spent.
    expect(ballot(game, nation, item("sanction", [blue.smallID()]))).toEqual({
      option: "A",
      extra: 0,
    });
  });

  test("personalities on world rules; nothing spent", async () => {
    const conqueror = await withNation("conqueror");
    expect(ballot(conqueror.game, conqueror.nation, item("war_tax"))).toEqual({
      option: "B",
      extra: 0,
    });
    const merchant = await withNation("merchant");
    expect(ballot(merchant.game, merchant.nation, item("war_tax"))).toEqual({
      option: "A",
      extra: 0,
    });
    const zealot = await withNation("zealot");
    expect(
      ballot(zealot.game, zealot.nation, item("arms_treaty"))!.option,
    ).toBe("B");
    const scholar = await withNation("scholar");
    expect(
      ballot(scholar.game, scholar.nation, item("building_pact", [], "port")),
    ).toBeNull();
    expect(
      ballot(
        scholar.game,
        scholar.nation,
        item("building_pact", [], "research_institute"),
      ),
    ).toEqual({ option: "A", extra: 0 });
  });

  test("its own government and laws: support, with its own-case extra votes", async () => {
    const { game, nation } = await withNation("conqueror");
    grantGovernment(nation, "monarchy");
    expect(
      ballot(game, nation, item("government_resolution", [], "monarchy")),
    ).toEqual({ option: "A", extra: 0 });
    // Spec §11.1 rule 1: E5/E6 on what it holds is its own case (the cap).
    giveInfluence(nation, 1000);
    expect(
      ballot(game, nation, item("government_resolution", [], "monarchy")),
    ).toEqual({ option: "A", extra: 3 });
    // A conqueror abstains on someone else's government.
    expect(
      ballot(game, nation, item("government_resolution", [], "republic")),
    ).toBeNull();
  });

  test("emergency votes: the target opposes, a victim supports, Easy abstains", async () => {
    const { game, red, nation } = await withNation("merchant");
    giveInfluence(nation, 1000);
    const e = item("emergency", [red.smallID()], "aggression", "convened");
    nation.congress()!.recordHitBy(red.smallID(), game.ticks());
    expect(ballot(game, nation, e)).toEqual({ option: "A", extra: 2 });
    expect(
      ballot(game, nation, item("emergency", [nation.smallID()], "nuclear")),
    ).toEqual({ option: "B", extra: 3 });
    const easy = await withNation("conqueror", Difficulty.Easy);
    expect(
      ballot(
        easy.game,
        easy.nation,
        item("emergency", [easy.red.smallID()], "aggression", "convened"),
      ),
    ).toBeNull();
  });
});

describe("nations in the congress", () => {
  test("a seated nation votes at its own delay after the session opens", async () => {
    const { game, nation } = await withNation("merchant");
    const c = congressOf(game);
    const s = c.openSession("regular", [item("war_tax")], game.ticks());
    const delay = 10 + ((nation.smallID() * 7) % 70);
    for (let t = 0; t < delay; t++) step(game, nation);
    expect(nation.congress()!.ballot(s.id, 0)).toBeNull();
    step(game, nation);
    expect(nation.congress()!.ballot(s.id, 0)).toMatchObject({ option: "A" });
  });

  // Ruling F4: one running budget across the session's items.
  test("two items it cares about share one budget, and both base votes go in", async () => {
    const { game, nation } = await withNation("merchant");
    const c = congressOf(game);
    const me = nation.smallID();
    const s = c.openSession(
      "regular",
      [item("sanction", [me]), item("protectorate", [me])],
      game.ticks(),
    );
    while (game.ticks() < s.openTick + aiVoteDelayTicks(me)) step(game, nation);
    // 70 of 100 to spend: +3 (60) on the first item leaves +1 (10).
    setInfluence(nation, 100);
    step(game, nation);
    const pc = nation.congress()!;
    expect(pc.ballot(s.id, 0)).toMatchObject({ option: "B", extra: 3 });
    expect(pc.ballot(s.id, 1)).toMatchObject({ option: "A", extra: 1 });
    expect(c.session()!.items.map((i) => i.voters)).toEqual([1, 1]);
    // 30 kept back (plus whatever accrued this tick).
    expect(pc.influenceMilli()).toBeGreaterThanOrEqual(30 * MILLI);
    expect(pc.influenceMilli()).toBeLessThan(40 * MILLI);
  });

  test("three items: the reserve holds on the total and no item loses its vote", async () => {
    const { game, nation } = await withNation("merchant");
    const c = congressOf(game);
    const me = nation.smallID();
    const s = c.openSession(
      "regular",
      [
        item("sanction", [me]),
        item("protectorate", [me]),
        item("arms_embargo", [me]),
      ],
      game.ticks(),
    );
    while (game.ticks() < s.openTick + aiVoteDelayTicks(me)) step(game, nation);
    // 140 of 200: +3 (60), +3 (60), then +1 (10) with 20 left.
    setInfluence(nation, 200);
    step(game, nation);
    const pc = nation.congress()!;
    expect(pc.ballot(s.id, 0)).toMatchObject({ option: "B", extra: 3 });
    expect(pc.ballot(s.id, 1)).toMatchObject({ option: "A", extra: 3 });
    expect(pc.ballot(s.id, 2)).toMatchObject({ option: "B", extra: 1 });
    expect(pc.influenceMilli()).toBeGreaterThanOrEqual(70 * MILLI);

    // Short of influence: the extras run out, the base votes don't.
    const poor = await withNation("merchant");
    const pc2 = congressOf(poor.game);
    const me2 = poor.nation.smallID();
    const s2 = pc2.openSession(
      "regular",
      [
        item("sanction", [me2]),
        item("protectorate", [me2]),
        item("arms_embargo", [me2]),
      ],
      poor.game.ticks(),
    );
    while (poor.game.ticks() < s2.openTick + aiVoteDelayTicks(me2)) {
      step(poor.game, poor.nation);
    }
    setInfluence(poor.nation, 50);
    step(poor.game, poor.nation);
    const ballots = [0, 1, 2].map((i) =>
      poor.nation.congress()!.ballot(s2.id, i),
    );
    expect(ballots.map((b) => b?.extra)).toEqual([2, 0, 0]); // 30 of 35
    expect(pc2.session()!.items.map((i) => i.voters)).toEqual([1, 1, 1]);
  });

  // Ruling F5: the 80 threshold itself, with real accrual running.
  test("a nation convenes only after 20 s, with 80 influence, as a victim", async () => {
    const { game, red, nation } = await withNation(
      "merchant",
      Difficulty.Medium,
    );
    const c = congressOf(game);
    red.congress()!.recordTaken(game.ticks(), 600); // 6% of the world
    nation.congress()!.recordHitBy(red.smallID(), game.ticks());
    for (let t = 0; t < 20 && c.available().length === 0; t++) {
      step(game, nation);
    }
    expect(c.available()).toEqual([
      expect.objectContaining({ kind: "aggression", target: red.smallID() }),
    ]);
    const since = c.available()[0].sinceTick;
    const myTurn = () => game.ticks() % 10 === nation.smallID() % 10;

    // Plenty of influence, but humans get 20 s to convene first.
    setInfluence(nation, 200);
    while (!(game.ticks() - since >= 200 && myTurn())) step(game, nation);
    expect(c.session()).toBeNull();

    // Its first turn after the wait, with 70.
    setInfluence(nation, 70);
    step(game, nation);
    expect(c.session()).toBeNull();
    // The next turn a hair below 80.
    while (!myTurn()) step(game, nation);
    setInfluence(nation, 79, 999);
    step(game, nation);
    expect(c.session()).toBeNull();
    // And at 80.
    while (!myTurn()) step(game, nation);
    setInfluence(nation, 80);
    step(game, nation);
    expect(c.session()?.kind).toBe("emergency");
    expect(c.session()!.items[0]).toMatchObject({
      resolution: "emergency",
      targets: [red.smallID()],
      param: "aggression",
      reasonValue: nation.smallID(),
    });
    // Convening cost 50; its own yes is in.
    expect(nation.congress()!.ballot(c.session()!.id, 0)).toMatchObject({
      option: "A",
    });
  });

  test("a convener raises its own yes to what its policy wants, within the budget", async () => {
    for (const [points, extra] of [
      [200, 2], // a victim's half of Hard's cap
      [20, 1], // 14 to spend: +1 (10)
    ] as const) {
      const { game, red, nation } = await withNation("merchant");
      const c = congressOf(game);
      red.congress()!.recordTaken(game.ticks(), 600);
      nation.congress()!.recordHitBy(red.smallID(), game.ticks());
      for (let t = 0; t < 20 && c.available().length === 0; t++) {
        step(game, nation);
      }
      setInfluence(nation, 100);
      // Its yes goes in with the convening, without extra votes.
      expect(conveneEmergency(game, nation, "aggression", red)).toBeNull();
      const s = c.session()!;
      const pc = nation.congress()!;
      expect(pc.ballot(s.id, 0)).toMatchObject({ option: "A", extra: 0 });
      while (game.ticks() < s.openTick + aiVoteDelayTicks(nation.smallID())) {
        step(game, nation);
        expect(pc.ballot(s.id, 0)!.extra).toBe(0);
      }
      setInfluence(nation, points);
      step(game, nation);
      expect(pc.ballot(s.id, 0), `${points}`).toMatchObject({
        option: "A",
        extra,
      });
      expect(c.session()!.items[0].voters).toBe(1);
      // Raised once: nothing more later.
      for (let t = 0; t < 20; t++) step(game, nation);
      expect(pc.ballot(s.id, 0)!.extra).toBe(extra);
    }
  });

  test("a nation that wasn't hit doesn't convene on Medium; Easy never does", async () => {
    for (const difficulty of [Difficulty.Medium, Difficulty.Easy]) {
      const { game, red, nation } = await withNation("zealot", difficulty);
      const c = congressOf(game);
      red.congress()!.recordTaken(game.ticks(), 600);
      if (difficulty === Difficulty.Easy) {
        nation.congress()!.recordHitBy(red.smallID(), game.ticks());
      }
      setInfluence(nation, 300);
      for (let t = 0; t < 300; t++) step(game, nation);
      expect(c.available()).toHaveLength(1);
      expect(c.session()).toBeNull();
    }
  });

  test("an AI-only congress runs sessions for thousands of ticks without errors", async () => {
    const infos = (["conqueror", "merchant", "scholar", "zealot"] as const).map(
      nationOf,
    );
    const game = await congressGame({}, [RED, ...infos], "big_plains");
    own(game, RED.id, 0, 0, 40, 200);
    const execs = infos.map((info, i) => {
      own(game, info.id, 40 + i * 40, 0, 40, 200);
      const exec = new NationExecution(
        "game_x",
        new Nation(new Cell(60 + i * 40, 100), game.player(info.id).info()),
      );
      exec.init(game);
      return exec;
    });
    game.addExecution(new DomesticExecution());
    // Sessions open at 1,800 and 3,600 and are tallied at 2,100 and 3,900.
    expect(() => {
      for (let t = 0; t < 4000; t++) {
        for (const e of execs) e.tick(game.ticks());
        game.executeNextTick();
      }
    }).not.toThrow();
    const history = congressOf(game).history();
    expect(history.length).toBeGreaterThanOrEqual(4);
    expect(history.some((h) => h.a + h.b >= 2)).toBe(true);
  }, 120_000);
});
