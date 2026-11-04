import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { worldWarVerdict } from "@openfront/engine/ww1936/Victory";
import { byTag, HUMAN, step, stepTo, wwRunner, wwRunnerCapture } from "./util";

describe("the end of the game (spec §7.6)", () => {
  test("nothing before 50:00 while three camps have majors", async () => {
    const g = (await wwRunner()).game;
    expect(worldWarVerdict(g, g.worldWar()!, 50 * 60 - 1)).toBeNull();
  });

  test("at 50:00 the best camp wins on score", async () => {
    const g = (await wwRunner()).game;
    const win = worldWarVerdict(g, g.worldWar()!, 50 * 60);
    expect(win?.winner).toBe("axis");
    expect(win?.reason).toBe("ww_score");
    expect(win?.camp.scoreBp).toBe(3005);
  });

  test("the timer ends the game by score at 50:00 (tick 30,000), not before", async () => {
    const { runner, updates } = await wwRunnerCapture({});
    const g = runner.game;
    expect(g.config().maxTimerMinutes()).toBe(50);
    stepTo(runner, 29_900);
    expect(g.getWinner()).toBeNull();
    stepTo(runner, 30_100);
    expect(g.getWinner()).not.toBeNull();
    const win = updates.flatMap((u) => u.updates[GameUpdateType.Win])[0];
    expect(win.reason).toBe("ww_score");
  }, 120_000);

  test("unlimited: no verdict on time while two camps live", async () => {
    const g = (await wwRunner({ ww1936Unlimited: true })).game;
    expect(g.config().wwUnlimited()).toBe(true);
    expect(worldWarVerdict(g, g.worldWar()!, 50 * 60)).toBeNull();
    expect(worldWarVerdict(g, g.worldWar()!, 10 * 3600)).toBeNull();
  });

  test.each([
    ["timed", {}],
    ["unlimited", { ww1936Unlimited: true }],
  ])(
    "%s: the last camp with a living major wins at once, as a team with its humans",
    async (name, config) => {
      const { runner, updates } = await wwRunnerCapture(config, [
        { clientID: HUMAN, country: "ITA" },
      ]);
      expect(runner.game.config().wwUnlimited()).toBe(name === "unlimited");
      const g = runner.game;
      const ww = g.worldWar()!;
      step(runner);
      for (const tag of ["GBR", "FRA", "SUN"] as const) {
        ww.addCapitulation(byTag(g, tag).smallID(), 0, g.ticks());
      }
      step(runner, 10);
      expect(g.getWinner()).toBe("axis");
      const win = updates.flatMap((u) => u.updates[GameUpdateType.Win])[0];
      expect(win.winner).toEqual(["team", "axis", HUMAN]);
      expect(win.reason).toBe("ww_last_camp");
    },
  );
});
