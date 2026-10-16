import { MessageType, PlayerID } from "@openfront/engine-api/game/GameTypes";
import {
  INTERCEPTOR_NUKES,
  InterceptorNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  INTERCEPTOR_FLIGHT_TICKS,
  SATELLITE_STRIKE_DELAY_TICKS,
} from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import {
  announceSatellite,
  canTargetWithSatellite,
  firstReadySilo,
} from "./Satellite";

/**
 * satellite_target (spec §6.2): aims the sender's satellite in orbit at a
 * nation; the strike lands SATELLITE_STRIKE_DELAY_TICKS later unless an
 * interceptor downs it. Everyone hears "(A) → (B)".
 */
export class SatelliteTargetExecution implements Execution {
  constructor(
    private player: Player,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (s.satellite().phase !== "orbit" || !mg.hasPlayer(this.targetID)) return;
    const target = mg.player(this.targetID);
    if (!canTargetWithSatellite(mg, this.player, target)) return;
    s.setSatellite({
      phase: "targeted",
      target: target.smallID(),
      strikeTick: mg.ticks() + SATELLITE_STRIKE_DELAY_TICKS,
      interceptors: [],
    });
    target.updateRelation(this.player, -100);
    announceSatellite(
      mg,
      "events_display.satellite_targeted",
      MessageType.NUKE_INBOUND,
      this.player,
      { target: target.displayName(), targetID: target.smallID() },
    );
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SatelliteTargetExecutionSnapshot.write({
      player: w.player(this.player),
      targetID: this.targetID,
    });
  }

  restoreSnapshot(s: SatelliteTargetState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.targetID = s.targetID;
  }
}

const SatelliteTargetStateSchema = z.object({
  player: zPlayerRef(),
  // Validated in init: the target may not exist.
  targetID: z.string(),
});
type SatelliteTargetState = z.infer<typeof SatelliteTargetStateSchema>;

export const SatelliteTargetExecutionSnapshot = execSnapshotType({
  name: "SatelliteTarget",
  version: 1,
  schema: SatelliteTargetStateSchema,
  cls: () => SatelliteTargetExecution,
});

/**
 * intercept_satellite (spec §6.3): fires one stockpiled hydrogen or atom
 * bomb from any ready silo at `attackerID`'s satellite while its clock
 * runs. Anyone but the satellite's owner may; the shot is judged
 * INTERCEPTOR_FLIGHT_TICKS later and the strike waits for it.
 */
export class SatelliteInterceptExecution implements Execution {
  constructor(
    private player: Player,
    private attackerID: PlayerID,
    private nukeType: InterceptorNuke,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (!mg.hasPlayer(this.attackerID)) return;
    const attacker = mg.player(this.attackerID);
    const sat = attacker.strategic()?.satellite();
    if (attacker === this.player || sat?.phase !== "targeted") return;
    if (mg.ticks() >= sat.strikeTick) return;
    const silo = firstReadySilo(this.player);
    if (silo === null || !s.takeStock(this.nukeType)) return;
    silo.launch();
    attacker.strategic()!.addInterceptor({
      by: this.player.smallID(),
      type: this.nukeType,
      resolveTick: mg.ticks() + INTERCEPTOR_FLIGHT_TICKS,
    });
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SatelliteInterceptExecutionSnapshot.write({
      player: w.player(this.player),
      attackerID: this.attackerID,
      nukeType: this.nukeType,
    });
  }

  restoreSnapshot(s: SatelliteInterceptState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.attackerID = s.attackerID;
    this.nukeType = s.nukeType;
  }
}

const SatelliteInterceptStateSchema = z.object({
  player: zPlayerRef(),
  attackerID: z.string(),
  nukeType: z.enum(INTERCEPTOR_NUKES),
});
type SatelliteInterceptState = z.infer<typeof SatelliteInterceptStateSchema>;

export const SatelliteInterceptExecutionSnapshot = execSnapshotType({
  name: "SatelliteIntercept",
  version: 1,
  schema: SatelliteInterceptStateSchema,
  cls: () => SatelliteInterceptExecution,
});
