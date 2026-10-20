import {
  GameMapSize,
  GameMapType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
  WW_TRANSFER_TILES_PER_TICK,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import { AttackExecution } from "@openfront/engine/execution/AttackExecution";
import type { Execution, Game, Player } from "@openfront/engine/game/Game";
import { createGameRunner } from "@openfront/engine/GameRunner";
import {
  checkCapitulations,
  controlledVp,
  heldStartVp,
  pickVictor,
} from "@openfront/engine/ww1936/Capitulation";
import { loadMapFiles } from "@openfront/shared/GameMapLoader";
import { TestDataMapLoader } from "../util/ScriptedGame";
import {
  byTag,
  HUMAN,
  MINI,
  stamped,
  step,
  stepTo,
  wwGameStart,
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

/**
 * Fills `p`'s capitulation gauge to one short of full, so the next daily
 * check that finds it past its surrender line makes it capitulate.
 */
function nearlyFull(g: Game, p: Player): void {
  g.worldWar()!.setCapitulationGauge(p.smallID(), WW_CAPITULATION_DAYS - 1);
}

/** Runs to the start of the next day after now (the daily check runs then). */
function nextDay(runner: Awaited<ReturnType<typeof wwRunner>>): void {
  const ww = runner.game.worldWar()!;
  stepTo(
    runner,
    dayStartTick(ww.day(runner.game.ticks()) + 1, WW_PREP_TICKS) + 1,
  );
}

/** Germany and Poland played by humans who do nothing. */
const HUMAN_DEU_POL = [
  { clientID: HUMAN, country: "DEU" as const },
  { clientID: "HUMAN002", country: "POL" as const },
];

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

  test("a country 80% of whose points are held for 30 days capitulates", async () => {
    // Both humans: no AI takes a point back meanwhile.
    const { runner, updates } = await wwRunnerCapture({}, HUMAN_DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Krakow"));
    nextDay(runner);
    // 3 of 24 lost: below the line.
    expect(ww.capitulationGauge(pol.smallID())).toBe(0);
    deu.conquer(vpTileOf(g, "Warsaw"));
    // Held briefly, then for 29 days: the gauge fills, no capitulation yet.
    for (let day = 1; day < WW_CAPITULATION_DAYS; day++) {
      nextDay(runner);
      expect(ww.capitulationGauge(pol.smallID())).toBe(day);
      expect(ww.isCapitulated(pol.smallID())).toBe(false);
    }
    expect(ww.data().gauges).toEqual([
      { smallID: pol.smallID(), days: WW_CAPITULATION_DAYS - 1 },
    ]);
    // The 30th day in a row past the line.
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(ww.capitulationGauge(pol.smallID())).toBe(0);
    expect(ww.data().gauges).toEqual([]);
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

  test("a country that starts with no points never capitulates", async () => {
    // The scenario allows regions worth 0 (spec §7.5): a country whose
    // regions are all worth 0 has no surrender line to cross.
    const files = await loadMapFiles(
      new TestDataMapLoader(MINI),
      GameMapType.World1936,
      GameMapSize.Normal,
    );
    const scenario = structuredClone(files.scenario!);
    for (const r of scenario.regions) if (r.owner === "POL") r.vp = 0;
    const runner = await createGameRunner(
      wwGameStart(),
      undefined,
      { ...files, scenario },
      (gu) => {
        if ("errMsg" in gu) throw new Error(gu.errMsg);
      },
    );
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    expect(ww.startVp(pol.smallID())).toBe(0);
    expect(ww.startVp(deu.smallID())).toBe(25);
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    // Every region's point tile is lost, which makes any other country
    // capitulate.
    deu.conquer(vpTileOf(g, "Warsaw"));
    deu.conquer(vpTileOf(g, "Krakow"));
    nextDay(runner);
    nextDay(runner);
    checkCapitulations(g, ww, g.ticks());
    expect(ww.isCapitulated(pol.smallID())).toBe(false);
    expect(ww.data().capitulated).toEqual([]);
    expect(ww.isAtWar(deu.smallID(), pol.smallID())).toBe(true);
    expect(pol.isAlive()).toBe(true);
  });

  test("a recovery empties the gauge a day at a time, and the end of its wars empties it", async () => {
    const runner = await wwRunner({}, HUMAN_DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    const warsaw = vpTileOf(g, "Warsaw");
    deu.conquer(warsaw);
    for (let day = 0; day < 5; day++) nextDay(runner);
    expect(ww.capitulationGauge(pol.smallID())).toBe(5);
    // Poland takes Warsaw back: one day off per day.
    pol.conquer(warsaw);
    nextDay(runner);
    expect(ww.capitulationGauge(pol.smallID())).toBe(4);
    nextDay(runner);
    expect(ww.capitulationGauge(pol.smallID())).toBe(3);
    // Lost again: it fills from there.
    deu.conquer(warsaw);
    nextDay(runner);
    expect(ww.capitulationGauge(pol.smallID())).toBe(4);
    expect(ww.data().gauges).toEqual([{ smallID: pol.smallID(), days: 4 }]);
    // Its only war ends (as Germany's capitulation would end it).
    ww.endWarsOf(deu.smallID());
    nextDay(runner);
    expect(ww.capitulationGauge(pol.smallID())).toBe(0);
    expect(ww.data().gauges).toEqual([]);
    for (let day = 0; day < WW_CAPITULATION_DAYS; day++) nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(false);
  });

  test("an attack of the loser that is already retreating finishes its retreat", async () => {
    const runner = await wwRunner({}, HUMAN_DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    step(runner, 1, [
      stamped("HUMAN002", {
        type: "attack",
        targetID: deu.id(),
        troops: Math.floor(pol.troops() / 4),
      }),
    ]);
    step(runner, 2);
    const [attack] = pol.outgoingAttacks();
    step(runner, 1, [
      stamped("HUMAN002", { type: "cancel_attack", attackID: attack.id() }),
    ]);
    step(runner);
    expect(attack.retreating()).toBe(true);
    deu.conquer(vpTileOf(g, "Warsaw"));
    nearlyFull(g, pol);
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(attack.isActive()).toBe(true);
    // The retreat completes (20 ticks after the order) and its execution ends.
    step(runner, 25);
    expect(attack.isActive()).toBe(false);
    const running = (g as unknown as { executions(): Execution[] })
      .executions()
      .filter(
        (e) =>
          e instanceof AttackExecution &&
          e.isActive() &&
          (e as unknown as { _owner: Player })._owner === pol,
      );
    expect(running).toEqual([]);
  });

  test("a capitulation with no victor names none", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    // Its points are lost to nobody: the land goes unowned.
    pol.relinquish(vpTileOf(g, "Warsaw"));
    pol.relinquish(vpTileOf(g, "Krakow"));
    nearlyFull(g, pol);
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(ww.data().capitulated).toEqual([
      expect.objectContaining({ smallID: pol.smallID(), victor: 0 }),
    ]);
    const messages = updates
      .flatMap((u) => u.updates[GameUpdateType.DisplayEvent])
      .filter((m) => m.message.startsWith("events_display.ww1936_capitulated"));
    expect(messages.map((m) => [m.message, m.params])).toEqual([
      ["events_display.ww1936_capitulated_no_victor", { loserTag: "POL" }],
    ]);
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
    nearlyFull(g, pol);
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
    nearlyFull(g, pol);
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
    nearlyFull(g, pol);
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
    nearlyFull(g, deu);
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
    nearlyFull(g, pol);
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
    nearlyFull(g, pol);
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
    // The attack's troops come home whole (troops are integers; P1: no
    // vanilla regrowth tops them up on the tick).
    expect(sun.troops()).toBeGreaterThanOrEqual(Math.floor(sunTroops));
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

  test("a boat sailing to the loser turns back into troops at home", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "GBR" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, gbr] = (["DEU", "POL", "GBR"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(gbr.smallID(), pol.smallID(), g.ticks());
    const sent = Math.floor(gbr.troops() / 2);
    step(runner, 3, [
      stamped(HUMAN, { type: "boat", troops: sent, dst: g.ref(105, 99) }),
    ]);
    const [boat] = gbr.units(UnitType.TransportShip);
    expect(boat.troops()).toBe(sent);
    const landing = boat.targetTile()!;
    expect(g.owner(landing)).toBe(pol);

    deu.conquer(vpTileOf(g, "Warsaw"));
    nearlyFull(g, pol);
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    expect(boat.isActive()).toBe(true);
    const troops = gbr.troops() + boat.troops();
    const gbrTiles = gbr.numTilesOwned();
    step(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(boat.isActive()).toBe(false);
    expect(gbr.units(UnitType.TransportShip)).toEqual([]);
    expect(gbr.troops()).toBeGreaterThanOrEqual(troops);

    step(runner, 150);
    expect(pol.isAlive()).toBe(false);
    expect(g.owner(landing)).toBe(deu);
    expect(gbr.numTilesOwned()).toBe(gbrTiles);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id());
    expect(conquests).toEqual([
      expect.objectContaining({ conquerorId: deu.id() }),
    ]);
  });

  test("land handed to the loser during its transfer goes along too", async () => {
    const { runner, updates } = await wwRunnerCapture();
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun, ita, gbr] = (
      ["DEU", "POL", "SUN", "ITA", "GBR"] as const
    ).map((t) => byTag(g, t));
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    deu.conquer(vpTileOf(g, "Warsaw"));
    nearlyFull(g, pol);
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS));
    const left = 50;
    queueBacklog(
      g,
      ita,
      gbr,
      WW_TRANSFER_TILES_PER_TICK - pol.numTilesOwned() + left,
    );
    step(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(pol.numTilesOwned()).toBe(left);

    // A dying neighbour's tile lands with Poland mid-transfer (as
    // AttackExecution.handleDeadDefender hands them out).
    const handed = g.ref(125, 60);
    expect(g.owner(handed)).toBe(sun);
    pol.conquer(handed);
    step(runner, 3);
    expect(pol.isAlive()).toBe(false);
    expect(g.owner(handed)).toBe(deu);
    expect(ww.transfers()).toEqual([]);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id());
    expect(conquests).toEqual([
      expect.objectContaining({ conquerorId: deu.id() }),
    ]);
  });
});
