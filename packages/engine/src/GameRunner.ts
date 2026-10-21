import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  AllPlayers,
  BuildableUnit,
  GameType,
  GameUpdates,
  HumanStatsSnapshot,
  NameViewData,
  PlayerActions,
  PlayerBorderTiles,
  PlayerBuildableUnitType,
  PlayerID,
  PlayerInfo,
  PlayerProfile,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  ErrorUpdate,
  GameUpdateViewData,
} from "@openfront/engine-api/game/GameUpdates";
import { MapFiles } from "@openfront/engine-api/game/MapFiles";
import { ClientID, GameStartInfo, Turn } from "@openfront/engine-api/Schemas";
import { isDormantTag } from "@openfront/engine-api/ww1936/Countries";
import { loadTerrainMap } from "@openfront/engine-lib/game/TerrainMapLoader";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { simpleHash } from "@openfront/engine-lib/Util";
import { EngineConfig } from "./configuration/EngineConfig";
import { CongressExecution } from "./congress/CongressExecution";
import { DomesticExecution } from "./domestic/DomesticExecution";
import { DoomsdayClockExecution } from "./execution/DoomsdayClockExecution";
import { Executor } from "./execution/ExecutionManager";
import { PlayerExecution } from "./execution/PlayerExecution";
import { RecomputeRailClusterExecution } from "./execution/RecomputeRailClusterExecution";
import { SpawnTimerExecution } from "./execution/SpawnTimerExecution";
import { WinCheckExecution } from "./execution/WinCheckExecution";
import { Game, Player } from "./game/Game";
import { createGame } from "./game/GameImpl";
import { humanStatsSnapshot } from "./game/HumanStats";
import { placeName, placeSpawnName } from "./game/NameBoxCalculator";
import { createNationsForGame } from "./game/NationCreation";
import {
  readSnapshotHeader,
  restoreGame,
  snapshotGame,
} from "./snapshot/GameSnapshot";
import { StrategicExecution } from "./strategic/StrategicExecution";
import { declareWarBlock } from "./ww1936/Diplomacy";
import { scenarioPlayers } from "./ww1936/ScenarioPlayers";
import { WorldWarExecution } from "./ww1936/WorldWarExecution";
import { WorldWarStartExecution } from "./ww1936/WorldWarStartExecution";

export async function createGameRunner(
  gameStart: GameStartInfo,
  clientID: ClientID | undefined,
  map: MapFiles,
  callBack: (gu: GameUpdateViewData | ErrorUpdate) => void,
): Promise<GameRunner> {
  const config = new EngineConfig(gameStart.config, false, gameStart.listed);
  // The normalized config: World War 1936 fixes the map (spec §2.2). It is
  // the very gameStart.config object when the mode is off.
  const gameMap = await loadGameMap(config.gameConfig(), map);
  const random = new PseudoRandom(simpleHash(gameStart.gameID));

  let game: Game;
  if (config.worldWar1936()) {
    // World War 1936 (spec §7.1): every country of the scenario is a player.
    const scenario = gameMap.scenario;
    if (scenario === undefined) {
      throw new Error(
        "World War 1936 needs the world1936 regions and scenario files",
      );
    }
    const { players, nations } = scenarioPlayers(
      gameStart.players,
      scenario,
      random,
    );
    game = createGame(
      players,
      nations,
      gameMap.gameMap,
      gameMap.miniGameMap,
      config,
      gameMap.teamGameSpawnAreas,
      scenario,
    );
  } else {
    const humans = gameStart.players.map((p) => {
      return new PlayerInfo(
        p.username,
        PlayerType.Human,
        p.clientID,
        random.nextID(),
        p.isLobbyCreator ?? false,
        p.clanTag,
        p.friends ?? [],
        p.teamIndex ?? null,
      );
    });
    const nations = createNationsForGame(
      gameStart,
      gameMap.nations,
      gameMap.additionalNations,
      humans.length,
      random,
    );
    game = createGame(
      humans,
      nations,
      gameMap.gameMap,
      gameMap.miniGameMap,
      config,
      gameMap.teamGameSpawnAreas,
    );
  }

  const gr = new GameRunner(
    game,
    new Executor(
      game,
      gameStart.gameID,
      clientID,
      gameStart.tribes?.map((t) => t.name),
    ),
    callBack,
  );
  gr.init();
  return gr;
}

/** The game's maps, from its map's files (which the game takes over). */
function loadGameMap(
  config: Pick<GameStartInfo["config"], "gameMap" | "gameMapSize">,
  map: MapFiles,
) {
  if (map.map !== config.gameMap || map.mapSize !== config.gameMapSize) {
    throw new Error(
      `the game is on ${config.gameMap} (${config.gameMapSize}), ` +
        `the files passed are ${map.map} (${map.mapSize})`,
    );
  }
  return loadTerrainMap(map);
}

/**
 * Rebuilds a runner from a snapshot (see snapshot/README.md). The game resumes
 * at the snapshot's tick: the first turn added afterwards is the turn for
 * that tick. Only runtime details (game id, listing) come from `gameStart`;
 * the config, players and all state come from the snapshot.
 */
export async function createGameRunnerFromSnapshot(
  gameStart: GameStartInfo,
  snapshot: Uint8Array,
  clientID: ClientID | undefined,
  map: MapFiles,
  callBack: (gu: GameUpdateViewData | ErrorUpdate) => void,
): Promise<GameRunner> {
  const header = readSnapshotHeader(snapshot);
  const gameMap = await loadGameMap(header.gameConfig, map);
  const game = restoreGame(snapshot, {
    config: (gc) => new EngineConfig(gc, false, gameStart.listed),
    gameMap: gameMap.gameMap,
    miniGameMap: gameMap.miniGameMap,
    teamGameSpawnAreas: gameMap.teamGameSpawnAreas,
    scenario: gameMap.scenario,
  });
  // No init(): the snapshot already holds every execution init() adds.
  return new GameRunner(
    game,
    new Executor(
      game,
      gameStart.gameID,
      clientID,
      gameStart.tribes?.map((t) => t.name),
    ),
    callBack,
  );
}

export class GameRunner {
  private turns: Turn[] = [];
  private currTurn = 0;
  private isExecuting = false;

  private playerViewData: Record<PlayerID, NameViewData> = {};
  // Name placements are recomputed periodically; a runner that starts
  // mid-game (restored from a snapshot) computes them on its first tick.
  private viewDataStale = true;

  constructor(
    public game: Game,
    private execManager: Executor,
    private callBack: (gu: GameUpdateViewData | ErrorUpdate) => void,
  ) {}

  /**
   * Serializes the simulation at the current tick boundary. Turns that were
   * added but not executed yet are not part of it.
   */
  snapshot(gitCommit?: string): Uint8Array {
    if (this.isExecuting) {
      throw new Error("cannot snapshot while a tick is executing");
    }
    return snapshotGame(this.game, {
      gameID: this.execManager.gameID(),
      gitCommit,
    });
  }

  init() {
    // World War 1936 (plan decision 6): no spawn phase, no tribes, its own
    // clock before the win check.
    const ww = this.game.worldWar();
    if (ww !== null) {
      // P5 plan decision 5: woken countries' NationExecutions need the id.
      ww.endgame.setGameID(this.execManager.gameID());
      this.game.addExecution(new WorldWarStartExecution());
      for (const p of this.game.allPlayers()) {
        // P5 plan decision 4: a dormant slot gets its executions when it wakes.
        if (isDormantTag(ww.tagOf(p.smallID()))) continue;
        this.game.addExecution(new PlayerExecution(p));
      }
      if (this.game.config().spawnNations()) {
        this.game.addExecution(...this.execManager.nationExecutions());
      }
      this.game.addExecution(
        new WorldWarExecution(simpleHash(this.execManager.gameID()) + 1936),
      );
      this.game.addExecution(new WinCheckExecution());
      if (!this.game.config().isUnitDisabled(UnitType.Factory)) {
        this.game.addExecution(
          new RecomputeRailClusterExecution(this.game.railNetwork()),
        );
      }
      return;
    }
    if (this.game.config().gameConfig().gameType !== GameType.Singleplayer) {
      this.game.addExecution(new SpawnTimerExecution());
    }
    if (this.game.config().spawnNations()) {
      this.game.addExecution(...this.execManager.nationExecutions());
    }
    if (this.game.config().isRandomSpawn()) {
      this.game.addExecution(...this.execManager.spawnPlayers());
    }
    if (this.game.config().bots() > 0) {
      this.game.addExecution(
        ...this.execManager.spawnTribes(this.game.config().bots()),
      );
    }
    // Domestic mode only: its second runs before the win check, so a victory
    // project that completes this second is declared this second.
    if (this.game.config().domesticMode()) {
      this.game.addExecution(new DomesticExecution());
    }
    // Strategic weapons only: factory lines and satellites run on one clock.
    if (this.game.config().strategicWeapons()) {
      this.game.addExecution(new StrategicExecution());
    }
    // World congress only: after the domestic second, before the win check,
    // on its own PRNG (plan decision 10).
    if (this.game.config().congress()) {
      this.game.addExecution(
        new CongressExecution(simpleHash(this.execManager.gameID()) + 7919),
      );
    }
    this.game.addExecution(new WinCheckExecution());
    if (this.game.config().doomsdayClockConfig().enabled) {
      this.game.addExecution(new DoomsdayClockExecution());
    }
    if (!this.game.config().isUnitDisabled(UnitType.Factory)) {
      this.game.addExecution(
        new RecomputeRailClusterExecution(this.game.railNetwork()),
      );
    }
  }

  public addTurn(turn: Turn): void {
    this.turns.push(turn);
  }

  public executeNextTick(pendingTurns?: number): boolean {
    if (this.isExecuting) {
      return false;
    }
    if (this.currTurn >= this.turns.length) {
      return false;
    }
    this.isExecuting = true;

    this.game.addExecution(
      ...this.execManager.createExecs(this.turns[this.currTurn]),
    );
    this.currTurn++;

    const wasInSpawnPhase = this.game.inSpawnPhase();
    let updates: GameUpdates;
    let tickExecutionDuration: number;

    try {
      const startTime = performance.now();
      updates = this.game.executeNextTick();
      const endTime = performance.now();
      tickExecutionDuration = endTime - startTime;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("Game tick error:", error.message);
        this.callBack({
          errMsg: error.message,
          stack: error.stack,
        } as ErrorUpdate);
      } else {
        console.error("Game tick error:", error);
      }
      this.isExecuting = false;
      return false;
    }

    // Track whether placements were recomputed this tick — the record is
    // only attached to the update when it could have changed, so the main
    // thread doesn't structured-clone an identical ~all-players record on
    // every other tick.
    let viewDataChanged = false;
    if (this.game.inSpawnPhase()) {
      for (const p of this.game.players()) {
        if (p.type() !== PlayerType.Human && p.type() !== PlayerType.Nation) {
          continue;
        }
        if (p.spawnTile() === undefined) continue;
        this.playerViewData[p.id()] = placeSpawnName(this.game, p);
        viewDataChanged = true;
      }
    }

    const spawnJustEnded = wasInSpawnPhase && !this.game.inSpawnPhase();
    if (
      spawnJustEnded ||
      this.viewDataStale ||
      this.game.ticks() < 3 ||
      this.game.ticks() % 30 === 0
    ) {
      this.viewDataStale = false;
      for (const p of this.game.players()) {
        this.playerViewData[p.id()] = placeName(this.game, p);
      }
      viewDataChanged = true;
    }

    const packedTileUpdates = this.game.drainPackedTileUpdates();
    const packedMotionPlans = this.game.drainPackedMotionPlans();
    const packedPlayerUpdates = this.game.drainPackedPlayerUpdates();
    const packedAttackUpdates = this.game.drainPackedAttackUpdates();
    const nukeImpactTiles = this.game.drainNukeImpacts();
    const packedNukeImpacts =
      nukeImpactTiles.length > 0 ? new Uint32Array(nukeImpactTiles) : undefined;

    this.callBack({
      tick: this.game.ticks(),
      packedTileUpdates,
      ...(packedMotionPlans ? { packedMotionPlans } : {}),
      ...(packedPlayerUpdates ? { packedPlayerUpdates } : {}),
      ...(packedAttackUpdates ? { packedAttackUpdates } : {}),
      ...(packedNukeImpacts ? { packedNukeImpacts } : {}),
      updates: updates,
      // A copy: hosts hold several ticks' updates before reading them, and
      // the record changes in place on later ticks.
      ...(viewDataChanged
        ? { playerNameViewData: { ...this.playerViewData } }
        : {}),
      tickExecutionDuration: tickExecutionDuration,
      pendingTurns: pendingTurns ?? 0,
    });
    this.isExecuting = false;
    return true;
  }

  public pendingTurns(): number {
    return Math.max(0, this.turns.length - this.currTurn);
  }

  public playerBuildables(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[],
  ): BuildableUnit[] {
    const player = this.game.player(playerID);
    const tile =
      x !== undefined && y !== undefined ? this.game.ref(x, y) : null;
    return player.buildableUnits(tile, units);
  }

  public playerActions(
    playerID: PlayerID,
    x?: number,
    y?: number,
    units?: readonly PlayerBuildableUnitType[] | null,
  ): PlayerActions {
    const player = this.game.player(playerID);
    const tile =
      x !== undefined && y !== undefined ? this.game.ref(x, y) : null;
    const actions = {
      canAttack: tile !== null && player.canAttack(tile),
      buildableUnits: units === null ? [] : player.buildableUnits(tile, units),
      canSendEmojiAllPlayers: player.canSendEmoji(AllPlayers),
      canEmbargoAll: player.canEmbargoAll(),
    } as PlayerActions;

    if (tile !== null && this.game.hasOwner(tile)) {
      const other = this.game.owner(tile) as Player;
      const ww = this.game.worldWar();
      actions.interaction = {
        sharedBorder: player.sharesBorderWith(other),
        canSendEmoji: player.canSendEmoji(other),
        canTarget: player.canTarget(other),
        canSendAllianceRequest: player.canSendAllianceRequest(other),
        canBreakAlliance: player.isAlliedWith(other),
        canDonateGold: player.canDonateGold(other),
        canDonateTroops: player.canDonateTroops(other),
        canEmbargo: !player.hasEmbargoAgainst(other),
        allianceInfo: player.allianceInfo(other) ?? undefined,
        ...(ww === null
          ? {}
          : {
              canDeclareWar:
                declareWarBlock(
                  this.game,
                  ww,
                  player,
                  other,
                  this.game.ticks(),
                ) === null,
            }),
      };
      // World congress: the client still sends a tap on a truce partner, so
      // the engine can say why nothing happens (reportTruceRefusal).
      if (player.isTruceWith(other)) actions.interaction.truce = true;
    }

    return actions;
  }

  public playerProfile(playerID: number): PlayerProfile {
    const player = this.game.playerBySmallID(playerID);
    if (!player.isPlayer()) {
      throw new Error(`player with id ${playerID} not found`);
    }
    return player.playerProfile();
  }
  public humanStats(): HumanStatsSnapshot {
    return humanStatsSnapshot(this.game);
  }

  public playerBorderTiles(playerID: PlayerID): PlayerBorderTiles {
    const player = this.game.player(playerID);
    if (!player.isPlayer()) {
      throw new Error(`player with id ${playerID} not found`);
    }
    return {
      // Copy into a plain Set: this result crosses the worker boundary via
      // structured clone, which TileSet does not survive.
      borderTiles: new Set(player.borderTiles()),
    } as PlayerBorderTiles;
  }

  public attackClusteredPositions(
    playerID: number,
    attackID?: string,
  ): { id: string; positions: { x: number; y: number }[] }[] {
    const player = this.game.playerBySmallID(playerID);
    if (!player.isPlayer())
      throw new Error(`player with id ${playerID} not found`);
    const all = [...player.outgoingAttacks(), ...player.incomingAttacks()];
    const attacks = attackID ? all.filter((a) => a.id() === attackID) : all;

    return attacks.map((a) => ({
      id: a.id(),
      positions: a.clusteredPositions().map((tile) => ({
        x: this.game.map().x(tile),
        y: this.game.map().y(tile),
      })),
    }));
  }

  public bestTransportShipSpawn(
    playerID: PlayerID,
    targetTile: TileRef,
  ): TileRef | false {
    const player = this.game.player(playerID);
    if (!player.isPlayer()) {
      throw new Error(`player with id ${playerID} not found`);
    }
    return player.bestTransportShipSpawn(targetTile);
  }
}
