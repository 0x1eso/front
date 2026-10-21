import type {
  CongressData,
  PlayerCongressData,
} from "../congress/CongressTypes";
import type { DomesticData, WinReason } from "../domestic/DomesticTypes";
import { AllPlayersStats, ClientID, Winner } from "../Schemas";
import type { StrategicData } from "../strategic/StrategicTypes";
import type { WwAirData } from "../ww1936/AirTypes";
import type { WwEconomyData } from "../ww1936/EconomyTypes";
import type { WwEndgameData } from "../ww1936/EndgameTypes";
import type { WwLandData } from "../ww1936/LandTypes";
import type { WwNavyData } from "../ww1936/NavyTypes";
import type { WwPoliticsData } from "../ww1936/PoliticsTypes";
import type { WorldWarData } from "../ww1936/WorldWarTypes";
import { TileRef } from "./GameMap";
import {
  EmojiMessage,
  GameUpdates,
  Gold,
  MessageType,
  NameViewData,
  NukeState,
  PlayerID,
  PlayerType,
  SamLauncherState,
  Team,
  Tick,
  TrainType,
  TransportShipState,
  UnitType,
  WarshipState,
} from "./GameTypes";

export interface GameUpdateViewData {
  tick: number;
  updates: GameUpdates;
  /**
   * Packed tile updates as `[tileRef, state]` uint32 pairs.
   *
   * `tileRef` is a `TileRef` (fits in uint32), and `state` is the packed per-tile
   * state (`uint16`) stored in a `uint32` lane.
   */
  packedTileUpdates: Uint32Array;
  /**
   * Optional packed motion plan records.
   *
   * When present, this buffer is expected to be transferred worker -> main
   * (similar to `packedTileUpdates`) to avoid structured-clone copies.
   */
  packedMotionPlans?: Uint32Array;
  /**
   * Packed per-player numeric stats as
   * `[smallID, tilesOwned, gold, troops, goldEarned]`
   * float64 quints — the fields that change for nearly every alive player
   * every tick. They travel here (transferred, not structured-cloned) instead
   * of in `PlayerUpdate` object diffs, which only carry them on a player's
   * first emission. Gold is exact in a float64 (game values stay far below
   * 2^53). Absent when no player's stats changed.
   */
  packedPlayerUpdates?: Float64Array;
  /**
   * Packed attack troop-count changes as
   * `[ownerSmallID, direction, index, troops]` float64 quads, where
   * `direction` is 0 for the owner's outgoingAttacks and 1 for
   * incomingAttacks, and `index` addresses that array. Troop counts change
   * every tick for every active attack, so they travel here instead of
   * re-sending whole attack arrays in PlayerUpdate diffs; the arrays
   * themselves are only resent when membership/order/retreating changes —
   * which also guarantees the receiver's indexes line up (see
   * packAttackTroopDeltas). Absent when no attack troop count changed.
   */
  packedAttackUpdates?: Float64Array;
  /**
   * Name placement per player. Only present on ticks where the worker
   * recomputed placements (spawn ticks, the first ticks, every 30th tick,
   * spawn end) — between those the values wouldn't change, so the record is
   * omitted instead of re-cloned every tick. Consumers keep the last applied
   * values.
   */
  playerNameViewData?: Record<string, NameViewData>;
  tickExecutionDuration?: number;
  pendingTurns?: number;
  /**
   * Packed tile refs that were inside a nuke blast radius this tick.
   * Used by the renderer to mark nukeable layer tiles as destroyed.
   * Absent when no nukes detonated.
   */
  packedNukeImpacts?: Uint32Array;
}

/**
 * Direction lane of a `packedAttackUpdates` quad: which of the owner's attack
 * arrays the index addresses. Encoder (PlayerImpl.toUpdate →
 * packAttackTroopDeltas) and decoder (client GameView.update) must both use
 * these.
 */
export const ATTACK_DELTA_OUTGOING = 0;
export const ATTACK_DELTA_INCOMING = 1;

export interface ErrorUpdate {
  errMsg: string;
  stack?: string;
}

export enum GameUpdateType {
  // Tile updates are delivered via `packedTileUpdates` on the outer GameUpdateViewData.
  Tile,
  Unit,
  Player,
  DisplayEvent,
  DisplayChatEvent,
  AllianceRequest,
  AllianceRequestReply,
  BrokeAlliance,
  AllianceExpired,
  AllianceExtension,
  TargetPlayer,
  Emoji,
  Win,
  Hash,
  UnitIncoming,
  BonusEvent,
  RailroadDestructionEvent,
  RailroadConstructionEvent,
  RailroadSnapEvent,
  ConquestEvent,
  EmbargoEvent,
  SpawnPhaseEnd,
  GamePaused,
  DonateEvent,
  OrbitalStrike,
  BombDrop,
  Congress,
  WorldWar,
  WwEconomy,
  WwLand,
  WwPolitics,
  // World War 1936 P4 (P4 spec §19.4)
  WwNavy,
  WwAir,
  // World War 1936 P5 (P5 spec §21.4, plan decision 23)
  WwEndgame,
}

export type GameUpdate =
  | UnitUpdate
  | PlayerUpdate
  | AllianceRequestUpdate
  | AllianceRequestReplyUpdate
  | BrokeAllianceUpdate
  | AllianceExpiredUpdate
  | DisplayMessageUpdate
  | DisplayChatMessageUpdate
  | TargetPlayerUpdate
  | EmojiUpdate
  | WinUpdate
  | HashUpdate
  | UnitIncomingUpdate
  | AllianceExtensionUpdate
  | BonusEventUpdate
  | RailroadConstructionUpdate
  | RailroadDestructionUpdate
  | RailroadSnapUpdate
  | ConquestUpdate
  | EmbargoUpdate
  | SpawnPhaseEndUpdate
  | GamePausedUpdate
  | DonateEventUpdate
  | OrbitalStrikeUpdate
  | BombDropUpdate
  | CongressUpdate
  | WorldWarUpdate
  | WwEconomyUpdate
  | WwLandUpdate
  | WwPoliticsUpdate
  | WwNavyUpdate
  | WwAirUpdate
  | WwEndgameUpdate;

export interface BonusEventUpdate {
  type: GameUpdateType.BonusEvent;
  player: PlayerID;
  tile: TileRef;
  gold: number;
  troops: number;
}

export interface RailroadConstructionUpdate {
  type: GameUpdateType.RailroadConstructionEvent;
  id: number;
  tiles: TileRef[];
}

export interface RailroadDestructionUpdate {
  type: GameUpdateType.RailroadDestructionEvent;
  id: number;
}

export interface RailroadSnapUpdate {
  type: GameUpdateType.RailroadSnapEvent;
  originalId: number;
  newId1: number;
  newId2: number;
  tiles1: TileRef[];
  tiles2: TileRef[];
}

export interface ConquestUpdate {
  type: GameUpdateType.ConquestEvent;
  conquerorId: PlayerID;
  conqueredId: PlayerID;
  gold: Gold;
}

export interface DonateEventUpdate {
  type: GameUpdateType.DonateEvent;
  donationType: "troops" | "gold";
  senderId: PlayerID;
  recipientId: PlayerID;
  amount: bigint;
}

export interface UnitUpdate {
  type: GameUpdateType.Unit;
  unitType: UnitType;
  troops: number;
  id: number;
  ownerID: number;
  lastOwnerID?: number;
  // TODO: make these tilerefs
  pos: TileRef;
  lastPos: TileRef;
  isActive: boolean;
  reachedTarget: boolean;
  warshipState?: WarshipState;
  transportShipState?: TransportShipState;
  nukeState?: NukeState;
  targetable: boolean;
  markedForDeletion: number | false;
  targetUnitId?: number; // Only for trade ships
  targetTile?: TileRef; // Only for nukes
  health?: number;
  underConstruction?: boolean;
  /** Domestic mode: this structure's real build time, for the progress bar. */
  constructionTicks?: number;
  missileTimerQueue: number[];
  level: number;
  hasTrainStation: boolean;
  trainType?: TrainType; // Only for trains
  loaded?: boolean; // Only for trains
  samUpgrade?: SamLauncherState;
}

export interface AttackUpdate {
  attackerID: number;
  targetID: number;
  troops: number;
  id: string;
  retreating: boolean;
}

/**
 * Player snapshot delivered worker -> main thread.
 *
 * Only `type` and `id` are guaranteed. Every other field is omitted when its
 * value matches the previous emission for the same player. The first emission
 * for a player always includes all fields; consumers must handle subsequent
 * partial updates by merging into local state, not overwriting.
 *
 * When adding a field here, also wire it into diffPlayerUpdate() and
 * applyStateUpdate() in PlayerStateUpdate.ts — otherwise it is only ever sent on
 * the first emission and later changes are silently dropped.
 * Exceptions: `domestic` and `strategic` are not part of the renderer's
 * PlayerState; they are applied in PlayerView.applyUpdate() instead.
 */
export interface PlayerUpdate {
  type: GameUpdateType.Player;
  id: PlayerID;
  nameViewData?: NameViewData;
  clientID?: ClientID | null;
  name?: string;
  displayName?: string;
  clanTag?: string | null;
  nationFlag?: string | null;
  team?: Team;
  smallID?: number;
  playerType?: PlayerType;
  isAlive?: boolean;
  isDisconnected?: boolean;
  killedBy?: ClientID | null;
  deathPosition?: number | null;
  tilesOwned?: number;
  gold?: Gold;
  /** Cumulative ship-trade revenue (changes only on arrivals, so it diffs). */
  tradeGold?: Gold;
  /** Cumulative train revenue: own trains + external stops at own stations. */
  trainGold?: Gold;
  /** Cumulative piracy revenue: captured-ship payouts. */
  piracyGold?: Gold;
  /** Cumulative gold received from all sources (workers, trade, ...). */
  goldEarned?: Gold;
  troops?: number;
  allies?: number[];
  embargoes?: Set<PlayerID>;
  isTraitor?: boolean;
  traitorRemainingTicks?: number;
  inDoomsdayClock?: boolean;
  isDecaying?: boolean;
  markedDoomsdayClockTick?: number;
  targets?: number[];
  outgoingEmojis?: EmojiMessage[];
  outgoingAttacks?: AttackUpdate[];
  incomingAttacks?: AttackUpdate[];
  outgoingAllianceRequests?: PlayerID[];
  alliances?: AllianceView[];
  hasSpawned?: boolean;
  spawnTile?: TileRef;
  betrayals?: number;
  lastDeleteUnitTick?: Tick;
  isLobbyCreator?: boolean;
  /** Domestic mode only; absent for bots and outside domestic mode. */
  domestic?: DomesticData;
  /** Strategic weapons only: stockpile, factory lines, satellite. */
  strategic?: StrategicData;
  /** World congress only; absent for bots and when the option is off. */
  congress?: PlayerCongressData;
}

export interface AllianceView {
  id: number;
  other: PlayerID;
  createdAt: Tick;
  expiresAt: Tick;
  hasExtensionRequest: boolean;
}

export interface AllianceRequestUpdate {
  type: GameUpdateType.AllianceRequest;
  requestorID: number;
  recipientID: number;
  createdAt: Tick;
}

export interface AllianceRequestReplyUpdate {
  type: GameUpdateType.AllianceRequestReply;
  request: AllianceRequestUpdate;
  accepted: boolean;
}

export interface BrokeAllianceUpdate {
  type: GameUpdateType.BrokeAlliance;
  traitorID: number;
  betrayedID: number;
  allianceID: number;
}

export interface AllianceExpiredUpdate {
  type: GameUpdateType.AllianceExpired;
  player1ID: number;
  player2ID: number;
}

export interface AllianceExtensionUpdate {
  type: GameUpdateType.AllianceExtension;
  playerID: number;
  allianceID: number;
}

export interface TargetPlayerUpdate {
  type: GameUpdateType.TargetPlayer;
  playerID: number;
  targetID: number;
}

export interface EmojiUpdate {
  type: GameUpdateType.Emoji;
  emoji: EmojiMessage;
}

export interface DisplayMessageUpdate {
  type: GameUpdateType.DisplayEvent;
  message: string;
  messageType: MessageType;
  goldAmount?: bigint;
  playerID: number | null;
  params?: Record<string, string | number>;
  unitID?: number;
  focusPlayerID?: number;
}

export type DisplayChatMessageUpdate = {
  type: GameUpdateType.DisplayChatEvent;
  key: string;
  category: string;
  target: string | undefined;
  playerID: number | null;
  isFrom: boolean;
  recipient: string;
};

export interface WinUpdate {
  type: GameUpdateType.Win;
  allPlayersStats: AllPlayersStats;
  winner: Winner;
  /** Domestic mode: how the game was won. Absent in vanilla games. */
  reason?: WinReason;
}

export interface HashUpdate {
  type: GameUpdateType.Hash;
  tick: Tick;
  hash: number;
}

export interface UnitIncomingUpdate {
  type: GameUpdateType.UnitIncoming;
  unitID: number;
  message: string;
  messageType: MessageType;
  playerID: number;
}

export interface EmbargoUpdate {
  type: GameUpdateType.EmbargoEvent;
  event: "start" | "stop";
  playerID: number;
  embargoedID: number;
}

export interface SpawnPhaseEndUpdate {
  type: GameUpdateType.SpawnPhaseEnd;
  startTick: Tick;
}

export interface GamePausedUpdate {
  type: GameUpdateType.GamePaused;
  paused: boolean;
}

/**
 * Strategic weapons: an orbital strike landed. `impacts` are the crater
 * centers, then the struck building sites (render beams; the land and
 * buildings already changed through the usual updates).
 */
/**
 * Expanded warfare carpet bombing: one bomb of a bomber's line hit `tile`
 * (the land and buildings already changed through the usual updates).
 */
export interface BombDropUpdate {
  type: GameUpdateType.BombDrop;
  attackerID: number;
  tile: TileRef;
  /** 0-based index of this bomb in the run, and whether it is the last. */
  index: number;
  last: boolean;
}

export interface OrbitalStrikeUpdate {
  type: GameUpdateType.OrbitalStrike;
  attackerID: number;
  targetID: number;
  impacts: TileRef[];
  /** The strike lands in waves over a few seconds (spec §6.6): 0-based wave
   *  index, and whether this is the last wave. Absent on a one-shot strike. */
  wave?: number;
  lastWave?: boolean;
}

/** World congress: the whole congress, sent when it changed (and on a game's first tick). */
export interface CongressUpdate {
  type: GameUpdateType.Congress;
  data: CongressData;
}

/** World War 1936: wars, capitulations and the preparation end, when they changed. */
export interface WorldWarUpdate {
  type: GameUpdateType.WorldWar;
  data: WorldWarData;
}

/**
 * World War 1936 P1 (spec §14.4): the countries processed on this tick (and
 * any an order touched), the details of the human ones, the changed regions.
 */
export interface WwEconomyUpdate {
  type: GameUpdateType.WwEconomy;
  data: WwEconomyData;
}

/** World War 1936 P2: the land war's changes of the tick (P2 spec §16.4). */
export interface WwLandUpdate {
  type: GameUpdateType.WwLand;
  data: WwLandData;
}

/** World War 1936 P3: politics' changes of the tick (P3 spec §22.4). */
export interface WwPoliticsUpdate {
  type: GameUpdateType.WwPolitics;
  data: WwPoliticsData;
}

/** World War 1936 P4: the navy's changes of the tick (P4 spec §19.4). */
export interface WwNavyUpdate {
  type: GameUpdateType.WwNavy;
  data: WwNavyData;
}

/** World War 1936 P4: the air war's changes of the tick (P4 spec §19.4). */
export interface WwAirUpdate {
  type: GameUpdateType.WwAir;
  data: WwAirData;
}

/** World War 1936 P5: the endgame's changes of the tick (P5 spec §21.4). */
export interface WwEndgameUpdate {
  type: GameUpdateType.WwEndgame;
  data: WwEndgameData;
}
