import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { EventBus } from "@openfront/shared/EventBus";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  BuildPreviewController,
  samThreatensNukePreview,
  shouldPreserveGhostAfterBuild,
} from "../../../src/client/controllers/BuildPreviewController";
import { BuildTapEvent, MouseUpEvent } from "../../../src/client/InputHandler";
import {
  BuildUnitIntentEvent,
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

  function makeTouchController(type: UnitType) {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const queries: { tile: number | undefined; resolve: () => void }[] = [];
    let answer: (tile: number | undefined) => Answer = () => ({
      canBuild: false,
      canUpgrade: false,
    });
    const silo = {
      isActive: () => true,
      isInCooldown: () => false,
      isUnderConstruction: () => false,
      tile: () => 0,
    };
    const myPlayer = {
      gold: () => 1_000_000n,
      smallID: () => 1,
      allies: () => [],
      alliances: () => [],
      readyMissileCount: () => 5,
      isOnSameTeam: () => false,
      units: (t: UnitType) => (t === UnitType.MissileSilo ? [silo] : []),
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
      x: (t: number) => t % WIDTH,
      y: (t: number) => Math.floor(t / WIDTH),
      height: () => WIDTH,
      isImpassable: () => false,
      myPlayer: () => myPlayer,
      players: () => [myPlayer],
      units: () => [],
      unit: (id: number) => (id === 42 ? { tile: () => 11 } : undefined),
      ticks: () => 100,
      config: () => ({
        nukeMagnitudes: () => ({ inner: 12, outer: 30 }),
        nukeAllianceBreakThreshold: () => 100,
        samRange: () => 70,
        trainStationMaxRange: () => 100,
        defensePostRange: () => 30,
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
      triggerBlockedFlash: vi.fn(),
    };
    const uiState = {
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
      tap: (x: number, y: number) => eventBus.emit(new BuildTapEvent(x, y)),
      /** The worker answers every open buildables query. */
      reply: async (fn: (tile: number | undefined) => Answer) => {
        answer = fn;
        for (const q of queries.splice(0)) q.resolve();
        await new Promise((r) => setTimeout(r, 0));
      },
      intents: () => ({
        builds: emitted.filter(
          (e): e is BuildUnitIntentEvent => e instanceof BuildUnitIntentEvent,
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

  afterEach(() => vi.unstubAllGlobals());

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
    // A fingertip off the first tap still lands on the ghost.
    t.tap(76, 86);
    expect(t.intents().builds.map((b) => [b.unit, b.tile])).toEqual([
      [UnitType.City, 87],
    ]);
    expect(t.uiState.ghostStructure).toBeNull();
  });

  test("a stale check from the previous tile is never confirmed (I1)", async () => {
    const t = makeTouchController(UnitType.City);
    // Aimed next to existing city #42 first: that tile's check says upgrade.
    t.tap(10, 10);
    await t.reply(cityAt);
    // Re-aim at (7, 8) and confirm before its check is back.
    t.tap(70, 80);
    t.tap(70, 80);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.intents().builds).toHaveLength(0);
    await t.reply(cityAt);
    expect(t.intents().upgrades).toHaveLength(0);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([87]);
  });

  test("confirming next to an existing city upgrades that city", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(10, 10);
    await t.reply(cityAt);
    t.tap(10, 10);
    expect(t.intents().upgrades.map((u) => u.unitId)).toEqual([42]);
    expect(t.intents().builds).toHaveLength(0);
  });

  test("a tap away from the aimed ghost aims again instead of building", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(cityAt);
    t.tap(20, 30);
    expect(t.queries.map((q) => q.tile)).toEqual([32]);
    await t.reply(cityAt);
    expect(t.intents().builds).toHaveLength(0);
    t.tap(20, 30);
    expect(t.intents().builds.map((b) => b.tile)).toEqual([32]);
  });

  test("a tap on a ghost that can't be built there builds nothing and keeps build mode", async () => {
    const t = makeTouchController(UnitType.City);
    t.tap(70, 80);
    await t.reply(() => ({ canBuild: false, canUpgrade: false }));
    t.tap(70, 80);
    expect(t.intents().builds).toHaveLength(0);
    expect(t.uiState.ghostStructure).toBe(UnitType.City);
    expect(t.view.triggerBlockedFlash).toHaveBeenCalled();
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

    t.tap(70, 80);
    expect(
      t.intents().builds.map((b) => [b.unit, b.tile, b.rocketDirectionUp]),
    ).toEqual([[UnitType.AtomBomb, 87, true]]);
    // A finger can't hover to aim the next one: no bomb stays armed.
    expect(t.uiState.ghostStructure).toBeNull();
    t.tap(70, 80);
    expect(t.intents().builds).toHaveLength(1);
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
});
