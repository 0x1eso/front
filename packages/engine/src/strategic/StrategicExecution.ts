import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { processProduction } from "./Production";

/**
 * The strategic weapons clock (spec §4, §6): every tick it finishes nukes
 * on factory lines, drops lines whose factory fell and runs every
 * satellite. One per game, added by GameRunner when the option is on; all
 * state lives on the players (PlayerStrategic).
 */
export class StrategicExecution implements Execution {
  private active = true;
  private mg: Game;

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    const now = this.mg.ticks();
    for (const player of this.mg.allPlayers()) {
      const s = player.strategic();
      if (s === null) continue;
      processProduction(this.mg, player, s, now);
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(_w: SnapshotWriter): ExecRecord {
    return StrategicExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
    });
  }

  restoreSnapshot(s: StrategicState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
  }
}

const StrategicStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
});
type StrategicState = z.infer<typeof StrategicStateSchema>;

export const StrategicExecutionSnapshot = execSnapshotType({
  name: "Strategic",
  version: 1,
  schema: StrategicStateSchema,
  cls: () => StrategicExecution,
});
