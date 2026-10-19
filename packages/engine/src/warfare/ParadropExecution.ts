import { TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zNum,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  PARADROP_RADIUS,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { reportTruceRefusal } from "../congress/Conflict";
import { AttackExecution } from "../execution/AttackExecution";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";
import { samMissileClosingIn } from "./Interception";

/**
 * A paradrop (spec §14b): a transport plane takes off from the nearest
 * airport with a free sortie and flies straight to `dst` (SAMs can shoot it
 * down; its troops are lost). On landing it takes the target's land within
 * PARADROP_RADIUS and attacks from all of it. If the zone has become the
 * player's own, a friend's or (World Congress) a truce partner's, the troops come home instead.
 */
export class ParadropExecution implements Execution {
  private mg: Game;
  private active = true;
  private plane: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private player: Player,
    private troops: number,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      this.launch(ticks);
      return;
    }
    if (!this.plane.isActive()) {
      this.active = false;
      return;
    }
    const last = this.path.length - 1;
    if (this.step < last) {
      this.step++;
      this.plane.move(this.path[this.step]);
      this.plane.setTrajectoryIndex(this.step);
      if (this.step < last) return;
    }
    if (samMissileClosingIn(this.mg, this.plane, this.dst)) return;
    this.land();
  }

  private launch(ticks: number): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    // World congress (spec §8.1): say it's the truce, not a missing airport.
    const target = mg.owner(this.dst);
    if (target.isPlayer() && this.player.isTruceWith(target)) {
      reportTruceRefusal(mg, this.player, target);
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.TransportPlane, this.dst);
    if (spawn === false) {
      if (!mg.config().isUnitDisabled(UnitType.TransportPlane)) {
        mg.displayMessage(
          "events_display.no_airport_available",
          MessageType.ATTACK_FAILED,
          this.player.id(),
        );
      }
      this.active = false;
      return;
    }
    const troops = Math.floor(Math.min(this.troops, this.player.troops()));
    if (troops < 1) {
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.Airport)
      .find((a) => a.tile() === spawn)
      ?.launch();
    this.path = straightFlightPath(mg, spawn, this.dst, PLANE_SPEED);
    this.plane = this.player.buildUnit(UnitType.TransportPlane, spawn, {
      troops,
      targetTile: this.dst,
      trajectory: this.path.map((tile) => ({ tile, targetable: true })),
    });
    mg.recordMotionPlan({
      kind: "grid",
      unitId: this.plane.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.plane.id(),
        "events_display.paradrop_inbound",
        MessageType.NAVAL_INVASION_INBOUND,
        target.id(),
      );
    }
  }

  private land(): void {
    const mg = this.mg;
    const plane = this.plane!;
    const troops = plane.troops();
    plane.setReachedTarget();
    plane.delete(false);
    this.active = false;

    const owner = mg.owner(this.dst);
    if (
      !mg.isLand(this.dst) ||
      owner === this.player ||
      (owner.isPlayer() &&
        // A truce that began mid-flight (spec §8.1): recalled whole.
        (this.player.isFriendly(owner) || this.player.isTruceWith(owner)))
    ) {
      this.player.addTroops(troops);
      return;
    }
    for (const t of mg.circleSearch(this.dst, PARADROP_RADIUS)) {
      if (!mg.isLand(t) || mg.isImpassable(t)) continue;
      if (mg.owner(t) === owner) this.player.conquer(t);
    }
    mg.addExecution(
      new AttackExecution(
        troops,
        this.player,
        owner.id(),
        this.dst,
        false,
        PARADROP_RADIUS,
      ),
    );
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ParadropExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      troops: this.troops,
      dst: this.dst,
      plane: w.unitOrNull(this.plane),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: ParadropState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.troops = s.troops;
    this.dst = s.dst;
    this.plane = r.unitOrNull(s.plane);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const ParadropStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  troops: zNum(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  plane: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type ParadropState = z.infer<typeof ParadropStateSchema>;

export const ParadropExecutionSnapshot = execSnapshotType({
  name: "Paradrop",
  version: 1,
  schema: ParadropStateSchema,
  cls: () => ParadropExecution,
});
