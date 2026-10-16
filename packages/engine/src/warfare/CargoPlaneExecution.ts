import { TileRef } from "@openfront/engine-api/game/GameMap";
import { UnitType } from "@openfront/engine-api/game/GameTypes";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  airportRange,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { domesticTradeGold } from "../domestic/DomesticEconomy";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";

/**
 * The airports `airport` can fly cargo to (spec §14b): another owner's,
 * finished, both sides allowed to trade (embargoes, isolationism), and each
 * within the other's range.
 */
export function cargoPartners(mg: Game, airport: Unit): Unit[] {
  const owner = airport.owner();
  const range = airportRange(airport.level());
  return mg.units(UnitType.Airport).filter((other) => {
    if (other === airport || !other.isActive()) return false;
    if (other.isUnderConstruction()) return false;
    const partner = other.owner();
    if (partner === owner || !owner.canTrade(partner)) return false;
    const reach = Math.min(range, airportRange(other.level()));
    return (
      mg.euclideanDistSquared(airport.tile(), other.tile()) <= reach * reach
    );
  });
}

/**
 * A cargo flight (spec §14b): flies straight between two airports and pays
 * both owners on arrival, like a trade ship (domestic trade modifiers per
 * side). SAMs never target it. If trade stops on the way (embargo, the
 * destination lost or taken over) it vanishes unpaid.
 */
export class CargoPlaneExecution implements Execution {
  private mg: Game;
  private active = true;
  private plane: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;

  constructor(
    private owner: Player,
    private src: Unit,
    private dst: Unit,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.plane === null) {
      this.launch(ticks);
      return;
    }
    if (!this.plane.isActive()) {
      this.active = false;
      return;
    }
    if (!this.stillTrading()) {
      this.plane.delete(false);
      this.active = false;
      return;
    }
    this.step++;
    this.plane.move(this.path[this.step]);
    if (this.step >= this.path.length - 1) this.deliver();
  }

  private stillTrading(): boolean {
    const from = this.src.owner();
    const to = this.dst.owner();
    return this.dst.isActive() && from !== to && from.canTrade(to);
  }

  private launch(ticks: number): void {
    if (!this.src.isActive() || !this.stillTrading()) {
      this.active = false;
      return;
    }
    this.path = straightFlightPath(
      this.mg,
      this.src.tile(),
      this.dst.tile(),
      PLANE_SPEED,
    );
    this.plane = this.owner.buildUnit(UnitType.CargoPlane, this.src.tile(), {
      targetUnit: this.dst,
    });
    this.mg.recordMotionPlan({
      kind: "grid",
      unitId: this.plane.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
  }

  private deliver(): void {
    const mg = this.mg;
    const plane = this.plane!;
    plane.setReachedTarget();
    plane.delete(false);
    this.active = false;
    const from = this.src.owner();
    const to = this.dst.owner();
    const distance = Math.round(
      Math.sqrt(mg.euclideanDistSquared(this.src.tile(), this.dst.tile())),
    );
    const gold = mg.config().cargoPlaneGold(distance, from);
    const fromGold = domesticTradeGold(gold, from, to, "cargo");
    const toGold = domesticTradeGold(gold, to, from, "cargo");
    from.addGold(fromGold, this.src.tile());
    to.addGold(toGold, this.dst.tile());
    from.addTradeGold(fromGold);
    to.addTradeGold(toGold);
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CargoPlaneExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      owner: w.player(this.owner),
      src: w.unit(this.src),
      dst: w.unit(this.dst),
      plane: w.unitOrNull(this.plane),
      path: [...this.path],
      step: this.step,
    });
  }

  restoreSnapshot(s: CargoPlaneState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.owner = r.player(s.owner);
    this.src = r.unit(s.src);
    this.dst = r.unit(s.dst);
    this.plane = r.unitOrNull(s.plane);
    this.path = [...s.path];
    this.step = s.step;
  }
}

const CargoPlaneStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  owner: zPlayerRef(),
  src: zRef(),
  dst: zRef(),
  plane: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
});
type CargoPlaneState = z.infer<typeof CargoPlaneStateSchema>;

export const CargoPlaneExecutionSnapshot = execSnapshotType({
  name: "CargoPlane",
  version: 1,
  schema: CargoPlaneStateSchema,
  cls: () => CargoPlaneExecution,
});
