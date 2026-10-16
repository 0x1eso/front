import { straightFlightPath } from "@openfront/engine/warfare/FlightPath";
import { setup } from "../util/Setup";

describe("straightFlightPath", () => {
  test("one entry per tick, at most `speed` tiles apart, ending on the target", async () => {
    const game = await setup("plains");
    const path = straightFlightPath(game, game.ref(0, 0), game.ref(30, 40), 3);
    expect(path[0]).toBe(game.ref(0, 0));
    expect(path[path.length - 1]).toBe(game.ref(30, 40));
    expect(path).toHaveLength(18); // ceil(50 / 3) steps
    for (let i = 1; i < path.length; i++) {
      expect(
        game.euclideanDistSquared(path[i - 1], path[i]),
      ).toBeLessThanOrEqual(4 * 4);
    }
  });

  test("a straight line along an axis", async () => {
    const game = await setup("plains");
    const path = straightFlightPath(game, game.ref(10, 5), game.ref(40, 5), 3);
    expect(path.map((t) => game.x(t))).toEqual([
      10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40,
    ]);
    expect(path.every((t) => game.y(t) === 5)).toBe(true);
  });

  test("a flight to its own tile still takes one step", async () => {
    const game = await setup("plains");
    const t = game.ref(7, 7);
    expect(straightFlightPath(game, t, t, 3)).toEqual([t, t]);
  });
});
