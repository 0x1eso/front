import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type { ExecRecord, SnapshotReader } from "../snapshot/SnapshotContext";
import { rollWorld } from "./Roll";

/** Great War 1914's clock: rolls the world once, then the chapter clock. */
export class GreatWarExecution implements Execution {
  private mg: Game | null = null;

  /** `seed`: simpleHash(gameID) + 1914. */
  constructor(private seed: number) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const gw = mg.greatWar();
    if (gw !== null && !gw.s.rolled) rollWorld(gw, this.seed, ticks);
  }

  tick(ticks: number): void {
    const gw = this.mg?.greatWar() ?? null;
    if (gw === null) return;
    gw.tick(ticks);
    const data = gw.takeData();
    if (data !== null) {
      this.mg!.addUpdate({ type: GameUpdateType.GreatWar, data });
    }
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(): ExecRecord {
    return GreatWarExecutionSnapshot.write({ seed: this.seed });
  }

  restoreSnapshot(s: GreatWarExecutionState, r: SnapshotReader): void {
    this.seed = s.seed;
    this.mg = r.game;
  }
}

const GreatWarExecutionStateSchema = z.object({ seed: zInt() });
type GreatWarExecutionState = z.infer<typeof GreatWarExecutionStateSchema>;

export const GreatWarExecutionSnapshot = execSnapshotType({
  name: "GreatWar",
  version: 1,
  schema: GreatWarExecutionStateSchema,
  cls: () => GreatWarExecution,
});
