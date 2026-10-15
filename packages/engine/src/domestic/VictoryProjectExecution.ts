import {
  VICTORY_PROJECT_KINDS,
  VictoryProjectKind,
} from "@openfront/engine-api/domestic/DomesticTypes";
import {
  projectQualified,
  VICTORY_PROJECTS,
  victoryProjectBlock,
} from "@openfront/engine-lib/domestic/Victory";
import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { announceVictoryProject } from "./VictoryProjects";

/** start_victory_project: pays for a victory project and starts it (spec §8.1). */
export class VictoryProjectExecution implements Execution {
  constructor(
    private player: Player,
    private kind: VictoryProjectKind,
    private unitId: number,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const def = VICTORY_PROJECTS[this.kind];
    const host = mg.unit(this.unitId);
    const hostLevel =
      host !== undefined &&
      host.isActive() &&
      host.owner() === this.player &&
      host.type() === def.hostType &&
      !host.isUnderConstruction()
        ? host.level()
        : null;
    const infiniteGold = mg.config().hasInfiniteGold(this.player);
    const block = victoryProjectBlock(this.kind, {
      busy: d.victoryProject() !== null,
      qualified: projectQualified(
        this.kind,
        d.hasTech("space_program"),
        d.governmentTier(),
      ),
      hostLevel,
      // Infinite gold can always pay the gold cost.
      gold: infiniteGold ? def.goldCost : this.player.gold(),
      politicalMilli: d.politicalMilliAvailable(),
    });
    if (block !== null) return;

    if (!infiniteGold) this.player.removeGold(def.goldCost);
    if (def.politicalCostMilli > 0) {
      d.spendPoliticalMilli(def.politicalCostMilli);
    }
    d.beginVictoryProject(this.kind, this.unitId, def.ticks);
    announceVictoryProject(
      mg,
      this.player,
      "events_display.victory_project_started",
      this.kind,
      this.unitId,
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
    return VictoryProjectExecutionSnapshot.write({
      player: w.player(this.player),
      kind: this.kind,
      unitId: this.unitId,
    });
  }

  restoreSnapshot(s: VictoryProjectState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.kind = s.kind;
    this.unitId = s.unitId;
  }
}

const VictoryProjectStateSchema = z.object({
  player: zPlayerRef(),
  kind: z.enum(VICTORY_PROJECT_KINDS),
  unitId: zInt(),
});
type VictoryProjectState = z.infer<typeof VictoryProjectStateSchema>;

export const VictoryProjectExecutionSnapshot = execSnapshotType({
  name: "VictoryProject",
  version: 1,
  schema: VictoryProjectStateSchema,
  cls: () => VictoryProjectExecution,
});
