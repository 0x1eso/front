import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  TrajectoryTile,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zNum,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, isUnit, Player, Unit } from "../game/Game";
import { UniversalPathFinding } from "../pathfinding/PathFinder";
import { ParabolaUniversalPathFinder } from "../pathfinding/PathFinder.Parabola";
import { PathStatus } from "../pathfinding/types";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import {
  ParabolaSchema,
  parabolaState,
  restoreParabola,
} from "../snapshot/PathfinderSnapshots";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceProductionLost } from "./Production";

/**
 * A conventional missile (spec §5): from the nearest loaded silo to the
 * enemy structure nearest the aimed tile, on a nuke's arc, so SAMs shoot
 * it like a nuke. On impact the structure loses one level (a level-1 one
 * is destroyed) and a factory loses every nuke in production. No blast,
 * no fallout, no alliance break. A structure that has turned friendly or
 * the shooter's own by then is spared.
 */
export class ConventionalMissileExecution implements Execution {
  private active = true;
  private mg: Game;
  private pathFinder: ParabolaUniversalPathFinder;
  private missile: Unit | null = null;
  private target: Unit | null = null;
  private src: TileRef | null = null;
  /** The target's tile, set at launch. */
  private dst: TileRef = 0;
  private speed = 0;
  private waitTicks = 0;

  constructor(
    private player: Player,
    private aim: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    this.speed = mg.config().nukeSpeed(UnitType.ConventionalMissile);
    this.pathFinder = UniversalPathFinding.Parabola(mg, {
      increment: this.speed,
      directionUp: true,
    });
  }

  tick(ticks: number): void {
    if (this.missile === null) {
      this.launch(ticks);
      return;
    }
    // Intercepted by a SAM.
    if (!this.missile.isActive()) {
      this.active = false;
      return;
    }
    if (this.waitTicks > 0) {
      this.missile.updateNukeState({ waitTicks: --this.waitTicks });
      return;
    }
    const result = this.pathFinder.next(this.src!, this.dst, this.speed);
    if (result.status === PathStatus.COMPLETE) {
      this.missile.move(result.node);
      // As NukeExecution: a SAM missile about to hit it decides first.
      if (!this.samMissileClose()) this.strike();
    } else if (result.status === PathStatus.NEXT) {
      this.missile.setTargetable(this.isTargetable(this.missile.tile()));
      this.missile.move(result.node);
      this.missile.setTrajectoryIndex(this.pathFinder.currentIndex());
    }
  }

  private launch(ticks: number): void {
    const spawn = this.player.canBuild(UnitType.ConventionalMissile, this.aim);
    const target = spawn === false ? null : this.player.missileTarget(this.aim);
    if (spawn === false || target === null) {
      this.active = false;
      return;
    }
    this.src = spawn;
    this.target = target;
    this.dst = target.tile();
    const silo = this.player
      .units(UnitType.MissileSilo)
      .find((s) => s.tile() === spawn);
    if (silo !== undefined) {
      // Same stagger as NukeExecution for launches from one silo in a tick.
      let lastDep = 0;
      for (const launchTick of silo.missileTimerQueue()) {
        lastDep = Math.max(launchTick + 1, lastDep + 1);
      }
      if (lastDep > this.mg.ticks()) {
        this.waitTicks += lastDep - this.mg.ticks();
      }
    }
    this.missile = this.player.buildUnit(UnitType.ConventionalMissile, spawn, {
      targetTile: this.dst,
      trajectory: this.trajectory(),
      targetUnit: target,
    });
    this.missile.updateNukeState({ waitTicks: this.waitTicks });
    this.recordMotionPlan(ticks);
    this.mg.displayIncomingUnit(
      this.missile.id(),
      "events_display.conventional_missile_inbound",
      MessageType.NUKE_INBOUND,
      target.owner().id(),
    );
    silo?.launch();
  }

  private strike(): void {
    const missile = this.missile!;
    const target = this.target!;
    this.active = false;
    missile.setReachedTarget();
    missile.delete(false);
    if (!target.isActive()) return;
    const owner = target.owner();
    if (owner === this.player || this.player.isFriendly(owner, true)) return;
    if ((owner.strategic()?.cancelJobsAt(target.id()) ?? 0) > 0) {
      announceProductionLost(this.mg, owner);
    }
    target.decreaseLevel(this.player);
    this.mg.displayMessage(
      "events_display.conventional_missile_hit",
      MessageType.NUKE_DETONATED,
      owner.id(),
      undefined,
      { name: this.player.displayName() },
      undefined,
      this.player.id(),
    );
  }

  private samMissileClose(): boolean {
    const missile = this.missile!;
    return (
      this.mg.nearbyUnits(
        this.dst,
        this.mg.config().defaultSamMissileSpeed(),
        UnitType.SAMMissile,
        ({ unit }) =>
          isUnit(unit) &&
          unit.owner() !== missile.owner() &&
          unit.targetUnit()?.id() === missile.id(),
      ).length > 0
    );
  }

  private trajectory(): TrajectoryTile[] {
    return (this.pathFinder.findPath(this.src!, this.dst) ?? []).map(
      (tile) => ({ tile, targetable: this.isTargetable(tile) }),
    );
  }

  /** Like a nuke: SAMs can reach it near its silo and near its target. */
  private isTargetable(tile: TileRef): boolean {
    const r2 = this.mg.config().defaultNukeTargetableRange() ** 2;
    return (
      this.mg.euclideanDistSquared(tile, this.dst) < r2 ||
      this.mg.euclideanDistSquared(this.src!, tile) < r2
    );
  }

  /** As NukeExecution.recordMotionPlan: the client derives the position each tick. */
  private recordMotionPlan(ticks: number): void {
    const pathFinder = UniversalPathFinding.Parabola(this.mg, {
      increment: this.speed,
      directionUp: true,
    });
    const path: TileRef[] = [this.src!];
    let result = pathFinder.next(this.src!, this.dst, this.speed);
    while (result.status === PathStatus.NEXT) {
      path.push(result.node);
      result = pathFinder.next(this.src!, this.dst, this.speed);
    }
    this.mg.recordMotionPlan({
      kind: "grid",
      unitId: this.missile!.id(),
      planId: 1,
      startTick: ticks + this.waitTicks + 1,
      ticksPerStep: 1,
      path,
    });
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ConventionalMissileExecutionSnapshot.write({
      active: this.active,
      // mg and the pathfinder are both set by init.
      pathFinder: this.mg === undefined ? null : parabolaState(this.pathFinder),
      player: w.player(this.player),
      aim: this.aim,
      missile: w.unitOrNull(this.missile),
      target: w.unitOrNull(this.target),
      src: this.src,
      dst: this.dst,
      speed: this.speed,
      waitTicks: this.waitTicks,
    });
  }

  restoreSnapshot(s: ConventionalMissileState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.pathFinder !== null) {
      this.mg = r.game;
      this.pathFinder = restoreParabola(r.game, s.pathFinder);
    }
    this.player = r.player(s.player);
    this.aim = s.aim;
    this.missile = r.unitOrNull(s.missile);
    this.target = r.unitOrNull(s.target);
    this.src = s.src;
    this.dst = s.dst;
    this.speed = s.speed;
    this.waitTicks = s.waitTicks;
  }
}

const ConventionalMissileStateSchema = z.object({
  active: z.boolean(),
  pathFinder: ParabolaSchema.nullable(),
  player: zPlayerRef(),
  // Validated by ConstructionExecution.init before the missile exists.
  aim: zInt(),
  missile: zRef().nullable(),
  target: zRef().nullable(),
  src: zTile().nullable(),
  dst: zInt(),
  speed: zNum(),
  waitTicks: zInt(),
});
type ConventionalMissileState = z.infer<typeof ConventionalMissileStateSchema>;

export const ConventionalMissileExecutionSnapshot = execSnapshotType({
  name: "ConventionalMissile",
  version: 1,
  schema: ConventionalMissileStateSchema,
  cls: () => ConventionalMissileExecution,
});
