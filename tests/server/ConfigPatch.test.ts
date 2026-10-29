import {
  Difficulty,
  GameMapSize,
  GameMapType,
  GameMode,
  GameType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { describe, expect, it } from "vitest";
import {
  applyGameConfigPatch,
  hostCheatsEnabled,
} from "../../src/server/ConfigPatch";
import { testGameConfig } from "../util/Wire";

// One value per key the host may edit, each different from testGameConfig's
// default so a copy is observable.
const EDITABLE: { [K in keyof GameConfig]?: GameConfig[K] } = {
  gameMap: GameMapType.Europe,
  gameMapSize: GameMapSize.Compact,
  difficulty: Difficulty.Hard,
  nations: "disabled",
  bots: 42,
  infiniteGold: true,
  donateGold: false,
  infiniteTroops: true,
  donateTroops: false,
  instantBuild: true,
  randomSpawn: true,
  gameMode: GameMode.Team,
  disabledUnits: [UnitType.AtomBomb],
  playerTeams: 3,
  allowedPublicIds: ["pub-a"],
  trusted: true,
  doomsdayClock: { enabled: true, speed: "fast" },
  overtime: { enabled: true, startMinutes: 20 },
  anonymizeNames: true,
  nameReveals: ["c1000000"],
  nameRevealPublicIds: ["pub-b"],
  domesticMode: true,
  warfareExpansion: true,
  strategicWeapons: true,
  congress: true,
  // worldWar1936 itself rewrites the config: see its own describe below.
  historicalAi: true,
};

// `.nullable().optional()` in the schema: null clears, undefined leaves alone.
const NULLABLE: { [K in keyof GameConfig]?: NonNullable<GameConfig[K]> } = {
  maxTimerValue: 30,
  startDelay: 10,
  spawnImmunityDuration: 50,
  goldMultiplier: 2,
  startingGold: 1000,
  disableAlliances: true,
  customAllianceDuration: 5,
  waterNukes: true,
  conquestPercent: 60,
};

describe("applyGameConfigPatch", () => {
  it.each(Object.entries(EDITABLE))(
    "copies %s when the patch carries it",
    (key, value) => {
      const target = testGameConfig();
      applyGameConfigPatch(target, { [key]: value });
      expect(target[key as keyof GameConfig]).toEqual(value);
    },
  );

  it("leaves every key alone when the patch omits it", () => {
    const target = testGameConfig({ ...EDITABLE, ...NULLABLE });
    const before = structuredClone(target);
    applyGameConfigPatch(target, {});
    expect(target).toEqual({ ...before, hostCheats: undefined });
  });

  it.each(Object.entries(NULLABLE))(
    "sets %s from a value and clears it to undefined from null",
    (key, value) => {
      const target = testGameConfig();
      applyGameConfigPatch(target, { [key]: value });
      expect(target[key as keyof GameConfig]).toEqual(value);

      applyGameConfigPatch(target, { [key]: null });
      expect(key in target).toBe(true);
      expect(target[key as keyof GameConfig]).toBeUndefined();
    },
  );

  it("replaces hostCheats unconditionally, so omitting it clears it", () => {
    // The host's full config carries hostCheats: undefined when the toggle
    // is off; that has to clear, not preserve.
    const target = testGameConfig({ hostCheats: { infiniteGold: true } });
    applyGameConfigPatch(target, { bots: 1 });
    expect(target.hostCheats).toBeUndefined();

    applyGameConfigPatch(target, { hostCheats: { startingGold: 5 } });
    expect(target.hostCheats).toEqual({ startingGold: 5 });
  });

  it("ignores gameType, which has its own guarded path", () => {
    const target = testGameConfig({ gameType: GameType.Private });
    applyGameConfigPatch(target, { gameType: GameType.Public });
    expect(target.gameType).toBe(GameType.Private);
  });

  it("sets the maxPlayers cap from a value, clears it from null, keeps it when omitted", () => {
    const target = testGameConfig({ maxPlayers: 4 });
    applyGameConfigPatch(target, {});
    expect(target.maxPlayers).toBe(4);

    applyGameConfigPatch(target, { maxPlayers: 20 });
    expect(target.maxPlayers).toBe(20);

    applyGameConfigPatch(target, { maxPlayers: null });
    expect(target.maxPlayers).toBeUndefined();
  });

  it("ignores pool, which every member of a pool has to agree on", () => {
    // A patch reaches exactly one GameServer, so a copied pool could only
    // describe a group that disagrees with itself about who goes where.
    const target = testGameConfig();
    applyGameConfigPatch(target, {
      pool: { id: "pool-1", siblings: ["aaaa1111", "bbbb2222"] },
    });
    expect(target.pool).toBeUndefined();
  });

  it("ignores keys that are not part of GameConfig at all", () => {
    // e.g. the listing flag, which lives on the GameServer, not the config.
    const target = testGameConfig();
    applyGameConfigPatch(target, { listed: true } as Partial<GameConfig>);
    expect("listed" in target).toBe(false);
  });
});

describe("hostCheatsEnabled", () => {
  it("is off without a block, or with a block that grants nothing", () => {
    expect(hostCheatsEnabled(undefined)).toBe(false);
    expect(hostCheatsEnabled({})).toBe(false);
    expect(
      hostCheatsEnabled({
        infiniteGold: false,
        infiniteTroops: false,
        goldMultiplier: null,
        startingGold: null,
      }),
    ).toBe(false);
  });

  it.each([
    { infiniteGold: true },
    { infiniteTroops: true },
    { goldMultiplier: 1 },
    { startingGold: 0 },
  ])("is on when %o grants something", (block) => {
    expect(hostCheatsEnabled(block)).toBe(true);
  });
});

describe("World War 1936 in a host's patch", () => {
  it("turning it on fixes the stored config", () => {
    const target = testGameConfig({
      domesticMode: true,
      gameMap: GameMapType.Europe,
    });
    applyGameConfigPatch(target, { worldWar1936: true, historicalAi: false });
    expect(target.worldWar1936).toBe(true);
    expect(target.historicalAi).toBe(false);
    expect(target.domesticMode).toBeUndefined();
    expect(target.gameMap).toBe(GameMapType.World1936);
    expect(target.maxTimerValue).toBe(45);
  });

  it("the unlimited game keeps its key and has no timer", () => {
    const target = testGameConfig();
    applyGameConfigPatch(target, {
      worldWar1936: true,
      ww1936Unlimited: true,
      maxTimerValue: 30,
    });
    expect(target.ww1936Unlimited).toBe(true);
    expect(target.maxTimerValue).toBeUndefined();
    // Back to the timed game: the 45 minutes return.
    applyGameConfigPatch(target, { ww1936Unlimited: false });
    expect(target.ww1936Unlimited).toBe(false);
    expect(target.maxTimerValue).toBe(45);
  });

  it("a later patch cannot turn another mode back on", () => {
    const target = testGameConfig({ worldWar1936: true });
    applyGameConfigPatch(target, {
      strategicWeapons: true,
      gameMap: GameMapType.Asia,
    });
    expect(target.strategicWeapons).toBeUndefined();
    expect(target.gameMap).toBe(GameMapType.World1936);
  });

  it("turning it off gives the 1936 map back", () => {
    const target = testGameConfig({
      worldWar1936: true,
      gameMap: GameMapType.World1936,
    });
    applyGameConfigPatch(target, { worldWar1936: false });
    expect(target.worldWar1936).toBe(false);
    expect(target.gameMap).toBe(GameMapType.World);
  });

  it("without the mode, its map is not offered", () => {
    const target = testGameConfig();
    applyGameConfigPatch(target, { gameMap: GameMapType.World1936 });
    expect(target.gameMap).toBe(GameMapType.World);
  });
});
