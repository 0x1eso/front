import { TileRef } from "@openfront/engine-api/game/GameMap";
import {
  MessageType,
  Structures,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { listNukeBreakAlliance } from "@openfront/engine-lib/execution/NukeAlliance";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  zInt,
  zPlayerRef,
  zRef,
  zTile,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import {
  CARPET_BOMB_INNER,
  CARPET_BOMB_OUTER,
  PLANE_SPEED,
} from "@openfront/engine-lib/warfare/Warfare";
import { z } from "zod";
import { Execution, Game, Player, Unit } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { carpetDropTiles } from "./Carpet";
import { straightFlightPath } from "./FlightPath";
import { samMissileClosingIn } from "./Interception";

/** Units a bomb never destroys: missiles in flight, bombers, barrage zones. */
const BLAST_PROOF: ReadonlySet<UnitType> = new Set([
  UnitType.AtomBomb,
  UnitType.HydrogenBomb,
  UnitType.MIRVWarhead,
  UnitType.MIRV,
  UnitType.SAMMissile,
  UnitType.ConventionalMissile,
  UnitType.Bomber,
  UnitType.CoastalBarrage,
]);

/** How far past the blast structures are redrawn (NukeExecution's sprite radius). */
const SPRITE_RADIUS = 16;

/**
 * Carpet bombing (spec §14c): a bomber flies straight from the nearest
 * airport with a free sortie through the aim, on to the last drop point of
 * `carpetDropTiles`. As it passes each point it drops one small bomb (inner
 * CARPET_BOMB_INNER, outer CARPET_BOMB_OUTER) with an atom bomb's troop
 * deaths, unit destruction and fallout (water with waterNukes), and emits a
 * BombDropUpdate. SAMs may shoot it (it evades each interception with 50%);
 * a bomber shot down drops no more. Alliances break like a nuke's.
 */
export class BombingExecution implements Execution {
  private mg: Game;
  private active = true;
  private bomber: Unit | null = null;
  private path: TileRef[] = [];
  private step = 0;
  private drops: TileRef[] = [];
  private dropSteps: number[] = [];
  private dropped = 0;
  /** smallIDs of players already told about this run. */
  private notified: number[] = [];

  constructor(
    private player: Player,
    private dst: TileRef,
  ) {}

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
  }

  tick(ticks: number): void {
    if (this.bomber === null) {
      this.launch(ticks);
      return;
    }
    if (!this.bomber.isActive()) {
      this.active = false;
      return;
    }
    const last = this.path.length - 1;
    if (this.step < last) {
      this.step++;
      this.bomber.move(this.path[this.step]);
      this.bomber.setTrajectoryIndex(this.step);
    }
    while (
      this.dropped < this.drops.length &&
      this.dropSteps[this.dropped] <= this.step
    ) {
      // A SAM missile about to hit holds the plane for a tick.
      if (samMissileClosingIn(this.mg, this.bomber, this.bomber.tile())) return;
      if (!this.dropBomb(this.dropped)) {
        this.bomber.delete(false);
        this.active = false;
        return;
      }
      this.dropped++;
    }
    if (this.dropped >= this.drops.length) {
      this.bomber.setReachedTarget();
      this.bomber.delete(false);
      this.active = false;
    }
  }

  /** Plans the drops: each on the first flight step nearest its tile. */
  private planDrops(airport: TileRef): void {
    const mg = this.mg;
    this.drops = carpetDropTiles(mg, airport, this.dst);
    this.dropSteps = this.drops.map((tile) => {
      let best = 0;
      let bestD = Infinity;
      for (let i = 0; i < this.path.length; i++) {
        const d = mg.euclideanDistSquared(this.path[i], tile);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    });
    // Never earlier than a point before it.
    for (let i = 1; i < this.dropSteps.length; i++) {
      this.dropSteps[i] = Math.max(this.dropSteps[i], this.dropSteps[i - 1]);
    }
  }

  private launch(ticks: number): void {
    const mg = this.mg;
    if (!mg.isValidRef(this.dst)) {
      this.active = false;
      return;
    }
    const spawn = this.player.canBuild(UnitType.Bomber, this.dst);
    if (spawn === false) {
      if (!mg.config().isUnitDisabled(UnitType.Bomber)) {
        mg.displayMessage(
          "events_display.no_airport_available",
          MessageType.ATTACK_FAILED,
          this.player.id(),
        );
      }
      this.active = false;
      return;
    }
    this.player
      .units(UnitType.Airport)
      .find((a) => a.tile() === spawn)
      ?.launch();
    const drops = carpetDropTiles(mg, spawn, this.dst);
    if (drops.length === 0) {
      this.active = false;
      return;
    }
    // Fly on to the last drop point: the whole carpet lies on that line.
    this.path = straightFlightPath(
      mg,
      spawn,
      drops[drops.length - 1],
      PLANE_SPEED,
    );
    this.planDrops(spawn);
    this.bomber = this.player.buildUnit(UnitType.Bomber, spawn, {
      targetTile: this.dst,
      trajectory: this.path.map((tile) => ({ tile, targetable: true })),
    });
    mg.recordMotionPlan({
      kind: "grid",
      unitId: this.bomber.id(),
      planId: 1,
      startTick: ticks + 1,
      ticksPerStep: 1,
      path: this.path,
    });
    this.breakAlliances();
    const target = mg.owner(this.dst);
    if (target.isPlayer()) {
      mg.displayIncomingUnit(
        this.bomber.id(),
        "events_display.bomber_inbound",
        MessageType.NUKE_INBOUND,
        target.id(),
      );
    }
  }

  /** As NukeExecution.maybeBreakAlliances, for every bomb of the carpet. */
  private breakAlliances(): void {
    const mg = this.mg;
    const hit = new Set<number>();
    for (const tile of this.drops) {
      for (const id of listNukeBreakAlliance({
        game: mg,
        targetTile: tile,
        magnitude: { inner: CARPET_BOMB_INNER, outer: CARPET_BOMB_OUTER },
        threshold: mg.config().nukeAllianceBreakThreshold(),
      })) {
        hit.add(id);
      }
    }
    // Reject requests that could be accepted while the bomber is in the air.
    for (const incoming of this.player.incomingAllianceRequests()) {
      if (hit.has(incoming.requestor().smallID())) incoming.reject();
    }
    for (const smallID of hit) {
      const other = mg.playerBySmallID(smallID);
      if (!other.isPlayer() || other === this.player) continue;
      const pending = other
        .incomingAllianceRequests()
        .find((ar) => ar.requestor() === this.player);
      if (pending) {
        pending.reject();
        continue;
      }
      const alliance = this.player.allianceWith(other);
      if (alliance !== null) this.player.breakAlliance(alliance);
      other.updateRelation(this.player, -100);
    }
  }

  /** Drops bomb `index`; false when its tile turned friendly (the bomber turns home). */
  private dropBomb(index: number): boolean {
    const mg = this.mg;
    const config = mg.config();
    const at = this.drops[index];
    const aimed = mg.owner(at);
    if (aimed.isPlayer() && this.player.isFriendly(aimed, true)) {
      // The land turned friendly in flight: the bomber turns home.
      return false;
    }
    const rand = new PseudoRandom(mg.ticks() * 31 + index);
    const inner2 = CARPET_BOMB_INNER * CARPET_BOMB_INNER;
    const outer2 = CARPET_BOMB_OUTER * CARPET_BOMB_OUTER;
    const tiles = mg.bfs(at, (_, n: TileRef) => {
      const d2 = mg.euclideanDistSquared(at, n);
      return (
        d2 <= outer2 && (d2 <= inner2 || rand.chance(2)) && !mg.isImpassable(n)
      );
    });

    const lostTiles = new Map<Player, number>();
    for (const tile of tiles) {
      const owner = mg.owner(tile);
      if (owner.isPlayer()) {
        owner.relinquish(tile);
        lostTiles.set(owner, (lostTiles.get(owner) ?? 0) + 1);
      }
      // Fallout, or water with waterNukes, as a nuke leaves.
      if (mg.isLand(tile)) mg.queueWaterConversion(tile);
      mg.queueNukeImpact(tile);
    }

    for (const [victim, lost] of lostTiles) {
      const tilesBefore = victim.numTilesOwned() + lost;
      const maxTroops = config.maxTroops(victim);
      const attacks = victim.outgoingAttacks();
      const boats = victim.units(UnitType.TransportShip);
      for (let i = 0; i < lost; i++) {
        const left = tilesBefore - i;
        const deaths = (troops: number) =>
          config.nukeDeathFactor(UnitType.AtomBomb, troops, left, maxTroops);
        victim.removeTroops(deaths(victim.troops()));
        for (const attack of attacks) {
          attack.setTroops(attack.troops() - deaths(attack.troops()));
        }
        for (const boat of boats) {
          boat.setTroops(boat.troops() - deaths(boat.troops()));
        }
      }
    }

    for (const unit of mg.units()) {
      if (BLAST_PROOF.has(unit.type()) || !unit.isActive()) continue;
      if (mg.euclideanDistSquared(at, unit.tile()) < outer2) {
        const friendly = this.player.isFriendly(unit.owner(), true);
        unit.delete(true, friendly ? undefined : this.player);
      }
    }

    const redraw =
      (CARPET_BOMB_OUTER + SPRITE_RADIUS) * (CARPET_BOMB_OUTER + SPRITE_RADIUS);
    for (const unit of mg.units()) {
      if (
        Structures.has(unit.type()) &&
        mg.euclideanDistSquared(at, unit.tile()) < redraw
      ) {
        unit.touch();
      }
    }

    for (const [victim] of lostTiles) {
      if (this.notified.includes(victim.smallID())) continue;
      this.notified.push(victim.smallID());
      mg.displayMessage(
        "events_display.bombing_detonated",
        MessageType.NUKE_DETONATED,
        victim.id(),
        undefined,
        { name: this.player.displayName() },
        undefined,
        this.player.id(),
      );
    }
    mg.addUpdate({
      type: GameUpdateType.BombDrop,
      attackerID: this.player.smallID(),
      tile: at,
      index,
      last: index === this.drops.length - 1,
    });
    return true;
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return BombingExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== undefined,
      player: w.player(this.player),
      dst: this.dst,
      bomber: w.unitOrNull(this.bomber),
      path: [...this.path],
      step: this.step,
      dropped: this.dropped,
      notified: [...this.notified],
    });
  }

  restoreSnapshot(s: BombingState, r: SnapshotReader): void {
    this.active = s.active;
    if (s.initialized) this.mg = r.game;
    this.player = r.player(s.player);
    this.dst = s.dst;
    this.bomber = r.unitOrNull(s.bomber);
    this.path = [...s.path];
    this.step = s.step;
    this.dropped = s.dropped;
    this.notified = [...s.notified];
    // The drop plan follows from the airport (the flight's start) and the aim.
    if (this.path.length > 0) this.planDrops(this.path[0]);
  }
}

const BombingStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  player: zPlayerRef(),
  // Validated on launch, so a pending execution may hold any number.
  dst: zInt(),
  bomber: zRef().nullable(),
  path: z.array(zTile()),
  step: zInt(),
  dropped: zInt(),
  notified: z.array(zInt()),
});
type BombingState = z.infer<typeof BombingStateSchema>;

export const BombingExecutionSnapshot = execSnapshotType({
  name: "Bombing",
  version: 2,
  // v1 was a single blast; a bomber in flight then drops its carpet from now.
  migrations: { 1: (d) => ({ ...d, dropped: 0, notified: [] }) },
  schema: BombingStateSchema,
  cls: () => BombingExecution,
});
