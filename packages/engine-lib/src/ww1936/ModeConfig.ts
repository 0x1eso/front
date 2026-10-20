import {
  Difficulty,
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
  // The AI plays its wars at one level in this mode (owner decision,
  // 2026-10-20): the lobby shows no difficulty for it.
  c.difficulty = Difficulty.Medium;
  // Faction members help each other; a neutral still gets nothing
  // (isFriendly is the faction, spec §7.2).
  c.donateGold = true;
  c.donateTroops = true;
  // The lobby hides these controls in this mode, so a value left from
  // another game must not carry over.
  c.infiniteGold = false;
  c.infiniteTroops = false;
  delete c.goldMultiplier;
  delete c.startingGold;
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
