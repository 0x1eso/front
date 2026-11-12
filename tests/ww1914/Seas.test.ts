// ww190 §9: who holds a sea, derived from the state.
import type { GwTag } from "@openfront/engine-api/ww1914/GwCountries";
import { createGameRunner } from "@openfront/engine/GameRunner";
import type { GreatWar } from "@openfront/engine/ww1914/GreatWar";
import { moveLand } from "@openfront/engine/ww1914/Land";
import { seaHold, seaHolds } from "@openfront/engine/ww1914/Seas";
import { enter, openGeneral } from "@openfront/engine/ww1914/Wars";
import { describe, expect, test } from "vitest";
import { realMap } from "./realMap";
import { startOf } from "./sim/GwSim";

async function world(id: string, seat?: GwTag): Promise<GreatWar> {
  const start =
    seat === undefined
      ? { ...startOf(id, "full", []), players: [] }
      : startOf(id, "full", [], seat);
  const runner = await createGameRunner(start, undefined, realMap(), () => {});
  for (let t = 0; t < 2; t++) {
    runner.addTurn({ turnNumber: t, intents: [] });
    runner.executeNextTick();
  }
  return runner.game.greatWar()!;
}

describe("the seas", () => {
  test("each sea's holder follows the lines, the ports and who is still in", async () => {
    const gw = await world("GWSEAS1", "RUS");
    const seat = gw.s.seats[0];
    openGeneral(gw, "DEU", "RUS", "test");

    // The North Sea: the sea line, short of the Channel the entente's.
    expect(seaHold(gw, "north")).toBe("entente");
    const sea = gw.s.theatres.find((t) => t.id === "sea")!;
    sea.since = gw.s.chapter;
    sea.line = 2;
    expect(seaHold(gw, "north")).toBe("central");

    // The Black Sea: the Ottomans in, the straits shut, theirs.
    enter(gw, "OTT", "central", "test");
    expect(seaHold(gw, "black")).toBe("central");
    expect(
      seaHolds(gw, seat, { is: "sea_hold", sea: "black", by: "foe" }),
    ).toBe(true);
    const straits = gw.s.theatres.find((t) => t.id === "straits")!;
    straits.line = 2;
    expect(seaHold(gw, "black")).toBe("entente");
    expect(seaHolds(gw, seat, { is: "sea_hold", sea: "black", by: "us" })).toBe(
      true,
    );
    moveLand(gw, "sevastopol", "DEU", null, "occupation");
    expect(seaHold(gw, "black")).toBe("central");

    // The Adriatic: Italy on the entente's side and Valona in its hands.
    if (gw.nation("AUH")!.side === null) enter(gw, "AUH", "central", "test");
    expect(seaHold(gw, "adriatic")).toBe("central");
    // Italy came in with its allies here; the sea reads its side, as in 1915.
    gw.nation("ITA")!.side = "entente";
    moveLand(gw, "valona", "ITA", null, "occupation");
    expect(seaHold(gw, "adriatic")).toBe("entente");

    // The Mediterranean: the entente's until the submarines cost too much.
    expect(seaHold(gw, "med")).toBe("entente");
    gw.s.shipping = 6;
    expect(seaHold(gw, "med")).toBe("central");
    expect(seaHolds(gw, seat, { is: "sea_hold", sea: "med", by: "none" })).toBe(
      false,
    );
  });
});
