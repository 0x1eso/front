import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import {
  declareWar,
  declareWarBlock,
  joinWar,
} from "@openfront/engine/ww1936/Diplomacy";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  wwRunner,
  wwRunnerCapture,
} from "./util";

describe("declarations of war (spec §7.3)", () => {
  test("no declaration during the preparation minute", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    step(runner);
    expect(
      declareWarBlock(g, ww, byTag(g, "DEU"), byTag(g, "POL"), g.ticks()),
    ).toBe("prep");
    stepTo(runner, WW_PREP_TICKS);
    expect(
      declareWarBlock(g, ww, byTag(g, "DEU"), byTag(g, "POL"), g.ticks()),
    ).toBeNull();
  });

  test("not on oneself, a faction member, an enemy or a capitulated country", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS);
    const [deu, ita, pol, sun] = ["DEU", "ITA", "POL", "SUN"].map((t) =>
      byTag(g, t as "DEU"),
    );
    const now = g.ticks();
    expect(declareWarBlock(g, ww, deu, deu, now)).toBe("self");
    expect(declareWarBlock(g, ww, deu, ita, now)).toBe("faction");
    declareWar(g, ww, deu, pol, now);
    expect(declareWarBlock(g, ww, deu, pol, now)).toBe("at_war");
    ww.addCapitulation(sun.smallID(), 0, now);
    expect(declareWarBlock(g, ww, deu, sun, now)).toBe("capitulated");
  });

  test("a declaration brings in the target's faction, never the attacker's", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS);
    const [deu, ita, fra, gbr] = ["DEU", "ITA", "FRA", "GBR"].map((t) =>
      byTag(g, t as "DEU"),
    );
    const joined = declareWar(g, ww, deu, fra, g.ticks());
    expect(joined).toEqual([fra.smallID(), gbr.smallID()]);
    expect(ww.isAtWar(deu.smallID(), gbr.smallID())).toBe(true);
    expect(ww.isAtWar(ita.smallID(), fra.smallID())).toBe(false);
    expect(ww.isAtWar(ita.smallID(), gbr.smallID())).toBe(false);
  });

  test("a join stays between the two", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    stepTo(runner, WW_PREP_TICKS);
    const [deu, ita, fra, gbr] = ["DEU", "ITA", "FRA", "GBR"].map((t) =>
      byTag(g, t as "DEU"),
    );
    expect(joinWar(g, ww, gbr, deu, g.ticks())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), deu.smallID())).toBe(true);
    expect(ww.isAtWar(gbr.smallID(), ita.smallID())).toBe(false);
    expect(ww.isAtWar(fra.smallID(), deu.smallID())).toBe(false);
    expect(joinWar(g, ww, gbr, deu, g.ticks())).toBe(false);
  });

  test("a human's declare_war intent starts the war and everyone hears of it", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "DEU" },
    ]);
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const fra = byTag(g, "FRA");
    step(runner, 2, [
      stamped(HUMAN, { type: "declare_war", target: fra.id() }),
    ]);
    expect(
      g.worldWar()!.isAtWar(byTag(g, "DEU").smallID(), fra.smallID()),
    ).toBe(true);
    const messages = updates.flatMap(
      (u) => u.updates[GameUpdateType.DisplayEvent],
    );
    const declared = messages.find(
      (m) => m.message === "events_display.ww1936_war_declared",
    );
    expect(declared?.params).toEqual({
      attackerTag: "DEU",
      targetTag: "FRA",
      allies: 1,
    });
    expect(declared?.playerID).toBeNull();
  });

  test("the player actions tell whether war can be declared", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "DEU" }]);
    const g = runner.game;
    const deu = byTag(g, "DEU");
    const at = (tag: "POL" | "ITA") => {
      const tile = byTag(g, tag).spawnTile()!;
      return runner.playerActions(deu.id(), g.x(tile), g.y(tile)).interaction
        ?.canDeclareWar;
    };
    step(runner);
    expect(at("POL")).toBe(false);
    stepTo(runner, WW_PREP_TICKS);
    expect(at("POL")).toBe(true);
    expect(at("ITA")).toBe(false);
  });
});
