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

  test("a boat whose war ended at sea takes no tile and gives its troops back", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    stepTo(runner, WW_PREP_TICKS);
    const ww = g.worldWar()!;
    const gbr = byTag(g, "GBR");
    const ita = byTag(g, "ITA");
    ww.setWar(gbr.smallID(), ita.smallID(), g.ticks());
    // From the island to Italy's south coast.
    const sent = Math.floor(gbr.troops() / 2);
    g.addExecution(new TransportShipExecution(gbr, g.ref(65, 99), sent));
    step(runner, 2);
    const boats = () => gbr.units(UnitType.TransportShip);
    expect(boats()).toHaveLength(1);
    const boatTroops = boats()[0].troops();
    expect(boatTroops).toBeGreaterThan(0);
    // Peace on the way (a capitulation ends every war of the loser).
    ww.endWarsOf(ita.smallID());
    const gbrTiles = gbr.numTilesOwned();
    const itaTiles = ita.numTilesOwned();
    let landing = 0;
    for (let i = 0; i < 600 && boats().length > 0; i++) {
      const before = gbr.troops();
      step(runner);
      landing = gbr.troops() - before;
    }
    expect(boats()).toHaveLength(0);
    // No tile taken from a country it is no longer at war with.
    expect(g.ownerID(g.ref(65, 99))).toBe(ita.smallID());
    expect(gbr.numTilesOwned()).toBe(gbrTiles);
    expect(ita.numTilesOwned()).toBe(itaTiles);
    // The whole boat came back (plus one tick of regen).
    expect(landing).toBeGreaterThanOrEqual(boatTroops);
    expect(
      gbr.outgoingAttacks().filter((a) => a.target() === ita),
    ).toHaveLength(0);
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

  test("a human's refused attack or boat tells them they are not at war", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "GBR" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [gbr, pol, fra, deu] = (["GBR", "POL", "FRA", "DEU"] as const).map(
      (t) => byTag(g, t),
    );
    const refusals = () =>
      updates
        .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
        .filter((m) => m.message === "events_display.ww1936_not_at_war")
        .map((m) => [m.playerID, m.params]);
    // A war waiting for the preparation minute is no refusal of this kind.
    ww.setWar(gbr.smallID(), deu.smallID(), 0);
    step(runner, 1, [
      stamped(HUMAN, { type: "attack", targetID: deu.id(), troops: 1000 }),
    ]);
    step(runner, 2);
    expect(refusals()).toEqual([]);
    stepTo(runner, WW_PREP_TICKS + 1);
    step(runner, 1, [
      stamped(HUMAN, { type: "attack", targetID: pol.id(), troops: 1000 }),
      stamped(HUMAN, { type: "boat", troops: 1000, dst: g.ref(105, 99) }),
      // A faction friend: refused as an ally is, without this line.
      stamped(HUMAN, { type: "attack", targetID: fra.id(), troops: 1000 }),
    ]);
    step(runner, 2);
    expect(g.owner(g.ref(105, 99))).toBe(pol);
    expect(refusals()).toEqual([
      [gbr.smallID(), { nameTag: "POL" }],
      [gbr.smallID(), { nameTag: "POL" }],
    ]);
    // A nation hears nothing.
    g.addExecution(new AttackExecution(1000, deu, pol.id(), null));
    step(runner, 2);
    expect(refusals()).toHaveLength(2);
  });
});
