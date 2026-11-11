// ww177 (Imjin design §13): the Imjin profile's pinned game. It moves with
// every change to the profile's rules or content: re-pin it here when that
// is intended. Never WW1936_DIGEST for this.
import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import type { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { byTag, HUMAN, step, wwRunner } from "../ww1936/util";

const MAP = "imjinmini";
const CONFIG: Partial<GameConfig> = {
  gameMap: GameMapType.Imjin1592,
  ww1936Scenario: "imjin1590",
  ww1936Designer: undefined,
};
const HUMANS = [{ clientID: HUMAN }];
const hash = (r: { game: unknown }) => (r.game as { hash(): number }).hash();

// Re-pinned at the ww177 merge 1 with two equal runs (imjinmini, 3,000 ticks).
const IMJIN_DIGEST = "8e0e33086bfd32c9";

async function imjinRunner() {
  return wwRunner(CONFIG, HUMANS, MAP);
}

describe("the Imjin profile", () => {
  test("the start: two seats, no factions, the profile's armies and calendar", async () => {
    const r = await imjinRunner();
    const g = r.game;
    const ww = g.worldWar()!;
    expect(ww.imjin).toBe(true);
    expect(byTag(g, "JOS").clientID()).toBe(HUMAN);
    expect(byTag(g, "MIN").clientID()).toBeNull();
    for (const t of ["JOS", "JPN", "MIN", "JUR"] as const) {
      const id = byTag(g, t).smallID();
      expect(ww.factionOf(id)).toBeNull();
      expect(ww.land.country(id)!.generals).toEqual([]);
    }
    expect(
      ww.isAtWar(byTag(g, "JPN").smallID(), byTag(g, "JOS").smallID()),
    ).toBe(false);
    expect([...ww.economy.rail].every((v) => v === 0)).toBe(true);
    expect(ww.economy.country(byTag(g, "JPN").smallID())!.laws.economy).toBe(
      "partial_mobilization",
    );
    expect(ww.imjinStart).toBe("y1590");
  });

  test("switched-off systems refuse their orders", async () => {
    const r = await imjinRunner();
    const g = r.game;
    step(r, WW_PREP_TICKS + 2);
    const ww = g.worldWar()!;
    const jos = byTag(g, "JOS");
    expect(
      ww.depth.issue(jos.smallID(), { kind: "intel_found" } as never, 0),
    ).toBe("system_off");
    expect(
      ww.depth.issue(
        jos.smallID(),
        { kind: "market_unlist", listing: 0 } as never,
        0,
      ),
    ).toBe("system_off");
  });

  test("a short war's digest is pinned and repeats", async () => {
    const play = async () => {
      const r = await imjinRunner();
      const jpn = byTag(r.game, "JPN").smallID();
      const jos = byTag(r.game, "JOS").smallID();
      const h = createHash("sha256");
      while (r.game.ticks() < 3_000) {
        const t = r.game.ticks();
        // Japan (the AI) is at war from the first day; Joseon's human idles.
        if (t === WW_PREP_TICKS + 1) {
          r.game.worldWar()!.setWar(jpn, jos, t);
        }
        step(r);
        h.update(`${hash(r)},`);
      }
      return h.digest("hex").slice(0, 16);
    };
    const first = await play();
    expect(await play()).toBe(first);
    expect(first).toBe(IMJIN_DIGEST);
  }, 120_000);
});
