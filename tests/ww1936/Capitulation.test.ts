import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  WW_PREP_TICKS,
  WW_TRANSFER_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
import {
  checkCapitulations,
  controlledVp,
  heldStartVp,
  pickVictor,
} from "@openfront/engine/ww1936/Capitulation";
import {
  byTag,
  HUMAN,
  stamped,
  step,
  stepTo,
  wwRunner,
  wwRunnerCapture,
} from "./util";

/** The VP tile of the named region on the test map. */
function vpTileOf(g: Game, name: string): number {
  const s = g.worldWar()!.scenario;
  const r = s.landRegions.find((x) => x.name === name)!;
  return s.vpTile(r);
}

/**
 * Earlier transfers that use up `tiles` of the next tick's transfer budget:
 * some of a's land goes to b and back. a keeps its VP tiles (so nobody's
 * points change) and enough land to stay alive.
 */
function queueBacklog(g: Game, a: Player, b: Player, tiles: number): void {
  const ww = g.worldWar()!;
  const vpTiles = new Set(
    ww.scenario.landRegions.map((r) => ww.scenario.vpTile(r)),
  );
  const own = Uint32Array.from([...a.tiles()].filter((t) => !vpTiles.has(t)));
  const moving = own.subarray(0, own.length - 10);
  for (let toB = true; tiles > 0; toB = !toB) {
    const leg = moving.subarray(0, Math.min(tiles, moving.length));
    if (toB) ww.queueTransfer(a.smallID(), b.smallID(), leg);
    else ww.queueTransfer(b.smallID(), a.smallID(), leg);
    tiles -= leg.length;
  }
}

/** Runs to the start of the next day after now (the daily check runs then). */
function nextDay(runner: Awaited<ReturnType<typeof wwRunner>>): void {
  const ww = runner.game.worldWar()!;
  stepTo(
    runner,
    dayStartTick(ww.day(runner.game.ticks()) + 1, WW_PREP_TICKS) + 1,
  );
}

describe("victory points and capitulation (spec §7.5)", () => {
  test("at the start everyone controls exactly its own points", async () => {
    const g = (await wwRunner()).game;
    const ww = g.worldWar()!;
    const vp = controlledVp(g, ww);
    for (const p of g.allPlayers()) {
      expect(vp[p.smallID()]).toBe(ww.startVp(p.smallID()));
      expect(heldStartVp(g, ww, p.smallID())).toBe(ww.startVp(p.smallID()));
    }
    expect(ww.startVp(byTag(g, "POL").smallID())).toBe(24);
  });

  test("losing 80% of its starting points makes a country capitulate", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Krakow"));
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(false); // 3 of 24 lost
    deu.conquer(vpTileOf(g, "Warsaw"));
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(ww.isAtWar(deu.smallID(), pol.smallID())).toBe(false);
    expect(pol.outgoingAttacks()).toEqual([]);
    expect(ww.data().capitulated).toEqual([
      expect.objectContaining({
        smallID: pol.smallID(),
        victor: deu.smallID(),
      }),
    ]);
    const capitulated = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .find((m) => m.message === "events_display.ww1936_capitulated");
    expect(capitulated?.params).toEqual({ loserTag: "POL", victorTag: "DEU" });
  });

  test("the land moves to the victor; the conquest is settled once, when the last tile moves", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    const warsaw = vpTileOf(g, "Warsaw");
    const krakow = vpTileOf(g, "Krakow");
    nextDay(runner);
    step(runner, 3);
    expect(pol.isAlive()).toBe(false);
    expect(pol.numTilesOwned()).toBe(0);
    expect(g.owner(warsaw)).toBe(deu);
    expect(g.owner(krakow)).toBe(deu);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id());
    expect(conquests).toHaveLength(1);
  });

  test("tiles someone else took are skipped", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = [byTag(g, "DEU"), byTag(g, "POL"), byTag(g, "SUN")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    const krakow = vpTileOf(g, "Krakow");
    sun.conquer(krakow);
    deu.conquer(vpTileOf(g, "Warsaw"));
    nextDay(runner);
    step(runner, 3);
    expect(g.owner(krakow)).toBe(sun);
    expect(pol.isAlive()).toBe(false);
  });

  test("the victor is the enemy holding most of its points", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = [byTag(g, "DEU"), byTag(g, "POL"), byTag(g, "SUN")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    sun.conquer(vpTileOf(g, "Krakow"));
    expect(pickVictor(g, ww, pol)).toBe(sun);
    deu.conquer(vpTileOf(g, "Warsaw"));
    expect(pickVictor(g, ww, pol)).toBe(deu);
  });

  test("what a capitulated country holds counts for its victor", async () => {
    const runner = await wwRunner();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun, fra] = (["DEU", "POL", "SUN", "FRA"] as const).map(
      (t) => byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    ww.addCapitulation(deu.smallID(), fra.smallID(), g.ticks());
    ww.endWarsOf(deu.smallID());
    expect(pickVictor(g, ww, pol)).toBe(fra);
    // An enemy still comes first.
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    sun.conquer(vpTileOf(g, "Krakow"));
    expect(pickVictor(g, ww, pol)).toBe(sun);
  });

  test("land on its way to a country that capitulates goes on to its victor", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, fra, ita, gbr] = (
      ["DEU", "POL", "FRA", "ITA", "GBR"] as const
    ).map((t) => byTag(g, t));
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(fra.smallID(), deu.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    const left = 50;
    queueBacklog(
      g,
      ita,
      gbr,
      WW_TRANSFER_TILES_PER_TICK - pol.numTilesOwned() + left,
    );
    step(runner);
    expect(pol.numTilesOwned()).toBe(left);

    // Germany falls while Poland's last land is still on its way to it.
    fra.conquer(vpTileOf(g, "Berlin"));
    checkCapitulations(g, ww, g.ticks());
    step(runner, 3);
    expect(ww.data().capitulated).toEqual([
      expect.objectContaining({
        smallID: pol.smallID(),
        victor: deu.smallID(),
      }),
      expect.objectContaining({
        smallID: deu.smallID(),
        victor: fra.smallID(),
      }),
    ]);
    expect(pol.isAlive()).toBe(false);
    expect(deu.isAlive()).toBe(false);
    expect(g.owner(vpTileOf(g, "Krakow"))).toBe(fra);
    expect(g.owner(vpTileOf(g, "Warsaw"))).toBe(fra);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id() || c.conqueredId === deu.id());
    expect(conquests).toEqual([
      expect.objectContaining({ conqueredId: pol.id(), conquerorId: fra.id() }),
      expect.objectContaining({ conqueredId: deu.id(), conquerorId: fra.id() }),
    ]);
  });

  test("a human whose country capitulates is left watching", async () => {
    const runner = await wwRunner({}, [{ clientID: HUMAN, country: "POL" }]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    nextDay(runner);
    step(runner, 3);
    expect(g.playerByClientID(HUMAN)!.isAlive()).toBe(false);
    expect(g.getWinner()).toBeNull();
  });

  test("an attack running on the loser ends at its capitulation; only the victor settles it", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "SUN" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun, fra, gbr] = (
      ["DEU", "POL", "SUN", "FRA", "GBR"] as const
    ).map((t) => byTag(g, t));
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    const day = ww.day(g.ticks()) + 1;
    stepTo(runner, dayStartTick(day, WW_PREP_TICKS) - 4);
    step(runner, 1, [
      stamped(HUMAN, {
        type: "attack",
        targetID: pol.id(),
        troops: sun.troops(),
      }),
    ]);
    stepTo(runner, dayStartTick(day, WW_PREP_TICKS));
    const attack = sun.outgoingAttacks().find((a) => a.target() === pol)!;
    expect(attack.troops()).toBeGreaterThan(0);
    expect(ww.isCapitulated(pol.smallID())).toBe(false);

    // Poland's land moves over two ticks, Poland nearly gone after the first.
    const left = 50;
    queueBacklog(
      g,
      fra,
      gbr,
      WW_TRANSFER_TILES_PER_TICK - pol.numTilesOwned() + left,
    );
    const sunTroops = sun.troops() + attack.troops();

    step(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(pol.numTilesOwned()).toBe(left);
    expect(pol.incomingAttacks()).toEqual([]);
    expect(sun.outgoingAttacks()).toEqual([]);
    expect(sun.troops()).toBeGreaterThanOrEqual(sunTroops);
    const sunTiles = sun.numTilesOwned();

    step(runner, 3);
    expect(pol.isAlive()).toBe(false);
    expect(sun.numTilesOwned()).toBe(sunTiles);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id());
    expect(conquests).toEqual([
      expect.objectContaining({ conquerorId: deu.id() }),
    ]);
  });
});
