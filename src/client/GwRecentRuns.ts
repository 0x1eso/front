// Great War 1914 (design §12): the bodies shown in the last two games. The
// desk pushes them back, through the lobby field `greatWar1914Recent`, so a
// replay deals the same. Kept in the browser only between games. Small on
// purpose: the lobby imports it, and the homepage must not pull in the game.
const KEY = "gw1914.recentRuns";
/** The shelf (hud/ww1914/GwModel): this module reads only who was played. */
export const SHELF_KEY = "gw1914.shelf";
/** The last prologue's choices, by nation. */
const PROLOGUE_KEY = "gw1914.prologue";
/** The schema's cap on the lobby field. */
const MAX_PICKS = 200;
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

/**
 * The lobby field: the nations the shelf says were played. Always a list: an
 * empty one means every nation's first game, absent means nobody asked.
 */
export function gwPlayedTags(): string[] {
  try {
    const raw = localStorage.getItem(SHELF_KEY);
    const shelf = (raw === null ? {} : JSON.parse(raw)) as {
      played?: unknown;
      runs?: unknown;
    };
    const played = Array.isArray(shelf.played) ? shelf.played : [];
    const runs = Array.isArray(shelf.runs) ? shelf.runs : [];
    const tags = [...played, ...runs.map((r: { tag?: unknown }) => r?.tag)];
    return [
      ...new Set(
        tags.filter(
          (x): x is string => typeof x === "string" && x.length === 3,
        ),
      ),
    ];
  } catch {
    return [];
  }
}

function loadPrologues(): Record<string, readonly string[]> {
  try {
    const raw = localStorage.getItem(PROLOGUE_KEY);
    const all: unknown = raw === null ? {} : JSON.parse(raw);
    return typeof all === "object" && all !== null
      ? (all as Record<string, readonly string[]>)
      : {};
  } catch {
    return {};
  }
}

/** Keeps what a played prologue chose, for the next game that skips it. */
export function noteGwPrologue(tag: string, picks: readonly string[]): void {
  try {
    localStorage.setItem(
      PROLOGUE_KEY,
      JSON.stringify({ ...loadPrologues(), [tag]: [...picks] }),
    );
  } catch {
    // Storage off: a later skip starts neutral.
  }
}

/** What a skip of this nation would apply; empty: it starts neutral. */
export function gwProloguePicks(tag: string): string[] {
  const picks = loadPrologues()[tag];
  if (!Array.isArray(picks)) return [];
  return picks.filter((x) => typeof x === "string").slice(0, MAX_PICKS);
}

/** The lobby field. */
export function gwPrologueField(tag: string, play: boolean) {
  return { play, picks: play ? [] : gwProloguePicks(tag) };
}
