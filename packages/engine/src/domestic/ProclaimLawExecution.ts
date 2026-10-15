import {
  LAW_IDS,
  LAW_OPTIONS,
  LawId,
  LawOption,
} from "@openfront/engine-api/domestic/DomesticTypes";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { lawBlock, lawCost } from "@openfront/engine-lib/domestic/Laws";
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

/** proclaim_law: pays and proclaims one option of a law forever (spec §5.1). */
export class ProclaimLawExecution implements Execution {
  constructor(
    private player: Player,
    private law: LawId,
    private option: LawOption,
    private payWithGold: boolean,
  ) {}

  init(mg: Game, _ticks: number): void {
    const d = this.player.domestic();
    if (d === null || !this.player.isAlive()) return;
    const laws = d.proclaimedLaws();
    const block = lawBlock(
      this.law,
      laws.get(this.law),
      d.researchedTechs(),
      d.lawCooldownUntilTick(),
      mg.ticks(),
    );
    if (block !== null) return;
    const costMilli = lawCost(laws.size, d.pct("lawCost")) * MILLI;
    if (!payPoints(this.player, d, "political", costMilli, this.payWithGold)) {
      return;
    }
    d.proclaimLaw(this.law, this.option, mg.ticks());
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return ProclaimLawExecutionSnapshot.write({
      player: w.player(this.player),
      law: this.law,
      option: this.option,
      payWithGold: this.payWithGold,
    });
  }

  restoreSnapshot(s: ProclaimLawState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.law = s.law;
    this.option = s.option;
    this.payWithGold = s.payWithGold;
  }
}

const ProclaimLawStateSchema = z.object({
  player: zPlayerRef(),
  law: z.enum(LAW_IDS),
  option: z.enum(LAW_OPTIONS),
  payWithGold: z.boolean(),
});
type ProclaimLawState = z.infer<typeof ProclaimLawStateSchema>;

export const ProclaimLawExecutionSnapshot = execSnapshotType({
  name: "ProclaimLaw",
  version: 1,
  schema: ProclaimLawStateSchema,
  cls: () => ProclaimLawExecution,
});
