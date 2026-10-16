import { GameMap, TileRef } from "@openfront/engine-api/game/GameMap";
import { MessageType, UnitType } from "@openfront/engine-api/game/GameTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  BARRAGE_BATTERY_KILL_RADIUS,
  BARRAGE_RADIUS,
  BARRAGE_SHELL_SPACING_TICKS,
  BARRAGE_SHELL_SPEED,
  BARRAGE_SHELLS,
  BARRAGE_SUPPRESSION_TICKS,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { straightFlightPath } from "./FlightPath";

const NOT_LAUNCHED = -1;
const LANDED = -2;

/**
 * Where a salvo's shells land: the aimed tile first (so an aimed battery
 * is always hit), then random map tiles within BARRAGE_RADIUS of it.
 */
export function barrageImpacts(
  map: GameMap,
  dst: TileRef,
  random: PseudoRandom,
): TileRef[] {
  const impacts = [dst];
  const cx = map.x(dst);
  const cy = map.y(dst);
  const r = BARRAGE_RADIUS;
  while (impacts.length < BARRAGE_SHELLS) {
    let tile = dst;
    for (let tries = 0; tries < 20; tries++) {
      const dx = random.nextInt(-r, r + 1);
      const dy = random.nextInt(-r, r + 1);
      if (dx * dx + dy * dy > r * r) continue;
      if (!map.isValidCoord(cx + dx, cy + dy)) continue;
      tile = map.ref(cx + dx, cy + dy);
      break;
    }
    impacts.push(tile);
  }
  return impacts;
}

/**
 * A coastal barrage (spec §14b): fired from the nearest loaded silo within
 * BARRAGE_SILO_RANGE (one silo slot). Its 8 shells leave 5 ticks apart and
 * fly straight to their impacts; each impact destroys non-friendly coastal
 * batteries within BARRAGE_BATTERY_KILL_RADIUS. A marker unit at the aimed
 * tile holds the zone: after the last impact it is `reachedTarget` for
 * BARRAGE_SUPPRESSION_TICKS (BarrageZone.barrageSuppresses), then removed.
 * Nothing else is harmed.
 */
export class CoastalBarrageExecution implements Execution {
  private mg: Game;
  private active = true;
  private marker: Unit | null = null;
  private silo: TileRef = 0;
  private launchTick = 0;
  private impacts: TileRef[] = [];
  /** Not stored: rebuilt from silo and impacts. */
  private paths: TileRef[][] = [];
  private shells: (Unit | null)[] = [];
  /** Path index per shell, or NOT_LAUNCHED / LANDED. */
  private steps: number[] = [];
  private zoneEndsAt = -1;

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(_ticks: number): void {
    if (this.marker === null) {
      this.launch();
      return;
    }
    if (!this.marker.isActive()) {
      this.end();
      return;
    }
    const now = this.mg.ticks();
    if (this.zoneEndsAt >= 0) {
      if (now >= this.zoneEndsAt) this.end();
      return;
    }
    this.flyShells(now);
    if (this.steps.every((s) => s === LANDED)) {
      this.marker.setReachedTarget();
      this.marker.touch();
      this.zoneEndsAt = now + BARRAGE_SUPPRESSION_TICKS;
    }
  }

  private launch(): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.CoastalBarrage, this.dst);
    if (spawn === false) {
      console.warn(`cannot fire a coastal barrage at ${this.dst}`);
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.MissileSilo)
      .find((s) => s.tile() === spawn)
      ?.launch();
    this.silo = spawn;
    this.launchTick = mg.ticks();
    this.marker = this.player.buildUnit(UnitType.CoastalBarrage, this.dst, {
      targetTile: this.dst,
    });
    this.impacts = barrageImpacts(
      mg,
      this.dst,
      new PseudoRandom(mg.ticks() + this.dst),
    );
    this.paths = this.flightPaths(mg);
    this.shells = this.impacts.map(() => null);
    this.steps = this.impacts.map(() => NOT_LAUNCHED);
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.marker.id(),
        "events_display.barrage_inbound",
        MessageType.NUKE_INBOUND,
        target.id(),
      );
    }
  }

  private flightPaths(map: GameMap): TileRef[][] {
    return this.impacts.map((t) =>
      straightFlightPath(map, this.silo, t, BARRAGE_SHELL_SPEED),
    );
  }

  private flyShells(now: number): void {
    for (let i = 0; i < this.impacts.length; i++) {
      const step = this.steps[i];
      if (step === LANDED) continue;
      if (step === NOT_LAUNCHED) {
        if (now >= this.launchTick + 1 + i * BARRAGE_SHELL_SPACING_TICKS) {
          this.shells[i] = this.player.buildUnit(UnitType.Shell, this.silo, {});
          this.steps[i] = 0;
        }
        continue;
      }
      const shell = this.shells[i]!;
      if (!shell.isActive()) {
        // Caught in a blast on the way: it never lands.
        this.shells[i] = null;
        this.steps[i] = LANDED;
        continue;
      }
      const path = this.paths[i];
      const next = Math.min(path.length - 1, step + 1);
      this.steps[i] = next;
      shell.move(path[next]);
      if (next === path.length - 1) {
        this.impact(this.impacts[i]);
        shell.setReachedTarget();
        shell.delete(false);
        this.shells[i] = null;
        this.steps[i] = LANDED;
      }
    }
  }

  private impact(tile: TileRef): void {
    const hits = this.mg.nearbyUnits(
      tile,
      BARRAGE_BATTERY_KILL_RADIUS,
      UnitType.CoastalBattery,
      undefined,
      true,
    );
    for (const { unit } of hits) {
      const owner = unit.owner();
      if (owner === this.player || this.player.isFriendly(owner)) continue;
      if (unit.isActive()) unit.delete(true, this.player);
    }
  }

  private end(): void {
    for (const shell of this.shells) {
      if (shell !== null && shell.isActive()) shell.delete(false);
    }
    if (this.marker !== null && this.marker.isActive()) {
      this.marker.delete(false);
    }
    this.active = false;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CoastalBarrageExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      dst: this.dst,
      marker: w.unitOrNull(this.marker),
      silo: this.silo,
      launchTick: this.launchTick,
      impacts: [...this.impacts],
      shells: this.shells.map((s) => w.unitOrNull(s)),
      steps: [...this.steps],
      zoneEndsAt: this.zoneEndsAt,
    });
  }

  restoreSnapshot(s: CoastalBarrageState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.dst = s.dst;
    this.marker = r.unitOrNull(s.marker);
    this.silo = s.silo;
    this.launchTick = s.launchTick;
    this.impacts = [...s.impacts];
    this.paths = this.flightPaths(r.game);
    this.shells = s.shells.map((i) => r.unitOrNull(i));
    this.steps = [...s.steps];
    this.zoneEndsAt = s.zoneEndsAt;
  }
}

const CoastalBarrageStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  marker: zRef().nullable(),
  silo: zTile(),
  launchTick: zInt(),
  impacts: z.array(zTile()),
  shells: z.array(zRef().nullable()),
  steps: z.array(zInt()),
  zoneEndsAt: zInt(),
});
type CoastalBarrageState = z.infer<typeof CoastalBarrageStateSchema>;

export const CoastalBarrageExecutionSnapshot = execSnapshotType({
  name: "CoastalBarrage",
  version: 1,
  schema: CoastalBarrageStateSchema,
  cls: () => CoastalBarrageExecution,
});
