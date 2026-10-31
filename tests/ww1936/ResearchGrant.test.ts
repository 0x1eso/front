// Research grants (changes §6 idea 3): PP for a temporary research bonus.
import { WW_RESEARCH_GRANT } from "@openfront/engine-api/ww1936/EconomyTypes";
import { grantResearch } from "@openfront/engine/ww1936/economy/ResearchRun";
import { describe, expect, it } from "vitest";
import {
  byTag,
  gameHash,
  HUMAN,
  order,
  POL,
  step,
  wwRestore,
  wwRunner,
} from "./util";

describe("research_grant", () => {
  it("costs PP, adds one bonus to the sender's own country, is refused when held or broke, and survives snapshot and hash", async () => {
    const runner = await wwRunner(
      {},
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    step(runner);
    const g = runner.game;
    const econ = g.worldWar()!.economy;
    const pol = g.worldWar()!.politics;
    const deu = econ.country(byTag(g, "DEU").smallID())!;
    const c = pol.country(deu.smallID)!;
    c.researchBonuses = [];
    c.ppMilli = 500_000;
    // An AI country is refused, nothing is paid.
    const ai = econ.country(byTag(g, "POL").smallID())!;
    expect(grantResearch(econ, ai, "armour")).toBe("not_controlled");
    const h0 = gameHash(runner);
    step(runner, 1, [
      order(HUMAN, { kind: "research_grant", branch: "armour" }),
    ]);
    expect(c.researchBonuses).toEqual([
      {
        key: "armour",
        pct: WW_RESEARCH_GRANT.pct,
        uses: WW_RESEARCH_GRANT.uses,
      },
    ]);
    expect(c.ppMilli).toBeLessThan(
      500_000 - WW_RESEARCH_GRANT.pp * 1000 + 50_000,
    );
    expect(gameHash(runner)).not.toBe(h0);
    // Held, doctrine, broke.
    expect(grantResearch(econ, deu, "armour")).toBe("bonus_held");
    expect(grantResearch(econ, deu, "doctrine")).toBe("bad_index");
    c.ppMilli = 1000;
    expect(grantResearch(econ, deu, "air")).toBe("no_pp");
    expect(c.researchBonuses).toHaveLength(1);
    // Snapshot and hash.
    const back = await wwRestore(
      runner,
      [{ clientID: HUMAN, country: "DEU" }],
      POL,
    );
    expect(
      back.game.worldWar()!.politics.country(deu.smallID)!.researchBonuses,
    ).toEqual(c.researchBonuses);
    expect(gameHash(back)).toBe(gameHash(runner));
  });
});
