import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { zInt, zRandom } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { checkCapitulations, stepTransfers } from "./Capitulation";

/**
 * World War 1936 clock (spec §7; P3 spec §2.2): the preparation end, once a
 * day the capitulation check, every tick the land transfers, politics' day
 * (P3: the history beats live there), the economy (P1 spec §2), the land war
 * (P2 spec §2.2), the human event cards' deadlines, and the WorldWar,
 * WwEconomy, WwLand and WwPolitics updates when their data changed.
 */
export class WorldWarExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  /** Unused since P3 (plan decision 2); kept for the snapshot schema. */
  private random: PseudoRandom;

  /** `seed`: simpleHash(gameID) + 1936; politics rolls with seed + 1 once. */
  constructor(private seed: number) {
    this.random = new PseudoRandom(seed);
  }

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    const ww = mg.worldWar();
    // Plan decision 2: P0's stateful roll is gone; politics rolls once from the seed.
    if (ww !== null && !ww.politics.rolled()) {
      ww.politics.roll(this.seed + 1, mg.config().historicalAi());
    }
    // P4 (pre-flight A14): the naval and air beats, once, the same seed base.
    if (ww !== null && !ww.navy.beatsRolled) ww.navy.rollBeats(this.seed + 1);
  }

  tick(ticks: number): void {
    const mg = this.mg;
    const ww = mg?.worldWar() ?? null;
    if (mg === null || ww === null) {
      this.active = false;
      return;
    }
    if (ticks === ww.prepEndTick()) {
      mg.displayMessage(
        "events_display.ww1936_prep_over",
        MessageType.WORLD_WAR,
        null,
      );
    }
    // Once a day, from the first tick after the preparation minute (day 0
    // runs at prepEndTick).
    if (!ww.inPrep(ticks)) {
      const day = ww.day(ticks);
      if (day !== ww.lastDay()) {
        ww.setLastDay(day);
        // Order 1 (P3 spec §2.2): processHistory is gone, beats are politics'.
        checkCapitulations(mg, ww, ticks);
      }
    }
    stepTransfers(mg, ww);
    // P3 order 2 and 3: politics' common day, then this tick's countries.
    ww.politics.tick(ticks);
    // P5 (spec §2.2 orders 2–3): the endgame's common day and its countries.
    ww.endgame.clock(ticks);
    // P6 (plan decision 3): the depth systems' common day and countries,
    // before the economy turn (pre-flight §0-8).
    ww.depth.clock(ticks);
    // P1 (spec §2): the day's common step, then this tick's share of countries.
    ww.economy.tick(ticks);
    // P2 (spec §2.2): the land war after the economy.
    ww.land.tick(ticks);
    // P4 (spec §2.2-6, -7): the navy, then the air war.
    ww.navy.tick(ticks);
    ww.air.tick(ticks);
    // P5 (spec §2.2 order 8): conference deadlines, takeovers, woken countries.
    ww.endgame.tick(ticks);
    // P3 order 6: human event cards past their deadline.
    ww.politics.tickDeadlines(ticks);
    const data = ww.takeData();
    if (data !== null) mg.addUpdate({ type: GameUpdateType.WorldWar, data });
    const econ = ww.economy.takeData();
    if (econ !== null) {
      mg.addUpdate({ type: GameUpdateType.WwEconomy, data: econ });
    }
    const land = ww.land.takeData();
    if (land !== null)
      mg.addUpdate({ type: GameUpdateType.WwLand, data: land });
    const pol = ww.politics.takeData();
    if (pol !== null) {
      mg.addUpdate({ type: GameUpdateType.WwPolitics, data: pol });
    }
    // P4 (plan decision 4): after P3's.
    const navy = ww.navy.takeData();
    if (navy !== null)
      mg.addUpdate({ type: GameUpdateType.WwNavy, data: navy });
    const air = ww.air.takeData();
    if (air !== null) mg.addUpdate({ type: GameUpdateType.WwAir, data: air });
    // P5 (plan decision 23): after P4's.
    const eg = ww.endgame.takeData();
    if (eg !== null) mg.addUpdate({ type: GameUpdateType.WwEndgame, data: eg });
    // P6 (plan decision 36): after P5's.
    const dp = ww.depth.takeData();
    if (dp !== null) mg.addUpdate({ type: GameUpdateType.WwDepth, data: dp });
  }

  isActive(): boolean {
    return this.active;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return WorldWarExecutionSnapshot.write({
      active: this.active,
      initialized: this.mg !== null,
      random: w.random(this.random),
      seed: this.seed,
    });
  }

  restoreSnapshot(s: WorldWarExecState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
    // A restored game has rolled already; the seed is kept for equality.
    this.seed = s.seed ?? 0;
  }
}

const WorldWarExecStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
  /** P3: the politics seed's base (optional: older records lack it). */
  seed: zInt().optional(),
});
type WorldWarExecState = z.infer<typeof WorldWarExecStateSchema>;

export const WorldWarExecutionSnapshot = execSnapshotType({
  name: "WorldWar",
  version: 1,
  schema: WorldWarExecStateSchema,
  cls: () => WorldWarExecution,
});
