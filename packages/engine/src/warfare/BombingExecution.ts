import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { listNukeBreakAlliance } from "@openfront/engine-lib/execution/NukeAlliance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  BOMB_INNER,
  BOMB_OUTER,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";
import { samMissileClosingIn } from "./Interception";

/** Units a bomb never destroys: missiles in flight, bombers, barrage zones. */
const BLAST_PROOF: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRVWarhead,
  UnitType.MIRV,
  UnitType.SAMMissile,
  UnitType.Bomber,
  UnitType.CoastalBarrage,
]);

/** How far past the blast structures are redrawn (NukeExecution's sprite radius). */
const SPRITE_RADIUS = 16;

/**
 * Bombing (spec §14b): a bomber flies straight from the nearest airport
 * with a free sortie (SAMs may shoot it; it evades each interception with
 * 50%) and drops a small atom bomb: inner BOMB_INNER, outer BOMB_OUTER,
 * atom-bomb troop deaths and unit destruction, alliances broken like a
 * nuke's, and no fallout or water: the land just becomes unclaimed.
 */
export class BombingExecution implements Execution {
  private mg: Game;
  private active = true;
  private bomber: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.bomber === null) {
      this.launch(ticks);
      return;
    }
    if (!this.bomber.isActive()) {
      this.active = false;
      return;
    }
    const last = this.path.length - 1;
    if (this.step < last) {
      this.step++;
      this.bomber.move(this.path[this.step]);
      this.bomber.setTrajectoryIndex(this.step);
      if (this.step < last) return;
    }
    if (samMissileClosingIn(this.mg, this.bomber, this.dst)) return;
    this.detonate();
  }

  private launch(ticks: number): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.Bomber, this.dst);
    if (spawn === false) {
      if (!mg.config().isUnitDisabled(UnitType.Bomber)) {
        mg.displayMessage(
          "events_display.no_airport_available",
          MessageType.ATTACK_FAILED,
          this.player.id(),
        );
      }
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.Airport)
      .find((a) => a.tile() === spawn)
      ?.launch();
    this.path = straightFlightPath(mg, spawn, this.dst, PLANE_SPEED);
    this.bomber = this.player.buildUnit(UnitType.Bomber, spawn, {
      targetTile: this.dst,
      trajectory: this.path.map((tile) => ({ tile, targetable: true })),
    });
    mg.recordMotionPlan({
      kind: "grid",
      unitId: this.bomber.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
    this.breakAlliances();
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.bomber.id(),
        "events_display.bomber_inbound",
        MessageType.NUKE_INBOUND,
        target.id(),
      );
    }
  }

  /** As NukeExecution.maybeBreakAlliances, for the bomb's smaller blast. */
  private breakAlliances(): void {
    const mg = this.mg;
    const hit = listNukeBreakAlliance({
      game: mg,
      targetTile: this.dst,
      magnitude: { inner: BOMB_INNER, outer: BOMB_OUTER },
      threshold: mg.config().nukeAllianceBreakThreshold(),
    });
    for (const smallID of hit) {
      const other = mg.playerBySmallID(smallID);
      if (!other.isPlayer() || other === this.player) continue;
      const alliance = this.player.allianceWith(other);
      if (alliance !== null) this.player.breakAlliance(alliance);
      other.updateRelation(this.player, -100);
    }
  }

  private detonate(): void {
    const mg = this.mg;
    const config = mg.config();
    const bomber = this.bomber!;
    const rand = new PseudoRandom(mg.ticks());
    const inner2 = BOMB_INNER * BOMB_INNER;
    const outer2 = BOMB_OUTER * BOMB_OUTER;
    const tiles = mg.bfs(this.dst, (_, n: TileRef) => {
      const d2 = mg.euclideanDistSquared(this.dst, n);
      return (
        d2 <= outer2 && (d2 <= inner2 || rand.chance(2)) && !mg.isImpassable(n)
      );
    });

    const lostTiles = new Map<Player, number>();
    for (const tile of tiles) {
      const owner = mg.owner(tile);
      if (owner.isPlayer()) {
        owner.relinquish(tile);
        lostTiles.set(owner, (lostTiles.get(owner) ?? 0) + 1);
      }
      // No fallout and no water: only the crater picture.
      mg.queueNukeImpact(tile);
    }

    for (const [victim, lost] of lostTiles) {
      const tilesBefore = victim.numTilesOwned() + lost;
      const maxTroops = config.maxTroops(victim);
      const attacks = victim.outgoingAttacks();
      const boats = victim.units(UnitType.TransportShip);
      for (let i = 0; i < lost; i++) {
        const left = tilesBefore - i;
        const deaths = (troops: number) =>
          config.nukeDeathFactor(UnitType.AtomBomb, troops, left, maxTroops);
        victim.removeTroops(deaths(victim.troops()));
        for (const attack of attacks) {
          attack.setTroops(attack.troops() - deaths(attack.troops()));
        }
        for (const boat of boats) {
          boat.setTroops(boat.troops() - deaths(boat.troops()));
        }
      }
    }

    for (const unit of mg.units()) {
      if (BLAST_PROOF.has(unit.type()) || !unit.isActive()) continue;
      if (mg.euclideanDistSquared(this.dst, unit.tile()) < outer2) {
        const friendly = this.player.isFriendly(unit.owner(), true);
        unit.delete(true, friendly ? undefined : this.player);
      }
    }

    const redraw = (BOMB_OUTER + SPRITE_RADIUS) * (BOMB_OUTER + SPRITE_RADIUS);
    for (const unit of mg.units()) {
      if (
        Structures.has(unit.type()) &&
        mg.euclideanDistSquared(this.dst, unit.tile()) < redraw
      ) {
        unit.touch();
      }
    }

    bomber.setReachedTarget();
    bomber.delete(false);
    this.active = false;
    for (const [victim] of lostTiles) {
      mg.displayMessage(
        "events_display.bombing_detonated",
        MessageType.NUKE_DETONATED,
        victim.id(),
        undefined,
        { name: this.player.displayName() },
        undefined,
        this.player.id(),
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BombingExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      dst: this.dst,
      bomber: w.unitOrNull(this.bomber),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: BombingState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.dst = s.dst;
    this.bomber = r.unitOrNull(s.bomber);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const BombingStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  bomber: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type BombingState = z.infer<typeof BombingStateSchema>;

export const BombingExecutionSnapshot = execSnapshotType({
  name: "Bombing",
  version: 1,
  schema: BombingStateSchema,
  cls: () => BombingExecution,
});
