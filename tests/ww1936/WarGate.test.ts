import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { WW_PREP_TICKS } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import { TransportShipExecution } from "@openfront/engine/execution/TransportShipExecution";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  wwRunner,
  wwRunnerCapture,
} from "./util";

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

  // P2 (plan decision 7, spec §13.1): armies fight in this mode; every
  // tile attack and boat is refused before any troops move.
  test("no tile attack starts, on a neutral or on an enemy", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const deu = byTag(g, "DEU");
    const pol = byTag(g, "POL");
    const troops = deu.troops();
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(deu.outgoingAttacks()).toHaveLength(0);
    g.worldWar()!.setWar(deu.smallID(), pol.smallID(), g.ticks());
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(deu.outgoingAttacks()).toHaveLength(0);
    expect(deu.troops()).toBe(troops);
  });

  test("no boat sails, to a neutral or to an enemy", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const ww = g.worldWar()!;
    const gbr = byTag(g, "GBR");
    const ita = byTag(g, "ITA");
    ww.setWar(gbr.smallID(), ita.smallID(), g.ticks());
    const troops = gbr.troops();
    // From the island to Italy's south coast.
    g.addExecution(new TransportShipExecution(gbr, g.ref(65, 99), 1000));
    step(runner, 2);
    expect(gbr.units(UnitType.TransportShip)).toHaveLength(0);
    expect(gbr.troops()).toBe(troops);
    expect(g.ownerID(g.ref(65, 99))).toBe(ita.smallID());
  });

  test("a landing's attack refused at init gives its troops back", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const gbr = byTag(g, "GBR");
    const ita = byTag(g, "ITA");
    // What a boat or paradrop hands over: troops already taken (removeTroops
    // false), against a country it is not at war with.
    const landed = 5000;
    g.addExecution(
      new AttackExecution(landed, gbr, ita.id(), g.ref(65, 99), false),
    );
    const before = gbr.troops();
    step(runner);
    // Refunded at init, on top of one tick of regen.
    expect(gbr.troops() - before).toBeGreaterThanOrEqual(landed);
    expect(
      gbr.outgoingAttacks().filter((a) => a.target() === ita),
    ).toHaveLength(0);
    expect(g.ownerID(g.ref(65, 99))).toBe(ita.smallID());
  });

  test("a human's refused attack or boat is told once that armies fight here", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "GBR" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [gbr, pol, deu] = (["GBR", "POL", "DEU"] as const).map((t) =>
      byTag(g, t),
    );
    const notices = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
        .filter(
          (m) =>
            m.message === "events_display.ww1936_no_tile_attacks" ||
            m.message === "events_display.ww1936_not_at_war",
        )
        .map((m) => [m.message, m.playerID]);
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(gbr.smallID(), pol.smallID(), g.ticks());
    step(runner, 1, [
      stamped(HUMAN, { type: "attack", targetID: pol.id(), troops: 1000 }),
      stamped(HUMAN, { type: "boat", troops: 1000, dst: g.ref(105, 99) }),
      stamped(HUMAN, { type: "attack", targetID: deu.id(), troops: 1000 }),
    ]);
    step(runner, 2);
    expect(g.owner(g.ref(105, 99))).toBe(pol);
    expect(notices()).toEqual([
      ["events_display.ww1936_no_tile_attacks", gbr.smallID()],
    ]);
    // A nation hears nothing.
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(notices()).toHaveLength(1);
  });
});
