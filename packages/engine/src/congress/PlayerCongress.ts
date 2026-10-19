import {
  BALLOT_OPTIONS,
  BallotOption,
  INFLUENCE_STATUSES,
  InfluenceStatus,
  PlayerCongressData,
} from "@openfront/engine-api/congress/CongressTypes";
import {
  CONFLICT_MEMORY_TICKS,
  INFLUENCE_CAP_MILLI,
  LEDGER_BUCKETS,
  ledgerBucket,
} from "@openfront/engine-lib/congress/CongressBalance";
import {
  copyRing,
  newRing,
  Ring,
  ringAdd,
  RingSchema,
  ringSum,
} from "@openfront/engine-lib/congress/Ring";
import { MILLI } from "@openfront/engine-lib/domestic/Balance";
import { zInt } from "@openfront/engine-lib/snapshot/SnapshotType";
import { z } from "zod";

/** One ballot, with the influence it holds in escrow until the tally. */
export interface StoredBallot {
  sessionId: number;
  item: number;
  option: BallotOption;
  extra: number;
  costMilli: number;
}

const BallotSchema = z.object({
  sessionId: zInt(),
  item: zInt(),
  option: z.enum(BALLOT_OPTIONS),
  extra: zInt(),
  costMilli: zInt(),
});

export const PlayerCongressStateSchema = z.object({
  influenceMilli: zInt(),
  lastInfluenceMilli: zInt(),
  status: z.enum(INFLUENCE_STATUSES),
  taken: RingSchema,
  lost: RingSchema,
  nukes: RingSchema,
  hitBy: z.array(z.tuple([zInt(), zInt()])),
  ballots: z.array(BallotSchema),
});
export type PlayerCongressState = z.infer<typeof PlayerCongressStateSchema>;

/** In the schema's key order, so a restored state snapshots like the live one. */
function copyBallot(b: StoredBallot): StoredBallot {
  return {
    sessionId: b.sessionId,
    item: b.item,
    option: b.option,
    extra: b.extra,
    costMilli: b.costMilli,
  };
}

/**
 * A player's world-congress state (spec §4, §5, §6): influence in integer
 * milli-points, the aggression ledger's rings (tiles taken as aggression,
 * tiles lost, nuke score), who hit this player lately, and the ballots it
 * cast in the open session. Every human and nation of a congress game has
 * one; bots don't.
 */
export class PlayerCongress {
  private influence = 0;
  private lastInfluence = 0;
  private _status: InfluenceStatus = "peaceful";
  private taken: Ring = newRing(LEDGER_BUCKETS);
  private lost: Ring = newRing(LEDGER_BUCKETS);
  private nukes: Ring = newRing(LEDGER_BUCKETS);
  /** smallID -> last tick it took land from or nuked this player, oldest first. */
  private hitBy = new Map<number, number>();
  private ballots: StoredBallot[] = [];
  /** toData() result until the next change. */
  private congressPlayerDataCache: PlayerCongressData | null = null;

  influenceMilli(): number {
    return this.influence;
  }

  status(): InfluenceStatus {
    return this._status;
  }

  /** One second of accrual (spec §5.1): adds up to the cap and records the rate and the status. */
  accrue(milli: number, status: InfluenceStatus): void {
    const room = Math.max(0, INFLUENCE_CAP_MILLI - this.influence);
    const add = Math.max(0, Math.min(milli, room));
    const s: InfluenceStatus =
      status === "peaceful" && room === 0 ? "capped" : status;
    if (add === 0 && this.lastInfluence === 0 && s === this._status) return;
    this.influence += add;
    this.lastInfluence = add;
    this._status = s;
    this.changed();
  }

  /** Refunds and lump sums: no cap. */
  grant(milli: number): void {
    if (milli <= 0) return;
    this.influence += milli;
    this.changed();
  }

  spend(milli: number): void {
    if (milli < 0 || milli > this.influence) {
      throw new Error(
        `cannot spend ${milli} influence milli-points, have ${this.influence}`,
      );
    }
    if (milli === 0) return;
    this.influence -= milli;
    this.changed();
  }

  /** Hegemony emergency success (spec §9.5). */
  clearInfluence(): void {
    if (this.influence === 0) return;
    this.influence = 0;
    this.changed();
  }

  recordTaken(tick: number, n: number): void {
    ringAdd(this.taken, ledgerBucket(tick), n);
  }

  recordLost(tick: number, n: number): void {
    ringAdd(this.lost, ledgerBucket(tick), n);
  }

  recordNuke(tick: number, score: number): void {
    ringAdd(this.nukes, ledgerBucket(tick), score);
  }

  recordHitBy(smallID: number, tick: number): void {
    this.hitBy.delete(smallID);
    this.hitBy.set(smallID, tick);
    for (const [id, t] of this.hitBy) {
      if (t >= tick - CONFLICT_MEMORY_TICKS) break;
      this.hitBy.delete(id);
    }
  }

  /** Tiles taken as aggression in the 180 s ending at `tick`. */
  takenTiles(tick: number): number {
    return ringSum(this.taken, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  lostTiles(tick: number): number {
    return ringSum(this.lost, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  nukeScore(tick: number): number {
    return ringSum(this.nukes, ledgerBucket(tick), LEDGER_BUCKETS);
  }

  /**
   * The last tick `smallID` took land from or nuked this player, or null if
   * none is on record. Old entries are pruned lazily (only when a new hit is
   * recorded), so an entry can be older than CONFLICT_MEMORY_TICKS: callers
   * must check its age.
   */
  lastHitTick(smallID: number): number | null {
    return this.hitBy.get(smallID) ?? null;
  }

  ballot(sessionId: number, item: number): StoredBallot | null {
    return (
      this.ballots.find((b) => b.sessionId === sessionId && b.item === item) ??
      null
    );
  }

  ballotsFor(sessionId: number): StoredBallot[] {
    return this.ballots.filter((b) => b.sessionId === sessionId);
  }

  setBallot(b: StoredBallot): void {
    const i = this.ballots.findIndex(
      (x) => x.sessionId === b.sessionId && x.item === b.item,
    );
    if (i === -1) this.ballots.push(copyBallot(b));
    else this.ballots[i] = copyBallot(b);
    this.changed();
  }

  clearBallots(sessionId: number): void {
    const keep = this.ballots.filter((b) => b.sessionId !== sessionId);
    if (keep.length === this.ballots.length) return;
    this.ballots = keep;
    this.changed();
  }

  /**
   * The data for PlayerUpdate.congress. `emergencyMember` (Congress knows it)
   * is added only when true: CongressData lists a member only once it has
   * contributed (spec §6.5), so this is how the member's own UI knows.
   */
  toData(emergencyMember = false): PlayerCongressData {
    const cached = this.congressPlayerDataCache;
    if (
      cached !== null &&
      (cached.emergencyMember === true) === emergencyMember
    ) {
      return cached;
    }
    this.congressPlayerDataCache = {
      influence: Math.floor(this.influence / MILLI),
      influencePerSec: this.lastInfluence / MILLI,
      status: this._status,
      ballots: this.ballots.map(({ sessionId, item, option, extra }) => ({
        sessionId,
        item,
        option,
        extra,
      })),
      ...(emergencyMember ? { emergencyMember: true } : {}),
    };
    return this.congressPlayerDataCache;
  }

  snapshot(): PlayerCongressState {
    return {
      influenceMilli: this.influence,
      lastInfluenceMilli: this.lastInfluence,
      status: this._status,
      taken: copyRing(this.taken),
      lost: copyRing(this.lost),
      nukes: copyRing(this.nukes),
      hitBy: [...this.hitBy],
      ballots: this.ballots.map(copyBallot),
    };
  }

  static restore(s: PlayerCongressState): PlayerCongress {
    const p = new PlayerCongress();
    p.influence = s.influenceMilli;
    p.lastInfluence = s.lastInfluenceMilli;
    p._status = s.status;
    p.taken = copyRing(s.taken);
    p.lost = copyRing(s.lost);
    p.nukes = copyRing(s.nukes);
    p.hitBy = new Map(s.hitBy);
    p.ballots = s.ballots.map(copyBallot);
    p.congressPlayerDataCache = null;
    return p;
  }

  private changed(): void {
    this.congressPlayerDataCache = null;
  }
}
