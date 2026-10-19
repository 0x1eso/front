import {
  GameMapSize,
  GameMapType,
  GameMode,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_GAME_MINUTES } from "@openfront/engine-api/ww1936/WorldWarTypes";

/** Units the mode turns off (spec §2.2): the atom bomb returns in P6. */
export const WW1936_DISABLED_UNITS: readonly UnitType[] = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
];

/**
 * World War 1936 (spec §2.2): in place, fixes a config whose mode is on.
 * Does nothing when the mode is off. The server runs it on its stored config.
 */
export function applyWorldWar1936Rules(c: GameConfig): void {
  if (c.worldWar1936 !== true) return;
  delete c.domesticMode;
  delete c.warfareExpansion;
  delete c.strategicWeapons;
  delete c.congress;
  delete c.conquestPercent;
  delete c.doomsdayClock;
  delete c.overtime;
  delete c.playerTeams;
  c.gameMap = GameMapType.World1936;
  c.gameMapSize = GameMapSize.Normal;
  c.gameMode = GameMode.FFA;
  c.bots = 0;
  c.randomSpawn = false;
  c.nations = "default";
  c.maxTimerValue = WW_GAME_MINUTES;
  c.customAllianceDuration = 0;
  c.spawnImmunityDuration = 0;
  c.historicalAi = c.historicalAi ?? true;
  const disabled = [...(c.disabledUnits ?? [])];
  for (const u of WW1936_DISABLED_UNITS) {
    if (!disabled.includes(u)) disabled.push(u);
  }
  c.disabledUnits = disabled;
}

/**
 * The config the engine, the server and the lobby play with. Returns the
 * very object it was given when the mode is off (so vanilla stays
 * bit-identical), otherwise a fixed copy.
 */
export function normalizeWorldWar1936Config(c: GameConfig): GameConfig {
  if (c.worldWar1936 !== true) return c;
  const out: GameConfig = { ...c };
  applyWorldWar1936Rules(out);
  return out;
}
