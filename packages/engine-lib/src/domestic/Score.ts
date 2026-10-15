import { VictoryProjectProgress } from "@openfront/engine-api/domestic/DomesticTypes";
import { PROJECT_SCORE_MAX, SCORE_PER_CATEGORY } from "./Balance";

/** One player's raw numbers. Any consistent unit works: only shares count. */
export interface ScoreInput {
  /** Bots (and players without domestic state) score nothing and stay out of the totals. */
  scored: boolean;
  tiles: number;
  /** Cumulative science produced. */
  science: number;
  /** Cumulative political power produced. */
  political: number;
  /** Cumulative gold earned (Player.goldEarned), donations included. */
  gold: number;
  /** The part of `gold` that came as donations; it doesn't score. */
  donationGold: number;
  /** 0..1 progress of the player's running victory project; 0 when none. */
  projectProgress: number;
}

export interface ScoreBreakdown {
  land: number;
  science: number;
  political: number;
  economy: number;
  project: number;
  total: number;
}

const ZERO: ScoreBreakdown = {
  land: 0,
  science: 0,
  political: 0,
  economy: 0,
  project: 0,
  total: 0,
};

/** How far a project is, 0..1; 0 for none. */
export function projectProgress(
  p: VictoryProjectProgress | null | undefined,
): number {
  if (p === null || p === undefined || p.totalTicks <= 0) return 0;
  return Math.min(1, Math.max(0, (p.totalTicks - p.ticksLeft) / p.totalTicks));
}

/** Gold the player produced: earned minus what was donated to it. */
function producedGold(i: ScoreInput): number {
  return Math.max(0, i.gold - i.donationGold);
}

/**
 * Spec §8.2: each of land, science, political power and gold earned is
 * worth (mine / everyone's) x 25 points, and a running victory project adds
 * up to 10 by progress. Donated gold counts for nobody (the giver earned
 * it, the receiver didn't), so passing gold around changes no score.
 * Shared by the engine (the 30-minute judgement) and the client (the live
 * leaderboard), so both rank players the same way.
 */
export function domesticScores(
  inputs: readonly ScoreInput[],
): ScoreBreakdown[] {
  let tiles = 0;
  let science = 0;
  let political = 0;
  let gold = 0;
  for (const i of inputs) {
    if (!i.scored) continue;
    tiles += i.tiles;
    science += i.science;
    political += i.political;
    gold += producedGold(i);
  }
  const share = (value: number, total: number) =>
    total > 0 ? (value / total) * SCORE_PER_CATEGORY : 0;
  return inputs.map((i) => {
    if (!i.scored) return ZERO;
    const land = share(i.tiles, tiles);
    const sci = share(i.science, science);
    const pol = share(i.political, political);
    const economy = share(producedGold(i), gold);
    const project =
      PROJECT_SCORE_MAX * Math.min(1, Math.max(0, i.projectProgress));
    return {
      land,
      science: sci,
      political: pol,
      economy,
      project,
      total: land + sci + pol + economy + project,
    };
  });
}
