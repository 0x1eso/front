import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { worldWarVerdict } from "@openfront/engine/ww1936/Victory";
import { byTag, HUMAN, step, wwRunner, wwRunnerCapture } from "./util";

describe("the end of the game (spec §7.6)", () => {
  test("nothing before 45:00 while three camps have majors", async () => {
    const g = (await wwRunner()).game;
    expect(worldWarVerdict(g, g.worldWar()!, 45 * 60 - 1)).toBeNull();
  });

  test("at 45:00 the best camp wins on score", async () => {
    const g = (await wwRunner()).game;
    const win = worldWarVerdict(g, g.worldWar()!, 45 * 60);
    expect(win?.winner).toBe("axis");
    expect(win?.reason).toBe("ww_score");
    expect(win?.camp.scoreBp).toBe(3005);
  });

  test("unlimited: no verdict on time while two camps live", async () => {
    const g = (await wwRunner({ ww1936Unlimited: true })).game;
    expect(g.config().wwUnlimited()).toBe(true);
    expect(worldWarVerdict(g, g.worldWar()!, 45 * 60)).toBeNull();
    expect(worldWarVerdict(g, g.worldWar()!, 10 * 3600)).toBeNull();
  });

  test.each([
    ["timed", {}],
    ["unlimited", { ww1936Unlimited: true }],
  ])(
    "%s: the last camp with a living major wins at once, as a team with its humans",
    async (_name, config) => {
      const { runner, updates } = await wwRunnerCapture(config, [
        { clientID: HUMAN, country: "ITA" },
      ]);
      expect(runner.game.config().wwUnlimited()).toBe(_name === "unlimited");
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
