import { EmergencyKind } from "@openfront/engine-api/congress/CongressTypes";
import { LawId, LawOption } from "@openfront/engine-api/domestic/DomesticTypes";
import { Difficulty, UnitType } from "@openfront/engine-api/game/GameTypes";
import { MILLI } from "../domestic/Balance";

export {
  MAX_AGENDA_ITEMS,
  MAX_EXTRA_VOTES,
} from "@openfront/engine-api/congress/CongressTypes";

// World congress tunables (spec §15). Ticks are 1/10 s.

// Sessions (spec §6).
export const SESSION_INTERVAL_TICKS = 1800;
/** The dial turns gold this long before a session opens. */
export const SESSION_NOTICE_TICKS = 200;
export const VOTING_TICKS = 300;
export const EMERGENCY_VOTING_TICKS = 200;
export const AI_SEATS = 6;
/** Influence points per extra vote step: the k-th extra vote costs k × this. */
export const EXTRA_VOTE_STEP = 10;
export const HISTORY_LENGTH = 8;

/** Whole points for `extra` extra votes in all: 10, 30, 60, 100, 150. */
export function extraVoteCost(extra: number): number {
  return (EXTRA_VOTE_STEP * extra * (extra + 1)) / 2;
}

/** Milli-points to raise a ballot from `from` to `to` extra votes. */
export function extraVoteCostMilli(from: number, to: number): number {
  return Math.max(0, extraVoteCost(to) - extraVoteCost(from)) * MILLI;
}

// Influence (spec §5), in milli-points a second.
export const INFLUENCE_CAP_MILLI = 300 * MILLI;
export const INFLUENCE_BASE_MILLI = 100;
export const INFLUENCE_PER_TIER_MILLI = 50;
/** Percent of last second's political output. */
export const INFLUENCE_POLITICAL_SHARE_PCT = 5;
export const INFLUENCE_PER_ALLY_MILLI = 50;
export const INFLUENCE_MAX_ALLIES = 3;
/** E5 support / condemnation, in percent of the rate. */
export const GOVERNMENT_SUPPORT_INFLUENCE_PCT = 125;
export const GOVERNMENT_CONDEMN_INFLUENCE_PCT = 0;

// The aggression ledger (spec §4).
export const LEDGER_BUCKET_TICKS = 100;
/** 180 s. */
export const LEDGER_BUCKETS = 18;
/** 120 s. */
export const WAR_PAIR_BUCKETS = 12;
/** A war pair with no capture for this long is over; the next one has a new initiator. */
export const CONFLICT_MEMORY_TICKS = 1800;

/** The ledger bucket (10 s) a tick falls in. */
export function ledgerBucket(tick: number): number {
  return Math.floor(tick / LEDGER_BUCKET_TICKS);
}

// Agenda (spec §7).
export const VICTIM_MIN_PCT = 15;
export const AGGRESSOR_MIN_PCT = 0.5;
/** An aggressor this strong gets a sanction again right after one. */
export const AGGRESSOR_REPEAT_PCT = 2;
export const WAR_PAIR_MIN_PCT = 0.3;
export const RUNAWAY_FACTOR = 1.5;
export const RANK_LENGTH = 5;
export const RANK_MIN_AGGRESSION_PCT = 0.1;
export const RANK_MIN_VICTIM_PCT = 1;

// Resolutions (spec §8).
export const TRUCE_TICKS = 1200;
export const DUEL_SPEED_PCT = 25;
export const DUEL_LOSS_PCT = -15;
export const PROTECTORATE_ATTACK_LOSS_PCT = 40;
export const PROTECTORATE_ATTACK_SPEED_PCT = -20;
export const PROTECTORATE_DEFENSE_LOSS_PCT = -20;
export const PARTITION_ATTACK_LOSS_PCT = -20;
export const HEGEMONY_CHECK_ATTACK_LOSS_PCT = -15;
export const CONDEMN_SPEED_PCT = 20;
export const CONDEMN_LOSS_PCT = -20;
export const TECH_PACT_DISCOUNT_PCT = -30;
export const TECH_PACT_MIN_HOLDERS = 2;
export const PATENT_SECONDS = 60;
export const WORLD_GOV_STEP_TICKS = 600;

// Emergencies (spec §9).
export const EMERGENCY_AGGRESSION_PCT = 5;
export const EMERGENCY_NUKE_SCORE = 3;
export const HEGEMONY_THRESHOLDS_PCT = [40, 55] as const;
export const ELIMINATION_MEMORY_TICKS = 1800;
export const EMERGENCY_GLOBAL_COOLDOWN_TICKS = 3000;
export const EMERGENCY_TARGET_COOLDOWN_TICKS = 6000;
export const EMERGENCY_MAX_PER_GAME = 3;
/** No convening this close before a regular session opens. */
export const EMERGENCY_SESSION_GUARD_TICKS = 300;
export const CONVENE_COST_MILLI = 50 * MILLI;
export const EMERGENCY_DURATION_TICKS: Readonly<Record<EmergencyKind, number>> =
  {
    aggression: 1500,
    nuclear: 1800,
    hegemony: 1800,
  };
export const AGGRESSION_GOAL_PCT = 15;
export const HEGEMONY_GOAL_PCT = 10;
export const NUCLEAR_NO_SILO_GOAL_PCT = 10;
export const LAND_GOAL_MIN_TILES = 300;
/** A goal silo a member destroys or captures counts this share of the world's land as contribution. */
export const SILO_CREDIT_WORLD_PCT = 0.2;
export const MEMBER_SPEED_PCT = 20;
export const MEMBER_LOSS_PCT = -20;
export const REWARD_SECONDS = 45;
export const REWARD_INFLUENCE_MILLI = 30 * MILLI;
export const HERO_MULT = 2;
export const SURVIVE_SECONDS = 60;
export const SURVIVE_INFLUENCE_MILLI = 60 * MILLI;
export const AFTERMATH_TRUCE_TICKS = 600;
export const NUCLEAR_SUCCESS_BAN_TICKS = 3000;
export const HEGEMONY_FAIL_GOLD_PCT = 10;

// Nations (spec §11).
export const AI_EXTRA_CAP: Readonly<Record<Difficulty, number>> = {
  [Difficulty.Easy]: 0,
  [Difficulty.Medium]: 1,
  [Difficulty.Hard]: 3,
  [Difficulty.Impossible]: 5,
};
/** Nations keep this share of their influence back. */
export const AI_RESERVE_PCT = 30;
export const AI_CONVENE_DELAY_TICKS = 200;
export const AI_CONVENE_MIN_INFLUENCE_MILLI = 80 * MILLI;
/** Nations vote this long after a session opens: 10 + (smallID × 7 mod 70). */
export function aiVoteDelayTicks(smallID: number): number {
  return 10 + ((smallID * 7) % 70);
}

/** Rounds to one decimal (percent shown on cards and rankings). */
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** What scores toward the nuclear emergency (spec §4.2, §9.1). */
export type NukeWeapon =
  | UnitType.AtomBomb
  | UnitType.HydrogenBomb
  | UnitType.MIRV
  | UnitType.MIRVWarhead
  | "orbital";

/** Atom 1, hydrogen 2, MIRV 3 (once, at separation), orbital strike 3; warheads 0. */
export function nukeScore(weapon: NukeWeapon): number {
  switch (weapon) {
    case UnitType.AtomBomb:
      return 1;
    case UnitType.HydrogenBomb:
      return 2;
    case UnitType.MIRV:
    case "orbital":
      return 3;
    case UnitType.MIRVWarhead:
      return 0;
  }
}

/** E6's military laws (spec §7.2), in pick order. */
export const MILITARY_LAWS: readonly {
  readonly law: LawId;
  readonly option: LawOption;
}[] = [
  { law: "doctrine", option: "B" },
  { law: "service", option: "A" },
  { law: "mobilization", option: "A" },
  { law: "nuclear", option: "A" },
  { law: "service", option: "B" },
];
