// ww210 merge: Vienna's own business goes to the council of ministers while
// the Reichsrat is shut (the AUH law rows' `body`), so it doesn't wait on the
// agenda for a house that doesn't sit (the ww208 merge found AUH frozen).
import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { gwLawStart } from "@openfront/engine-api/ww1914/GwLaw";
import { houseStep } from "@openfront/engine/ww1914/House";
import { applyGwOrder } from "@openfront/engine/ww1914/Orders";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { NodeGameMapLoader } from "../perf/fullgame/NodeGameMapLoader";
import { newGame, startOf } from "./sim/GwSim";

describe("Austria's council bills with the Reichsrat shut", () => {
  test("a council bill is called and decided while the Reichsrat is shut", async () => {
    const map = await loadMapFiles(
      new NodeGameMapLoader(path.join(__dirname, "../../resources/maps")),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const runner = await newGame(
      map,
      startOf("auh-council", "full", [], "AUH"),
    );
    const gw = runner.game.greatWar()!;
    const { gwChapters } =
      await import("@openfront/engine-lib/ww1914/Calendars");
    gw.s.chapter =
      gwChapters(gw.s.calendar).findIndex((c) => c.spanDays >= 28) + 2;
    houseStep(gw);
    const seat = gw.s.seats.find((x) => x.tag === "AUH")!;
    seat.desk = [];
    const n = gw.nation("AUH")!;
    n.inst.council = 3;
    const onAgenda = (id: string) => {
      n.laws = n.laws.filter((x) => x.id !== id);
      const st = {
        ...gwLawStart(id),
        stage: "persuade" as const,
        since: gw.s.chapter - 1,
      };
      n.laws.push(st);
      return st;
    };
    const call = (law: string) =>
      applyGwOrder(gw, seat, { kind: "bill_vote", law, confidence: false });

    // Old-age insurance sits with the council (`body: council`); the
    // Reichsrat is shut from March 1914.
    const ins = onAgenda("auh_insurance");
    expect(call("auh_insurance")).toBe(null);
    expect(ins.stage).toBe("force");
    expect(ins.how).toBe("voted");
  }, 120_000);
});
