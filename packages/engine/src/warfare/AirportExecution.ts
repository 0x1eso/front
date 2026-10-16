import { zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { AIRPORT_SORTIE_COOLDOWN_TICKS } from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/**
 * An airport (spec §14b). Sorties work like a silo's missiles: one per
 * level, a used one (launch()) waits in the unit's timer queue and comes
 * back AIRPORT_SORTIE_COOLDOWN_TICKS later. Paradrops and bombing share them.
 */
export class AirportExecution implements Execution {
  private mg: Game;
  private active = true;

  constructor(private airport: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.airport.isActive()) {
      this.active = false;
      return;
    }
    if (this.airport.isUnderConstruction()) return;
    const now = this.mg.ticks();
    const queue = this.airport.missileTimerQueue();
    while (
      queue.length > 0 &&
      now - queue[0] >= AIRPORT_SORTIE_COOLDOWN_TICKS
    ) {
      this.airport.reloadMissile();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return AirportExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      airport: w.unit(this.airport),
    });
  }

  restoreSnapshot(s: AirportState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.airport = r.unit(s.airport);
  }
}

const AirportStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  airport: zRef(),
});
type AirportState = z.infer<typeof AirportStateSchema>;

export const AirportExecutionSnapshot = execSnapshotType({
  name: "Airport",
  version: 1,
  schema: AirportStateSchema,
  cls: () => AirportExecution,
});
