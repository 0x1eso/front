import {
  EMERGENCY_KINDS,
  EmergencyKind,
} from "@openfront/engine-api/congress/CongressTypes";
import { PlayerID } from "@openfront/engine-api/game/GameTypes";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { conveneEmergency } from "./Emergencies";

/** convene_emergency (spec §9.2): Emergencies.conveneEmergency checks and opens the vote. */
export class ConveneEmergencyExecution implements Execution {
  constructor(
    private player: Player,
    private kind: EmergencyKind,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _ticks: number): void {
    if (!mg.hasPlayer(this.targetID)) return;
    conveneEmergency(mg, this.player, this.kind, mg.player(this.targetID));
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ConveneEmergencyExecutionSnapshot.write({
      player: w.player(this.player),
      kind: this.kind,
      targetID: this.targetID,
    });
  }

  restoreSnapshot(s: ConveneEmergencyState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.kind = s.kind;
    this.targetID = s.targetID;
  }
}

const ConveneEmergencyStateSchema = z.object({
  player: zPlayerRef(),
  kind: z.enum(EMERGENCY_KINDS),
  targetID: z.string(),
});
type ConveneEmergencyState = z.infer<typeof ConveneEmergencyStateSchema>;

export const ConveneEmergencyExecutionSnapshot = execSnapshotType({
  name: "ConveneEmergency",
  version: 1,
  schema: ConveneEmergencyStateSchema,
  cls: () => ConveneEmergencyExecution,
});
