import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  STOCKPILED_NUKES,
  StockpiledNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  factoryWithFreeLine,
  NUKE_PRODUCTION_TICKS,
} from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { finishedFactories } from "./Production";

/**
 * produce_nuke (spec §4): pays the nuke's price and starts it on the
 * factory with the most free lines. A MIRV raises the next MIRV's price
 * now, not at launch. Everyone hears "(name) 핵무기 개발 중".
 */
export class NukeProductionExecution implements Execution {
  constructor(
    private player: Player,
    private nukeType: StockpiledNuke,
  ) {}

  init(mg: Game, _ticks: number): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    if (this.player.isUnitUnavailable(this.nukeType)) return;
    const factoryId = factoryWithFreeLine(
      finishedFactories(this.player),
      s.jobs(),
    );
    if (factoryId === null) return;
    const cost = mg.unitInfo(this.nukeType).cost(mg, this.player);
    if (this.player.gold() < cost) return;
    this.player.removeGold(cost);
    if (this.nukeType === UnitType.MIRV) mg.recordMirvLaunch();
    const now = mg.ticks();
    s.startJob({
      factoryId,
      type: this.nukeType,
      startTick: now,
      endTick: now + NUKE_PRODUCTION_TICKS[this.nukeType],
    });
    mg.displayMessage(
      "events_display.nuke_production_started",
      MessageType.NUKE_INBOUND,
      null,
      undefined,
      { name: this.player.displayName() },
      factoryId,
      this.player.id(),
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
    return NukeProductionExecutionSnapshot.write({
      player: w.player(this.player),
      nukeType: this.nukeType,
    });
  }

  restoreSnapshot(s: NukeProductionState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.nukeType = s.nukeType;
  }
}

const NukeProductionStateSchema = z.object({
  player: zPlayerRef(),
  nukeType: z.enum(STOCKPILED_NUKES),
});
type NukeProductionState = z.infer<typeof NukeProductionStateSchema>;

export const NukeProductionExecutionSnapshot = execSnapshotType({
  name: "NukeProduction",
  version: 1,
  schema: NukeProductionStateSchema,
  cls: () => NukeProductionExecution,
});
