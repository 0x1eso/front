import {
  GameMapSize,
  GameMapType,
  GameMode,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { Config } from "@openfront/engine-lib/configuration/Config";
import {
  applyWorldWar1936Rules,
  normalizeWorldWar1936Config,
} from "@openfront/engine-lib/ww1936/ModeConfig";
import { testGameConfig } from "../util/Wire";

describe("World War 1936 settings", () => {
  test("off: the very same object comes back", () => {
    const c = testGameConfig({ domesticMode: true });
    expect(normalizeWorldWar1936Config(c)).toBe(c);
    const f = testGameConfig({
      worldWar1936: false,
      gameMap: GameMapType.Europe,
    });
    expect(normalizeWorldWar1936Config(f)).toBe(f);
  });

  test("on: every other fork mode goes, and the map, rules and timer are fixed", () => {
    const c: GameConfig = testGameConfig({
      worldWar1936: true,
      domesticMode: true,
      warfareExpansion: true,
      strategicWeapons: true,
      congress: true,
      gameMap: GameMapType.Europe,
      gameMapSize: GameMapSize.Compact,
      gameMode: GameMode.Team,
      playerTeams: 2,
      bots: 100,
      randomSpawn: true,
      maxTimerValue: 10,
      disabledUnits: [UnitType.Warship],
      doomsdayClock: { enabled: true, speed: "fast" },
    });
    const n = normalizeWorldWar1936Config(c);
    expect(n).not.toBe(c);
    expect(c.domesticMode).toBe(true); // the input is untouched
    expect(n.domesticMode).toBeUndefined();
    expect(n.warfareExpansion).toBeUndefined();
    expect(n.strategicWeapons).toBeUndefined();
    expect(n.congress).toBeUndefined();
    expect(n.doomsdayClock).toBeUndefined();
    expect(n.playerTeams).toBeUndefined();
    expect(n).toMatchObject({
      gameMap: GameMapType.World1936,
      gameMapSize: GameMapSize.Normal,
      gameMode: GameMode.FFA,
      bots: 0,
      randomSpawn: false,
      nations: "default",
      maxTimerValue: 45,
      customAllianceDuration: 0,
      spawnImmunityDuration: 0,
      historicalAi: true,
    });
    expect(n.disabledUnits).toEqual([
      UnitType.Warship,
      UnitType.AtomBomb,
      UnitType.HydrogenBomb,
      UnitType.MIRV,
      UnitType.MissileSilo,
      UnitType.SAMLauncher,
    ]);
    expect(normalizeWorldWar1936Config(n)).toEqual(n); // idempotent
  });

  test("historicalAi can be turned off", () => {
    const n = normalizeWorldWar1936Config(
      testGameConfig({ worldWar1936: true, historicalAi: false }),
    );
    expect(n.historicalAi).toBe(false);
  });

  test("applyWorldWar1936Rules edits a stored config in place", () => {
    const c = testGameConfig({ worldWar1936: true, domesticMode: true });
    applyWorldWar1936Rules(c);
    expect(c.domesticMode).toBeUndefined();
    expect(c.gameMap).toBe(GameMapType.World1936);
  });

  test("Config reads the normalized config", () => {
    const cfg = new Config(
      testGameConfig({
        worldWar1936: true,
        domesticMode: true,
        strategicWeapons: true,
      }),
      false,
    );
    expect(cfg.worldWar1936()).toBe(true);
    expect(cfg.historicalAi()).toBe(true);
    expect(cfg.domesticMode()).toBe(false);
    expect(cfg.strategicWeapons()).toBe(false);
    expect(cfg.disableAlliances()).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.AtomBomb)).toBe(true);
    expect(cfg.isUnitDisabled(UnitType.City)).toBe(false);
    expect(cfg.maxTimerMinutes()).toBe(45);
    const off = new Config(testGameConfig({ historicalAi: true }), false);
    expect(off.worldWar1936()).toBe(false);
    expect(off.historicalAi()).toBe(false);
  });
});
