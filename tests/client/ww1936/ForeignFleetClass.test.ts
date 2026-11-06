// ww122: another major's fleet shows its catalogue classes, not plain generics.
import { histOwn } from "@openfront/engine-lib/ww1936/hist/Slots";
import { describe, expect, it } from "vitest";

import {
  fleetNumbers,
  navyCtx,
  NavyGame,
} from "../../../src/client/hud/ww1936/NavyModel";
import { fleet, seaGame, SID } from "./SeaAirFixture";

describe("another major's fleet (ww122)", () => {
  const own = histOwn("DEU", "ship");
  const slot = own.findIndex((e) => e.family === "ship" && e.cls === "bb") + 1;
  const g = seaGame({
    fleets: [
      fleet({ id: 9, owner: SID("DEU"), counts: [0, 0, 0, 0, 1, 0, 0] }),
      fleet({
        id: 10,
        owner: SID("DEU"),
        counts: [0, 0, 0, 0, 1, 0, 0],
        designs: [slot],
      }),
    ],
  });
  const ctx = navyCtx(g.game as unknown as NavyGame)!;
  it("a design slot lifts the numbers over the plain class", () => {
    expect(slot).toBeGreaterThan(0);
    const plain = fleetNumbers(ctx, g.navy.fleets.get(9)!);
    const real = fleetNumbers(ctx, g.navy.fleets.get(10)!);
    expect(real.power).not.toBe(plain.power);
  });
});
