import type { StrategicData } from "@openfront/engine-api/strategic/StrategicTypes";

/** What deriveStrategicProgress reads of a player (PlayerView satisfies it). */
export interface StrategicProgressSource {
  isAlive(): boolean;
  strategicData(): StrategicData | null;
}

function fraction(start: number, end: number, now: number): number {
  return Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
}

/**
 * Strategic weapons: unit id -> bar fill (0..1) for every alive player's
 * factories making nukes (the furthest-along nuke) and silo preparing a
 * satellite. Drawn in the structure progress-bar slot, like victory projects.
 */
export function deriveStrategicProgress(
  players: Iterable<StrategicProgressSource>,
  now: number,
): Map<number, number> {
  const out = new Map<number, number>();
  for (const p of players) {
    if (!p.isAlive()) continue;
    const data = p.strategicData();
    if (data === null) continue;
    for (const job of data.jobs) {
      const f = fraction(job.startTick, job.endTick, now);
      out.set(job.factoryId, Math.max(out.get(job.factoryId) ?? 0, f));
    }
    const sat = data.satellite;
    if (sat.phase === "preparing") {
      out.set(sat.siloId, fraction(sat.startTick, sat.readyTick, now));
    }
  }
  return out;
}
