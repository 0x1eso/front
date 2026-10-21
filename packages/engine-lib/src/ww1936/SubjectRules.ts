// World War 1936 P5 (spec §9, §17.3): the subjects' pure rules that the
// engine (endgame/Subjects.ts, AiSubjects.ts) and the screens share
// (Global Constraints: package boundaries) — what a subject may not do on
// its own, how it follows its overlord's wars, what flows to the overlord,
// the dominion's trade price, the level steps and the AI's thresholds.
// Integers only. autonomyDelta and subjectShares are in EndgameRules.
import {
  SUBJECT_LEVELS,
  SubjectLevel,
} from "@openfront/engine-api/ww1936/EndgameTypes";
import { subjectShares } from "./EndgameRules";

/** What a subject's own diplomacy order is (WwEndgame.subjectBlock). */
export type SubjectAction =
  | "declare"
  | "justify"
  | "faction"
  | "treaty"
  | "leave_faction";

/** Spec §9.3: autonomy after a level up (granted request) and a level down. */
export const WW_SUBJECT_UP_AUT_BP = 2000;
export const WW_SUBJECT_DOWN_AUT_BP = 8000;
/** Spec §9.2: autonomy runs 0..10,000 bp within a level. */
export const WW_SUBJECT_FULL_AUT_BP = 10000;
/** Spec §9.1: an AI subject's weight to answer its overlord's call to arms. */
export const WW_SUBJECT_CALL_PCT = { colony: 95, dominion: 80 } as const;
/** Spec §9.3: the AI's independence war needs this strength ‰ of its overlord's. */
export const WW_SUBJECT_INDEPENDENCE_RATIO_PM = 800;
/** Spec §17.3: an AI subject of another ideology demands autonomy from this much PP. */
export const WW_SUBJECT_DEMAND_PP = 150;
/** Spec §17.3: an AI overlord tightens its grip from this autonomy (not on a dominion). */
export const WW_SUBJECT_TIGHTEN_AUT_BP = 8000;
/** Spec §17.3: an AI overlord annexes an integrated puppet with fewer points than this % of its own. */
export const WW_SUBJECT_ANNEX_VP_PCT = 10;
/** Spec §9.1: the overlord pays this percent of the civilian factories when it buys from its dominion. */
export const WW_DOMINION_TRADE_PCT = 50;

/**
 * Spec §9.1 (diplomacy column): whether a subject may not do `action` on
 * its own. Integrated and puppet (and a neutral collaborator, a puppet that
 * only stays out of the wars): no declaration (the target-aware "only the
 * overlord's enemies" rule is P0 declareWarBlock's), justification,
 * faction or treaty orders; a colony: no faction change; a dominion: it may
 * not leave the faction.
 */
export function subjectActionBlocked(
  level: SubjectLevel,
  neutral: boolean,
  action: SubjectAction,
): boolean {
  if (neutral || level === "integrated" || level === "puppet") return true;
  if (level === "colony") {
    return action === "faction" || action === "leave_faction";
  }
  return action === "leave_faction";
}

/**
 * Spec §9.1 (wars column): how a subject follows a war its overlord is
 * drawn into. "join": at once on the overlord's side; "call": a call to
 * arms it may refuse; "none": it stays out (a neutral collaborator).
 */
export function subjectWarRule(
  level: SubjectLevel,
  neutral: boolean,
  defensive: boolean,
): "join" | "call" | "none" {
  if (neutral) return "none";
  if (level === "integrated" || level === "puppet") return "join";
  if (level === "colony") return defensive ? "join" : "call";
  return "call";
}

/** The level one step up (more autonomy) or down; null: up from a dominion is independence. */
export function levelAfter(
  level: SubjectLevel,
  dir: "up" | "down",
): SubjectLevel | null {
  const i = SUBJECT_LEVELS.indexOf(level);
  if (dir === "up") {
    return i + 1 < SUBJECT_LEVELS.length ? SUBJECT_LEVELS[i + 1] : null;
  }
  return SUBJECT_LEVELS[Math.max(0, i - 1)];
}

/** Spec §9.2: the day's autonomy, 0..10,000. */
export function autonomyAfter(autBp: number, deltaBp: number): number {
  return Math.max(0, Math.min(WW_SUBJECT_FULL_AUT_BP, autBp + deltaBp));
}

/**
 * Spec §9.1 (what the overlord takes): of the subject's own output — its
 * resources produced, civilian factories and recruitable men — the level's
 * shares, rounded down.
 */
export function subjectFlows(
  level: SubjectLevel,
  produced: readonly number[],
  civ: number,
  recruitable: number,
): { res: number[]; civ: number; manpower: number } {
  const s = subjectShares(level);
  return {
    res: produced.map((p) =>
      Math.floor((Math.max(0, p) * s.resourcePct) / 100),
    ),
    civ: Math.floor((Math.max(0, civ) * s.civPct) / 100),
    manpower: Math.floor((Math.max(0, recruitable) * s.manpowerPct) / 100),
  };
}

/**
 * Spec §9.1: percent of a trade's civilian-factory price the buyer pays —
 * half when it buys from its own dominion. `seller` is the seller's subject
 * line (WwEndgame.subjectOf, or the screens' WwSubjectView), null when the
 * seller is no subject.
 */
export function subjectTradeCivPct(
  seller: { overlord: number; level: SubjectLevel } | null,
  buyer: number,
): number {
  return seller !== null &&
    seller.level === "dominion" &&
    seller.overlord === buyer
    ? WW_DOMINION_TRADE_PCT
    : 100;
}

/** The civilian factories a deal of `civs` costs at `pct` (P1 Trade.tradePaidCivs; rounded up). */
export function paidCivsAt(civs: number, pct: number): number {
  return pct === 100 ? civs : Math.ceil((civs * pct) / 100);
}
