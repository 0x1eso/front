import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord } from "../snapshot/SnapshotContext";

/**
 * World War 1936 (plan decision 6): there is no spawn phase. Added first,
 * it ends the spawn phase from its init on tick 0, so the executions after
 * it in the same init pass (PlayerExecution …) start that very tick.
 */
export class WorldWarStartExecution implements Execution {
  private active = true;

  init(mg: Game, _ticks: number): void {
    mg.endSpawnPhase();
    this.active = false;
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return true;
  }

  snapshot(): ExecRecord {
    return WorldWarStartExecutionSnapshot.write({ active: this.active });
  }

  restoreSnapshot(s: WorldWarStartState): void {
    this.active = s.active;
  }
}

const WorldWarStartStateSchema = z.object({ active: z.boolean() });
type WorldWarStartState = z.infer<typeof WorldWarStartStateSchema>;

export const WorldWarStartExecutionSnapshot = execSnapshotType({
  name: "WorldWarStart",
  version: 1,
  schema: WorldWarStartStateSchema,
  cls: () => WorldWarStartExecution,
});
