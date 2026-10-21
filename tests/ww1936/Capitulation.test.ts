import { GameMapSize, GameMapType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import {
  WW_CAPITULATION_DAYS,
  WW_PREP_TICKS,
} from "@openfront/engine-api/ww1936/WorldWarTypes";
import { dayStartTick } from "@openfront/engine-lib/ww1936/Calendar";
import type { Game, Player } from "@openfront/engine/game/Game";
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
 * P2 (plan decision 9): `p` takes control of the named region, its
 * victory-point tile with it; the rest of the region's tiles stay (the
 * spread is Task 4's), so the loser keeps land and stays alive.
 */
function control(g: Game, name: string, p: Player): void {
  const ww = g.worldWar()!;
  const r = ww.scenario.landRegions.find((x) => x.name === name)!;
  ww.land.setController(r.id, p.smallID(), g.ticks());
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

/**
 * P5 (lane W): a capitulation opens a peace conference whose treaty may
 * let the loser live on. With the victor played by a human who does
 * nothing, it waits its round (300 ticks), so these tests see the
 * capitulation's own P0–P2 effects.
 */
const HUMAN_DEU = [{ clientID: "HUMAN003", country: "DEU" as const }];

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
    control(g, "Krakow", deu);
    nextDay(runner);
    // 3 of 24 lost: below the line.
    expect(ww.capitulationGauge(pol.smallID())).toBe(0);
    control(g, "Warsaw", deu);
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
    control(g, "Warsaw", deu);
    control(g, "Krakow", deu);
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

  test("a capitulated country's divisions, armies and training are gone", async () => {
    const runner = await wwRunner({}, HUMAN_DEU_POL);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    expect(ww.land.fieldMen(pol.smallID())).toBeGreaterThan(0);
    expect(ww.land.armiesOf(pol.smallID()).length).toBeGreaterThan(0);
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    nextDay(runner);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    // P2 spec §5.5: no division, army or training survives it.
    expect(ww.land.fieldMen(pol.smallID())).toBe(0);
    expect(ww.land.armiesOf(pol.smallID())).toEqual([]);
    expect(ww.land.country(pol.smallID())!.training).toEqual([]);
    expect(ww.land.country(pol.smallID())!.trainees).toEqual([]);
    expect(pol.troops()).toBe(0);
    // Control moves at once (P2 spec §12.5): Krakow and its point too.
    expect(ww.land.controller[7]).toBe(deu.smallID());
    expect(g.owner(vpTileOf(g, "Krakow"))).toBe(deu);
  });

  test("a capitulation with no victor names none", async () => {
    const { runner, updates } = await wwRunnerCapture({}, HUMAN_DEU);
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
    const { runner, updates } = await wwRunnerCapture({}, HUMAN_DEU);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    control(g, "Warsaw", deu);
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

  test("a tile someone else holds in a handed-over region goes with it", async () => {
    // P2 (spec §12.1, §12.5): a region's tiles follow its control, so the
    // capitulation's spread takes every tile of the loser's regions.
    const runner = await wwRunner({}, HUMAN_DEU);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = [byTag(g, "DEU"), byTag(g, "POL"), byTag(g, "SUN")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    // A Krakow tile another enemy took by hand (not its point, which goes
    // with the region's control).
    const taken = g.ref(110, 60);
    expect(g.owner(taken)).toBe(pol);
    sun.conquer(taken);
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    nextDay(runner);
    step(runner, 3);
    expect(g.owner(taken)).toBe(deu);
    expect(g.owner(vpTileOf(g, "Krakow"))).toBe(deu);
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
    control(g, "Krakow", sun);
    expect(pickVictor(g, ww, pol)).toBe(sun);
    control(g, "Warsaw", deu);
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
    control(g, "Warsaw", deu);
    ww.addCapitulation(deu.smallID(), fra.smallID(), g.ticks());
    ww.endWarsOf(deu.smallID());
    expect(pickVictor(g, ww, pol)).toBe(fra);
    // An enemy still comes first.
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    control(g, "Krakow", sun);
    expect(pickVictor(g, ww, pol)).toBe(sun);
  });

  test("land on its way to a country that capitulates goes on to its victor", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      ...HUMAN_DEU,
      { clientID: "HUMAN004", country: "FRA" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, fra] = (["DEU", "POL", "FRA"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(fra.smallID(), deu.smallID(), g.ticks());
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    // Poland capitulates at the next day's first tick: Krakow moves by the
    // spread that tick; its tiles left in Warsaw follow once that is done.
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS) + 1);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(pol.numTilesOwned()).toBe(1499);

    // Germany falls while Poland's last land is still on its way to it.
    // P3 spec §17.1: Poland's regions are Germany's legal ones now (49
    // points), so France takes Warsaw's point tile too to pass 80%.
    control(g, "Berlin", fra);
    control(g, "Warsaw", fra);
    nearlyFull(g, deu);
    checkCapitulations(g, ww, g.ticks());
    step(runner, 6);
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
    // Both settled by France (France's Warsaw tiles above end Germany first).
    expect(conquests).toHaveLength(2);
    expect(conquests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conqueredId: pol.id(),
          conquerorId: fra.id(),
        }),
        expect.objectContaining({
          conqueredId: deu.id(),
          conquerorId: fra.id(),
        }),
      ]),
    );
  });

  test("a human whose country capitulates is left watching", async () => {
    const runner = await wwRunner({}, [
      { clientID: HUMAN, country: "POL" },
      { clientID: "HUMAN003", country: "DEU" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol] = [byTag(g, "DEU"), byTag(g, "POL")];
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    nextDay(runner);
    step(runner, 3);
    expect(pol.isAlive()).toBe(false);
    // P5 (lane W, spec §5.1-7): without a host the human gets a takeover
    // card — with no candidate, it spectates (commands no country).
    expect(ww.endgame.controlledBy(HUMAN)).toBe(0);
    expect(g.playerByClientID(HUMAN)).toBeNull();
    expect(g.getWinner()).toBeNull();
  });

  test("another enemy of the loser keeps its land; only the victor settles it", async () => {
    const { runner, updates } = await wwRunnerCapture({}, [
      { clientID: HUMAN, country: "SUN" },
    ]);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = (["DEU", "POL", "SUN"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    ww.setWar(sun.smallID(), pol.smallID(), g.ticks());
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    const sunTiles = sun.numTilesOwned();

    // Poland's land moves over two ticks: Krakow by its spread, then its
    // tiles left in Warsaw.
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS) + 1);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(pol.numTilesOwned()).toBeGreaterThan(0);

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

  test("land handed to the loser during its transfer goes along too", async () => {
    const { runner, updates } = await wwRunnerCapture({}, HUMAN_DEU);
    const g = runner.game;
    const ww = g.worldWar()!;
    const [deu, pol, sun] = (["DEU", "POL", "SUN"] as const).map((t) =>
      byTag(g, t),
    );
    stepTo(runner, WW_PREP_TICKS + 1);
    ww.setWar(deu.smallID(), pol.smallID(), g.ticks());
    control(g, "Warsaw", deu);
    nearlyFull(g, pol);
    stepTo(runner, dayStartTick(ww.day(g.ticks()) + 1, WW_PREP_TICKS) + 1);
    expect(ww.isCapitulated(pol.smallID())).toBe(true);
    expect(pol.numTilesOwned()).toBe(1499);

    // A tile lands with Poland mid-transfer (as P0's AttackExecution
    // handleDeadDefender handed them out). P2: it goes with its region,
    // the Soviet Union's Kiev; the conquest is still the victor's.
    const handed = g.ref(125, 60);
    expect(g.owner(handed)).toBe(sun);
    pol.conquer(handed);
    step(runner, 3);
    expect(pol.isAlive()).toBe(false);
    expect(g.owner(handed)).toBe(sun);
    expect(ww.transfers()).toEqual([]);
    const conquests = updates
      .flatMap((u) => u.updates[GameUpdateType.ConquestEvent])
      .filter((c) => c.conqueredId === pol.id());
    expect(conquests).toEqual([
      expect.objectContaining({ conquerorId: deu.id() }),
    ]);
  });
});
