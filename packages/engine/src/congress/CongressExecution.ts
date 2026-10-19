import { GameUpdateType } from "@openfront/engine-api/game/GameUpdates";
import { SESSION_INTERVAL_TICKS } from "@openfront/engine-lib/congress/CongressBalance";
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
import { refreshCongressEffects } from "./Effects";
import { onEmergencyVote, processEmergencySecond } from "./Emergencies";
import { accrueInfluence } from "./Influence";
import { onRegularResult, openRegularSession } from "./Sessions";

/**
 * The world congress clock (spec §6.1, plan decision 9): closes sessions at
 * their close tick, opens regular ones on schedule, and runs the second of
 * influence, emergencies and effects. One per game, added by GameRunner
 * when the option is on; the state lives in Congress and PlayerCongress.
 */
export class CongressExecution implements Execution {
  private mg: Game | undefined = undefined;
  private random: PseudoRandom;

  constructor(seed: number) {
    this.random = new PseudoRandom(seed);
  }

  init(mg: Game, ticks: number): void {
    this.mg = mg;
    const c = mg.congress();
    if (c !== null && c.nextSessionTick() === null) {
      c.scheduleNextSession(ticks + SESSION_INTERVAL_TICKS);
    }
  }

  tick(_ticks: number): void {
    const mg = this.mg;
    const c = mg?.congress() ?? null;
    if (mg === undefined || c === null) return;
    const now = mg.ticks();
    const open = c.session();
    if (open !== null && now >= open.closeTick) {
      const results = c.closeSession();
      if (open.kind === "regular") {
        c.dropTallyResolutions();
        for (const r of results) onRegularResult(mg, c, r);
      } else {
        for (const r of results) onEmergencyVote(mg, c, r);
      }
    }
    const next = c.nextSessionTick();
    if (
      c.session() === null &&
      mg.getWinner() === null &&
      next !== null &&
      now >= next
    ) {
      openRegularSession(mg, c, this.random);
      c.scheduleNextSession(next + SESSION_INTERVAL_TICKS);
    }
    if (now % 10 === 0) {
      c.expireResolutions(now);
      c.prunePairs(now);
      accrueInfluence(mg, c);
      processEmergencySecond(mg, c);
      refreshCongressEffects(mg, c);
      c.refreshRanking(now);
    }
    const data = c.takeUnsentData();
    if (data !== null) mg.addUpdate({ type: GameUpdateType.Congress, data });
  }

  isActive(): boolean {
    return true;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CongressExecutionSnapshot.write({
      initialized: this.mg !== undefined,
      random: w.random(this.random),
    });
  }

  restoreSnapshot(s: CongressExecState, r: SnapshotReader): void {
    this.mg = s.initialized ? r.game : undefined;
    this.random = r.random(s.random);
  }
}

const CongressExecStateSchema = z.object({
  initialized: z.boolean(),
  random: zRandom(),
});
type CongressExecState = z.infer<typeof CongressExecStateSchema>;

export const CongressExecutionSnapshot = execSnapshotType({
  name: "Congress",
  version: 1,
  schema: CongressExecStateSchema,
  cls: () => CongressExecution,
});
