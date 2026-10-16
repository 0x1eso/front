import { MessageType, PlayerID } from "@openfront/engine-api/game/GameTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { SATELLITE_STRIKE_DELAY_TICKS } from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceSatellite, canTargetWithSatellite } from "./Satellite";

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
