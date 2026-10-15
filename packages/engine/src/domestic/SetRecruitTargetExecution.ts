import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** set_recruit_target: where troop regrowth stops (spec §3.5). */
export class SetRecruitTargetExecution implements Execution {
  constructor(
    private player: Player,
    private percent: number,
  ) {}

  init(_mg: Game, _ticks: number): void {
    this.player.domestic()?.setRecruitTargetPct(this.percent);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return SetRecruitTargetExecutionSnapshot.write({
      player: w.player(this.player),
      percent: this.percent,
    });
  }

  restoreSnapshot(s: SetRecruitTargetState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.percent = s.percent;
  }
}

const SetRecruitTargetStateSchema = z.object({
  player: zPlayerRef(),
  percent: zInt(),
});
type SetRecruitTargetState = z.infer<typeof SetRecruitTargetStateSchema>;

export const SetRecruitTargetExecutionSnapshot = execSnapshotType({
  name: "SetRecruitTarget",
  version: 1,
  schema: SetRecruitTargetStateSchema,
  cls: () => SetRecruitTargetExecution,
});
