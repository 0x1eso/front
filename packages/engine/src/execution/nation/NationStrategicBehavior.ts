import { VictoryProjectKind } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  Difficulty,
  Gold,
  PlayerType,
  UnitType,
} from "@openfront/engine-api/game/GameTypes";
import {
  INTERCEPTOR_NUKES,
  StockpiledNuke,
} from "@openfront/engine-api/strategic/StrategicTypes";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import {
  readVersioned,
  snapshotType,
  Versioned,
  zInt,
  zRandom,
} from "@openfront/engine-lib/snapshot/SnapshotType";
import { factoryWithFreeLine } from "@openfront/engine-lib/strategic/Strategic";
import { z } from "zod";
import { Game, Player } from "../../game/Game";
import type {
  SnapshotReader,
  SnapshotWriter,
} from "../../snapshot/SnapshotContext";
import { NukeProductionExecution } from "../../strategic/NukeProductionExecution";
import type { PlayerStrategic } from "../../strategic/PlayerStrategic";
import { finishedFactories } from "../../strategic/Production";
import { firstReadySilo } from "../../strategic/Satellite";
import {
  SatelliteInterceptExecution,
  SatelliteTargetExecution,
} from "../../strategic/SatelliteOrders";
import { ConstructionExecution } from "../ConstructionExecution";
import { nationHoldsStructuresForProject } from "./NationVictoryBehavior";

/** Gold kept back beyond an atom bomb's or a missile's price. */
const RESERVE = 1_000_000n;
/** Beyond the satellite's price: "very rich" (spec §8). */
const SATELLITE_RESERVE = 15_000_000n;
/** Bombs kept in stock, counting those on factory lines. */
const HYDROGEN_STOCK = 2;
const ATOM_STOCK = 3;
/** One missile per enemy factory this often. */
const MISSILE_RETRY_TICKS = 150;

type FiredNuke = UnitType.AtomBomb | UnitType.HydrogenBomb;

/**
 * What NationNukeBehavior may fire in a strategic game: whatever is in
 * stock and available, hydrogen first (only atom bombs while `atomOnly`).
 * Gold doesn't matter here: it was spent at the factory.
 */
export function stockpiledNukeTypes(
  player: Player,
  s: PlayerStrategic,
  atomOnly: boolean,
): FiredNuke[] {
  const types: FiredNuke[] = [];
  for (const type of [UnitType.HydrogenBomb, UnitType.AtomBomb] as const) {
    if (atomOnly && type === UnitType.HydrogenBomb) continue;
    if (s.stock(type) > 0 && !player.isUnitUnavailable(type)) types.push(type);
  }
  return types;
}

/**
 * A nation's strategic weapons (spec §8), once per action tick: intercept
 * a satellite aimed at it (every difficulty, hydrogen first); unless it is
 * saving for a victory project, keep a small stockpile made at its
 * factories; on Hard and up, fire conventional missiles at factories
 * making nukes and, when very rich, prepare a satellite and aim it at the
 * biggest other nation. Built only with the option on, on its own PRNG.
 */
export class NationStrategicBehavior {
  /** Enemy factory id -> tick a missile was last fired at it. */
  private lastMissileAt = new Map<number, number>();
  /** The nation's attack gate, set each tick. */
  private shouldAttack: ((other: Player) => boolean) | null = null;

  constructor(
    private random: PseudoRandom,
    private game: Game,
    private player: Player,
  ) {}

  /**
   * `shouldAttack` is the nation's attack gate (relations, difficulty),
   * reused for missile and satellite targets. At most one gold-spending
   * action is queued per tick, so none races another for the gold.
   */
  tick(
    projectKind: VictoryProjectKind | null,
    shouldAttack?: (other: Player) => boolean,
  ): void {
    const s = this.player.strategic();
    if (s === null || !this.player.isAlive()) return;
    this.shouldAttack = shouldAttack ?? null;
    this.intercept(s);
    if (nationHoldsStructuresForProject(this.game, this.player, projectKind)) {
      return;
    }
    // Gold goes to one action a tick, the rarer and costlier first.
    const { difficulty } = this.game.config().gameConfig();
    if (
      difficulty === Difficulty.Hard ||
      difficulty === Difficulty.Impossible
    ) {
      if (this.missileAtNukeFactories()) return;
      if (this.satellite(s)) return;
    }
    this.produce(s);
  }

  /** Every free silo slot fires at a satellite aimed at us, hydrogen bombs first. */
  private intercept(s: PlayerStrategic): void {
    const now = this.game.ticks();
    const me = this.player.smallID();
    const attacker = this.game.allPlayers().find((p) => {
      const sat = p.strategic()?.satellite();
      return (
        sat?.phase === "targeted" && sat.target === me && now < sat.strikeTick
      );
    });
    if (attacker === undefined) return;
    // One salvo per strike: its shots are judged on arrival.
    const sat = attacker.strategic()!.satellite();
    if (sat.phase === "targeted" && sat.interceptors.some((i) => i.by === me)) {
      return;
    }
    let slots = this.freeSiloSlots(s);
    for (const type of INTERCEPTOR_NUKES) {
      for (let left = s.stock(type); left > 0 && slots > 0; left--, slots--) {
        this.game.addExecution(
          new SatelliteInterceptExecution(this.player, attacker.id(), type),
        );
      }
    }
  }

  private freeSiloSlots(s: PlayerStrategic): number {
    let free = 0;
    for (const silo of this.player.units(UnitType.MissileSilo)) {
      if (!silo.isActive() || silo.isUnderConstruction()) continue;
      const held = s.holdsSiloSlot(silo.id()) ? 1 : 0;
      free += Math.max(
        0,
        silo.level() - silo.missileTimerQueue().length - held,
      );
    }
    return free;
  }

  private produce(s: PlayerStrategic): void {
    if (this.player.units(UnitType.MissileSilo).length === 0) return;
    if (
      factoryWithFreeLine(finishedFactories(this.player), s.jobs()) === null
    ) {
      return;
    }
    // Easy nations build slowly.
    const { difficulty } = this.game.config().gameConfig();
    if (difficulty === Difficulty.Easy && !this.random.chance(3)) {
      return;
    }
    const type = this.productionChoice(s);
    if (type === null) return;
    this.game.addExecution(new NukeProductionExecution(this.player, type));
  }

  /** A MIRV when a hydrogen bomb is affordable too, else hydrogen bombs, else atom bombs, up to a small stock. */
  private productionChoice(s: PlayerStrategic): StockpiledNuke | null {
    const gold = this.player.gold();
    const held = (t: StockpiledNuke) =>
      s.stock(t) + s.jobs().filter((j) => j.type === t).length;
    const ok = (t: StockpiledNuke) => !this.player.isUnitUnavailable(t);
    const { MIRV, HydrogenBomb, AtomBomb } = UnitType;
    if (
      ok(MIRV) &&
      held(MIRV) === 0 &&
      gold >= this.cost(MIRV) + this.cost(HydrogenBomb)
    ) {
      return MIRV;
    }
    if (
      ok(HydrogenBomb) &&
      held(HydrogenBomb) < HYDROGEN_STOCK &&
      gold >= this.cost(HydrogenBomb) * 2n
    ) {
      return HydrogenBomb;
    }
    if (
      ok(AtomBomb) &&
      held(AtomBomb) < ATOM_STOCK &&
      gold >= this.cost(AtomBomb) + RESERVE
    ) {
      return AtomBomb;
    }
    return null;
  }

  /** One missile a tick at a non-friendly factory making nukes, each factory once per MISSILE_RETRY_TICKS. */
  private missileAtNukeFactories(): boolean {
    const now = this.game.ticks();
    for (const [id, at] of this.lastMissileAt) {
      if (now - at >= MISSILE_RETRY_TICKS) this.lastMissileAt.delete(id);
    }
    if (
      this.player.gold() <
      this.cost(UnitType.ConventionalMissile) + RESERVE
    ) {
      return false;
    }
    for (const other of this.game.players()) {
      if (other === this.player || this.player.isFriendly(other, true)) {
        continue;
      }
      if (this.shouldAttack !== null && !this.shouldAttack(other)) continue;
      for (const job of other.strategic()?.jobs() ?? []) {
        if (this.lastMissileAt.has(job.factoryId)) continue;
        const factory = this.game.unit(job.factoryId);
        if (factory === undefined || !factory.isActive()) continue;
        const tile = factory.tile();
        if (
          this.player.canBuild(UnitType.ConventionalMissile, tile) === false
        ) {
          continue;
        }
        this.game.addExecution(
          new ConstructionExecution(
            this.player,
            UnitType.ConventionalMissile,
            tile,
          ),
        );
        this.lastMissileAt.set(job.factoryId, now);
        return true;
      }
    }
    return false;
  }

  private satellite(s: PlayerStrategic): boolean {
    const sat = s.satellite();
    if (sat.phase === "orbit") {
      const target = this.biggestTarget();
      if (target !== null) {
        this.game.addExecution(
          new SatelliteTargetExecution(this.player, target.id()),
        );
      }
      return false;
    }
    if (sat.phase !== "none") return false;
    if (this.player.isUnitUnavailable(UnitType.Satellite)) return false;
    if (
      this.player.gold() <
      this.cost(UnitType.Satellite) + SATELLITE_RESERVE
    ) {
      return false;
    }
    const silo = firstReadySilo(this.player);
    if (
      silo !== null &&
      this.player.canBuild(UnitType.Satellite, silo.tile()) !== false
    ) {
      this.game.addExecution(
        new ConstructionExecution(this.player, UnitType.Satellite, silo.tile()),
      );
      return true;
    }
    return false;
  }

  /** The biggest nation it may strike: the leader, or the runner-up when it leads itself; never tribes. */
  private biggestTarget(): Player | null {
    let best: Player | null = null;
    for (const p of this.game.players()) {
      if (p === this.player || p.type() === PlayerType.Bot) continue;
      if (this.player.isFriendly(p, true)) continue;
      if (!p.isAlive()) continue;
      if (this.shouldAttack !== null && !this.shouldAttack(p)) continue;
      if (best === null || p.numTilesOwned() > best.numTilesOwned()) best = p;
    }
    return best;
  }

  private cost(type: UnitType): Gold {
    return this.game.unitInfo(type).cost(this.game, this.player);
  }

  snapshot(w: SnapshotWriter): Versioned {
    return w.versioned(NationStrategicBehaviorSnapshot, {
      random: w.random(this.random),
      lastMissileAt: [...this.lastMissileAt],
    });
  }

  /** Fills a prototype-only shell; only assigns. */
  restoreSnapshot(raw: unknown, r: SnapshotReader, player: Player): void {
    const s = readVersioned(NationStrategicBehaviorSnapshot, raw);
    this.random = r.random(s.random);
    this.game = r.game;
    this.player = player;
    this.lastMissileAt = new Map(s.lastMissileAt);
  }
}

export const NationStrategicBehaviorSnapshot = snapshotType({
  name: "NationStrategicBehavior",
  version: 1,
  schema: z.object({
    random: zRandom(),
    lastMissileAt: z.array(z.tuple([zInt(), zInt()])),
  }),
});
