import type { GameConfig } from "@openfront/engine-api/Schemas";
import {
  GW_CALENDAR_IDS,
  GwCalendarId,
  GwStage,
} from "@openfront/engine-api/ww1914/GreatWarTypes";
import { daysFromCivil } from "../ww1936/Calendar";

/** A run of equal chapters. */
export interface GwSegment {
  readonly stage: GwStage;
  /** Date of the run's first chapter, YYYY-MM-DD. */
  readonly from: string;
  /** How many chapters. */
  readonly count: number;
  /** Days from one chapter to the next. */
  readonly spanDays: number;
  /** The chapter timer with friends; solo has none. */
  readonly timerSec: number;
  /** Summons each chapter (design §5.6). */
  readonly summons: number;
  /** More in a big chapter (eng/ww1914/Chapters: bigChapter). */
  readonly bigSummons: number;
}

/**
 * The one table of how long a game is: the number of chapters, the span of
 * each and its summons. The lobby picks a row with `greatWar1914Calendar`;
 * a longer game is a new row here and a new id in GW_CALENDAR_IDS.
 */
export const GW_CALENDARS: Readonly<
  Record<GwCalendarId, readonly GwSegment[]>
> = {
  // "1914년 판" (design §3): 12 chapters, about 30 minutes alone.
  y1914: [
    seg("crisis", "1914-06-28", 6, 7, 90, 3),
    seg("y1914", "1914-08-09", 5, 30, 120, 2),
    seg("closing", "1915-01-01", 1, 1, 180, 0),
  ],
  // The default (owner, design §15 no. 6): 60 chapters, a month of war each,
  // three to four hours. About 70 summons a game: fewer than the talks a
  // country has, so nobody hears them all in one game.
  full: [
    seg("crisis", "1914-06-28", 6, 7, 90, 3),
    seg("y1914", "1914-08-09", 5, 30, 120, 1, 1),
    seg("war", "1915-01-01", 48, 30, 120, 1, 1),
    seg("closing", "1918-12-15", 1, 1, 180, 0),
  ],
  // The shorter war (design §3): 36 chapters, two months of war each.
  standard: [
    seg("crisis", "1914-06-28", 6, 7, 90, 3),
    seg("y1914", "1914-08-09", 5, 30, 120, 2),
    seg("war", "1915-01-01", 24, 60, 120, 2),
    seg("closing", "1918-12-01", 1, 1, 180, 0),
  ],
};

function seg(
  stage: GwStage,
  from: string,
  count: number,
  spanDays: number,
  timerSec: number,
  summons: number,
  bigSummons = 0,
): GwSegment {
  return { stage, from, count, spanDays, timerSec, summons, bigSummons };
}

export interface GwChapter {
  readonly index: number;
  readonly stage: GwStage;
  /** daysFromCivil of its date. */
  readonly day: number;
  readonly spanDays: number;
  readonly timerSec: number;
  readonly summons: number;
  readonly bigSummons: number;
}

const expanded = new Map<GwCalendarId, readonly GwChapter[]>();

/** The calendar as a list of chapters. */
export function gwChapters(id: GwCalendarId): readonly GwChapter[] {
  const hit = expanded.get(id);
  if (hit !== undefined) return hit;
  const out: GwChapter[] = [];
  for (const s of GW_CALENDARS[id]) {
    const [y, m, d] = s.from.split("-").map(Number);
    const first = daysFromCivil(y, m, d);
    for (let i = 0; i < s.count; i++) {
      out.push({
        index: out.length,
        stage: s.stage,
        day: first + i * s.spanDays,
        spanDays: s.spanDays,
        timerSec: s.timerSec,
        summons: s.summons,
        bigSummons: s.bigSummons,
      });
    }
  }
  expanded.set(id, out);
  return out;
}

export function gwCalendarOf(
  c: Pick<GameConfig, "greatWar1914Calendar">,
): GwCalendarId {
  return c.greatWar1914Calendar ?? GW_CALENDAR_IDS[0];
}
