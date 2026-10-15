import { PlayerType } from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreBreakdown,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import type { GameView } from "./GameView";
import type { PlayerView } from "./PlayerView";

/** A player's score input from its last update; null for bots and outside domestic mode. */
export function scoreInputOf(player: PlayerView): ScoreInput | null {
  const d = player.domesticData();
  if (d === null || player.type() === PlayerType.Bot) return null;
  return {
    scored: true,
    tiles: player.numTilesOwned(),
    science: d.cumulativeScience,
    political: d.cumulativePolitical,
    gold: player.goldEarned(),
    donationGold: d.donationGoldReceived ?? 0,
    projectProgress: projectProgress(d.project),
  };
}

const cache = new WeakMap<
  GameView,
  { tick: number; scores: ReadonlyMap<number, ScoreBreakdown> }
>();

/**
 * Live domestic scores (spec §8.2) of the alive, scored players by smallID,
 * computed once per tick with the engine's formula. Whole points stand in
 * for the engine's milli-points, so the last digit can differ from the
 * final judgement.
 */
export function domesticScoreMap(
  game: GameView,
): ReadonlyMap<number, ScoreBreakdown> {
  const tick = game.ticks();
  const hit = cache.get(game);
  if (hit !== undefined && hit.tick === tick) return hit.scores;
  const scored: { id: number; input: ScoreInput }[] = [];
  for (const p of game.playerViews()) {
    if (!p.isAlive()) continue;
    const input = scoreInputOf(p);
    if (input !== null) scored.push({ id: p.smallID(), input });
  }
  const breakdowns = domesticScores(scored.map((s) => s.input));
  const scores = new Map<number, ScoreBreakdown>();
  scored.forEach((s, i) => scores.set(s.id, breakdowns[i]));
  cache.set(game, { tick, scores });
  return scores;
}

/** A player's live score; 0 for bots and outside domestic mode. */
export function domesticScoreOf(player: PlayerView, game: GameView): number {
  return domesticScoreMap(game).get(player.smallID())?.total ?? 0;
}
