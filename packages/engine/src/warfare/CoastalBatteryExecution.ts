import { UnitType } from "@openfront/engine-api/game/GameTypes";
import { zInt, zRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  COASTAL_BATTERY_RANGE,
  coastalBatteryFireInterval,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { ShellExecution } from "../execution/ShellExecution";
import { Execution, Game, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** What a coastal battery shoots: never trade ships (spec §14b). */
const BATTERY_TARGETS: readonly UnitType[] = [
  UnitType.TransportShip,
  UnitType.Warship,
];

/**
 * A coastal battery (spec §14b): shells non-friendly transport ships and
 * warships within COASTAL_BATTERY_RANGE, transports first, then the
 * nearest. A transport has no health and sinks to one shell, so it is shot
 * at once; a warship takes several. Faster per level.
 */
export class CoastalBatteryExecution implements Execution {
  private mg: Game;
  private active = true;
  /** Tick of the last shot; far back so a new battery fires at once. */
  private lastShot = -1_000_000;
  /** One-shot targets already fired at. */
  private shotAt = new Set<Unit>();

  constructor(private battery: Unit) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (!this.battery.isActive()) {
      this.active = false;
      return;
    }
    if (this.battery.isUnderConstruction()) return;
    for (const unit of this.shotAt) {
      if (!unit.isActive()) this.shotAt.delete(unit);
    }
    const now = this.mg.ticks();
    if (
      now - this.lastShot <
      coastalBatteryFireInterval(this.battery.level())
    ) {
      return;
    }
    const owner = this.battery.owner();
    const targets = this.mg
      .nearbyUnits(this.battery.tile(), COASTAL_BATTERY_RANGE, BATTERY_TARGETS)
      .filter(
        ({ unit }) =>
          unit.owner() !== owner &&
          !owner.isFriendly(unit.owner()) &&
          !this.shotAt.has(unit),
      );
    if (targets.length === 0) return;
    targets.sort((a, b) => {
      const aRank = a.unit.type() === UnitType.TransportShip ? 0 : 1;
      const bRank = b.unit.type() === UnitType.TransportShip ? 0 : 1;
      return (
        aRank - bRank ||
        a.distSquared - b.distSquared ||
        a.unit.id() - b.unit.id()
      );
    });
    const target = targets[0].unit;
    this.lastShot = now;
    this.mg.addExecution(
      new ShellExecution(this.battery.tile(), owner, this.battery, target),
    );
    if (!target.hasHealth()) this.shotAt.add(target);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CoastalBatteryExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      battery: w.unit(this.battery),
      lastShot: this.lastShot,
      shotAt: [...this.shotAt].map((u) => w.unit(u)),
    });
  }

  restoreSnapshot(s: CoastalBatteryState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.battery = r.unit(s.battery);
    this.lastShot = s.lastShot;
    this.shotAt = new Set(s.shotAt.map((i) => r.unit(i)));
  }
}

const CoastalBatteryStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  battery: zRef(),
  lastShot: zInt(),
  shotAt: z.array(zRef()),
});
type CoastalBatteryState = z.infer<typeof CoastalBatteryStateSchema>;

export const CoastalBatteryExecutionSnapshot = execSnapshotType({
  name: "CoastalBattery",
  version: 1,
  schema: CoastalBatteryStateSchema,
  cls: () => CoastalBatteryExecution,
});
