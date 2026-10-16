import { TECH_IDS, TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** queue_research: reserves the next tech, or clears the reservation (null). */
export class QueueResearchExecution implements Execution {
  constructor(
    private player: Player,
    private tech: TechId | null,
  ) {}

  init(_mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    if (this.tech !== null) {
      if (d.hasTech(this.tech)) return;
      if (d.currentResearch()?.tech === this.tech) return;
    }
    d.setQueuedTech(this.tech);
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return QueueResearchExecutionSnapshot.write({
      player: w.player(this.player),
      tech: this.tech,
    });
  }

  restoreSnapshot(s: QueueResearchState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.tech = s.tech;
  }
}

const QueueResearchStateSchema = z.object({
  player: zPlayerRef(),
  tech: z.enum(TECH_IDS).nullable(),
});
type QueueResearchState = z.infer<typeof QueueResearchStateSchema>;

export const QueueResearchExecutionSnapshot = execSnapshotType({
  name: "QueueResearch",
  version: 1,
  schema: QueueResearchStateSchema,
  cls: () => QueueResearchExecution,
});
