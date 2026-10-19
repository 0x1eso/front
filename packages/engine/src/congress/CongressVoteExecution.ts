import {
  BALLOT_OPTIONS,
  BallotOption,
} from "@openfront/engine-api/congress/CongressTypes";
import { zInt, zPlayerRef } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";
import { Execution, Game, Player } from "../game/Game";
import { execSnapshotType } from "../snapshot/ExecutionSnapshot";
import type {
  ExecRecord,
  SnapshotReader,
  SnapshotWriter,
} from "../snapshot/SnapshotContext";

/** congress_vote (spec §6.3): a ballot or a raise; Congress.castBallot checks it. */
export class CongressVoteExecution implements Execution {
  constructor(
    private player: Player,
    private sessionId: number,
    private item: number,
    private option: BallotOption,
    private extra: number,
  ) {}

  init(mg: Game, _ticks: number): void {
    mg.congress()?.castBallot(
      this.player,
      this.sessionId,
      this.item,
      this.option,
      this.extra,
    );
  }

  tick(_ticks: number): void {}

  isActive(): boolean {
    return false;
  }

  activeDuringSpawnPhase(): boolean {
    return false;
  }

  snapshot(w: SnapshotWriter): ExecRecord {
    return CongressVoteExecutionSnapshot.write({
      player: w.player(this.player),
      sessionId: this.sessionId,
      item: this.item,
      option: this.option,
      extra: this.extra,
    });
  }

  restoreSnapshot(s: CongressVoteState, r: SnapshotReader): void {
    this.player = r.player(s.player);
    this.sessionId = s.sessionId;
    this.item = s.item;
    this.option = s.option;
    this.extra = s.extra;
  }
}

const CongressVoteStateSchema = z.object({
  player: zPlayerRef(),
  sessionId: zInt(),
  item: zInt(),
  option: z.enum(BALLOT_OPTIONS),
  extra: zInt(),
});
type CongressVoteState = z.infer<typeof CongressVoteStateSchema>;

export const CongressVoteExecutionSnapshot = execSnapshotType({
  name: "CongressVote",
  version: 1,
  schema: CongressVoteStateSchema,
  cls: () => CongressVoteExecution,
});
