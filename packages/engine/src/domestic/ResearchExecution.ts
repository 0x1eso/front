import { TECH_IDS, TechId } from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import {
  researchBlock,
  researchTicks,
} from "@openfront/engine-lib/domestic/Research";
import { TECHS } from "@openfront/engine-lib/domestic/Techs";
import { zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";
import { payPoints } from "./DomesticEconomy";

/** research_tech: pays for a tech and starts researching it (spec §4.1). */
export class ResearchExecution implements Execution {
  constructor(
    private player: Player,
    private tech: TechId,
    private payWithGold: boolean,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    if (
      researchBlock(
        d.researchedTechs(),
        d.currentResearch() !== null,
        this.tech,
      ) !== null
    ) {
      return;
    }
    const costMilli = TECHS[this.tech].cost * MILLI;
    if (
      !payPoints(mg, this.player, d, "science", costMilli, this.payWithGold)
    ) {
      return;
    }
    d.beginResearch(this.tech, researchTicks(this.tech, d.pct("researchTime")));
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ResearchExecutionSnapshot.write({
      player: w.player(this.player),
      tech: this.tech,
      payWithGold: this.payWithGold,
    });
  }

  restoreSnapshot(s: ResearchState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.tech = s.tech;
    this.payWithGold = s.payWithGold;
  }
}

const ResearchStateSchema = z.object({
  player: zPlayerRef(),
  tech: z.enum(TECH_IDS),
  payWithGold: z.boolean(),
});
type ResearchState = z.infer<typeof ResearchStateSchema>;

export const ResearchExecutionSnapshot = execSnapshotType({
  name: "Research",
  version: 1,
  schema: ResearchStateSchema,
  cls: () => ResearchExecution,
});
