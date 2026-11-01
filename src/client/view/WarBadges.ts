// War overhaul (ww7): the small pure rules the map's badges and the army
// cards share, in a module of its own so the render passes read them
// without pulling the land screens in.

/** Win chance below this (percent) reads "low" on a zone region's badge… */
export const ODDS_MID_PCT = 40;
/** …from here "high"; between the two "medium". */
export const ODDS_HIGH_PCT = 65;
export type OddsLevel = "low" | "mid" | "high";
/** The badge's index in the atlas and the shader: 0 low, 1 medium, 2 high. */
export const ODDS_INDEX: Readonly<Record<OddsLevel, number>> = {
  low: 0,
  mid: 1,
  high: 2,
};

/** ww7: the badge a win % earns: < 40 low, 40–65 medium, ≥ 65 high. */
export function oddsLevel(winPct: number): OddsLevel {
  return winPct < ODDS_MID_PCT
    ? "low"
    : winPct < ODDS_HIGH_PCT
      ? "mid"
      : "high";
}

/** The auto levels (army_auto_level): 0 off, 1 defence only, 2 as the AI. */
export type AutoLevel = 0 | 1 | 2;

/** The auto level an army shows: autoLevel, else `auto` read as the full level. */
export function autoLevelOf(mine: {
  auto: boolean;
  autoLevel?: number;
}): AutoLevel {
  const l = mine.autoLevel ?? (mine.auto ? 2 : 0);
  return l >= 2 ? 2 : l === 1 ? 1 : 0;
}
