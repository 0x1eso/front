import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { byTag, step, stepTo, wwRunner } from "./util";

describe("only enemies fight (spec §7.2)", () => {
  test("faction members are friends, neutrals are not", async () => {
    const g = (await wwRunner()).game;
    const deu = byTag(g, "DEU");
    expect(deu.isFriendly(byTag(g, "ITA"))).toBe(true);
    expect(deu.isFriendly(byTag(g, "FRA"))).toBe(false);
    expect(byTag(g, "GBR").isFriendly(byTag(g, "FRA"))).toBe(true);
  });

  test("a war cannot be fought during the preparation minute", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), 0);
    step(runner, 2);
    expect(deu.canAttackPlayer(pol)).toBe(false);
    stepTo(runner, WW_PREP_TICKS);
    expect(deu.canAttackPlayer(pol)).toBe(true);
  });

  test("neutrals and faction members cannot be attacked, enemies can", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    expect(deu.canAttackPlayer(byTag(g, "FRA"))).toBe(false);
    expect(deu.canAttackPlayer(byTag(g, "ITA"))).toBe(false);
    g.worldWar()!.setWar(deu.smallID(), byTag(g, "FRA").smallID(), g.ticks());
    expect(deu.canAttackPlayer(byTag(g, "FRA"))).toBe(true);
    expect(byTag(g, "FRA").canAttackPlayer(deu)).toBe(true);
  });

  test("an attack on a neutral never starts; on an enemy it does", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(
      deu.outgoingAttacks().filter((a) => a.target() === pol),
    ).toHaveLength(0);
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(
      deu.outgoingAttacks().filter((a) => a.target() === pol).length,
    ).toBeGreaterThan(0);
  });
});
