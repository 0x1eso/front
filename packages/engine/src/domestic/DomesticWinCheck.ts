import type { WinReason } from "@openfront/engine-api/domestic/DomesticTypes";
import {
  ColoredTeams,
  GameMode,
  Team,
} from "@openfront/engine-api/game/GameTypes";
import {
  domesticScores,
  projectProgress,
  ScoreInput,
} from "@openfront/engine-lib/domestic/Score";
import type { Game, Player } from "../game/Game";

export interface DomesticWin {
  winner: Player | Team;
  reason: WinReason;
}

interface Side {
  winner: Player | Team;
  tiles: number;
  score: number;
}

const UNSCORED: ScoreInput = {
  scored: false,
  tiles: 0,
  science: 0,
  political: 0,
  gold: 0,
  donationGold: 0,
  projectProgress: 0,
};

/** Exact engine inputs: milli-points, gold earned and donated. Bots have no domestic state. */
export function domesticScoreInput(p: Player): ScoreInput {
  const d = p.domestic();
  if (d === null) return UNSCORED;
  return {
    scored: true,
    tiles: p.numTilesOwned(),
    science: d.cumulativeScienceMilli(),
    political: d.cumulativePoliticalMilli(),
    gold: Number(p.goldEarned()),
    donationGold: Number(d.donationGoldReceived()),
    projectProgress: projectProgress(d.victoryProject()),
  };
}

/** One side per player (FFA) or per team, in players() order. The bot team never wins. */
function sides(players: readonly Player[], teams: boolean): Side[] {
  const scores = domesticScores(players.map(domesticScoreInput));
  if (!teams) {
    return players.map((p, i) => ({
      winner: p,
      tiles: p.numTilesOwned(),
      score: scores[i].total,
    }));
  }
  const byTeam = new Map<Team, Side>();
  players.forEach((p, i) => {
    const team = p.team();
    if (team === null || team === ColoredTeams.Bot) return;
    const side = byTeam.get(team) ?? { winner: team, tiles: 0, score: 0 };
    side.tiles += p.numTilesOwned();
    side.score += scores[i].total;
    byTeam.set(team, side);
  });
  return [...byTeam.values()];
}

/**
 * Domestic-mode victory (spec §8), checked in this order: a completed
 * victory project (its owner, or its owner's team), conquest of more than
 * conquestPercent of the land, then at the time limit the highest score
 * (ties: more land, then the earlier side).
 */
export function checkDomesticWin(mg: Game): DomesticWin | null {
  const players = mg.players();
  if (players.length === 0) return null;
  const teams = mg.config().gameConfig().gameMode === GameMode.Team;

  for (const p of players) {
    const project = p.domestic()?.victoryProject() ?? null;
    if (project === null || project.ticksLeft > 0) continue;
    const team = p.team();
    return {
      winner: teams && team !== null ? team : p,
      reason: project.kind,
    };
  }

  const all = sides(players, teams);
  if (all.length === 0) return null;

  const elapsed = mg.elapsedGameSeconds();
  const land = mg.numLandTiles() - mg.numTilesWithFallout();
  const required = mg.config().percentageTilesOwnedToWin(elapsed);
  const byLand = [...all].sort((a, b) => b.tiles - a.tiles);
  // Cross-multiplied like the vanilla check: exact integer math.
  if (byLand[0].tiles * 100 > land * required) {
    return { winner: byLand[0].winner, reason: "conquest" };
  }

  const limit = mg.config().maxTimerMinutes();
  if (limit !== null && elapsed >= limit * 60) {
    const byScore = [...all].sort(
      (a, b) => b.score - a.score || b.tiles - a.tiles,
    );
    return { winner: byScore[0].winner, reason: "score" };
  }
  return null;
}
