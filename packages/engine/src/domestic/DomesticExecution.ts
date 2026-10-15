import { DOMESTIC_INTERVAL_TICKS } from "@openfront/engine-lib/domestic/Balance";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";
import { processDomesticSecond } from "./DomesticEconomy";

/** Runs every domestic-mode player's economy once per second (spec §3). */
export class DomesticExecution implements Execution {
  private mg: Game | undefined = undefined;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.mg === undefined || ticks % DOMESTIC_INTERVAL_TICKS !== 0) {
      return;
    }
    for (const player of this.mg.players()) {
      const d = player.domestic();
      if (d !== null && player.isAlive()) {
        processDomesticSecond(this.mg, player, d);
      }
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return DomesticExecutionSnapshot.write({
      initialized: this.mg !== undefined,
    });
  }

  restoreSnapshot(s: DomesticExecState, r: SnapshotReader): void {
    this.mg = s.initialized ? r.game : undefined;
  }
}

const DomesticExecStateSchema = z.object({ initialized: z.boolean() });
type DomesticExecState = z.infer<typeof DomesticExecStateSchema>;

export const DomesticExecutionSnapshot = execSnapshotType({
  name: "Domestic",
  version: 1,
  schema: DomesticExecStateSchema,
  cls: () => DomesticExecution,
});
