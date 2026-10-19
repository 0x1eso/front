import {
  BallotOption,
  MAX_EXTRA_VOTES,
  ResolutionId,
} from "@openfront/engine-api/congress/CongressTypes";
import type { VictoryProjectProgress } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  CONVENE_COST_MILLI,
  EMERGENCY_SESSION_GUARD_TICKS,
  extraVoteCostMilli,
} from "./CongressBalance";
import type { ResolutionLike } from "./ResolutionEffects";

// Rules the engine (Congress) and the client both read, so the screen can't
// drift from what the engine accepts.

/** What the seat rules read of an agenda item (AgendaItem and AgendaItemData both fit). */
export interface AgendaItemLike {
  readonly resolution: ResolutionId;
  /** smallIDs. */
  readonly targets: readonly number[];
}

/** S1 A in force against `smallID`, from a session or an aggression emergency (spec §8.1, §9.5). */
export function isSanctionedIn(
  active: readonly ResolutionLike[],
  smallID: number,
): boolean {
  return active.some(
    (r) =>
      r.resolution === "sanction" &&
      r.option === "A" &&
      r.targets.includes(smallID),
  );
}

/** Spec §6.2: a seat, or one of the item's targets, may vote on it. */
export function mayVote(
  item: AgendaItemLike,
  smallID: number,
  seats: readonly number[],
): boolean {
  return seats.includes(smallID) || item.targets.includes(smallID);
}

/**
 * Spec §9.3: on an emergency item the target and its friends may only
 * oppose. `friendlyTo(target)` says whether `smallID` is allied with (or a
 * teammate of, disconnected ones included) the item's target; it is only
 * called for an emergency item whose target `smallID` isn't.
 */
export function bOnlyFor(
  item: AgendaItemLike,
  smallID: number,
  friendlyTo: (target: number) => boolean,
): boolean {
  if (item.resolution !== "emergency") return false;
  if (item.targets.includes(smallID)) return true;
  const target = item.targets[0];
  return target !== undefined && friendlyTo(target);
}

export type BallotBlock =
  | "closed"
  | "item"
  | "seat"
  | "b_only"
  | "side"
  | "lower"
  | "influence";

export interface BallotAttempt {
  /** The session is open with this id, the close tick isn't reached, and the voter is alive with a congress state. */
  open: boolean;
  itemExists: boolean;
  /** A seat, or one of the item's targets. */
  eligible: boolean;
  /** Emergency votes: the target and its friends may only oppose. */
  bOnly: boolean;
  existing: { option: BallotOption; extra: number } | null;
  option: BallotOption;
  extra: number;
  influenceMilli: number;
}

/** Why a ballot (or a raise) is refused, or null when it counts (spec §6.3). Checked in this order. */
export function ballotBlock(a: BallotAttempt): BallotBlock | null {
  if (!a.open) return "closed";
  if (!a.itemExists) return "item";
  if (!a.eligible) return "seat";
  if (a.bOnly && a.option === "A") return "b_only";
  if (a.existing !== null && a.existing.option !== a.option) return "side";
  if (a.extra > MAX_EXTRA_VOTES) return "lower";
  if (a.existing !== null && a.extra <= a.existing.extra) return "lower";
  if (extraVoteCostMilli(a.existing?.extra ?? 0, a.extra) > a.influenceMilli) {
    return "influence";
  }
  return null;
}

export interface TallyBallot {
  option: BallotOption;
  extra: number;
}

export interface Tally {
  a: number;
  b: number;
  /** null: a tie (0 : 0 included) adopts nothing. */
  adopted: BallotOption | null;
}

/** Spec §6.4: one vote plus the extras per ballot; the larger side wins. */
export function tallyVotes(ballots: Iterable<TallyBallot>): Tally {
  let a = 0;
  let b = 0;
  for (const x of ballots) {
    if (x.option === "A") a += 1 + x.extra;
    else b += 1 + x.extra;
  }
  return { a, b, adopted: a > b ? "A" : b > a ? "B" : null };
}

export type ConveneBlock =
  | "unavailable"
  | "window"
  | "target"
  | "seat"
  | "friendly"
  | "sanctioned"
  | "influence";

export interface ConveneAttempt {
  /** (kind, target) is on the available list now. */
  available: boolean;
  /** conveneWindowOpen(...) now. */
  windowOpen: boolean;
  seated: boolean;
  isTarget: boolean;
  /** Allied with (or a teammate of) the target. */
  friendlyToTarget: boolean;
  sanctioned: boolean;
  influenceMilli: number;
}

/** Why `convene_emergency` is refused, or null when it opens the vote (spec §9.2). Checked in this order. */
export function conveneBlock(a: ConveneAttempt): ConveneBlock | null {
  if (!a.available) return "unavailable";
  if (!a.windowOpen) return "window";
  if (a.isTarget) return "target";
  if (!a.seated) return "seat";
  if (a.friendlyToTarget) return "friendly";
  if (a.sanctioned) return "sanctioned";
  if (a.influenceMilli < CONVENE_COST_MILLI) return "influence";
  return null;
}

/** Spec §9.1: no convening while a session votes, during an emergency, or 30 s before a regular session. */
export function conveneWindowOpen(
  now: number,
  sessionOpen: boolean,
  emergencyActive: boolean,
  nextSessionTick: number | null,
): boolean {
  return (
    !sessionOpen &&
    !emergencyActive &&
    (nextSessionTick === null ||
      now < nextSessionTick - EMERGENCY_SESSION_GUARD_TICKS)
  );
}

/**
 * Spec §10.1 step 6: a complete proclamation whose latest decision isn't an
 * approval of this host waits for ratification. `verdict` is the latest
 * decision on its owner's proclamation, if any. The engine
 * (WorldGovernment.awaitsRatification) and the victory tab both read it.
 */
export function awaitingRatification(
  project: Pick<
    VictoryProjectProgress,
    "kind" | "ticksLeft" | "hostUnitId"
  > | null,
  verdict: { readonly host: number; readonly ratified: boolean } | undefined,
): boolean {
  if (project === null || project.kind !== "political") return false;
  if (project.ticksLeft > 0) return false;
  return !(
    verdict !== undefined &&
    verdict.host === project.hostUnitId &&
    verdict.ratified
  );
}
