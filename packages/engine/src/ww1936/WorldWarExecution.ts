import { MessageType } from "@openfront/engine-api/game/GameTypes";
import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { PseudoRandom } from "@openfront/engine-lib/PseudoRandom";
import { zRandom } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { checkCapitulations, stepTransfers } from "./Capitulation";
import { processHistory, rollHistory } from "./HistoryRun";

/**
 * World War 1936 clock (spec §7): the preparation end, once a day the
 * historical calendar and the capitulation check, every tick the land
 * transfers and the economy (P1 spec §2), and the WorldWar and WwEconomy
 * updates when their data changed.
 */
export class WorldWarExecution implements Execution {
  private active = true;
  private mg: Game | null = null;
  private random: PseudoRandom;

  constructor(seed: number) {
    this.random = new PseudoRandom(seed);
  }

  init(mg: Game, _ticks: number): void {
    this.mg = mg;
    const ww = mg.worldWar();
    if (ww !== null && !ww.historyRolled()) {
      rollHistory(ww, this.random, mg.config().historicalAi());
    }
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
        processHistory(mg, ww, day, ticks);
        checkCapitulations(mg, ww, ticks);
      }
    }
    stepTransfers(mg, ww);
    // P1 (spec §2): the day's common step, then this tick's share of countries.
    ww.economy.tick(ticks);
    const data = ww.takeData();
    if (data !== null) mg.addUpdate({ type: GameUpdateType.WorldWar, data });
    const econ = ww.economy.takeData();
    if (econ !== null) {
      mg.addUpdate({ type: GameUpdateType.WwEconomy, data: econ });
    }
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
    });
  }

  restoreSnapshot(s: WorldWarExecState, r: SnapshotReader): void {
    this.active = s.active;
    this.mg = s.initialized ? r.game : null;
    this.random = r.random(s.random);
  }
}

const WorldWarExecStateSchema = z.object({
  active: z.boolean(),
  initialized: z.boolean(),
  random: zRandom(),
});
type WorldWarExecState = z.infer<typeof WorldWarExecStateSchema>;

export const WorldWarExecutionSnapshot = execSnapshotType({
  name: "WorldWar",
  version: 1,
  schema: WorldWarExecStateSchema,
  cls: () => WorldWarExecution,
});
