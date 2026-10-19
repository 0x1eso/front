import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import type { Game, Player } from "@openfront/engine/game/Game";
import { byTag, step, stepTo, wwRunner } from "./util";

/** Every player-on-player attack running now, as "ATT>DEF" tags. */
function attacks(g: Game): string[] {
  const ww = g.worldWar()!;
  const out: string[] = [];
  for (const p of g.allPlayers()) {
    for (const a of p.outgoingAttacks()) {
      const t = a.target();
      if (t.isPlayer()) {
        out.push(
          `${ww.tagOf(p.smallID())}>${ww.tagOf((t as Player).smallID())}`,
        );
      }
    }
  }
  return out;
}

describe("nation AI in World War 1936 (spec 7.7)", () => {
  test("nations at peace attack nobody", async () => {
    const runner = await wwRunner({ historicalAi: false });
    for (let t = 0; t < 1500; t += 50) {
      step(runner, 50);
      expect(attacks(runner.game)).toEqual([]);
    }
  }, 60_000);

  test("a nation at war attacks its enemy and only its enemy", async () => {
    const runner = await wwRunner({ historicalAi: false });
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const seen = new Set<string>();
    for (
      let t = 0;
      t < 3000 && !seen.has("DEU>POL") && !seen.has("POL>DEU");
      t += 20
    ) {
      step(runner, 20);
      for (const a of attacks(g)) seen.add(a);
    }
    expect(seen.has("DEU>POL") || seen.has("POL>DEU")).toBe(true);
    for (const a of seen) expect(["DEU>POL", "POL>DEU"]).toContain(a);
  }, 60_000);
});
