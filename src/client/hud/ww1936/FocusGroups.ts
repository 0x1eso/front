import type { FocusDef } from "@openfront/engine-api/ww1936/PoliticsTypes";
import {
  FOCUS_BYPASSED,
  FOCUS_DONE,
  FOCUS_OPEN,
  FOCUS_QUEUED,
  FOCUS_RUNNING,
  groupKey,
} from "./FocusLayout";

export { groupKey };

// World War 1936: the focus screen for trees of ~100 cards. Pure helpers (no
// DOM): collapse by `group` (else by branch), search by name, and the
// recommend star. All of it is per-viewer UI state; nothing is sent or hashed.

export interface FocusGroup {
  key: string;
  /** Tree positions. */
  members: number[];
  done: number;
}

/** The groups in order of first appearance, with their done counts. */
export function focusGroups(
  tree: readonly Pick<FocusDef, "group" | "branch">[],
  states: readonly number[],
): FocusGroup[] {
  const map = new Map<string, FocusGroup>();
  tree.forEach((f, i) => {
    const k = groupKey(f);
    let g = map.get(k);
    if (g === undefined) {
      g = { key: k, members: [], done: 0 };
      map.set(k, g);
    }
    g.members.push(i);
    const s = states[i];
    if (s === FOCUS_DONE || s === FOCUS_BYPASSED) g.done++;
  });
  return [...map.values()];
}

/** A group id as words: "deu_war_strategy" -> "war strategy" (the tag prefix is dropped). */
export function groupLabel(key: string): string {
  if (key.startsWith("branch:")) return key.slice(7);
  const parts = key.split("_");
  return (parts.length > 1 ? parts.slice(1) : parts).join(" ");
}

/**
 * Which cards are hidden: members of a collapsed group, except the running or
 * queued card, the picked one and search matches (they stay reachable).
 */
export function hiddenCards(
  tree: readonly Pick<FocusDef, "group" | "branch">[],
  collapsed: ReadonlySet<string>,
  keep: ReadonlySet<number>,
): boolean[] {
  return tree.map((f, i) => collapsed.has(groupKey(f)) && !keep.has(i));
}

/** Tree positions whose name contains the query (case-insensitive); none for an empty query. */
export function searchMatches(
  names: readonly string[],
  query: string,
): number[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  const out: number[] = [];
  names.forEach((n, i) => {
    if (n.toLowerCase().includes(q)) out.push(i);
  });
  return out;
}

/**
 * The historical-path star: the first card of the path that is not done, if it
 * can be started now. A hint only (the AI's weighted top 3 needs the engine's
 * condition evaluator, which the client does not have).
 */
export function recommendedIndex(
  tree: readonly Pick<FocusDef, "id">[],
  states: readonly number[],
  path: readonly string[] | undefined,
): number {
  for (const id of path ?? []) {
    const i = tree.findIndex((f) => f.id === id);
    if (i < 0) continue;
    const s = states[i];
    if (s === FOCUS_DONE || s === FOCUS_BYPASSED) continue;
    return s === FOCUS_OPEN ? i : -1;
  }
  return -1;
}

/** The view filters (per viewer; they only fade cards, nothing is sent). */
export interface FocusFilters {
  /** Only what can be started or is running now. */
  available: boolean;
  /** Only the historical path. */
  history: boolean;
  /** Not the finished ones. */
  hideDone: boolean;
}

/** Which cards the filters fade out; `keep` (running, queued, picked) stays lit. */
export function fadedCards(
  tree: readonly Pick<FocusDef, "id">[],
  states: readonly number[],
  f: FocusFilters,
  path: readonly string[] | undefined,
  keep: ReadonlySet<number>,
): boolean[] {
  const onPath = new Set(path ?? []);
  return tree.map((d, i) => {
    if (keep.has(i)) return false;
    const s = states[i];
    const done = s === FOCUS_DONE || s === FOCUS_BYPASSED;
    if (f.hideDone && done) return true;
    if (f.history && !onPath.has(d.id)) return true;
    if (
      f.available &&
      s !== FOCUS_OPEN &&
      s !== FOCUS_RUNNING &&
      s !== FOCUS_QUEUED
    ) {
      return true;
    }
    return false;
  });
}
