import type { DomesticData } from "@openfront/engine-api/domestic/DomesticTypes";
import { projectProgress } from "@openfront/engine-lib/domestic/Score";

/** What deriveVictoryProjects reads of a player (PlayerView satisfies it). */
export interface VictoryProjectSource {
  isAlive(): boolean;
  domesticData(): DomesticData | null;
}

/** Host unit id -> progress (0..1) of every victory project an alive player runs. */
export function deriveVictoryProjects(
  players: Iterable<VictoryProjectSource>,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of players) {
    if (!p.isAlive()) continue;
    const project = p.domesticData()?.project;
    if (project === undefined) continue;
    out.set(project.hostUnitId, projectProgress(project));
  }
  return out;
}
