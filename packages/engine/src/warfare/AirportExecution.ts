import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zRandom,
  zRef,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  AIRPORT_SORTIE_COOLDOWN_TICKS,
  CARGO_INTERVAL_TICKS,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { CargoPlaneExecution, cargoPartners } from "./CargoPlaneExecution";

/**
 * An airport (spec §14b). Sorties work like a silo's missiles: one per
 * level, a used one (launch()) waits in the unit's timer queue and comes
 * back AIRPORT_SORTIE_COOLDOWN_TICKS later. Paradrops and bombing share
 * them. Every CARGO_INTERVAL_TICKS it also sends `level` cargo flights to
 * random trading partners (cargoPartners).
 */
export class AirportExecution implements Execution {
  private mg: Game;
  private active = true;
  private random: PseudoRandom;
  private nextCargoTick = 0;

  constructor(private airport: Unit) {}

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    this.random = new PseudoRandom(ticks + this.airport.id());
    this.nextCargoTick = ticks + CARGO_INTERVAL_TICKS;
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

    if (now < this.nextCargoTick) return;
    this.nextCargoTick = now + CARGO_INTERVAL_TICKS;
    // A lobby may list the internal plane as disabled: no flights then.
    if (this.mg.config().isUnitDisabled(UnitType.CargoPlane)) return;
    const partners = cargoPartners(this.mg, this.airport);
    if (partners.length === 0) return;
    for (let i = 0; i < this.airport.level(); i++) {
      this.mg.addExecution(
        new CargoPlaneExecution(
          this.airport.owner(),
          this.airport,
          this.random.randElement(partners),
        ),
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
    return AirportExecutionSnapshot.write({
      active: this.active,
      airport: w.unit(this.airport),
      // Set by init.
      init:
        this.mg === undefined
          ? null
          : {
              random: w.random(this.random),
              nextCargoTick: this.nextCargoTick,
            },
    });
  }

  restoreSnapshot(s: AirportState, r: SnapshotReader): void {
    this.active = s.active;
    this.airport = r.unit(s.airport);
    if (s.init !== null) {
      this.mg = r.game;
      this.random = r.random(s.init.random);
      this.nextCargoTick = s.init.nextCargoTick;
    }
  }
}

const AirportStateSchema = z.object({
  active: z.boolean(),
  airport: zRef(),
  init: z.object({ random: zRandom(), nextCargoTick: zInt() }).nullable(),
});
type AirportState = z.infer<typeof AirportStateSchema>;

export const AirportExecutionSnapshot = execSnapshotType({
  name: "Airport",
  version: 1,
  schema: AirportStateSchema,
  cls: () => AirportExecution,
});
