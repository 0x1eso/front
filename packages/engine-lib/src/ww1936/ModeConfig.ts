import {
  GameMapSize,
  GameMapType,
  GameMode,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameConfig } from "@openfront/engine-api/Schemas";
import { WW_GAME_MINUTES } from "@openfront/engine-api/ww1936/WorldWarTypes";
import { wwDifficulty } from "./AiDifficulty";
import { wwUnlimited } from "./Pace";
import { imjinCalendarOf, isImjin } from "./scenario/Profile";

/**
 * ww177: the Imjin War's map (I0b builds it as `imjin1592`). Read by name so
 * this lane builds before the map lands; until then the 1936 map stands in.
 */
export const IMJIN_MAP: GameMapType =
  (GameMapType as unknown as Record<string, GameMapType | undefined>)[
    "Imjin1592"
  ] ?? GameMapType.World1936;

/** Design §10: two seats; the AI plays every other country. */
export const IMJIN_MAX_PLAYERS = 2;

/**
 * ww177 (Imjin design §2, §10): the Imjin profile's fixes, after the 1936
 * ones. Its map, its calendar row (timer and tempo), two seats, no
 * historical AI and none of the systems the profile switches off.
 */
function applyImjinRules(c: GameConfig): void {
  const cal = imjinCalendarOf(c);
  c.gameMap = IMJIN_MAP;
  c.imjinCalendar = cal.id;
  delete c.ww1936FastTempo;
  if (cal.minutes === null) {
    c.ww1936Unlimited = true;
    delete c.maxTimerValue;
  } else {
    delete c.ww1936Unlimited;
    c.maxTimerValue = cal.minutes;
  }
  c.historicalAi = false;
  c.ww1936Nukes = false;
  delete c.ww1936Designer;
  c.maxPlayers = Math.min(c.maxPlayers ?? IMJIN_MAX_PLAYERS, IMJIN_MAX_PLAYERS);
}

/**
 * Units the mode turns off (spec §2.2): the atom bomb returns in P6. Cities
 * and vanilla factories go with P1's economy (P1 spec §4.6); boats, defence
 * posts and trade ships with P2's armies (P2 plan decision 7: landings are
 * P4's, forts replace the posts, convoys replace the trade ships), warships
 * and ports with P4's navy (P4 plan decision 30).
 */
export const WW1936_DISABLED_UNITS: readonly UnitType[] = [
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRV,
  UnitType.MissileSilo,
  UnitType.SAMLauncher,
  UnitType.City,
  UnitType.Factory,
  UnitType.TransportShip,
  UnitType.DefensePost,
  UnitType.TradeShip,
  // P4 plan decision 30: the mode's own fleets and naval bases replace them.
  UnitType.Warship,
  UnitType.Port,
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
  // The unlimited game has no timer (Pace.ts); the timed one plays 50 minutes (WW_GAME_MINUTES).
  if (wwUnlimited(c)) {
    delete c.maxTimerValue;
  } else {
    c.maxTimerValue = WW_GAME_MINUTES;
  }
  c.customAllianceDuration = 0;
  c.spawnImmunityDuration = 0;
  c.historicalAi = c.historicalAi ?? true;
  // P6 (spec §9.8, plan decision 21): the atomic bomb, on unless the host
  // turned it off (nothing reads it outside the mode).
  c.ww1936Nukes = c.ww1936Nukes ?? true;
  // The lobby's difficulty sets the AI countries' handicaps (AiDifficulty):
  // Easy when none was chosen, Impossible plays as Hard.
  c.difficulty = wwDifficulty(c.difficulty);
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
  // Nukes are off in this mode (spec §2.2): their water switch goes too.
  delete c.waterNukes;
  const disabled = [...(c.disabledUnits ?? [])];
  for (const u of WW1936_DISABLED_UNITS) {
    if (!disabled.includes(u)) disabled.push(u);
  }
  c.disabledUnits = disabled;
  if (isImjin(c)) applyImjinRules(c);
  else delete c.imjinCalendar;
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

/**
 * World War 1936: the tank, plane and ship designer is on only when the
 * config says so (`ww1936Designer`); absent means off, and the historical
 * equipment catalogue (hist/) replaces it.
 */
export function wwDesigner(c: Pick<GameConfig, "ww1936Designer">): boolean {
  return c.ww1936Designer === true;
}
