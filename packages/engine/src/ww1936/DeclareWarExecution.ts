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
import { declareWar, declareWarBlock } from "./Diplomacy";
import { declareIndependence } from "./endgame/Subjects";
import type { WorldWar } from "./WorldWar";

/** World War 1936 (spec §7.3): the declare_war intent. */
export class DeclareWarExecution implements Execution {
  private active = true;
  private mg: Game | null = null;

  constructor(
    private player: Player,
    private targetID: PlayerID,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    this.active = false;
    const mg = this.mg;
    const ww = mg?.worldWar() ?? null;
    if (mg === null || ww === null || !mg.hasPlayer(this.targetID)) return;
    this.declare(mg, ww, ticks);
    // Final review A, finding 1: this runs after the tick's
    // WorldWarExecution (added later), so after its flushes; what the
    // declaration left pending is drained here.
    ww.settleOrder(ticks);
  }

  private declare(mg: Game, ww: WorldWar, ticks: number): void {
    const target = mg.player(this.targetID);
    // P5 lane S: a subject declaring on its overlord is its independence war.
    if (
      ww.endgame.subjectOf(this.player.smallID())?.overlord === target.smallID()
    ) {
      const id = this.player.smallID();
      if (!declareIndependence(ww.endgame, id, ticks)) {
        ww.endgame.message(id, "ww1936_subject_restricted", {});
      }
      return;
    }
    const block = declareWarBlock(mg, ww, this.player, target, ticks);
    if (block === null) {
      declareWar(mg, ww, this.player, target, ticks);
    } else {
      // The player is told why nothing happened.
      ww.endgame.message(
        this.player.smallID(),
        `ww1936_declare_blocked_${block}`,
        {},
      );
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return DeclareWarExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      player: w.player(this.player),
      targetID: this.targetID,
    });
  }

  restoreSnapshot(s: DeclareWarState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.player = r.player(s.player);
    this.targetID = s.targetID;
  }
}

const DeclareWarStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  targetID: z.string(),
});
type DeclareWarState = z.infer<typeof DeclareWarStateSchema>;

export const DeclareWarExecutionSnapshot = execSnapshotType({
  name: "DeclareWar",
  version: 1,
  schema: DeclareWarStateSchema,
  cls: () => DeclareWarExecution,
});
