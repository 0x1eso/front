// Great War 1914 (design §12): the bodies shown in the last two games. The
// desk pushes them back, through the lobby field `greatWar1914Recent`, so a
// replay deals the same. Kept in the browser only between games. Small on
// purpose: the lobby imports it, and the homepage must not pull in the game.
const KEY = "gw1914.recentRuns";
/** Design §15 no. 9: the last two games. */
const RUNS = 2;
/** The schema's cap on the lobby field. */
const MAX_BODIES = 1000;

interface Run {
  id: string;
  shown: readonly string[];
}

function load(): Run[] {
  try {
    const raw = localStorage.getItem(KEY);
    const runs: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(runs) ? (runs as Run[]) : [];
  } catch {
    return [];
  }
}

/** Writes down what this game has shown so far; a left game counts too. */
export function noteGwRun(id: string, shown: readonly string[]): void {
  if (shown.length === 0) return;
  const runs = load().filter((r) => r.id !== id);
  runs.unshift({ id, shown: [...shown] });
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(0, RUNS)));
  } catch {
    // Storage off: the next game just isn't told.
  }
}

/** The lobby field: undefined when there is nothing to push back. */
export function gwRecentBodies(): string[] | undefined {
  const all = new Set(load().flatMap((r) => r.shown));
  return all.size === 0 ? undefined : [...all].slice(0, MAX_BODIES);
}
