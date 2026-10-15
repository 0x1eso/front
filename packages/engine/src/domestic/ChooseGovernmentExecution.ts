import {
  GOVERNMENT_IDS,
  GovernmentId,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { governmentBlock } from "@openfront/engine-lib/domestic/Governments";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * choose_government: adopts a government of the current tier (spec §6.1).
 * Free, and allowed during the law cooldown; it restarts the cooldown.
 */
export class ChooseGovernmentExecution implements Execution {
  constructor(
    private player: Player,
    private government: GovernmentId,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const block = governmentBlock(
      d.governmentTier(),
      d.currentGovernment(),
      d.proclaimedLaws(),
      this.government,
    );
    if (block !== null) return;
    d.chooseGovernment(this.government, mg.ticks());
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ChooseGovernmentExecutionSnapshot.write({
      player: w.player(this.player),
      government: this.government,
    });
  }

  restoreSnapshot(s: ChooseGovernmentState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.government = s.government;
  }
}

const ChooseGovernmentStateSchema = z.object({
  player: zPlayerRef(),
  government: z.enum(GOVERNMENT_IDS),
});
type ChooseGovernmentState = z.infer<typeof ChooseGovernmentStateSchema>;

export const ChooseGovernmentExecutionSnapshot = execSnapshotType({
  name: "ChooseGovernment",
  version: 1,
  schema: ChooseGovernmentStateSchema,
  cls: () => ChooseGovernmentExecution,
});
