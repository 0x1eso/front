/** What the balance simulation records for one nation (times in game minutes). */
export interface NationRecord {
  personality: string;
  firstNuke: number | null;
  tier1: number | null;
  tier2: number | null;
  projectStart: number | null;
  projectDone: number | null;
  techs: number;
  laws: number;
  /** When the nation was eliminated; null when it lived to the end. */
  death: number | null;
}

export type Verdict = "ok" | "below" | "above" | "never";

export interface MilestoneTarget {
  label: string;
  /** Personalities the milestone is about; empty means every nation. */
  personalities: readonly string[];
  pick: (r: NationRecord) => number | null;
  target: readonly [number, number];
  /** How far outside the target range still passes (spec §1: ±3 minutes). */
  slack: number;
  /**
   * Only nations still alive at this minute count (null: alive at the end
   * of the run). Most nations of an AI-only world are conquered within ten
   * minutes; a nation that died early never had the chance to reach a late
   * milestone, and its frozen tech and law counts aren't a game's worth.
   * Techs and laws per game look at the nations alive at minute 20, counted
   * when they died or the run ended: the few nations alive at the end are
   * often just the conquest winner and its last victims.
   */
  aliveAt: number | null;
}

// Spec §11.2.
export const MILESTONE_TARGETS: readonly MilestoneTarget[] = [
  {
    label: "first nuke (conqueror)",
    personalities: ["conqueror"],
    pick: (r) => r.firstNuke,
    target: [10, 12],
    slack: 3,
    aliveAt: 12,
  },
  {
    label: "government tier 1",
    personalities: [],
    pick: (r) => r.tier1,
    target: [4, 6],
    slack: 3,
    aliveAt: 6,
  },
  {
    label: "government tier 2",
    personalities: [],
    pick: (r) => r.tier2,
    target: [12, 15],
    slack: 3,
    aliveAt: 15,
  },
  {
    label: "project start (scholar, zealot)",
    personalities: ["scholar", "zealot"],
    pick: (r) => r.projectStart,
    target: [18, 20],
    slack: 3,
    aliveAt: 20,
  },
  {
    label: "project done (scholar, zealot)",
    personalities: ["scholar", "zealot"],
    pick: (r) => r.projectDone,
    target: [22, 24],
    slack: 3,
    aliveAt: 24,
  },
  {
    label: "techs per game",
    personalities: [],
    pick: (r) => r.techs,
    target: [8, 10],
    slack: 0,
    aliveAt: 20,
  },
  {
    label: "laws per game",
    personalities: [],
    pick: (r) => r.laws,
    target: [6, 8],
    slack: 0,
    aliveAt: 20,
  },
];

/** Average of the values that exist; null when none do. */
export function mean(values: readonly (number | null)[]): number | null {
  const seen = values.filter((v): v is number => v !== null);
  return seen.length === 0
    ? null
    : seen.reduce((a, b) => a + b, 0) / seen.length;
}

export function milestoneVerdict(
  value: number | null,
  target: readonly [number, number],
  slack: number,
): Verdict {
  if (value === null) return "never";
  if (value < target[0] - slack) return "below";
  if (value > target[1] + slack) return "above";
  return "ok";
}

export interface MilestoneRow {
  label: string;
  measured: number | null;
  /** Nations that reached the milestone / nations it is about. */
  reached: number;
  total: number;
  target: readonly [number, number];
  verdict: Verdict;
  /** The verdict without slack. */
  strict: Verdict;
}

function aliveAt(r: NationRecord, minute: number | null): boolean {
  return r.death === null || (minute !== null && r.death > minute);
}

export function summarize(records: readonly NationRecord[]): MilestoneRow[] {
  return MILESTONE_TARGETS.map((m) => {
    const pool = records.filter(
      (r) =>
        aliveAt(r, m.aliveAt) &&
        (m.personalities.length === 0 ||
          m.personalities.includes(r.personality)),
    );
    const values = pool.map(m.pick);
    const measured = mean(values);
    return {
      label: m.label,
      measured,
      reached: values.filter((v) => v !== null).length,
      total: pool.length,
      target: m.target,
      verdict: milestoneVerdict(measured, m.target, m.slack),
      strict: milestoneVerdict(measured, m.target, 0),
    };
  });
}

export function formatTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const widths = headers.map((h, c) =>
    Math.max(h.length, ...rows.map((r) => r[c].length)),
  );
  const line = (cells: readonly string[]) =>
    cells.map((cell, c) => cell.padEnd(widths[c])).join("  ");
  return [line(headers), line(widths.map((w) => "-".repeat(w)))]
    .concat(rows.map(line))
    .join("\n");
}
