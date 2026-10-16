import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";
import {
  CARPET_BOMB_OUTER,
  carpetBombPoints,
} from "@openfront/engine-lib/warfare/Warfare";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  BuildPreviewController,
  samThreatensNukePreview,
  shouldPreserveGhostAfterBuild,
  structureIconRadiusPx,
} from "../../../src/client/controllers/BuildPreviewController";
import { TARGET_RING_RADIUS } from "../../../src/client/controllers/StrategicPreview";
import { BuildTapEvent, MouseUpEvent } from "../../../src/client/InputHandler";
import { createRenderSettings } from "../../../src/client/render/gl/RenderSettings";
import {
  BuildUnitIntentEvent,
  SendParadropIntentEvent,
  SendUpgradeStructureIntentEvent,
} from "../../../src/client/Transport";

describe("BuildPreviewController ghost preservation (locked nuke / Enter confirm)", () => {
  describe("shouldPreserveGhostAfterBuild", () => {
    test("returns true for AtomBomb so ghost is not cleared after placement", () => {
      expect(shouldPreserveGhostAfterBuild(UnitType.AtomBomb)).toBe(true);
    });

    test("returns true for HydrogenBomb so ghost is not cleared after placement", () => {
      expect(shouldPreserveGhostAfterBuild(UnitType.HydrogenBomb)).toBe(true);
    });

    test("returns false for City so ghost is cleared after placement", () => {
      expect(shouldPreserveGhostAfterBuild(UnitType.City)).toBe(false);
    });

    test("returns false for Factory so ghost is cleared after placement", () => {
      expect(shouldPreserveGhostAfterBuild(UnitType.Factory)).toBe(false);
    });

    test("returns false for other buildable types (Port, DefensePost, MissileSilo, SAMLauncher, Warship, MIRV)", () => {
      expect(shouldPreserveGhostAfterBuild(UnitType.Port)).toBe(false);
      expect(shouldPreserveGhostAfterBuild(UnitType.DefensePost)).toBe(false);
      expect(shouldPreserveGhostAfterBuild(UnitType.MissileSilo)).toBe(false);
      expect(shouldPreserveGhostAfterBuild(UnitType.SAMLauncher)).toBe(false);
      expect(shouldPreserveGhostAfterBuild(UnitType.Warship)).toBe(false);
      expect(shouldPreserveGhostAfterBuild(UnitType.MIRV)).toBe(false);
    });
  });
});

describe("samThreatensNukePreview (nuke trajectory threat set, #4226)", () => {
  const teammates = new Set([7, 8]);
  const allies = new Set([2, 3]);

  test("non-friendly SAM threatens the trajectory", () => {
    expect(samThreatensNukePreview(5, teammates, allies, new Set())).toBe(true);
  });

  test("allied SAM does not threaten when the strike breaks no alliance", () => {
    expect(samThreatensNukePreview(2, teammates, allies, new Set())).toBe(
      false,
    );
  });

  test("would-be-betrayed ally's SAM threatens (alliance breaks at launch)", () => {
    expect(samThreatensNukePreview(2, teammates, allies, new Set([2]))).toBe(
      true,
    );
  });

  test("other allies' SAMs still excluded when a different ally is betrayed", () => {
    expect(samThreatensNukePreview(3, teammates, allies, new Set([2]))).toBe(
      false,
    );
  });

  test("teammate SAM does not threaten the trajectory", () => {
    expect(samThreatensNukePreview(7, teammates, new Set(), new Set())).toBe(
      false,
    );
  });

  test("teammate SAM stays excluded even if listed as betrayed (a strike never breaks a team)", () => {
    expect(
      samThreatensNukePreview(7, teammates, new Set([7]), new Set([7])),
    ).toBe(false);
  });
});

describe("BuildPreviewController confirm with the pointer off the map", () => {
  function makeController(worldX: number, worldY: number) {
    const width = 10;
    const height = 10;
    const game = {
      isValidCoord: (x: number, y: number) =>
        x >= 0 && y >= 0 && x < width && y < height,
      ref: (x: number, y: number) => {
        if (x < 0 || y < 0 || x >= width || y >= height) {
          throw new Error(`Invalid coordinates: ${x},${y}`);
        }
        return y * width + x;
      },
      myPlayer: () => ({ gold: () => 100n, smallID: () => 1 }),
      x: (t: number) => t % width,
      y: (t: number) => Math.floor(t / width),
    };
    const transformHandler = {
      screenToWorldCoordinates: () => ({ x: worldX, y: worldY }),
    };
    const userSettings = {
      nukeAllianceSafetyDuration: () => 0,
      cursorCostLabel: () => false,
    };
    const eventBus = new EventBus();
    const emitted: unknown[] = [];
    vi.spyOn(eventBus, "emit").mockImplementation((e) => {
      emitted.push(e);
    });
    const controller = new BuildPreviewController(
      game as any,
      eventBus,
      { ghostStructure: UnitType.City } as any,
      transformHandler as any,
      { updateGhostPreview: () => {}, updateNukeTrajectory: () => {} } as any,
      userSettings as any,
    );
    (controller as any).ghostUnit = {
      buildableUnit: { type: UnitType.City, canBuild: 1, canUpgrade: false },
    };
    return { controller, emitted };
  }

  test.each([UnitType.City, UnitType.Port, UnitType.Warship])(
    "resolved preview for %s",
    (type) => {
      const { controller } = makeController(3, 4);
      const buildable = (controller as any).ghostUnit.buildableUnit;
      Object.assign(buildable, { type, canBuild: 0, cost: 1n });
      const data = (controller as any).buildGhostPreviewData(43, false);
      const position = type === UnitType.Warship ? [3, 4] : [0, 0];
      expect([data.tileX, data.tileY]).toEqual(position);
      expect([data.radiusTileX, data.radiusTileY]).toEqual(position);
      expect(data.snapToPlacement).toBe(type !== UnitType.Warship);
    },
  );

  test("does not throw or emit a build intent when released off the map edge", () => {
    const { controller, emitted } = makeController(-1, 4);
    expect(() =>
      (controller as any).requestConfirmStructure(new MouseUpEvent(0, 0)),
    ).not.toThrow();
    expect(emitted.some((e) => e instanceof BuildUnitIntentEvent)).toBe(false);
  });

  test("emits a build intent when released on the map", () => {
    const { controller, emitted } = makeController(3, 4);
    (controller as any).requestConfirmStructure(new MouseUpEvent(0, 0));
    const intent = emitted.find((e) => e instanceof BuildUnitIntentEvent) as
      | BuildUnitIntentEvent
      | undefined;
    expect(intent?.tile).toBe(43);
  });
});

describe("BuildPreviewController touch build mode (aim, then tap the ghost)", () => {
  const WIDTH = 10;
  /** Screen px per tile in the fake camera: a tap at (70, 80) is tile (7, 8). */
  const PX = 10;
  type Answer = {
    canBuild: number | false;
    canUpgrade: number | false;
  };

  function makeTouchController(
    type: UnitType,
    strategic: StrategicData | null = null,
  ) {
    const frames: (() => void)[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      frames.push(cb);
      return 0;
    });
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const queries: { tile: number | undefined; resolve: () => void }[] = [];
    let answer: (tile: number | undefined) => Answer = () => ({
      canBuild: false,
      canUpgrade: false,
    });
    const silo = {
      id: () => 5,
      isActive: () => true,
      isInCooldown: () => false,
      isUnderConstruction: () => false,
      tile: () => 0,
    };
    const airport = {
      id: () => 6,
      isActive: () => true,
      isInCooldown: () => false,
      isUnderConstruction: () => false,
      level: () => 1,
      tile: () => 9, // (9, 0)
    };
    const busyAirport = {
      ...airport,
      id: () => 7,
      isInCooldown: () => true,
      tile: () => 90,
    };
    // An enemy SAM; its owner's air-defense law adds 21 tiles (samRangeOf).
    const enemy = { smallID: () => 9 };
    const enemySam = {
      id: () => 77,
      isActive: () => true,
      owner: () => enemy,
      level: () => 1,
      tile: () => 99,
    };
    const myPlayer = {
      gold: () => 1_000_000n,
      isFriendly: () => false,
      strategicData: () => strategic,
      smallID: () => 1,
      allies: () => [],
      alliances: () => [],
      readyMissileCount: () => 5,
      isOnSameTeam: () => false,
      troops: () => 2000,
      units: (t: UnitType) =>
        t === UnitType.MissileSilo
          ? [silo]
          : t === UnitType.Airport
            ? [airport, busyAirport]
            : [],
      buildables: (tile: number | undefined, types: UnitType[]) =>
        new Promise((resolve) => {
          queries.push({
            tile,
            resolve: () =>
              resolve([{ type: types[0], cost: 100n, ...answer(tile) }]),
          });
        }),
    };
    const game = {
      isValidCoord: (x: number, y: number) =>
        x >= 0 && y >= 0 && x < WIDTH && y < WIDTH,
      ref: (x: number, y: number) => y * WIDTH + x,
      euclideanDistSquared: (a: number, b: number) =>
        ((a % WIDTH) - (b % WIDTH)) ** 2 +
        (Math.floor(a / WIDTH) - Math.floor(b / WIDTH)) ** 2,
      x: (t: number) => t % WIDTH,
      y: (t: number) => Math.floor(t / WIDTH),
      height: () => WIDTH,
      isImpassable: () => false,
      myPlayer: () => myPlayer,
      players: () => [myPlayer],
      units: (...ts: UnitType[]) =>
        ts.includes(UnitType.SAMLauncher) ? [enemySam] : [],
      unit: (id: number) => (id === 42 ? { tile: () => 11 } : undefined),
      ticks: () => 100,
      config: () => ({
        nukeMagnitudes: () => ({ inner: 12, outer: 30 }),
        nukeAllianceBreakThreshold: () => 100,
        samRange: () => 70,
        samRangeOf: (_owner: unknown, base: number) => base + 21,
        trainStationMaxRange: () => 100,
        defensePostRange: () => 30,
        strategicWeapons: () => strategic !== null,
      }),
    };
    const transformHandler = {
      screenToWorldCoordinates: (x: number, y: number) => ({
        x: Math.floor(x / PX),
        y: Math.floor(y / PX),
      }),
      screenToWorldCoordinatesFloat: (x: number, y: number) => ({
        x: x / PX,
        y: y / PX,
      }),
      worldToScreenCoordinates: (c: { x: number; y: number }) => ({
        x: c.x * PX,
        y: c.y * PX,
      }),
    };
    const view = {
      updateGhostPreview: vi.fn(),
      updateNukeTrajectory: vi.fn(),
      updateAimRings: vi.fn(),
      triggerBlockedFlash: vi.fn(),
      getSettings: () => createRenderSettings(),
    };
    const uiState = {
      attackRatio: 0.25,
      ghostStructure: type,
      rocketDirectionUp: true,
      upgradeMultiplier: 1,
    };
    const eventBus = new EventBus();
    const emitted: unknown[] = [];
    const emit = eventBus.emit.bind(eventBus);
    vi.spyOn(eventBus, "emit").mockImplementation((e) => {
      emitted.push(e);
      emit(e);
    });
    const controller = new BuildPreviewController(
      game as any,
      eventBus,
      uiState as any,
      transformHandler as any,
      view as any,
      {
        nukeAllianceSafetyDuration: () => 0,
        cursorCostLabel: () => false,
      } as any,
    );
    controller.init();
    return {
      controller,
      uiState,
      view,
      queries,
      /** Run the cursor loop's first queued frame. */
      frame: () => frames.shift()?.(),
      tap: (x: number, y: number) => eventBus.emit(new BuildTapEvent(x, y)),
      /** The worker answers every open buildables query. */
      reply: async (fn: (tile: number | undefined) => Answer) => {
        answer = fn;
        for (const q of queries.splice(0)) q.resolve();
        await new Promise((r) => setTimeout(r, 0));
      },
      /** Time passes with the preview on screen. */
      wait: (ms: number) => {
        now += ms;
      },
      intents: () => ({
        builds: emitted.filter(
          (e): e is BuildUnitIntentEvent => e instanceof BuildUnitIntentEvent,
        ),
        paradrops: emitted.filter(
          (e): e is SendParadropIntentEvent =>
            e instanceof SendParadropIntentEvent,
        ),
        upgrades: emitted.filter(
          (e): e is SendUpgradeStructureIntentEvent =>
            e instanceof SendUpgradeStructureIntentEvent,
        ),
      }),
    };
  }

  const cityAt = (tile: number | undefined): Answer =>
    tile === 11
      ? { canBuild: false, canUpgrade: 42 } // the city next to tile 11
      : { canBuild: tile ?? false, canUpgrade: false };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Long enough for the player to have seen the checked preview. */
  const SEEN_MS = 350;

  test("a tap aims: the ghost is checked at once for that tile and nothing is built", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    expect(t.queries.map((q) => q.tile)).toEqual([87]);
    await t.reply(cityAt);
    expect(t.intents().builds).toHaveLength(0);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.uiState.ghostStructure).toBe(UnitType.City);
  });

  test("a second tap on the ghost builds on the aimed tile", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(cityAt);
    t.wait(SEEN_MS);
    // A fingertip off the first tap still lands on the ghost's icon.
    t.tap(76, 86);
    expect(t.intents().builds.map((b) => [b.unit, b.tile])).toEqual([
      [UnitType.City, 87],
    ]);
    expect(t.uiState.ghostStructure).toBeNull();
  });

  test("a tap on a ghost shown for under 350ms builds nothing and keeps the aim and its clock (C1)", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(cityAt);
    t.wait(SEEN_MS - 50);
    t.tap(72, 82);
    expect(t.intents().builds).toHaveLength(0);
    // No new check: the aim stays, and so does the time it has been shown.
    expect(t.queries).toHaveLength(0);
    t.wait(50);
    t.tap(72, 82);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
  });

  test("a player tapping the icon every 300ms still builds (C1)", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(cityAt);
    t.wait(300);
    t.tap(72, 82);
    expect(t.intents().builds).toHaveLength(0);
    t.wait(300);
    t.tap(72, 82);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
  });

  test("a stale check from the previous tile is never confirmed (I1)", async () => {
    const t = makeTouchController(UnitType.City);
    // Aimed next to existing city #42 first: that tile's check says upgrade.
    t.tap(10, 10);
    await t.reply(cityAt);
    t.wait(SEEN_MS);
    // Re-aim at (7, 8) and tap again before its check is back.
    t.tap(70, 80);
    t.tap(70, 80);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.intents().builds).toHaveLength(0);
    // The early tap is not kept to fire once the check is back (C1).
    await t.reply(cityAt);
    t.wait(SEEN_MS);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.intents().builds).toHaveLength(0);
    t.tap(70, 80);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
  });

  test("confirming next to an existing city upgrades that city", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(10, 10);
    await t.reply(cityAt);
    t.wait(SEEN_MS);
    t.tap(10, 10);
    expect(t.intents().upgrades.map((u) => u.unitId)).toEqual([42]);
    expect(t.intents().builds).toHaveLength(0);
  });

  test("a tap away from the aimed ghost aims again instead of building", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(cityAt);
    t.wait(SEEN_MS);
    t.tap(20, 30);
    expect(t.queries.map((q) => q.tile)).toEqual([32]);
    await t.reply(cityAt);
    expect(t.intents().builds).toHaveLength(0);
    t.wait(SEEN_MS);
    t.tap(20, 30);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([32]);
  });

  test("a tap on a ghost that can't be built there builds nothing and keeps build mode", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(() => ({ canBuild: false, canUpgrade: false }));
    t.wait(SEEN_MS);
    t.tap(70, 80);
    expect(t.intents().builds).toHaveLength(0);
    expect(t.uiState.ghostStructure).toBe(UnitType.City);
    expect(t.view.triggerBlockedFlash).toHaveBeenCalled();
  });

  test("a tap 20px from a red (unbuildable) ghost aims again there (C1)", async () => {
    const t = makeTouchController(UnitType.City);
    // (7, 8) can't take a city; (9, 8) can.
    const answer = (tile: number | undefined): Answer =>
      tile === 87
        ? { canBuild: false, canUpgrade: false }
        : { canBuild: tile ?? false, canUpgrade: false };
    t.tap(70, 80);
    await t.reply(answer);
    t.wait(SEEN_MS);
    // Within the drawn icon, but a red ghost can't be confirmed: re-aim.
    t.tap(90, 80);
    expect(t.queries.map((q) => q.tile)).toEqual([89]);
    expect(t.view.triggerBlockedFlash).not.toHaveBeenCalled();
    await t.reply(answer);
    t.wait(SEEN_MS);
    t.tap(90, 80);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([89]);
  });

  test("an atom bomb nudged 25px aims again instead of launching at the old aim (C1)", async () => {
    const t = makeTouchController(UnitType.AtomBomb);
    t.tap(70, 80);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.wait(SEEN_MS);
    // No icon for a bomb: its crosshair counts 22px around the aim.
    t.tap(95, 80);
    expect(t.intents().builds).toHaveLength(0);
    expect(t.queries.map((q) => q.tile)).toEqual([89]);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.wait(SEEN_MS);
    t.tap(95, 80);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([89]);
  });

  test("a port snapped to the coast confirms on its icon there, not on the aimed point", async () => {
    const t = makeTouchController(UnitType.Port);
    // Aimed inland at (7, 8): the port snaps to the coast tile (1, 8).
    const coast = (tile: number | undefined): Answer => ({
      canBuild: tile === undefined ? false : 81,
      canUpgrade: false,
    });
    t.tap(70, 80);
    await t.reply(coast);
    t.wait(SEEN_MS);
    // The aimed point is ~55px from the icon drawn at (15, 85): aim again.
    t.tap(70, 80);
    expect(t.intents().builds).toHaveLength(0);
    expect(t.queries.map((q) => q.tile)).toEqual([87]);
    await t.reply(coast);
    t.wait(SEEN_MS);
    t.tap(20, 85);
    expect(t.intents().builds.map((b) => [b.unit, b.tile])).toEqual([
      [UnitType.Port, 87],
    ]);
  });

  test("a fast double tap never launches, even once the check is back (C1)", async () => {
    const t = makeTouchController(UnitType.AtomBomb);
    t.tap(70, 80);
    t.tap(71, 81); // 100-200ms later, the check not back yet
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.wait(SEEN_MS);
    expect(t.intents().builds).toHaveLength(0);
    // Seen, then tapped: that launches.
    t.tap(71, 81);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
  });

  test("an atom bomb tap previews the blast and trajectory; only the second tap launches, then disarms (I3)", async () => {
    const t = makeTouchController(UnitType.AtomBomb);
    t.tap(70, 80);
    await t.reply(cityAt);
    expect(t.intents().builds).toHaveLength(0);
    const ghost = (t.controller as any).lastGhostData;
    expect(ghost.rangeRadius).toBe(30);
    expect([ghost.radiusTileX, ghost.radiusTileY]).toEqual([7, 8]);
    expect((t.controller as any).nukeTrajectoryStatic).not.toBeNull();

    t.wait(SEEN_MS);
    t.tap(70, 80);
    expect(
      t.intents().builds.map((b) => [b.unit, b.tile, b.rocketDirectionUp]),
    ).toEqual([[UnitType.AtomBomb, 87, true]]);
    // A finger can't hover to aim the next one: no bomb stays armed.
    expect(t.uiState.ghostStructure).toBeNull();
    t.tap(70, 80);
    expect(t.intents().builds).toHaveLength(1);
  });

  test("SAM ranges are drawn with the engine's samRangeOf (air-defense law) (M3)", async () => {
    const sam = makeTouchController(UnitType.SAMLauncher);
    sam.tap(70, 80);
    await sam.reply(cityAt);
    expect((sam.controller as any).lastGhostData.rangeRadius).toBe(91);

    const bomb = makeTouchController(UnitType.AtomBomb);
    bomb.tap(70, 80);
    await bomb.reply(cityAt);
    expect((bomb.controller as any).nukeTrajectoryStatic.sams).toEqual([
      { x: 9, y: 9, r: 91 },
    ]);
  });

  test("a mouse click still builds at once and keeps a bomb armed", async () => {
    const t = makeTouchController(UnitType.AtomBomb);
    (t.controller as any).syncGhostState();
    (t.controller as any).ghostUnit.buildableUnit = {
      type: UnitType.AtomBomb,
      canBuild: 87,
      canUpgrade: false,
      cost: 100n,
    };
    (t.controller as any).requestConfirmStructure(new MouseUpEvent(70, 80));
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
    expect(t.uiState.ghostStructure).toBe(UnitType.AtomBomb);
  });

  // The cursor loop (rAF, stubbed here) pushes this to the renderer.
  const lastGhost = (t: ReturnType<typeof makeTouchController>, tile: number) =>
    (t.controller as any).buildGhostPreviewData(tile, false);

  it("a conventional missile rings the enemy building it would hit", async () => {
    const t = makeTouchController(UnitType.ConventionalMissile);
    t.tap(80, 80); // tile (8, 8), next to the enemy SAM at (9, 9)
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    expect(lastGhost(t, 88)).toMatchObject({
      rangeRadius: TARGET_RING_RADIUS,
      radiusTileX: 9,
      radiusTileY: 9,
    });
  });

  it("the missile ring stays on the building while the cursor loop runs, and the arc flies to it", async () => {
    const t = makeTouchController(UnitType.ConventionalMissile);
    t.tap(20, 20); // tile (2, 2), 7 tiles from the enemy SAM at (9, 9)
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    (t.controller as any).renderGhost();
    t.frame();
    const ghostCalls = t.view.updateGhostPreview.mock.calls;
    expect(ghostCalls[ghostCalls.length - 1][0]).toMatchObject({
      radiusTileX: 9,
      radiusTileY: 9,
      rangeRadius: TARGET_RING_RADIUS,
    });
    expect((t.controller as any).nukeTrajectoryStatic.dest).toEqual({
      x: 9,
      y: 9,
    });
    expect(t.view.updateNukeTrajectory).toHaveBeenCalled();
  });

  it("a tap on the ringed building is a tap on the aimed ghost: aim, check, wait, tap fires", async () => {
    const t = makeTouchController(UnitType.ConventionalMissile);
    t.tap(20, 20);
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    (t.controller as any).renderGhost();
    // The ring is on the building at screen (95, 95), far from the aim.
    t.wait(350 - 50);
    t.tap(95, 95); // too early: waits, never re-aims
    expect(t.queries).toHaveLength(0);
    expect(t.intents().builds).toHaveLength(0);
    t.wait(50);
    t.tap(95, 95);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([22]);
  });

  it("the keyboard x5 is ignored for a stocked bomb", async () => {
    const stock: StrategicData = {
      stock: {
        [UnitType.AtomBomb]: 9,
        [UnitType.HydrogenBomb]: 0,
        [UnitType.MIRV]: 0,
      },
      jobs: [],
      satellite: { phase: "none" },
    };
    const t = makeTouchController(UnitType.AtomBomb, stock);
    t.uiState.upgradeMultiplier = 5;
    t.tap(70, 80);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    expect(lastGhost(t, 87)).toMatchObject({ multiplier: 1 });
    t.wait(350);
    t.tap(70, 80);
    expect(t.intents().builds.map((b) => b.amount)).toEqual([1]);
  });

  it("the satellite rings the silo it would use", async () => {
    const t = makeTouchController(UnitType.Satellite);
    t.tap(10, 10); // tile (1, 1), next to my silo at tile 0
    await t.reply(() => ({ canBuild: 0, canUpgrade: false }));
    expect(lastGhost(t, 11)).toMatchObject({
      rangeRadius: TARGET_RING_RADIUS,
      radiusTileX: 0,
      radiusTileY: 0,
    });
  });

  it("strategic weapons: a bomb costs no gold and needs one in stock", async () => {
    const empty: StrategicData = {
      stock: {
        [UnitType.AtomBomb]: 0,
        [UnitType.HydrogenBomb]: 0,
        [UnitType.MIRV]: 0,
      },
      jobs: [],
      satellite: { phase: "none" },
    };
    const t = makeTouchController(UnitType.AtomBomb, empty);
    t.tap(70, 80);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    expect(lastGhost(t, 87)).toMatchObject({
      cost: 0,
      showCost: false,
      canAfford: false,
    });
  });

  test("a paradrop aims, checks, waits, then sends the paradrop intent with attack ratio x troops", async () => {
    const t = makeTouchController(UnitType.TransportPlane);
    t.tap(30, 40); // tile (3, 4)
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.wait(300);
    t.tap(30, 40); // too early: waits, never re-aims
    expect(t.queries).toHaveLength(0);
    expect(t.intents().paradrops).toHaveLength(0);
    t.wait(50);
    t.tap(32, 42);
    const [drop] = t.intents().paradrops;
    expect(drop.dst).toBe(43);
    expect(drop.troops).toBe(500);
    // No build intent: a paradrop is not a building.
    expect(t.intents().builds).toHaveLength(0);
    expect(t.uiState.ghostStructure).toBeNull();
  });

  test("aiming a paradrop rings the airports with a sortie and marks the one that flies", async () => {
    const t = makeTouchController(UnitType.TransportPlane);
    t.tap(30, 40);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.frame();
    const rings =
      t.view.updateAimRings.mock.calls[
        t.view.updateAimRings.mock.calls.length - 1
      ][0];
    // The busy airport at (0, 9) has no ring; the free one at (9, 0) has its
    // range ring and the flyer mark.
    expect(rings).toHaveLength(2);
    expect(rings[0]).toMatchObject({ x: 9, y: 0, radius: 150, outline: true });
    expect(rings[1]).toMatchObject({ x: 9, y: 0, outline: false });
  });

  test("a bomber's aim draws the 8 carpet circles from carpetBombPoints", async () => {
    const t = makeTouchController(UnitType.Bomber);
    t.tap(30, 40);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.frame();
    const rings =
      t.view.updateAimRings.mock.calls[
        t.view.updateAimRings.mock.calls.length - 1
      ][0];
    const circles = rings.filter(
      (r: { radius: number }) => r.radius === CARPET_BOMB_OUTER,
    );
    expect(circles.map((c: { x: number; y: number }) => [c.x, c.y])).toEqual(
      carpetBombPoints(9, 0, 3, 4).map((p) => [p.x, p.y]),
    );
    // The line runs on through the aim to the last blast.
    const st = (t.controller as any).nukeTrajectoryStatic;
    expect(st).toMatchObject({
      srcX: 9,
      srcY: 0,
      straight: true,
      carpet: true,
    });
  });

  test("a coastal barrage picks the nearest ready silo with no range limit and rings no airport", async () => {
    const t = makeTouchController(UnitType.CoastalBarrage);
    t.tap(90, 90);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    expect((t.controller as any).nukeTrajectoryStatic).toMatchObject({
      srcX: 0,
      srcY: 0,
      straight: true,
      carpet: false,
    });
    t.frame();
    expect(t.view.updateAimRings).not.toHaveBeenCalled();
  });

  test("leaving build mode clears the aim rings", async () => {
    const t = makeTouchController(UnitType.TransportPlane);
    t.tap(30, 40);
    await t.reply((tile) => ({ canBuild: tile ?? false, canUpgrade: false }));
    t.frame();
    (t.uiState as any).ghostStructure = null;
    (t.controller as any).syncGhostState();
    expect(t.view.updateAimRings).toHaveBeenLastCalledWith([]);
  });
});

describe("structureIconRadiusPx (the ghost icon as StructurePass draws it)", () => {
  const ss = createRenderSettings().structure;

  test("a city icon at the default zoom on a 2x tablet: 15 CSS px", () => {
    // 1.8 CSS px per tile at dpr 2: zoom 3.6, past the 3x full-size point.
    expect(structureIconRadiusPx(ss, UnitType.City, 1.8, 2)).toBeCloseTo(15);
  });

  test("shape scale and close zoom grow the icon", () => {
    // Zoom 20 (10 CSS px x dpr 2) is past iconGrowZoom 7: x20/7.
    expect(structureIconRadiusPx(ss, UnitType.City, 10, 2)).toBeCloseTo(
      (60 * (20 / 7) * 0.5) / 2,
    );
    expect(structureIconRadiusPx(ss, UnitType.MissileSilo, 1.8, 2)).toBeCloseTo(
      15 * 1.55,
    );
  });

  test("bombs have no structure icon", () => {
    expect(structureIconRadiusPx(ss, UnitType.AtomBomb, 1.8, 2)).toBe(0);
  });
});

describe("bomber preview breaks alliances over the whole carpet (blast radius 8)", () => {
  const WIDTH = 100;
  const ref = (x: number, y: number) => y * WIDTH + x;
  /** An ally city 12 tiles from the aim: out of reach of a blast at the aim (outer 8), but a carpet blast lands 2 tiles from it. */
  function make(opts: { fresh?: boolean; allyNearTarget?: boolean }) {
    const near = opts.allyNearTarget ?? true;
    const ally = { smallID: () => 2, isDisconnected: () => false };
    const allyCity = { owner: () => ally, tile: () => ref(52, 50) };
    const allySam = {
      isActive: () => true,
      owner: () => ally,
      level: () => 1,
      tile: () => ref(53, 50),
    };
    const airport = {
      isActive: () => true,
      isInCooldown: () => false,
      isUnderConstruction: () => false,
      level: () => 1,
      tile: () => ref(10, 50),
    };
    const magnitudes: { inner: number; outer: number }[] = [];
    const myPlayer = {
      smallID: () => 1,
      allies: () => [ally],
      gold: () => 10_000_000n,
      alliances: () => [{ id: 7, other: 2, createdAt: opts.fresh ? 95 : 0 }],
      isOnSameTeam: () => false,
      isFriendly: (o: unknown) => o === ally,
      isDisconnected: () => false,
      units: (t: UnitType) => (t === UnitType.Airport ? [airport] : []),
      buildables: () =>
        Promise.resolve([
          { type: UnitType.Bomber, cost: 1n, canBuild: 1, canUpgrade: false },
        ]),
    };
    const game = {
      isValidCoord: () => true,
      ref,
      x: (t: number) => t % WIDTH,
      y: (t: number) => Math.floor(t / WIDTH),
      isImpassable: () => false,
      myPlayer: () => myPlayer,
      players: () => [myPlayer],
      player: () => ally,
      ticks: () => 100,
      units: (t: UnitType) => (t === UnitType.SAMLauncher ? [allySam] : []),
      euclideanDistSquared: (a: number, b: number) => {
        const dx = (a % WIDTH) - (b % WIDTH);
        const dy = Math.floor(a / WIDTH) - Math.floor(b / WIDTH);
        return dx * dx + dy * dy;
      },
      ownerID: () => 0,
      circleSearch: () => {},
      anyUnitNearby: (_t: number, r: number) => {
        magnitudes.push({ inner: -1, outer: r });
        return near;
      },
      nearbyUnits: (_t: number, r: number) => {
        magnitudes.push({ inner: -1, outer: r });
        return near ? [{ unit: allyCity }] : [];
      },
      config: () => ({
        nukeMagnitudes: () => ({ inner: 12, outer: 30 }),
        nukeAllianceBreakThreshold: () => 100,
        samRange: () => 70,
        samRangeOf: (_o: unknown, b: number) => b,
        trainStationMaxRange: () => 100,
        defensePostRange: () => 30,
      }),
    };
    const view = {
      updateGhostPreview: vi.fn(),
      updateNukeTrajectory: vi.fn(),
      triggerBlockedFlash: vi.fn(),
      getSettings: () => createRenderSettings(),
    };
    const controller = new BuildPreviewController(
      game as any,
      new EventBus(),
      { ghostStructure: UnitType.Bomber, rocketDirectionUp: false } as any,
      {
        screenToWorldCoordinates: () => ({ x: 40, y: 50 }),
        screenToWorldCoordinatesFloat: () => ({ x: 40, y: 50 }),
      } as any,
      view as any,
      {
        nukeAllianceSafetyDuration: () => 50,
        cursorCostLabel: () => false,
      } as any,
    );
    (controller as any).ghostUnit = {
      buildableUnit: { type: UnitType.Bomber, canBuild: 1, canUpgrade: false },
    };
    return { controller, view, magnitudes };
  }

  afterEach(() => vi.restoreAllMocks());

  test("the ring turns red when the bombing would betray an ally", async () => {
    const { controller, magnitudes } = make({});
    (controller as any).queryGhost();
    await new Promise((r) => setTimeout(r, 0));
    expect((controller as any).lastGhostData.rangeWarning).toBe(true);
    expect(magnitudes.some((m) => m.outer === 8)).toBe(true);
    expect(magnitudes.some((m) => m.outer === 18)).toBe(false);
  });

  test("the ring stays white with no ally in the bomb zone", async () => {
    const { controller } = make({ allyNearTarget: false });
    (controller as any).queryGhost();
    await new Promise((r) => setTimeout(r, 0));
    expect((controller as any).lastGhostData.rangeWarning).toBe(false);
  });

  test("a betrayed ally's SAM is on the flight line; a bystander ally's is not", () => {
    const betrayed = make({});
    (betrayed.controller as any).updateFlightPreview(
      UnitType.Bomber,
      ref(40, 50),
    );
    expect((betrayed.controller as any).nukeTrajectoryStatic.sams).toHaveLength(
      1,
    );
    const bystander = make({ allyNearTarget: false });
    (bystander.controller as any).updateFlightPreview(
      UnitType.Bomber,
      ref(40, 50),
    );
    expect(
      (bystander.controller as any).nukeTrajectoryStatic.sams,
    ).toHaveLength(0);
  });

  test("a fresh alliance blocks the bombing and flashes the target", () => {
    const { controller, view } = make({ fresh: true });
    expect(
      (controller as any).shouldBlockRecentAllyNuke(
        ref(40, 50),
        UnitType.Bomber,
      ),
    ).toBe(true);
    expect(view.triggerBlockedFlash).toHaveBeenCalled();
  });

  test("an old alliance does not block", () => {
    const { controller } = make({ fresh: false });
    expect(
      (controller as any).shouldBlockRecentAllyNuke(
        ref(40, 50),
        UnitType.Bomber,
      ),
    ).toBe(false);
  });
});
