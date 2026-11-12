// ww194 (Imjin leftovers): the Imjin courts sit on the 1936 ideology slots
// but are not 1936 governments. Their laws have no democracy's tension line
// and no trade law closed by the government, and their advisor seats take
// only the war's own people, no generic 1936 title cards.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { IDEO_COM, IDEO_DEM } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  lawBlock,
  type LawCtx,
} from "@openfront/engine-lib/ww1936/PoliticsRules";
import { lawBlock as econLawBlock } from "@openfront/engine/ww1936/economy/LawsRun";
import { ultimatumGovBlock } from "@openfront/engine/ww1936/endgame/Ultimatum";
import { candidatesFor } from "@openfront/engine/ww1936/politics/Advisors";
import { stabilityLines } from "@openfront/engine/ww1936/politics/Stability";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, warAfterPrep, wwRunner } from "../ww1936/util";

const PEACE: LawCtx = {
  wsBp: 6000,
  wtBp: 0,
  ruling: IDEO_DEM,
  atWar: false,
  ppMilli: 1_000_000,
  costMilli: 0,
};

describe("the Imjin courts' laws", () => {
  test("no tension line and no government-closed trade law with noGovGates", () => {
    // 1936: a democracy at peace needs the world's tension.
    expect(lawBlock("extensive", PEACE)).toBe("law_tension");
    expect(lawBlock("closed_economy", PEACE)).toBe("law_ideology");
    const com = { ...PEACE, ruling: IDEO_COM };
    expect(lawBlock("free_trade", com)).toBe("law_ideology");
    // Imjin: none of the three.
    expect(lawBlock("extensive", { ...PEACE, noGovGates: true })).toBeNull();
    expect(
      lawBlock("closed_economy", { ...PEACE, noGovGates: true }),
    ).toBeNull();
    expect(lawBlock("free_trade", { ...com, noGovGates: true })).toBeNull();
    // War support still gates.
    expect(
      lawBlock("service", { ...PEACE, wsBp: 1000, noGovGates: true }),
    ).toBe("law_ws");
  });
});

describe("the Imjin game", () => {
  const CONFIG: Partial<GameConfig> = {
    gameMap: GameMapType.Imjin1592,
    ww1936Scenario: "imjin1590",
    ww1936Designer: undefined,
  };

  test("the Westerners' court raises service without world tension; seats take only people", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    const g = r.game;
    const ww = g.worldWar()!;
    const jos = byTag(g, "JOS").smallID();
    // 1590: the Westerners hold the court (the 1936 democratic slot).
    expect(ww.politics.country(jos)!.ruling).toBe(IDEO_DEM);
    const ce = ww.economy.country(jos)!;
    expect(
      econLawBlock(ww.economy, ce, "conscription", "extensive", 0),
    ).not.toBe("law_tension");
    for (const t of ["JOS", "JPN", "MIN"] as const) {
      const c = candidatesFor(ww.politics, byTag(g, t).smallID(), 0);
      expect(c.length).toBeGreaterThan(0);
      expect(c.filter((a) => a.startsWith("title:"))).toEqual([]);
    }
  });

  test("the Westerners' court may send ultimatums and declare war without a goal, at no democracy's cost", async () => {
    const r = await wwRunner(CONFIG, [{ clientID: HUMAN }], "imjinmini");
    const g = r.game;
    const ww = g.worldWar()!;
    const jos = byTag(g, "JOS").smallID();
    const jpn = byTag(g, "JPN").smallID();
    expect(ww.politics.country(jos)!.ruling).toBe(IDEO_DEM);
    expect(ultimatumGovBlock(ww.endgame, jos)).toBeNull();
    // 1936 refused a democracy's war without a goal (democracy_no_goal).
    warAfterPrep(r, HUMAN, "JPN");
    expect(ww.isAtWar(jos, jpn)).toBe(true);
    expect(ww.politics.country(jos)!.ruling).toBe(IDEO_DEM);
    expect(
      stabilityLines(ww.politics, jos, "stab").map((l) => l.key),
    ).not.toContain("ww1936.pol.line.stab_offensive");
  });
});
