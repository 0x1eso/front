import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  Difficulty,
  PlayerType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  readVersioned,
  snapshotType,
  Versioned,
  zInt,
  zRandom,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  airportRange,
  BARRAGE_SUPPRESSION_TICKS,
  BOMB_OUTER,
  COASTAL_BATTERY_RANGE,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Game, Player, Unit } from "../../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../../snapshot/SnapshotContext";
import { BombingExecution } from "../../warfare/BombingExecution";
import { ParadropExecution } from "../../warfare/ParadropExecution";
import { ConstructionExecution } from "../ConstructionExecution";
import { nationDomesticPlan } from "./NationPersonality";
import { randTerritoryTileArray } from "./NationUtils";
import { nationHoldsStructuresForProject } from "./NationVictoryBehavior";

/** How a nation uses expanded warfare (spec §14b; personalities §9.1). */
export interface WarfareStyle {
  /** Most coastal batteries it keeps. */
  maxBatteries: number;
  /** Also builds batteries on a quiet coast when gold allows. */
  proactiveBatteries: boolean;
  /** Most airports it builds. */
  maxAirports: number;
  /** Gold kept back beyond an airport's, battery's or bomb's price. */
  reserve: bigint;
  /** 1 in N chance per action tick to fly a ready sortie. */
  sortieOdds: number;
  /** Bombs rather than paradrops when it can do both. */
  prefersBombing: boolean;
}

const DEFAULT_STYLE: WarfareStyle = {
  maxBatteries: 4,
  proactiveBatteries: false,
  maxAirports: 1,
  reserve: 2_000_000n,
  sortieOdds: 3,
  prefersBombing: false,
};

/**
 * In domestic mode conquerors lean on airports, bombing and barrages and
 * zealots on coastal batteries; everyone else, and every nation outside
 * domestic mode, plays the default.
 */
export function warfareStyle(player: Player): WarfareStyle {
  if (player.domestic() === null) return DEFAULT_STYLE;
  switch (nationDomesticPlan(player.id()).personality) {
    case "conqueror":
      return {
        maxBatteries: 3,
        proactiveBatteries: false,
        maxAirports: 2,
        reserve: 1_000_000n,
        sortieOdds: 2,
        prefersBombing: true,
      };
    case "zealot":
      return {
        maxBatteries: 8,
        proactiveBatteries: true,
        maxAirports: 1,
        reserve: 4_000_000n,
        sortieOdds: 4,
        prefersBombing: false,
      };
    default:
      return DEFAULT_STYLE;
  }
}

/**
 * A nation's expanded-warfare play (spec §14b), once per action tick:
 * coastal batteries where enemy boats land (all difficulties), then on
 * Medium and up an airport when rich and sorties at the biggest structure
 * across the water; on Hard and up a barrage at any battery covering one
 * of its own landings. Built only when the option is on, on its own PRNG.
 */
export class NationWarfareBehavior {
  /** When each aimed battery tile was last shelled. */
  private lastBarrage = new Map<TileRef, number>();
  /** The nation's attack gate (relations, difficulty), set each tick. */
  private shouldAttack: ((other: Player) => boolean) | null = null;

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  tick(
    projectKind: VictoryProjectKind | null,
    shouldAttack?: (other: Player) => boolean,
  ): void {
    this.shouldAttack = shouldAttack ?? null;
    if (!this.player.isAlive()) return;
    // Saving for a victory project: build and fire nothing (spec §9.3).
    if (nationHoldsStructuresForProject(this.game, this.player, projectKind)) {
      return;
    }
    const style = warfareStyle(this.player);
    const difficulty = this.game.config().gameConfig().difficulty;
    // One gold-spending action a tick: each is checked against the gold the
    // earlier ones have not yet taken.
    if (this.maybeBuildCoastalBattery(style)) return;
    if (difficulty === Difficulty.Easy) return;
    if (
      (difficulty === Difficulty.Hard ||
        difficulty === Difficulty.Impossible) &&
      this.maybeBarrageLandings()
    ) {
      return;
    }
    if (this.maybeBuildAirport(style)) return;
    this.maybeSortie(style);
  }

  maybeBuildCoastalBattery(style: WarfareStyle): boolean {
    if (
      this.player.units(UnitType.CoastalBattery).length >= style.maxBatteries
    ) {
      return false;
    }
    const tile =
      this.threatenedShore() ??
      (style.proactiveBatteries ? this.quietShore(style) : null);
    if (tile === null) return false;
    const covered = (COASTAL_BATTERY_RANGE / 2) ** 2;
    if (
      this.player
        .units(UnitType.CoastalBattery)
        .some((b) => this.game.euclideanDistSquared(b.tile(), tile) <= covered)
    ) {
      return false;
    }
    if (this.player.canBuild(UnitType.CoastalBattery, tile) === false) {
      return false;
    }
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.CoastalBattery, tile),
    );
    return true;
  }

  maybeBuildAirport(style: WarfareStyle): boolean {
    if (this.player.units(UnitType.Airport).length >= style.maxAirports) {
      return false;
    }
    const cost = this.game
      .unitInfo(UnitType.Airport)
      .cost(this.game, this.player);
    if (this.player.gold() < cost + style.reserve) return false;
    // On the coast when it can, so its planes reach across the water.
    const tile = this.randomShoreTile() ?? this.randomOwnTile();
    if (tile === null) return false;
    if (this.player.canBuild(UnitType.Airport, tile) === false) return false;
    this.game.addExecution(
      new ConstructionExecution(this.player, UnitType.Airport, tile),
    );
    return true;
  }

  maybeBarrageLandings(): boolean {
    const now = this.game.ticks();
    for (const [tile, at] of this.lastBarrage) {
      if (now - at >= BARRAGE_SUPPRESSION_TICKS) this.lastBarrage.delete(tile);
    }
    for (const boat of this.player.units(UnitType.TransportShip)) {
      if (boat.transportShipState().isRetreating) continue;
      const dst = boat.targetTile();
      if (dst === undefined) continue;
      const battery = this.game
        .nearbyUnits(dst, COASTAL_BATTERY_RANGE, UnitType.CoastalBattery)
        .filter(
          ({ unit }) =>
            unit.owner() !== this.player &&
            !this.player.isFriendly(unit.owner()),
        )
        .sort(
          (a, b) => a.distSquared - b.distSquared || a.unit.id() - b.unit.id(),
        )[0]?.unit;
      if (battery === undefined || this.lastBarrage.has(battery.tile())) {
        continue;
      }
      if (
        this.player.canBuild(UnitType.CoastalBarrage, battery.tile()) === false
      ) {
        continue;
      }
      this.game.addExecution(
        new ConstructionExecution(
          this.player,
          UnitType.CoastalBarrage,
          battery.tile(),
        ),
      );
      this.lastBarrage.set(battery.tile(), now);
      return true;
    }
    return false;
  }

  maybeSortie(style: WarfareStyle): boolean {
    const airport = this.player
      .units(UnitType.Airport)
      .find(
        (a) => a.isActive() && !a.isUnderConstruction() && !a.isInCooldown(),
      );
    if (airport === undefined || !this.random.chance(style.sortieOdds)) {
      return false;
    }
    const target = this.strikeTarget(airport);
    if (target === null) return false;
    const tile = target.tile();
    const bombCost = this.game
      .unitInfo(UnitType.Bomber)
      .cost(this.game, this.player);
    const canBomb =
      this.player.gold() >= bombCost + style.reserve &&
      this.player.canBuild(UnitType.Bomber, tile) !== false &&
      this.blastKeepsFriends(tile, target.owner());
    const troops = Math.floor(this.player.troops() / 4);
    const canDrop =
      troops > target.owner().troops() / 10 &&
      this.player.canBuild(UnitType.TransportPlane, tile) !== false;
    if (canBomb && (style.prefersBombing || !canDrop)) {
      this.game.addExecution(new BombingExecution(this.player, tile));
      return true;
    }
    if (canDrop) {
      this.game.addExecution(new ParadropExecution(this.player, troops, tile));
      return true;
    }
    return false;
  }

  /**
   * No friendly player (AFK ones too) has land in the blast, and on Easy and
   * Medium no third player's land either (as NationNukeBehavior's tiles).
   */
  private blastKeepsFriends(tile: TileRef, victim: Player): boolean {
    const game = this.game;
    const hard =
      game.config().gameConfig().difficulty === Difficulty.Hard ||
      game.config().gameConfig().difficulty === Difficulty.Impossible;
    const outer2 = BOMB_OUTER * BOMB_OUTER;
    const tiles = game.bfs(
      tile,
      (_, n: TileRef) =>
        game.euclideanDistSquared(tile, n) <= outer2 && !game.isImpassable(n),
    );
    for (const t of tiles) {
      const owner = game.owner(t);
      if (!owner.isPlayer() || owner === victim) continue;
      if (owner === this.player) return false;
      if (!hard || this.player.isFriendly(owner, true)) return false;
    }
    return true;
  }

  /** The biggest non-friendly structure in range across the water (no shared border). */
  private strikeTarget(airport: Unit): Unit | null {
    const candidates = this.game
      .nearbyUnits(
        airport.tile(),
        airportRange(airport.level()),
        Structures.types,
      )
      .filter(({ unit }) => {
        const owner = unit.owner();
        return (
          owner !== this.player &&
          owner.type() !== PlayerType.Bot &&
          !this.player.isFriendly(owner, true) &&
          !this.player.sharesBorderWith(owner)
        );
      })
      .sort(
        (a, b) =>
          b.unit.level() - a.unit.level() ||
          a.distSquared - b.distSquared ||
          a.unit.id() - b.unit.id(),
      );
    // Only players the nation would attack anyway (relations, difficulty).
    const gate = new Map<Player, boolean>();
    for (const { unit } of candidates) {
      const owner = unit.owner();
      let ok = gate.get(owner);
      if (ok === undefined) {
        ok = this.shouldAttack === null || this.shouldAttack(owner);
        gate.set(owner, ok);
      }
      if (ok) return unit;
    }
    return null;
  }

  /** Where an enemy transport ship is heading on this nation's land. */
  private threatenedShore(): TileRef | null {
    for (const boat of this.game.units(UnitType.TransportShip)) {
      const owner = boat.owner();
      if (owner === this.player || this.player.isFriendly(owner)) continue;
      const dst = boat.targetTile();
      if (dst !== undefined && this.game.owner(dst) === this.player) {
        return dst;
      }
    }
    return null;
  }

  /** Zealots: a random own shore tile while gold is plentiful. */
  private quietShore(style: WarfareStyle): TileRef | null {
    const cost = this.game
      .unitInfo(UnitType.CoastalBattery)
      .cost(this.game, this.player);
    if (this.player.gold() < cost + style.reserve) return null;
    return this.randomShoreTile();
  }

  private randomShoreTile(): TileRef | null {
    const shore: TileRef[] = [];
    this.player.borderTiles().forEach((t) => {
      if (this.game.isShore(t)) shore.push(t);
    });
    if (shore.length === 0) return null;
    return shore[this.random.nextInt(0, shore.length)];
  }

  private randomOwnTile(): TileRef | null {
    return (
      randTerritoryTileArray(this.random, this.game, this.player, 1)[0] ?? null
    );
  }

  snapshot(w: SnapshotWriter): Versioned {
    return w.versioned(NationWarfareBehaviorSnapshot, {
      random: w.random(this.random),
      lastBarrage: [...this.lastBarrage],
    });
  }

  /** Fills a prototype-only shell; only assigns. */
  restoreSnapshot(raw: unknown, r: SnapshotReader, player: Player): void {
    const s = readVersioned(NationWarfareBehaviorSnapshot, raw);
    this.random = r.random(s.random);
    this.game = r.game;
    this.player = player;
    this.lastBarrage = new Map(s.lastBarrage);
  }
}

export const NationWarfareBehaviorSnapshot = snapshotType({
  name: "NationWarfareBehavior",
  version: 1,
  schema: z.object({
    random: zRandom(),
    lastBarrage: z.array(z.tuple([zTile(), zInt()])),
  }),
});
