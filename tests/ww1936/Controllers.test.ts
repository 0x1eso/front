// World War 1936 P5 (spec §3.6, plan decision 7): who controls a country.
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { GameImpl } from "@openfront/engine/game/GameImpl";
import { usePoliticsContent } from "@openfront/engine/ww1936/politics/ContentSource";
import { endId } from "./endFixture";
import { endgameFixture } from "./endgameFixture";
import { END_MAP, step, stepTo, wwRestore, wwRunner } from "./util";

beforeEach(() => usePoliticsContent(endgameFixture()));
afterEach(() => usePoliticsContent(null));

const A = "HUMANAAA";
const B = "HUMANBBB";
const HUMANS = [
  { clientID: A, country: "POL" as const },
  { clientID: B, country: "CSK" as const },
];

describe("World War 1936 P5: controllers", () => {
  it("isHumanControlled follows controllerOf", async () => {
    const runner = await wwRunner({}, HUMANS, END_MAP);
    const ww = runner.game.worldWar()!;
    const eg = ww.endgame;
    const [pl, csk, aut] = [endId("POL"), endId("CSK"), endId("AUT")];
    expect([pl, csk, aut].map((id) => ww.isHumanControlled(id))).toEqual([
      true,
      true,
      false,
    ]);
    expect(eg.controlledBy(A)).toBeNull();
    eg.setControl(A, aut);
    expect([pl, csk, aut].map((id) => ww.isHumanControlled(id))).toEqual([
      false,
      true,
      true,
    ]);
    expect(eg.humanClientOf(aut)).toBe(A);
    expect(eg.controlledBy(A)).toBe(aut);
    expect(runner.game.playerByClientID(A)!.smallID()).toBe(aut);
    expect(runner.game.playerByClientID(B)!.smallID()).toBe(csk);
    // Sorted by clientID string.
    eg.setControl(B, pl);
    expect(eg.controllerOf).toEqual([
      [A, aut],
      [B, pl],
    ]);
  });

  it("a spectator controls nothing and playerByClientID is null", async () => {
    const runner = await wwRunner({}, HUMANS, END_MAP);
    const ww = runner.game.worldWar()!;
    ww.endgame.setControl(A, 0);
    expect(ww.endgame.controlledBy(A)).toBe(0);
    expect(runner.game.playerByClientID(A)).toBeNull();
    expect(ww.isHumanControlled(endId("POL"))).toBe(false);
    // Its country plays on as an AI.
    expect(ww.isActor(endId("POL"))).toBe(true);
  });

  it("the winners are the current controllers (a takeover onto the winning side)", async () => {
    const runner = await wwRunner(
      {},
      [...HUMANS, { clientID: "HUMANGBR", country: "GBR" as const }],
      END_MAP,
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    expect(ww.factionMembers("allies")).toContain(endId("FRA"));
    expect(ww.humanClientIDsOf("allies")).toEqual(["HUMANGBR"]);
    // POL's human takes France over; Britain's human spectates.
    ww.endgame.setControl(A, endId("FRA"));
    ww.endgame.setControl("HUMANGBR", 0);
    expect(ww.humanClientIDsOf("allies")).toEqual([A]);
    expect((g as GameImpl).makeWinner("allies")).toEqual(["team", "allies", A]);
  });

  it("controllerOf survives a snapshot", async () => {
    const runner = await wwRunner({}, HUMANS, END_MAP);
    stepTo(runner, WW_PREP_TICKS + 2);
    const ww = runner.game.worldWar()!;
    ww.endgame.setControl(A, endId("AUT"));
    step(runner);
    const b = await wwRestore(runner, HUMANS, END_MAP);
    const eg = b.game.worldWar()!.endgame;
    expect(eg.controllerOf).toEqual([[A, endId("AUT")]]);
    expect(eg.isHumanControlled(endId("AUT"))).toBe(true);
    expect(eg.isHumanControlled(endId("POL"))).toBe(false);
    expect(b.game.playerByClientID(A)!.smallID()).toBe(endId("AUT"));
  });
});
