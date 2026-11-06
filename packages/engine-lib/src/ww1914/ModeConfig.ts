import {
  GameMapSize,
  GameMapType,
  GameMode,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { normalizeWorldWar1936Config } from "../ww1936/ModeConfig";
import { gwCalendarOf } from "./Calendars";

/**
 * Great War 1914: in place, fixes a config whose mode is on. Exclusive with
 * World War 1936 and every other fork mode: this key wins. The map is the
 * background, so every unit is off.
 */
export function applyGreatWar1914Rules(c: GameConfig): void {
  if (c.greatWar1914 !== true) return;
  delete c.worldWar1936;
  delete c.historicalAi;
  delete c.ww1936Nukes;
  delete c.ww1936Unlimited;
  delete c.ww1936FastTempo;
  delete c.ww1936Designer;
  delete c.domesticMode;
  delete c.warfareExpansion;
  delete c.strategicWeapons;
  delete c.congress;
  delete c.conquestPercent;
  delete c.doomsdayClock;
  delete c.overtime;
  delete c.playerTeams;
  delete c.maxTimerValue;
  delete c.goldMultiplier;
  delete c.startingGold;
  delete c.waterNukes;
  c.gameMap = GameMapType.World1936;
  c.gameMapSize = GameMapSize.Normal;
  c.gameMode = GameMode.FFA;
  c.bots = 0;
  c.randomSpawn = false;
  c.nations = "default";
  c.spawnImmunityDuration = 0;
  c.donateGold = false;
  c.donateTroops = false;
  c.infiniteGold = false;
  c.infiniteTroops = false;
  c.disabledUnits = Object.values(UnitType);
  c.greatWar1914Calendar = gwCalendarOf(c);
}

/**
 * The config the engine, the server and the lobby play with, whichever fork
 * mode is on. Returns the very object it was given when none is (so vanilla
 * stays bit-identical), otherwise a fixed copy.
 */
export function normalizeModeConfig(c: GameConfig): GameConfig {
  if (c.greatWar1914 !== true) return normalizeWorldWar1936Config(c);
  const out: GameConfig = { ...c };
  applyGreatWar1914Rules(out);
  return out;
}
