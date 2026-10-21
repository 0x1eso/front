import { GameMapType } from "@openfront/engine-api/game/GameTypes";
import { GameConfig, GameConfigPatch } from "@openfront/engine-api/Schemas";
import { applyWorldWar1936Rules } from "@openfront/engine-lib/ww1936/ModeConfig";

// The host edits its lobby through update_game_config, which carries a
// partial GameConfig. Only the keys listed here are taken from it. gameType
// and the listing flag are deliberately absent: each has its own guarded path
// (handleIntent rejects a switch to Public; listing goes through the
// authenticated listing endpoint). `pool` is absent because every member of
// a pool has to agree on it and a patch reaches exactly one GameServer.
// maxPlayers is handled on its own below.

// Copied whenever the patch carries them.
const COPIED_KEYS = [
  "gameMap",
  "gameMapSize",
  "difficulty",
  "nations",
  "bots",
  "infiniteGold",
  "donateGold",
  "infiniteTroops",
  "donateTroops",
  "instantBuild",
  "randomSpawn",
  "gameMode",
  "disabledUnits",
  "playerTeams",
  "allowedPublicIds",
  "trusted",
  "doomsdayClock",
  "overtime",
  "anonymizeNames",
  "nameReveals",
  "nameRevealPublicIds",
  "domesticMode",
  "warfareExpansion",
  "strategicWeapons",
  "congress",
  "worldWar1936",
  "historicalAi",
  // P6 (plan decision 21): the atomic bomb.
  "ww1936Nukes",
] as const satisfies readonly (keyof GameConfig)[];

// `.nullable().optional()` in the schema: the wire says null to clear a
// value, the stored config says undefined.
const NULLABLE_KEYS = [
  "maxTimerValue",
  "startDelay",
  "spawnImmunityDuration",
  "goldMultiplier",
  "startingGold",
  "disableAlliances",
  "customAllianceDuration",
  "waterNukes",
  "conquestPercent",
] as const satisfies readonly (keyof GameConfig)[];

type NullableKey = (typeof NULLABLE_KEYS)[number];

function copy<K extends keyof GameConfig>(
  target: GameConfig,
  patch: Partial<GameConfig>,
  key: K,
): void {
  const value = patch[key];
  if (value !== undefined) {
    target[key] = value;
  }
}

function copyNullable<K extends NullableKey>(
  target: GameConfig,
  patch: Partial<GameConfig>,
  key: K,
): void {
  const value = patch[key];
  if (value !== undefined) {
    // Every NULLABLE_KEY is optional in GameConfig, so undefined is legal
    // for it; TypeScript cannot see that through the generic key.
    target[key] = (value ?? undefined) as GameConfig[K];
  }
}

// Applies a host's config patch to a game's stored config, in place.
export function applyGameConfigPatch(
  target: GameConfig,
  patch: GameConfigPatch,
): void {
  // maxPlayers is nullable on the wire but not in GameConfig, so it is split
  // off and applied on its own below.
  const { maxPlayers, ...rest } = patch;
  for (const key of COPIED_KEYS) {
    copy(target, rest, key);
  }
  for (const key of NULLABLE_KEYS) {
    copyNullable(target, rest, key);
  }
  // The host's player cap: null lifts it, undefined leaves it alone. Lowering
  // it below the seated count kicks no one; it only turns away further
  // players (spectators never count, see GameServer.joinClient).
  if (maxPlayers !== undefined) {
    target.maxPlayers = maxPlayers ?? undefined;
  }
  // Unconditional on purpose: the host clears cheats by omitting hostCheats
  // (the full config it sends has hostCheats: undefined when the toggle is
  // off), so `undefined` here means "clear", not "leave unchanged".
  target.hostCheats = patch.hostCheats;
  // World War 1936: whatever else the patch carried.
  applyWorldWar1936ServerRules(target);
}

/**
 * World War 1936 (spec §2.2), on a stored config: the mode fixes the map,
 * the rules and the other modes. Without the mode its map is not offered.
 */
export function applyWorldWar1936ServerRules(target: GameConfig): void {
  if (target.worldWar1936 === true) {
    applyWorldWar1936Rules(target);
  } else if (target.gameMap === GameMapType.World1936) {
    target.gameMap = GameMapType.World;
  }
}

// Whether the host-only cheat block actually grants anything: mere presence
// isn't enough, the client can send hostCheats with every field off.
export function hostCheatsEnabled(hc: GameConfig["hostCheats"]): boolean {
  return (
    hc !== undefined &&
    (hc.infiniteGold === true ||
      hc.infiniteTroops === true ||
      typeof hc.goldMultiplier === "number" ||
      typeof hc.startingGold === "number")
  );
}
